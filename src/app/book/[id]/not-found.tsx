import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.icon} aria-hidden="true">📚</div>
                <h1 className={styles.title}>Book Not Found</h1>
                <p className={styles.description}>
                    The book you're looking for doesn't exist in our database or the ID is invalid.
                </p>
                <div className={styles.actions}>
                    <Link href="/" className={styles.homeButton}>
                        Go Back Home
                    </Link>
                    <Link href="/search" className={styles.searchButton}>
                        Search Books
                    </Link>
                </div>
            </div>
        </div>
    );
}