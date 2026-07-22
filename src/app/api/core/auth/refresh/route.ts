// ============================================================================
// Route: POST /api/core/auth/refresh
// Refresh access token using a valid refresh token
// Implements token rotation: old refresh token is deleted, new one issued
//
// Idempotency: a short-lived in-memory cache maps old → new tokens so that
// near-simultaneous refreshes (from concurrent API calls in different modules
// or tabs) all receive the same new pair instead of each independently calling
// the rotation endpoint — which would cause all but the first to fail (the old
// token was already deleted) and cascade into a "Session expired" logout.
// ============================================================================

import { db } from '@/lib/db';
import { createAccessToken } from '@/lib/password-utils';
import { NextResponse } from 'next/server';

// New refresh token expiry: 60 days
const REFRESH_TOKEN_EXPIRY_DAYS = 60;

// ─── Idempotency cache ───────────────────────────────────────────────
// Maps old refresh token → { new tokens, timestamp }.  When the same old
// token is presented within the grace window, the cached result is returned
// instead of performing a second rotation (which would fail because the old
// token was already deleted by the first rotation).
const IDEMPOTENCY_TTL_MS = 10_000; // 10 seconds
const rotationCache = new Map<string, { accessToken: string; refreshToken: string; ts: number }>();

function getCachedRotation(oldToken: string): { accessToken: string; refreshToken: string } | null {
  const entry = rotationCache.get(oldToken);
  if (entry && Date.now() - entry.ts < IDEMPOTENCY_TTL_MS) return entry;
  rotationCache.delete(oldToken); // stale
  return null;
}

function setCachedRotation(oldToken: string, accessToken: string, refreshToken: string): void {
  rotationCache.set(oldToken, { accessToken, refreshToken, ts: Date.now() });
  // Throttled cleanup: prune stale entries once the map grows past a threshold
  if (rotationCache.size > 1000) {
    const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
    for (const [k, v] of rotationCache) if (v.ts < cutoff) rotationCache.delete(k);
  }
}

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

    // ── Idempotency check ───────────────────────────────────────────
    // If this exact old token was already rotated within the grace window,
    // return the SAME new pair instead of creating a duplicate rotation.
    const cached = getCachedRotation(refreshToken);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: { accessToken: cached.accessToken, refreshToken: cached.refreshToken },
      });
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

    // ── Cache rotation result for idempotency ───────────────────────
    setCachedRotation(refreshToken, accessToken, newRefreshTokenValue);

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
