import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addBookToQueue } from '../src/server/hardcoverQueue';

type CreateArgs = { data: { bookId: string } };

function fakeClient(onCreate?: () => never) {
    const calls: CreateArgs[] = [];
    return {
        calls,
        client: {
            hardcoverQueue: {
                create: async (args: CreateArgs) => {
                    calls.push(args);
                    if (onCreate) {
                        onCreate();
                    }
                    return { id: 'q-1', ...args.data };
                },
            },
        },
    };
}

describe('addBookToQueue', () => {
    it('writes through the transaction client it is given', async () => {
        // The bug: it used the module-level `db`, so the INSERT ran on a
        // different connection than the $tx that had just created the Book.
        // That connection cannot see the uncommitted row, so the FK check
        // failed with P2003 and every new book was silently never enqueued.
        const { calls, client } = fakeClient();

        await addBookToQueue('bk-1', client).catch(() => {});

        assert.equal(calls.length, 1, 'create must go through the injected client');
        assert.equal(calls[0].data.bookId, 'bk-1');
    });

    it('reports a duplicate as false rather than throwing', async () => {
        const { client } = fakeClient(() => {
            throw Object.assign(new Error('dup'), { code: 'P2002' });
        });

        assert.equal(await addBookToQueue('bk-1', client), false);
    });

    it('returns true when the book is newly queued', async () => {
        const { client } = fakeClient();
        assert.equal(await addBookToQueue('bk-1', client), true);
    });

    it('propagates errors that are not duplicates', async () => {
        // Swallowing these is what hid the FK violation for a year.
        const { client } = fakeClient(() => {
            throw Object.assign(new Error('fk'), { code: 'P2003' });
        });

        await assert.rejects(() => addBookToQueue('bk-1', client), /fk/);
    });
});
