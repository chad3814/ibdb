# Automated Author Duplicate Merging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear the 4,407-pair author duplicate review queue by merging 2,538 name-variant clusters and dismissing 69 false positives, without manual review.

**Architecture:** Three pure decision modules (typography scoring, target selection, external-ID donation) hold all the judgement and carry all the unit tests. A script holds all the I/O: it reads planning data via Prisma, builds clusters as connected components over the pending similarity graph, and writes exclusively through the existing admin HTTP endpoints so server-side audit and status-cascade behaviour stays authoritative. Dry-run is the default.

**Tech Stack:** TypeScript strict, Next.js App Router, Prisma 6.1 (client generated to `prisma/client`), `node:test` + `node:assert/strict`, `tsx` for scripts.

**Spec:** `docs/dev-sessions/2026-09-16-1520-author-dedupe/spec.md`

## Global Constraints

- Never use the `any` TypeScript type. Never use `unknown` as a lazy escape.
- Indentation follows each file's neighbours: **4 spaces** in `src/lib/` and `tests/`, **2 spaces** in `scripts/` and `src/app/api/admin/duplicates/`. Always terminate statements with semicolons.
- Prefer async APIs over synchronous twins.
- Import Prisma as `import { db } from '@/server/db'` in `src/`, or `'../src/server/db'` in `scripts/`.
- Path alias `@/*` maps to `src/*`.
- **No** external-id column on `Author` is unique any more: `hardcoverId` lost its index in `20260916183000_author_hardcover_id_is_not_unique` and `goodReadsId`/`openLibraryId` in `20260916195500_author_external_ids_not_unique` (Task 0). Moving an external id between Author rows is therefore order-independent. `Edition`'s three equivalents are still unique and must stay that way.
- Credentials come from 1Password inline and must never be written to a file, echoed, or logged:
  `ADMIN_SECRET="$(op read op://mcp/IBDb-admin/credential)"` and
  `DATABASE_URL="$(op read op://mcp/IBDb-Prod-DB/credential)"` (unpooled endpoint).
- Production base URL for writes: `https://ibdb.dev`. Auth header: `x-secret: $ADMIN_SECRET`.
- Gates before any merge to `main`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- No writes to production until the dry-run TSV has been reviewed and approved.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` + `prisma/migrations/20260916195500_author_external_ids_not_unique/` | Modify/Create. Drop the unique indexes on `Author.goodReadsId` and `Author.openLibraryId`. |
| `src/lib/authorNameKey.ts` | Create. The cluster key: the detector's normalization, extracted so the two cannot drift. |
| `src/lib/authorNameQuality.ts` | Create. `scoreNameQuality(name)` — typography only, no I/O. |
| `src/lib/authorMergeTarget.ts` | Create. `pickMergeTarget(members)` — the 4-rung cascade. |
| `src/lib/authorMergeIds.ts` | Create. `donatedExternalIds(target, losers)` — gap-filling only. |
| `src/lib/authorDuplicateDetector.ts` | Modify. Delegate its private normalizer to `authorNameKey`. |
| `src/app/api/admin/duplicates/merge/route.ts` | Modify. Donate external IDs after deleting losers. |
| `scripts/merge-duplicate-authors.ts` | Create. Read, cluster, plan, dry-run or execute. |
| `tests/authorNameKey.test.ts` | Create. |
| `tests/authorNameQuality.test.ts` | Create. |
| `tests/authorMergeTarget.test.ts` | Create. |
| `tests/authorMergeIds.test.ts` | Create. |

---

## Task 0: Drop the remaining unique indexes on Author external ids

**Status: already applied on this branch.** Schema edited, migration written, and
verified on Neon branch `br-little-firefly-a5cty27d`. Gates still to run in Task 7.

**Files:**
- Modify: `prisma/schema.prisma` (the `Author` model's `openLibraryId` and `goodReadsId`)
- Create: `prisma/migrations/20260916195500_author_external_ids_not_unique/migration.sql`

**Interfaces:** none. Schema only.

**Why:** the same cardinality argument as `hardcoverId`. An Author row is one
name string, so several rows are one person and would compete for a single
external id. Neither column has ever held a value -- 0 of 1,006,224 rows,
and unpopulated on `Book` and `Edition` too -- so these indexes never caught a
duplicate. What they did do was force the external-id donation in Task 5 to be
sequenced after the row deletes. Dropping them removes that constraint.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, replace the two `@unique` fields on `Author`:

```prisma
  /// Not unique, for the same reason hardcoverId is not: an Author row is one
  /// name string, so several rows are the same person and would compete for
  /// one external id. Both columns are also entirely unpopulated -- 0 of
  /// 1,006,224 rows -- so the indexes only ever constrained merges.
  openLibraryId String?
  goodReadsId   String?
```

- [ ] **Step 2: Write the migration**

Create `prisma/migrations/20260916195500_author_external_ids_not_unique/migration.sql`
with a comment block explaining the cardinality argument and the zero-population
evidence, then:

```sql
-- DropIndex
DROP INDEX IF EXISTS "Author_goodReadsId_key";

-- DropIndex
DROP INDEX IF EXISTS "Author_openLibraryId_key";
```

Both are plain unique indexes with no backing constraint, verified via
`pg_constraint`, so `DROP INDEX` is correct rather than
`ALTER TABLE ... DROP CONSTRAINT`.

- [ ] **Step 3: Regenerate the client**

Run: `./node_modules/.bin/prisma generate`
Expected: `Generated Prisma Client`. Use the local binary, not `npx prisma` --
`npx` resolves a newer major from the registry that has no `generate` command.

- [ ] **Step 4: Verify on a Neon branch**

Create a branch of project `twilight-river-29437197`, then confirm the
constraint bites before and not after:

```sql
-- pre-migration: expect "duplicate key value violates unique constraint"
UPDATE "Author" SET "goodReadsId" = 'gr-test-1'
 WHERE id IN ('c2fe3fb3-da21-4bb6-acc1-252ffbe91732','c4d88649-1c01-4384-8636-87f327c31bbb');

DROP INDEX IF EXISTS "Author_goodReadsId_key";
DROP INDEX IF EXISTS "Author_openLibraryId_key";

-- post-migration: expect success, both rows sharing the value
UPDATE "Author" SET "goodReadsId" = 'gr-test-1', "openLibraryId" = 'ol-test-1'
 WHERE id IN ('c2fe3fb3-da21-4bb6-acc1-252ffbe91732','c4d88649-1c01-4384-8636-87f327c31bbb');
```

Run the two `DROP INDEX` statements one per call; Neon's SQL endpoint rejects
multiple commands in one prepared statement. Delete the branch afterwards with
Chad's approval.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260916195500_author_external_ids_not_unique
git commit -m "drop the unique indexes on Author.goodReadsId and openLibraryId"
```

---

## Task 1: Cluster key extracted from the detector

**Files:**
- Create: `src/lib/authorNameKey.ts`
- Create: `tests/authorNameKey.test.ts`
- Modify: `src/lib/authorDuplicateDetector.ts:29-34` (the private `normalizeAuthorName`) and `:42-50` (`flipName`)

**Interfaces:**
- Consumes: nothing.
- Produces: `authorNameKey(name: string): string` and `flipLastnameFirst(name: string): string`.

**Why this exists:** the script asserts that every cluster shares one normalized name, and that assertion is only meaningful if it reproduces exactly what the detector meant by `exactMatch`. Copying the normalizer would let the two drift silently.

Note the normalizer **collapses whitespace to single spaces rather than removing it**. Removing spaces entirely would group `Jo Ann Smith` with `Joann Smith`, which the detector never matched.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/authorNameKey.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authorNameKey, flipLastnameFirst } from '../src/lib/authorNameKey';

describe('flipLastnameFirst', () => {
    it('flips a two-part comma name', () => {
        assert.equal(flipLastnameFirst('McCammon, Robert'), 'Robert McCammon');
    });

    it('leaves a name without a comma alone', () => {
        assert.equal(flipLastnameFirst('Robert McCammon'), 'Robert McCammon');
    });

    it('leaves a name with more than one comma alone', () => {
        // Three parts is not a Last, First name, and guessing would corrupt it.
        assert.equal(flipLastnameFirst('Smith, John, Jr'), 'Smith, John, Jr');
    });
});

describe('authorNameKey', () => {
    it('ignores case, punctuation and the comma flip', () => {
        assert.equal(authorNameKey('McCammon, Robert'), 'robert mccammon');
        assert.equal(authorNameKey('Robert McCammon'), 'robert mccammon');
        assert.equal(authorNameKey('ROBERT MCCAMMON'), 'robert mccammon');
    });

    it('collapses doubled whitespace but keeps word boundaries', () => {
        assert.equal(authorNameKey('Stephen  King'), 'stephen king');
        // Must NOT equal 'stephenking' -- removing spaces would group
        // 'Jo Ann Smith' with 'Joann Smith', which the detector never matched.
        assert.notEqual(authorNameKey('Jo Ann Smith'), authorNameKey('Joann Smith'));
    });

    it('treats credential casing as identical', () => {
        assert.equal(authorNameKey('John J. Ratey MD'), authorNameKey('John J. Ratey Md'));
    });

    it('returns empty for a name with no alphanumerics', () => {
        // These are the degenerate rows the queue reports as exact matches.
        assert.equal(authorNameKey('&'), '');
        assert.equal(authorNameKey(' -'), '');
        assert.equal(authorNameKey('""'), '');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/chad/Projects/ibdb/worktrees/author-dedupe && npx tsx --test tests/authorNameKey.test.ts`
Expected: FAIL — cannot find module `../src/lib/authorNameKey`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/authorNameKey.ts

/**
 * The normalized form two author names must share to be the same name.
 *
 * Lifted out of AuthorDuplicateDetector, which used a private copy, so the
 * merge script's cluster assertion cannot drift from what the detector
 * actually meant by `exactMatch`.
 */

/** Whether a name looks like "Last, First". */
function isLastnameFirst(name: string): boolean {
    return name.includes(',');
}

/**
 * Turns "Last, First" into "First Last".
 *
 * Only a name with exactly two comma-separated parts is flipped. "Smith, John,
 * Jr" has three, and guessing which part is the surname would corrupt it.
 */
export function flipLastnameFirst(name: string): string {
    if (!isLastnameFirst(name)) {
        return name;
    }

    const parts = name.split(',').map(p => p.trim());
    if (parts.length === 2) {
        return `${parts[1]} ${parts[0]}`;
    }
    return name;
}

/**
 * Whitespace is collapsed, not removed. Removing it would make
 * "Jo Ann Smith" and "Joann Smith" the same key, which the detector never
 * treated as a match -- clustering on that would merge two different people.
 */
export function authorNameKey(name: string): string {
    return flipLastnameFirst(name)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/authorNameKey.test.ts`
Expected: PASS, 7 tests (3 for flipLastnameFirst, 4 for authorNameKey).

- [ ] **Step 5: Point the detector at the shared function**

In `src/lib/authorDuplicateDetector.ts`, add to the imports at the top:

```typescript
import { authorNameKey, flipLastnameFirst } from './authorNameKey';
```

Replace the private `normalizeAuthorName` method body and the private `flipName` method body so both delegate. Keep the methods themselves — they have internal callers:

```typescript
    // Normalize author name for comparison
    private normalizeAuthorName(name: string): string {
        // Shared with scripts/merge-duplicate-authors.ts so the merge script's
        // cluster assertion cannot drift from exactMatch.
        return authorNameKey(name);
    }

    // Flip "Last, First" to "First Last"
    private flipName(name: string): string {
        return flipLastnameFirst(name);
    }
```

Note `normalizeAuthorName` previously did NOT flip, while `authorNameKey` does. Its only caller is `parseAuthorName`, which already calls it on an
 explicitly flipped string (`normalized = this.normalizeAuthorName(flipped)`) — flipping an already-flipped name is a no-op because the comma is gone. Verify with the full suite in the next step.

- [ ] **Step 6: Run the whole suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, 104 pre-existing tests plus 7 new ones, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/authorNameKey.ts tests/authorNameKey.test.ts src/lib/authorDuplicateDetector.ts
git commit -m "extract the author name key the detector compares on"
```

---

## Task 2: Typography scoring

**Files:**
- Create: `src/lib/authorNameQuality.ts`
- Create: `tests/authorNameQuality.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `scoreNameQuality(name: string): number`. Higher is better. Scores are only ever compared against each other, never against a threshold.

**Weights** (from the spec, plus one addition flagged for review — the Celtic-prefix rule, which is what decides `Robert McCammon` over `Robert Mccammon`):

| Signal | Delta |
| --- | --- |
| Every alphabetic token starts uppercase | +2 |
| Each credential token in canonical form (`MD`, `PhD`, `Jr`, `III`, …) | +2 |
| Celtic/Gaelic prefix followed by a capital (`McCammon`, `O'Brien`, `MacLeod`) | +1 |
| Initials carry periods (`J. J.` over `J J`) | +1 |
| ALL CAPS | −3 |
| all lowercase | −3 |
| Doubled internal whitespace | −1 |
| Trailing `, ; : & -` | −1 |

A trailing period is deliberately **not** penalized: `Tolkien, J.R.R.` legitimately ends in one.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/authorNameQuality.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreNameQuality } from '../src/lib/authorNameQuality';

/** The comparison the score exists to make. */
function better(a: string, b: string): void {
    assert.ok(
        scoreNameQuality(a) > scoreNameQuality(b),
        `expected "${a}" (${scoreNameQuality(a)}) to beat "${b}" (${scoreNameQuality(b)})`
    );
}

describe('scoreNameQuality', () => {
    it('prefers a canonical credential over a title-cased one', () => {
        // The case Chad called by hand: MD is Medical Doctor, not a word.
        better('John J. Ratey MD', 'John J. Ratey Md');
    });

    it('prefers canonical forms of the other credentials', () => {
        better('Jane Doe PhD', 'Jane Doe Phd');
        better('Sammy Davis Jr', 'Sammy Davis JR');
        better('Henry Ford III', 'Henry Ford Iii');
    });

    it('penalizes ALL CAPS and all lowercase', () => {
        better('Robert McCammon', 'ROBERT MCCAMMON');
        better('Robert McCammon', 'robert mccammon');
    });

    it('prefers a capital after a Celtic prefix', () => {
        better('Robert McCammon', 'Robert Mccammon');
        better('Anne O\'Brien', 'Anne O\'brien');
        better('Shirley MacLaine', 'Shirley Maclaine');
    });

    it('prefers initials with periods', () => {
        better('J. R. R. Tolkien', 'J R R Tolkien');
    });

    it('penalizes doubled whitespace', () => {
        better('Stephen King', 'Stephen  King');
    });

    it('penalizes a trailing separator but not a trailing period', () => {
        better('Donna Leon', 'Donna Leon,');
        better('Donna Leon', 'Donna Leon &');
        assert.equal(scoreNameQuality('Tolkien J.R.R.'), scoreNameQuality('Tolkien J.R.R'));
    });

    it('is deterministic and pure', () => {
        assert.equal(scoreNameQuality('John J. Ratey MD'), scoreNameQuality('John J. Ratey MD'));
    });

    it('handles a name with no letters without throwing', () => {
        assert.equal(typeof scoreNameQuality('&'), 'number');
        assert.equal(typeof scoreNameQuality(''), 'number');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/authorNameQuality.test.ts`
Expected: FAIL — cannot find module `../src/lib/authorNameQuality`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/authorNameQuality.ts

/**
 * Scores how well an author name is typed, so a merge can keep the
 * best-formatted spelling of a name.
 *
 * Only meaningful as a comparison between variants of the SAME name: every
 * pair this is used on is character-identical apart from case, punctuation and
 * whitespace, so there is no information to weigh -- only presentation.
 * Never compare the score against a threshold.
 */

/** Credentials and generational suffixes whose canonical form is not Title Case. */
const CANONICAL_SUFFIXES = new Map<string, string>([
    ['md', 'MD'],
    ['phd', 'PhD'],
    ['dds', 'DDS'],
    ['dvm', 'DVM'],
    ['rn', 'RN'],
    ['mba', 'MBA'],
    ['msw', 'MSW'],
    ['jd', 'JD'],
    ['jr', 'Jr'],
    ['sr', 'Sr'],
    ['ii', 'II'],
    ['iii', 'III'],
    ['iv', 'IV'],
]);

/** Surname prefixes that take an internal capital. */
const CELTIC_PREFIX = /\b(?:Mc|Mac|O'|D')([A-Z])/u;
const CELTIC_PREFIX_LOWER = /\b(?:Mc|Mac|O'|D')([a-z])/u;

function lettersOnly(name: string): string {
    return name.replace(/[^a-zA-Z]/gu, '');
}

/** Alphabetic tokens, stripped of surrounding punctuation. */
function alphaTokens(name: string): string[] {
    return name
        .split(/\s+/u)
        .map(t => t.replace(/[^a-zA-Z']/gu, ''))
        .filter(t => t.length > 0);
}

export function scoreNameQuality(name: string): number {
    let score = 0;
    const letters = lettersOnly(name);
    const tokens = alphaTokens(name);

    if (letters.length > 1) {
        if (letters === letters.toUpperCase()) {
            score -= 3;
        }
        if (letters === letters.toLowerCase()) {
            score -= 3;
        }
    }

    // Every alphabetic token starting with a capital. Deliberately does not
    // require the remainder to be lowercase: McCammon and O'Brien are correct.
    if (tokens.length > 0 && tokens.every(t => t[0] === t[0].toUpperCase())) {
        score += 2;
    }

    for (const token of tokens) {
        const canonical = CANONICAL_SUFFIXES.get(token.toLowerCase());
        if (canonical && token === canonical) {
            score += 2;
        }
    }

    if (CELTIC_PREFIX.test(name)) {
        score += 1;
    } else if (CELTIC_PREFIX_LOWER.test(name)) {
        score -= 1;
    }

    // Initials, i.e. single-letter tokens. Periods make them read as initials
    // rather than as a mangled name.
    const initials = name.split(/\s+/u).filter(t => /^[A-Za-z]\.?$/u.test(t));
    if (initials.length > 0 && initials.every(t => t.endsWith('.'))) {
        score += 1;
    }

    if (/\S\s{2,}\S/u.test(name)) {
        score -= 1;
    }

    // A trailing period is fine -- "Tolkien, J.R.R." ends in one legitimately.
    if (/[,;:&-]\s*$/u.test(name.trim())) {
        score -= 1;
    }

    return score;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/authorNameQuality.test.ts`
Expected: PASS, 9 tests. If the `J.R.R.` equality case fails, it is because the multi-letter `J.R.R.` token is not matched by the single-initial regex — that is intended; both spellings score the same and the case asserts exactly that.

- [ ] **Step 5: Commit**

```bash
git add src/lib/authorNameQuality.ts tests/authorNameQuality.test.ts
git commit -m "score author name typography for merge target selection"
```

---

## Task 3: External ID donation

**Files:**
- Create: `src/lib/authorMergeIds.ts`
- Create: `tests/authorMergeIds.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ExternalIdCarrier = { id: string; hardcoverId: number|null; hardcoverSlug: string|null; goodReadsId: string|null; openLibraryId: string|null }`
  - `type DonatedIds = { hardcoverId?: number; hardcoverSlug?: string|null; goodReadsId?: string; openLibraryId?: string }`
  - `donatedExternalIds(target: ExternalIdCarrier, losers: ExternalIdCarrier[]): DonatedIds`

**Rules:** fill only gaps, never overwrite a value the survivor already has. `hardcoverSlug` travels with `hardcoverId` and is never donated on its own. With several donors, the lowest `id` wins so the result is deterministic.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/authorMergeIds.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { donatedExternalIds, type ExternalIdCarrier } from '../src/lib/authorMergeIds';

const bare = (id: string): ExternalIdCarrier => ({
    id,
    hardcoverId: null,
    hardcoverSlug: null,
    goodReadsId: null,
    openLibraryId: null,
});

describe('donatedExternalIds', () => {
    it('donates nothing when no loser holds an id', () => {
        assert.deepEqual(donatedExternalIds(bare('t'), [bare('a'), bare('b')]), {});
    });

    it('fills a gap on the survivor', () => {
        const loser = { ...bare('a'), hardcoverId: 93865, hardcoverSlug: 'robert-r-mccammon' };
        assert.deepEqual(donatedExternalIds(bare('t'), [loser]), {
            hardcoverId: 93865,
            hardcoverSlug: 'robert-r-mccammon',
        });
    });

    it('never overwrites an id the survivor already holds', () => {
        const target = { ...bare('t'), hardcoverId: 1, hardcoverSlug: 'keep-me' };
        const loser = { ...bare('a'), hardcoverId: 2, hardcoverSlug: 'drop-me' };
        assert.deepEqual(donatedExternalIds(target, [loser]), {});
    });

    it('donates each id source independently', () => {
        const target = { ...bare('t'), hardcoverId: 1, hardcoverSlug: 'keep' };
        const loser = { ...bare('a'), goodReadsId: 'gr1', openLibraryId: 'ol1' };
        assert.deepEqual(donatedExternalIds(target, [loser]), {
            goodReadsId: 'gr1',
            openLibraryId: 'ol1',
        });
    });

    it('takes the lowest loser id when several could donate', () => {
        const hi = { ...bare('b'), goodReadsId: 'from-b' };
        const lo = { ...bare('a'), goodReadsId: 'from-a' };
        assert.deepEqual(donatedExternalIds(bare('t'), [hi, lo]), { goodReadsId: 'from-a' });
        // Same answer whatever order they arrive in.
        assert.deepEqual(donatedExternalIds(bare('t'), [lo, hi]), { goodReadsId: 'from-a' });
    });

    it('never donates a slug without its hardcoverId', () => {
        const loser = { ...bare('a'), hardcoverSlug: 'orphan-slug' };
        assert.deepEqual(donatedExternalIds(bare('t'), [loser]), {});
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/authorMergeIds.test.ts`
Expected: FAIL — cannot find module `../src/lib/authorMergeIds`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/authorMergeIds.ts

/**
 * Works out which external ids a merge should move from the authors being
 * deleted onto the one being kept.
 *
 * Without this, merging drops them: the endpoint reassigns books and then
 * deletes the losing rows, so a hardcoverId, goodReadsId or openLibraryId held
 * only by a loser is gone. Those links cost third-party API quota to acquire.
 */

export type ExternalIdCarrier = {
    id: string;
    hardcoverId: number|null;
    hardcoverSlug: string|null;
    goodReadsId: string|null;
    openLibraryId: string|null;
};

export type DonatedIds = {
    hardcoverId?: number;
    hardcoverSlug?: string|null;
    goodReadsId?: string;
    openLibraryId?: string;
};

export function donatedExternalIds(
    target: ExternalIdCarrier,
    losers: ExternalIdCarrier[]
): DonatedIds {
    // Lowest id first, so several eligible donors resolve the same way on
    // every run regardless of the order the caller assembled them in.
    const ordered = [...losers].sort((a, b) => a.id.localeCompare(b.id));
    const donated: DonatedIds = {};

    if (target.hardcoverId === null) {
        // The slug is only meaningful alongside the id, so they move together.
        const donor = ordered.find(l => l.hardcoverId !== null);
        if (donor && donor.hardcoverId !== null) {
            donated.hardcoverId = donor.hardcoverId;
            donated.hardcoverSlug = donor.hardcoverSlug;
        }
    }

    if (target.goodReadsId === null) {
        const donor = ordered.find(l => l.goodReadsId !== null);
        if (donor && donor.goodReadsId !== null) {
            donated.goodReadsId = donor.goodReadsId;
        }
    }

    if (target.openLibraryId === null) {
        const donor = ordered.find(l => l.openLibraryId !== null);
        if (donor && donor.openLibraryId !== null) {
            donated.openLibraryId = donor.openLibraryId;
        }
    }

    return donated;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/authorMergeIds.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/authorMergeIds.ts tests/authorMergeIds.test.ts
git commit -m "work out which external ids a merge should carry over"
```

---

## Task 4: Merge target selection

**Files:**
- Create: `src/lib/authorMergeTarget.ts`
- Create: `tests/authorMergeTarget.test.ts`

**Interfaces:**
- Consumes: `scoreNameQuality` from Task 2.
- Produces:
  - `type MergeCandidate = { id: string; name: string; bookCount: number; hardcoverId: number|null; goodReadsId: string|null; openLibraryId: string|null; createdAt: Date }`
  - `type TargetRule = 'external-ids' | 'book-count' | 'typography' | 'age'`
  - `type TargetOutcome = { kind: 'chosen'; targetId: string; rule: TargetRule } | { kind: 'needs-review'; reason: string }`
  - `hasExternalIds(c: MergeCandidate): boolean`
  - `pickMergeTarget(members: MergeCandidate[]): TargetOutcome`

**Cascade:** external IDs, then book count, then typography, then oldest `createdAt`, with a final `id` comparison so the result never depends on input order. Two or more ID holders is a `needs-review`, not a guess.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/authorMergeTarget.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickMergeTarget, type MergeCandidate } from '../src/lib/authorMergeTarget';

const at = (iso: string): Date => new Date(iso);

const candidate = (over: Partial<MergeCandidate> & { id: string }): MergeCandidate => ({
    name: 'Placeholder Name',
    bookCount: 0,
    hardcoverId: null,
    goodReadsId: null,
    openLibraryId: null,
    createdAt: at('2025-01-01T00:00:00Z'),
    ...over,
});

describe('pickMergeTarget', () => {
    it('keeps the only holder of external ids, even with fewer books', () => {
        // The books get reassigned either way; a discarded hardcoverId costs
        // API quota to re-earn.
        const out = pickMergeTarget([
            candidate({ id: 'few', name: 'Robert R. McCammon', bookCount: 1, hardcoverId: 93865 }),
            candidate({ id: 'many', name: 'Robert R. Mccammon', bookCount: 20 }),
        ]);
        assert.deepEqual(out, { kind: 'chosen', targetId: 'few', rule: 'external-ids' });
    });

    it('refuses to choose when two members hold external ids', () => {
        const out = pickMergeTarget([
            candidate({ id: 'a', hardcoverId: 1 }),
            candidate({ id: 'b', goodReadsId: 'gr' }),
        ]);
        assert.equal(out.kind, 'needs-review');
    });

    it('falls to book count when nobody holds ids', () => {
        const out = pickMergeTarget([
            candidate({ id: 'ratey-md', name: 'John J. Ratey MD', bookCount: 6 }),
            candidate({ id: 'ratey-md-lower', name: 'John J. Ratey Md', bookCount: 1 }),
        ]);
        assert.deepEqual(out, { kind: 'chosen', targetId: 'ratey-md', rule: 'book-count' });
    });

    it('falls to typography when book counts tie', () => {
        const out = pickMergeTarget([
            candidate({ id: 'lower', name: 'John J. Ratey Md', bookCount: 3 }),
            candidate({ id: 'canon', name: 'John J. Ratey MD', bookCount: 3 }),
        ]);
        assert.deepEqual(out, { kind: 'chosen', targetId: 'canon', rule: 'typography' });
    });

    it('falls to the oldest row when typography ties too', () => {
        const out = pickMergeTarget([
            candidate({ id: 'newer', name: 'Ann Smith', bookCount: 2, createdAt: at('2026-05-01T00:00:00Z') }),
            candidate({ id: 'older', name: 'Ann Smith', bookCount: 2, createdAt: at('2025-02-01T00:00:00Z') }),
        ]);
        assert.deepEqual(out, { kind: 'chosen', targetId: 'older', rule: 'age' });
    });

    it('gives the same answer whatever order the members arrive in', () => {
        const a = candidate({ id: 'aaa', name: 'Ann Smith', bookCount: 2 });
        const b = candidate({ id: 'bbb', name: 'Ann Smith', bookCount: 2 });
        assert.deepEqual(pickMergeTarget([a, b]), pickMergeTarget([b, a]));
    });

    it('needs review for a cluster with fewer than two members', () => {
        assert.equal(pickMergeTarget([candidate({ id: 'only' })]).kind, 'needs-review');
        assert.equal(pickMergeTarget([]).kind, 'needs-review');
    });

    it('handles a cluster of many variants', () => {
        const out = pickMergeTarget([
            candidate({ id: 'a', name: 'ROBERT MCCAMMON', bookCount: 2 }),
            candidate({ id: 'b', name: 'robert mccammon', bookCount: 2 }),
            candidate({ id: 'c', name: 'Robert McCammon', bookCount: 2 }),
            candidate({ id: 'd', name: 'Robert Mccammon', bookCount: 2 }),
        ]);
        assert.deepEqual(out, { kind: 'chosen', targetId: 'c', rule: 'typography' });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/authorMergeTarget.test.ts`
Expected: FAIL — cannot find module `../src/lib/authorMergeTarget`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/authorMergeTarget.ts
import { scoreNameQuality } from './authorNameQuality';

/**
 * Chooses which of several duplicate author rows survives a merge.
 *
 * Every member of a cluster is the same name modulo case, punctuation and
 * whitespace, so no variant holds information another lacks. What differs is
 * what is attached to the row -- external ids and books -- and how the name is
 * typed. The cascade takes those in that order.
 */

export type MergeCandidate = {
    id: string;
    name: string;
    bookCount: number;
    hardcoverId: number|null;
    goodReadsId: string|null;
    openLibraryId: string|null;
    createdAt: Date;
};

export type TargetRule = 'external-ids'|'book-count'|'typography'|'age';

export type TargetOutcome =
    | { kind: 'chosen'; targetId: string; rule: TargetRule }
    | { kind: 'needs-review'; reason: string };

export function hasExternalIds(c: MergeCandidate): boolean {
    return c.hardcoverId !== null || c.goodReadsId !== null || c.openLibraryId !== null;
}

/**
 * The winners under one rung, or every member when the rung cannot separate
 * them. `id` breaks a true tie so the outcome never depends on input order.
 */
function bestBy(members: MergeCandidate[], rank: (c: MergeCandidate) => number): MergeCandidate[] {
    const top = Math.max(...members.map(rank));
    return members.filter(c => rank(c) === top);
}

export function pickMergeTarget(members: MergeCandidate[]): TargetOutcome {
    if (members.length < 2) {
        return { kind: 'needs-review', reason: `cluster has ${members.length} member(s), needs at least 2` };
    }

    const idHolders = members.filter(hasExternalIds);
    if (idHolders.length > 1) {
        // Picking one would discard a real link that cost quota to acquire.
        return {
            kind: 'needs-review',
            reason: `${idHolders.length} members hold external ids: ${idHolders.map(c => c.id).join(', ')}`,
        };
    }
    if (idHolders.length === 1) {
        return { kind: 'chosen', targetId: idHolders[0].id, rule: 'external-ids' };
    }

    const byBooks = bestBy(members, c => c.bookCount);
    if (byBooks.length === 1) {
        return { kind: 'chosen', targetId: byBooks[0].id, rule: 'book-count' };
    }

    const byQuality = bestBy(byBooks, c => scoreNameQuality(c.name));
    if (byQuality.length === 1) {
        return { kind: 'chosen', targetId: byQuality[0].id, rule: 'typography' };
    }

    // Oldest row wins, and id settles a shared timestamp, so a re-run cannot
    // pick differently.
    const oldest = [...byQuality].sort((a, b) => {
        const t = a.createdAt.getTime() - b.createdAt.getTime();
        return t !== 0 ? t : a.id.localeCompare(b.id);
    })[0];
    return { kind: 'chosen', targetId: oldest.id, rule: 'age' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/authorMergeTarget.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/authorMergeTarget.ts tests/authorMergeTarget.test.ts
git commit -m "pick the surviving author row by a deterministic cascade"
```

---

## Task 5: Stop the merge endpoint discarding external ids

**Files:**
- Modify: `src/app/api/admin/duplicates/merge/route.ts` — insert after the loser-delete loop that currently sits at lines 156-161, inside the `$transaction` callback and before its `return`.

**Interfaces:**
- Consumes: `donatedExternalIds` from Task 3.
- Produces: no new exports. The endpoint's JSON response gains a `donatedIds` field listing which keys moved.

**Ordering is no longer load-bearing, but keep it after the deletes.** Task 0 removed the last unique index on an `Author` external id, so donating before or after the deletes is now equivalent. It stays after them as the more robust order: if a unique index is ever restored on one of these columns, this sequence still works and the reverse would not.

This file uses **2-space** indentation.

- [ ] **Step 1: Add the import**

At the top of `src/app/api/admin/duplicates/merge/route.ts`, after the existing `db` import:

```typescript
import { donatedExternalIds } from '@/lib/authorMergeIds';
```

- [ ] **Step 2: Donate the ids after the deletes**

Find this block (currently lines 156-161):

```typescript
      // Delete the merged authors
      for (const author of authorsToMerge) {
        await tx.author.delete({
          where: { id: author.id }
        });
      }
```

Insert immediately after it, still inside the transaction callback:

```typescript
      // The losers are gone now, and any external id only they held would have
      // gone with them -- links that cost third-party API quota to acquire.
      // Move whatever the survivor lacks onto the survivor.
      //
      // After the deletes on purpose. No Author external id is unique any more,
      // so the order is not forced -- but this way still works if a unique
      // index is ever restored on one of these columns, and the reverse would
      // raise P2002 the moment it was.
      const donated = donatedExternalIds(targetAuthor, authorsToMerge);
      if (Object.keys(donated).length > 0) {
        await tx.author.update({
          where: { id: targetAuthorId },
          data: donated,
        });
      }
```

- [ ] **Step 3: Report what moved**

Change the transaction's return value from:

```typescript
      return {
        mergeRecord,
        booksReassigned,
        authorsDeleted: authorsToMerge.length
      };
```

to:

```typescript
      return {
        mergeRecord,
        booksReassigned,
        authorsDeleted: authorsToMerge.length,
        donatedIds: Object.keys(donated)
      };
```

And add the field to the success response, after `authorsDeleted: result.authorsDeleted`:

```typescript
      donatedIds: result.donatedIds,
```

- [ ] **Step 4: Typecheck and run the suite**

Run: `npm run typecheck && npm test && npm run lint`
Expected: no type errors, 134 tests pass (104 pre-existing + 30 from Tasks 1-4), no lint errors.

`authorsToMerge` is typed from `db.author.findMany({ include: { books: true } })`, which returns every scalar column, so it already satisfies `ExternalIdCarrier`. If the compiler disagrees, the cause is `books` being an extra property — structural typing permits that, so no cast is needed.

- [ ] **Step 5: Verify against real data on a Neon branch**

The repo has no DB test harness, so verify the way the P2002 migration was verified today: on a branch off production HEAD.

```
Create a Neon branch of project twilight-river-29437197 named
  verify-author-merge-id-donation

On that branch, find a cluster where exactly one member holds a hardcoverId
and another member holds more books:

  WITH ids AS (
    SELECT "author1Id" AS aid FROM "AuthorSimilarity" WHERE status='pending' AND confidence='exact'
    UNION SELECT "author2Id" FROM "AuthorSimilarity" WHERE status='pending' AND confidence='exact'
  )
  SELECT a.id, a.name, a."hardcoverId", a."goodReadsId", a."openLibraryId",
         (SELECT count(*) FROM "_AuthorToBook" ab WHERE ab."A"=a.id) AS books
  FROM "Author" a JOIN ids ON ids.aid=a.id
  WHERE regexp_replace(lower(a.name),'[^a-z0-9\s]','','g') IN (
    SELECT regexp_replace(lower(name),'[^a-z0-9\s]','','g') FROM "Author"
    WHERE "hardcoverId" IS NOT NULL)
  ORDER BY a.name
  LIMIT 20;

Record the chosen cluster's member ids and their external ids. Then simulate
the fixed endpoint's statement order against that branch:

  BEGIN;
  DELETE FROM "Author" WHERE id IN (<loser ids>);
  UPDATE "Author" SET "hardcoverId" = <loser hcid>, "hardcoverSlug" = '<loser slug>'
   WHERE id = '<target id>' AND "hardcoverId" IS NULL;
  SELECT id, name, "hardcoverId", "hardcoverSlug" FROM "Author" WHERE id = '<target id>';
  ROLLBACK;

Expected: the UPDATE succeeds and the survivor ends up holding the loser's
hardcoverId. Also run the same pair of statements in the reverse order (UPDATE
then DELETE) and confirm it now also succeeds -- after Task 0 there is no
unique index left on any Author external id to make the order matter. Delete
the branch afterwards, with Chad's approval.
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/duplicates/merge/route.ts
git commit -m "carry external ids onto the surviving author when merging"
```

---

## Task 6: Planning script with dry-run output

**Files:**
- Create: `scripts/merge-duplicate-authors.ts`

**Interfaces:**
- Consumes: `authorNameKey` (Task 1), `pickMergeTarget` / `MergeCandidate` (Task 4).
- Produces: a CLI. Dry-run is the default; `--execute` is required to write.

This file uses **2-space** indentation and a `#!/usr/bin/env npx tsx` shebang, matching `scripts/populate-hardcover-queue.ts`.

- [ ] **Step 1: Write the script**

```typescript
#!/usr/bin/env npx tsx
/**
 * Clears the author duplicate review queue.
 *
 * Merges each cluster of name variants down to one row and dismisses the
 * false positives. Dry-run by default; --execute is required to write.
 *
 * Reads come straight from the database: GET /api/admin/duplicates returns
 * each author's books but not their external ids, which the target rule needs.
 * Writes go through the admin endpoints so the AuthorMerge audit row and the
 * AuthorSimilarity status cascade stay server-side.
 *
 * Usage:
 *   ADMIN_SECRET="$(op read op://mcp/IBDb-admin/credential)" \
 *   DATABASE_URL="$(op read op://mcp/IBDb-Prod-DB/credential)" \
 *     npx tsx scripts/merge-duplicate-authors.ts [--execute] [--limit N] [--out FILE]
 */

import { writeFile } from 'node:fs/promises';
import { db } from '../src/server/db';
import { authorNameKey } from '../src/lib/authorNameKey';
import { pickMergeTarget, type MergeCandidate, type TargetRule } from '../src/lib/authorMergeTarget';

const BASE_URL = process.env.IBDB_BASE_URL ?? 'https://ibdb.dev';
const BATCH_SIZE = 25;

type Plan = {
  key: string;
  targetId: string;
  targetName: string;
  rule: TargetRule;
  losers: MergeCandidate[];
  similarityIds: string[];
};

type Skipped = { key: string; reason: string; memberIds: string[] };

function parseArgs(argv: string[]): { execute: boolean; limit: number|null; out: string } {
  const execute = argv.includes('--execute');
  const limitIdx = argv.indexOf('--limit');
  const outIdx = argv.indexOf('--out');
  return {
    execute,
    limit: limitIdx >= 0 ? Number(argv[limitIdx + 1]) : null,
    out: outIdx >= 0 ? argv[outIdx + 1] : 'author-merge-plan.tsv',
  };
}

/** Union-find over the similarity graph. */
class Groups {
  private parent = new Map<string, string>();

  find(x: string): string {
    const p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p === x) {
      return x;
    }
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      this.parent.set(ra, rb);
    }
  }
}

async function main(): Promise<void> {
  const { execute, limit, out } = parseArgs(process.argv.slice(2));
  console.log(`mode: ${execute ? 'EXECUTE (will write)' : 'dry run'}`);

  const pending = await db.authorSimilarity.findMany({
    where: { status: 'pending' },
    select: {
      id: true,
      confidence: true,
      author1Id: true,
      author1Name: true,
      author2Id: true,
      author2Name: true,
    },
  });
  console.log(`pending similarities: ${pending.length}`);

  // Anything whose name has no alphanumerics at all is not a name. The queue
  // calls these exact matches because they normalize to the same empty string.
  const degenerate = pending.filter(
    p => authorNameKey(p.author1Name) === '' || authorNameKey(p.author2Name) === ''
  );
  const degenerateIds = new Set(degenerate.map(d => d.id));

  // The high band is mojibake, spreadsheet residue and romanized
  // transliterations of different people. It is dismissed, never merged.
  const dismissIds = [
    ...new Set([
      ...degenerate.map(d => d.id),
      ...pending.filter(p => p.confidence !== 'exact').map(p => p.id),
    ]),
  ];

  const mergeable = pending.filter(p => p.confidence === 'exact' && !degenerateIds.has(p.id));
  console.log(`to dismiss: ${dismissIds.length}   mergeable pairs: ${mergeable.length}`);

  const groups = new Groups();
  for (const p of mergeable) {
    groups.union(p.author1Id, p.author2Id);
  }

  const components = new Map<string, Set<string>>();
  const componentSimilarities = new Map<string, string[]>();
  for (const p of mergeable) {
    const root = groups.find(p.author1Id);
    if (!components.has(root)) {
      components.set(root, new Set());
      componentSimilarities.set(root, []);
    }
    components.get(root)!.add(p.author1Id);
    components.get(root)!.add(p.author2Id);
    componentSimilarities.get(root)!.push(p.id);
  }
  console.log(`clusters: ${components.size}`);

  const allIds = [...new Set([...components.values()].flatMap(s => [...s]))];
  const authors = new Map<string, MergeCandidate & { key: string }>();
  for (let i = 0; i < allIds.length; i += 1000) {
    const rows = await db.author.findMany({
      where: { id: { in: allIds.slice(i, i + 1000) } },
      select: {
        id: true,
        name: true,
        hardcoverId: true,
        goodReadsId: true,
        openLibraryId: true,
        createdAt: true,
        _count: { select: { books: true } },
      },
    });
    for (const r of rows) {
      authors.set(r.id, {
        id: r.id,
        name: r.name,
        bookCount: r._count.books,
        hardcoverId: r.hardcoverId,
        goodReadsId: r.goodReadsId,
        openLibraryId: r.openLibraryId,
        createdAt: r.createdAt,
        key: authorNameKey(r.name),
      });
    }
  }

  const plans: Plan[] = [];
  const skipped: Skipped[] = [];

  for (const [root, memberIds] of components) {
    const members = [...memberIds].map(id => authors.get(id)).filter(m => m !== undefined);
    if (members.length !== memberIds.size) {
      skipped.push({ key: root, reason: 'a member row no longer exists', memberIds: [...memberIds] });
      continue;
    }

    // The assertion that makes this safe: a cluster must be one name. If the
    // graph ever connects two different names, skip it rather than merge it.
    const keys = new Set(members.map(m => m.key));
    if (keys.size !== 1) {
      skipped.push({
        key: [...keys].join(' | '),
        reason: `cluster spans ${keys.size} distinct name keys`,
        memberIds: members.map(m => m.id),
      });
      continue;
    }

    const outcome = pickMergeTarget(members);
    if (outcome.kind === 'needs-review') {
      skipped.push({ key: members[0].key, reason: outcome.reason, memberIds: members.map(m => m.id) });
      continue;
    }

    const target = members.find(m => m.id === outcome.targetId)!;
    plans.push({
      key: target.key,
      targetId: target.id,
      targetName: target.name,
      rule: outcome.rule,
      losers: members.filter(m => m.id !== target.id),
      similarityIds: componentSimilarities.get(root) ?? [],
    });
  }

  plans.sort((a, b) => a.key.localeCompare(b.key));

  const byRule = new Map<string, number>();
  for (const p of plans) {
    byRule.set(p.rule, (byRule.get(p.rule) ?? 0) + 1);
  }

  const lines = ['key\ttarget_name\ttarget_id\trule\tbooks\tlosers'];
  for (const p of plans) {
    const losers = p.losers
      .map(l => `${l.name} [${l.id.slice(0, 8)}] ${l.bookCount}bk${l.hardcoverId !== null ? ' hc' : ''}`)
      .join(' | ');
    const target = authors.get(p.targetId)!;
    lines.push(`${p.key}\t${p.targetName}\t${p.targetId}\t${p.rule}\t${target.bookCount}\t${losers}`);
  }
  lines.push('');
  lines.push('# SKIPPED (needs manual review)');
  for (const s of skipped) {
    lines.push(`# ${s.key}\t${s.reason}\t${s.memberIds.join(',')}`);
  }
  await writeFile(out, lines.join('\n'), 'utf8');

  console.log('');
  console.log(`plan written to ${out}`);
  console.log(`  merges planned : ${plans.length}`);
  console.log(`  rows deleted   : ${plans.reduce((n, p) => n + p.losers.length, 0)}`);
  console.log(`  pairs dismissed: ${dismissIds.length}`);
  console.log(`  skipped        : ${skipped.length}`);
  for (const [rule, n] of [...byRule].sort()) {
    console.log(`  decided by ${rule}: ${n}`);
  }

  if (!execute) {
    console.log('');
    console.log('dry run only. re-run with --execute to apply.');
    return;
  }

  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SECRET is not set');
  }

  const toRun = limit === null ? plans : plans.slice(0, limit);
  console.log('');
  console.log(`executing ${toRun.length} merges in batches of ${BATCH_SIZE}...`);

  let done = 0;
  for (const plan of toRun) {
    const res = await fetch(`${BASE_URL}/api/admin/duplicates/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-secret': secret },
      body: JSON.stringify({
        authorIds: [plan.targetId, ...plan.losers.map(l => l.id)],
        targetAuthorId: plan.targetId,
        mergedBy: 'merge-duplicate-authors script',
        mergeReason: `name variants of "${plan.targetName}"; target by ${plan.rule}`,
        similarityIds: plan.similarityIds,
      }),
    });

    if (!res.ok) {
      // Stop rather than plough on: a systematic failure would otherwise
      // repeat thousands of times.
      const body = await res.text();
      console.error(`FAILED on ${plan.key} (${plan.targetId}): ${res.status} ${body.slice(0, 300)}`);
      console.error(`stopped after ${done} successful merges`);
      process.exitCode = 1;
      return;
    }

    done++;
    if (done % BATCH_SIZE === 0) {
      console.log(`  ${done}/${toRun.length}`);
    }
  }
  console.log(`merged ${done} clusters`);

  console.log(`dismissing ${dismissIds.length} false positives...`);
  let dismissed = 0;
  for (const id of dismissIds) {
    const res = await fetch(`${BASE_URL}/api/admin/duplicates`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-secret': secret },
      body: JSON.stringify({
        id,
        status: 'dismissed',
        reviewedBy: 'merge-duplicate-authors script',
        notes: 'Not duplicates: degenerate name, mojibake, or distinct transliterated authors',
      }),
    });
    if (!res.ok) {
      console.error(`dismiss failed for ${id}: ${res.status}`);
      process.exitCode = 1;
      return;
    }
    dismissed++;
  }
  console.log(`dismissed ${dismissed}`);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
```

- [ ] **Step 2: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: clean. If ESLint objects to the non-null assertions (`!`), replace each with an explicit `if (x === undefined) { continue; }` guard rather than disabling the rule.

- [ ] **Step 3: Commit**

```bash
git add scripts/merge-duplicate-authors.ts
git commit -m "add the duplicate author merge script, dry run by default"
```

---

## Task 7: Ship the fix, then plan against production

**Files:** none changed. This task is verification and sequencing.

- [ ] **Step 1: Run every gate**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all clean; 134 tests (104 pre-existing plus 30 from Tasks 1-4: 7 + 9 + 6 + 8).

- [ ] **Step 2: Merge to main and push**

```bash
cd /Users/chad/Projects/ibdb/worktrees/main
git merge --ff-only author-dedupe
git push origin main
```

- [ ] **Step 3: Confirm the deploy is live before any merge runs**

The deployed endpoint is what preserves external ids, so the dry run must not be executed against an old deployment. Check the Vercel deployment for the pushed SHA reaches `READY`, then confirm `_prisma_migrations` is unchanged (this branch adds no migration).

- [ ] **Step 4: Dry run**

```bash
cd /Users/chad/Projects/ibdb/worktrees/author-dedupe
ADMIN_SECRET="$(op read op://mcp/IBDb-admin/credential)" \
DATABASE_URL="$(op read op://mcp/IBDb-Prod-DB/credential)" \
DATABASE_URL_UNPOOLED="$(op read op://mcp/IBDb-Prod-DB/credential)" \
  npx tsx scripts/merge-duplicate-authors.ts --out /tmp/author-merge-plan.tsv
```

Expected: roughly 2,538 merges, roughly 3,466 rows to delete, 69 dismissals, and a small skipped list including the 3 contested-id clusters. The exact cluster count will differ slightly from the spec's estimate, which was computed with a space-stripped key rather than the detector's space-preserving one.

- [ ] **Step 5: Review gate — STOP**

Report the summary and a sample of the TSV to Chad. Do not proceed to `--execute` without his explicit approval. Confirm with him in particular:
- the rule breakdown, especially how many clusters `typography` decided
- every entry on the skipped list
- a hand-check of ten `typography` rows, since that is the rung with the most judgement in it

- [ ] **Step 6: Pilot, then the rest**

After approval, run a bounded pilot first:

```bash
ADMIN_SECRET="$(op read op://mcp/IBDb-admin/credential)" \
DATABASE_URL="$(op read op://mcp/IBDb-Prod-DB/credential)" \
DATABASE_URL_UNPOOLED="$(op read op://mcp/IBDb-Prod-DB/credential)" \
  npx tsx scripts/merge-duplicate-authors.ts --execute --limit 25
```

Verify in the database that 25 `AuthorMerge` rows exist, that their targets hold the expected external ids, that no book lost an author, and that `/admin/duplicates` shows the queue shrinking. Then re-run without `--limit`.

- [ ] **Step 7: Confirm the end state**

```sql
SELECT status, count(*) FROM "AuthorSimilarity" GROUP BY status;
SELECT count(*) FROM "Author";
SELECT count(*) FROM "AuthorMerge";
-- No book should have been orphaned by the merges.
SELECT count(*) FROM "Book" b
 WHERE NOT EXISTS (SELECT 1 FROM "_AuthorToBook" ab WHERE ab."B" = b.id);
```

Compare the orphan count against the same query run before execution — it must not have increased.

---

## Self-Review

**Spec coverage:** unique-index removal (Task 0), clustering with assertion (Task 6), 4-rung cascade (Task 4), typography weights (Task 2), external-ID donation (Tasks 3 and 5), dismissals (Task 6), dry-run default and batching (Task 6), error handling and idempotency (Task 6), unit tests (Tasks 1-4), Neon-branch verification (Task 5), sequencing (Task 7). The spec's "out of scope" list stays out.

**Deviation from the approved design, flagged for Chad:**
1. ID donation happens **after** the deletes, not before as the approved preview showed. That was originally forced by the `@unique` indexes on `goodReadsId` and `openLibraryId`; Task 0 has since dropped those at Chad's request, so the order is now a robustness choice rather than a requirement.
2. The cluster key **preserves spaces**, matching the detector. The spec's 2,538 was computed with a space-stripped key, so the dry run may report a slightly different number.
3. The typography table gains a **Celtic-prefix rule** (+1 for `McCammon` over `Mccammon`, −1 for the reverse) not in the approved table. Without it that very common cluster shape falls through to `age`, which is arbitrary.

**Type consistency:** `MergeCandidate` is defined once in Task 4 and consumed unchanged in Task 6. `ExternalIdCarrier` is defined in Task 3 and satisfied structurally in Task 5. `TargetOutcome` is a flat discriminated union — `{kind:'chosen'; targetId; rule}` — and Task 6 reads `outcome.targetId` accordingly, not `outcome.choice.targetId`.
