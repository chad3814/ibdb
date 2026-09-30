import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recheckMisses, type RecheckDeps, type RecheckOutcome } from '../src/lib/isbnMissRecheck';

/** Deps that answer from a table and record every call and sleep. */
function fakeDeps(answers: Record<string, RecheckOutcome | Error>): RecheckDeps & { calls: string[]; sleeps: number[] } {
    const calls: string[] = [];
    const sleeps: number[] = [];
    return {
        calls,
        sleeps,
        lookup: async isbn13 => {
            calls.push(isbn13);
            const answer = answers[isbn13];
            if (answer instanceof Error) {
                throw answer;
            }
            return answer;
        },
        sleep: async ms => {
            sleeps.push(ms);
        },
    };
}

describe('recheckMisses', () => {
    it('sorts each ISBN by what ISBNdb said', async () => {
        const deps = fakeDeps({ a: 'found', b: 'not-found', c: 'found' });
        const result = await recheckMisses(['a', 'b', 'c'], deps, 1_000);
        assert.deepEqual(result, {
            found: ['a', 'c'],
            notFound: ['b'],
            failed: [],
            skipped: [],
            throttled: false,
        });
    });

    it('paces requests apart without sleeping before the first', async () => {
        const deps = fakeDeps({ a: 'found', b: 'found', c: 'found' });
        await recheckMisses(['a', 'b', 'c'], deps, 1_000);
        assert.deepEqual(deps.sleeps, [1_000, 1_000]);
    });

    it('stops at the first refused token and reports the rest as skipped', async () => {
        // The budget is shared with visitors; carrying on would only collect
        // more refusals.
        const deps = fakeDeps({ a: 'found', b: 'throttled', c: 'found' });
        const result = await recheckMisses(['a', 'b', 'c'], deps, 1_000);
        assert.deepEqual(deps.calls, ['a', 'b']);
        assert.equal(result.throttled, true);
        assert.deepEqual(result.found, ['a']);
        assert.deepEqual(result.skipped, ['b', 'c']);
    });

    it('fails only the ISBN whose lookup threw', async () => {
        const deps = fakeDeps({ a: new Error('ISBNDb Error'), b: 'found' });
        const result = await recheckMisses(['a', 'b'], deps, 1_000);
        assert.deepEqual(result.failed, ['a']);
        assert.deepEqual(result.found, ['b']);
        assert.equal(result.throttled, false);
    });

    it('does nothing for no misses', async () => {
        const deps = fakeDeps({});
        const result = await recheckMisses([], deps, 1_000);
        assert.deepEqual(deps.calls, []);
        assert.deepEqual(deps.sleeps, []);
        assert.deepEqual(result.found, []);
    });
});
