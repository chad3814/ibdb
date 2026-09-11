import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    ADMIN_COOKIE,
    adminSessionToken,
    isAdminAuthorized,
    isAdminRequestAuthorized,
    requiresAdminAuth,
} from '../src/lib/adminAuth';

const SECRET = 's3cret';

describe('isAdminAuthorized', () => {
    it('accepts the matching x-secret', () => {
        assert.equal(isAdminAuthorized(SECRET, SECRET), true);
    });

    it('rejects a mismatch', () => {
        assert.equal(isAdminAuthorized('nope', SECRET), false);
    });

    it('rejects a missing header', () => {
        assert.equal(isAdminAuthorized(null, SECRET), false);
    });

    it('fails closed when ADMIN_SECRET is unset', () => {
        assert.equal(isAdminAuthorized('anything', undefined), false);
        assert.equal(isAdminAuthorized('', ''), false);
        assert.equal(isAdminAuthorized(null, undefined), false);
    });
});

describe('requiresAdminAuth', () => {
    it('covers the admin pages and every admin api route', () => {
        for (const p of ['/admin', '/admin/', '/admin/duplicates', '/admin/throttled',
                         '/api/admin/duplicates', '/api/admin/duplicates/merge',
                         '/api/admin/throttled/abc', '/api/admin/hardcover-queue/reset']) {
            assert.equal(requiresAdminAuth(p), true, `${p} must be gated`);
        }
    });

    it('exempts the login and logout endpoints', () => {
        // Gating these would lock the UI out of its own sign-in.
        for (const p of ['/admin/login', '/api/admin/login', '/api/admin/logout']) {
            assert.equal(requiresAdminAuth(p), false, `${p} must stay reachable`);
        }
    });

    it('does not gate unrelated paths that merely start with the same letters', () => {
        // A prefix check would wrongly catch these.
        for (const p of ['/administrator', '/admins', '/api/adminx', '/books', '/api/search', '/']) {
            assert.equal(requiresAdminAuth(p), false, `${p} must not be gated`);
        }
    });
});

describe('isAdminRequestAuthorized', () => {
    it('accepts a correct x-secret header', async () => {
        assert.equal(await isAdminRequestAuthorized({
            headerSecret: SECRET, cookieValue: null, adminSecret: SECRET,
        }), true);
    });

    it('accepts a cookie holding the session token', async () => {
        assert.equal(await isAdminRequestAuthorized({
            headerSecret: null, cookieValue: await adminSessionToken(SECRET), adminSecret: SECRET,
        }), true);
    });

    it('rejects a cookie holding the raw secret', async () => {
        // The cookie stores a hash so a leaked cookie cannot be replayed as an
        // x-secret header against other endpoints.
        assert.equal(await isAdminRequestAuthorized({
            headerSecret: null, cookieValue: SECRET, adminSecret: SECRET,
        }), false);
    });

    it('rejects when neither is supplied', async () => {
        assert.equal(await isAdminRequestAuthorized({
            headerSecret: null, cookieValue: null, adminSecret: SECRET,
        }), false);
    });

    it('fails closed when ADMIN_SECRET is unset, even with a cookie', async () => {
        const token = await adminSessionToken(SECRET);
        assert.equal(await isAdminRequestAuthorized({
            headerSecret: SECRET, cookieValue: token, adminSecret: undefined,
        }), false);
    });
});

describe('adminSessionToken', () => {
    it('is a full sha256 hex digest, not the secret', async () => {
        const token = await adminSessionToken(SECRET);
        assert.match(token, /^[0-9a-f]{64}$/u);
        assert.notEqual(token, SECRET);
    });

    it('is deterministic and differs per secret', async () => {
        assert.equal(await adminSessionToken(SECRET), await adminSessionToken(SECRET));
        assert.notEqual(await adminSessionToken(SECRET), await adminSessionToken('other'));
    });

    it('names the cookie', () => {
        assert.equal(ADMIN_COOKIE, 'admin_session');
    });
});
