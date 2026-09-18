import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GLOBAL_BUCKET, SEARCH_BUCKET, consumeToken, nextTokenAt, refillTokens } from '../src/lib/tokenBucket';
import type { BucketConfig, BucketState } from '../src/lib/tokenBucket';

const cfg = { capacity: 10, refillPerDay: 86_400 }; // 1 token/second, easy arithmetic
const t0 = new Date('2026-09-08T12:00:00Z');
const at = (secs: number) => new Date(t0.getTime() + secs * 1000);

describe('consumeToken', () => {
    it('starts a client it has never seen with a full bucket', () => {
        const d = consumeToken(null, cfg, t0);
        assert.equal(d.allowed, true);
        assert.equal(d.tokens, cfg.capacity - 1);
        assert.equal(d.retryAfterSeconds, 0);
    });

    it('spends one token per allowed request', () => {
        const d = consumeToken({ tokens: 5, updatedAt: t0 }, cfg, t0);
        assert.equal(d.allowed, true);
        assert.equal(d.tokens, 4);
    });

    it('refuses when the bucket is empty', () => {
        const d = consumeToken({ tokens: 0, updatedAt: t0 }, cfg, t0);
        assert.equal(d.allowed, false);
        assert.equal(d.tokens, 0, 'a refused request must not spend a token');
    });

    it('reports how long until one token is available', () => {
        // Empty bucket at 1 token/sec means one second to the next request.
        const d = consumeToken({ tokens: 0, updatedAt: t0 }, cfg, t0);
        assert.equal(d.retryAfterSeconds, 1);
    });

    it('always reports at least one second, never zero, when refusing', () => {
        // Retry-After: 0 would invite an immediate retry storm.
        const fast = { capacity: 10, refillPerDay: 86_400_000 };
        const d = consumeToken({ tokens: 0, updatedAt: t0 }, fast, t0);
        assert.equal(d.allowed, false);
        assert.ok(d.retryAfterSeconds >= 1, `got ${d.retryAfterSeconds}`);
    });

    it('refills with elapsed time', () => {
        const d = consumeToken({ tokens: 0, updatedAt: t0 }, cfg, at(5));
        assert.equal(d.allowed, true);
        assert.equal(d.tokens, 4, '5 tokens accrued, 1 spent');
    });

    it('never refills past capacity, however long the client was idle', () => {
        // Otherwise a client idle for a week could burst thousands of requests.
        const d = consumeToken({ tokens: 0, updatedAt: t0 }, cfg, at(86_400 * 7));
        assert.equal(d.tokens, cfg.capacity - 1);
    });

    it('does not go backwards if a timestamp is in the future', () => {
        // Clock skew between instances must not drain a client's bucket.
        const d = consumeToken({ tokens: 5, updatedAt: at(60) }, cfg, t0);
        assert.equal(d.allowed, true);
        assert.equal(d.tokens, 4);
    });

    it('allows a burst of exactly capacity from full, then refuses', () => {
        let state = { tokens: cfg.capacity, updatedAt: t0 };
        let allowed = 0;
        for (let i = 0; i < cfg.capacity + 3; i++) {
            const d = consumeToken(state, cfg, t0);
            if (d.allowed) {
                allowed++;
            }
            state = { tokens: d.tokens, updatedAt: t0 };
        }
        assert.equal(allowed, cfg.capacity);
    });

    it('is configured for 400 burst and 1,200 a day', () => {
        // Retuned once the log drain showed the first guess's real effect: it
        // was predicted to hold ~14,278/day, and actually held 8,528, leaving
        // 4,969/day of quota unused while refusing 6,603 requests. Do not move
        // these without re-measuring; the behavioural consequences are asserted
        // in the SEARCH_BUCKET and GLOBAL_BUCKET blocks below.
        assert.equal(SEARCH_BUCKET.capacity, 400);
        assert.equal(SEARCH_BUCKET.refillPerDay, 1_200);
    });
});

describe('nextTokenAt', () => {
    it('returns null when a token is available right now', () => {
        assert.equal(nextTokenAt({ tokens: 3, updatedAt: t0 }, cfg, t0), null);
    });

    it('returns null at exactly one token', () => {
        assert.equal(nextTokenAt({ tokens: 1, updatedAt: t0 }, cfg, t0), null);
    });

    it('reports when the next token arrives for an empty bucket', () => {
        // 1 token/sec, so one second away.
        assert.deepEqual(nextTokenAt({ tokens: 0, updatedAt: t0 }, cfg, t0), at(1));
    });

    it('accounts for refill already accrued since the row was written', () => {
        // Written empty 4s ago at 1/sec: 4 tokens have accrued, so one is ready.
        assert.equal(nextTokenAt({ tokens: 0, updatedAt: t0 }, cfg, at(4)), null);
    });

    it('measures from now, not from when the row was written', () => {
        const half = { capacity: 10, refillPerDay: 43_200 }; // 0.5 tokens/sec
        assert.deepEqual(nextTokenAt({ tokens: 0, updatedAt: t0 }, half, t0), at(2));
    });
});

describe('refillTokens', () => {
    it('accrues tokens for time elapsed since the row was written', () => {
        // The stored value is only correct as of updatedAt. Showing it raw made
        // the admin page display "0.4 tokens" beside "available now".
        assert.equal(refillTokens({ tokens: 0, updatedAt: t0 }, cfg, at(4)), 4);
    });

    it('returns the stored value when no time has passed', () => {
        assert.equal(refillTokens({ tokens: 2.5, updatedAt: t0 }, cfg, t0), 2.5);
    });

    it('never exceeds capacity', () => {
        assert.equal(refillTokens({ tokens: 0, updatedAt: t0 }, cfg, at(99_999)), cfg.capacity);
    });

    it('agrees with nextTokenAt about whether a token is available', () => {
        const state = { tokens: 0, updatedAt: t0 };
        assert.ok(refillTokens(state, cfg, at(4)) >= 1);
        assert.equal(nextTokenAt(state, cfg, at(4)), null);

        assert.ok(refillTokens(state, cfg, t0) < 1);
        assert.notEqual(nextTokenAt(state, cfg, t0), null);
    });
});

/**
 * ISBNdb Premium's hard ceiling. Past it ISBNdb refuses the call, which is
 * worse than refusing it ourselves -- we pay the round trip and the user still
 * gets nothing. Confirmed against the account page: "Premium (15,000/daily)".
 */
const ISBNDB_DAILY_QUOTA = 15_000;

/**
 * Spends against a bucket as hard as it will allow for `hours`, and reports how
 * many requests it let through. Starts full, which is the worst case for a
 * ceiling: a bucket releases capacity + refillPerDay over a day, not merely
 * refillPerDay.
 */
function drainUnderUnlimitedDemand(config: BucketConfig, hours: number): number {
    let state: BucketState = { tokens: config.capacity, updatedAt: t0 };
    let allowed = 0;
    for (let second = 0; second < hours * 3600; second++) {
        const now = at(second);
        // Keep asking until refused, so the bucket is the only thing limiting.
        for (;;) {
            const decision = consumeToken(state, config, now);
            state = { tokens: decision.tokens, updatedAt: now };
            if (!decision.allowed) {
                break;
            }
            allowed++;
        }
    }
    return allowed;
}

describe('GLOBAL_BUCKET', () => {
    it('holds the whole site under the ISBNdb daily quota under unlimited demand', () => {
        // The property that matters. Per-client limits cannot guarantee this:
        // 353 clients each under their own limit can still exceed the quota
        // together, and the observed growth is entirely in clients that never
        // reach their per-client limit.
        const spent = drainUnderUnlimitedDemand(GLOBAL_BUCKET, 24);
        assert.ok(
            spent <= ISBNDB_DAILY_QUOTA,
            `global bucket released ${spent} in 24h, over the ${ISBNDB_DAILY_QUOTA} quota`
        );
    });

    it('leaves only a small margin below the quota', () => {
        // The margin exists for one reason: takeToken fails open, so a database
        // blip lets requests through without spending a token and real spend can
        // exceed the ceiling. It is NOT for demand volatility -- a bucket cannot
        // release more than its own ceiling, so volatility argues for nothing.
        //
        // Upper bound so a future edit cannot quietly re-inflate it: unused
        // margin is paid-for quota nobody gets to use.
        const ceiling = GLOBAL_BUCKET.capacity + GLOBAL_BUCKET.refillPerDay;
        const margin = ISBNDB_DAILY_QUOTA - ceiling;
        assert.ok(margin > 0, 'ceiling must sit below the quota, not on it');
        assert.ok(margin <= 200, `margin of ${margin} wastes quota; fail-open leakage needs far less`);
    });

    it('still allows most of a day of real traffic', () => {
        // Measured spend was ~10,000/day; the guard must not bite at that level
        // or it would throttle traffic the quota can afford.
        const spent = drainUnderUnlimitedDemand(GLOBAL_BUCKET, 24);
        assert.ok(spent > 12_000, `global ceiling ${spent} is too tight for observed demand`);
    });
});

describe('SEARCH_BUCKET', () => {
    it('lets one saturated client through far more than the old 700 a day', () => {
        // Five heavy clients were pinned at ~700/day while 4,969/day of quota
        // went unused. This is the headroom being handed back to them.
        const spent = drainUnderUnlimitedDemand(SEARCH_BUCKET, 24);
        assert.ok(spent > 1_500, `a saturated client got only ${spent}/day`);
    });

    it('still caps a single client well below the global ceiling', () => {
        // No one client may consume the whole site's quota.
        const perClient = SEARCH_BUCKET.capacity + SEARCH_BUCKET.refillPerDay;
        const global = GLOBAL_BUCKET.capacity + GLOBAL_BUCKET.refillPerDay;
        assert.ok(perClient < global / 3, 'one client should not be able to take a third of the day');
    });
});
