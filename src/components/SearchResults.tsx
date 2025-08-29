'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiBook } from '@/api';
import BookGrid from './BookGrid';
import SearchForm from './SearchForm';
import LoadingSpinner from './LoadingSpinner';
import styles from './SearchResults.module.css';

interface SearchResultsProps {
    query: string;
}

interface SearchResponse {
    status: 'ok' | 'error';
    books?: ApiBook[];
    message?: string;
}

export default function SearchResults({ query }: SearchResultsProps) {
    const [books, setBooks] = useState<ApiBook[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSearchResults = async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setBooks([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: SearchResponse = await response.json();

            if (data.status === 'error') {
                throw new Error(data.message || 'Search failed');
            }

            setBooks(data.books || []);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
            setError(errorMessage);
            setBooks([]);
        } finally {
            setLoading(false);
        }
    };

    const retry = () => {
        fetchSearchResults(query);
    };

    useEffect(() => {
        fetchSearchResults(query);
    }, [query]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <Link href="/" className={styles.backLink}>
                        ← Back to Home
                    </Link>
                    
                    <h1 className={styles.title}>
                        {query ? `Search Results for "${query}"` : 'Search Books'}
                    </h1>
                    
                    {books.length > 0 && !loading && (
                        <p className={styles.resultsCount}>
                            Found {books.length} book{books.length !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>
                
                <div className={styles.searchSection}>
                    <SearchForm />
                </div>
            </header>

            <main className={styles.main} role="main">
                {!query.trim() ? (
                    <div className={styles.emptyState}>
                        <h2 className={styles.emptyTitle}>Start Your Search</h2>
                        <p className={styles.emptyDescription}>
                            Enter a book title, author name, or ISBN above to find books in our database.
                        </p>
                    </div>
                ) : loading ? (
                    <div className={styles.loadingContainer}>
                        <LoadingSpinner />
                        <span className={styles.loadingText}>Searching for books...</span>
                    </div>
                ) : error ? (
                    <div className={styles.errorContainer}>
                        <h2 className={styles.errorTitle}>Search Failed</h2>
                        <p className={styles.errorMessage}>{error}</p>
                        <button 
                            className={styles.retryButton}
                            onClick={retry}
                            type="button"
                        >
                            Try Again
                        </button>
                    </div>
                ) : books.length === 0 ? (
                    <div className={styles.noResults}>
                        <h2 className={styles.noResultsTitle}>No Results Found</h2>
                        <p className={styles.noResultsDescription}>
                            We couldn&apos;t find any books matching &ldquo;{query}&rdquo;. Try:
                        </p>
                        <ul className={styles.suggestions}>
                            <li>Checking your spelling</li>
                            <li>Using different keywords</li>
                            <li>Searching by author name instead of title</li>
                            <li>Using the ISBN if you know it</li>
                        </ul>
                    </div>
                ) : (
                    <BookGrid 
                        books={books}
                        loading={loading}
                        error={error}
                        onRetry={retry}
                    />
                )}
            </main>
        </div>
    );
}