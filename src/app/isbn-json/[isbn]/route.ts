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

export async function GET(req: NextRequest): Promise<NextResponse<IsbnResponse>> {
    const path = req.nextUrl.pathname;
    const isbn = path.split('/').pop();

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
