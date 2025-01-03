import { Binding } from "@/server/db";
import Image from "next/image";
import styles from "./book.module.css";
import { ApiBook } from "@/api";

type Props = {
    book: ApiBook;
};

export default function Book({ book }: Props) {
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
  );
}