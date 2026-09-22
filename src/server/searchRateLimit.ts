import { db } from './db';
import { GLOBAL_BUCKET, SEARCH_BUCKET, consumeToken, type BucketConfig, type BucketDecision } from '@/lib/tokenBucket';

/**
 * Reserved `clientHash` for the site-wide budget, sharing the SearchRateLimit
 * table rather than needing a second one. Cannot collide with a real client:
 * those keys are 12 hex characters from hashClientIp.
 */
export const GLOBAL_BUDGET_KEY = '__global__';

/**
 * Spends one token from a named bucket.
 *
 * Fails open. A limiter that turns a database blip into a wall of 429s is
 * worse than the over-quota problem it exists to solve, so any error here
 * lets the request through.
 */
async function takeToken(key: string, config: BucketConfig, now: Date): Promise<BucketDecision> {
    try {
        const existing = await db.searchRateLimit.findUnique({
            where: { clientHash: key },
        });

        const decision = consumeToken(
            existing ? { tokens: existing.tokens, updatedAt: existing.updatedAt } : null,
            config,
            now
        );

        await db.searchRateLimit.upsert({
            where: { clientHash: key },
            create: { clientHash: key, tokens: decision.tokens, updatedAt: now },
            update: { tokens: decision.tokens, updatedAt: now },
        });

        return decision;
    } catch (err) {
        console.error(`rate limit check failed for ${key}, allowing:`, err);
        return { allowed: true, tokens: config.capacity, retryAfterSeconds: 0 };
    }
}

/** Spends one token for a search that is about to reach ISBNdb, for one client. */
export function takeSearchToken(clientHash: string, now: Date = new Date()): Promise<BucketDecision> {
    return takeToken(clientHash, SEARCH_BUCKET, now);
}

/**
 * Spends one token from the site-wide ISBNdb budget.
 *
 * The per-client limit cannot protect the quota on its own: hundreds of clients
 * each inside their own limit still add up, and that is where the growth is.
 * Check this after the per-client limit so a client that is already being
 * refused does not also consume site budget for a request we reject anyway.
 */
export function takeGlobalToken(now: Date = new Date()): Promise<BucketDecision> {
    return takeToken(GLOBAL_BUDGET_KEY, GLOBAL_BUCKET, now);
}

/**
 * What a caller must supply to spend ISBNdb quota. Injected rather than reached
 * for, so a code path that reaches ISBNdb has to say which budget it spends
 * from -- and an unlimited one has to say so out loud.
 */
export type SpendToken = () => Promise<BucketDecision>;

/**
 * The full check for one request that is about to reach ISBNdb: the client's
 * own allowance, then the site-wide budget.
 *
 * Lives here rather than being inlined per route so the three call sites cannot
 * drift apart on the ordering. Per-client first is deliberate: a client already
 * being refused must not also spend site budget on a request we reject anyway.
 */
export async function spendIsbndbToken(clientHash: string, now: Date = new Date()): Promise<BucketDecision> {
    const perClient = await takeToken(clientHash, SEARCH_BUCKET, now);
    if (!perClient.allowed) {
        return perClient;
    }
    return takeToken(GLOBAL_BUDGET_KEY, GLOBAL_BUCKET, now);
}

/**
 * The budget for one ISBN lookup, with the logging that makes it measurable.
 *
 * Both lines deliberately reuse the strings the search path already emits, and
 * the miss is logged BEFORE the decision, exactly as the search route does, so
 * one formula covers every route to ISBNdb:
 *
 *     spend = count("isbndb miss") - count("rate limited client=")
 *
 * The first cut of ISBN limiting logged only refusals, which left successful
 * ISBN spend invisible and quietly turned that formula into a search-only
 * undercount -- the same blind spot the unmetered ISBN path had before it was
 * limited at all. `kind=isbn` keeps the two paths separable without needing a
 * separate string that the formula would not know about.
 *
 * Only called when a lookup is about to reach ISBNdb: a cached book or a fresh
 * negative-cache entry returns before the gate, so neither is logged or
 * charged.
 */
export function isbnLookupBudget(client: string, isbn: string): SpendToken {
    return async () => {
        console.log(`isbndb miss client=${client} kind=isbn isbn=${isbn}`);
        const decision = await spendIsbndbToken(client);
        if (!decision.allowed) {
            console.log(`rate limited client=${client} kind=isbn retryAfter=${decision.retryAfterSeconds}`);
        }
        return decision;
    };
}

/**
 * Spends nothing and never refuses, for the admin page that deliberately
 * bypasses the limiter.
 *
 * Note what this costs: admin lookups reach ISBNdb without debiting the
 * site-wide budget, so the 14,900 ceiling stops being a complete account of
 * real spend while the page is in use. That is the same shape of gap that made
 * the unlimited ISBN path invisible in the first place, so admin requests are
 * at least logged by their routes even though they are not metered.
 */
export const UNLIMITED_ISBNDB_BUDGET: SpendToken = () =>
    Promise.resolve({ allowed: true, tokens: Number.POSITIVE_INFINITY, retryAfterSeconds: 0 });
