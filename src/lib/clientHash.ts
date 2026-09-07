/**
 * Hashes a client IP for logging.
 *
 * A plain, unsalted SHA-256 truncated to 12 hex characters, so a specific
 * address seen elsewhere (the Vercel Firewall tab, say) can be matched against
 * these logs by hashing it the same way:
 *
 *     printf '203.0.113.7' | shasum -a 256 | cut -c1-12
 */
export async function hashClientIp(ip: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    return Array.from(new Uint8Array(digest, 0, 6))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}
