import { headers } from "next/headers";
import { getApiBook } from "@/apiConvert";
import Book from "@/app/book";
import { lookupByIsbn13 } from "@/server/isbndb";
import { clientHashFromHeaders } from "@/lib/clientHash";
import { spendIsbndbToken } from "@/server/searchRateLimit";

type Props = {
    params: Promise<{
        isbn: string;
    }>;
};

export default async function Isbn({ params }: Props) {
    const p = await params;
    const client = await clientHashFromHeaders(await headers());
    const result = await lookupByIsbn13(p.isbn, () => spendIsbndbToken(client));

    // A server component cannot set a status code, so a refused lookup renders
    // as a soft failure at 200. Deliberately distinct wording from "not found":
    // this ISBN may well exist, we just cannot afford to ask right now.
    if (result.kind === 'throttled') {
        return <div>Too many new book lookups right now. Try again shortly.</div>;
    }

    if (result.kind === 'not-found') {
        return <div>Book not found</div>;
    }

    //const imageWidth =
    return <Book book={getApiBook(result.book)}/>;
}