const MS_PER_DAY = 86_400_000;

export type BucketConfig = {
    /** Most tokens that can accrue, so the largest burst an idle client may make. */
    capacity: number;
    /** Sustained allowance, spread evenly rather than reset at midnight. */
    refillPerDay: number;
};

export type BucketState = {
    tokens: number;
    updatedAt: Date;
};

export type BucketDecision = {
    allowed: boolean;
    /** Tokens left after this decision. Persist this. */
    tokens: number;
    /** Seconds until the next token, for the Retry-After header. 0 when allowed. */
    retryAfterSeconds: number;
};

/**
 * Per-client limit for searches that reach ISBNdb.
 *
 * Note that capacity adds to refill -- a bucket does not cap a client at
 * `refillPerDay` over a single day, it allows up to capacity + refill.
 *
 * Retuned from 700/day once the log drain showed what the first guess actually
 * did. Measured over a full day: 353 clients, 15,131 misses, 6,603 refused,
 * 8,528 actually spent against the 15,000/day quota -- so 4,969/day of quota
 * went unused while five clients sat pinned at ~700/day and were refused
 * 42-80% of their requests. 1,200/day hands most of that headroom back;
 * satisfying their full demand would need ~3,500 and put the site at 15,131,
 * over the quota with nothing left for the growth that is actually happening.
 */
export const SEARCH_BUCKET: BucketConfig = {
    capacity: 400,
    refillPerDay: 1_200,
};

/**
 * Site-wide ceiling on searches that reach ISBNdb, spent from one shared
 * bucket rather than per client.
 *
 * Per-client limits cannot protect the quota. They stop one client hogging it,
 * but 353 clients each comfortably inside their own limit still add up, and
 * that is exactly where the growth is: over 17 hours the site's spend rose
 * 8,528 -> 10,031/day while the refusal count stayed flat at ~6,600, so every
 * additional request came from a client the per-client limiter never touches.
 * Without this guard nothing notices until ISBNdb starts refusing calls -- which
 * it did, every day from 2026-08-19 to 2026-09-08, pinned flat at 15,000.
 *
 * capacity + refillPerDay = 14,900 against the 15,000 quota. The 100 of margin
 * exists for exactly one reason: takeToken fails open, so a database blip lets
 * requests through without spending a token and real spend can drift above the
 * ceiling. It is deliberately small -- unused margin is paid-for quota nobody
 * gets to use.
 *
 * An earlier version left 1,000 and justified it as headroom for day-to-day
 * demand volatility. That was wrong: a bucket cannot release more than its own
 * ceiling, so how much demand varies has no bearing on where the ceiling goes.
 *
 * Capacity is the smaller share on purpose. For a site-wide budget the
 * sustained rate is what serves users; a bigger instantaneous burst just
 * front-loads the same day's spend into the first hour.
 *
 * A rolling bucket is safe against ISBNdb's calendar-day reset, and
 * conservatively so: no rolling 24h window can release more than
 * capacity + refillPerDay, so no calendar day can either, wherever the reset
 * happens to fall.
 */
export const GLOBAL_BUCKET: BucketConfig = {
    capacity: 900,
    refillPerDay: 14_000,
};

/**
 * Decides one request against a client's bucket, refilling lazily from elapsed
 * time so there is no background job to run and nothing to reset at midnight.
 *
 * A client with no state yet starts full.
 */
export function consumeToken(
    state: BucketState|null,
    config: BucketConfig,
    now: Date
): BucketDecision {
    const tokensPerMs = config.refillPerDay / MS_PER_DAY;

    let tokens: number;
    if (!state) {
        tokens = config.capacity;
    } else {
        // Clamp elapsed at zero: clock skew between instances must never drain
        // a bucket by running the refill backwards.
        const elapsedMs = Math.max(0, now.getTime() - state.updatedAt.getTime());
        tokens = Math.min(config.capacity, state.tokens + elapsedMs * tokensPerMs);
    }

    if (tokens >= 1) {
        return { allowed: true, tokens: tokens - 1, retryAfterSeconds: 0 };
    }

    // Round up, and never report 0, which would invite an immediate retry.
    const secondsPerToken = MS_PER_DAY / 1000 / config.refillPerDay;
    const retryAfterSeconds = Math.max(1, Math.ceil((1 - tokens) * secondsPerToken));
    return { allowed: false, tokens, retryAfterSeconds };
}

/**
 * A bucket's token count brought forward to `now`.
 *
 * The value stored on a row is only accurate as of its updatedAt, so anything
 * displaying it has to refill first -- otherwise the admin page shows a stale
 * count beside a correctly-computed "available now".
 */
export function refillTokens(state: BucketState, config: BucketConfig, now: Date): number {
    const tokensPerMs = config.refillPerDay / MS_PER_DAY;
    // Clamp elapsed at zero so clock skew cannot run the refill backwards.
    const elapsedMs = Math.max(0, now.getTime() - state.updatedAt.getTime());
    return Math.min(config.capacity, state.tokens + elapsedMs * tokensPerMs);
}

/**
 * When this client's next token becomes available, or null if one is available
 * already. Shares refillTokens with consumeToken so the admin view and the
 * limiter cannot disagree about when a throttled client may retry.
 */
export function nextTokenAt(state: BucketState, config: BucketConfig, now: Date): Date|null {
    const tokens = refillTokens(state, config, now);
    if (tokens >= 1) {
        return null;
    }
    const tokensPerMs = config.refillPerDay / MS_PER_DAY;
    return new Date(now.getTime() + (1 - tokens) / tokensPerMs);
}
