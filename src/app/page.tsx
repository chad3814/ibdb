import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <form action="/search">
        search: <input type="text" name="q"/> <input type="submit"/>
        </form>
      </main>
    </div>
  );
}
