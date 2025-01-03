import { Binding, db } from "@/server/db";
import Image from "next/image";
import styles from "./book.module.css";

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

    return (
        <>
            <div className={styles.container}>
                <h2>{book.longTitle ?? book.title}</h2>
                <div className={styles.book}>
                    <Image src={book.image?.url ?? ''} width={100} height={150} alt={book.longTitle ?? book.title}/>
                    <div className={styles.info}>
                        <div className={styles.byLine}>
                            <div className={styles.authors}>by {book.authors.map(a => a.name).join(', ')}</div>
                            <div className={styles.publisher}>{book.publicationDate} {book.publisher}</div>
                        </div>
                        <div className={styles.synopsis}>{book.synopsis}</div>
                        <div className={styles.isbn}>
                            <span title='ISBN'>{book.isbn13}</span>
                            {book.binding !== Binding.Unknown && <div className={styles.binding}>{book.binding}</div>}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}