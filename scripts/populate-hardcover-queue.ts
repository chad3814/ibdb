#!/usr/bin/env npx tsx
/**
 * Script to populate the HardcoverQueue table with existing books
 * that don't have a hardcoverId yet.
 *
 * Usage: npx tsx scripts/populate-hardcover-queue.ts
 */

import { db } from '../src/server/db';

async function populateHardcoverQueue() {
  console.log('🚀 Starting HardcoverQueue population...');

  try {
    // Find all books without a hardcoverId
    const booksWithoutHardcover = await db.book.findMany({
      where: {
        hardcoverId: null
      },
      select: {
        id: true,
        title: true
      }
    });

    console.log(`📚 Found ${booksWithoutHardcover.length} books without hardcoverId`);

    if (booksWithoutHardcover.length === 0) {
      console.log('✅ No books to add to queue. All books have hardcoverIds!');
      return;
    }

    // Use upsert to avoid duplicates if script is run multiple times
    let created = 0;
    let skipped = 0;

    for (const book of booksWithoutHardcover) {
      try {
        await db.hardcoverQueue.upsert({
          where: {
            bookId: book.id
          },
          create: {
            bookId: book.id,
            processingId: null,
            claimTime: null
          },
          update: {} // Don't update if it already exists
        });
        created++;

        // Progress indicator every 100 books
        if (created % 100 === 0) {
          console.log(`  ⏳ Processed ${created} books...`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Skipped book "${book.title}" (${book.id}): ${error}`);
        skipped++;
      }
    }

    console.log('\n📊 Population Summary:');
    console.log(`  ✅ Successfully added: ${created} books`);
    console.log(`  ⏭️  Skipped (already in queue): ${skipped} books`);
    console.log(`  📝 Total in queue: ${await db.hardcoverQueue.count()} books`);

  } catch (error) {
    console.error('❌ Error populating HardcoverQueue:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run the script
populateHardcoverQueue()
  .then(() => {
    console.log('\n✨ HardcoverQueue population complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });