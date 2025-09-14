# IBDB Project Structure

## Overview

IBDB (Internet Book Database) is a Next.js application that serves as a book metadata aggregation service, providing both API endpoints and web interfaces for book data lookup via ISBN and search.

## Directory Structure

```
ibdb/
├── src/                        # Source code
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   │   ├── admin/          # Admin endpoints
│   │   │   │   └── duplicates/ # Duplicate detection
│   │   │   ├── authors/        # Author endpoints
│   │   │   ├── books/          # Book endpoints
│   │   │   ├── search/         # Search endpoint
│   │   │   ├── book-json/      # Book JSON API
│   │   │   ├── isbn-json/      # ISBN JSON API
│   │   │   └── missing/        # External ID management
│   │   ├── admin/              # Admin UI pages
│   │   │   └── duplicates/     # Duplicate management UI
│   │   ├── author/[id]/        # Author profile pages
│   │   ├── book/[id]/          # Book detail pages
│   │   ├── isbn/[isbn]/        # ISBN lookup pages
│   │   ├── authors/            # Authors listing page
│   │   ├── books/              # Books search page
│   │   └── page.tsx            # Home page
│   ├── components/             # React components
│   │   ├── AuthorDetail.tsx    # Author profile
│   │   ├── AuthorsList.tsx     # Authors list
│   │   ├── BookCard.tsx        # Book card
│   │   ├── BookGrid.tsx        # Books grid
│   │   ├── SearchForm.tsx      # Search form
│   │   ├── SearchResults.tsx   # Search results
│   │   └── LoadingSpinner.tsx  # Loading indicator
│   ├── hooks/                  # Custom React hooks
│   │   ├── useInfiniteScroll.ts
│   │   └── useAuthorsInfiniteScroll.ts
│   ├── lib/                    # Utility libraries
│   │   ├── authorDuplicateDetector.ts
│   │   └── testDuplicateDetection.ts
│   ├── server/                 # Server utilities
│   │   ├── db.ts               # Database client
│   │   └── isbndb.ts           # ISBNdb API
│   ├── types/                  # TypeScript types
│   │   └── home.ts             # Home page types
│   ├── api.d.ts                # API type definitions
│   └── apiConvert.ts           # Data conversion
├── prisma/                     # Database
│   ├── schema.prisma           # Schema definition
│   ├── migrations/             # Migration history
│   └── client/                 # Generated client
├── public/                     # Static assets
└── docs/                       # Documentation
```

## Core Components

### Application Layer (`src/app/`)

- **Pages**: Server-rendered book detail and ISBN lookup pages
- **API Routes**: JSON endpoints for programmatic access
- **Layout**: Global application wrapper with font configuration

### Server Layer (`src/server/`)

- **Database Client**: Prisma-based PostgreSQL integration
- **External APIs**: ISBNdb service integration with rate limiting
- **Data Conversion**: Standardization between external and internal formats

### Database Layer (`prisma/`)

- **Schema**: Normalized relational model with external service integration
- **Migrations**: Version-controlled schema evolution
- **Generated Client**: Type-safe database access layer

### Utilities (`cli/`, `types/`)

- **CLI Tools**: Administrative scripts for data management
- **Type Definitions**: Comprehensive TypeScript coverage

## Key Features

### Multi-Source Data Aggregation
- **Primary Source**: ISBNdb API for comprehensive book metadata
- **External Links**: OpenLibrary, Goodreads, Hardcover integration
- **Image Processing**: Automatic cover image metadata extraction

### Performance Optimization
- **Query Caching**: Database-backed search result caching
- **Static Generation**: Pre-rendered pages for optimal performance
- **Connection Pooling**: Efficient database resource management

### Data Integrity
- **Normalized Schema**: Proper entity relationships with foreign key constraints
- **Unique Constraints**: Prevention of duplicate data across all entities
- **Transaction Safety**: Atomic operations for data consistency

## Cross-References

- **API Documentation**: See [API_REFERENCE.md](./API_REFERENCE.md)
- **Database Schema**: See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- **Deployment Guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Development Setup**: See [DEVELOPMENT.md](./DEVELOPMENT.md)