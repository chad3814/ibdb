import { db } from './db';
import { randomUUID } from 'crypto';

/**
 * Service module for managing the HardcoverQueue
 */

/**
 * Claim books for processing
 * @param previousProcessingId - Previous processing ID to release
 * @param limit - Number of books to claim (default: 100)
 * @returns Books, processingId, and remaining unclaimed count
 */
export async function claimBooks(previousProcessingId?: string, limit: number = 100) {
  const newProcessingId = randomUUID();

  return await db.$transaction(async (tx) => {
    // Step 1: Release previous claim if provided
    if (previousProcessingId) {
      await tx.hardcoverQueue.deleteMany({
        where: {
          processingId: previousProcessingId
        }
      });
    }

    // Step 2: Select unclaimed books
    const unclaimedBooks = await tx.hardcoverQueue.findMany({
      where: {
        processingId: null
      },
      take: limit,
      select: {
        bookId: true
      },
      orderBy: {
        book: {
          createdAt: 'desc'
        }
      }
    });

    const bookIds = unclaimedBooks.map(b => b.bookId);

    // Step 3: Claim the selected books
    if (bookIds.length > 0) {
      await tx.hardcoverQueue.updateMany({
        where: {
          bookId: {
            in: bookIds
          }
        },
        data: {
          processingId: newProcessingId,
          claimTime: new Date()
        }
      });
    }

    // Step 4: Get full book data with editions and authors
    const books = await tx.book.findMany({
      where: {
        id: {
          in: bookIds
        }
      },
      include: {
        authors: true,
        editions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    // Step 5: Count remaining unclaimed
    const remainingUnclaimed = await tx.hardcoverQueue.count({
      where: {
        processingId: null
      }
    });

    return {
      books,
      processingId: newProcessingId,
      remainingUnclaimed
    };
  });
}

/**
 * Release a specific claim
 * @param processingId - Processing ID to release
 * @returns Number of released records
 */
export async function releaseClaim(processingId: string): Promise<number> {
  const result = await db.hardcoverQueue.updateMany({
    where: {
      processingId
    },
    data: {
      processingId: null,
      claimTime: null
    }
  });

  return result.count;
}

/**
 * Release claims older than specified minutes
 * @param minutes - Age threshold in minutes
 * @returns Number of released records
 */
export async function releaseOldClaims(minutes: number): Promise<number> {
  const threshold = new Date();
  threshold.setMinutes(threshold.getMinutes() - minutes);

  const result = await db.hardcoverQueue.updateMany({
    where: {
      claimTime: {
        lt: threshold
      }
    },
    data: {
      processingId: null,
      claimTime: null
    }
  });

  return result.count;
}

/**
 * Clean up queue entries for books that already have hardcoverId
 * @returns Number of deleted records
 */
export async function cleanupCompleted(): Promise<number> {
  // Find queue entries where the book has a hardcoverId
  const completedEntries = await db.hardcoverQueue.findMany({
    where: {
      book: {
        hardcoverId: {
          not: null
        }
      }
    },
    select: {
      id: true
    }
  });

  if (completedEntries.length === 0) {
    return 0;
  }

  const result = await db.hardcoverQueue.deleteMany({
    where: {
      id: {
        in: completedEntries.map(e => e.id)
      }
    }
  });

  return result.count;
}

/**
 * Add a book to the queue
 * @param bookId - Book ID to add
 * @returns True if added, false if already exists
 */
export async function addBookToQueue(bookId: string): Promise<boolean> {
  try {
    await db.hardcoverQueue.create({
      data: {
        bookId,
        processingId: null,
        claimTime: null
      }
    });
    return true;
  } catch (error: any) {
    // Handle unique constraint violation (book already in queue)
    if (error?.code === 'P2002') {
      return false;
    }
    throw error;
  }
}

/**
 * Remove a book from the queue
 * @param bookId - Book ID to remove
 * @returns True if removed, false if not found
 */
export async function removeBookFromQueue(bookId: string): Promise<boolean> {
  const result = await db.hardcoverQueue.deleteMany({
    where: {
      bookId
    }
  });

  return result.count > 0;
}