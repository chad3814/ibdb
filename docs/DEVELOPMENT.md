# IBDB Development Guide

## Prerequisites

### System Requirements
- **Node.js**: 18.0.0 or higher
- **PostgreSQL**: 13.0 or higher
- **npm**: 8.0.0 or higher

### External Services
- **ISBNdb API Key**: Required for book data fetching
- **Database**: PostgreSQL instance (local or remote)

## Quick Start

### 1. Clone and Install
```bash
git clone <repository-url>
cd ibdb
npm install
```

### 2. Environment Setup
Create `.env.local` file:
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ibdb"

# ISBNdb API
ISBNDB_API_KEY="your_isbndb_api_key"

# Admin endpoints authentication
SECRET="your_admin_secret"
```

### 3. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed
```

### 4. Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Development Workflow

### Code Structure

#### App Router Organization
```
src/app/
├── (pages)/           # Route groups for organization
│   ├── book/         # Book detail pages
│   ├── isbn/         # ISBN lookup pages
│   └── search/       # Search functionality
├── (api)/            # API route groups
│   ├── book-json/    # Book JSON APIs
│   ├── isbn-json/    # ISBN JSON APIs
│   └── missing/      # Admin APIs
├── layout.tsx        # Root layout component
├── page.tsx          # Home page
└── globals.css       # Global styles
```

#### Server Components
- **Pages**: Server-side rendered with database queries
- **Layouts**: Font loading and global configuration
- **Error Boundaries**: Graceful error handling

#### Styling Convention
- **CSS Modules**: Component-scoped styles (`.module.css`)
- **Global Styles**: Application-wide styles in `globals.css`
- **Responsive Design**: Mobile-first approach

### Database Development

#### Schema Changes
1. **Edit Schema**: Modify `prisma/schema.prisma`
2. **Create Migration**: `npx prisma migrate dev --name migration_name`
3. **Update Types**: `npx prisma generate`
4. **Test Migration**: Verify changes work correctly

#### Database Queries
```typescript
// Use Prisma client from server/db.ts
import { db } from '~/server/db';

// Example query with relations
const book = await db.book.findUnique({
  where: { id: bookId },
  include: {
    authors: { include: { author: true } },
    editions: { include: { image: true } },
  }
});
```

#### Query Optimization
- **Include Relations**: Fetch related data in single query
- **Select Fields**: Limit returned fields for performance
- **Caching**: Use BookQuery system for search results

### API Development

#### Creating New Endpoints
1. **Route File**: Create `route.ts` in appropriate directory
2. **Type Definitions**: Add types to `api.d.ts`
3. **Response Format**: Follow existing error/success patterns
4. **Validation**: Validate input parameters

#### Example API Route
```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json({
        status: 'error',
        message: 'Query parameter required'
      }, { status: 400 });
    }

    const results = await db.book.findMany({
      where: { title: { contains: query, mode: 'insensitive' } }
    });

    return NextResponse.json({
      status: 'ok',
      data: results
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Internal server error'
    }, { status: 500 });
  }
}
```

### External Service Integration

#### ISBNdb API Integration
```typescript
// server/isbndb.ts
import { isbndb } from '~/server/isbndb';

// Fetch book data
const bookData = await isbndb.search(query);

// Handle rate limits and errors
if (bookData.error) {
  console.error('ISBNdb API error:', bookData.error);
  return null;
}
```

#### Adding New External Services
1. **Service Client**: Create client in `server/` directory
2. **Type Definitions**: Add service-specific types
3. **Database Fields**: Add external ID fields to schema
4. **Admin Endpoints**: Create management interfaces

### CLI Tools Development

#### Creating CLI Scripts
```typescript
// cli/example.ts
import { db } from '../src/server/db';

async function main() {
  // CLI logic here
  const books = await db.book.findMany();
  console.log(`Found ${books.length} books`);
}

main()
  .catch(console.error)
  .finally(() => process.exit());
```

#### Running CLI Tools
```bash
npx tsx cli/updateHardcoverIds.ts
```

## Testing Strategy

### Database Testing
```bash
# Test migrations
npx prisma migrate reset --skip-seed
npx prisma migrate dev
```

### API Testing
```bash
# Manual testing with curl
curl "http://localhost:3000/search?q=test"
curl "http://localhost:3000/isbn-json/9780123456789"
```

### Integration Testing
- Test complete workflows: search → book retrieval → display
- Verify external API integration works correctly
- Test error handling and edge cases

## Performance Optimization

### Database Performance
- **Connection Pooling**: Configured via DATABASE_URL
- **Query Optimization**: Use `explain` to analyze slow queries
- **Indexing**: Monitor and add indexes for common queries

### API Performance
- **Caching**: Implement query result caching
- **Rate Limiting**: Respect external API limits
- **Response Size**: Limit returned data size

### Frontend Performance
- **Static Generation**: Use `force-static` for cacheable routes
- **Image Optimization**: Next.js Image component with optimization
- **Code Splitting**: App Router automatic splitting

## Deployment

### Vercel Deployment
1. **Environment Variables**: Set in Vercel dashboard
2. **Build Configuration**: Uses `vercel-build` script
3. **Database Migration**: Automatic via build script
4. **Domain Configuration**: Set custom domain if needed

### Build Process
```bash
# Vercel build script
prisma generate && prisma migrate deploy && next build
```

### Environment Variables
```bash
# Production environment
DATABASE_URL="postgresql://..."
ISBNDB_API_KEY="..."
SECRET="..."
NEXTAUTH_URL="https://your-domain.com"
```

## Debugging

### Common Issues

#### Database Connection
```bash
# Test database connection
npx prisma studio

# Reset database
npx prisma migrate reset
```

#### ISBNdb API Issues
- Check API key validity
- Monitor rate limits
- Verify API response format

#### Build Issues
```bash
# Clear Next.js cache
rm -rf .next

# Regenerate Prisma client
npx prisma generate
```

### Logging
- Server-side logs in Vercel function logs
- Client-side errors in browser console
- Database query logs via Prisma logging

## Code Quality

### Linting
```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### TypeScript
- **Strict Mode**: Enabled for comprehensive type checking
- **Type Definitions**: All APIs have proper type definitions
- **Generated Types**: Prisma generates database types automatically

### Best Practices
- **Error Handling**: Always handle async operations properly
- **Type Safety**: Use TypeScript types for all data structures
- **Documentation**: Comment complex business logic
- **Security**: Never expose API keys or secrets in client code

## Cross-References

- **Project Structure**: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- **API Reference**: [API_REFERENCE.md](./API_REFERENCE.md)
- **Database Schema**: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- **Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)