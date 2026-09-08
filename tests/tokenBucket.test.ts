import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SEARCH_BUCKET, consumeToken, nextTokenAt } from '../src/lib/tokenBucket';

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

    it('is configured for 400 burst and 700 a day', () => {
        // Measured against real traffic: holds ~14,278/day against a 15,000 cap.
        assert.equal(SEARCH_BUCKET.capacity, 400);
        assert.equal(SEARCH_BUCKET.refillPerDay, 700);
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
