# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack (http://localhost:3000)
npm run lint         # Run ESLint
npm run lint -- --fix # Auto-fix linting issues

# Database
npx prisma generate           # Regenerate Prisma client after schema changes
npx prisma migrate dev        # Create and apply migrations
npx prisma migrate dev --name <name>  # Create named migration
npx prisma studio             # Open database GUI

# CLI scripts (run with tsx)
npx tsx cli/updateHardcoverIds.ts
npx tsx scripts/populate-hardcover-queue.ts
```

## Architecture

### Data Model
- **Book** → has many **Editions** (each with unique ISBN-13) → has many **Authors**
- Books aggregate multiple editions (hardcover, paperback, ebook, audiobook)
- External IDs link to OpenLibrary, Goodreads, and Hardcover

### Key Layers
- `src/app/` - Next.js App Router (pages + API routes)
- `src/server/db.ts` - Prisma client singleton (import as `db`)
- `src/server/isbndb.ts` - ISBNdb API integration
- `src/lib/authorDuplicateDetector.ts` - Author deduplication logic
- `src/api.d.ts` - API response type definitions
- `src/apiConvert.ts` - Database → API type conversion

### API Patterns
- JSON endpoints use `.json` suffix: `/book/[id].json`, `/isbn/[isbn13].json`
- Search: `/api/search?q=` (preferred) or `/search?q=` (legacy)
- All API responses follow `{ status: 'ok', ... }` or `{ status: 'error', message: string }` pattern

### Path Alias
Use `@/*` for imports from `src/` (e.g., `import { db } from '@/server/db'`)

### Prisma Client
Generated to `prisma/client/` (not `node_modules`). After schema changes:
```bash
npx prisma generate
```

## Code Style

- TypeScript strict mode enabled
- ESLint with Next.js rules (`next/core-web-vitals`, `next/typescript`)
- Tailwind CSS for styling
- CSS Modules for component-scoped styles (`.module.css`)
- Server Components by default; use `'use client'` only when needed
