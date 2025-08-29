'use client';

import { useAuthorsInfiniteScroll } from '@/hooks/useAuthorsInfiniteScroll';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import styles from './AuthorsList.module.css';

// Generate alphabet array
const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

type Params = {
    letter?: string;
};

export default function AuthorsList({letter: initialLetter}: Params) {
    const router = useRouter();
    const [selectedLetter, setSelectedLetter] = useState(initialLetter || '');

    const {
        authors,
        loading,
        error,
        hasMore,
        total,
        loadMoreRef,
        retry
    } = useAuthorsInfiniteScroll(selectedLetter);

    const handleLetterClick = useCallback((newLetter: string) => {
        // Navigate to the appropriate URL
        if (selectedLetter === newLetter) {
            // Clicking same letter deselects it
            router.push('/authors');
        } else {
            // Select new letter
            router.push(`/authors?letter=${newLetter}`);
        }
    }, [router, selectedLetter]);

    useEffect(() => {
        // Update selected letter when prop changes
        setSelectedLetter(initialLetter || '');
    }, [initialLetter]);

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                    <Link href="/" className={styles.breadcrumbLink}>
                        Home
                    </Link>
                    <span className={styles.breadcrumbSeparator} aria-hidden="true">/</span>
                    <span className={styles.breadcrumbCurrent}>Authors</span>
                </nav>
                
                <h1 className={styles.title}>Authors</h1>
                <p className={styles.subtitle}>
                    {selectedLetter 
                        ? `Showing authors starting with "${selectedLetter}"`
                        : `Browse ${total.toLocaleString()} authors in our database`
                    }
                </p>

                {/* Alphabet Filter */}
                <div className={styles.alphabetFilter}>
                    <button
                        className={`${styles.letterButton} ${!selectedLetter ? styles.letterActive : ''}`}
                        onClick={() => router.push('/authors')}
                        aria-label="Show all authors"
                    >
                        All
                    </button>
                    {ALPHABET.map(letter => (
                        <button
                            key={letter}
                            className={`${styles.letterButton} ${selectedLetter === letter ? styles.letterActive : ''}`}
                            onClick={() => handleLetterClick(letter)}
                            aria-label={`Filter by letter ${letter}`}
                            aria-pressed={selectedLetter === letter}
                        >
                            {letter}
                        </button>
                    ))}
                </div>
            </header>

            {/* Authors Grid */}
            {loading && authors.length === 0 ? (
                <div className={styles.loadingContainer}>
                    <LoadingSpinner />
                    <p className={styles.loadingText}>Loading authors...</p>
                </div>
            ) : error && authors.length === 0 ? (
                <div className={styles.errorContainer}>
                    <p className={styles.errorText}>{error}</p>
                    <button 
                        className={styles.retryButton}
                        onClick={retry}
                    >
                        Try Again
                    </button>
                </div>
            ) : authors.length === 0 ? (
                <div className={styles.emptyContainer}>
                    <p className={styles.emptyText}>
                        {selectedLetter 
                            ? `No authors found starting with "${selectedLetter}"`
                            : 'No authors found'}
                    </p>
                </div>
            ) : (
                <>
                    <div className={styles.authorsGrid}>
                        {authors.map(author => (
                            <Link
                                key={author.id}
                                href={`/author/${author.id}`}
                                className={styles.authorCard}
                            >
                                <div className={styles.authorInitial}>
                                    {author.name.charAt(0).toUpperCase()}
                                </div>
                                <div className={styles.authorInfo}>
                                    <h2 className={styles.authorName}>{author.name}</h2>
                                    <p className={styles.bookCount}>
                                        {author.bookCount} {author.bookCount === 1 ? 'book' : 'books'}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Infinite scroll trigger */}
                    {hasMore && (
                        <div 
                            ref={loadMoreRef} 
                            className={styles.loadingTrigger}
                            aria-hidden="true"
                        >
                            {loading && (
                                <div className={styles.loadingMoreContainer}>
                                    <LoadingSpinner />
                                    <span className={styles.srOnly}>Loading more authors...</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error banner for loading more */}
                    {error && authors.length > 0 && (
                        <div className={styles.errorBanner} role="alert">
                            <span className={styles.errorBannerText}>{error}</span>
                            <button
                                className={styles.retryButtonSmall}
                                onClick={retry}
                                type="button"
                                aria-label="Retry loading more authors"
                            >
                                Retry
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}