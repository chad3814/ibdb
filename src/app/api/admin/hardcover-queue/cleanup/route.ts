import { NextRequest, NextResponse } from 'next/server';
import { cleanupCompleted } from '@/server/hardcoverQueue';

/**
 * POST /api/admin/hardcover-queue/cleanup
 * Remove queue entries for books that already have hardcoverIds
 */
export async function POST(req: NextRequest) {
  // Check for admin authentication
  const secret = req.headers.get('x-secret');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({
      status: 'error',
      message: 'Unauthorized',
    }, { status: 401 });
  }

  try {
    const removedCount = await cleanupCompleted();

    return NextResponse.json({
      status: 'ok',
      removedCount,
      message: `Removed ${removedCount} completed books from queue`,
    });
  } catch (error) {
    console.error('Error cleaning up queue:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to cleanup queue',
    }, { status: 500 });
  }
}