import { ApiBook } from "@/api";
import { getApiBook } from "@/apiConvert";
import { lookupByIsbn13 } from "@/server/isbndb";
import { lookupByIsbn13 as lookupRainforestByIsbn13 } from "@/server/rainforest";
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

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse<IsbnResponse>> {
    const p = await params;
    const isbn = p.isbn;

    if (!isbn) {
        return NextResponse.json({
            status: 'error',
            message: 'no isbn specified',
        });
    }

    let book = await lookupByIsbn13(isbn);
    if (!book) {
        try {
            book = await lookupRainforestByIsbn13(isbn);
        } catch (err) {
            console.error(`Rainforest ISBN fallback failed for ${isbn}:`, err);
        }
    }

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