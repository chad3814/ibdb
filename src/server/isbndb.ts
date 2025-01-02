import { ApiBook } from "@/api";
import { db, Author, Binding, Image as DbImage } from "./db";
import { getApiBook } from "@/apiConvert";
import sizeOf from 'image-size';

type IsbnDbSearchBook = {
    title: string;
    image?: string;
    title_long?: string;
    date_published?: string;
    publisher?: string;
    synopsis?: string;
    subjects?: string[];
    authors: string[];
    isbn13: string;
    msrp?: number|string;
    edition?: number|string;
    binding?: string;
    language?: string;
    pages?: number;
}

type IsbnDbSearchRes = {
    total: number;
    books: IsbnDbSearchBook[];
}

async function imageHelper(url: string): Promise<[number, number]> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error('failed to download image');
    }

    const size = sizeOf(new Uint8Array(await res.arrayBuffer()));
    return [size.width!, size.height!];
}

export async function search(q: string): Promise<ApiBook[]> {
    if (!process.env.ISBNDB_KEY) {
        throw new Error('Missing ISBNDB Key');
    }
    const headers = new Headers();
    headers.set('Authorization', process.env.ISBNDB_KEY);
    const url = new URL(`https://api2.isbndb.com/books/${encodeURIComponent(q)}`);
    url.searchParams.set('page', '1');
    url.searchParams.set('pageSize', '20');
    url.searchParams.set('shouldMatchAll', '1');
    const options: RequestInit = {
        headers,
    };

    const res = await fetch(url, options);
    if (!res.ok) {
        console.error(`failed to search ISBNDb ${url}, ${res.status} - ${res.statusText}`);
        throw new Error('ISBNDb Error');
    }
    const isbndbBooks = await res.json() as IsbnDbSearchRes;
    if (!isbndbBooks) {
        throw new Error('failed to get json');
    }

    const books: ApiBook[] = []
    for (const isbnBook of isbndbBooks.books) {
        const book = await db.$transaction(
            async $tx => {
                const b = await $tx.book.findFirst({
                    where: {
                        isbn13: isbnBook.isbn13
                    },
                    include: {
                        authors: true,
                        image: true,
                    }
                });

                if (b) {
                    return b;
                }

                let binding: Binding = Binding.Unknown;
                const isbnBinding = isbnBook.binding?.toLowerCase();
                if (isbnBinding?.includes('paperback')) {
                    binding = Binding.Paperback;
                } else if (isbnBinding === 'hardcover') {
                    binding = Binding.Hardcover;
                } else if (isbnBinding?.includes('kindle') || isbnBinding === 'epub') {
                    binding = Binding.Ebook;
                } else if (isbnBinding?.includes('audio') || isbnBinding?.includes('mp3')) {
                    binding = Binding.Audiobook;
                }

                const newBook = await $tx.book.create({
                    data: {
                        title: isbnBook.title,
                        isbn13: isbnBook.isbn13,
                        longTitle: isbnBook.title_long,
                        synopsis: isbnBook.synopsis,
                        publicationDate: String(isbnBook.date_published),
                        publisher: isbnBook.publisher,
                        binding,
                    }
                });

                const authors: Author[] = [];
                if (isbnBook.authors) {
                    for (const name of isbnBook.authors) {
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
                }

                let image: DbImage|null = null;
                if (isbnBook.image) {
                    try {
                        const [width, height] = await imageHelper(isbnBook.image);
                        image = await $tx.image.upsert({
                            where: {
                                url: isbnBook.image,
                            },
                            create: {
                                url: isbnBook.image,
                                width: width,
                                height: height,
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
                            }
                        })
                    } catch(err) {
                        console.log('failed to get iamge', err);
                    }
                }

                return Object.assign(newBook, {authors}, {image})
            }
        );
        books.push(getApiBook(book));
    }

    for (const book of books) {
        await db.bookQuery.upsert({
            where: {
                query: q
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