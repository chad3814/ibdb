'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './SearchForm.module.css';

export default function SearchForm() {
    const [query, setQuery] = useState('');
    const [isbn, setIsbn] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSearch = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        
        setLoading(true);
        try {
            // Navigate to search results page
            router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    }, [query, router]);

    const handleIsbnSearch = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isbn.trim()) return;
        
        setLoading(true);
        try {
            router.push(`/isbn/${isbn.trim()}`);
        } catch (error) {
            console.error('ISBN search error:', error);
        } finally {
            setLoading(false);
        }
    }, [isbn, router]);

    const isValidIsbn = useCallback((value: string) => {
        return value.length === 13 && /^\d+$/.test(value);
    }, []);

    return (
        <div className={styles.searchContainer}>
            <div className={styles.searchForms}>
                <form onSubmit={handleSearch} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="search-query" className={styles.label}>
                            Search by title or author
                        </label>
                        <div className={styles.inputWrapper}>
                            <input
                                id="search-query"
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Enter book title or author name"
                                className={styles.input}
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                disabled={!query.trim() || loading}
                                className={styles.submitButton}
                                aria-label="Search books"
                            >
                                {loading ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                    </div>
                </form>

                <div className={styles.divider}>
                    <span className={styles.dividerText}>or</span>
                </div>

                <form onSubmit={handleIsbnSearch} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="isbn-search" className={styles.label}>
                            Search by ISBN
                        </label>
                        <div className={styles.inputWrapper}>
                            <input
                                id="isbn-search"
                                type="text"
                                value={isbn}
                                onChange={(e) => setIsbn(e.target.value)}
                                placeholder="Enter 13-digit ISBN"
                                className={styles.input}
                                maxLength={13}
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                disabled={!isValidIsbn(isbn) || loading}
                                className={styles.submitButton}
                                aria-label="Search by ISBN"
                            >
                                {loading ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}