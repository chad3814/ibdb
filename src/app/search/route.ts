import { ApiBook } from "@/api";
import { search } from "@/server/isbndb";
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

export async function GET(req: NextRequest): Promise<NextResponse<SearchResult>> {
    const query = req.nextUrl.searchParams.get('q');
    if (!query) {
        const err: SearchResultError = {
            status: 'error',
            message: 'No Query Specified',
        };
        return NextResponse.json(err, {status: 401});
    }

    try {
        const books = await search(query);
        return NextResponse.json({
            status: 'ok',
            books
        });
    } catch (err) {
        return NextResponse.json({
            status: 'error',
            message: (err as unknown as Error).message
        }, {status: 501});
    }
}