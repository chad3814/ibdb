import AuthorsList from '@/components/AuthorsList';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Authors - IBDb',
    description: 'Browse all authors in the Internet Book Database',
    openGraph: {
        title: 'Authors - IBDb',
        description: 'Browse all authors in the Internet Book Database',
        type: 'website',
        siteName: 'IBDb - Internet Book Database',
    },
    twitter: {
        card: 'summary',
        title: 'Authors - IBDb',
        description: 'Browse all authors in the Internet Book Database',
    }
};

type SearchParams = {
    searchParams: Promise<{
        letter?: string;
    }>;
};

export default async function AuthorsPage({searchParams}: SearchParams) {
    const params = await searchParams;
    let letter = params.letter;
    
    // Validate the letter parameter
    if (letter && (letter.length !== 1 || !/[A-Z]/i.test(letter))) {
        letter = undefined;
    }
    
    return <AuthorsList letter={letter?.toUpperCase()}/>;
}