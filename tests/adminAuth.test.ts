import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAdminAuthorized } from '../src/lib/adminAuth';

describe('isAdminAuthorized', () => {
    it('accepts the matching x-secret', () => {
        assert.equal(isAdminAuthorized('s3cret', 's3cret'), true);
    });

    it('rejects a mismatch', () => {
        assert.equal(isAdminAuthorized('nope', 's3cret'), false);
    });

    it('rejects a missing header', () => {
        assert.equal(isAdminAuthorized(null, 's3cret'), false);
    });

    it('fails closed when ADMIN_SECRET is unset', () => {
        // An open endpoint that deletes rate limits would let any client remove
        // its own throttle, which defeats the limiter entirely.
        assert.equal(isAdminAuthorized('anything', undefined), false);
        assert.equal(isAdminAuthorized('', ''), false);
        assert.equal(isAdminAuthorized(null, undefined), false);
    });
});
