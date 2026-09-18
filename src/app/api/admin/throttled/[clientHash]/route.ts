import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { GLOBAL_BUDGET_KEY } from '@/server/searchRateLimit';

type Params = {
    params: Promise<{
        clientHash: string;
    }>;
};

type Result =
    | { status: 'ok'; deleted: number }
    | { status: 'error'; message: string };

/**
 * Clears a client's bucket. The next request from them finds no row and starts
 * full, so this is a reset rather than a permanent exemption -- a client that
 * keeps spending will be throttled again.
 */
// No auth check here on purpose -- the middleware gates it, and accepts the
// cookie as well as the header. Re-checking the header alone here made the
// Reset button return 401, since the page sends only the cookie.
export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse<Result>> {
    const { clientHash } = await params;

    // Deleting the global row would make the next search find no state and
    // start from a full bucket, handing out another `capacity` requests on top
    // of the day's budget -- straight past the ISBNdb quota this exists to
    // protect. Resetting a client is a reset; resetting this would be an
    // exemption from the quota itself.
    if (clientHash === GLOBAL_BUDGET_KEY) {
        return NextResponse.json({
            status: 'error',
            message: 'The site-wide ISBNdb budget cannot be reset: it would allow spending past the daily quota.',
        }, { status: 400 });
    }

    const { count } = await db.searchRateLimit.deleteMany({ where: { clientHash } });
    console.log(`admin reset rate limit for client=${clientHash} rows=${count}`);

    return NextResponse.json({ status: 'ok', deleted: count });
}
