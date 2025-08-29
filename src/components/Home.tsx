'use client';

import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import BookGrid from './BookGrid';
import LoadingSpinner from './LoadingSpinner';
import SearchForm from './SearchForm';
import styles from './Home.module.css';

export default function Home() {
    const {
        books,
        loading,
        error,
        hasMore,
        retry,
        sentinelRef
    } = useInfiniteScroll({
        threshold: 0.1,
        rootMargin: '100px'
    });

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>IBDb</h1>
                <p className={styles.subtitle}>Internet Book Database</p>
                <p className={styles.description}>
                    Discover and explore books from our growing collection
                </p>
                
                <div className={styles.searchSection}>
                    <SearchForm />
                </div>
            </header>

            <main className={styles.main} role="main">
                <BookGrid 
                    books={books}
                    loading={loading}
                    error={error}
                    onRetry={retry}
                />
                
                {/* Infinite scroll trigger */}
                {hasMore && !loading && !error && (
                    <div 
                        ref={sentinelRef}
                        className={styles.sentinel}
                        aria-hidden="true"
                    >
                        <div className={styles.loadingMore}>
                            <LoadingSpinner size="small" />
                            <span className={styles.loadingMoreText}>Loading more books...</span>
                        </div>
                    </div>
                )}
                
                {/* End of results indicator */}
                {!hasMore && books.length > 0 && !loading && (
                    <div className={styles.endMessage} role="status" aria-live="polite">
                        <p>You've reached the end of our book collection!</p>
                        <p className={styles.totalCount}>
                            Showing all {books.length} books
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}