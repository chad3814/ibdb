'use client';

import { useState } from 'react';

export default function AdminLoginPage() {
    const [secret, setSecret] = useState('');
    const [error, setError] = useState<string|null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret }),
            });
            const data = await res.json();
            if (data.status !== 'ok') {
                setError(res.status === 500 ? 'ADMIN_SECRET is not configured on the server' : 'Invalid secret');
                return;
            }
            // Read the target at submit time rather than during render, so the
            // page stays static and needs no Suspense boundary.
            const next = new URLSearchParams(window.location.search).get('next');
            window.location.href = next?.startsWith('/admin') ? next : '/admin';
        } catch {
            setError('Sign in failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 [color-scheme:light]">
            <div className="container mx-auto max-w-md px-4 py-16">
                <h1 className="mb-2 text-2xl font-bold text-gray-900">IBDb Admin</h1>
                <p className="mb-6 text-gray-600">Enter the admin secret to continue.</p>

                <form onSubmit={submit} className="flex gap-2">
                    <input
                        type="password"
                        value={secret}
                        onChange={e => setSecret(e.target.value)}
                        placeholder="ADMIN_SECRET"
                        autoFocus
                        className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-gray-900"
                    />
                    <button
                        type="submit"
                        disabled={busy || !secret}
                        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
                    >
                        {busy ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>

                {error && (
                    <p className="mt-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-red-800">{error}</p>
                )}
            </div>
        </div>
    );
}
