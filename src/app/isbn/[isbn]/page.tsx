import { getApiBook } from "@/apiConvert";
import Book from "@/app/book";
import { lookupByIsbn13 } from "@/server/isbndb";

type Props = {
    params: Promise<{
        isbn: string;
    }>;
};

export default async function Isbn({ params }: Props) {
    const p = await params;
    const fullBook = await lookupByIsbn13(p.isbn);

    if (!fullBook) {
        return <div>Book not found</div>;
    }

    //const imageWidth =
    return <Book book={getApiBook(fullBook)}/>;
}