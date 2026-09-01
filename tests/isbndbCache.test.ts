import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldCacheSearchResult } from '../src/server/isbndb';
import { Binding } from '../prisma/client';
import { parseBinding } from '../src/server/isbndb';

describe('shouldCacheSearchResult', () => {
    it('caches a result we managed to save', () => {
        assert.equal(shouldCacheSearchResult(20, 20), true);
        assert.equal(shouldCacheSearchResult(20, 1), true);
    });

    it('caches a genuinely empty result from ISBNdb', () => {
        // This is the case that was uncacheable before: the upsert sat inside
        // the per-book loop, so a no-hit query left no row and was re-billed
        // on every repeat.
        assert.equal(shouldCacheSearchResult(0, 0), true);
    });

    it('does not cache an empty result caused by every save failing', () => {
        // Caching here would hide a real result set for the whole negative TTL.
        assert.equal(shouldCacheSearchResult(20, 0), false);
        assert.equal(shouldCacheSearchResult(1, 0), false);
    });
});

describe('parseBinding', () => {
    it('maps the ISBNdb binding strings', () => {
        assert.equal(parseBinding('Paperback'), Binding.Paperback);
        assert.equal(parseBinding('Mass Market Paperback'), Binding.Paperback);
        assert.equal(parseBinding('hardcover'), Binding.Hardcover);
        assert.equal(parseBinding('Kindle Edition'), Binding.Ebook);
        assert.equal(parseBinding('epub'), Binding.Ebook);
        assert.equal(parseBinding('Audio CD'), Binding.Audiobook);
        assert.equal(parseBinding('mp3 cd'), Binding.Audiobook);
    });

    it('falls back to Unknown', () => {
        assert.equal(parseBinding(undefined), Binding.Unknown);
        assert.equal(parseBinding(''), Binding.Unknown);
        assert.equal(parseBinding('Leather Bound'), Binding.Unknown);
    });
});
