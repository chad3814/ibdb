import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';

// GET /api/admin/duplicates/stats
// Get duplicate detection statistics
export async function GET(request: NextRequest) {
  try {
    // Get counts by status
    const [
      totalAuthors,
      totalDuplicates,
      pendingCount,
      reviewedCount,
      mergedCount,
      dismissedCount,
      totalMerges,
      totalBooksReassigned
    ] = await Promise.all([
      db.author.count(),
      db.authorSimilarity.count(),
      db.authorSimilarity.count({ where: { status: 'pending' } }),
      db.authorSimilarity.count({ where: { status: 'reviewed' } }),
      db.authorSimilarity.count({ where: { status: 'merged' } }),
      db.authorSimilarity.count({ where: { status: 'dismissed' } }),
      db.authorMerge.count(),
      db.authorMerge.aggregate({
        _sum: { booksReassigned: true }
      })
    ]);

    // Get confidence distribution
    const confidenceDistribution = await db.authorSimilarity.groupBy({
      by: ['confidence'],
      _count: true,
      where: { status: 'pending' }
    });

    // Get score distribution for pending duplicates
    const scoreRanges = [
      { min: 95, max: 100, label: '95-100%' },
      { min: 90, max: 94, label: '90-94%' },
      { min: 85, max: 89, label: '85-89%' },
      { min: 80, max: 84, label: '80-84%' },
      { min: 70, max: 79, label: '70-79%' }
    ];

    const scoreDistribution = await Promise.all(
      scoreRanges.map(async (range) => ({
        ...range,
        count: await db.authorSimilarity.count({
          where: {
            status: 'pending',
            score: {
              gte: range.min,
              lte: range.max
            }
          }
        })
      }))
    );

    // Get recent scan runs
    const recentScans = await db.duplicateScanRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        completedAt: true,
        scanType: true,
        status: true,
        duplicatesFound: true,
        processingTimeMs: true
      }
    });

    // Get recent merges
    const recentMerges = await db.authorMerge.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        targetAuthorName: true,
        mergedAuthorNames: true,
        booksReassigned: true,
        mergedBy: true
      }
    });

    return NextResponse.json({
      overview: {
        totalAuthors,
        totalDuplicates,
        totalMerges,
        totalBooksReassigned: totalBooksReassigned._sum.booksReassigned || 0,
        estimatedDuplicateAuthors: Math.round(totalDuplicates * 2 - totalMerges), // Rough estimate
        duplicatePercentage: ((totalDuplicates * 2 - totalMerges) / totalAuthors * 100).toFixed(2)
      },
      status: {
        pending: pendingCount,
        reviewed: reviewedCount,
        merged: mergedCount,
        dismissed: dismissedCount
      },
      confidence: confidenceDistribution.reduce((acc: any, item) => {
        acc[item.confidence] = item._count;
        return acc;
      }, {}),
      scoreDistribution,
      recentScans,
      recentMerges
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}