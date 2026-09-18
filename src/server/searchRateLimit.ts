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
