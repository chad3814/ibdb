/**
 * How long a negative result (a search that matched nothing, an ISBN ISBNdb
 * has no record of) is trusted before we spend another API request on it.
 */
export const NEGATIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** True when `at` is within `ttlMs` of `now`. */
export function isFresh(at: Date, ttlMs: number, now: Date = new Date()): boolean {
    return now.getTime() - at.getTime() < ttlMs;
}
