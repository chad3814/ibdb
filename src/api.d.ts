export type ApiBook = {
    id: string;
    createAt: number|Date;
    updatedAt: number|Date;
    title: string;
    isbn13: string;
    authors: ApiAuthor[];
    longTitle?: string|null;
    description?: string|null;
    synopsis?: string|null;
    publicationDate?: string|null;
    images: ApiImage[];
}

export type ApiAuthor = {
    id: string;
    createAt: number|Date;
    updatedAt: number|Date;
    name: string;
    akas: string[];
}

export type ApiImage = {
    id: string;
    createAt: number|Date;
    updatedAt: number|Date;
    url: string;
    width: number;
    height: number;
}