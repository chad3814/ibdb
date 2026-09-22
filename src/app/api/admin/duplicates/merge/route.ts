import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { donatedExternalIds } from '@/lib/authorMergeIds';

// A 14-member cluster with 30 books can issue ~450 sequential statements in
// this one interactive transaction -- well past Prisma's 5s default. Match
// the precedent set for a comparable write in applyEnrichment
// (src/server/hardcoverEnrich.ts).
const MERGE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

// Matches the cron route's budget (src/app/api/cron/hardcover/route.ts):
// the transaction above can legitimately run for tens of seconds.
export const maxDuration = 60;

type MergeTxResult =
  | { kind: 'already-merged' }
  | { kind: 'not-found' }
  | { kind: 'target-not-found' }
  | {
      kind: 'success';
      mergeId: string;
      targetAuthorName: string;
      booksReassigned: number;
      authorsDeleted: number;
      donatedIds: string[];
    };

// POST /api/admin/duplicates/merge
// Merge duplicate authors
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      authorIds, // Array of author IDs to merge
      targetAuthorId, // The author to keep
      mergedBy = 'admin', // TODO: Get from auth
      mergeReason,
      similarityIds = [] // Optional: IDs of AuthorSimilarity records that led to this merge
    } = body;

    if (!authorIds || !targetAuthorId || authorIds.length < 2) {
      return NextResponse.json(
        { error: 'Invalid merge request: need at least 2 authors and a target' },
        { status: 400 }
      );
    }

    if (!authorIds.includes(targetAuthorId)) {
      return NextResponse.json(
        { error: 'Target author must be one of the authors being merged' },
        { status: 400 }
      );
    }

    // Reading the authors, and every check that depends on that read, happens
    // inside the transaction below. Reading them beforehand (as this used to)
    // left a window between the read and tx.author.delete's join-table cascade
    // where a book connected to a loser would be silently orphaned -- no
    // error, no audit trace. Early exits from inside a transaction can't
    // produce an HTTP response directly, so the callback returns a
    // discriminated result and the outer code below translates it.
    const result = await db.$transaction(async (tx): Promise<MergeTxResult> => {
      // Deliberately no `include: { books: true }`. The reassignment below is
      // set-based, so nothing here needs the rows -- and loading them was its
      // own problem: the "unknown author" row has 48,322 books, pulled into
      // memory purely to derive ids.
      const authors = await tx.author.findMany({
        where: { id: { in: authorIds } },
      });

      if (authors.length !== authorIds.length) {
        if (authors.length === 1 && authors[0].id === targetAuthorId) {
          // assume already merged
          return { kind: 'already-merged' };
        }
        return { kind: 'not-found' };
      }

      const targetAuthor = authors.find(a => a.id === targetAuthorId);
      if (!targetAuthor) {
        return { kind: 'target-not-found' };
      }

      const authorsToMerge = authors.filter(a => a.id !== targetAuthorId);
      const loserIds = authorsToMerge.map(a => a.id);

      // Two statements, not two per book.
      //
      // This loop used to run per book: a findFirst to ask whether the target
      // was already attached, an update to attach it, then an update per loser
      // to detach. Fine for a handful; hopeless for the "unknown author" row,
      // whose 48,322 books came to roughly 145,000 sequential statements and
      // blew the transaction timeout every time, so that merge could not be
      // performed at all.
      //
      // Raw SQL because Prisma has no bulk connect for an implicit many-to-many
      // relation. The table and its A/B columns are generated from the Author
      // <-> Book relation in schema.prisma and change only if that does.
      const booksReassigned = await tx.$executeRaw`
        INSERT INTO "_AuthorToBook" ("A", "B")
        SELECT DISTINCT ${targetAuthorId}::text, loser."B"
          FROM "_AuthorToBook" loser
         WHERE loser."A" = ANY(${loserIds}::text[])
           AND NOT EXISTS (
             SELECT 1 FROM "_AuthorToBook" already
              WHERE already."A" = ${targetAuthorId}::text
                AND already."B" = loser."B"
           )
      `;

      // Every remaining link belongs to a row about to be deleted. Doing this
      // explicitly rather than leaning on the delete's cascade keeps the
      // reassign-then-detach order visible, and means a book is attached to the
      // survivor before it is ever detached from a loser.
      await tx.$executeRaw`
        DELETE FROM "_AuthorToBook" WHERE "A" = ANY(${loserIds}::text[])
      `;

      // Create merge record
      const mergeRecord = await tx.authorMerge.create({
        data: {
          mergedAuthorIds: authorsToMerge.map(a => a.id),
          mergedAuthorNames: authorsToMerge.map(a => a.name),
          targetAuthorId,
          targetAuthorName: targetAuthor.name,
          mergedBy,
          mergeReason,
          booksReassigned
        }
      });

      // Update similarity records to mark as merged
      if (similarityIds.length > 0) {
        await tx.authorSimilarity.updateMany({
          where: { id: { in: similarityIds } },
          data: {
            status: 'merged',
            mergeId: mergeRecord.id,
            reviewedAt: new Date(),
            reviewedBy: mergedBy
          }
        });
      }

      // Also update any other similarity records involving the merged authors
      await tx.authorSimilarity.updateMany({
        where: {
          OR: [
            { author1Id: { in: authorsToMerge.map(a => a.id) } },
            { author2Id: { in: authorsToMerge.map(a => a.id) } }
          ],
          status: 'pending'
        },
        data: {
          status: 'merged',
          mergeId: mergeRecord.id,
          reviewedAt: new Date(),
          reviewedBy: mergedBy,
          notes: 'Auto-marked as merged due to author merge'
        }
      });

      // Delete the merged authors
      for (const author of authorsToMerge) {
        await tx.author.delete({
          where: { id: author.id }
        });
      }

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

      return {
        kind: 'success',
        mergeId: mergeRecord.id,
        targetAuthorName: targetAuthor.name,
        booksReassigned,
        authorsDeleted: authorsToMerge.length,
        donatedIds: Object.keys(donated)
      };
    }, MERGE_TRANSACTION_OPTIONS);

    switch (result.kind) {
      case 'already-merged':
        return NextResponse.json({
          status: 'success',
        });
      case 'not-found':
        return NextResponse.json(
          { error: 'Some authors not found' },
          { status: 404 }
        );
      case 'target-not-found':
        console.error('target author not found', targetAuthorId);
        return NextResponse.json(
          { error: 'Target author not found' },
          { status: 404 }
        );
      case 'success':
        return NextResponse.json({
          status: 'success',
          mergeId: result.mergeId,
          targetAuthor: {
            id: targetAuthorId,
            name: result.targetAuthorName
          },
          booksReassigned: result.booksReassigned,
          authorsDeleted: result.authorsDeleted,
          donatedIds: result.donatedIds,
        });
    }

  } catch (error) {
    console.error('Error merging authors:', error);
    return NextResponse.json(
      { error: 'Failed to merge authors' },
      { status: 500 }
    );
  }
}

// GET /api/admin/duplicates/merge
// Get merge history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const merges = await db.authorMerge.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        similarities: {
          select: {
            id: true,
            score: true,
            confidence: true
          }
        }
      }
    });

    const total = await db.authorMerge.count();

    return NextResponse.json({
      merges,
      total,
      limit,
      offset
    });

  } catch (error) {
    console.error('Error fetching merge history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch merge history' },
      { status: 500 }
    );
  }
}
