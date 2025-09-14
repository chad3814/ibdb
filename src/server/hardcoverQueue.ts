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

  // Use a transaction only for the critical claiming operations
  const bookIds = await db.$transaction(async (tx) => {
    // Step 1: Release previous claim if provided
    if (previousProcessingId) {
      await tx.hardcoverQueue.deleteMany({
        where: {
          processingId: previousProcessingId
        }
      });
    }

    // Step 2: Select unclaimed books (simplified query)
    const unclaimedBooks = await tx.hardcoverQueue.findMany({
      where: {
        processingId: null
      },
      take: limit,
      select: {
        bookId: true
      }
    });

    const ids = unclaimedBooks.map(b => b.bookId);

    // Step 3: Claim the selected books
    if (ids.length > 0) {
      await tx.hardcoverQueue.updateMany({
        where: {
          bookId: {
            in: ids
          }
        },
        data: {
          processingId: newProcessingId,
          claimTime: new Date()
        }
      });
    }

    return ids;
  }, {
    maxWait: 10000, // Max time to wait for a transaction slot (10s)
    timeout: 20000  // Transaction timeout (20s)
  });

  // Step 4: Get full book data with editions and authors (outside transaction)
  const books = bookIds.length > 0 ? await db.book.findMany({
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
    },
    orderBy: {
      createdAt: 'desc'
    }
  }) : [];

  // Step 5: Count remaining unclaimed (outside transaction)
  const remainingUnclaimed = await db.hardcoverQueue.count({
    where: {
      processingId: null
    }
  });

  return {
    books,
    processingId: newProcessingId,
    remainingUnclaimed
  };
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
  } catch (error) {
    // Handle unique constraint violation (book already in queue)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
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