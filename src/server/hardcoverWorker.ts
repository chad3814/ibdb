import { hasTimeRemaining } from '@/lib/timeBudget';
import { HardcoverRateLimitedError, type HardcoverEdition } from './hardcover';
import { buildEnrichment, type Enrichment } from './hardcoverEnrich';

export type QueueBook = {
    id: string;
    title: string;
    authors: { id: string; name: string }[];
    editions: { id: string; isbn13: string }[];
};

/**
 * The effects the batch loop needs, injected so the loop can be exercised
 * without a database, a network, or real elapsed time.
 */
export type WorkerDeps = {
    lookup(book: QueueBook): Promise<HardcoverEdition|null>;
    apply(enrichment: Enrichment): Promise<void>;
    dequeue(bookId: string): Promise<void>;
    now(): number;
    sleep(ms: number): Promise<void>;
};

export type BatchOptions = {
    budgetMs: number;
    perItemMs: number;
};

export type BatchResult = {
    processed: number;
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
    { budgetMs, perItemMs }: BatchOptions
): Promise<BatchResult> {
    const startedAt = deps.now();
    const result: BatchResult = {
        processed: 0,
        enriched: 0,
        noMatch: 0,
        failed: 0,
        stoppedEarly: false,
        rateLimited: false,
    };

    for (const book of books) {
        const elapsedMs = deps.now() - startedAt;
        if (!hasTimeRemaining({ elapsedMs, budgetMs, nextItemMs: perItemMs })) {
            result.stoppedEarly = true;
            break;
        }

        // Pace first, so the very first request of a run does not stack on top
        // of the tail of the previous run's requests.
        await deps.sleep(perItemMs);

        const edition = book.editions[0];
        if (!edition) {
            // Nothing to look up by, and that will never change.
            await deps.dequeue(book.id);
            result.noMatch++;
            result.processed++;
            continue;
        }

        try {
            const found = await deps.lookup(book);

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
