import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreNameQuality } from '../src/lib/authorNameQuality';

/** The comparison the score exists to make. */
function better(a: string, b: string): void {
    assert.ok(
        scoreNameQuality(a) > scoreNameQuality(b),
        `expected "${a}" (${scoreNameQuality(a)}) to beat "${b}" (${scoreNameQuality(b)})`
    );
}

describe('scoreNameQuality', () => {
    it('prefers a canonical credential over a title-cased one', () => {
        // The case Chad called by hand: MD is Medical Doctor, not a word.
        better('John J. Ratey MD', 'John J. Ratey Md');
    });

    it('prefers canonical forms of the other credentials', () => {
        better('Jane Doe PhD', 'Jane Doe Phd');
        better('Sammy Davis Jr', 'Sammy Davis JR');
        better('Henry Ford III', 'Henry Ford Iii');
    });

    it('penalizes ALL CAPS and all lowercase', () => {
        better('Robert McCammon', 'ROBERT MCCAMMON');
        better('Robert McCammon', 'robert mccammon');
    });

    it('prefers a capital after a Celtic prefix', () => {
        better('Robert McCammon', 'Robert Mccammon');
        better('Anne O\'Brien', 'Anne O\'brien');
        better('Shirley MacLaine', 'Shirley Maclaine');
    });

    it('prefers initials with periods', () => {
        better('J. R. R. Tolkien', 'J R R Tolkien');
    });

    it('penalizes doubled whitespace', () => {
        better('Stephen King', 'Stephen  King');
    });

    it('penalizes a trailing separator but not a trailing period', () => {
        better('Donna Leon', 'Donna Leon,');
        better('Donna Leon', 'Donna Leon &');
        assert.equal(scoreNameQuality('Tolkien J.R.R.'), scoreNameQuality('Tolkien J.R.R'));
    });

    it('is deterministic and pure', () => {
        assert.equal(scoreNameQuality('John J. Ratey MD'), scoreNameQuality('John J. Ratey MD'));
    });

    it('handles a name with no letters without throwing', () => {
        assert.equal(typeof scoreNameQuality('&'), 'number');
        assert.equal(typeof scoreNameQuality(''), 'number');
    });
});
