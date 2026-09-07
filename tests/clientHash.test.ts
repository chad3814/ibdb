import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashClientIp } from '../src/lib/clientHash';

describe('hashClientIp', () => {
    it('is a plain truncated sha256 hex digest, so a known IP can be looked up', async () => {
        // Reproduce with: printf '203.0.113.7' | shasum -a 256 | cut -c1-12
        assert.equal(await hashClientIp('203.0.113.7'), 'fec52565aa0c');
    });

    it('is deterministic', async () => {
        assert.equal(await hashClientIp('198.51.100.4'), await hashClientIp('198.51.100.4'));
    });

    it('distinguishes different addresses', async () => {
        assert.notEqual(await hashClientIp('198.51.100.4'), await hashClientIp('198.51.100.5'));
    });

    it('returns 12 hex characters', async () => {
        assert.match(await hashClientIp('2001:db8::1'), /^[0-9a-f]{12}$/u);
    });
});
