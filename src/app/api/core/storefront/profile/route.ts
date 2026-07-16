// GET  /api/core/storefront/profile  — the logged-in customer's own profile
// PUT  /api/core/storefront/profile  — update Customer Master fields
//
// Reuses the single Customer model. Communication preferences + preferred
// language live in the existing Customer.metadata JSON (no new table/columns).
// Phone is intentionally NOT editable here (changing it requires OTP; the
// storefront OTP is email-based, so a phone-OTP flow is a separate feature).
import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { Role } from '@/lib/types'

const ROLES: Role[] = ['CUSTOMER', 'CLIENT_OWNER', 'STORE_MANAGER', 'STORE_OPERATOR', 'BILLING_STAFF', 'INVENTORY_STAFF', 'SUPPORT_STAFF', 'DELIVERY_STAFF']

interface CommPrefs { sms: boolean; whatsapp: boolean; email: boolean; push: boolean }
const DEFAULT_PREFS: CommPrefs = { sms: true, whatsapp: true, email: true, push: true }

function parseMeta(raw: string | null | undefined): { commPrefs: CommPrefs; preferredLanguage: string | null } {
  try {
    const m = raw ? JSON.parse(raw) : {}
    return {
      commPrefs: { ...DEFAULT_PREFS, ...(m.communicationPreferences || {}) },
      preferredLanguage: m.preferredLanguage ?? null,
    }
  } catch {
    return { commPrefs: { ...DEFAULT_PREFS }, preferredLanguage: null }
  }
}

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ROLES })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!
      const customer = await db.customer.findFirst({
        where: { userId: user.id, businessId },
        select: {
          id: true, name: true, email: true, phone: true, avatar: true, gstNumber: true,
          dateOfBirth: true, gender: true, emailVerified: true, phoneVerified: true,
          loyaltyTier: true, loyaltyPoints: true, totalOrders: true, totalSpent: true, metadata: true,
        },
      })
      if (!customer) return createErrorResponse('Customer profile not found', 404)
      const { metadata, ...rest } = customer
      const meta = parseMeta(metadata)
      return NextResponse.json({ success: true, data: { ...rest, commPrefs: meta.commPrefs, preferredLanguage: meta.preferredLanguage } })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to get profile', 500)
    }
  },
)

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ROLES })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!
      const body = await req.json() as {
        name?: string; email?: string; phone?: string; gstNumber?: string
        avatar?: string | null; dateOfBirth?: string | null; gender?: string | null
        commPrefs?: Partial<CommPrefs>; preferredLanguage?: string | null
      }

      const customer = await db.customer.findFirst({ where: { userId: user.id, businessId } })
      if (!customer) return createErrorResponse('Customer profile not found', 404)

      // Phone uniqueness (still validated if a caller sends it).
      if (body.phone && body.phone !== customer.phone) {
        const conflict = await db.customer.findFirst({ where: { businessId, phone: body.phone, id: { not: customer.id } } })
        if (conflict) return createErrorResponse('Phone number already in use', 409)
      }

      // Merge prefs / language into the existing metadata JSON (no new table).
      let metadata = customer.metadata
      if (body.commPrefs !== undefined || body.preferredLanguage !== undefined) {
        let m: Record<string, unknown> = {}
        try { m = customer.metadata ? JSON.parse(customer.metadata) : {} } catch { m = {} }
        if (body.commPrefs !== undefined) m.communicationPreferences = { ...DEFAULT_PREFS, ...(m.communicationPreferences as object || {}), ...body.commPrefs }
        if (body.preferredLanguage !== undefined) m.preferredLanguage = body.preferredLanguage
        metadata = JSON.stringify(m)
      }

      const updated = await db.customer.update({
        where: { id: customer.id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.gstNumber !== undefined ? { gstNumber: body.gstNumber } : {}),
          ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
          ...(body.dateOfBirth !== undefined ? { dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null } : {}),
          ...(body.gender !== undefined ? { gender: body.gender } : {}),
          metadata,
        },
        select: {
          id: true, name: true, email: true, phone: true, avatar: true, gstNumber: true,
          dateOfBirth: true, gender: true, emailVerified: true, phoneVerified: true, metadata: true,
        },
      })
      const { metadata: meta, ...rest } = updated
      const parsed = parseMeta(meta)
      return NextResponse.json({ success: true, data: { ...rest, commPrefs: parsed.commPrefs, preferredLanguage: parsed.preferredLanguage } })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to update profile', 500)
    }
  },
)
