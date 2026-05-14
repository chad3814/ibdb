import { ApiBook } from "@/api";
import { getApiBook } from "@/apiConvert";
import { lookupByAsin } from "@/server/rainforest";
import { NextRequest, NextResponse } from "next/server";

type AsinResponseError = {
    status: 'error';
    message: string;
};

type AsinResponseSuccess = {
    status: 'ok';
    book: ApiBook;
};

type AsinResponse = AsinResponseError|AsinResponseSuccess;

type Params = {
    params: Promise<{
        asin: string;
    }>;
};

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse<AsinResponse>> {
    const p = await params;
    const asin = p.asin;

    if (!asin) {
        return NextResponse.json({
            status: 'error',
            message: 'no asin specified',
        });
    }

    const book = await lookupByAsin(asin);

    if (book) {
        return NextResponse.json({
            status: 'ok',
            book: getApiBook(book),
        });
    }

    return NextResponse.json({
        status: 'error',
        message: `no book with asin "${asin}" found`,
    }, {status: 404});
}
