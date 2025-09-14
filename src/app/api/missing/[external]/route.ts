import { Author, db, Prisma } from "@/server/db";
import { NextRequest,NextResponse } from "next/server";
import { ExternalId, MissingInfo, MissingPostBody, MissingPostResponse, MissingResponse } from "../../../../../types/missing";
import { removeBookFromQueue, claimBooks } from "@/server/hardcoverQueue";

type Params = {
    params: Promise<{
        external: string;
    }>;
};

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse<MissingResponse>> {
    const p = await params;

    // For hardcover, use the new queue system
    if (p.external === 'hardcover') {
        const previousProcessingId = req.nextUrl.searchParams.get('previousProcessingId') || undefined;

        try {
            const { books, processingId, remainingUnclaimed } = await claimBooks(previousProcessingId, 100);

            // Map books to MissingInfo format
            const missing: MissingInfo[] = books.map(book => ({
                editionId: book.editions[0]?.id || '',
                bookId: book.id,
                title: book.title,
                authors: book.authors.map(a => ({
                    id: a.id,
                    name: a.name,
                    hardcoverId: a.hardcoverId ?? null,
                    openLibraryId: a.openLibraryId ?? null,
                    goodReadsId: a.goodReadsId ?? null,
                    hardcoverSlug: a.hardcoverSlug ?? null,
                })),
                isbn13: book.editions[0]?.isbn13 || '',
                bookGoodReadsId: book.goodReadsId ?? null,
                bookOpenLibraryId: book.openLibraryId ?? null,
                bookHardcoverId: book.hardcoverId ?? null,
                bookHardcoverSlug: book.hardcoverSlug ?? null,
            }));

            return NextResponse.json({
                status: 'ok',
                missing,
                total: remainingUnclaimed + missing.length,
                processingId,
                remainingUnclaimed
            });
        } catch (error) {
            console.error('Error claiming books from queue:', error);
            return NextResponse.json({
                status: 'error',
                message: 'Failed to claim books from queue',
            }, {status: 500});
        }
    }

    // Legacy code for non-hardcover external IDs
    const skip = parseInt(req.nextUrl.searchParams.get('skip') || '0', 10);
    if (isNaN(skip) || skip < 0) {
        return NextResponse.json({
            status: 'error',
            message: 'Invalid skip parameter',
        }, {status: 400});
    }
    let externalId: ExternalId = 'hardcoverId';
    if (p.external === 'openlibrary') {
        externalId = 'openLibraryId';
    } else if (p.external === 'goodreads') {
        externalId = 'goodReadsId';
    } else {
        return NextResponse.json({
            status: 'error',
            message: 'Invalid external ID type',
        }, {status: 400});
    }

    const where: Prisma.EditionWhereInput = {
        [externalId]: null,
    };
    const total = await db.edition.count({where});
    const editions = await db.edition.findMany({
        where,
        select: {
            id: true,
            isbn13: true,
            book: {
                select: {
                    id: true,
                    title: true,
                    hardcoverId: true,
                    openLibraryId: true,
                    goodReadsId: true,
                    hardcoverSlug: true,
                    authors: {
                        select: {
                            id: true,
                            name: true,
                            hardcoverId: true,
                            openLibraryId: true,
                            goodReadsId: true,
                            hardcoverSlug: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: 100,
        skip,
    });

    if (editions.length === 0) {
        return NextResponse.json({
            status: 'ok',
            missing: [],
            total,
        });
    }

    const missing: MissingInfo[] = editions.map(e => ({
        editionId: e.id,
        bookId: e.book.id,
        title: e.book.title,
        authors: e.book.authors.map(a => ({
            id: a.id,
            name: a.name,
            hardcoverId: a.hardcoverId ?? null,
            openLibraryId: a.openLibraryId ?? null,
            goodReadsId: a.goodReadsId ?? null,
            hardcoverSlug: a.hardcoverSlug ?? null,
        })),
        isbn13: e.isbn13,
        bookGoodReadsId: e.book.goodReadsId ?? null,
        bookOpenLibraryId: e.book.openLibraryId ?? null,
        bookHardcoverId: e.book.hardcoverId ?? null,
        bookHardcoverSlug: e.book.hardcoverSlug ?? null,
    }));
    return NextResponse.json({
        status: 'ok',
        missing,
        total,
    });
}

export async function POST(req: NextRequest): Promise<NextResponse<MissingPostResponse>> {
    const secret = req.headers.get('x-secret');
    if (!secret || secret !== process.env.MISSING_POST_SECRET) {
        return NextResponse.json({
            status: 'error',
            message: 'Invalid secret',
        }, {status: 401});
    }
    const body: MissingPostBody = await req.json();
    if (!body || !body.edition || !body.book || !body.authors) {
        return NextResponse.json({
            status: 'error',
            message: 'Invalid request body',
        }, {status: 400});
    }

    const editionData: Prisma.EditionUpdateInput = {};
    if (body.edition.hardcoverId !== undefined) {
        editionData.hardcoverId = body.edition.hardcoverId;
    }
    if (body.edition.openLibraryId !== undefined) {
        editionData.openLibraryId = body.edition.openLibraryId;
    }
    if (body.edition.goodReadsId !== undefined) {
        editionData.goodReadsId = body.edition.goodReadsId;
    }
    if (Object.keys(editionData).length === 0) {
        return NextResponse.json({
            status: 'error',
            message: 'No data to update',
        }, {status: 400});
    }

    const edition = await db.edition.update({
        where: {
            id: body.edition.id,
        },
        data: editionData,
    });

    if (!edition) {
        return NextResponse.json({
            status: 'error',
            message: 'Edition not found',
        }, {status: 404});
    }

    const bookData: Prisma.BookUpdateInput = {};
    if (body.book.hardcoverId !== undefined) {
        bookData.hardcoverId = body.book.hardcoverId;
    }
    if (body.book.hardcoverSlug !== undefined) {
        bookData.hardcoverSlug = body.book.hardcoverSlug;
    }
    if (body.book.openLibraryId !== undefined) {
        bookData.openLibraryId = body.book.openLibraryId;
    }
    if (body.book.goodReadsId !== undefined) {
        bookData.goodReadsId = body.book.goodReadsId;
    }
    if (Object.keys(bookData).length === 0) {
        return NextResponse.json({
            status: 'error',
            message: 'No data to update',
        }, {status: 400});
    }
    const book = await db.book.update({
        where: {
            id: body.book.id,
        },
        data: bookData,
    });

    if (!book) {
        return NextResponse.json({
            status: 'error',
            message: 'Book not found',
        }, {status: 404});
    }

    // If hardcoverId was set, remove book from queue
    if (body.book.hardcoverId !== undefined && body.book.hardcoverId !== null) {
        try {
            await removeBookFromQueue(body.book.id);
        } catch (error) {
            console.warn('Failed to remove book from HardcoverQueue:', error);
            // Don't fail the update if queue removal fails
        }
    }

    const authorPromises: Promise<Author>[] = [];
    for (const author of body.authors) {
        const authorData: Prisma.AuthorUpdateInput = {};
        if (author.hardcoverId !== undefined) {
            authorData.hardcoverId = author.hardcoverId;
        }
        if (author.hardcoverSlug !== undefined) {
            authorData.hardcoverSlug = author.hardcoverSlug;
        }
        if (author.openLibraryId !== undefined) {
            authorData.openLibraryId = author.openLibraryId;
        }
        if (author.goodReadsId !== undefined) {
            authorData.goodReadsId = author.goodReadsId;
        }
        if (Object.keys(authorData).length === 0) {
            continue; // Skip if no data to update
        }
        authorPromises.push(db.author.update({
            where: {
                id: author.id,
            },
            data: authorData,
        }));
    }
    const authors = await Promise.all(authorPromises);
    if (authors.some(a => !a)) {
        return NextResponse.json({
            status: 'error',
            message: 'One or more authors not found',
        }, {status: 404});
    }

    return NextResponse.json({
        status: 'ok',
    });
}
