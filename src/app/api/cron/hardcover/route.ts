import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cronAuth';
import { claimBooks, releaseClaim, releaseOldClaims, removeBookFromQueue } from '@/server/hardcoverQueue';
import { queryHardcover, selectEdition } from '@/server/hardcover';
import { applyEnrichment } from '@/server/hardcoverEnrich';
import { runEnrichmentBatch, type QueueBook, type WorkerDeps } from '@/server/hardcoverWorker';

export const maxDuration = 60;

// Hardcover enforces two policies at once:
//   q=60;w=60;burst=30    -- 60 requests per minute
//   "daily";q=50000;w=86400 -- 50,000 requests per day
//
// The daily policy binds, not the per-minute one: running flat out at 60/min
// would be 86,400/day. 50,000/day averages to ~34.7/min.
//
// The daily cap is enforced by the cron schedule rather than a counter, so it
// cannot drift: every minute (1440 runs/day) x 34 books = 48,960/day, leaving
// ~1,000 spare for retries. Raising the cap means raising BATCH_SIZE and
// BUDGET_MS together, and the schedule in vercel.json.
/** One request per second keeps a run inside the 60/minute policy. */
const PER_ITEM_MS = 1_000;
/** 34 books at 1s each, with room to release claims and respond. */
const BUDGET_MS = 45_000;
/** Sized so 1440 runs a day stay under the 50,000/day policy. */
const BATCH_SIZE = 34;
/** A run that dies mid-batch strands its claim until this reclaims it. */
const STALE_CLAIM_MINUTES = 15;

type CronResult = {
    status: 'ok';
    claimed: number;
    processed: number;
    enriched: number;
    noMatch: number;
    failed: number;
    released: number;
    recovered: number;
    remaining: number;
    stoppedEarly: boolean;
    rateLimited: boolean;
} | {
    status: 'error';
    message: string;
};

export async function GET(req: NextRequest): Promise<NextResponse<CronResult>> {
    if (!isCronAuthorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
        return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const token = process.env.HARDCOVER_TOKEN;
    if (!token) {
        return NextResponse.json({ status: 'error', message: 'HARDCOVER_TOKEN is not set' }, { status: 500 });
    }

    // Recover anything a previous run left claimed before taking more.
    const recovered = await releaseOldClaims(STALE_CLAIM_MINUTES);

    const { books, processingId, remainingUnclaimed } = await claimBooks(undefined, BATCH_SIZE);

    if (books.length === 0) {
        return NextResponse.json({
            status: 'ok',
            claimed: 0, processed: 0, enriched: 0, noMatch: 0, failed: 0,
            released: 0, recovered, remaining: remainingUnclaimed,
            stoppedEarly: false, rateLimited: false,
        });
    }

    const queueBooks: QueueBook[] = books.map(b => ({
        id: b.id,
        title: b.title,
        authors: b.authors.map(a => ({ id: a.id, name: a.name })),
        editions: b.editions.map(e => ({ id: e.id, isbn13: e.isbn13 })),
    }));

    const deps: WorkerDeps = {
        lookup: async book => {
            const { response } = await queryHardcover({
                title: book.title,
                name: book.authors[0]?.name ?? '',
                isbn: book.editions[0]?.isbn13,
            }, token);
            return selectEdition(response);
        },
        apply: applyEnrichment,
        dequeue: async bookId => {
            await removeBookFromQueue(bookId);
        },
        now: () => Date.now(),
        sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    };

    const result = await runEnrichmentBatch(queueBooks, deps, {
        budgetMs: BUDGET_MS,
        perItemMs: PER_ITEM_MS,
    });

    // Whatever we did not finish goes back on the queue now, rather than
    // waiting out STALE_CLAIM_MINUTES.
    const released = await releaseClaim(processingId);

    return NextResponse.json({
        status: 'ok',
        claimed: books.length,
        processed: result.processed,
        enriched: result.enriched,
        noMatch: result.noMatch,
        failed: result.failed,
        released,
        recovered,
        remaining: remainingUnclaimed,
        stoppedEarly: result.stoppedEarly,
        rateLimited: result.rateLimited,
    });
}
