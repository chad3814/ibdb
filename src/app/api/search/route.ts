import { ApiBook } from "@/api";
import { getApiBook } from "@/apiConvert";
import { db } from "@/server/db";
import { search as searchIsbnDb } from "@/server/isbndb";
import { search as searchRainforest } from "@/server/rainforest";
import { NextRequest, NextResponse } from "next/server";

type SearchResultSuccess = {
    status: 'ok';
    books: ApiBook[];
};

type SearchResultError = {
    status: 'error';
    message: string;
};

type SearchResult = SearchResultSuccess|SearchResultError;

const UNCLEAN = /[^a-zA-Z0-9 ]/gu;
function cleanQuery(query: string): string {
    return query.replaceAll(UNCLEAN, ' ').toLowerCase();
}

export async function GET(req: NextRequest): Promise<NextResponse<SearchResult>> {
    const q = req.nextUrl.searchParams.get('q');
    if (!q) {
        const err: SearchResultError = {
            status: 'error',
            message: 'No Query Specified',
        };
        return NextResponse.json(err, {status: 401});
    }

    const query = cleanQuery(q);
    const requeryBooks = await db.bookQuery.findFirst({
        where: {
            query,
        },
        select: {
            books: {
                include: {
                    authors: true,
                    editions: {
                        include: {
                            image: true
                        }
                    }
                }
            }
        }
    });

    if (requeryBooks) {
        return NextResponse.json({
            status: 'ok',
            books: requeryBooks.books.map(b => getApiBook(b))
        });
    }

    try {
        let books = await searchIsbnDb(query);
        if (books.length === 0) {
            try {
                books = await searchRainforest(query);
            } catch (rainforestErr) {
                console.error(`Rainforest fallback search failed:`, rainforestErr);
            }
        }
        return NextResponse.json({
            status: 'ok',
            books
        });
    } catch (err) {
        console.error(`search threw an error:`, err);
        return NextResponse.json({
            status: 'error',
            message: (err as unknown as Error).message
        }, {status: 501});
    }
}
