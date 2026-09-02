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
    let clock = 0;
    const base: WorkerDeps = {
        lookup: async () => match(),
        apply: async e => { applied.push(e); },
        dequeue: async id => { dequeued.push(id); },
        now: () => clock,
        sleep: async ms => { clock += ms; },
    };
    return { applied, dequeued, deps: { ...base, ...overrides }, advance: (ms: number) => { clock += ms; } };
}

const opts = { budgetMs: 50_000, perItemMs: 1_000 };

describe('runEnrichmentBatch', () => {
    it('writes ids for a book Hardcover matches', async () => {
        const d = deps();
        const result = await runEnrichmentBatch([book('bk-1')], d.deps, opts);

        assert.equal(result.enriched, 1);
        assert.equal(d.applied.length, 1);
        assert.equal(d.applied[0].bookHardcoverId, 99);
        assert.equal(d.applied[0].authors[0].hardcoverId, 7);
    });

    it('dequeues a book Hardcover has no match for without writing ids', async () => {
        // Otherwise ~500k permanent no-matches would recirculate forever.
        const d = deps({ lookup: async () => null });
        const result = await runEnrichmentBatch([book('bk-1')], d.deps, opts);

        assert.equal(result.noMatch, 1);
        assert.equal(d.applied.length, 0);
        assert.deepEqual(d.dequeued, ['bk-1']);
    });

    it('paces itself so it stays under the rate limit', async () => {
        const d = deps();
        await runEnrichmentBatch([book('a'), book('b'), book('c')], d.deps, opts);

        // Three books must take at least three pacing intervals of wall clock.
        assert.ok(d.deps.now() >= 3_000, `expected >=3000ms of pacing, got ${d.deps.now()}`);
    });

    it('stops before the budget runs out and leaves the rest claimed', async () => {
        const d = deps();
        const books = Array.from({ length: 100 }, (_, i) => book(`bk-${i}`));

        const result = await runEnrichmentBatch(books, d.deps, { budgetMs: 5_000, perItemMs: 1_000 });

        assert.ok(result.processed < 100, 'must not process the whole batch');
        assert.equal(result.stoppedEarly, true);
        assert.ok(d.deps.now() <= 5_000, 'must not overrun the budget');
    });

    it('stops immediately when Hardcover rate limits us', async () => {
        // Hammering a 429 burns the limit without making progress.
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
                return match();
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
