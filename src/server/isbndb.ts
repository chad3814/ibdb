import { ApiBook } from "@/api";
import { db, Author, Binding, Image as DbImage } from "./db";
import { FullBook, getApiBook } from "@/apiConvert";
import sizeOf from 'image-size';
import { Book, Edition } from "../../prisma/client";
import { addBookToQueue } from "./hardcoverQueue";
import { NEGATIVE_CACHE_TTL_MS, isFresh } from "@/lib/cacheTtl";
import { isPossibleIsbn13 } from "@/lib/isbn";

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

type ImageInfo = {
    url: string;
    width: number;
    height: number;
}

/** Give up on a cover rather than let it stall the request that needs it. */
const IMAGE_FETCH_TIMEOUT_MS = 8_000;

/**
 * Now that the cover download happens outside the transaction, the body is
 * pure database work and finishes well inside these bounds. They are set
 * explicitly so the limit is a deliberate choice rather than Prisma's 5s
 * default, which a cold Neon compute can exceed on its own.
 */
const TRANSACTION_OPTIONS = {
    maxWait: 10_000,
    timeout: 20_000,
} as const;

const BOOK_INCLUDE = {
    authors: true,
    editions: {
        include: {
            image: true,
        },
    },
} as const;

/** Maps ISBNdb's free-text binding onto our enum. */
export function parseBinding(isbndbBinding: string|undefined): Binding {
    const binding = isbndbBinding?.toLowerCase();
    if (binding?.includes('paperback')) {
        return Binding.Paperback;
    }
    if (binding === 'hardcover') {
        return Binding.Hardcover;
    }
    if (binding?.includes('kindle') || binding === 'epub') {
        return Binding.Ebook;
    }
    if (binding?.includes('audio') || binding?.includes('mp3')) {
        return Binding.Audiobook;
    }
    return Binding.Unknown;
}

/**
 * Whether a search result may be written to the BookQuery cache.
 *
 * An empty result is only cacheable when ISBNdb genuinely returned nothing.
 * Caching an empty result that came back empty because every save failed
 * would suppress a real result set for the whole negative TTL.
 */
export function shouldCacheSearchResult(returnedByApi: number, saved: number): boolean {
    return saved > 0 || returnedByApi === 0;
}

async function imageHelper(url: string): Promise<[number, number]> {
    const res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
    if (!res.ok) {
        throw new Error('failed to download image');
    }

    const size = sizeOf(new Uint8Array(await res.arrayBuffer()));
    return [size.width!, size.height!];
}

async function saveIsbndbBook(isbnBook: IsbnDbSearchBook): Promise<FullBook> {
    // Fast path, outside any transaction: a book we already hold needs neither
    // a cover download nor a write.
    const known = await db.book.findFirst({
        where: {
            editions: {
                some: {
                    isbn13: isbnBook.isbn13
                }
            }
        },
        include: BOOK_INCLUDE,
    });

    if (known) {
        return Object.assign(known, {
            image: known.editions[0]?.image ?? null,
        });
    }

    // Download the cover before opening the transaction. Doing it inside held
    // a transaction open across an uncontrolled network fetch, which blew the
    // timeout and failed the entire search along with it.
    let imageInfo: ImageInfo|null = null;
    if (isbnBook.image) {
        try {
            const [width, height] = await imageHelper(isbnBook.image);
            imageInfo = { url: isbnBook.image, width, height };
        } catch (err) {
            console.log('failed to get image', err);
        }
    }

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
                include: BOOK_INCLUDE,
            });

            if (b) {
                return Object.assign(b, {
                    image: b.editions[0]?.image ?? null,
                });
            }

            // need to create at least an edition
            const binding = parseBinding(isbnBook.binding);

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

                // Add new book to HardcoverQueue (since it won't have hardcoverId).
                // Must write through $tx: newBook is not committed yet, so a
                // separate connection cannot see it and the foreign key check
                // fails with P2003. This was silently swallowed for a year,
                // which is why nothing has been enqueued since 2025-09-14.
                //
                // Deliberately not wrapped in try/catch. An error here aborts
                // the Postgres transaction, so continuing would fail every
                // later statement anyway; search() already tolerates a single
                // book failing without discarding the rest of the results.
                await addBookToQueue(newBook.id, newBook.createdAt, $tx);
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
            if (imageInfo) {
                try {
                    image = await $tx.image.upsert({
                        where: {
                            url: imageInfo.url,
                        },
                        create: {
                            url: imageInfo.url,
                            width: imageInfo.width,
                            height: imageInfo.height,
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
                    console.log('failed to save image', err);
                }
            }

            return Object.assign(newBook, {authors}, {image})
        },
        TRANSACTION_OPTIONS
    );
    return book;
}

export async function search(q: string): Promise<ApiBook[]> {
    // Defence in depth behind the route's own guard: `q` is expected to be
    // already normalized by cleanQuery, and an empty one is never worth a
    // request.
    if (!q) {
        throw new Error('empty search query');
    }
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

    const returned = isbndbBooks.books ?? [];
    const books: ApiBook[] = [];
    for (const isbnBook of returned) {
        // One unsavable book must not discard the whole result set. It used to:
        // the throw escaped search(), the query went uncached, and every retry
        // spent another ISBNdb request.
        try {
            const book = await saveIsbndbBook(isbnBook);
            books.push(getApiBook(book));
        } catch (err) {
            console.error(`failed to save ISBNdb book ${isbnBook.isbn13}:`, err);
        }
    }

    if (shouldCacheSearchResult(returned.length, books.length)) {
        // A single upsert connecting every book, rather than one per book. When
        // `books` is empty this still writes the row, which is what makes a
        // no-result query cacheable at all.
        const connect = books.map(b => ({ id: b.id }));
        await db.bookQuery.upsert({
            where: {
                query: q
            },
            create: {
                query: q,
                books: {
                    connect,
                }
            },
            update: {
                books: {
                    connect,
                },
                updatedAt: new Date(),
            }
        });
    }

    return books;
}

/** Remembers that ISBNdb has no book for this ISBN, so repeats stay free. */
async function recordIsbnMiss(isbn13: string): Promise<void> {
    try {
        await db.isbnMiss.upsert({
            where: {
                isbn13,
            },
            create: {
                isbn13,
            },
            update: {
                updatedAt: new Date(),
            },
        });
    } catch (err) {
        // Failing to record a miss only costs us another request later.
        console.warn(`failed to record ISBN miss for ${isbn13}:`, err);
    }
}

export async function lookupByIsbn13(isbn13: string): Promise<FullBook|null> {
    // Input that cannot be an ISBN-13 cannot be in ISBNdb either. Reject it
    // before it costs a request; `/isbn/[isbn]` is public and crawled.
    if (!isPossibleIsbn13(isbn13)) {
        return null;
    }

    const edition = await db.edition.findFirst({
        where: {
            isbn13,
        },
        include: {
            book: {
                include: BOOK_INCLUDE,
            },
            image: true,
        }
    });

    if (edition) {
        const book = edition.book;
        return Object.assign(book, {
            image: edition.image ?? book.editions[0]?.image ?? null,
            publicationDate: edition.publicationDate ?? null,
            publisher: edition.publisher ?? null,
            binding: edition.binding as Binding,
        });
    }

    // ISBNdb told us recently that this ISBN does not exist. Believe it rather
    // than spending a request to be told again.
    const miss = await db.isbnMiss.findUnique({
        where: {
            isbn13,
        },
    });
    if (miss && isFresh(miss.updatedAt, NEGATIVE_CACHE_TTL_MS)) {
        return null;
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
            await recordIsbnMiss(isbn13);
            return null; // no book found
        }
        throw new Error('ISBNDb Error');
    }
    const isbnBook = await res.json() as IsbnDbIsbnLookupRes;
    if (!isbnBook?.book) {
        await recordIsbnMiss(isbn13);
        return null; // no book found in response
    }

    const book = await saveIsbndbBook(isbnBook.book);
    if (miss) {
        // The ISBN resolved after all; stop shadowing it.
        await db.isbnMiss.deleteMany({
            where: {
                isbn13,
            },
        });
    }
    return book;
}
