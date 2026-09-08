import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { isAdminAuthorized } from '@/lib/adminAuth';
import { SEARCH_BUCKET, nextTokenAt, refillTokens } from '@/lib/tokenBucket';

export type ThrottledClient = {
    clientHash: string;
    /** Refilled to now, not the raw stored value, so it agrees with nextTokenAt. */
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
    // Most recently active first: the interesting client is the one spending
    // right now. The take() has to use the same ordering, or it would truncate
    // to a different 200 than the one displayed.
    const rows = await db.searchRateLimit.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 200,
    });

    // A row's tokens are only accurate as of its updatedAt, so refill to now
    // before displaying or sorting -- otherwise the count contradicts
    // nextTokenAt, which does refill.
    const clients: ThrottledClient[] = rows
        .map(row => {
            const state = { tokens: row.tokens, updatedAt: row.updatedAt };
            const next = nextTokenAt(state, SEARCH_BUCKET, now);
            return {
                clientHash: row.clientHash,
                tokens: refillTokens(state, SEARCH_BUCKET, now),
                updatedAt: row.updatedAt.toISOString(),
                nextTokenAt: next?.toISOString() ?? null,
                throttled: next !== null,
            };
        })
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    return NextResponse.json({
        status: 'ok',
        clients,
        capacity: SEARCH_BUCKET.capacity,
        refillPerDay: SEARCH_BUCKET.refillPerDay,
    });
}
