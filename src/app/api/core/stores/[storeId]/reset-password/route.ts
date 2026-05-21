// ============================================================================
// POST /api/core/stores/[storeId]/reset-password
// Reset the password for STORE_MANAGER / STORE_OWNER users assigned to this store.
// Returns new plain-text credentials (shown once — store them immediately).
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';

type Ctx = { params?: Promise<Record<string, string | string[]>> }

function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const specials = '@#$!'
  let pw = specials[Math.floor(Math.random() * specials.length)]
  for (let i = 0; i < 9; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)]
  }
  // Shuffle
  return pw.split('').sort(() => Math.random() - 0.5).join('')
}

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context?: Ctx) => {
  try {
    const params = await context?.params
    const storeId = params?.storeId as string
    if (!storeId) {
      return NextResponse.json({ success: false, error: 'storeId is required' }, { status: 400 })
    }

    const user = req.user!

    // Verify store belongs to the caller's business
    const store = await db.store.findUnique({
      where: { id: storeId },
      select: { id: true, businessId: true, name: true },
    })
    if (!store) {
      return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 })
    }
    if (!user.isPlatformAdmin && store.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 })
    }

    // Find the active store manager(s) for this store
    const storeUsers = await db.businessUser.findMany({
      where: {
        storeId,
        isActive: true,
        role: { in: ['STORE_MANAGER', 'STORE_OPERATOR'] },
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    })

    if (storeUsers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active store manager found for this store.' },
        { status: 404 }
      )
    }

    const results: { userId: string; name: string; email: string; role: string; newPassword: string }[] = []
    for (const bu of storeUsers) {
      const newPassword = generatePassword()
      const hash = await hashPassword(newPassword)
      await db.user.update({
        where: { id: bu.user.id },
        data: { passwordHash: hash },
      })
      results.push({
        userId: bu.user.id,
        name: bu.user.name,
        email: bu.user.email,
        role: bu.role,
        newPassword,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Password reset for ${results.length} user(s). Show once — store immediately.`,
      data: { storeName: store.name, users: results },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset password'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
