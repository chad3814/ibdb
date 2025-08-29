import { ApiBook } from "@/api";
import { getApiBook } from "@/apiConvert";
import { db } from "@/server/db";
import { NextRequest, NextResponse } from "next/server";

type AuthorResultSuccess = {
    status: 'ok';
    author: {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        bookCount: number;
    };
    books: ApiBook[];
};

type AuthorResultError = {
    status: 'error';
    message: string;
};

type AuthorResult = AuthorResultSuccess | AuthorResultError;

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<AuthorResult>> {
    try {
        const {id: authorId} = await params;

        // Find the author with their books
        const author = await db.author.findUnique({
            where: { id: authorId },
            include: {
                books: {
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
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            }
        });

        if (!author) {
            return NextResponse.json({
                status: 'error',
                message: 'Author not found'
            }, { status: 404 });
        }

        return NextResponse.json({
            status: 'ok',
            author: {
                id: author.id,
                name: author.name,
                createdAt: author.createdAt,
                updatedAt: author.updatedAt,
                bookCount: author.books.length
            },
            books: author.books.map(book => getApiBook(book))
        });

    } catch (error) {
        console.error('Error fetching author:', error);
        return NextResponse.json({
            status: 'error',
            message: 'Internal server error'
        }, { status: 500 });
    }
}