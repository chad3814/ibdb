import { ApiBook } from "@/api";
import { db, Author, Binding, Image as DbImage } from "./db";
import { FullBook, getApiBook } from "@/apiConvert";
import sizeOf from 'image-size';
import { Book, Edition } from "../../prisma/client";
import { addBookToQueue } from "./hardcoverQueue";

const RAINFOREST_ENDPOINT = 'https://api.rainforestapi.com/request';
const AMAZON_DOMAIN = 'amazon.com';
const BOOKS_CATEGORY_ID = '283155';
const SEARCH_RESULT_LIMIT = 10;

type RainforestAuthor = {
    name: string;
    link?: string;
    format?: string;
    runtime?: string;
};

type RainforestImage = {
    link: string;
    variant?: string;
};

type RainforestProduct = {
    title: string;
    asin: string;
    isbn_10?: string;
    isbn_13?: string;
    publisher?: string;
    publication_date?: string;
    language?: string;
    book_description?: string;
    authors?: RainforestAuthor[];
    images?: RainforestImage[];
    main_image?: { link: string };
    format?: string;
};

type RainforestProductRes = {
    request_info?: { success: boolean; message?: string };
    product?: RainforestProduct;
};

type RainforestSearchResult = {
    position?: number;
    title?: string;
    asin?: string;
    link?: string;
    image?: string;
};

type RainforestSearchRes = {
    request_info?: { success: boolean; message?: string };
    search_results?: RainforestSearchResult[];
};

function inferBinding(product: RainforestProduct): Binding {
    const authorFormat = product.authors?.find(a => a.format)?.format;
    const haystack = `${product.format ?? ''} ${authorFormat ?? ''} ${product.title}`.toLowerCase();
    if (haystack.includes('kindle') || haystack.includes('ebook') || haystack.includes('epub')) {
        return Binding.Ebook;
    }
    if (haystack.includes('audible') || haystack.includes('audio') || haystack.includes('mp3')) {
        return Binding.Audiobook;
    }
    if (haystack.includes('hardcover')) {
        return Binding.Hardcover;
    }
    if (haystack.includes('paperback') || haystack.includes('mass market')) {
        return Binding.Paperback;
    }
    return Binding.Unknown;
}

async function imageHelper(url: string): Promise<[number, number]> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error('failed to download image');
    }

    const size = sizeOf(new Uint8Array(await res.arrayBuffer()));
    return [size.width!, size.height!];
}

async function saveRainforestBook(product: RainforestProduct): Promise<FullBook | null> {
    const isbn13 = product.isbn_13;
    if (!isbn13) {
        return null;
    }

    const authorsList = (product.authors ?? [])
        .map(a => a.name)
        .filter((name): name is string => Boolean(name));
    const imageUrl = product.main_image?.link ?? product.images?.[0]?.link;
    const binding = inferBinding(product);

    const book = await db.$transaction(
        async $tx => {
            const b = await $tx.book.findFirst({
                where: {
                    editions: {
                        some: {
                            isbn13,
                        }
                    }
                },
                include: {
                    authors: true,
                    editions: {
                        include: {
                            image: true,
                        },
                    },
                }
            });

            if (b) {
                const matchingEdition = b.editions.find(e => e.isbn13 === isbn13);
                if (matchingEdition && !matchingEdition.asin && product.asin) {
                    await $tx.edition.update({
                        where: { id: matchingEdition.id },
                        data: { asin: product.asin },
                    });
                    matchingEdition.asin = product.asin;
                }
                return Object.assign(b, {
                    image: b.editions[0].image ?? null,
                });
            }

            const existingBook = await $tx.book.findFirst({
                where: {
                    title: product.title,
                    authors: {
                        some: {
                            name: {
                                in: authorsList,
                            }
                        }
                    }
                },
                include: {
                    editions: true,
                }
            });

            let newEdition: Edition | null = null;
            let newBook: (Book & { editions: Edition[] }) | null = null;
            if (existingBook) {
                newBook = existingBook;
                newEdition = await $tx.edition.create({
                    data: {
                        isbn13,
                        binding,
                        publicationDate: product.publication_date,
                        publisher: product.publisher,
                        bookId: existingBook.id,
                        asin: product.asin,
                    }
                });
                if (!newEdition) {
                    throw new Error('failed to create edition');
                }
                await $tx.book.update({
                    where: {
                        id: existingBook.id,
                    },
                    data: {
                        updatedAt: new Date(),
                    }
                });
                newBook.editions.push(newEdition);
            } else {
                newBook = await $tx.book.create({
                    data: {
                        title: product.title,
                        synopsis: product.book_description,
                        editions: {
                            create: {
                                isbn13,
                                binding,
                                publicationDate: product.publication_date,
                                publisher: product.publisher,
                                asin: product.asin,
                            }
                        }
                    },
                    include: {
                        editions: true,
                    }
                });

                if (!newBook) {
                    throw new Error('failed to create book');
                }

                try {
                    await addBookToQueue(newBook.id);
                } catch (error) {
                    console.warn('Failed to add book to HardcoverQueue:', error);
                }
                newEdition = newBook.editions[0];
                if (!newEdition) {
                    throw new Error('failed to create edition');
                }
            }

            const authors: Author[] = [];
            for (const name of authorsList) {
                const author = await $tx.author.upsert({
                    where: {
                        name,
                    },
                    create: {
                        name,
                        books: {
                            connect: {
                                id: newBook.id
                            }
                        }
                    },
                    update: {
                        books: {
                            connect: {
                                id: newBook.id
                            }
                        }
                    },
                });
                authors.push(author);
            }

            let image: DbImage | null = null;
            if (imageUrl) {
                try {
                    const [width, height] = await imageHelper(imageUrl);
                    image = await $tx.image.upsert({
                        where: {
                            url: imageUrl,
                        },
                        create: {
                            url: imageUrl,
                            width,
                            height,
                            editions: {
                                connect: {
                                    id: newEdition.id
                                }
                            }
                        },
                        update: {
                            editions: {
                                connect: {
                                    id: newEdition.id
                                }
                            }
                        }
                    });
                } catch (err) {
                    console.log('failed to get image', err);
                }
            }

            return Object.assign(newBook, { authors }, { image });
        }
    );
    return book;
}

async function fetchProduct(apiKey: string, params: Record<string, string>): Promise<RainforestProduct | null> {
    const url = new URL(RAINFOREST_ENDPOINT);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('type', 'product');
    url.searchParams.set('amazon_domain', AMAZON_DOMAIN);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 404) {
            return null;
        }
        console.error(`Rainforest product lookup failed: ${res.status} - ${res.statusText}`);
        throw new Error('Rainforest Error');
    }
    const json = await res.json() as RainforestProductRes;
    return json.product ?? null;
}

export async function search(q: string): Promise<ApiBook[]> {
    const apiKey = process.env.RAINFOREST_API_KEY;
    if (!apiKey) {
        throw new Error('Missing RAINFOREST_API_KEY');
    }

    const url = new URL(RAINFOREST_ENDPOINT);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('type', 'search');
    url.searchParams.set('amazon_domain', AMAZON_DOMAIN);
    url.searchParams.set('search_term', q);
    url.searchParams.set('category_id', BOOKS_CATEGORY_ID);

    const res = await fetch(url);
    if (!res.ok) {
        console.error(`failed to search Rainforest ${url}, ${res.status} - ${res.statusText}`);
        throw new Error('Rainforest Error');
    }

    const data = await res.json() as RainforestSearchRes;
    const asins = (data.search_results ?? [])
        .slice(0, SEARCH_RESULT_LIMIT)
        .map(r => r.asin)
        .filter((asin): asin is string => Boolean(asin));

    const products = await Promise.all(
        asins.map(asin =>
            fetchProduct(apiKey, { asin }).catch(err => {
                console.warn(`Rainforest product lookup failed for ASIN ${asin}:`, err);
                return null;
            })
        )
    );

    const books: ApiBook[] = [];
    for (const product of products) {
        if (!product) continue;
        const saved = await saveRainforestBook(product);
        if (saved) {
            books.push(getApiBook(saved));
        }
    }

    for (const book of books) {
        await db.bookQuery.upsert({
            where: {
                query: q,
            },
            create: {
                query: q,
                books: {
                    connect: {
                        id: book.id
                    }
                }
            },
            update: {
                books: {
                    connect: {
                        id: book.id
                    }
                }
            }
        });
    }

    return books;
}

export async function lookupByIsbn13(isbn13: string): Promise<FullBook | null> {
    const apiKey = process.env.RAINFOREST_API_KEY;
    if (!apiKey) {
        throw new Error('Missing RAINFOREST_API_KEY');
    }

    const product = await fetchProduct(apiKey, { gtin: isbn13 });
    if (!product) {
        return null;
    }

    return saveRainforestBook(product);
}

export async function lookupByAsin(asin: string): Promise<FullBook | null> {
    const edition = await db.edition.findFirst({
        where: { asin },
        include: {
            book: {
                include: {
                    authors: true,
                    editions: {
                        include: {
                            image: true,
                        },
                    },
                }
            },
            image: true,
        }
    });

    if (edition) {
        const book = edition.book;
        return Object.assign(book, {
            image: edition.image ?? book.editions[0].image ?? null,
            publicationDate: edition.publicationDate ?? null,
            publisher: edition.publisher ?? null,
            binding: edition.binding as Binding,
        });
    }

    const apiKey = process.env.RAINFOREST_API_KEY;
    if (!apiKey) {
        throw new Error('Missing RAINFOREST_API_KEY');
    }

    const product = await fetchProduct(apiKey, { asin });
    if (!product) {
        return null;
    }

    return saveRainforestBook(product);
}
