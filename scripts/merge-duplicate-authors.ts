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
 *     npx tsx scripts/merge-duplicate-authors.ts [--execute] [--limit N] [--out FILE] [--skip ID,ID,...]
 */

import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { db } from '../src/server/db';
import { authorNameKey } from '../src/lib/authorNameKey';
import { pickMergeTarget, type MergeCandidate, type TargetRule } from '../src/lib/authorMergeTarget';

const BASE_URL = process.env.IBDB_BASE_URL ?? 'https://ibdb.dev';
// Merges run one at a time against the admin endpoint, never concurrently --
// this only controls how often progress is logged.
const PROGRESS_EVERY = 25;

type Plan = {
  key: string;
  targetId: string;
  targetName: string;
  rule: TargetRule;
  losers: MergeCandidate[];
  similarityIds: string[];
};

type Skipped = { key: string; reason: string; memberIds: string[] };

function parseArgs(argv: string[]): { execute: boolean; limit: number|null; out: string; skip: Set<string> } {
  const execute = argv.includes('--execute');
  const limitIdx = argv.indexOf('--limit');
  const outIdx = argv.indexOf('--out');
  const skipIdx = argv.indexOf('--skip');
  const skipArg = skipIdx >= 0 ? argv[skipIdx + 1] : undefined;
  return {
    execute,
    limit: limitIdx >= 0 ? Number(argv[limitIdx + 1]) : null,
    out: outIdx >= 0 ? argv[outIdx + 1] : 'author-merge-plan.tsv',
    skip: new Set(
      skipArg === undefined
        ? []
        : skipArg.split(',').map(s => s.trim()).filter(s => s.length > 0)
    ),
  };
}

/** Collapses internal whitespace, so a name containing a tab or newline
 * cannot break the row structure of the TSV that is the human review gate. */
function sanitizeField(value: string): string {
  return value.replace(/\s+/g, ' ');
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

type PendingSimilarity = {
  id: string;
  confidence: string;
  score: number;
  author1Id: string;
  author1Name: string;
  author2Id: string;
  author2Name: string;
};

/** The current pending queue. */
async function fetchPendingSimilarities(): Promise<PendingSimilarity[]> {
  return db.authorSimilarity.findMany({
    where: { status: 'pending' },
    select: {
      id: true,
      confidence: true,
      score: true,
      author1Id: true,
      author1Name: true,
      author2Id: true,
      author2Name: true,
    },
  });
}

/**
 * The rows to dismiss as false positives: anything degenerate (no
 * alphanumerics in either name, so it normalizes to the same empty string)
 * plus 'high' confidence, which is the band actually measured against real
 * dismissals -- 66 'high' plus 3 degenerate at review time. 'medium' and
 * 'low' are not dismissed here: the type admits them, but no one has looked
 * at a sample of either band, and sharedExternalIds matches in
 * authorDuplicateDetector.ts produce genuine-duplicate 'high' rows, so this
 * criterion must stay narrow rather than sweeping up an unmeasured band.
 */
function computeDismissRows(rows: PendingSimilarity[], degenerateIds: Set<string>): PendingSimilarity[] {
  return rows.filter(p => degenerateIds.has(p.id) || p.confidence === 'high');
}

async function main(): Promise<void> {
  const { execute, limit, out, skip } = parseArgs(process.argv.slice(2));
  console.log(`mode: ${execute ? 'EXECUTE (will write)' : 'dry run'}`);

  const pending = await fetchPendingSimilarities();
  console.log(`pending similarities: ${pending.length}`);

  // Anything whose name has no alphanumerics at all is not a name. The queue
  // calls these exact matches because they normalize to the same empty string.
  const degenerate = pending.filter(
    p => authorNameKey(p.author1Name) === '' || authorNameKey(p.author2Name) === ''
  );
  const degenerateIds = new Set(degenerate.map(d => d.id));

  const skipped: Skipped[] = [];

  const dismissRows = computeDismissRows(pending, degenerateIds);
  const dismissIds = dismissRows.map(r => r.id);

  // Everything that is neither mergeable (below) nor dismissed above: a
  // confidence band no one has measured. Recorded as skipped, with the band
  // named, rather than silently dropped or swept into dismiss.
  const unmeasured = pending.filter(
    p => !degenerateIds.has(p.id) && p.confidence !== 'exact' && p.confidence !== 'high'
  );
  for (const p of unmeasured) {
    skipped.push({
      key: authorNameKey(p.author1Name),
      reason: `unmeasured confidence band: ${p.confidence}`,
      memberIds: [p.author1Id, p.author2Id],
    });
  }

  const mergeable = pending.filter(p => p.confidence === 'exact' && !degenerateIds.has(p.id));
  console.log(
    `to dismiss: ${dismissIds.length}   mergeable pairs: ${mergeable.length}   unmeasured (skipped): ${unmeasured.length}`
  );

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
    const memberSet = components.get(root);
    const similarityList = componentSimilarities.get(root);
    if (memberSet === undefined || similarityList === undefined) {
      // Unreachable: both are seeded immediately above. If it ever fires the
      // clustering is broken, and dropping the pair would silently split a
      // cluster -- fail before anything is written instead.
      throw new Error(`cluster bookkeeping missing for root ${root}`);
    }
    memberSet.add(p.author1Id);
    memberSet.add(p.author2Id);
    similarityList.push(p.id);
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
  let skippedByFlag = 0;

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

    // authorNameKey strips accented characters rather than folding them, so
    // "José Saramago" and "Jos Saramago" can share the key above.
    // scoreNameQuality is just as blind to accents (it only sees a-zA-Z'
    // tokens), so nothing downstream could decide between them -- a merge
    // here would pick the surviving spelling by the arbitrary age rung.
    // Skip instead of guessing which spelling is correct.
    const nonAsciiVariants = new Set(members.map(m => m.name.replace(/[\x00-\x7F]/gu, '')));
    if (nonAsciiVariants.size !== 1) {
      skipped.push({
        key: members[0].key,
        reason: 'cluster members differ in non-ASCII characters',
        memberIds: members.map(m => m.id),
      });
      continue;
    }

    const outcome = pickMergeTarget(members);
    if (outcome.kind === 'needs-review') {
      skipped.push({ key: members[0].key, reason: outcome.reason, memberIds: members.map(m => m.id) });
      continue;
    }

    const target = members.find(m => m.id === outcome.targetId);
    if (target === undefined) {
      // Unreachable: pickMergeTarget only ever returns an id drawn from
      // `members`. If it ever fires, silently dropping the cluster would
      // make plans/skipped stop adding up with no record of why -- fail
      // instead of continuing.
      throw new Error(`merge target ${outcome.targetId} not found among cluster members for root ${root}`);
    }

    if (skip.has(target.id)) {
      skippedByFlag++;
      skipped.push({
        key: target.key,
        reason: 'excluded via --skip',
        memberIds: members.map(m => m.id),
      });
      continue;
    }

    const similarityIds = componentSimilarities.get(root);
    if (similarityIds === undefined) {
      // Unreachable: componentSimilarities is seeded for every root
      // alongside `components`, in the same loop above. Defaulting to an
      // empty list here would silently drop this cluster's similarity ids
      // from the merge request, skipping the AuthorSimilarity status
      // cascade for it with no record of why -- fail instead.
      throw new Error(`no similarity ids recorded for root ${root}`);
    }

    plans.push({
      key: target.key,
      targetId: target.id,
      targetName: target.name,
      rule: outcome.rule,
      losers: members.filter(m => m.id !== target.id),
      similarityIds,
    });
  }

  plans.sort((a, b) => a.key.localeCompare(b.key));

  const byRule = new Map<string, number>();
  for (const p of plans) {
    byRule.set(p.rule, (byRule.get(p.rule) ?? 0) + 1);
  }

  const lines: string[] = [];
  // Two components can legitimately share a name key if the similarity
  // graph never connected them -- duplicate `key` values below are expected,
  // not a bug in the clustering.
  lines.push('# duplicate `key` values across rows are expected: two components can');
  lines.push('# share a name key if the similarity graph never connected them.');
  // pickMergeTarget routes any cluster with more than one external-id
  // holder to needs-review, and otherwise promotes the sole holder to
  // target -- so no loser in this run ever holds an external id.
  // target_hardcover_id is included for completeness (the spec calls for
  // "external ids at stake"), but this run never exercises the
  // id-donation path in the merge endpoint.
  lines.push('# target_hardcover_id is included for completeness, but with the current');
  lines.push('# cascade no loser ever holds an external id, so this run does not');
  lines.push('# exercise the id-donation path in the merge endpoint.');
  lines.push('key\ttarget_name\ttarget_id\ttarget_hardcover_id\trule\tbooks\tlosers');
  for (const p of plans) {
    const losers = p.losers
      .map(l => `${sanitizeField(l.name)} [${l.id}] ${l.bookCount}bk${l.hardcoverId !== null ? ' hc' : ''}`)
      .join(' | ');
    const target = authors.get(p.targetId);
    if (target === undefined) {
      // Unreachable: every p.targetId came from this same `authors` map.
      // If it ever fires, do not silently drop the row -- the TSV is the
      // human review gate for --execute, and a plan omitted here but left
      // in `plans` would execute unreviewed.
      throw new Error(`author ${p.targetId} not found while writing plan row for ${p.key}`);
    }
    lines.push(
      `${p.key}\t${sanitizeField(p.targetName)}\t${p.targetId}\t${target.hardcoverId ?? ''}\t${p.rule}\t${target.bookCount}\t${losers}`
    );
  }
  lines.push('');
  lines.push('# SKIPPED (needs manual review)');
  for (const s of skipped) {
    lines.push(`# ${s.key}\t${s.reason}\t${s.memberIds.join(',')}`);
  }
  lines.push('');
  lines.push('# DISMISS (each row gets an audit note written when --execute runs)');
  lines.push('# id\tconfidence\tscore\tauthor1_name\tauthor2_name');
  for (const r of dismissRows) {
    lines.push(`# ${r.id}\t${r.confidence}\t${r.score}\t${sanitizeField(r.author1Name)}\t${sanitizeField(r.author2Name)}`);
  }

  // A digest of the plan content, so an operator can tell whether the plan
  // --execute is about to run against still matches the one they approved.
  // --execute is a separate invocation that re-derives everything from live
  // data, and live ingestion (src/server/isbndb.ts) can move book counts
  // between approval and execution, flipping the book-count rung.
  const digest = createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 12);
  // --execute writes to a distinct path rather than overwriting `out`, so
  // the approved artifact a human reviewed survives the run that acts on it.
  const writePath = execute ? `${out}.executed` : out;
  await writeFile(writePath, lines.join('\n'), 'utf8');

  console.log('');
  console.log(`plan written to ${writePath}`);
  console.log(`plan digest: ${digest}`);
  console.log(`  merges planned : ${plans.length}`);
  console.log(`  rows deleted   : ${plans.reduce((n, p) => n + p.losers.length, 0)}`);
  console.log(`  pairs dismissed: ${dismissIds.length}`);
  console.log(`  skipped        : ${skipped.length}`);
  console.log(`  skipped by --skip flag: ${skippedByFlag}`);
  console.log(`  unmeasured confidence (skipped): ${unmeasured.length}`);
  for (const [rule, n] of [...byRule].sort()) {
    console.log(`  decided by ${rule}: ${n}`);
  }
  console.log(
    `  before trusting this run, compare "plan digest" above against the digest printed for the approved ${out}`
  );

  if (!execute) {
    console.log('');
    console.log('dry run only. re-run with --execute to apply.');
    return;
  }

  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SECRET is not set');
  }

  // Dismissals run before merges. A merge's cascade
  // (src/app/api/admin/duplicates/merge/route.ts) flips every still-pending
  // similarity touching a merged author to 'merged'; if dismissals ran
  // after merges, some of `dismissIds` could already be 'merged' rather
  // than 'pending', and this used to need a second query to work out which.
  // Running dismissals first means no merge has touched anything yet when
  // they run, so that staleness cannot arise and the re-query is unneeded.
  const dismissToRun = limit === null ? dismissIds : dismissIds.slice(0, limit);
  console.log('');
  console.log(`dismissing ${dismissToRun.length} false positives...`);
  let dismissed = 0;
  for (const id of dismissToRun) {
    const res = await fetch(`${BASE_URL}/api/admin/duplicates`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-secret': secret },
      body: JSON.stringify({
        id,
        status: 'dismissed',
        reviewedBy: 'merge-duplicate-authors script',
        notes: 'Not duplicates: degenerate name or a high-confidence false positive',
      }),
    });
    if (!res.ok) {
      // Stop rather than plough on: a systematic failure would otherwise
      // repeat thousands of times.
      console.error(`dismiss failed for ${id}: ${res.status}`);
      console.error(`stopped after ${dismissed} successful dismissals`);
      process.exitCode = 1;
      return;
    }
    dismissed++;
  }
  console.log(`dismissed ${dismissed}`);

  const toRun = limit === null ? plans : plans.slice(0, limit);
  console.log('');
  console.log(`executing ${toRun.length} merges serially, progress every ${PROGRESS_EVERY}...`);

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
    if (done % PROGRESS_EVERY === 0) {
      console.log(`  ${done}/${toRun.length}`);
    }
  }
  console.log(`merged ${done} clusters`);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
