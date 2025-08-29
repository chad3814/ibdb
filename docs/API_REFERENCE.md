# IBDB API Reference

## Base URL

```
https://your-domain.com
```

## Authentication

- **Public Endpoints**: No authentication required for read operations
- **Admin Endpoints**: Require secret authentication via query parameter or header

## Endpoints

### Search API

#### Search Books
```http
GET /search?q={query}
```

**Parameters:**
- `q` (string, required): Search query for book title and/or author

**Response:**
```typescript
type SearchResult = SearchResultSuccess | SearchResultError;

type SearchResultSuccess = {
    status: 'ok';
    books: ApiBook[];
};

type SearchResultError = {
    status: 'error';
    message: string;
};
```

**Example:**
```bash
curl "https://your-domain.com/search?q=harry%20potter"
```

### Book Retrieval API

#### Get Book by ID (JSON)
```http
GET /book-json/{id}
```

**Parameters:**
- `id` (string, required): Internal book ID

**Response:**
```typescript
type BookResponse = BookResponseSuccess | BookResponseError;

type BookResponseSuccess = {
    status: 'ok';
    book: ApiBook;
};

type BookResponseError = {
    status: 'error';
    message: string;
};
```

#### Get Book by ISBN (JSON)
```http
GET /isbn-json/{isbn13}
```

**Parameters:**
- `isbn13` (string, required): 13-digit ISBN

**Response:**
```typescript
type IsbnResponse = IsbnResponseSuccess | IsbnResponseError;

type IsbnResponseSuccess = {
    status: 'ok';
    book: ApiBook;
};

type IsbnResponseError = {
    status: 'error';
    message: string;
};
```

### HTML Pages

#### Book Detail Page
```http
GET /book/{id}
```
Server-rendered HTML page displaying book information.

#### ISBN Lookup Page
```http
GET /isbn/{isbn13}
```
Server-rendered HTML page for ISBN-based book lookup.

### Administrative API

#### List Missing External IDs
```http
GET /missing/{service}
```

**Parameters:**
- `service` (string): `hardcover`, `goodreads`, or `openlibrary`

**Authentication:** Required

**Response:**
Returns list of books missing external service IDs.

#### Update External IDs
```http
POST /missing/{service}
```

**Parameters:**
- `service` (string): External service name
- Request body: External ID mapping data

**Authentication:** Required

## Data Types

### Core Types

#### ApiBook
```typescript
type ApiBook = {
    id: string;
    createdAt: number | Date;
    updatedAt: number | Date;
    title: string;
    isbn13: string;  // @deprecated use the editions isbn13
    authors: ApiAuthor[];
    longTitle?: string | null;
    synopsis?: string | null;
    publicationDate?: string | null;  // @deprecated use the editions publication date
    publisher?: string | null;  // @deprecated use the editions publisher
    binding: ApiBinding;  // @deprecated see the edition bindings
    image?: ApiImage | null;  // @deprecated use an edition image
    editions: ApiEdition[];
    openLibraryId?: string | null;
    goodReadsId?: string | null;
    hardcoverId?: number | null;
}
```

#### ApiEdition
```typescript
type ApiEdition = {
    id: string;
    createdAt: number | Date;
    updatedAt: number | Date;
    isbn13: string;
    publicationDate?: string | null;
    publisher?: string | null;
    binding: ApiBinding;
    image?: ApiImage | null;
    openLibraryId?: string | null;
    goodReadsId?: string | null;
    hardcoverId?: number | null;
}
```

#### ApiAuthor
```typescript
type ApiAuthor = {
    id: string;
    createdAt: number | Date;
    updatedAt: number | Date;
    name: string;
    openLibraryId?: string | null;
    goodReadsId?: string | null;
    hardcoverId?: number | null;
}
```

#### ApiImage
```typescript
type ApiImage = {
    id: string;
    createdAt: number | Date;
    updatedAt: number | Date;
    url: string;
    width: number;
    height: number;
}
```

#### ApiBinding
```typescript
type ApiBinding = 'Unknown' | 'Hardcover' | 'Paperback' | 'Ebook' | 'Audiobook';
```

## Error Handling

### HTTP Status Codes
- `200 OK`: Successful request
- `400 Bad Request`: Invalid parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

### Error Response Format
All error responses follow this structure:
```typescript
{
    status: 'error';
    message: string;
}
```

### Common Error Messages
- `"Book not found"`: No book exists with the provided ID/ISBN
- `"Invalid ISBN format"`: ISBN does not match required format
- `"Search query too short"`: Query parameter is empty or too brief
- `"External service unavailable"`: ISBNdb API is unreachable

## Rate Limits

- **Search API**: No explicit rate limiting implemented
- **ISBNdb Integration**: Subject to ISBNdb API rate limits
- **Best Practice**: Cache responses and implement client-side rate limiting

## Examples

### Search for Books
```bash
# Search for Harry Potter books
curl "https://your-domain.com/search?q=harry%20potter"

# Search by author
curl "https://your-domain.com/search?q=j.k.%20rowling"
```

### Get Book Information
```bash
# Get book by ID
curl "https://your-domain.com/book-json/clb123example"

# Get book by ISBN
curl "https://your-domain.com/isbn-json/9780439064866"
```

### Check for Missing External IDs
```bash
# List books missing Hardcover IDs (requires authentication)
curl "https://your-domain.com/missing/hardcover?secret=your-secret"
```

## SDK Usage

### JavaScript/TypeScript
```typescript
// Search for books
const searchResponse = await fetch('/search?q=dune');
const searchResult: SearchResult = await searchResponse.json();

if (searchResult.status === 'ok') {
    console.log(searchResult.books);
}

// Get book by ISBN
const bookResponse = await fetch('/isbn-json/9780441172719');
const bookResult: IsbnResponse = await bookResponse.json();

if (bookResult.status === 'ok') {
    console.log(bookResult.book.title);
}
```

## Cross-References

- **Project Structure**: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- **Database Schema**: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- **Development Guide**: [DEVELOPMENT.md](./DEVELOPMENT.md)