import { getApiBook } from "@/apiConvert";
import BookDetail from "@/app/book";
import { stripHtmlTags } from "@/lib/sanitizeSynopsis";
import { db } from "@/server/db";
import { Metadata } from "next";
import { notFound } from "next/navigation";

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
