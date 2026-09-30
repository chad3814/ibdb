/** What one re-check of a recorded miss came back with. */
export type RecheckOutcome = 'found' | 'not-found' | 'throttled';

export type RecheckDeps = {
    /** Looks the ISBN up past the negative cache. May throw. */
    lookup: (isbn13: string) => Promise<RecheckOutcome>;
    sleep: (ms: number) => Promise<void>;
};

export type RecheckResult = {
    found: string[];
    notFound: string[];
    failed: string[];
    /** Never attempted, because the budget refused one before them. */
    skipped: string[];
    throttled: boolean;
};

/**
 * Re-asks ISBNdb about ISBNs it was recorded as not having.
 *
 * One at a time, `perRequestMs` apart, so a batch cannot burst past ISBNdb's
 * per-second limit. A refused token stops the run instead of skipping to the
 * next ISBN: the budget is shared with real visitors, and every later request
 * would be refused the same way. A thrown lookup only fails its own ISBN.
 */
export async function recheckMisses(
    isbns: string[],
    deps: RecheckDeps,
    perRequestMs: number
): Promise<RecheckResult> {
    const result: RecheckResult = { found: [], notFound: [], failed: [], skipped: [], throttled: false };

    for (const [i, isbn13] of isbns.entries()) {
        if (i > 0) {
            await deps.sleep(perRequestMs);
        }

        let outcome: RecheckOutcome;
        try {
            outcome = await deps.lookup(isbn13);
        } catch (err) {
            console.error(`recheck failed for ${isbn13}:`, err);
            result.failed.push(isbn13);
            continue;
        }

        if (outcome === 'throttled') {
            result.throttled = true;
            result.skipped = isbns.slice(i);
            break;
        }
        (outcome === 'found' ? result.found : result.notFound).push(isbn13);
    }

    return result;
}
