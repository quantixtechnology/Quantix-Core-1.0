import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  return withAuth(request, async (_req, user) => {
    return NextResponse.json({
      success: true,
      data: user,
    });
  });
}
