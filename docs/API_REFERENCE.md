# IBDB API Reference

## Base URL

```
https://your-domain.com
```

## Authentication

- **Public Endpoints**: No authentication required for read operations
- **Admin Endpoints**: Require admin secret authentication
  - Header: `x-secret: YOUR_ADMIN_SECRET` OR `x-secret: YOUR_MISSING_POST_SECRET`
  - Environment variables: `ADMIN_SECRET`, `MISSING_POST_SECRET`

## Endpoints

### Search API

#### Search Books
```http
GET /api/search?q={query}
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
curl "https://your-domain.com/api/search?q=harry%20potter"
```

**Notes:**
- Queries are cleaned to remove special characters and converted to lowercase
- Results are cached for improved performance
- Falls back to ISBNdb API for uncached queries

### Book Retrieval API

#### Get Book by ID (JSON)
```http
GET /api/book-json/{id}
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

**Example:**
```bash
curl "https://your-domain.com/api/book-json/clb123example"
```

#### Get Book by ISBN (JSON)
```http
GET /api/isbn-json/{isbn13}
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

**Example:**
```bash
curl "https://your-domain.com/api/isbn-json/9780439064866"
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

## Public API Endpoints

### Books

#### List Books
```http
GET /api/books
```

**Parameters:**
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 50)

**Response:**
```typescript
type BooksResult = BooksResultSuccess | BooksResultError;

type BooksResultSuccess = {
    status: 'ok';
    books: ApiBook[];
    hasMore: boolean;
    total: number;
};

type BooksResultError = {
    status: 'error';
    message: string;
};
```

**Example:**
```bash
curl "https://your-domain.com/api/books?page=1&limit=10"
```

**Notes:**
- Only returns books that have at least one external ID (GoodReads, OpenLibrary, or Hardcover)
- Results are ordered by creation date (newest first)
- Includes full author and edition information

### Authors

#### List Authors
```http
GET /api/authors
```

**Parameters:**
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Items per page (default: 50, max: 100)
- `letter` (string, optional): Filter by first letter (case insensitive)

**Response:**
```typescript
type AuthorsResult = AuthorsResultSuccess | AuthorsResultError;

type AuthorsResultSuccess = {
    status: 'ok';
    authors: Array<{
        id: string;
        name: string;
        bookCount: number;
    }>;
    total: number;
    hasMore: boolean;
};

type AuthorsResultError = {
    status: 'error';
    message: string;
};
```

**Example:**
```bash
# List all authors
curl "https://your-domain.com/api/authors"

# Filter by letter
curl "https://your-domain.com/api/authors?letter=A"
```

#### Get Author by ID
```http
GET /api/authors/{id}
```

**Parameters:**
- `id` (string, required): Author ID

**Response:**
```typescript
type AuthorResult = AuthorResultSuccess | AuthorResultError;

type AuthorResultSuccess = {
    status: 'ok';
    author: {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        bookCount: number;
    };
    books: ApiBook[];
};

type AuthorResultError = {
    status: 'error';
    message: string;
};
```

**Example:**
```bash
curl "https://your-domain.com/api/authors/author-id-123"
```

### Missing External IDs

#### Get Missing External IDs
```http
GET /api/missing/{service}
```

**Parameters:**
- `service` (string, required): External service type
  - `hardcover`: Books missing Hardcover IDs (uses queue system)
  - `goodreads`: Books missing GoodReads IDs
  - `openlibrary`: Books missing OpenLibrary IDs
- `skip` (number, optional): Number of records to skip (for goodreads/openlibrary only)
- `previousProcessingId` (string, optional): For hardcover queue continuation

**Response:**
```typescript
type MissingResponse = MissingError | MissingSuccess;

type MissingSuccess = {
    status: 'ok';
    missing: MissingInfo[];
    total: number;
    processingId?: string;      // For hardcover queue tracking
    remainingUnclaimed?: number; // For hardcover queue monitoring
};

type MissingError = {
    status: 'error';
    message: string;
};
```

**Example:**
```bash
# Get books missing Hardcover IDs (uses queue system)
curl "https://your-domain.com/api/missing/hardcover"

# Get books missing GoodReads IDs (legacy system)
curl "https://your-domain.com/api/missing/goodreads?skip=100"
```

#### Update External IDs
```http
POST /api/missing/{service}
```

**Authentication:** Required (`x-secret: MISSING_POST_SECRET`)

**Body:**
```typescript
type MissingPostBody = {
    edition: {
        id: string;
        hardcoverId?: number;
        openLibraryId?: string;
        goodReadsId?: string;
    };
    book: {
        id: string;
        hardcoverId?: number | null;
        openLibraryId?: string | null;
        goodReadsId?: string | null;
        hardcoverSlug?: string | null;
    };
    authors: Array<{
        id: string;
        hardcoverId?: number | null;
        openLibraryId?: string | null;
        goodReadsId?: string | null;
        hardcoverSlug?: string | null;
    }>;
};
```

**Response:**
```typescript
type MissingPostResponse = {
    status: 'ok' | 'error';
    message?: string;
};
```

**Example:**
```bash
curl -X POST "https://your-domain.com/api/missing/hardcover" \
  -H "x-secret: your-missing-post-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "edition": {"id": "edition-id", "hardcoverId": 123},
    "book": {"id": "book-id", "hardcoverId": 123},
    "authors": [{"id": "author-id", "hardcoverId": 456}]
  }'
```

## Administrative API

All admin endpoints require authentication via `x-secret` header with `ADMIN_SECRET`.

### Duplicate Detection

#### List Duplicate Pairs
```http
GET /api/admin/duplicates
```

**Parameters:**
- `status` (string, optional): Filter by status
  - `pending` (default): Awaiting review
  - `reviewed`: Reviewed but not acted upon
  - `merged`: Authors have been merged
  - `dismissed`: Marked as not duplicates
- `minScore` (number, optional): Minimum similarity score (default: 70)
- `confidence` (string, optional): Filter by confidence level (`exact`, `high`, `medium`, `low`)
- `limit` (number, optional): Items per page (default: 50)
- `offset` (number, optional): Number of records to skip (default: 0)

**Response:**
```json
{
  "duplicates": [
    {
      "id": "similarity-record-id",
      "author1Id": "author-1-id",
      "author1Name": "Author Name 1",
      "author2Id": "author-2-id",
      "author2Name": "Author Name 2",
      "score": 95.5,
      "confidence": "high",
      "status": "pending",
      "matchReasons": {
        "exactMatch": true,
        "fuzzyMatch": 0.95
      },
      "author1": {
        "id": "author-1-id",
        "name": "Author Name 1",
        "books": [{"id": "book-id", "title": "Book Title"}]
      },
      "author2": {
        "id": "author-2-id",
        "name": "Author Name 2",
        "books": [{"id": "book-id-2", "title": "Another Book"}]
      },
      "merge": null
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

#### Update Duplicate Status
```http
PATCH /api/admin/duplicates
```

**Body:**
```json
{
  "id": "similarity-record-id",
  "status": "reviewed|dismissed|merged",
  "reviewedBy": "admin-user-id",
  "notes": "Optional review notes"
}
```

#### Run Detection Scan
```http
POST /api/admin/duplicates/detect
```

**Body:**
```json
{
  "scanType": "exact|flipped|fuzzy|full",
  "minScore": 70,
  "limit": 100,
  "offset": 0
}
```

**Response:**
```json
{
  "status": "success",
  "scanRunId": "scan-run-id",
  "duplicatesFound": 25,
  "processingTimeMs": 15000,
  "duplicates": ["... first 10 results for preview"]
}
```

**Scan Types:**
- `exact`: Find authors with identical normalized names
- `flipped`: Find "First Last" vs "Last, First" variations
- `fuzzy`: Comprehensive similarity analysis with scoring
- `full`: Alias for fuzzy scan

#### Get Scan Status
```http
GET /api/admin/duplicates/detect?scanRunId={id}
```

**Response:**
```json
{
  "id": "scan-run-id",
  "scanType": "fuzzy",
  "status": "completed",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "completedAt": "2023-01-01T00:00:15.000Z",
  "totalAuthors": 10000,
  "duplicatesFound": 25,
  "processingTimeMs": 15000
}
```

#### List Recent Scans
```http
GET /api/admin/duplicates/detect
```

Returns the 10 most recent scan runs.

#### Merge Authors
```http
POST /api/admin/duplicates/merge
```

**Body:**
```json
{
  "authorIds": ["author-1", "author-2", "author-3"],
  "targetAuthorId": "author-1",
  "mergedBy": "admin-user-id",
  "mergeReason": "Duplicate detection",
  "similarityIds": ["similarity-record-1", "similarity-record-2"]
}
```

**Response:**
```json
{
  "status": "success",
  "mergeId": "merge-record-id",
  "targetAuthor": {
    "id": "author-1",
    "name": "Target Author Name"
  },
  "booksReassigned": 15,
  "authorsDeleted": 2
}
```

**Process:**
1. Reassigns all books from merged authors to target author
2. Deletes the merged authors
3. Updates similarity records to "merged" status
4. Creates merge audit record

#### Get Merge History
```http
GET /api/admin/duplicates/merge?limit={limit}&offset={offset}
```

**Response:**
```json
{
  "merges": [
    {
      "id": "merge-record-id",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "targetAuthorId": "author-1",
      "targetAuthorName": "Target Author",
      "mergedAuthorIds": ["author-2", "author-3"],
      "mergedAuthorNames": ["Merged Author 1", "Merged Author 2"],
      "booksReassigned": 15,
      "mergedBy": "admin-user-id",
      "similarities": [
        {"id": "sim-1", "score": 95, "confidence": "high"}
      ]
    }
  ],
  "total": 50,
  "limit": 50,
  "offset": 0
}
```

#### Get Statistics
```http
GET /api/admin/duplicates/stats
```

**Response:**
```json
{
  "overview": {
    "totalAuthors": 10000,
    "totalDuplicates": 150,
    "totalMerges": 25,
    "totalBooksReassigned": 500,
    "estimatedDuplicateAuthors": 275,
    "duplicatePercentage": "2.75"
  },
  "status": {
    "pending": 100,
    "reviewed": 20,
    "merged": 25,
    "dismissed": 5
  },
  "confidence": {
    "exact": 10,
    "high": 50,
    "medium": 70,
    "low": 20
  },
  "scoreDistribution": [
    {"min": 95, "max": 100, "label": "95-100%", "count": 15},
    {"min": 90, "max": 94, "label": "90-94%", "count": 25}
  ],
  "recentScans": [
    {
      "id": "scan-1",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "scanType": "fuzzy",
      "status": "completed",
      "duplicatesFound": 25
    }
  ],
  "recentMerges": [
    {
      "id": "merge-1",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "targetAuthorName": "Target Author",
      "mergedAuthorNames": ["Merged Author"],
      "booksReassigned": 15
    }
  ]
}
```

### Hardcover Queue Management

#### Reset Old Claims
```http
POST /api/admin/hardcover-queue/reset?olderThan={minutes}
```

**Authentication:** Required (`x-secret: ADMIN_SECRET`)

**Parameters:**
- `olderThan` (number, optional): Release claims older than X minutes (default: 30)

**Response:**
```json
{
  "status": "ok",
  "resetCount": 15,
  "message": "Released 15 claims older than 30 minutes"
}
```

#### Cleanup Completed Books
```http
POST /api/admin/hardcover-queue/cleanup
```

**Authentication:** Required (`x-secret: ADMIN_SECRET`)

**Response:**
```json
{
  "status": "ok",
  "removedCount": 42,
  "message": "Removed 42 completed books from queue"
}
```

**Notes:**
- Removes queue entries for books that already have hardcover IDs
- Helps maintain queue performance

#### Release Specific Claim
```http
DELETE /api/admin/hardcover-queue/claims/{processingId}
```

**Authentication:** Required (`x-secret: ADMIN_SECRET`)

**Parameters:**
- `processingId` (string, required): Processing ID to release

**Response:**
```json
{
  "status": "ok",
  "resetCount": 1,
  "message": "Released 1 claims with processingId: abc-123"
}
```

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
    hardcoverSlug?: string | null;
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
    hardcoverSlug?: string | null;
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

### Admin Types

#### MissingInfo
```typescript
type MissingInfo = {
    editionId: string;
    bookId: string;
    title: string;
    isbn13: string;
    authors: AuthorInfo[];
    bookGoodReadsId?: string | null;
    bookOpenLibraryId?: string | null;
    bookHardcoverId?: number | null;
    bookHardcoverSlug?: string | null;
};

type AuthorInfo = {
    id: string;
    name: string;
    hardcoverId?: number | null;
    hardcoverSlug?: string | null;
    openLibraryId?: string | null;
    goodReadsId?: string | null;
};
```

#### Duplicate Detection Types
```typescript
type AuthorSimilarity = {
    id: string;
    author1Id: string;
    author1Name: string;
    author2Id: string;
    author2Name: string;
    score: number;
    confidence: 'exact' | 'high' | 'medium' | 'low';
    status: 'pending' | 'reviewed' | 'merged' | 'dismissed';
    matchReasons: {
        exactMatch?: boolean;
        nameFlipped?: boolean;
        normalizedMatch?: boolean;
        fuzzyMatch?: number;
        phoneticMatch?: boolean;
        initialsMatch?: boolean;
        missingMiddle?: boolean;
        sharedExternalIds?: string[];
    };
    createdAt: Date;
    reviewedAt?: Date | null;
    reviewedBy?: string | null;
    notes?: string | null;
};

type DuplicateScanRun = {
    id: string;
    scanType: 'exact' | 'flipped' | 'fuzzy' | 'full';
    status: 'running' | 'completed' | 'failed';
    minScore?: number;
    createdAt: Date;
    completedAt?: Date | null;
    totalAuthors?: number | null;
    duplicatesFound?: number | null;
    processingTimeMs?: number | null;
    error?: string | null;
};

type AuthorMerge = {
    id: string;
    mergedAuthorIds: string[];
    mergedAuthorNames: string[];
    targetAuthorId: string;
    targetAuthorName: string;
    mergedBy: string;
    mergeReason?: string | null;
    booksReassigned: number;
    createdAt: Date;
};
```

## Error Handling

### HTTP Status Codes
- `200 OK`: Successful request
- `400 Bad Request`: Invalid parameters or request body
- `401 Unauthorized`: Missing or invalid authentication
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

#### Public APIs
- `"Book not found"`: No book exists with the provided ID/ISBN
- `"Author not found"`: No author exists with the provided ID
- `"Invalid ISBN format"`: ISBN does not match required format
- `"Search query too short"`: Query parameter is empty or too brief
- `"No Query Specified"`: Missing required query parameter
- `"Invalid page parameter. Must be a positive integer."`: Pagination parameter validation
- `"Invalid limit parameter. Must be a positive integer."`: Limit parameter validation
- `"External service unavailable"`: ISBNdb API is unreachable

#### Admin APIs
- `"Unauthorized"`: Missing or invalid admin secret
- `"Invalid secret"`: Authentication failed
- `"Invalid request body"`: Malformed JSON or missing required fields
- `"Invalid status"`: Status value not in allowed list
- `"Some authors not found"`: One or more author IDs do not exist
- `"Target author must be one of the authors being merged"`: Merge validation error
- `"Invalid merge request: need at least 2 authors and a target"`: Insufficient authors for merge
- `"Failed to detect duplicates"`: Duplicate detection process error
- `"Failed to merge authors"`: Author merge process error

## Rate Limits

- **Public APIs**: No explicit rate limiting implemented
- **Admin APIs**: No explicit rate limiting, but require authentication
- **ISBNdb Integration**: Subject to ISBNdb API rate limits
- **Queue System**: Hardcover queue prevents overwhelming external APIs
- **Best Practice**: Implement client-side rate limiting for bulk operations

## Caching and Performance

### Search API
- Query results are cached in the database (`bookQuery` table)
- Cache key is the normalized, cleaned query string
- Improves response times for repeated searches

### Books and Authors APIs
- Results include full relationship data (authors, editions, images)
- Pagination implemented for large result sets
- Database queries optimized with proper indexing

### Admin APIs
- Duplicate detection runs can be long-running operations
- Results are stored and can be monitored via scan run IDs
- Statistics are computed on-demand but could benefit from caching

## Examples

### Public API Usage

#### Search for Books
```bash
# Search for Harry Potter books
curl "https://your-domain.com/api/search?q=harry%20potter"

# Search by author
curl "https://your-domain.com/api/search?q=j.k.%20rowling"
```

#### Get Book Information
```bash
# Get book by ID
curl "https://your-domain.com/api/book-json/clb123example"

# Get book by ISBN
curl "https://your-domain.com/api/isbn-json/9780439064866"
```

#### Browse Books and Authors
```bash
# List recent books
curl "https://your-domain.com/api/books?limit=20"

# List authors starting with 'A'
curl "https://your-domain.com/api/authors?letter=A&limit=50"

# Get specific author with their books
curl "https://your-domain.com/api/authors/author-id-123"
```

### Admin API Usage

#### Manage Missing External IDs
```bash
# Get books missing Hardcover IDs (queue system)
curl "https://your-domain.com/api/missing/hardcover"

# Update a book's external IDs
curl -X POST "https://your-domain.com/api/missing/hardcover" \
  -H "x-secret: your-missing-post-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "edition": {"id": "edition-id", "hardcoverId": 123},
    "book": {"id": "book-id", "hardcoverId": 123, "hardcoverSlug": "book-slug"},
    "authors": [{"id": "author-id", "hardcoverId": 456, "hardcoverSlug": "author-slug"}]
  }'
```

#### Duplicate Detection and Management
```bash
# Run a duplicate detection scan
curl -X POST "https://your-domain.com/api/admin/duplicates/detect" \
  -H "x-secret: your-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "scanType": "fuzzy",
    "minScore": 80,
    "limit": 100
  }'

# List pending duplicates
curl "https://your-domain.com/api/admin/duplicates?status=pending&minScore=85" \
  -H "x-secret: your-admin-secret"

# Merge duplicate authors
curl -X POST "https://your-domain.com/api/admin/duplicates/merge" \
  -H "x-secret: your-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "authorIds": ["author-1-id", "author-2-id"],
    "targetAuthorId": "author-1-id",
    "mergedBy": "admin-user",
    "mergeReason": "Exact name match",
    "similarityIds": ["similarity-record-id"]
  }'

# Get duplicate detection statistics
curl "https://your-domain.com/api/admin/duplicates/stats" \
  -H "x-secret: your-admin-secret"
```

#### Hardcover Queue Management
```bash
# Reset old claims (older than 60 minutes)
curl -X POST "https://your-domain.com/api/admin/hardcover-queue/reset?olderThan=60" \
  -H "x-secret: your-admin-secret"

# Cleanup completed books from queue
curl -X POST "https://your-domain.com/api/admin/hardcover-queue/cleanup" \
  -H "x-secret: your-admin-secret"

# Release a specific processing claim
curl -X DELETE "https://your-domain.com/api/admin/hardcover-queue/claims/processing-id-123" \
  -H "x-secret: your-admin-secret"
```

## SDK Usage

### JavaScript/TypeScript
```typescript
// Search for books
const searchResponse = await fetch('/api/search?q=dune');
const searchResult: SearchResult = await searchResponse.json();

if (searchResult.status === 'ok') {
    console.log(`Found ${searchResult.books.length} books`);
    searchResult.books.forEach(book => {
        console.log(`${book.title} by ${book.authors.map(a => a.name).join(', ')}`);
    });
}

// Get book by ISBN
const bookResponse = await fetch('/api/isbn-json/9780441172719');
const bookResult: IsbnResponse = await bookResponse.json();

if (bookResult.status === 'ok') {
    console.log(`Title: ${bookResult.book.title}`);
    console.log(`Authors: ${bookResult.book.authors.map(a => a.name).join(', ')}`);
}

// List books with pagination
async function fetchAllBooks() {
    let page = 1;
    let hasMore = true;
    const allBooks = [];

    while (hasMore) {
        const response = await fetch(`/api/books?page=${page}&limit=50`);
        const result = await response.json();

        if (result.status === 'ok') {
            allBooks.push(...result.books);
            hasMore = result.hasMore;
            page++;
        } else {
            break;
        }
    }

    return allBooks;
}

// Admin: Run duplicate detection
async function runDuplicateDetection(adminSecret: string) {
    const response = await fetch('/api/admin/duplicates/detect', {
        method: 'POST',
        headers: {
            'x-secret': adminSecret,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            scanType: 'fuzzy',
            minScore: 85,
            limit: 200
        })
    });

    const result = await response.json();
    if (result.status === 'success') {
        console.log(`Scan ${result.scanRunId} found ${result.duplicatesFound} duplicates in ${result.processingTimeMs}ms`);
        return result.scanRunId;
    } else {
        throw new Error(result.error);
    }
}
```

## Best Practices

### For API Consumers
- Always check the `status` field in responses before processing data
- Implement proper error handling for all HTTP status codes
- Use pagination parameters to avoid large response payloads
- Cache search results client-side to reduce server load
- For admin operations, implement retry logic with exponential backoff

### For Admin Operations
- Run duplicate detection during off-peak hours for large datasets
- Monitor scan run progress using the scan run ID endpoints
- Review duplicate pairs before merging to avoid data loss
- Use the queue system for Hardcover ID processing to respect API limits
- Regular cleanup of completed queue entries maintains performance

### Security Considerations
- Store admin secrets securely (environment variables, not code)
- Use HTTPS for all API communications, especially admin endpoints
- Rotate admin secrets periodically
- Monitor admin endpoint usage for suspicious activity
- Validate all input parameters to prevent injection attacks

## Cross-References

- **Project Structure**: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- **Database Schema**: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- **Development Guide**: [DEVELOPMENT.md](./DEVELOPMENT.md)