import { ApiBook } from "@/api";
import { getApiBook } from "@/apiConvert";
import { db } from "@/server/db";
import { NextRequest, NextResponse } from "next/server";

type BookResponseError = {
    status: 'error';
    message: string;
};

type BookResponseSuccess = {
    status: 'ok';
    book: ApiBook;
};

type BookResponse = BookResponseError|BookResponseSuccess;

type Params = {
    params: Promise<{
        id: string;
    }>;
};

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse<BookResponse>> {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    if (!id) {
        return NextResponse.json({
            status: 'error',
            message: 'no id specified',
        });
    }

    const fullBook = await db.book.findFirst({
        where: {
            id,
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

    if (fullBook) {
        return NextResponse.json({
            status: 'ok',
            book: getApiBook(fullBook),
        });
    }

    return NextResponse.json({
        status: 'error',
        message: `no book with id "${id}" found`,
    }, {status: 404});
}