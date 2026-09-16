# Development Session Spec: Automated Author Duplicate Merging
**Date**: 2026-09-16 15:20
**Branch**: author-dedupe
**Session**: Clear the 4,407-pair duplicate review queue without manual review

## Problem

`/admin/duplicates` holds 4,407 pending `AuthorSimilarity` pairs. Reviewing them
by hand is not going to happen, so they sit there and the Author table keeps
carrying ~6,000 redundant rows.

Those rows are not harmless. An Author row is one author *name string*, and the
enricher matches Hardcover contributions to ours by exact name -- which is what
produced the P2002 poison-queue incident fixed earlier today in
`20260916183000_author_hardcover_id_is_not_unique`. Fewer redundant name rows
means fewer of those collisions.

## What the queue actually contains

Measured against production, 2026-09-16:

| Bucket | Pairs | Disposition |
| --- | --- | --- |
| `exact` (score 100), real names | 4,338 | Merge |
| `high` (score 85-90) | 66 | Dismiss |
| `exact` with a degenerate name | 3 | Dismiss |

Two findings drive the whole design.

**The `exact` band is safe.** Zero of the 4,341 `exact` pairs differ in their
alphanumeric characters -- verified by comparing
`regexp_replace(lower(name),'[^a-z0-9]','','g')` across every pair. They are the
same letters in the same order, differing only in case, punctuation and
whitespace: `John J. Ratey MD` vs `John J. Ratey Md`. Neither variant carries
information the other lacks, so choosing a survivor is a typographic decision,
not an identity judgement. There are no comma-flipped pairs in this band at all.

**The `high` band is unsalvageable.** It is HTML-entity mojibake (`&` vs `&#945`,
`&#193;lvaro Cartea`), spreadsheet residue (`#N/A`), and romanized Chinese
transliterations of genuinely different people
(`( ) DAI WEI G LU EN BO GE ZHU` vs `( )Y. Daniel Liang ZHU`). Merging any of it
would corrupt data. It gets dismissed, not merged.

The 3 degenerate `exact` pairs are names that normalize to the empty string
(`""`, `&`, `" -"`), which is why the detector called them identical. This
matches the 6 pairs already dismissed by hand as "Not duplicates".

## Bug found: merging destroys external IDs

`POST /api/admin/duplicates/merge` reassigns books, writes an `AuthorMerge` audit
row, then `tx.author.delete`s the losers. It never copies their `hardcoverId`,
`hardcoverSlug`, `goodReadsId` or `openLibraryId` to the survivor, so those links
are silently lost. 1,196 pairs have exactly one side holding external IDs.

This is fixed as part of this work, before any merge runs. Note that donating a
`hardcoverId` is only possible at all because `Author_hardcoverId_key` was
dropped this morning; before that, copying an ID onto a survivor that already
had one would have raised P2002.

`Author.goodReadsId` and `Author.openLibraryId` carried the same unique indexes,
which would have forced the donation to be sequenced after the row deletes.
Those are dropped too, in `20260916195500_author_external_ids_not_unique`, on
the same cardinality argument. They were safe to drop because neither column
has ever held a value: 0 of 1,006,224 Author rows, and unpopulated on `Book` and
`Edition` as well. Every Goodreads and OpenLibrary column in the schema is
entirely NULL; only Hardcover is real. `Edition`'s unique indexes stay, since
`isbn13` genuinely identifies one edition.

## Design

### Unit of work: the cluster

`POST /merge` already accepts `authorIds[]` with a single `targetAuthorId`, so
clusters are the natural unit. The 4,338 pairs collapse to **2,538 clusters**
spanning 6,004 author rows, deleting **3,466** of them:

| Cluster size | Count |
| --- | --- |
| 2 | 1,884 |
| 3 | 506 |
| 4+ | 148 |
| largest | 14 |

Clustering also removes an ordering hazard. One author appears in up to 27 pairs;
merging pair-by-pair would eventually call `/merge` with an author a previous
call already deleted, which the endpoint answers with a 404.

Clusters are built as connected components (union-find) over the pending `exact`
pairs -- from the similarity graph the queue actually proposes, not from name
keys. Every component is then **asserted** to share one normalized name key. A
component that fails the assertion is routed to `needs-review` rather than
merged, so a surprise in the detector surfaces as a skipped cluster instead of a
bad merge.

### Target selection: first decisive rule wins

1. **Holds external IDs.** Preserves acquired Hardcover/Goodreads/OpenLibrary
   links, which cost API quota.
2. **More books.** The `John J. Ratey MD` (6 books) vs `John J. Ratey Md`
   (1 book) case.
3. **Typography score.** Settles ties where both sides are equally connected.
4. **Oldest `createdAt`.** Final tiebreak, so the outcome is deterministic and a
   re-run cannot pick differently.

Typography scoring:

| Signal | Delta |
| --- | --- |
| Proper Title Case | +2 |
| Known suffix/credential uppercased (`MD`, `PhD`, `Jr`, `Sr`, `II`, `III`, `RN`, `DDS`, `MBA`) | +2 |
| Initials carry periods (`J. J.` over `J J`) | +1 |
| ALL CAPS | -3 |
| all lowercase | -3 |
| Doubled internal whitespace | -1 |
| Trailing punctuation | -1 |

Three clusters contain two or more competing external-ID holders. They are
excluded from auto-merge and reported for manual review, since rule 1 cannot
decide them and picking wrong discards a real link.

### Components

| File | Responsibility |
| --- | --- |
| `src/lib/authorNameQuality.ts` | Pure. `scoreNameQuality(name): number`. Typography only. |
| `src/lib/authorMergeTarget.ts` | Pure. `pickMergeTarget(members): {targetId, rule}`. The cascade. |
| `src/lib/authorMergeIds.ts` | Pure. `donatedExternalIds(target, losers)`. |
| `src/app/api/admin/duplicates/merge/route.ts` | Applies `donatedExternalIds` before deleting losers. |
| `scripts/merge-duplicate-authors.ts` | Orchestration: read, cluster, plan, dry-run or execute. |

Keeping the three decision modules pure and I/O-free is what makes any of this
testable; the script holds all the I/O and none of the judgement.

### Data flow

Planning reads come from the database directly via Prisma. `GET /api/admin/duplicates`
returns each author's book list but not their external IDs, which rule 1 needs.

Every write goes through the existing HTTP endpoints so the server-side
behaviour stays authoritative: `POST /api/admin/duplicates/merge` for merges
(which writes the `AuthorMerge` audit row and cascades `AuthorSimilarity.status`)
and `PATCH /api/admin/duplicates` for dismissals.

Auth uses the `x-secret: $ADMIN_SECRET` header rather than an `admin_session`
cookie, because the cookie expires after 12 hours and this job runs longer.
Credentials are read from 1Password inline so they never touch a file or a log.

### Execution

`--dry-run` is the default; `--execute` is required to write anything.

The dry run emits a TSV of all 2,538 proposed merges -- cluster key, chosen
target, deciding rule, losers with book counts, external IDs at stake -- plus a
summary counting how many clusters each rule decided, and the `needs-review`
list. No writes.

Execution then proceeds in batches with a progress report.

### Error handling

- A non-200 from `/merge` stops the batch and reports. It does not continue.
- Idempotent: a cluster whose similarities are no longer `pending` is skipped, so
  an interrupted run resumes safely and a double-run is a no-op.
- Dismissals only change a status field and are reversible.

### Testing

- `tests/authorNameQuality.test.ts` -- scoring, including the Ratey fixture.
- `tests/authorMergeTarget.test.ts` -- each cascade rung, ties, determinism under
  reordered input, and the contested-ID exclusion.
- `tests/authorMergeIds.test.ts` -- donation only fills gaps, never overwrites a
  survivor's existing ID; multiple donors resolve deterministically.
- The endpoint fix is verified on a Neon branch off production HEAD. The repo has
  no DB test harness, so this mirrors how the P2002 migration was verified today.
- Gates before merge: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Sequencing

1. Build and test the three pure modules and the endpoint fix.
2. Merge to `main`, push, wait for the production deploy. The fix must be live
   before any merge runs, because the deployed endpoint is what preserves IDs.
3. Dry run. Chad reviews the TSV.
4. Batched execution.
5. Dismiss the 69 junk pairs.

## Out of scope

- Fixing the detector's false positives at the source. It scores mojibake and
  transliterations as 85-90; worth doing, but separate.
- The `&#193;lvaro Cartea` class of mojibake author names, which is an ingestion
  encoding bug, not a duplicate.
- Splitting concatenated multi-author rows such as
  `David B. & Harry O. Morris & Robert Mccammon & ...` into real authors.
- Adding an attempt counter to `HardcoverQueue`, still outstanding from the
  P2002 work.
