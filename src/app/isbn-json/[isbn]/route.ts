import { ApiBook } from "@/api";
import { getApiBook } from "@/apiConvert";
import { lookupByIsbn13 } from "@/server/isbndb";
import { NextRequest, NextResponse } from "next/server";

type IsbnResponseError = {
    status: 'error';
    message: string;
};

type IsbnResponseSuccess = {
    status: 'ok';
    book: ApiBook;
};

type IsbnResponse = IsbnResponseError|IsbnResponseSuccess;

type Params = {
    params: Promise<{
        isbn: string;
    }>;
};

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse<IsbnResponse>> {
    const p = await params;
    const isbn = p.isbn;

    if (!isbn) {
        return NextResponse.json({
            status: 'error',
            message: 'no isbn specified',
        });
    }

    const book = await lookupByIsbn13(isbn);

    if (book) {
        return NextResponse.json({
            status: 'ok',
            book: getApiBook(book),
        });
    }

    return NextResponse.json({
        status: 'error',
        message: `no book with isbn "${isbn}" found`,
    }, {status: 404});
}

export const dynamic = 'force-static';
