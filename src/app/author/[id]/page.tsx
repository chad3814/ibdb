import AuthorDetail from '@/components/AuthorDetail';
import { db } from '@/server/db';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

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