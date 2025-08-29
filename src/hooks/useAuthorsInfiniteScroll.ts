'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Author {
    id: string;
    name: string;
    bookCount: number;
}

interface AuthorsResponse {
    status: 'ok' | 'error';
    authors?: Author[];
    hasMore?: boolean;
    total?: number;
    message?: string;
}

interface UseAuthorsInfiniteScrollOptions {
    threshold?: number;
    rootMargin?: string;
}

export function useAuthorsInfiniteScroll(
    selectedLetter: string,
    options: UseAuthorsInfiniteScrollOptions = {}
) {
    const { threshold = 0, rootMargin = '100px' } = options;
    
    const [authors, setAuthors] = useState<Author[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [total, setTotal] = useState(0);
    
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const currentLetterRef = useRef(selectedLetter);
    const isLoadingRef = useRef(false);

    const fetchAuthors = useCallback(async (pageNum: number, letter: string) => {
        if (isLoadingRef.current) return;
        
        try {
            isLoadingRef.current = true;
            setLoading(true);
            setError(null);
            
            const params = new URLSearchParams({
                page: pageNum.toString(),
                limit: '50',
                ...(letter && { letter })
            });
            
            const response = await fetch(`/api/authors?${params}`);
            const data: AuthorsResponse = await response.json();
            
            if (data.status === 'error') {
                setError(data.message || 'Failed to load authors');
                return;
            }
            
            if (data.authors) {
                setAuthors(prev => pageNum === 1 ? data.authors! : [...prev, ...data.authors!]);
                setHasMore(data.hasMore || false);
                setTotal(data.total || 0);
                setPage(pageNum + 1);
            }
        } catch (err) {
            console.error('Error fetching authors:', err);
            setError('Failed to load authors. Please try again.');
        } finally {
            setLoading(false);
            isLoadingRef.current = false;
        }
    }, []);

    // Reset and fetch when letter changes
    useEffect(() => {
        // Reset state
        setAuthors([]);
        setPage(1);
        setHasMore(true);
        setError(null);
        setTotal(0);
        currentLetterRef.current = selectedLetter;
        
        // Fetch first page with new letter
        fetchAuthors(1, selectedLetter);
    }, [selectedLetter, fetchAuthors]);

    // Set up intersection observer for infinite scroll
    useEffect(() => {
        if (!loadMoreRef.current) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading && page > 1) {
                    fetchAuthors(page, currentLetterRef.current);
                }
            },
            { threshold, rootMargin }
        );

        observerRef.current.observe(loadMoreRef.current);

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [fetchAuthors, hasMore, loading, page, threshold, rootMargin]);

    const retry = useCallback(() => {
        setError(null);
        if (authors.length === 0) {
            fetchAuthors(1, currentLetterRef.current);
        } else {
            fetchAuthors(page, currentLetterRef.current);
        }
    }, [fetchAuthors, page, authors.length]);

    return {
        authors,
        loading,
        error,
        hasMore,
        total,
        loadMoreRef,
        retry
    };
}