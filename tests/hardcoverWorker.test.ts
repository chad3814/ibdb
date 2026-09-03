import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runEnrichmentBatch } from '../src/server/hardcoverWorker';
import type { QueueBook, WorkerDeps } from '../src/server/hardcoverWorker';
import type { HardcoverEdition } from '../src/server/hardcover';
import { HardcoverRateLimitedError } from '../src/server/hardcover';
import type { Enrichment } from '../src/server/hardcoverEnrich';

function book(id: string, name = 'J. R. R. Tolkien'): QueueBook {
    return {
        id,
        title: 'The Hobbit',
        authors: [{ id: `au-${id}`, name }],
        editions: [{ id: `ed-${id}`, isbn13: '9780261102217' }],
    };
}

function match(): HardcoverEdition {
    return {
        id: 555,
        isbn_13: '9780261102217',
        book: {
            id: 99,
            title: 'The Hobbit',
            slug: 'the-hobbit',
            contributions: [{ author: { id: 7, name: 'J. R. R. Tolkien', slug: 'tolkien' } }],
        },
    };
}

function deps(overrides: Partial<WorkerDeps> = {}) {
    const applied: Enrichment[] = [];
    const dequeued: string[] = [];
    const state = { clock: 0 };
    const base: WorkerDeps = {
        lookup: async () => ({ edition: match(), requests: 1 }),
        apply: async e => { applied.push(e); },
        dequeue: async id => { dequeued.push(id); },
        now: () => state.clock,
        sleep: async ms => { state.clock += ms; },
    };
    return { applied, dequeued, deps: { ...base, ...overrides }, state };
}

const opts = { budgetMs: 45_000, perRequestMs: 1_000, maxRequests: 34, maxRequestsPerBook: 1 };

describe('runEnrichmentBatch', () => {
    it('writes ids for a book Hardcover matches', async () => {
        const d = deps();
        const result = await runEnrichmentBatch([book('bk-1')], d.deps, opts);

        assert.equal(result.enriched, 1);
        assert.equal(d.applied[0].bookHardcoverId, 99);
        assert.equal(d.applied[0].authors[0].hardcoverId, 7);
    });

    it('dequeues a book Hardcover has no match for without writing ids', async () => {
        const d = deps({ lookup: async () => ({ edition: null, requests: 2 }) });
        const result = await runEnrichmentBatch([book('bk-1')], d.deps, opts);

        assert.equal(result.noMatch, 1);
        assert.equal(d.applied.length, 0);
        assert.deepEqual(d.dequeued, ['bk-1']);
    });

    it('counts every request a lookup makes, not every book', async () => {
        // A title+author fallback costs a second request. Budgeting per book
        // would let a batch of fallbacks quietly spend twice the daily quota.
        const d = deps({ lookup: async () => ({ edition: match(), requests: 2 }) });

        const result = await runEnrichmentBatch(
            Array.from({ length: 50 }, (_, i) => book(`bk-${i}`)),
            d.deps,
            { budgetMs: 10_000_000, perRequestMs: 1_000, maxRequests: 10, maxRequestsPerBook: 2 }
        );

        assert.equal(result.requests, 10, 'must stop at the request cap');
        assert.equal(result.processed, 5, '10 requests at 2 per book is 5 books');
        assert.equal(result.stoppedEarly, true);
    });

    it('never exceeds the request cap even when a book might need two', async () => {
        const d = deps({ lookup: async () => ({ edition: match(), requests: 1 }) });

        const result = await runEnrichmentBatch(
            Array.from({ length: 50 }, (_, i) => book(`bk-${i}`)),
            d.deps,
            { budgetMs: 10_000_000, perRequestMs: 1_000, maxRequests: 5, maxRequestsPerBook: 2 }
        );

        assert.ok(result.requests <= 5, `never exceed the cap, got ${result.requests}`);
    });

    it('spends the cap exactly when a book costs a single request', async () => {
        // With no fallback a book is worth exactly one request, so reserving
        // two per book would waste half the daily quota.
        const d = deps({ lookup: async () => ({ edition: match(), requests: 1 }) });

        const result = await runEnrichmentBatch(
            Array.from({ length: 50 }, (_, i) => book(`bk-${i}`)),
            d.deps,
            { budgetMs: 10_000_000, perRequestMs: 1_000, maxRequests: 5, maxRequestsPerBook: 1 }
        );

        assert.equal(result.requests, 5);
        assert.equal(result.processed, 5);
    });

    it('stops before the time budget runs out and leaves the rest claimed', async () => {
        const d = deps();
        d.deps.lookup = async () => {
            await d.deps.sleep(1_000);
            return { edition: match(), requests: 1 };
        };
        const books = Array.from({ length: 100 }, (_, i) => book(`bk-${i}`));

        const result = await runEnrichmentBatch(books, d.deps, {
            budgetMs: 5_000, perRequestMs: 1_000, maxRequests: 1_000, maxRequestsPerBook: 1,
        });

        assert.ok(result.processed < 100, 'must not process the whole batch');
        assert.equal(result.stoppedEarly, true);
        assert.ok(d.state.clock <= 5_000, `must not overrun the budget, clock ${d.state.clock}`);
    });

    it('stops immediately when Hardcover rate limits us', async () => {
        let calls = 0;
        const d = deps({
            lookup: async () => {
                calls++;
                throw new HardcoverRateLimitedError(30);
            },
        });

        const result = await runEnrichmentBatch([book('a'), book('b'), book('c')], d.deps, opts);

        assert.equal(calls, 1, 'must not keep querying after a 429');
        assert.equal(result.rateLimited, true);
        assert.equal(result.stoppedEarly, true);
    });

    it('keeps going when one book fails', async () => {
        let calls = 0;
        const d = deps({
            lookup: async () => {
                calls++;
                if (calls === 1) {
                    throw new Error('transient');
                }
                return { edition: match(), requests: 1 };
            },
        });

        const result = await runEnrichmentBatch([book('a'), book('b')], d.deps, opts);

        assert.equal(result.failed, 1);
        assert.equal(result.enriched, 1);
    });

    it('dequeues a book with no edition rather than retrying it forever', async () => {
        const d = deps();
        const noEdition = { ...book('bk-1'), editions: [] };

        const result = await runEnrichmentBatch([noEdition], d.deps, opts);

        assert.equal(result.noMatch, 1);
        assert.deepEqual(d.dequeued, ['bk-1']);
    });
});
