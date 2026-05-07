// ============================================================================
// Route: POST /api/core/auth/logout
// Invalidates the refresh token on the server
// ============================================================================

import { db } from '@/lib/db';
import { logAuthActivity } from '@/lib/core/audit';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = body as { refreshToken?: string };

    // Attempt to find user from the refresh token for audit logging
    let userId: string | null = null;
    if (refreshToken) {
      try {
        const tokenRecord = await db.refreshToken.findUnique({
          where: { token: refreshToken },
          select: { userId: true },
        });
        if (tokenRecord) userId = tokenRecord.userId;
      } catch {
        // Token lookup failed, continue
      }
    }

    // Also try to find user from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!userId && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const tokenRecord = await db.refreshToken.findUnique({
          where: { token },
          select: { userId: true },
        });
        if (tokenRecord) userId = tokenRecord.userId;
      } catch {
        // Token lookup failed, continue
      }
    }

    // Log logout activity
    try {
      await logAuthActivity(userId, 'auth.logout', {}, request as unknown as { headers?: { get(name: string): string | null } });
    } catch { /* audit logging is non-blocking */ }

    if (refreshToken) {
      // Delete the refresh token from database
      try {
        await db.refreshToken.delete({
          where: { token: refreshToken },
        });
      } catch {
        // Token may already be deleted or not found — that's fine
      }
    }

    // Also try to delete via Authorization header (Bearer token)
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        await db.refreshToken.delete({
          where: { token },
        });
      } catch {
        // Token may not exist — that's fine
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('[auth/logout] Error:', error);
    // Even if server-side cleanup fails, return success
    // The client will clear its local state regardless
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}
