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
    binding: ApiBinding;
    editions: ApiEdition[];
    image?: ApiImage|null;
    openLibraryId?: string|null;
    goodReadsId?: string|null;
    hardcoverId?: number|null;
    hardcoverSlug?: string|null;
}

export type ApiEdition = {
    id: string;
    createdAt: number|Date;
    updatedAt: number|Date;
    bookId: string;
    editionName?: string|null;
    isbn13: string;
    publicationDate?: string|null;
    publisher?: string|null;
    binding: ApiBinding;
    openLibraryId?: string|null;
    goodReadsId?: string|null;
    hardcoverId?: number|null;
}

export type ApiBinding = 'Unknown'|'Hardcover'|'Paperback'|'Ebook'|'Audiobook';

export type ApiAuthor = {
    id: string;
    createdAt: number|Date;
    updatedAt: number|Date;
    name: string;
    openLibraryId?: string|null;
    goodReadsId?: string|null;
    hardcoverId?: number|null;
    hardcoverSlug?: string|null;
}

export type ApiImage = {
    id: string;
    createdAt: number|Date;
    updatedAt: number|Date;
    url: string;
    width: number;
    height: number;
}
