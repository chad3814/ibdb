import SearchResults from '@/components/SearchResults';

interface SearchPageProps {
    searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
    const {q: query} = await searchParams;
    
    return <SearchResults query={query ?? ''} />;
}

export async function generateMetadata({ searchParams }: SearchPageProps) {
    const {q: query} = await searchParams;
    
    return {
        title: query ? `Search results for "${query}" - IBDb` : 'Search - IBDb',
        description: query 
            ? `Search results for "${query}" in our book database`
            : 'Search for books by title or author',
    };
}