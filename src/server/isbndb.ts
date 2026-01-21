import { ApiBook } from "@/api";
import { db, Author, Binding, Image as DbImage } from "./db";
import { FullBook, getApiBook } from "@/apiConvert";
import sizeOf from 'image-size';
import { Book, Edition } from "../../prisma/client";
import { addBookToQueue } from "./hardcoverQueue";

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

type IsbnDbIsbnLookupRes = {
    book: IsbnDbSearchBook;
}

async function imageHelper(url: string): Promise<[number, number]> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error('failed to download image');
    }

    const size = sizeOf(new Uint8Array(await res.arrayBuffer()));
    return [size.width!, size.height!];
}

async function saveIsbndbBook(isbnBook: IsbnDbSearchBook): Promise<FullBook> {
    const book = await db.$transaction(
        async $tx => {
            const b = await $tx.book.findFirst({
                where: {
                    editions: {
                        some: {
                            isbn13: isbnBook.isbn13
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
                return Object.assign(b, {
                    image: b.editions[0].image ?? null,
                });
            }

            // need to create at least an edition
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

            const existingBook = await $tx.book.findFirst({
                where: {
                    title: isbnBook.title,
                    authors: {
                        some: {
                            name: {
                                in: isbnBook.authors,
                            }
                        }
                    }
                },
                include: {
                    editions: true,
                }
            });

            let newEdition: Edition|null = null;
            let newBook: (Book&{editions: Edition[]})|null = null;
            if (existingBook) {
                // book exists, just create a new edition
                newBook = existingBook;
                newEdition = await $tx.edition.create({
                    data: {
                        isbn13: isbnBook.isbn13,
                        binding,
                        publicationDate: String(isbnBook.date_published),
                        publisher: isbnBook.publisher,
                        bookId: existingBook.id,
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
                // no existing book, create a new one
                newBook = await $tx.book.create({
                    data: {
                        title: isbnBook.title,
                        longTitle: isbnBook.title_long,
                        synopsis: isbnBook.synopsis,
                        editions: {
                            create: {
                                isbn13: isbnBook.isbn13,
                                binding,
                                publicationDate: String(isbnBook.date_published),
                                publisher: isbnBook.publisher,
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

                // Add new book to HardcoverQueue (since it won't have hardcoverId)
                try {
                    await addBookToQueue(newBook.id);
                } catch (error) {
                    console.warn('Failed to add book to HardcoverQueue:', error);
                    // Don't fail the book creation if queue addition fails
                }
                newEdition = newBook.editions[0];
                if (!newEdition) {
                    throw new Error('failed to create edition');
                }
            }

            // update authors if needed
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
                    })
                } catch(err) {
                    console.log('failed to get iamge', err);
                }
            }

            return Object.assign(newBook, {authors}, {image})
        }
    );
    return book;
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
    for (const isbnBook of isbndbBooks.books ?? []) {
        const book = await saveIsbndbBook(isbnBook);
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

export async function lookupByIsbn13(isbn13: string): Promise<FullBook|null> {
    const edition = await db.edition.findFirst({
        where: {
            isbn13,
        },
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

    if (!process.env.ISBNDB_KEY) {
        throw new Error('Missing ISBNDB Key');
    }
    const headers = new Headers();
    headers.set('Authorization', process.env.ISBNDB_KEY);
    const url = new URL(`https://api2.isbndb.com/books/${encodeURIComponent(isbn13)}`);
    const options: RequestInit = {
        headers,
    };

    const res = await fetch(url, options);
    if (!res.ok) {
        console.error(`failed to lookup isbn ISBNDb ${url}, ${res.status} - ${res.statusText}`);
        if (res.status === 404) {
            return null; // no book found
        }
        throw new Error('ISBNDb Error');
    }
    const isbnBook = await res.json() as IsbnDbIsbnLookupRes;
    if (!isbnBook?.book) {
        return null; // no book found in response
    }

    const book = await saveIsbndbBook(isbnBook.book);
    return book;
}