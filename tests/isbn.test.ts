import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPossibleIsbn13, normalizeIsbn13 } from '../src/lib/isbn';

describe('normalizeIsbn13', () => {
    it('strips hyphens and spaces', () => {
        assert.equal(normalizeIsbn13('978-3036950402'), '9783036950402');
        assert.equal(normalizeIsbn13('978 3036950402'), '9783036950402');
    });
});

describe('isPossibleIsbn13', () => {
    it('accepts a plain 13 digit ISBN', () => {
        assert.equal(isPossibleIsbn13('9780261102217'), true);
    });

    it('accepts the hyphenated form ISBNdb returns', () => {
        // 294 editions are stored in this form; rejecting them would lose books.
        assert.equal(isPossibleIsbn13('978-3036950402'), true);
    });

    it('accepts a 13 digit ISBN whose check digit is wrong', () => {
        assert.equal(isPossibleIsbn13('9780261102218'), true);
    });

    it('rejects input that could never be an ISBN', () => {
        for (const bad of ['', 'foo', '12345', '97802611022170', 'abcdefghijklm', '../../etc/passwd']) {
            assert.equal(isPossibleIsbn13(bad), false, `expected ${bad} to be rejected`);
        }
    });
});
