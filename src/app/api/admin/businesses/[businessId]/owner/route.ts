// ============================================================================
// GET / PUT /api/admin/businesses/[businessId]/owner
//
// Super Admin management of a business's owner account: name, phone,
// email / login ID and password.
//
// It UPDATES the existing CLIENT_OWNER user and can never create one. The
// business → owner → RBAC chain is what makes the tenant work, so a second
// User created by an email edit would orphan the business from its owner while
// looking like a success. If no owner exists yet the request is refused with an
// explanation rather than quietly provisioning one.
//
// Guarded by withPlatformAccess — the same platform-only gate the rest of the
// admin user-management routes use. It resolves from User.platformRole, so no
// tenant role (CLIENT_OWNER, manager, staff) can reach it whatever permissions
// their business grants them.
//
// A password is hashed with the existing bcrypt helper, is never returned, and
// is never logged.
// ============================================================================

import { NextResponse } from 'next/server'
import { withPlatformAccess, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password-utils'
import type { NextRequest } from 'next/server'
import {
  validateOwnerAccount, ownerFieldChanges, changesPassword, requiresSessionInvalidation,
  isNoOp, mustChangePasswordFor, loginIdFollowsEmail, type OwnerAccountInput,
} from '@/lib/owner-account'

async function loadOwner(businessId: string) {
  const link = await db.businessUser.findFirst({
    where: { businessId, role: 'CLIENT_OWNER', isActive: true },
    select: {
      userId: true,
      user: {
        select: {
          id: true, name: true, email: true, loginId: true, phone: true,
          isActive: true, lastLoginAt: true, mustChangePassword: true, passwordChangedAt: true,
        },
      },
    },
  })
  return link?.user ?? null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  return withPlatformAccess(async () => {
    try {
      const { businessId } = await params
      const owner = await loadOwner(businessId)
      if (!owner) return createErrorResponse('No active owner account for this business', 404)
      // No passwordHash in the select above, so there is nothing here to leak.
      return NextResponse.json({ success: true, data: owner })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to load owner', 500)
    }
  })(request)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  return withPlatformAccess(async (req) => {
    try {
      const { businessId } = await params
      const body = (await req.json().catch(() => ({}))) as OwnerAccountInput

      const business = await db.business.findUnique({ where: { id: businessId }, select: { id: true } })
      if (!business) return createErrorResponse('Business not found', 404)

      const owner = await loadOwner(businessId)
      if (!owner) {
        return createErrorResponse(
          'This business has no owner account yet. Complete Provision Workspace first — the owner account is created there.',
          409,
        )
      }

      const invalid = validateOwnerAccount(body)
      if (invalid) return createErrorResponse(invalid, 400)

      const changes = ownerFieldChanges(body, { name: owner.name, phone: owner.phone, email: owner.email })
      const setsPassword = changesPassword(body)
      if (isNoOp(changes, setsPassword)) {
        return NextResponse.json({ success: true, data: owner, message: 'No changes' })
      }

      // Uniqueness. Login resolves an identifier against loginId FIRST and then
      // email, so an address already used as either by ANOTHER user would make
      // logins ambiguous. Refuse with a clear error — never merge, never create.
      if (changes.email) {
        const clash = await db.user.findFirst({
          where: {
            id: { not: owner.id },
            OR: [{ email: changes.email }, { loginId: changes.email }],
          },
          select: { id: true },
        })
        if (clash) {
          return createErrorResponse('That email / login ID already belongs to another user.', 409)
        }
      }

      const data: Record<string, unknown> = { ...changes }
      // Retire the old address as a login handle when it WAS the handle.
      if (changes.email && loginIdFollowsEmail(owner.loginId, owner.email)) {
        data.loginId = changes.email
      }
      if (setsPassword) {
        data.passwordHash = await hashPassword(String(body.password))
        data.hasPassword = true
        data.authProvider = 'PASSWORD'
        data.passwordChangedAt = new Date()
        // Deliberately chosen by the Super Admin, so it is a real password and
        // not a temporary one to be rotated on first login.
        data.mustChangePassword = mustChangePasswordFor('ADMIN_SET')
      }

      // The SAME user row. No create, no upsert — the BusinessUser link, the
      // business and every row hanging off it are untouched.
      const updated = await db.user.update({
        where: { id: owner.id },
        data,
        select: {
          id: true, name: true, email: true, loginId: true, phone: true,
          isActive: true, lastLoginAt: true, mustChangePassword: true, passwordChangedAt: true,
        },
      })

      // New credentials must actually take effect: an old refresh token would
      // otherwise keep the previous session alive. Renames and phone edits are
      // not credential changes and leave the owner signed in.
      let sessionsRevoked = false
      if (requiresSessionInvalidation(body, owner.email)) {
        await db.refreshToken.deleteMany({ where: { userId: owner.id } })
        sessionsRevoked = true
      }

      // Audit WHAT changed, never the value of the password.
      await db.activityLog.create({
        data: {
          businessId,
          action: 'business.owner_account_updated',
          entity: 'User',
          entityId: owner.id,
          details: JSON.stringify({
            fields: Object.keys(changes),
            passwordChanged: setsPassword,
            sessionsRevoked,
            updatedBy: req.user?.email ?? 'platform-admin',
          }),
        },
      }).catch(() => null)

      return NextResponse.json({ success: true, data: updated, sessionsRevoked })
    } catch (error) {
      // Never echo the request body: it may hold a plain-text password.
      const message = error instanceof Error ? error.message : 'Failed to update owner account'
      console.error('[businesses/owner] PUT failed:', message)
      return createErrorResponse(message, 500)
    }
  })(request)
}

export const runtime = 'nodejs'
