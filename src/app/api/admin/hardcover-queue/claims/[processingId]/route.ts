import { NextRequest, NextResponse } from 'next/server';
import { releaseClaim } from '@/server/hardcoverQueue';

type Params = {
  params: Promise<{
    processingId: string;
  }>;
};

/**
 * DELETE /api/admin/hardcover-queue/claims/[processingId]
 * Release a specific processing claim
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  // Check for admin authentication
  const secret = req.headers.get('x-secret');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({
      status: 'error',
      message: 'Unauthorized',
    }, { status: 401 });
  }

  const p = await params;
  const { processingId } = p;

  if (!processingId) {
    return NextResponse.json({
      status: 'error',
      message: 'Missing processingId',
    }, { status: 400 });
  }

  try {
    const resetCount = await releaseClaim(processingId);

    if (resetCount === 0) {
      return NextResponse.json({
        status: 'ok',
        resetCount,
        message: `No claims found with processingId: ${processingId}`,
      });
    }

    return NextResponse.json({
      status: 'ok',
      resetCount,
      message: `Released ${resetCount} claims with processingId: ${processingId}`,
    });
  } catch (error) {
    console.error('Error releasing claim:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to release claim',
    }, { status: 500 });
  }
}