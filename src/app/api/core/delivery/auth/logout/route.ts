// ============================================================================
// POST /api/core/delivery/auth/logout
// Invalidates the delivery partner's access token stored in the DB
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const auth = request.headers.get('Authorization');
    const token = auth?.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json({ success: false, error: 'No token provided' }, { status: 400 });
    }

    // Delete all tokens for this token value (covers both access + related refresh tokens)
    await db.refreshToken.deleteMany({ where: { token } });

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logout failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
