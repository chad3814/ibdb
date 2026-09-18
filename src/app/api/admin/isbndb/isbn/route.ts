import { NextRequest, NextResponse } from 'next/server';
import { ApiBook } from '@/api';
import { getApiBook } from '@/apiConvert';
import { lookupByIsbn13 } from '@/server/isbndb';
import { UNLIMITED_ISBNDB_BUDGET } from '@/server/searchRateLimit';

type Result =
    | { status: 'ok'; isbn: string; book: ApiBook }
    | { status: 'error'; message: string };

/**
 * Looks up one ISBN straight against ISBNdb, skipping both buckets.
 *
 * Note this still returns a cached book when we already hold the ISBN -- the
 * bypass removes the limit, not the cache, so it cannot be used to force a
 * refetch. See the search route for what the bypass costs in accounting terms.
 */
export async function GET(req: NextRequest): Promise<NextResponse<Result>> {
    const isbn = req.nextUrl.searchParams.get('isbn');
    if (!isbn) {
        return NextResponse.json({ status: 'error', message: 'no isbn specified' }, { status: 400 });
    }

    console.log(`isbndb admin query kind=isbn isbn=${isbn}`);

    try {
        const result = await lookupByIsbn13(isbn, UNLIMITED_ISBNDB_BUDGET);
        if (result.kind === 'found') {
            return NextResponse.json({ status: 'ok', isbn, book: getApiBook(result.book) });
        }
        // 'throttled' is unreachable through UNLIMITED_ISBNDB_BUDGET, which
        // always allows; the union still has to be handled.
        return NextResponse.json({
            status: 'error',
            message: `no book with isbn "${isbn}" found`,
        }, { status: 404 });
    } catch (err) {
        return NextResponse.json({
            status: 'error',
            message: err instanceof Error ? err.message : 'lookup failed',
        }, { status: 502 });
    }
}
