import { NextRequest, NextResponse } from 'next/server';
import { releaseOldClaims } from '@/server/hardcoverQueue';

/**
 * POST /api/admin/hardcover-queue/reset
 * Reset claims older than specified minutes
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

  // Get olderThan parameter (default to 30 minutes)
  const olderThanParam = req.nextUrl.searchParams.get('olderThan');
  const olderThan = olderThanParam ? parseInt(olderThanParam, 10) : 30;

  if (isNaN(olderThan) || olderThan < 0) {
    return NextResponse.json({
      status: 'error',
      message: 'Invalid olderThan parameter',
    }, { status: 400 });
  }

  try {
    const resetCount = await releaseOldClaims(olderThan);

    return NextResponse.json({
      status: 'ok',
      resetCount,
      message: `Released ${resetCount} claims older than ${olderThan} minutes`,
    });
  } catch (error) {
    console.error('Error resetting old claims:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to reset old claims',
    }, { status: 500 });
  }
}