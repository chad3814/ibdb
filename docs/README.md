# IBDB Documentation

## Overview

IBDB (Internet Book Database) is a Next.js-based book metadata aggregation service that provides both API endpoints and web interfaces for book data lookup via ISBN and search functionality.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local  # Configure your environment variables

# Set up database
npx prisma generate
npx prisma migrate dev

# Start development server
npm run dev
```

Visit `http://localhost:3000` to access the application.

## Documentation Structure

### 📋 Core Documentation
- **[Project Structure](./PROJECT_STRUCTURE.md)**: Complete overview of codebase organization, architecture, and key components
- **[API Reference](./API_REFERENCE.md)**: Comprehensive API documentation with endpoints, types, and examples
- **[Component Reference](./COMPONENTS.md)**: React component documentation with props, usage, and examples
- **[Database Schema](./DATABASE_SCHEMA.md)**: Detailed database design, relationships, and migration history
- **[Development Guide](./DEVELOPMENT.md)**: Development workflow, testing, and contribution guidelines
- **[Deployment Guide](./DEPLOYMENT.md)**: Production deployment instructions and configuration

### 🔗 Cross-Reference Map

```
Project Structure ←→ API Reference ←→ Database Schema
       ↓                    ↓                ↓
Development Guide ←→ Deployment Guide ←→ Security Guide
```

## Key Features

### 📚 Book Data Management
- **Multi-source aggregation**: ISBNdb API integration with local caching
- **Edition tracking**: Support for multiple editions per book
- **Author relationships**: Many-to-many author-book associations
- **Image handling**: Automatic cover image processing and metadata extraction

### 🔍 Search & Discovery  
- **Full-text search**: Title and author search with result caching
- **ISBN lookup**: Direct ISBN-13 based book retrieval
- **Query caching**: Database-backed search result caching for performance

### 🔌 External Integrations
- **ISBNdb**: Primary book data source with comprehensive metadata
- **OpenLibrary**: Open-source book database integration
- **Goodreads**: Social reading platform ID mapping
- **Hardcover**: Modern book platform integration

### 🛠 Developer Features
- **Type-safe APIs**: Comprehensive TypeScript coverage
- **RESTful design**: Consistent API patterns with error handling
- **Admin endpoints**: External ID management and data maintenance
- **CLI tools**: Command-line utilities for data management

## API Quick Reference

### Core Endpoints
```http
GET /search?q={query}           # Search books by title/author
GET /book-json/{id}             # Get book by internal ID
GET /isbn-json/{isbn13}         # Get book by ISBN-13
GET /book/{id}                  # HTML book detail page
GET /isbn/{isbn13}              # HTML ISBN lookup page
```

### Response Format
```typescript
// Success response
{
  status: 'ok',
  book: ApiBook | books: ApiBook[]
}

// Error response  
{
  status: 'error',
  message: string
}
```

## Architecture Highlights

### 🏗 System Design
- **Next.js App Router**: Modern React framework with server-side rendering
- **PostgreSQL + Prisma**: Type-safe database with migration support
- **Serverless Functions**: Vercel-optimized API endpoints
- **External API Integration**: ISBNdb with rate limiting and caching

### 📊 Data Model
```
Book (Work) ←→ Edition (Publication) → Image (Cover)
     ↕                    ↕
Author (Writer)    External Services (IDs)
```

### ⚡ Performance
- **Query caching**: Reduces external API calls
- **Database indexing**: Optimized search performance  
- **Static generation**: Pre-rendered pages for speed
- **Connection pooling**: Efficient database resource usage

## Contributing

### Development Workflow
1. **Setup**: Follow [Development Guide](./DEVELOPMENT.md) for local setup
2. **Database**: Use Prisma migrations for schema changes
3. **Testing**: Validate API endpoints and database queries
4. **Documentation**: Update relevant documentation for changes

### Code Standards
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code quality enforcement
- **Prisma**: Database schema as code
- **Next.js**: App Router patterns and best practices

## Deployment

### Quick Deploy to Vercel
1. Connect repository to Vercel
2. Set environment variables (DATABASE_URL, ISBNDB_API_KEY, SECRET)
3. Deploy automatically triggers migrations and build

See [Deployment Guide](./DEPLOYMENT.md) for detailed instructions.

## Support & Resources

### Getting Help
- **Issues**: Check existing GitHub issues or create new ones
- **Documentation**: Refer to specific documentation sections
- **API Testing**: Use provided curl examples and API reference

### External Resources
- **ISBNdb API**: [Documentation](https://isbndb.com/apidocs)
- **Prisma**: [Database toolkit documentation](https://www.prisma.io/docs)
- **Next.js**: [Framework documentation](https://nextjs.org/docs)

## License

MIT License - see LICENSE file for details.

---

## Documentation Last Updated
Generated by `/sc:index` on 2025-09-14

### Version Information
- **IBDB Version**: 0.1.0
- **Next.js**: 15.1.3
- **Prisma**: 6.1.0
- **React**: 19.0.0