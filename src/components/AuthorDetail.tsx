'use client';

import { ApiBook } from '@/api';
import BookGrid from '@/components/BookGrid';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './AuthorDetail.module.css';

interface Author {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    bookCount: number;
}

interface AuthorDetailProps {
    authorId: string;
}

export default function AuthorDetail({ authorId }: AuthorDetailProps) {
    const [author, setAuthor] = useState<Author | null>(null);
    const [books, setBooks] = useState<ApiBook[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchAuthor() {
            try {
                setLoading(true);
                setError(null);
                
                const response = await fetch(`/api/authors/${authorId}`);
                const data = await response.json();
                
                if (data.status === 'error') {
                    setError(data.message);
                    return;
                }
                
                setAuthor(data.author);
                setBooks(data.books);
            } catch (err) {
                setError('Failed to load author information');
                console.error('Error fetching author:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchAuthor();
    }, [authorId]);

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <LoadingSpinner />
                <p className={styles.loadingText}>Loading author information...</p>
            </div>
        );
    }

    if (error || !author) {
        return (
            <div className={styles.errorContainer}>
                <div className={styles.errorContent}>
                    <h1 className={styles.errorTitle}>Author Not Found</h1>
                    <p className={styles.errorMessage}>
                        {error || 'The author you are looking for could not be found.'}
                    </p>
                    <Link href="/" className={styles.homeButton}>
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Breadcrumb Navigation */}
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                <Link href="/" className={styles.breadcrumbLink}>
                    Home
                </Link>
                <span className={styles.breadcrumbSeparator} aria-hidden="true">/</span>
                <Link href="/authors" className={styles.breadcrumbLink}>
                    Authors
                </Link>
                <span className={styles.breadcrumbSeparator} aria-hidden="true">/</span>
                <span className={styles.breadcrumbCurrent}>{author.name}</span>
            </nav>

            {/* Author Header */}
            <header className={styles.header}>
                <h1 className={styles.authorName}>{author.name}</h1>
                <div className={styles.stats}>
                    <div className={styles.stat}>
                        <span className={styles.statLabel}>Books</span>
                        <span className={styles.statValue}>{author.bookCount}</span>
                    </div>
                    <div className={styles.stat}>
                        <span className={styles.statLabel}>Added</span>
                        <span className={styles.statValue}>
                            {new Date(author.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </header>

            {/* Books Section */}
            <section className={styles.booksSection}>
                <h2 className={styles.sectionTitle}>
                    Books by {author.name}
                </h2>
                {books.length > 0 ? (
                    <BookGrid 
                        books={books} 
                        loading={false} 
                        error={null}
                        onRetry={() => window.location.reload()}
                    />
                ) : (
                    <div className={styles.noBooksMessage}>
                        <p>No books found for this author.</p>
                    </div>
                )}
            </section>
        </div>
    );
}