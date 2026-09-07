import { getApiBook } from "@/apiConvert";
import BookDetail from "@/app/book";
import { stripHtmlTags } from "@/lib/sanitizeSynopsis";
import { db } from "@/server/db";
import { Metadata } from "next";
import { notFound } from "next/navigation";

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
 * No paths are prerendered at build time -- there are 2.5M books. Returning an
 * empty list is what registers the route as cacheable: without this the route
 * stays fully dynamic and `revalidate` above is silently ignored, which the
 * build's prerender manifest confirms (dynamicRoutes was empty).
 */
export async function generateStaticParams() {
    return [];
}

type Props = {
    params: Promise<{
        id: string;
    }>;
};

// Generate metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    
    const book = await db.book.findFirst({
        where: { id },
        include: {
            authors: true,
            editions: {
                include: {
                    image: true,
                },
            },
        }
    });

    if (!book) {
        return {
            title: 'Book Not Found - IBDb',
            description: 'The requested book could not be found in our database.',
        };
    }

    const apiBook = getApiBook(book);
    const title = apiBook.longTitle || apiBook.title;
    const authors = apiBook.authors.map(a => a.name).join(', ');
    
    return {
        title: `${title} by ${authors} - IBDb`,
        description: apiBook.synopsis
            ? stripHtmlTags(apiBook.synopsis).substring(0, 160) + '...'
            : `${title} by ${authors}. Find book details, publication information, and more on IBDb.`,
        openGraph: {
            title: title,
            description: apiBook.synopsis ? stripHtmlTags(apiBook.synopsis) : `${title} by ${authors}`,
            images: apiBook.image ? [{
                url: apiBook.image.url,
                width: apiBook.image.width,
                height: apiBook.image.height,
                alt: title,
            }] : [],
            type: 'book',
        },
        twitter: {
            card: 'summary_large_image',
            title: title,
            description: apiBook.synopsis ? stripHtmlTags(apiBook.synopsis) : `${title} by ${authors}`,
            images: apiBook.image ? [apiBook.image.url] : [],
        },
        other: {
            'book:isbn': apiBook.isbn13,
            'book:author': authors,
            'book:release_date': apiBook.publicationDate || '',
        },
    };
}

export default async function BookPage({ params }: Props) {
    const { id } = await params;
    
    const fullBook = await db.book.findFirst({
        where: {
            id,
        },
        include: {
            authors: true,
            editions: {
                include: {
                    image: true,
                },
            },
        }
    });

    if (!fullBook) {
        notFound();
    }

    return <BookDetail book={getApiBook(fullBook)} />;
}
