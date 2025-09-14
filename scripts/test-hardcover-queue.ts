#!/usr/bin/env npx tsx
/**
 * Test script for HardcoverQueue operations
 * Usage: npx tsx scripts/test-hardcover-queue.ts
 */

import { db } from '../src/server/db';
import {
  claimBooks,
  releaseClaim,
  releaseOldClaims,
  cleanupCompleted,
  addBookToQueue,
  removeBookFromQueue
} from '../src/server/hardcoverQueue';

async function testQueueOperations() {
  console.log('🧪 Testing HardcoverQueue Operations\n');

  try {
    // Test 1: Check current queue status
    console.log('📊 Current Queue Status:');
    const totalInQueue = await db.hardcoverQueue.count();
    const unclaimed = await db.hardcoverQueue.count({
      where: { processingId: null }
    });
    const claimed = await db.hardcoverQueue.count({
      where: { processingId: { not: null } }
    });
    console.log(`  Total in queue: ${totalInQueue}`);
    console.log(`  Unclaimed: ${unclaimed}`);
    console.log(`  Claimed: ${claimed}\n`);

    // Test 2: Claim books without previous processingId
    console.log('🎯 Test 1: Claiming books (no previous ID)...');
    const claim1 = await claimBooks(undefined, 5);
    console.log(`  Claimed ${claim1.books.length} books`);
    console.log(`  ProcessingId: ${claim1.processingId}`);
    console.log(`  Remaining unclaimed: ${claim1.remainingUnclaimed}\n`);

    // Test 3: Claim books with previous processingId
    console.log('🎯 Test 2: Claiming books (with previous ID)...');
    const claim2 = await claimBooks(claim1.processingId, 5);
    console.log(`  Released previous claim and claimed ${claim2.books.length} new books`);
    console.log(`  New ProcessingId: ${claim2.processingId}`);
    console.log(`  Remaining unclaimed: ${claim2.remainingUnclaimed}\n`);

    // Test 4: Release specific claim
    console.log('🎯 Test 3: Releasing specific claim...');
    const releaseCount = await releaseClaim(claim2.processingId);
    console.log(`  Released ${releaseCount} books\n`);

    // Test 5: Test old claims release (set a claim to old time)
    console.log('🎯 Test 4: Testing old claims release...');
    // First claim some books
    const testClaim = await claimBooks(undefined, 3);
    // Manually set claim time to 40 minutes ago
    await db.hardcoverQueue.updateMany({
      where: { processingId: testClaim.processingId },
      data: { claimTime: new Date(Date.now() - 40 * 60 * 1000) }
    });
    // Now release old claims (older than 30 minutes)
    const oldReleased = await releaseOldClaims(30);
    console.log(`  Released ${oldReleased} old claims\n`);

    // Test 6: Cleanup completed books
    console.log('🎯 Test 5: Testing cleanup of completed books...');
    // Find a book with hardcoverId if any exist
    const completedBook = await db.book.findFirst({
      where: { hardcoverId: { not: null } },
      select: { id: true, title: true }
    });

    if (completedBook) {
      // Try to add it to queue (should handle gracefully)
      const added = await addBookToQueue(completedBook.id);
      console.log(`  Attempted to add completed book: ${added ? 'Added' : 'Already exists'}`);

      // Now cleanup
      const cleaned = await cleanupCompleted();
      console.log(`  Cleaned up ${cleaned} completed books\n`);
    } else {
      console.log('  No completed books found to test cleanup\n');
    }

    // Test 7: Edge cases
    console.log('🎯 Test 6: Edge cases...');
    // Try to release non-existent claim
    const fakeRelease = await releaseClaim('fake-uuid-that-does-not-exist');
    console.log(`  Released non-existent claim: ${fakeRelease} books`);

    // Try to claim when queue might be empty
    const emptyClaim = await claimBooks(undefined, 1000000);
    console.log(`  Claimed from potentially empty queue: ${emptyClaim.books.length} books`);
    console.log(`  Remaining: ${emptyClaim.remainingUnclaimed}\n`);

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run tests
testQueueOperations()
  .then(() => {
    console.log('\n✨ Queue tests complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });