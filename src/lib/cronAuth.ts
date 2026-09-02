/**
 * Verifies the bearer token Vercel Cron sends in the Authorization header.
 *
 * Fails closed when CRON_SECRET is unset: a cron route is a normal public URL,
 * so an unconfigured deploy would otherwise let anyone drive the worker.
 */
export function isCronAuthorized(authHeader: string|null, secret: string|undefined): boolean {
    if (!secret || !authHeader) {
        return false;
    }
    return authHeader === `Bearer ${secret}`;
}
