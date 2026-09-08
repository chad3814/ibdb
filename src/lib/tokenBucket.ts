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
 * Chosen against a full day of production traffic: 18,729 misses across 387
 * clients, against a 15,000/day ISBNdb quota. Capacity 400 with 700/day refill
 * holds it to ~14,278/day and touches 10 clients; the other 377 never notice.
 *
 * Note that capacity adds to refill -- a bucket does not cap a client at
 * `refillPerDay` over a single day, it allows up to capacity + refill. That is
 * why the sustained figure is 700 rather than the 800 a hard daily cap allows.
 */
export const SEARCH_BUCKET: BucketConfig = {
    capacity: 400,
    refillPerDay: 700,
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
