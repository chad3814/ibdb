import { hasTimeRemaining } from '@/lib/timeBudget';
import { HardcoverRateLimitedError, type HardcoverEdition } from './hardcover';
import { buildEnrichment, type Enrichment } from './hardcoverEnrich';

export type QueueBook = {
    id: string;
    title: string;
    authors: { id: string; name: string }[];
    editions: { id: string; isbn13: string }[];
};

export type LookupResult = {
    edition: HardcoverEdition|null;
    /** How many Hardcover requests this lookup actually spent. */
    requests: number;
};

/**
 * The effects the batch loop needs, injected so the loop can be exercised
 * without a database, a network, or real elapsed time.
 *
 * `lookup` owns its own pacing, because only it knows how many requests it
 * makes: an ISBN hit costs one, a title+author fallback costs two.
 */
export type WorkerDeps = {
    lookup(book: QueueBook): Promise<LookupResult>;
    apply(enrichment: Enrichment): Promise<void>;
    dequeue(bookId: string): Promise<void>;
    now(): number;
    sleep(ms: number): Promise<void>;
};

export type BatchOptions = {
    budgetMs: number;
    perRequestMs: number;
    /** Hard ceiling on Hardcover requests, which is what the daily quota counts. */
    maxRequests: number;
    /**
     * Worst case requests a single lookup can spend. The loop reserves this
     * much headroom before starting a book, so the cap is never overshot.
     * Reserving more than a lookup actually costs wastes quota.
     */
    maxRequestsPerBook: number;
};

export type BatchResult = {
    processed: number;
    /** Hardcover requests spent, which may exceed `processed` when lookups fall back. */
    requests: number;
    enriched: number;
    noMatch: number;
    failed: number;
    stoppedEarly: boolean;
    rateLimited: boolean;
};

/**
 * Enriches one claimed batch, pacing itself to stay under Hardcover's limit and
 * stopping while there is still time to return a response.
 *
 * Books it finishes with are dequeued; whatever it does not reach stays claimed
 * for the caller to release.
 */
export async function runEnrichmentBatch(
    books: QueueBook[],
    deps: WorkerDeps,
    { budgetMs, perRequestMs, maxRequests, maxRequestsPerBook }: BatchOptions
): Promise<BatchResult> {
    const startedAt = deps.now();
    const result: BatchResult = {
        processed: 0,
        requests: 0,
        enriched: 0,
        noMatch: 0,
        failed: 0,
        stoppedEarly: false,
        rateLimited: false,
    };

    for (const book of books) {
        // Never start a book without room for its worst case, or the cap
        // would be overshot mid-book.
        if (result.requests + maxRequestsPerBook > maxRequests) {
            result.stoppedEarly = true;
            break;
        }

        const elapsedMs = deps.now() - startedAt;
        if (!hasTimeRemaining({
            elapsedMs,
            budgetMs,
            nextItemMs: perRequestMs * maxRequestsPerBook,
        })) {
            result.stoppedEarly = true;
            break;
        }

        const edition = book.editions[0];
        if (!edition) {
            // Nothing to look up by, and that will never change.
            await deps.dequeue(book.id);
            result.noMatch++;
            result.processed++;
            continue;
        }

        try {
            const { edition: found, requests } = await deps.lookup(book);
            result.requests += requests;

            if (!found) {
                await deps.dequeue(book.id);
                result.noMatch++;
            } else {
                await deps.apply(buildEnrichment(
                    { editionId: edition.id, bookId: book.id, authors: book.authors },
                    found
                ));
                result.enriched++;
            }
            result.processed++;
        } catch (err) {
            if (err instanceof HardcoverRateLimitedError) {
                // Continuing would spend the limit without making progress.
                result.rateLimited = true;
                result.stoppedEarly = true;
                break;
            }
            console.error(`hardcover enrichment failed for book ${book.id}:`, err);
            result.failed++;
            result.processed++;
        }
    }

    if (result.processed < books.length && !result.stoppedEarly) {
        result.stoppedEarly = true;
    }

    return result;
}
