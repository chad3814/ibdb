import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { isAdminAuthorized } from '@/lib/adminAuth';
import { GLOBAL_BUCKET, SEARCH_BUCKET, nextTokenAt, refillTokens } from '@/lib/tokenBucket';
import { GLOBAL_BUDGET_KEY } from '@/server/searchRateLimit';

export type ThrottledClient = {
    clientHash: string;
    /** Refilled to now, not the raw stored value, so it agrees with nextTokenAt. */
    tokens: number;
    updatedAt: string;
    /** ISO timestamp of the next token, or null when one is available now. */
    nextTokenAt: string|null;
    throttled: boolean;
};

/** The site-wide ISBNdb budget. Not a client, and scored against its own config. */
export type GlobalBudget = {
    tokens: number;
    updatedAt: string;
    nextTokenAt: string|null;
    exhausted: boolean;
    capacity: number;
    refillPerDay: number;
};

type Result =
    | {
        status: 'ok';
        clients: ThrottledClient[];
        capacity: number;
        refillPerDay: number;
        /** Null until the first search since deploy creates the row. */
        globalBudget: GlobalBudget|null;
      }
    | { status: 'error'; message: string };

export async function GET(req: NextRequest): Promise<NextResponse<Result>> {
    if (!isAdminAuthorized(req.headers.get('x-secret'), process.env.ADMIN_SECRET)) {
        return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    // Most recently active first: the interesting client is the one spending
    // right now. The take() has to use the same ordering, or it would truncate
    // to a different 200 than the one displayed.
    // Excluded from the client list rather than filtered after: the global row
    // is touched by every allowed search, so it would otherwise always be the
    // most recent row and permanently occupy a slot of the 200.
    const rows = await db.searchRateLimit.findMany({
        where: { clientHash: { not: GLOBAL_BUDGET_KEY } },
        orderBy: { updatedAt: 'desc' },
        take: 200,
    });

    // Scored against GLOBAL_BUCKET, not SEARCH_BUCKET. Using the client config
    // here would report both the token count and the reset time wrongly, since
    // the two buckets have different capacity and refill rates.
    const globalRow = await db.searchRateLimit.findUnique({
        where: { clientHash: GLOBAL_BUDGET_KEY },
    });
    const globalBudget: GlobalBudget|null = globalRow === null ? null : (() => {
        const state = { tokens: globalRow.tokens, updatedAt: globalRow.updatedAt };
        const next = nextTokenAt(state, GLOBAL_BUCKET, now);
        return {
            tokens: refillTokens(state, GLOBAL_BUCKET, now),
            updatedAt: globalRow.updatedAt.toISOString(),
            nextTokenAt: next?.toISOString() ?? null,
            exhausted: next !== null,
            capacity: GLOBAL_BUCKET.capacity,
            refillPerDay: GLOBAL_BUCKET.refillPerDay,
        };
    })();

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
        globalBudget,
    });
}
