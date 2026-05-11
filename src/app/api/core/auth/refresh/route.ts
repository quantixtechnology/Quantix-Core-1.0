// ============================================================================
// Route: POST /api/core/auth/refresh
// Refresh access token using a valid refresh token
// Implements token rotation: old refresh token is deleted, new one issued
// ============================================================================

import { db } from '@/lib/db';
import { createAccessToken } from '@/lib/password-utils';
import { NextResponse } from 'next/server';

// New refresh token expiry: 7 days
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function generateRefreshToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = body as { refreshToken: string };

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Refresh token is required' },
        { status: 400 }
      );
    }

    // Find the refresh token
    const tokenRecord = await db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { success: false, error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    // Check if token is expired
    if (tokenRecord.expiresAt < new Date()) {
      // Delete expired token
      await db.refreshToken.delete({ where: { id: tokenRecord.id } }).catch(() => {});
      return NextResponse.json(
        { success: false, error: 'Refresh token has expired. Please login again.' },
        { status: 401 }
      );
    }

    // Check if user is still active
    if (!tokenRecord.user.isActive) {
      // Delete token for inactive user
      await db.refreshToken.delete({ where: { id: tokenRecord.id } }).catch(() => {});
      return NextResponse.json(
        { success: false, error: 'Account is deactivated.' },
        { status: 403 }
      );
    }

    // ─── Token Rotation ──────────────────────────────────────────────
    // Delete the old refresh token
    await db.refreshToken.delete({ where: { id: tokenRecord.id } });

    // Also delete any existing access tokens for this user (cleanup)
    // Note: we can't easily do this without tracking which tokens are access vs refresh,
    // so we rely on expiry for cleanup.

    // Create a new access token and store in database
    const accessToken = createAccessToken();
    const accessExpiresAt = new Date();
    accessExpiresAt.setHours(accessExpiresAt.getHours() + 24); // Access token: 24 hours

    await db.refreshToken.create({
      data: {
        userId: tokenRecord.userId,
        token: accessToken,
        expiresAt: accessExpiresAt,
      },
    });

    // Create a new refresh token (rotation)
    const newRefreshTokenValue = generateRefreshToken();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await db.refreshToken.create({
      data: {
        userId: tokenRecord.userId,
        token: newRefreshTokenValue,
        expiresAt: refreshExpiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshTokenValue,
      },
    });
  } catch (error) {
    console.error('[auth/refresh] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Token refresh failed.' },
      { status: 500 }
    );
  }
}
