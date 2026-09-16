import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authorNameKey, flipLastnameFirst } from '../src/lib/authorNameKey';

describe('flipLastnameFirst', () => {
    it('flips a two-part comma name', () => {
        assert.equal(flipLastnameFirst('McCammon, Robert'), 'Robert McCammon');
    });

    it('leaves a name without a comma alone', () => {
        assert.equal(flipLastnameFirst('Robert McCammon'), 'Robert McCammon');
    });

    it('leaves a name with more than one comma alone', () => {
        // Three parts is not a Last, First name, and guessing would corrupt it.
        assert.equal(flipLastnameFirst('Smith, John, Jr'), 'Smith, John, Jr');
    });
});

describe('authorNameKey', () => {
    it('ignores case, punctuation and the comma flip', () => {
        assert.equal(authorNameKey('McCammon, Robert'), 'robert mccammon');
        assert.equal(authorNameKey('Robert McCammon'), 'robert mccammon');
        assert.equal(authorNameKey('ROBERT MCCAMMON'), 'robert mccammon');
    });

    it('collapses doubled whitespace but keeps word boundaries', () => {
        assert.equal(authorNameKey('Stephen  King'), 'stephen king');
        // Must NOT equal 'stephenking' -- removing spaces would group
        // 'Jo Ann Smith' with 'Joann Smith', which the detector never matched.
        assert.notEqual(authorNameKey('Jo Ann Smith'), authorNameKey('Joann Smith'));
    });

    it('treats credential casing as identical', () => {
        assert.equal(authorNameKey('John J. Ratey MD'), authorNameKey('John J. Ratey Md'));
    });

    it('returns empty for a name with no alphanumerics', () => {
        // These are the degenerate rows the queue reports as exact matches.
        assert.equal(authorNameKey('&'), '');
        assert.equal(authorNameKey(' -'), '');
        assert.equal(authorNameKey('""'), '');
    });
});
