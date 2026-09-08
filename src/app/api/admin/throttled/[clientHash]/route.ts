import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { isAdminAuthorized } from '@/lib/adminAuth';

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
    const { count } = await db.searchRateLimit.deleteMany({ where: { clientHash } });
    console.log(`admin reset rate limit for client=${clientHash} rows=${count}`);

    return NextResponse.json({ status: 'ok', deleted: count });
}
