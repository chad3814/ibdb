-- Repairs the HardcoverQueue after the addBookToQueue foreign key bug.
--
-- Nothing had been enqueued since 2025-09-14 because the INSERT ran on a
-- different connection than the transaction that created the Book, so the FK
-- check failed with P2003 and the error was swallowed. That left 1,942,730
-- books missing from the queue. This backfills the most recent 90 days of
-- them; the older gap is deliberately left out.
--
-- Timing on a copy of production: roughly a minute, mostly the UPDATE and the
-- INSERT. HardcoverQueue is write-locked for that window.

-- Denormalized sort key, so claiming newest-first is one index scan instead of
-- a join back to Book across the queue's gaps. Joining measured 25s.
ALTER TABLE "HardcoverQueue" ADD COLUMN "bookCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing rows took the CURRENT_TIMESTAMP default above; give them the real
-- creation date of the book they point at.
UPDATE "HardcoverQueue" q
   SET "bookCreatedAt" = b."createdAt"
  FROM "Book" b
 WHERE b.id = q."bookId";

-- Enqueue books from the last 90 days that the bug skipped. Books that already
-- have a hardcoverId, or are already queued, are left alone.
INSERT INTO "HardcoverQueue" ("id", "bookId", "processingId", "claimTime", "bookCreatedAt")
SELECT gen_random_uuid(), b.id, NULL, NULL, b."createdAt"
  FROM "Book" b
 WHERE b."hardcoverId" IS NULL
   AND b."createdAt" > now() - interval '90 days'
   AND NOT EXISTS (SELECT 1 FROM "HardcoverQueue" q WHERE q."bookId" = b.id);

-- Books that already have a hardcoverId do not need enriching again.
DELETE FROM "HardcoverQueue" q
 USING "Book" b
 WHERE b.id = q."bookId"
   AND b."hardcoverId" IS NOT NULL;

-- Claims stranded by the worker that stopped on 2025-09-25 and never released
-- them. Without this they stay invisible to every future claim.
UPDATE "HardcoverQueue"
   SET "processingId" = NULL, "claimTime" = NULL
 WHERE "processingId" IS NOT NULL
   AND "claimTime" < now() - interval '1 day';

-- Built after the bulk writes so it is not maintained row by row.
--
-- Partial so it holds only claimable rows, and covering so the claim never
-- touches the heap. Without it the planner picks a parallel seq scan and a
-- top-N sort over ~1M rows: 179ms per claim versus 0.5ms with it.
CREATE INDEX "HardcoverQueue_claimable_idx"
    ON "HardcoverQueue" ("bookCreatedAt" DESC)
    INCLUDE ("bookId")
    WHERE "processingId" IS NULL;

-- The bulk load leaves the planner with stale statistics, which is enough on
-- its own to make it ignore the index above.
ANALYZE "HardcoverQueue";
