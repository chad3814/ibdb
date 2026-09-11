export const ADMIN_COOKIE = 'admin_session';

/** How long a sign-in lasts before the cookie is rejected. */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

/** Reachable without a session, or signing in would gate itself out. */
const AUTH_EXEMPT = new Set([
    '/admin/login',
    '/api/admin/login',
    '/api/admin/logout',
]);

/**
 * Checks the `x-secret` header against ADMIN_SECRET, matching the convention
 * already used by /api/admin/hardcover-queue/reset.
 *
 * Fails closed when ADMIN_SECRET is unset. These endpoints delete rate limit
 * rows and merge authors, so an unguarded one is worse than an unreachable one.
 */
export function isAdminAuthorized(headerSecret: string|null, adminSecret: string|undefined): boolean {
    if (!adminSecret || !headerSecret) {
        return false;
    }
    return headerSecret === adminSecret;
}

/**
 * Whether a path sits behind the admin gate.
 *
 * Deliberately not a `startsWith('/admin')` test: that would also catch
 * `/administrator` and any future `/admins` route.
 */
export function requiresAdminAuth(pathname: string): boolean {
    if (AUTH_EXEMPT.has(pathname)) {
        return false;
    }
    return pathname === '/admin'
        || pathname.startsWith('/admin/')
        || pathname === '/api/admin'
        || pathname.startsWith('/api/admin/');
}

/**
 * The value stored in the session cookie: a SHA-256 of the secret rather than
 * the secret itself, so a leaked cookie cannot be replayed as an `x-secret`
 * header against endpoints that accept one.
 */
export async function adminSessionToken(adminSecret: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(adminSecret));
    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

type AdminRequest = {
    headerSecret: string|null;
    cookieValue: string|null;
    adminSecret: string|undefined;
};

/**
 * Authorizes an admin request by either route: the `x-secret` header, which
 * keeps curl and scripts working, or the session cookie set by signing in.
 */
export async function isAdminRequestAuthorized({
    headerSecret,
    cookieValue,
    adminSecret,
}: AdminRequest): Promise<boolean> {
    if (!adminSecret) {
        return false;
    }
    if (isAdminAuthorized(headerSecret, adminSecret)) {
        return true;
    }
    if (!cookieValue) {
        return false;
    }
    return cookieValue === await adminSessionToken(adminSecret);
}
