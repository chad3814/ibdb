import { ApiBook } from "@/api";
import { getApiBook } from "@/apiConvert";
import { db } from "@/server/db";
import { NextRequest, NextResponse } from "next/server";

type BooksResultSuccess = {
    status: 'ok';
    books: ApiBook[];
    hasMore: boolean;
    total: number;
};

type BooksResultError = {
    status: 'error';
    message: string;
};

type BooksResult = BooksResultSuccess | BooksResultError;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(req: NextRequest): Promise<NextResponse<BooksResult>> {
    try {
        const url = req.nextUrl;
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = Math.min(
            parseInt(url.searchParams.get('limit') || DEFAULT_LIMIT.toString(), 10),
            MAX_LIMIT
        );

        if (isNaN(page) || page < 1) {
            return NextResponse.json({
                status: 'error',
                message: 'Invalid page parameter. Must be a positive integer.'
            }, { status: 400 });
        }

        if (isNaN(limit) || limit < 1) {
            return NextResponse.json({
                status: 'error',
                message: 'Invalid limit parameter. Must be a positive integer.'
            }, { status: 400 });
        }

        const skip = (page - 1) * limit;

        const where = {
            OR: [
                { goodReadsId: { not: null } },
                { openLibraryId: { not: null } },
                { hardcoverId: { not: null } }
            ]
        };

        // Get total count and books in parallel
        const [total, books] = await Promise.all([
            db.book.count({where}),
            db.book.findMany({
                where,
                take: limit,
                skip,
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    authors: true,
                    editions: {
                        include: {
                            image: true
                        },
                        orderBy: {
                            createdAt: 'asc'
                        }
                    }
                }
            })
        ]);

        const hasMore = skip + books.length < total;

        return NextResponse.json({
            status: 'ok',
            books: books.map(book => getApiBook(book)),
            hasMore,
            total
        });

    } catch (error) {
        console.error('Error fetching books:', error);
        return NextResponse.json({
            status: 'error',
            message: 'Internal server error'
        }, { status: 500 });
    }
}