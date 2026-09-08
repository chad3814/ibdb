/**
 * Checks the `x-secret` header against ADMIN_SECRET, matching the convention
 * already used by /api/admin/hardcover-queue/reset.
 *
 * Fails closed when ADMIN_SECRET is unset. These endpoints can delete a
 * client's rate limit row, and an unguarded one would let any client clear its
 * own throttle.
 */
export function isAdminAuthorized(headerSecret: string|null, adminSecret: string|undefined): boolean {
    if (!adminSecret || !headerSecret) {
        return false;
    }
    return headerSecret === adminSecret;
}
