import { NextRequest, NextResponse } from 'next/server';
import { ApiBook } from '@/api';
import { search } from '@/server/isbndb';
import { cleanQuery } from '@/lib/searchQuery';

type Result =
    | { status: 'ok'; query: string; books: ApiBook[] }
    | { status: 'error'; message: string };

/**
 * Runs a search straight against ISBNdb, skipping both buckets.
 *
 * Gated by the middleware like every /api/admin path -- no check here, since a
 * per-handler check is what broke /admin/throttled's own page.
 *
 * Spends no tokens by design, which means these requests reach ISBNdb without
 * debiting the site-wide budget: while this page is in use the 14,900 ceiling
 * is not a complete account of real spend. The log line below is the only
 * record, so grep `isbndb admin query` before concluding a quota overshoot
 * came from public traffic.
 */
export async function GET(req: NextRequest): Promise<NextResponse<Result>> {
    const raw = req.nextUrl.searchParams.get('q');
    if (!raw) {
        return NextResponse.json({ status: 'error', message: 'no q specified' }, { status: 400 });
    }

    const query = cleanQuery(raw);
    console.log(`isbndb admin query kind=search qlen=${query.length} rawlen=${raw.length}`);

    try {
        return NextResponse.json({ status: 'ok', query, books: await search(query) });
    } catch (err) {
        return NextResponse.json({
            status: 'error',
            message: err instanceof Error ? err.message : 'search failed',
        }, { status: 502 });
    }
}
