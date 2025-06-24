import { getApiBook } from "@/apiConvert";
import Book from "@/app/book";
import { db } from "@/server/db";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function BookPage({ params }: Props) {
    const p = await params;
    const fullBook = await db.book.findFirst({
        where: {
            id: p.id,
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
        return <div>Book not found</div>;
    }

    //const imageWidth =
    return <Book book={getApiBook(fullBook)}/>;
}
