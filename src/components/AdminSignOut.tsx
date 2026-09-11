'use client';

export default function AdminSignOut() {
    const signOut = async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        window.location.href = '/admin/login';
    };

    return (
        <button
            onClick={signOut}
            className="rounded bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200"
        >
            Sign out
        </button>
    );
}
