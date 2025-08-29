import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <h1 className={styles.title}>Author Not Found</h1>
                <p className={styles.message}>
                    The author you're looking for doesn't exist or may have been removed.
                </p>
                <div className={styles.actions}>
                    <Link href="/" className={styles.homeButton}>
                        Back to Home
                    </Link>
                    <Link href="/authors" className={styles.authorsButton}>
                        Browse Authors
                    </Link>
                </div>
            </div>
        </div>
    );
}