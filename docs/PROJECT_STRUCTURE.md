# IBDB Project Structure

## Overview

IBDB (Internet Book Database) is a Next.js application that serves as a book metadata aggregation service, providing both API endpoints and web interfaces for book data lookup via ISBN and search.

## Directory Structure

```
ibdb/
├── src/                    # Source code
│   ├── app/                # Next.js App Router pages and API routes
│   │   ├── book/           # Book detail pages
│   │   ├── book-json/      # Book JSON API endpoints
│   │   ├── isbn/           # ISBN lookup pages
│   │   ├── isbn-json/      # ISBN JSON API endpoints
│   │   ├── search/         # Search API endpoint
│   │   └── missing/        # Admin endpoints for external ID management
│   ├── server/             # Server-side utilities and database
│   │   ├── db.ts           # Database client and utilities
│   │   └── isbndb.ts       # ISBNdb API integration
│   ├── api.d.ts            # TypeScript API type definitions
│   └── apiConvert.ts       # Data conversion utilities
├── prisma/                 # Database schema and migrations
│   ├── schema.prisma       # Database schema definition
│   ├── migrations/         # Database migration history
│   └── client/             # Generated Prisma client
├── cli/                    # Command-line utilities
│   └── updateHardcoverIds.ts # CLI tool for Hardcover ID updates
├── types/                  # TypeScript type definitions
├── public/                 # Static assets
└── docs/                   # Project documentation
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