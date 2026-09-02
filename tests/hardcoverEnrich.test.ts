import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEnrichment } from '../src/server/hardcoverEnrich';
import type { HardcoverEdition } from '../src/server/hardcover';

const item = {
    editionId: 'ed-1',
    bookId: 'bk-1',
    authors: [
        { id: 'au-tolkien', name: 'J. R. R. Tolkien' },
        { id: 'au-other', name: 'Someone Else' },
    ],
};

const hardcoverEdition = (contributions: { id: number; name: string; slug: string }[]): HardcoverEdition => ({
    id: 555,
    isbn_13: '9780261102217',
    book: {
        id: 99,
        title: 'The Hobbit',
        slug: 'the-hobbit',
        contributions: contributions.map(author => ({ author })),
    },
});

describe('buildEnrichment', () => {
    it('maps the edition and book ids', () => {
        const result = buildEnrichment(item, hardcoverEdition([]));
        assert.equal(result.editionId, 'ed-1');
        assert.equal(result.editionHardcoverId, 555);
        assert.equal(result.bookId, 'bk-1');
        assert.equal(result.bookHardcoverId, 99);
        assert.equal(result.bookHardcoverSlug, 'the-hobbit');
    });

    it('matches our authors to Hardcover contributions by name', () => {
        const result = buildEnrichment(item, hardcoverEdition([
            { id: 7, name: 'J. R. R. Tolkien', slug: 'j-r-r-tolkien' },
        ]));
        assert.deepEqual(result.authors, [
            { id: 'au-tolkien', hardcoverId: 7, hardcoverSlug: 'j-r-r-tolkien' },
        ]);
    });

    it('omits our authors that Hardcover does not list', () => {
        // "Someone Else" must not be written with another author's ids.
        const result = buildEnrichment(item, hardcoverEdition([
            { id: 7, name: 'J. R. R. Tolkien', slug: 'j-r-r-tolkien' },
        ]));
        assert.equal(result.authors.some(a => a.id === 'au-other'), false);
    });

    it('returns no authors when Hardcover lists no contributions', () => {
        assert.deepEqual(buildEnrichment(item, hardcoverEdition([])).authors, []);
    });

    it('ignores Hardcover contributors we do not have', () => {
        const result = buildEnrichment(item, hardcoverEdition([
            { id: 7, name: 'J. R. R. Tolkien', slug: 'j-r-r-tolkien' },
            { id: 8, name: 'Christopher Tolkien', slug: 'christopher-tolkien' },
        ]));
        assert.equal(result.authors.length, 1);
        assert.equal(result.authors[0].id, 'au-tolkien');
    });
});
