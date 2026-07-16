// ============================================================================
// Route: POST /api/core/auth/session-exchange
//
// Per-origin sessions. When a workspace is opened on a product origin
// (laundry.*, commerce.*, …) via session handoff, that origin must NOT reuse the
// launching origin's refresh token — otherwise rotating one origin's token
// invalidates the other (the multi-workspace / multi-tab logout bug).
//
// This endpoint takes a VALID existing token (the handed-off one) as proof of
// identity and mints a brand-new, INDEPENDENT access + refresh token pair for
// the calling origin. It deliberately does NOT delete or rotate the presented
// token — the launching origin keeps its own session. Both origins now share the
// same user identity but rotate their own refresh tokens independently.
//
// Security: rotation is fully preserved (each origin rotates its own token via
// /api/core/auth/refresh). Minting a new token requires an already-valid token,
// exactly like a normal authenticated action.
// ============================================================================

import { db } from '@/lib/db';
import { createAccessToken } from '@/lib/password-utils';
import { NextResponse } from 'next/server';

const REFRESH_TOKEN_EXPIRY_DAYS = 60;

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
    // Accept the presented token under either key for flexibility.
    const presented = (body?.token || body?.refreshToken) as string | undefined;

    if (!presented) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate the presented token (access OR refresh — both live in this table).
    const tokenRecord = await db.refreshToken.findUnique({
      where: { token: presented },
      include: { user: { select: { id: true, isActive: true } } },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }
    if (tokenRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Token has expired. Please login again.' },
        { status: 401 }
      );
    }
    if (!tokenRecord.user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated.' },
        { status: 403 }
      );
    }

    // Mint an INDEPENDENT access + refresh token for the calling origin.
    // The presented token is intentionally left intact (no delete / no rotation).
    const accessToken = createAccessToken();
    const accessExpiresAt = new Date();
    accessExpiresAt.setHours(accessExpiresAt.getHours() + 24); // 24h access token

    await db.refreshToken.create({
      data: { userId: tokenRecord.userId, token: accessToken, expiresAt: accessExpiresAt },
    });

    const newRefreshToken = generateRefreshToken();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await db.refreshToken.create({
      data: { userId: tokenRecord.userId, token: newRefreshToken, expiresAt: refreshExpiresAt },
    });

    return NextResponse.json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    console.error('[auth/session-exchange] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Session exchange failed.' },
      { status: 500 }
    );
  }
}
