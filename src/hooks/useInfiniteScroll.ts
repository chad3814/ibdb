'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiBook } from '@/api';
import { BooksResponse, UseInfiniteScrollOptions } from '@/types/home';

const DEFAULT_LIMIT = 20;

interface UseInfiniteScrollReturn {
    books: ApiBook[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    loadMore: () => void;
    retry: () => void;
    sentinelRef: React.RefObject<HTMLDivElement | null>;
}

export function useInfiniteScroll(options: UseInfiniteScrollOptions = {}): UseInfiniteScrollReturn {
    const { threshold = 0.1, rootMargin = '50px' } = options;
    
    const [books, setBooks] = useState<ApiBook[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    
    const sentinelRef = useRef<HTMLDivElement>(null);
    const loadingRef = useRef(false);

    const fetchBooks = useCallback(async (pageNum: number, reset = false) => {
        if (loadingRef.current) return;
        
        loadingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/books?page=${pageNum}&limit=${DEFAULT_LIMIT}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: BooksResponse = await response.json();

            if (data.status === 'error') {
                throw new Error(data.message || 'Failed to fetch books');
            }

            const newBooks = data.books || [];
            
            if (reset) {
                setBooks(newBooks);
            } else {
                setBooks(prev => [...prev, ...newBooks]);
            }
            
            setHasMore(data.hasMore || false);
            
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
            setError(errorMessage);
            console.error('Error fetching books:', err);
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, []);

    const loadMore = useCallback(() => {
        if (!hasMore || loading || error) return;
        const nextPage = page + 1;
        setPage(nextPage);
        fetchBooks(nextPage);
    }, [hasMore, loading, error, page, fetchBooks]);

    const retry = useCallback(() => {
        setError(null);
        if (books.length === 0) {
            setPage(1);
            fetchBooks(1, true);
        } else {
            fetchBooks(page);
        }
    }, [books.length, page, fetchBooks]);

    // Load initial data
    useEffect(() => {
        fetchBooks(1, true);
    }, [fetchBooks]);

    // Set up intersection observer for infinite scroll
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && hasMore && !loading && !error) {
                    loadMore();
                }
            },
            {
                threshold,
                rootMargin,
            }
        );

        observer.observe(sentinel);

        return () => {
            if (sentinel) {
                observer.unobserve(sentinel);
            }
        };
    }, [hasMore, loading, error, loadMore, threshold, rootMargin]);

    return {
        books,
        loading: loading && books.length === 0, // Only show loading for initial load
        error,
        hasMore,
        loadMore,
        retry,
        sentinelRef,
    };
}