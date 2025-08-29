import { db } from "@/server/db";
import { NextRequest, NextResponse } from "next/server";

type AuthorsResultSuccess = {
    status: 'ok';
    authors: Array<{
        id: string;
        name: string;
        bookCount: number;
    }>;
    total: number;
    hasMore: boolean;
};

type AuthorsResultError = {
    status: 'error';
    message: string;
};

type AuthorsResult = AuthorsResultSuccess | AuthorsResultError;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest): Promise<NextResponse<AuthorsResult>> {
    try {
        const url = req.nextUrl;
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = Math.min(
            parseInt(url.searchParams.get('limit') || DEFAULT_LIMIT.toString(), 10),
            MAX_LIMIT
        );
        const letter = url.searchParams.get('letter') || '';

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

        // Build where clause for letter filter
        const where = letter ? {
            name: {
                startsWith: letter.toUpperCase(),
                mode: 'insensitive' as const
            }
        } : {};

        // Get authors with book count
        const [total, authors] = await Promise.all([
            db.author.count({ where }),
            db.author.findMany({
                where,
                take: limit,
                skip,
                include: {
                    _count: {
                        select: { books: true }
                    }
                },
                orderBy: {
                    name: 'asc'
                }
            })
        ]);

        const hasMore = skip + authors.length < total;

        return NextResponse.json({
            status: 'ok',
            authors: authors.map(author => ({
                id: author.id,
                name: author.name,
                bookCount: author._count.books
            })),
            total,
            hasMore
        });

    } catch (error) {
        console.error('Error fetching authors:', error);
        return NextResponse.json({
            status: 'error',
            message: 'Internal server error'
        }, { status: 500 });
    }
}