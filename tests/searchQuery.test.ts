import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanQuery } from '../src/lib/searchQuery';

describe('cleanQuery', () => {
    it('lowercases and keeps alphanumerics', () => {
        assert.equal(cleanQuery('The Hobbit'), 'the hobbit');
        assert.equal(cleanQuery('Dune 2'), 'dune 2');
    });

    it('maps punctuation to a single space', () => {
        assert.equal(cleanQuery('The Hobbit!'), 'the hobbit');
        assert.equal(cleanQuery("Kurt Vonnegut, Jr."), 'kurt vonnegut jr');
    });

    it('collapses runs of whitespace so equivalent queries share a cache key', () => {
        assert.equal(cleanQuery('the   hobbit'), 'the hobbit');
        assert.equal(cleanQuery('The Hobbit!'), cleanQuery('The Hobbit'));
        assert.equal(cleanQuery('  Dune  '), 'dune');
    });

    it('normalizes an all-punctuation query to the empty string', () => {
        // These reached ISBNdb as ~74 percent-encoded spaces, one billed
        // request per distinct run length.
        assert.equal(cleanQuery('....'), '');
        assert.equal(cleanQuery('   '), '');
        assert.equal(cleanQuery('!@#$%^&*()'), '');
        assert.equal(cleanQuery('-'.repeat(74)), '');
    });

    it('keeps non-ASCII letters instead of shredding them into spaces', () => {
        // Observed in production: these reached ISBNdb as mangled ASCII, could
        // never match, and so were retried indefinitely.
        assert.equal(cleanQuery('Psychologie der Pers\u00f6nlichkeit'), 'psychologie der pers\u00f6nlichkeit');
        assert.equal(cleanQuery('Vi\u1ec7t \u0111\u1ea1i'), 'vi\u1ec7t \u0111\u1ea1i');
        assert.equal(cleanQuery('\u543e\u8f29\u306f\u732b\u3067\u3042\u308b'), '\u543e\u8f29\u306f\u732b\u3067\u3042\u308b');
        assert.equal(cleanQuery('\u00c9mile Zola, \u201cGerminal\u201d'), '\u00e9mile zola germinal');
    });

    it('composes decomposed input so NFD and NFC share one cache key', () => {
        // The Calibre plugin driving this traffic sends NFD. Under the old
        // regex that produced "perso nlichkeit" -- the ASCII "o" survived and
        // only the combining diaeresis became a space.
        const nfc = 'Pers\u00f6nlichkeit';
        const nfd = nfc.normalize('NFD');
        assert.notEqual(nfc, nfd, 'fixture must actually differ before normalization');
        assert.equal(cleanQuery(nfd), 'pers\u00f6nlichkeit');
        assert.equal(cleanQuery(nfd), cleanQuery(nfc));
    });

    it('keeps combining marks that have no precomposed form', () => {
        // NFC cannot compose every sequence: k + dot-below + dot-above composes
        // only as far as U+1E33, leaving the dot-above standing alone. Without
        // \p{M} in the keep-set that leftover mark would become a space.
        const input = 'k\u0323\u0307';
        const composed = input.normalize('NFC');
        assert.ok(composed.includes('\u0307'), 'fixture must leave a mark after NFC');
        assert.equal(cleanQuery(input), composed.toLowerCase());
    });

    it('is idempotent', () => {
        for (const raw of ['The Hobbit!', '  Dune  ', 'a  b   c', '', 'Pers\u00f6nlichkeit!', 'Pers\u00f6nlichkeit'.normalize('NFD')]) {
            assert.equal(cleanQuery(cleanQuery(raw)), cleanQuery(raw));
        }
    });
});
