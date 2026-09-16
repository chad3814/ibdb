import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickMergeTarget, type MergeCandidate } from '../src/lib/authorMergeTarget';

const at = (iso: string): Date => new Date(iso);

const candidate = (over: Partial<MergeCandidate> & { id: string }): MergeCandidate => ({
    name: 'Placeholder Name',
    bookCount: 0,
    hardcoverId: null,
    goodReadsId: null,
    openLibraryId: null,
    createdAt: at('2025-01-01T00:00:00Z'),
    ...over,
});

describe('pickMergeTarget', () => {
    it('keeps the only holder of external ids, even with fewer books', () => {
        // The books get reassigned either way; a discarded hardcoverId costs
        // API quota to re-earn.
        const out = pickMergeTarget([
            candidate({ id: 'few', name: 'Robert R. McCammon', bookCount: 1, hardcoverId: 93865 }),
            candidate({ id: 'many', name: 'Robert R. Mccammon', bookCount: 20 }),
        ]);
        assert.deepEqual(out, { kind: 'chosen', targetId: 'few', rule: 'external-ids' });
    });

    it('refuses to choose when two members hold external ids', () => {
        const out = pickMergeTarget([
            candidate({ id: 'a', hardcoverId: 1 }),
            candidate({ id: 'b', goodReadsId: 'gr' }),
        ]);
        assert.equal(out.kind, 'needs-review');
    });

    it('falls to book count when nobody holds ids', () => {
        const out = pickMergeTarget([
            candidate({ id: 'ratey-md', name: 'John J. Ratey MD', bookCount: 6 }),
            candidate({ id: 'ratey-md-lower', name: 'John J. Ratey Md', bookCount: 1 }),
        ]);
        assert.deepEqual(out, { kind: 'chosen', targetId: 'ratey-md', rule: 'book-count' });
    });

    it('falls to typography when book counts tie', () => {
        const out = pickMergeTarget([
            candidate({ id: 'lower', name: 'John J. Ratey Md', bookCount: 3 }),
            candidate({ id: 'canon', name: 'John J. Ratey MD', bookCount: 3 }),
        ]);
        assert.deepEqual(out, { kind: 'chosen', targetId: 'canon', rule: 'typography' });
    });

    it('falls to the oldest row when typography ties too', () => {
        const out = pickMergeTarget([
            candidate({ id: 'newer', name: 'Ann Smith', bookCount: 2, createdAt: at('2026-05-01T00:00:00Z') }),
            candidate({ id: 'older', name: 'Ann Smith', bookCount: 2, createdAt: at('2025-02-01T00:00:00Z') }),
        ]);
        assert.deepEqual(out, { kind: 'chosen', targetId: 'older', rule: 'age' });
    });

    it('gives the same answer whatever order the members arrive in', () => {
        const a = candidate({ id: 'aaa', name: 'Ann Smith', bookCount: 2 });
        const b = candidate({ id: 'bbb', name: 'Ann Smith', bookCount: 2 });
        assert.deepEqual(pickMergeTarget([a, b]), pickMergeTarget([b, a]));
    });

    it('needs review for a cluster with fewer than two members', () => {
        assert.equal(pickMergeTarget([candidate({ id: 'only' })]).kind, 'needs-review');
        assert.equal(pickMergeTarget([]).kind, 'needs-review');
    });

    it('handles a cluster of many variants', () => {
        const out = pickMergeTarget([
            candidate({ id: 'a', name: 'ROBERT MCCAMMON', bookCount: 2 }),
            candidate({ id: 'b', name: 'robert mccammon', bookCount: 2 }),
            candidate({ id: 'c', name: 'Robert McCammon', bookCount: 2 }),
            candidate({ id: 'd', name: 'Robert Mccammon', bookCount: 2 }),
        ]);
        assert.deepEqual(out, { kind: 'chosen', targetId: 'c', rule: 'typography' });
    });
});
