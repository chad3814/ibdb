#!/usr/bin/env npx tsx
/**
 * Re-asks ISBNdb about every ISBN recorded in IsbnMiss.
 *
 * Until the lookup moved to /book/{isbn}, every lookup that reached ISBNdb hit
 * the /books/ search endpoint, came back empty and was recorded as a miss --
 * so no row written before that fix can be trusted. A book ISBNdb does have is
 * saved (which also removes its miss); a genuine miss has its row refreshed.
 * Dry-run by default; --execute is required to spend requests.
 *
 * Spends from the same site-wide budget as visitors, under its own client key,
 * so the run is metered and stops when refused rather than eating the quota.
 * Its "isbndb miss" lines go to this terminal, not the log drain, so they are
 * missing from the drain's spend count: add the run's request total by hand.
 *
 * Usage:
 *   ISBNDB_KEY="$(op read op://mcp/isbndb/credential)" \
 *   DATABASE_URL="$(op read op://mcp/IBDb-Prod-DB/credential)" \
 *     npx tsx scripts/recheck-isbn-misses.ts [--execute]
 */

import { db } from '../src/server/db';
import { lookupByIsbn13 } from '../src/server/isbndb';
import { isbnLookupBudget } from '../src/server/searchRateLimit';
import { recheckMisses } from '../src/lib/isbnMissRecheck';

/** Reserved like GLOBAL_BUDGET_KEY; real client keys are 12 hex characters. */
const CLIENT_KEY = '__recheck__';
/** One request per second stays inside ISBNdb's per-second limit. */
const PER_REQUEST_MS = 1_000;

async function main(): Promise<void> {
  const execute = process.argv.slice(2).includes('--execute');
  console.log(`mode: ${execute ? 'EXECUTE (will spend ISBNdb requests)' : 'dry run'}`);

  const misses = await db.isbnMiss.findMany({
    orderBy: { updatedAt: 'asc' },
    select: { isbn13: true, updatedAt: true },
  });
  console.log(`${misses.length} recorded misses`);
  for (const { isbn13, updatedAt } of misses) {
    console.log(`  ${isbn13}  last missed ${updatedAt.toISOString()}`);
  }

  if (!execute) {
    console.log('dry run only. re-run with --execute to re-check them.');
    return;
  }

  const result = await recheckMisses(
    misses.map(m => m.isbn13),
    {
      lookup: async isbn13 => {
        const res = await lookupByIsbn13(isbn13, isbnLookupBudget(CLIENT_KEY, isbn13), { recheck: true });
        console.log(`  ${isbn13}: ${res.kind}`);
        return res.kind;
      },
      sleep: ms => new Promise(resolve => {
        setTimeout(resolve, ms);
      }),
    },
    PER_REQUEST_MS
  );

  console.log(`found ${result.found.length}: ${result.found.join(' ')}`);
  console.log(`still not found ${result.notFound.length}`);
  console.log(`failed ${result.failed.length}: ${result.failed.join(' ')}`);
  if (result.throttled) {
    console.log(`budget refused; ${result.skipped.length} not attempted. re-run later to finish.`);
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
