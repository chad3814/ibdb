import { ApiBook } from "@/api";

export interface BooksResponse {
    status: 'ok' | 'error';
    books?: ApiBook[];
    hasMore?: boolean;
    total?: number;
    message?: string;
}

export interface UseInfiniteScrollOptions {
    threshold?: number;
    rootMargin?: string;
}

export interface BookGridProps {
    books: ApiBook[];
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}

export interface BookCardProps {
    book: ApiBook;
}