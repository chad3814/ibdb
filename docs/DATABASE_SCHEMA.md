# IBDB Database Schema

## Overview

The IBDB database uses PostgreSQL with Prisma ORM. The schema is designed around a normalized relational model that separates books, editions, authors, and images into distinct entities with proper relationships.

## Entity Relationship Diagram

```
Book ←→ BookAuthor ←→ Author
 ↓                      ↓
Edition               (External IDs)
 ↓
Image
 ↓
(External IDs)

BookQuery ←→ BookQueryResult ←→ Book
```

## Core Entities

### Book
The central entity representing a unique work, regardless of edition.

```sql
CREATE TABLE "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "longTitle" TEXT,
    "synopsis" TEXT,
    "isbn13" TEXT NOT NULL, -- @deprecated, use Edition.isbn13
    "publicationDate" TEXT, -- @deprecated, use Edition.publicationDate
    "publisher" TEXT, -- @deprecated, use Edition.publisher
    "binding" "Binding" NOT NULL DEFAULT 'Unknown', -- @deprecated, use Edition.binding
    "imageId" TEXT, -- @deprecated, use Edition.imageId
    "openLibraryId" TEXT UNIQUE,
    "goodReadsId" TEXT UNIQUE,
    "hardcoverId" INTEGER UNIQUE,
    CONSTRAINT "Book_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id")
);
```

**Indexes:**
- `Book_title_idx`: Text search optimization
- `Book_openLibraryId_key`: Unique constraint for external ID
- `Book_goodReadsId_key`: Unique constraint for external ID
- `Book_hardcoverId_key`: Unique constraint for external ID

### Edition
Represents specific publications of a book (different ISBNs, publishers, formats).

```sql
CREATE TABLE "Edition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isbn13" TEXT NOT NULL UNIQUE,
    "publicationDate" TEXT,
    "publisher" TEXT,
    "binding" "Binding" NOT NULL DEFAULT 'Unknown',
    "bookId" TEXT NOT NULL,
    "imageId" TEXT,
    "openLibraryId" TEXT UNIQUE,
    "goodReadsId" TEXT UNIQUE,
    "hardcoverId" INTEGER UNIQUE,
    "hardcoverSlug" TEXT UNIQUE,
    CONSTRAINT "Edition_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id"),
    CONSTRAINT "Edition_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id")
);
```

**Indexes:**
- `Edition_isbn13_key`: Unique constraint for ISBN lookups
- `Edition_bookId_idx`: Foreign key optimization
- External ID unique constraints

### Author
Author information with external service integration.

```sql
CREATE TABLE "Author" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL UNIQUE,
    "openLibraryId" TEXT UNIQUE,
    "goodReadsId" TEXT UNIQUE,
    "hardcoverId" INTEGER UNIQUE,
);
```

**Indexes:**
- `Author_name_key`: Unique constraint to prevent duplicate authors
- External ID unique constraints

### BookAuthor (Junction Table)
Many-to-many relationship between books and authors.

```sql
CREATE TABLE "BookAuthor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    CONSTRAINT "BookAuthor_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id"),
    CONSTRAINT "BookAuthor_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author" ("id"),
    UNIQUE ("bookId", "authorId")
);
```

### Image
Book cover images with metadata.

```sql
CREATE TABLE "Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL UNIQUE,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL
);
```

**Indexes:**
- `Image_url_key`: Unique constraint to prevent duplicate images

### Query Caching System

#### BookQuery
Caches search queries to reduce external API calls.

```sql
CREATE TABLE "BookQuery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "query" TEXT NOT NULL UNIQUE
);
```

#### BookQueryResult (Junction Table)
Links cached queries to their results.

```sql
CREATE TABLE "BookQueryResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queryId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    CONSTRAINT "BookQueryResult_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "BookQuery" ("id"),
    CONSTRAINT "BookQueryResult_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id"),
    UNIQUE ("queryId", "bookId")
);
```

## Enums

### Binding
```sql
CREATE TYPE "Binding" AS ENUM (
    'Unknown',
    'Hardcover', 
    'Paperback',
    'Ebook',
    'Audiobook'
);
```

## Relationships

### One-to-Many
- `Book` → `Edition`: A book can have multiple editions
- `Book` → `BookAuthor`: A book can have multiple authors
- `Author` → `BookAuthor`: An author can write multiple books
- `Image` → `Edition`: An image can be used by multiple editions
- `BookQuery` → `BookQueryResult`: A query can return multiple results

### Many-to-Many (via Junction Tables)
- `Book` ↔ `Author` via `BookAuthor`
- `BookQuery` ↔ `Book` via `BookQueryResult`

## Migration History

### Key Schema Evolution

#### Initial Schema (20250102205306)
- Basic `Book`, `Author`, `Image` entities
- Simple relationships without edition support

#### Edition System Migration (20250624170826)
- Introduction of `Edition` entity
- Migration from book-centric to edition-centric ISBN model
- Deprecated book-level ISBN/publisher/binding fields

#### External Service Integration (20250625013635)
- Addition of `openLibraryId`, `goodReadsId`, `hardcoverId` fields
- Unique constraints for external service IDs
- Hardcover slug support

#### Query Caching System (20250102232648)
- `BookQuery` and `BookQueryResult` tables
- Search result caching to reduce API calls

#### Data Cleanup Migrations
- Removal of deprecated `BookAuthorAlias` table
- Image URL unique constraints
- Author name uniqueness enforcement

## Indexes and Performance

### Primary Indexes
- All primary keys are automatically indexed
- Foreign key relationships have associated indexes

### Search Optimization
- `Book_title_idx`: Enables fast full-text search on book titles
- `Edition_isbn13_key`: Optimizes ISBN-based lookups
- `Author_name_key`: Speeds up author name searches

### Unique Constraints
- Prevent data duplication across all entities
- External service ID uniqueness ensures clean integration
- ISBN13 uniqueness prevents duplicate editions

## Data Integrity Rules

### Referential Integrity
- Foreign key constraints ensure valid relationships
- Cascade rules prevent orphaned records

### Business Logic Constraints
- Author names must be unique
- ISBN13 values must be unique across editions
- External service IDs must be unique when present
- Image URLs must be unique to prevent duplication

### Data Validation
- All timestamp fields auto-populate with current time
- Binding types restricted to enum values
- Required fields enforced at database level

## Backup and Maintenance

### Migration Strategy
- All schema changes tracked in `prisma/migrations/`
- Rollback capability through migration history
- Production deployment via `prisma migrate deploy`

### Performance Monitoring
- Query performance tracked via Prisma logging
- Index usage optimization opportunities identified
- Connection pooling prevents resource exhaustion

## Cross-References

- **API Documentation**: [API_REFERENCE.md](./API_REFERENCE.md)
- **Project Structure**: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- **Development Setup**: [DEVELOPMENT.md](./DEVELOPMENT.md)