import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { donatedExternalIds, type ExternalIdCarrier } from '../src/lib/authorMergeIds';

const bare = (id: string): ExternalIdCarrier => ({
    id,
    hardcoverId: null,
    hardcoverSlug: null,
    goodReadsId: null,
    openLibraryId: null,
});

describe('donatedExternalIds', () => {
    it('donates nothing when no loser holds an id', () => {
        assert.deepEqual(donatedExternalIds(bare('t'), [bare('a'), bare('b')]), {});
    });

    it('fills a gap on the survivor', () => {
        const loser = { ...bare('a'), hardcoverId: 93865, hardcoverSlug: 'robert-r-mccammon' };
        assert.deepEqual(donatedExternalIds(bare('t'), [loser]), {
            hardcoverId: 93865,
            hardcoverSlug: 'robert-r-mccammon',
        });
    });

    it('never overwrites an id the survivor already holds', () => {
        const target = { ...bare('t'), hardcoverId: 1, hardcoverSlug: 'keep-me' };
        const loser = { ...bare('a'), hardcoverId: 2, hardcoverSlug: 'drop-me' };
        assert.deepEqual(donatedExternalIds(target, [loser]), {});
    });

    it('donates each id source independently', () => {
        const target = { ...bare('t'), hardcoverId: 1, hardcoverSlug: 'keep' };
        const loser = { ...bare('a'), goodReadsId: 'gr1', openLibraryId: 'ol1' };
        assert.deepEqual(donatedExternalIds(target, [loser]), {
            goodReadsId: 'gr1',
            openLibraryId: 'ol1',
        });
    });

    it('takes the lowest loser id when several could donate', () => {
        const hi = { ...bare('b'), goodReadsId: 'from-b' };
        const lo = { ...bare('a'), goodReadsId: 'from-a' };
        assert.deepEqual(donatedExternalIds(bare('t'), [hi, lo]), { goodReadsId: 'from-a' });
        // Same answer whatever order they arrive in.
        assert.deepEqual(donatedExternalIds(bare('t'), [lo, hi]), { goodReadsId: 'from-a' });
    });

    it('never donates a slug without its hardcoverId', () => {
        const loser = { ...bare('a'), hardcoverSlug: 'orphan-slug' };
        assert.deepEqual(donatedExternalIds(bare('t'), [loser]), {});
    });
});
