// ============================================================================
// POST /api/customer/auth/refresh
// Mobile: rotate refresh token and get a new one.
// Request:  { refreshToken }  OR  Authorization: Bearer <refreshToken>
// Response: { success, token, refreshToken }
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const REFRESH_TOKEN_EXPIRY_DAYS = 60;

function generateRefreshToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let t = '';
  for (let i = 0; i < 64; i++) t += chars.charAt(Math.floor(Math.random() * chars.length));
  return t;
}

export async function POST(request: Request) {
  try {
    // Accept token from body OR Authorization header
    let refreshToken: string | undefined;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      refreshToken = authHeader.slice(7).trim();
    } else {
      const body = await request.json().catch(() => ({})) as { refreshToken?: string };
      refreshToken = body.refreshToken;
    }

    if (!refreshToken) {
      return NextResponse.json({ success: false, error: 'refreshToken is required' }, { status: 400 });
    }

    const record = await db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { select: { id: true, isActive: true } } },
    });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Invalid refresh token' }, { status: 401 });
    }
    if (record.expiresAt < new Date()) {
      await db.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
      return NextResponse.json({ success: false, error: 'Refresh token expired. Please login again.' }, { status: 401 });
    }
    if (!record.user.isActive) {
      await db.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
      return NextResponse.json({ success: false, error: 'Account is deactivated.' }, { status: 403 });
    }

    // Rotate: delete old, issue new
    await db.refreshToken.delete({ where: { id: record.id } });

    const newToken = generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await db.refreshToken.create({
      data: { userId: record.userId, token: newToken, expiresAt },
    });

    return NextResponse.json({
      success: true,
      token: newToken,
      refreshToken: newToken,
    });
  } catch (error) {
    console.error('[customer/auth/refresh]', error);
    return NextResponse.json({ success: false, error: 'Token refresh failed' }, { status: 500 });
  }
}
