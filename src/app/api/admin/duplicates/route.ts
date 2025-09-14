import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';

// GET /api/admin/duplicates
// Get list of duplicate pairs for review
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const minScore = parseInt(searchParams.get('minScore') || '70');
    const confidence = searchParams.get('confidence');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: {
      status: string;
      score: { gte: number };
      confidence?: string;
    } = {
      status,
      score: { gte: minScore }
    };

    if (confidence) {
      where.confidence = confidence;
    }

    const duplicates = await db.authorSimilarity.findMany({
      where,
      orderBy: [
        { score: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit,
      skip: offset,
      include: {
        merge: true
      }
    });

    // Get total count for pagination
    const total = await db.authorSimilarity.count({ where });

    // Enrich with current author data
    const enrichedDuplicates = await Promise.all(
      duplicates.map(async (dup) => {
        const [author1, author2] = await Promise.all([
          db.author.findUnique({
            where: { id: dup.author1Id },
            include: {
              books: {
                select: { id: true, title: true }
              }
            }
          }),
          db.author.findUnique({
            where: { id: dup.author2Id },
            include: {
              books: {
                select: { id: true, title: true }
              }
            }
          })
        ]);

        return {
          ...dup,
          author1: author1 || { 
            id: dup.author1Id, 
            name: dup.author1Name,
            books: [],
            deleted: true 
          },
          author2: author2 || { 
            id: dup.author2Id, 
            name: dup.author2Name,
            books: [],
            deleted: true 
          }
        };
      })
    );

    return NextResponse.json({
      duplicates: enrichedDuplicates,
      total,
      limit,
      offset
    });

  } catch (error) {
    console.error('Error fetching duplicates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch duplicates' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/duplicates
// Update duplicate pair status (review/dismiss)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id, 
      status, 
      reviewedBy = 'admin', // TODO: Get from auth
      notes 
    } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: id and status' },
        { status: 400 }
      );
    }

    if (!['pending', 'reviewed', 'merged', 'dismissed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const updated = await db.authorSimilarity.update({
      where: { id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy,
        notes
      }
    });

    return NextResponse.json(updated);

  } catch (error) {
    console.error('Error updating duplicate:', error);
    return NextResponse.json(
      { error: 'Failed to update duplicate' },
      { status: 500 }
    );
  }
}