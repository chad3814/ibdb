export type ApiBook = {
    id: string;
    createdAt: number|Date;
    updatedAt: number|Date;
    title: string;
    isbn13: string;
    authors: ApiAuthor[];
    longTitle?: string|null;
    synopsis?: string|null;
    publicationDate?: string|null;
    publisher?: string|null;
    binding: 'Unknown'|'Hardcover'|'Paperback'|'Ebook'|'Audiobook';
    image?: ApiImage|null;
}

export type ApiAuthor = {
    id: string;
    createdAt: number|Date;
    updatedAt: number|Date;
    name: string;
}

export type ApiImage = {
    id: string;
    createdAt: number|Date;
    updatedAt: number|Date;
    url: string;
    width: number;
    height: number;
}
