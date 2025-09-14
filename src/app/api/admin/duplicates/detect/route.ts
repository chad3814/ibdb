import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { AuthorDuplicateDetector } from '@/lib/authorDuplicateDetector';

// POST /api/admin/duplicates/detect
// Start a duplicate detection scan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      scanType = 'exact', // 'exact' | 'flipped' | 'fuzzy' | 'full'
      minScore = 70,
      limit = 100,
      offset = 0 
    } = body;

    // Create a scan run record
    const scanRun = await db.duplicateScanRun.create({
      data: {
        scanType,
        minScore,
        status: 'running'
      }
    });

    const detector = new AuthorDuplicateDetector();
    const startTime = Date.now();
    let duplicates: Array<{
      author1: { id: string; name: string };
      author2: { id: string; name: string };
      score: number;
      matchReasons: {
        exactMatch?: boolean;
        nameFlipped?: boolean;
        normalizedMatch?: boolean;
        fuzzyMatch?: number;
        phoneticMatch?: boolean;
        initialsMatch?: boolean;
        missingMiddle?: boolean;
        sharedExternalIds?: string[];
      };
      confidence: string;
    }> = [];
    let totalAuthors = 0;

    try {
      // Get total count of authors
      totalAuthors = await db.author.count();

      // Run the appropriate scan type
      switch (scanType) {
        case 'exact':
          const exactGroups = await detector.findExactDuplicates();
          // Transform to similarity format and get actual author names
          duplicates = [];
          for (const group of exactGroups) {
            // Fetch actual authors to get their exact names
            const authors = await db.author.findMany({
              where: { id: { in: group.authorIds } },
              select: { id: true, name: true }
            });
            
            // Create pairs from each group
            for (let i = 0; i < authors.length - 1; i++) {
              for (let j = i + 1; j < authors.length; j++) {
                duplicates.push({
                  author1: { id: authors[i].id, name: authors[i].name },
                  author2: { id: authors[j].id, name: authors[j].name },
                  score: 100,
                  matchReasons: { exactMatch: true },
                  confidence: 'exact'
                });
              }
            }
          }
          break;

        case 'flipped':
          duplicates = await detector.findFlippedNameDuplicates();
          break;

        case 'fuzzy':
        case 'full':
          duplicates = await detector.findAllDuplicates({
            minScore,
            limit,
            offset,
            onProgress: async (current, total) => {
              // Update progress (could emit websocket event here)
              console.log(`Progress: ${current}/${total}`);
            }
          });
          break;

        default:
          throw new Error(`Invalid scan type: ${scanType}`);
      }

      // Store the duplicates in the database
      for (const dup of duplicates) {
        // Check if this pair already exists (in either order)
        const existing = await db.authorSimilarity.findFirst({
          where: {
            OR: [
              { author1Id: dup.author1.id, author2Id: dup.author2.id },
              { author1Id: dup.author2.id, author2Id: dup.author1.id }
            ]
          }
        });

        if (!existing) {
          await db.authorSimilarity.create({
            data: {
              author1Id: dup.author1.id,
              author1Name: dup.author1.name,
              author2Id: dup.author2.id,
              author2Name: dup.author2.name,
              score: dup.score,
              confidence: dup.confidence,
              matchReasons: dup.matchReasons
            }
          });
        }
      }

      const processingTimeMs = Date.now() - startTime;

      // Update scan run with results
      await db.duplicateScanRun.update({
        where: { id: scanRun.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          totalAuthors,
          duplicatesFound: duplicates.length,
          processingTimeMs
        }
      });

      return NextResponse.json({
        status: 'success',
        scanRunId: scanRun.id,
        duplicatesFound: duplicates.length,
        processingTimeMs,
        duplicates: duplicates.slice(0, 10) // Return first 10 for preview
      });

    } catch (error) {
      // Update scan run with error
      await db.duplicateScanRun.update({
        where: { id: scanRun.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }

  } catch (error) {
    console.error('Error detecting duplicates:', error);
    return NextResponse.json(
      { error: 'Failed to detect duplicates' },
      { status: 500 }
    );
  }
}

// GET /api/admin/duplicates/detect
// Get scan run status and history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scanRunId = searchParams.get('scanRunId');

    if (scanRunId) {
      // Get specific scan run
      const scanRun = await db.duplicateScanRun.findUnique({
        where: { id: scanRunId }
      });

      if (!scanRun) {
        return NextResponse.json(
          { error: 'Scan run not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(scanRun);
    } else {
      // Get recent scan runs
      const scanRuns = await db.duplicateScanRun.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      return NextResponse.json(scanRuns);
    }
  } catch (error) {
    console.error('Error fetching scan runs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scan runs' },
      { status: 500 }
    );
  }
}