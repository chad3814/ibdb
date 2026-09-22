import { ApiBook } from "@/api";
import { getApiBook } from "@/apiConvert";
import { lookupByIsbn13 } from "@/server/isbndb";
import { clientHashFromHeaders } from "@/lib/clientHash";
import { isbnLookupBudget } from "@/server/searchRateLimit";
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

    // An ISBN we already hold, or one ISBNdb recently denied, costs nothing and
    // is never throttled -- the gate below is only reached when the lookup is
    // about to spend quota.
    const client = await clientHashFromHeaders(req.headers);
    const result = await lookupByIsbn13(isbn, isbnLookupBudget(client, isbn));

    if (result.kind === 'throttled') {
        return NextResponse.json({
            status: 'error',
            message: `Rate limit exceeded, retry after ${result.retryAfterSeconds}s`,
        }, {
            status: 429,
            headers: {
                'Retry-After': String(result.retryAfterSeconds),
                'RateLimit-Remaining': '0',
                'RateLimit-Reset': String(result.retryAfterSeconds),
            },
        });
    }

    if (result.kind === 'found') {
        return NextResponse.json({
            status: 'ok',
            book: getApiBook(result.book),
        });
    }

    return NextResponse.json({
        status: 'error',
        message: `no book with isbn "${isbn}" found`,
    }, {status: 404});
}