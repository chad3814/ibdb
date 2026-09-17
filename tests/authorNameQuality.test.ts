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

    it('penalizes a single shouty token even when the rest of the name is normal case', () => {
        better('Stephen King', 'Stephen KING');
        better('Debbie Macomber', 'Debbie MACOMBER');
        // The suffix guard must not be eaten by the new per-token rule.
        better('Jane Doe PhD', 'Jane Doe Phd');
    });

    it('only treats a credential/suffix as such after the first token', () => {
        // "Md" leading a name is the given name Muhammad, not the credential.
        better('Md Anwar Hossain', 'MD Anwar Hossain');
        better('John J. Ratey MD', 'John J. Ratey Md');
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

    it('prefers an unspaced initial run over its all-caps-looking mangling', () => {
        // "C.S." loses its periods when alphaTokens strips punctuation,
        // becoming "CS" -- indistinguishable from a shouted token unless the
        // raw source is consulted.
        better('C.S. Lewis', 'Cs Lewis');
        better('J.R.R. Tolkien', 'Jrr Tolkien');
    });

    it('prefers uppercase initials in an unspaced run over lowercase ones', () => {
        better('C.S. Lewis', 'C.s. Lewis');
        better('P.D. James', 'P.d. James');
        better('H.P. Lovecraft', 'H.p. Lovecraft');
    });

    it('prefers canonical roman numeral and credential suffixes added to CANONICAL_SUFFIXES', () => {
        better('Henry Ford VIII', 'Henry Ford Viii');
        better('Jane Doe MFA', 'Jane Doe Mfa');
    });

    it('prefers a lowercase nobiliary/toponymic particle over a capitalized one', () => {
        // A production dry run of the duplicate-author merge found 45
        // clusters where capitalizing the particle would have won, against
        // only 2 the other way -- this is the fix for that lopsided result.
        better('Chris den Besten', 'Chris Den Besten');
        better('Constantin von Tischendorf', 'Constantin Von Tischendorf');
        better('Claiton Marcio da Silva', 'Claiton Marcio Da Silva');
        better('F. K. M. van Nispen', 'F. K. M. Van Nispen');
        better('Fernando del Paso Morante', 'Fernando Del Paso Morante');
        better('Jair Teixeira dos Reis', 'Jair Teixeira Dos Reis');
        better('Institut Charles de Gaulle', 'Institut Charles De Gaulle');
    });

    it('prefers lowercasing every particle in a multi-particle name, in any partial mix', () => {
        better('Etienne de la Boetie', 'Etienne De La Boetie');
        better('Etienne de la Boetie', 'Etienne de La Boetie');
        better('Etienne de la Boetie', 'Etienne De LA Boetie');
    });

    it('does not treat a leading or trailing particle-like token as a particle', () => {
        // "Van" leads here, as in a surname-first listing -- not an
        // internal particle, so it must score exactly as it did before the
        // particle rule existed.
        assert.equal(scoreNameQuality('Van Gogh'), 2);
    });

    it('does not let the particle rule rescue an all-lowercase name', () => {
        // "Le" is capitalized correctly here as part of the surname "Le
        // Roy" -- the particle rule dings it, but the all-lowercase
        // variant's existing penalty is still larger, so the correctly
        // typed name still wins.
        better('Eugene Le Roy', 'eugene le roy');
    });
});
