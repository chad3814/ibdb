import AuthorDetail from '@/components/AuthorDetail';
import { db } from '@/server/db';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

/**
 * Cache this page at the edge for a week.
 *
 * These pages were fully dynamic, so every request -- including every crawler
 * hit -- invoked a function and queried Postgres twice, once in
 * generateMetadata and once in the page itself. Anthologies make that
 * expensive: one book with 182 authors links to 182 author pages that each
 * link back, and a crawler walking that graph fetched the same book page 90
 * times in a day. Book and author records change rarely enough that serving a
 * cached copy is the right default.
 *
 * Thirty days is a backstop, not the primary mechanism. The cron worker purges
 * a book's page as soon as it writes a hardcoverId, so the link appears within
 * a minute rather than a month; the TTL only covers changes nothing thinks to
 * purge, such as a new edition of an existing book.
 */
export const revalidate = 2592000;

/**
 * No paths are prerendered at build time. Returning an empty list is what
 * registers the route as cacheable: without generateStaticParams the route
 * stays fully dynamic and `revalidate` above is silently ignored, which the
 * build's prerender manifest confirms.
 */
export async function generateStaticParams() {
    return [];
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const {id} = await params;
    try {
        const author = await db.author.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { books: true }
                }
            }
        });

        if (!author) {
            return {
                title: 'Author Not Found - IBDb',
                description: 'The requested author could not be found.'
            };
        }

        const bookCount = author._count.books;
        const description = `Browse ${bookCount} book${bookCount !== 1 ? 's' : ''} by ${author.name} on IBDb - Internet Book Database`;

        return {
            title: `${author.name} - IBDb`,
            description,
            openGraph: {
                title: `${author.name} - IBDb`,
                description,
                type: 'profile',
                siteName: 'IBDb - Internet Book Database',
            },
            twitter: {
                card: 'summary',
                title: `${author.name} - IBDb`,
                description,
            }
        };
    } catch (error) {
        console.error('Error generating metadata:', error);
        return {
            title: 'Author - IBDb',
            description: 'View author information on IBDb'
        };
    }
}

export default async function AuthorPage({ params }: PageProps) {
    const {id} = await params;
    // Verify the author exists
    const author = await db.author.findUnique({
        where: { id }
    });

    if (!author) {
        notFound();
    }

    return <AuthorDetail authorId={id} />;
}