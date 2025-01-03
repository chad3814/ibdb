'use client';
import { ChangeEvent, useCallback, useState } from "react";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isbn, setIsbn] = useState<string>('');
  const [disabled, setDisabled] = useState<boolean>(true);
  const router = useRouter();

  const isbnUpdate = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      const value = evt.target.value;
      let dis = false;
      if (value.length !== 13) {
        dis = true;
      }
      setIsbn(value);
      if (value.split('').some(
        c => c.charCodeAt(0) < '0'.charCodeAt(0) || c.charCodeAt(0) > '9'.charCodeAt(0)
      )) {
        dis = true;
      }
      setDisabled(dis);
    },
    [],
  );

  const isbnClick = useCallback(
    () => {
      router.push(`/isbn/${isbn}.json`);
    },
    [isbn, router],
  )

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>IBDb</h1>
        <h4>Get a JSON blob of book metadata</h4>
        <div>
          <form action="/search">
          search by title or author: <input type="text" name="q"/> <input type="submit"/>
          </form>
        </div>
        <div>
          search by ISBN: <input type="text" onChange={isbnUpdate} value={isbn}/> <button disabled={disabled} onClick={() => isbnClick()}>submit</button>
        </div>
      </main>
    </div>
  );
}
