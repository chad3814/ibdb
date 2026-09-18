import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { isAdminAuthorized } from '@/lib/adminAuth';
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
export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse<Result>> {
    if (!isAdminAuthorized(req.headers.get('x-secret'), process.env.ADMIN_SECRET)) {
        return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

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
