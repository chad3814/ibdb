'use client';

import { BookGridProps } from '@/types/home';
import BookCard from './BookCard';
import LoadingSpinner from './LoadingSpinner';
import styles from './BookGrid.module.css';

export default function BookGrid({ books, loading, error, onRetry }: BookGridProps) {
    if (loading && books.length === 0) {
        return (
            <div className={styles.loadingContainer} role="status" aria-live="polite">
                <LoadingSpinner />
                <span className={styles.loadingText}>Loading books...</span>
            </div>
        );
    }

    if (error && books.length === 0) {
        return (
            <div className={styles.errorContainer} role="alert">
                <div className={styles.errorContent}>
                    <h2 className={styles.errorTitle}>Failed to load books</h2>
                    <p className={styles.errorMessage}>{error}</p>
                    <button 
                        className={styles.retryButton}
                        onClick={onRetry}
                        type="button"
                        aria-label="Retry loading books"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (books.length === 0) {
        return (
            <div className={styles.emptyContainer}>
                <div className={styles.emptyContent}>
                    <h2 className={styles.emptyTitle}>No books found</h2>
                    <p className={styles.emptyMessage}>
                        It looks like there are no books in the database yet.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.gridContainer}>
            <div 
                className={styles.grid}
                role="grid"
                aria-label="Books collection"
            >
                {books.map((book) => (
                    <div
                        key={book.id}
                        className={styles.gridItem}
                        role="gridcell"
                    >
                        <BookCard book={book} />
                    </div>
                ))}
            </div>
            
            {error && books.length > 0 && (
                <div className={styles.errorBanner} role="alert">
                    <span className={styles.errorBannerText}>
                        Failed to load more books: {error}
                    </span>
                    <button 
                        className={styles.retryButtonSmall}
                        onClick={onRetry}
                        type="button"
                        aria-label="Retry loading more books"
                    >
                        Retry
                    </button>
                </div>
            )}
        </div>
    );
}