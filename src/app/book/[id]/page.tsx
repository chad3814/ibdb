import Book from "@/app/book";
import { db } from "@/server/db";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function BookPage({ params }: Props) {
    const p = await params;
    const book = await db.book.findFirst({
        where: {
            id: p.id,
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
