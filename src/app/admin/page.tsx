import Link from 'next/link';
import AdminSignOut from '@/components/AdminSignOut';

const SECTIONS = [
    {
        href: '/admin/duplicates',
        title: 'Author Duplicates',
        description: 'Review and merge duplicate author entries.',
    },
    {
        href: '/admin/throttled',
        title: 'Search Rate Limits',
        description: 'Clients that have reached ISBNdb, and their token buckets.',
    },
];

export default function AdminIndexPage() {
    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 [color-scheme:light]">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-8 flex items-start justify-between">
                    <div>
                        <h1 className="mb-2 text-3xl font-bold text-gray-900">IBDb Admin</h1>
                        <p className="text-gray-600">Internal tools for data quality and quota management.</p>
                    </div>
                    <AdminSignOut />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    {SECTIONS.map(s => (
                        <Link
                            key={s.href}
                            href={s.href}
                            className="block rounded-lg bg-white p-6 shadow transition hover:shadow-md"
                        >
                            <h2 className="mb-1 text-xl font-semibold text-gray-900">{s.title}</h2>
                            <p className="text-sm text-gray-600">{s.description}</p>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
