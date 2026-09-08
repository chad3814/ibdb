'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ThrottledClient } from '@/app/api/admin/throttled/route';

const SECRET_KEY = 'ibdb-admin-secret';
const REFRESH_MS = 30_000;

function relative(iso: string|null): string {
    if (!iso) {
        return 'available now';
    }
    const seconds = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
    if (seconds < 60) {
        return `in ${seconds}s`;
    }
    if (seconds < 3600) {
        return `in ${Math.round(seconds / 60)}m`;
    }
    return `in ${(seconds / 3600).toFixed(1)}h`;
}

export default function ThrottledPage() {
    const [secret, setSecret] = useState('');
    const [entered, setEntered] = useState(false);
    const [clients, setClients] = useState<ThrottledClient[]>([]);
    const [limits, setLimits] = useState<{ capacity: number; refillPerDay: number }|null>(null);
    const [error, setError] = useState<string|null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const saved = sessionStorage.getItem(SECRET_KEY);
        if (saved) {
            setSecret(saved);
            setEntered(true);
        }
    }, []);

    const load = useCallback(async (withSecret: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/throttled', { headers: { 'x-secret': withSecret } });
            const data = await res.json();
            if (data.status !== 'ok') {
                throw new Error(res.status === 401 ? 'Wrong admin secret' : data.message);
            }
            setClients(data.clients);
            setLimits({ capacity: data.capacity, refillPerDay: data.refillPerDay });
            sessionStorage.setItem(SECRET_KEY, withSecret);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
            setClients([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!entered) {
            return;
        }
        load(secret);
        const timer = setInterval(() => load(secret), REFRESH_MS);
        return () => clearInterval(timer);
    }, [entered, secret, load]);

    const reset = async (clientHash: string) => {
        if (!confirm(`Reset the rate limit for ${clientHash}? They will start from a full bucket.`)) {
            return;
        }
        const res = await fetch(`/api/admin/throttled/${clientHash}`, {
            method: 'DELETE',
            headers: { 'x-secret': secret },
        });
        if (!res.ok) {
            setError('Reset failed');
            return;
        }
        await load(secret);
    };

    if (!entered) {
        return (
            <div className="min-h-screen bg-gray-50 text-gray-900 [color-scheme:light]">
                <div className="container mx-auto max-w-md px-4 py-16">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin secret</h1>
                    <form
                        onSubmit={e => { e.preventDefault(); setEntered(true); }}
                        className="flex gap-2"
                    >
                        <input
                            type="password"
                            value={secret}
                            onChange={e => setSecret(e.target.value)}
                            placeholder="ADMIN_SECRET"
                            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-gray-900"
                        />
                        <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
                            Continue
                        </button>
                    </form>
                    <p className="mt-3 text-sm text-gray-500">Kept in sessionStorage for this tab only.</p>
                </div>
            </div>
        );
    }

    const throttled = clients.filter(c => c.throttled).length;

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 [color-scheme:light]">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Search Rate Limits</h1>
                    <p className="text-gray-600">
                        Clients that have reached ISBNdb, most recently active first.
                        {limits && ` Burst ${limits.capacity}, ${limits.refillPerDay}/day sustained.`}
                        {' '}Only cache misses spend a token.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-red-800">
                        {error}
                        <button
                            onClick={() => { sessionStorage.removeItem(SECRET_KEY); setEntered(false); }}
                            className="ml-3 underline"
                        >
                            change secret
                        </button>
                    </div>
                )}

                <div className="mb-4 text-sm text-gray-600">
                    {clients.length} tracked, <strong>{throttled} currently throttled</strong>
                    {loading && ' · refreshing…'}
                </div>

                <div className="overflow-hidden rounded-lg bg-white shadow">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Client', 'Tokens', 'Next token', 'Last seen', ''].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-700">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {clients.map(c => (
                                <tr key={c.clientHash} className={c.throttled ? 'bg-red-50' : ''}>
                                    <td className="px-4 py-3 font-mono text-sm text-gray-900">{c.clientHash}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">
                                        {c.tokens.toFixed(1)}
                                        <span className="text-gray-400"> / {limits?.capacity ?? ''}</span>
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {c.throttled
                                            ? <span className="font-medium text-red-700">{relative(c.nextTokenAt)}</span>
                                            : <span className="text-gray-500">available now</span>}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {new Date(c.updatedAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => reset(c.clientHash)}
                                            className="rounded bg-gray-100 px-3 py-1 text-sm font-medium text-gray-900 hover:bg-gray-200"
                                        >
                                            Reset
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {clients.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                        No clients tracked yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
