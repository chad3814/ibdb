import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRateLimit, selectEdition } from '../src/server/hardcover';
import type { HardcoverQueryResponse } from '../src/server/hardcover';

const edition = (id: number) => ({
    id,
    isbn_13: '9780261102217',
    book: { id: 10, title: 'The Hobbit', slug: 'the-hobbit', contributions: [] },
});

describe('selectEdition', () => {
    it('takes the first edition', () => {
        const res = { data: { editions: [edition(1), edition(2)] } } as HardcoverQueryResponse;
        assert.equal(selectEdition(res)?.id, 1);
    });

    it('returns null when Hardcover knows no edition', () => {
        const res = { data: { editions: [] } } as HardcoverQueryResponse;
        assert.equal(selectEdition(res), null);
    });

    it('returns null rather than throwing on a malformed body', () => {
        assert.equal(selectEdition({} as HardcoverQueryResponse), null);
        assert.equal(selectEdition({ data: {} } as HardcoverQueryResponse), null);
    });

    it('returns null when the response carries GraphQL errors', () => {
        const res = {
            data: { editions: [edition(1)] },
            errors: [{ message: 'boom' }],
        } as HardcoverQueryResponse;
        assert.equal(selectEdition(res), null);
    });
});

describe('parseRateLimit', () => {
    it('reads the IETF RateLimit header Hardcover documents', () => {
        const h = new Headers({ 'RateLimit': '"Free";r=17;t=42' });
        assert.deepEqual(parseRateLimit(h), { remaining: 17, resetSeconds: 42 });
    });

    it('reads the x-ratelimit-* form', () => {
        const h = new Headers({ 'x-ratelimit-remaining': '5', 'x-ratelimit-reset': '30' });
        assert.deepEqual(parseRateLimit(h), { remaining: 5, resetSeconds: 30 });
    });

    it('returns null when no rate limit headers are present', () => {
        // Callers must fall back to fixed pacing rather than assume headroom.
        assert.equal(parseRateLimit(new Headers()), null);
    });

    it('returns null on unparseable values instead of NaN', () => {
        const h = new Headers({ 'x-ratelimit-remaining': 'lots', 'x-ratelimit-reset': 'soon' });
        assert.equal(parseRateLimit(h), null);
    });
});
