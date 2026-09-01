import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NEGATIVE_CACHE_TTL_MS, isFresh } from '../src/lib/cacheTtl';

describe('isFresh', () => {
    const now = new Date('2026-09-01T12:00:00Z');

    it('treats a just-written entry as fresh', () => {
        assert.equal(isFresh(now, NEGATIVE_CACHE_TTL_MS, now), true);
    });

    it('keeps an entry fresh up to the TTL', () => {
        const almost = new Date(now.getTime() - (NEGATIVE_CACHE_TTL_MS - 1));
        assert.equal(isFresh(almost, NEGATIVE_CACHE_TTL_MS, now), true);
    });

    it('expires an entry at exactly the TTL', () => {
        const exactly = new Date(now.getTime() - NEGATIVE_CACHE_TTL_MS);
        assert.equal(isFresh(exactly, NEGATIVE_CACHE_TTL_MS, now), false);
    });

    it('expires an entry past the TTL', () => {
        const old = new Date(now.getTime() - NEGATIVE_CACHE_TTL_MS - 1000);
        assert.equal(isFresh(old, NEGATIVE_CACHE_TTL_MS, now), false);
    });

    it('uses a 24 hour negative TTL', () => {
        assert.equal(NEGATIVE_CACHE_TTL_MS, 86_400_000);
    });
});
