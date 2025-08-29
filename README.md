# IBDb - Internet Book Database

A Next.js-based book metadata aggregation service providing both API endpoints and web interfaces for book data lookup via ISBN and search functionality.

## 📖 Documentation

For comprehensive documentation, see the [docs/](./docs/) directory:

- **[Complete Documentation](./docs/README.md)** - Overview and quick start guide
- **[API Reference](./docs/API_REFERENCE.md)** - Detailed API documentation with examples
- **[Development Guide](./docs/DEVELOPMENT.md)** - Setup, workflow, and contribution guidelines  
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Database Schema](./docs/DATABASE_SCHEMA.md)** - Database design and relationships
- **[Project Structure](./docs/PROJECT_STRUCTURE.md)** - Codebase architecture overview

## Quick Start

```bash
npm install                    # Install dependencies
cp .env.example .env.local     # Configure environment
npx prisma generate            # Generate database client
npx prisma migrate dev         # Set up database
npm run dev                    # Start development server
```

## API Endpoints

### Web Pages
* `/` - Home page with infinite scroll of books
* `/book/[id]` - HTML view of book details
* `/isbn/[isbn13]` - HTML view of book data by ISBN
* `/author/[id]` - Author profile page with book list
* `/authors` - Authors listing with alphabetical filtering
* `/books?q=` - Search results page

### JSON APIs
* `/search?q=` - Search for books by title/author; returns `SearchResult` JSON (legacy endpoint, always returns JSON)
* `/api/search?q=` - Search for books by title/author; returns `SearchResult` JSON (preferred endpoint)
* `/book/[id].json` - Book data as `BookResponse` JSON
* `/isbn/[isbn13].json` - Book data by ISBN as `IsbnResponse` JSON
* `/api/authors` - List all authors (supports `?letter=` for filtering)
* `/api/authors/[id]` - Author details with books

### Legacy Endpoints (deprecated, but still supported)
* `/book-json/[id]` - Redirects to `/book/[id].json`
* `/isbn-json/[isbn13]` - Redirects to `/isbn/[isbn13].json`

## JSON typings

```typescript
type ApiBook = {
    id: string;
    createdAt: number|Date;
    updatedAt: number|Date;
    title: string;
    isbn13: string;  // @deprecated use the editions isbn13
    authors: ApiAuthor[];
    longTitle?: string|null;
    synopsis?: string|null;
    publicationDate?: string|null;  // @deprecated use the editions publication date
    publisher?: string|null;  // @deprecated use the editions publisher
    binding: 'Unknown'|'Hardcover'|'Paperback'|'Ebook'|'Audiobook';  // @deprecated see the edition bindings
    image?: ApiImage|null;  // @deprecated use an edition image
    editions: ApiEdition[];
    openLibraryId?: string|null;
    goodReadsId?: string|null;
    hardcoverId?: number|null;
}

type ApiBinding = 'Unknown'|'Hardcover'|'Paperback'|'Ebook'|'Audiobook';

type ApiEdition = {
    id: string;
    createdAt: number|Date;
    updatedAt: number|Date;
    isbn13: string;
    publicationDate?: string|null;
    publisher?: string|null;
    binding: ApiBinding;
    image?: ApiImage|null;
    openLibraryId?: string|null;
    goodReadsId?: string|null;
    hardcoverId?: number|null;
}

type ApiAuthor = {
    id: string;
    createdAt: number|Date;
    updatedAt: number|Date;
    name: string;
    openLibraryId?: string|null;
    goodReadsId?: string|null;
    hardcoverId?: number|null;
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

type BookResponseError = {
    status: 'error';
    message: string;
};

type BookResponseSuccess = {
    status: 'ok';
    book: ApiBook;
};

type BookResponse = BookResponseError|BookResponseSuccess;

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
