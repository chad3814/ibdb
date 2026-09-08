import { db } from './db';
import { SEARCH_BUCKET, consumeToken, type BucketDecision } from '@/lib/tokenBucket';

/**
 * Spends one token for a search that is about to reach ISBNdb.
 *
 * Fails open. A limiter that turns a database blip into a wall of 429s is
 * worse than the over-quota problem it exists to solve, so any error here
 * lets the request through.
 */
export async function takeSearchToken(clientHash: string, now: Date = new Date()): Promise<BucketDecision> {
    try {
        const existing = await db.searchRateLimit.findUnique({
            where: { clientHash },
        });

        const decision = consumeToken(
            existing ? { tokens: existing.tokens, updatedAt: existing.updatedAt } : null,
            SEARCH_BUCKET,
            now
        );

        await db.searchRateLimit.upsert({
            where: { clientHash },
            create: { clientHash, tokens: decision.tokens, updatedAt: now },
            update: { tokens: decision.tokens, updatedAt: now },
        });

        return decision;
    } catch (err) {
        console.error(`rate limit check failed for ${clientHash}, allowing:`, err);
        return { allowed: true, tokens: SEARCH_BUCKET.capacity, retryAfterSeconds: 0 };
    }
}
