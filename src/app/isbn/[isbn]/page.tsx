import Book from "@/app/book";
import { db } from "@/server/db";

type Props = {
    params: Promise<{
        isbn: string;
    }>;
};

export default async function Isbn({ params }: Props) {
    const p = await params;
    const book = await db.book.findFirst({
        where: {
            isbn13: p.isbn,
        },
        include: {
            authors: true,
            image: true,
        }
    });

    if (!book) {
        return <div>Book not found</div>;
    }

    //const imageWidth =
    return <Book book={book}/>;
}