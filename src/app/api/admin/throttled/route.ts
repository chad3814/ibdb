import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { isAdminAuthorized } from '@/lib/adminAuth';
import { SEARCH_BUCKET, nextTokenAt } from '@/lib/tokenBucket';

export type ThrottledClient = {
    clientHash: string;
    tokens: number;
    updatedAt: string;
    /** ISO timestamp of the next token, or null when one is available now. */
    nextTokenAt: string|null;
    throttled: boolean;
};

type Result =
    | { status: 'ok'; clients: ThrottledClient[]; capacity: number; refillPerDay: number }
    | { status: 'error'; message: string };

export async function GET(req: NextRequest): Promise<NextResponse<Result>> {
    if (!isAdminAuthorized(req.headers.get('x-secret'), process.env.ADMIN_SECRET)) {
        return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const rows = await db.searchRateLimit.findMany({
        orderBy: { tokens: 'asc' },
        take: 200,
    });

    // Tokens in the row are as of updatedAt; refill them to now so the view
    // matches what the limiter would decide for the next request.
    const clients: ThrottledClient[] = rows.map(row => {
        const next = nextTokenAt({ tokens: row.tokens, updatedAt: row.updatedAt }, SEARCH_BUCKET, now);
        return {
            clientHash: row.clientHash,
            tokens: row.tokens,
            updatedAt: row.updatedAt.toISOString(),
            nextTokenAt: next?.toISOString() ?? null,
            throttled: next !== null,
        };
    });

    return NextResponse.json({
        status: 'ok',
        clients,
        capacity: SEARCH_BUCKET.capacity,
        refillPerDay: SEARCH_BUCKET.refillPerDay,
    });
}
