-- Serves the homepage listing in /api/books: the "has any external id" filter
-- ordered by createdAt DESC.
--
-- Without it both the count and the findMany fall back to a parallel seq scan
-- of every Book row (~2.5M, ~1.9GB): 676ms for the count and 2141ms for the
-- ordered page, on every homepage load. With it both are index scans at ~3ms,
-- for a 232kB index.
--
-- This is a PARTIAL index, which Prisma cannot express in schema.prisma, so it
-- is raw SQL here. A plain index on createdAt would not help while the matching
-- rows are the oldest ones: the scan would walk ~2.48M newer non-matching
-- entries before reaching the first match.
--
-- Deliberately not CONCURRENTLY: that cannot run inside a transaction block and
-- Prisma may wrap the migration in one. The build takes seconds on this table.
-- For a zero-lock rollout, create it CONCURRENTLY by hand first; the
-- IF NOT EXISTS then makes this migration a no-op.
CREATE INDEX IF NOT EXISTS "Book_hasExternalId_createdAt_idx"
    ON "Book" ("createdAt" DESC)
    WHERE ("goodReadsId" IS NOT NULL OR "openLibraryId" IS NOT NULL OR "hardcoverId" IS NOT NULL);
