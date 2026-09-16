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

type PendingSimilarity = {
  id: string;
  confidence: string;
  author1Id: string;
  author1Name: string;
  author2Id: string;
  author2Name: string;
};

/** The current pending queue. Called twice: once before any writes, and
 * again after the merge loop, because the merge cascade can resolve some of
 * these rows to 'merged' mid-run. */
async function fetchPendingSimilarities(): Promise<PendingSimilarity[]> {
  return db.authorSimilarity.findMany({
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
}

/**
 * The ids to dismiss as false positives: anything degenerate (no
 * alphanumerics in either name, so it normalizes to the same empty string)
 * plus the non-exact confidence band, which is mojibake, spreadsheet residue
 * and romanized transliterations of different people. Never merged, always
 * dismissed.
 */
function computeDismissIds(rows: PendingSimilarity[]): string[] {
  return [
    ...new Set(
      rows
        .filter(
          p =>
            authorNameKey(p.author1Name) === '' ||
            authorNameKey(p.author2Name) === '' ||
            p.confidence !== 'exact'
        )
        .map(p => p.id)
    ),
  ];
}

async function main(): Promise<void> {
  const { execute, limit, out } = parseArgs(process.argv.slice(2));
  console.log(`mode: ${execute ? 'EXECUTE (will write)' : 'dry run'}`);

  const pending = await fetchPendingSimilarities();
  console.log(`pending similarities: ${pending.length}`);

  // Anything whose name has no alphanumerics at all is not a name. The queue
  // calls these exact matches because they normalize to the same empty string.
  const degenerate = pending.filter(
    p => authorNameKey(p.author1Name) === '' || authorNameKey(p.author2Name) === ''
  );
  const degenerateIds = new Set(degenerate.map(d => d.id));

  // Pre-execute snapshot: accurate for the dry-run report below, since a dry
  // run performs no writes. The executing path re-derives this after the
  // merge loop runs instead of reusing this snapshot -- see the comment
  // above the fresh query later in this function.
  const dismissIds = computeDismissIds(pending);

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

    const target = members.find(m => m.id === outcome.targetId);
    if (target === undefined) {
      // Unreachable: pickMergeTarget only ever returns an id drawn from
      // `members`. If it ever fires, silently dropping the cluster would
      // make plans/skipped stop adding up with no record of why -- fail
      // instead of continuing.
      throw new Error(`merge target ${outcome.targetId} not found among cluster members for root ${root}`);
    }
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
    const target = authors.get(p.targetId);
    if (target === undefined) {
      // Unreachable: every p.targetId came from this same `authors` map.
      // If it ever fires, do not silently drop the row -- the TSV is the
      // human review gate for --execute, and a plan omitted here but left
      // in `plans` would execute unreviewed.
      throw new Error(`author ${p.targetId} not found while writing plan row for ${p.key}`);
    }
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

  // The merge cascade above (src/app/api/admin/duplicates/merge/route.ts)
  // flips every still-pending similarity that touches a merged author to
  // 'merged', regardless of confidence or cluster membership. Re-query
  // rather than reuse the pre-execute `dismissIds` snapshot, so anything the
  // cascade already resolved is naturally excluded -- it is no longer
  // 'pending' -- instead of being overwritten back to 'dismissed' below.
  const freshPending = await fetchPendingSimilarities();
  const plannedDismissIds = new Set(dismissIds);
  // Still-pending AND part of this run's plan. The freshness check drops ids
  // the merge cascade already resolved to 'merged'; the plan check drops rows
  // that appeared after the TSV was written, which no human has reviewed.
  const freshDismissIds = computeDismissIds(freshPending).filter(id => plannedDismissIds.has(id));
  const dismissToRun = limit === null ? freshDismissIds : freshDismissIds.slice(0, limit);

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
