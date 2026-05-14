import { getApiBook } from "@/apiConvert";
import Book from "@/app/book";
import { lookupByIsbn13 } from "@/server/isbndb";
import { lookupByIsbn13 as lookupRainforestByIsbn13 } from "@/server/rainforest";

type Props = {
    params: Promise<{
        isbn: string;
    }>;
};

export default async function Isbn({ params }: Props) {
    const p = await params;
    let fullBook = await lookupByIsbn13(p.isbn);

    if (!fullBook) {
        try {
            fullBook = await lookupRainforestByIsbn13(p.isbn);
        } catch (err) {
            console.error(`Rainforest ISBN fallback failed for ${p.isbn}:`, err);
        }
    }

    if (!fullBook) {
        return <div>Book not found</div>;
    }

    return <Book book={getApiBook(fullBook)}/>;
}