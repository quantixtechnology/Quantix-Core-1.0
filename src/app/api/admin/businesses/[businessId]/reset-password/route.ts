// ============================================================================
// POST /api/admin/businesses/[businessId]/reset-password
// Generates a new random password for the CLIENT_OWNER of a business.
// Returns the plain-text password once — it is not stored.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import { withMiddleware } from '@/lib/middleware';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const specials = '!@#$%';
  let pwd = '';
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  pwd += specials[Math.floor(Math.random() * specials.length)];
  pwd += Math.floor(Math.random() * 10);
  return pwd;
}

export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'businesses:edit',
})(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }

    const businessUser = await db.businessUser.findFirst({
      where: { businessId, role: 'CLIENT_OWNER', isActive: true },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!businessUser) {
      return NextResponse.json(
        { success: false, error: 'No active owner found for this business' },
        { status: 404 }
      );
    }

    const newPassword = generatePassword();
    const hash = await hashPassword(newPassword);

    await db.user.update({
      where: { id: businessUser.userId },
      data: { passwordHash: hash, hasPassword: true, authProvider: 'PASSWORD', mustChangePassword: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: businessUser.user.id,
        email: businessUser.user.email,
        name: businessUser.user.name,
        newPassword,
      },
    });
  } catch (error) {
    console.error('[reset-password] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Reset failed' },
      { status: 500 }
    );
  }
});
