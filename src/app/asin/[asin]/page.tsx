import { getApiBook } from "@/apiConvert";
import Book from "@/app/book";
import { lookupByAsin } from "@/server/rainforest";

type Props = {
    params: Promise<{
        asin: string;
    }>;
};

export default async function Asin({ params }: Props) {
    const p = await params;
    const fullBook = await lookupByAsin(p.asin);

    if (!fullBook) {
        return <div>Book not found</div>;
    }

    return <Book book={getApiBook(fullBook)}/>;
}
