'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ApiBook } from '@/api';

type Mode = 'search'|'isbn';

export default function AdminIsbndbPage() {
    const [mode, setMode] = useState<Mode>('search');
    const [input, setInput] = useState('');
    const [books, setBooks] = useState<ApiBook[]|null>(null);
    const [note, setNote] = useState<string|null>(null);
    const [error, setError] = useState<string|null>(null);
    const [loading, setLoading] = useState(false);

    const run = async () => {
        const value = input.trim();
        if (!value) {
            return;
        }
        setLoading(true);
        setError(null);
        setNote(null);
        setBooks(null);
        try {
            const url = mode === 'search'
                ? `/api/admin/isbndb/search?q=${encodeURIComponent(value)}`
                : `/api/admin/isbndb/isbn?isbn=${encodeURIComponent(value)}`;
            const res = await fetch(url);
            if (res.status === 401) {
                window.location.href = '/admin/login?next=/admin/isbndb';
                return;
            }
            const data = await res.json();
            if (data.status !== 'ok') {
                throw new Error(data.message);
            }
            if (mode === 'search') {
                setBooks(data.books);
                setNote(`Sent to ISBNdb as: "${data.query}"`);
            } else {
                setBooks([data.book]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Request failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 [color-scheme:light]">
            <div className="container mx-auto px-4 py-8">
                <Link href="/admin" className="mb-2 inline-block text-sm text-blue-600 hover:underline">
                    &larr; Admin
                </Link>
                <h1 className="mb-2 text-3xl font-bold text-gray-900">ISBNdb Direct</h1>
                <p className="mb-6 text-gray-600">
                    Queries ISBNdb with the rate limiter bypassed &mdash; neither your own
                    allowance nor the site-wide budget is spent or checked.
                </p>

                <div className="mb-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    These requests cost real ISBNdb quota but are not counted against the
                    site-wide budget, so heavy use here can push the day past 15,000 without
                    the budget noticing. They are logged as <code>isbndb admin query</code>.
                    An ISBN already in the database is still served from cache &mdash; the
                    bypass skips the limit, not the cache.
                </div>

                <div className="mb-6 rounded-lg bg-white p-4 shadow">
                    <div className="mb-3 flex gap-4">
                        {(['search', 'isbn'] as Mode[]).map(m => (
                            <label key={m} className="flex items-center gap-2 text-sm text-gray-900">
                                <input
                                    type="radio"
                                    name="mode"
                                    checked={mode === m}
                                    onChange={() => setMode(m)}
                                />
                                {m === 'search' ? 'Search query' : 'ISBN-13 lookup'}
                            </label>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400"
                            placeholder={mode === 'search' ? 'the hobbit tolkien' : '9780261102217'}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    void run();
                                }
                            }}
                        />
                        <button
                            onClick={() => void run()}
                            disabled={loading || input.trim() === ''}
                            className="rounded bg-blue-600 px-4 py-2 text-white disabled:bg-gray-300 disabled:text-gray-500"
                        >
                            {loading ? 'Querying…' : 'Query ISBNdb'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-red-800">
                        {error}
                    </div>
                )}

                {note && <p className="mb-3 text-sm text-gray-600">{note}</p>}

                {books && (
                    <div className="overflow-hidden rounded-lg bg-white shadow">
                        <p className="border-b border-gray-200 px-4 py-2 text-sm text-gray-600">
                            {books.length} result{books.length === 1 ? '' : 's'}
                        </p>
                        <ul className="divide-y divide-gray-200">
                            {books.map(b => (
                                <li key={b.id} className="px-4 py-3">
                                    <p className="font-medium text-gray-900">{b.title}</p>
                                    <p className="text-sm text-gray-600">
                                        {b.authors?.map(a => a.name).join(', ') || 'no authors'}
                                        {' · '}
                                        {b.editions?.length ?? 0} edition{(b.editions?.length ?? 0) === 1 ? '' : 's'}
                                    </p>
                                    <p className="font-mono text-xs text-gray-500">{b.id}</p>
                                </li>
                            ))}
                        </ul>
                        {books.length === 0 && (
                            <p className="px-4 py-6 text-center text-gray-500">ISBNdb returned nothing.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
