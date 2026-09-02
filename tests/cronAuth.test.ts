import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isCronAuthorized } from '../src/lib/cronAuth';

describe('isCronAuthorized', () => {
    it('accepts the bearer token Vercel Cron sends', () => {
        assert.equal(isCronAuthorized('Bearer s3cret', 's3cret'), true);
    });

    it('rejects a mismatched token', () => {
        assert.equal(isCronAuthorized('Bearer wrong', 's3cret'), false);
    });

    it('rejects a missing header', () => {
        assert.equal(isCronAuthorized(null, 's3cret'), false);
    });

    it('fails closed when CRON_SECRET is unset', () => {
        // Otherwise an unconfigured deploy would expose the worker to anyone.
        assert.equal(isCronAuthorized('Bearer anything', undefined), false);
        assert.equal(isCronAuthorized('Bearer ', ''), false);
        assert.equal(isCronAuthorized(null, undefined), false);
    });

    it('requires the Bearer scheme, not a bare secret', () => {
        assert.equal(isCronAuthorized('s3cret', 's3cret'), false);
    });
});
