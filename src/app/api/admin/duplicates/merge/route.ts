import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';

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

    // Get all authors involved
    const authors = await db.author.findMany({
      where: { id: { in: authorIds } },
      include: {
        books: true
      }
    });

    if (authors.length !== authorIds.length) {
      if (authors.length === 1 && authors[0].id === targetAuthorId) {
        // assume already merged
        return NextResponse.json({
            status: 'success',
        });
      }
      return NextResponse.json(
        { error: 'Some authors not found' },
        { status: 404 }
      );
    }

    const targetAuthor = authors.find(a => a.id === targetAuthorId);
    if (!targetAuthor) {
      console.error('target author not found', targetAuthorId);
      return NextResponse.json(
        { error: 'Target author not found' },
        { status: 404 }
      );
    }

    // Start a transaction for the merge
    const result = await db.$transaction(async (tx) => {
      // Get all books from authors being merged (excluding target)
      const authorsToMerge = authors.filter(a => a.id !== targetAuthorId);
      const bookIdsToReassign = new Set<string>();

      for (const author of authorsToMerge) {
        for (const book of author.books) {
          bookIdsToReassign.add(book.id);
        }
      }

      // Reassign books to target author
      let booksReassigned = 0;
      for (const bookId of bookIdsToReassign) {
        // Check if target author is already connected to this book
        const existingConnection = await tx.book.findFirst({
          where: {
            id: bookId,
            authors: {
              some: { id: targetAuthorId }
            }
          }
        });

        if (!existingConnection) {
          // Connect the book to the target author
          await tx.book.update({
            where: { id: bookId },
            data: {
              authors: {
                connect: { id: targetAuthorId }
              }
            }
          });
          booksReassigned++;
        }

        // Disconnect the book from the merged authors
        for (const author of authorsToMerge) {
          await tx.book.update({
            where: { id: bookId },
            data: {
              authors: {
                disconnect: { id: author.id }
              }
            }
          });
        }
      }

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

      return {
        mergeRecord,
        booksReassigned,
        authorsDeleted: authorsToMerge.length
      };
    });

    return NextResponse.json({
      status: 'success',
      mergeId: result.mergeRecord.id,
      targetAuthor: {
        id: targetAuthorId,
        name: targetAuthor.name
      },
      booksReassigned: result.booksReassigned,
      authorsDeleted: result.authorsDeleted
    });

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
