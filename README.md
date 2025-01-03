# IBDb

## IBDb - Internet Book Database

Endpoints:
* `/search?q=` search for a book based on title and/or author; a `SearchResult` JSON response
* `/book/[id]` an HTML view of book data
* `/isbn/[isbn13]` an HTML view of book data
* `/isbn-json/[isbn13]` an `IsbnResponse` JSON response

## JSON typings

```
type ApiBook = {
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

type ApiAuthor = {
    id: string;
    createdAt: number|Date;
    updatedAt: number|Date;
    name: string;
}

type ApiImage = {
    id: string;
    createdAt: number|Date;
    updatedAt: number|Date;
    url: string;
    width: number;
    height: number;
}

type SearchResultSuccess = {
    status: 'ok';
    books: ApiBook[];
};

type SearchResultError = {
    status: 'error';
    message: string;
};

type SearchResult = SearchResultSuccess|SearchResultError;

type IsbnResponseError = {
    status: 'error';
    message: string;
};

type IsbnResponseSuccess = {
    status: 'ok';
    book: ApiBook;
};

type IsbnResponse = IsbnResponseError|IsbnResponseSuccess;
```
