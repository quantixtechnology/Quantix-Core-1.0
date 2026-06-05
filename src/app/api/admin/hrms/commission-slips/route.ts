// ============================================================================
// Commission Slip API — Quantix Internal HRMS
//
// Amounts generated dynamically from:
//   OwnershipAssignment + BusinessSubscription + Addon + CommissionPolicy
//
// A saved slip stores a JSON snapshot of lines so the record is
// immutable after approval even if tiers change in the future.
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

function applyTier(
  tiers: { minRevenue: number; maxRevenue: number; signupPct: number; renewalPct: number; addonPct: number }[],
  amount: number,
  type: 'signup' | 'renewal' | 'addon'
): number {
  const tier = [...tiers]
    .sort((a, b) => b.minRevenue - a.minRevenue)
    .find((t) => amount >= t.minRevenue && (t.maxRevenue === 0 || amount <= t.maxRevenue))
  if (!tier) return 0
  const pct = type === 'signup' ? tier.signupPct : type === 'renewal' ? tier.renewalPct : tier.addonPct
  return (amount * pct) / 100
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const employeeId = searchParams.get('employeeId') || undefined
      const status     = searchParams.get('status')     || undefined
      const page       = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
      const limit      = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))

      const where = {
        deletedAt: null as null,
        ...(employeeId ? { employeeId } : {}),
        ...(status ? { status: status as 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'PAID' } : {}),
      }

      const [rows, total] = await Promise.all([
        db.commissionSlip.findMany({
          where,
          include: { employee: { select: { id: true, name: true, employeeCode: true, designation: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.commissionSlip.count({ where }),
      ])

      return NextResponse.json({ success: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (req: NextRequest) => {
    try {
      const body = await req.json() as {
        employeeId: string
        policyId?: string
        periodType: string
        periodFrom: string
        periodTo: string
        adjustments?: number
        adjustmentNote?: string
        notes?: string
        preview?: boolean
        generatedBy?: string
      }

      if (!body.employeeId || !body.periodFrom || !body.periodTo) {
        return createErrorResponse('employeeId, periodFrom, periodTo required', 400)
      }

      const from = new Date(body.periodFrom)
      const to   = new Date(body.periodTo)

      // 1. Ownership records where this employee owns any revenue type
      const allOwnership = await db.ownershipAssignment.findMany({
        where: {
          OR: [
            { signupOwnerId:  body.employeeId },
            { renewalOwnerId: body.employeeId },
            { addonOwnerId:   body.employeeId },
          ],
        },
      })

      const signupClientIds  = allOwnership.filter((o) => o.signupOwnerId  === body.employeeId).map((o) => o.clientBusinessId)
      const renewalClientIds = allOwnership.filter((o) => o.renewalOwnerId === body.employeeId).map((o) => o.clientBusinessId)
      const addonClientIds   = allOwnership.filter((o) => o.addonOwnerId   === body.employeeId).map((o) => o.clientBusinessId)

      // 2. Active commission policy covering this period
      const policy = body.policyId
        ? await db.commissionPolicy.findUnique({ where: { id: body.policyId } })
        : await db.commissionPolicy.findFirst({
            where: {
              isActive:      true,
              effectiveFrom: { lte: to },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
            },
            orderBy: { effectiveFrom: 'desc' },
          })

      const tiers: { minRevenue: number; maxRevenue: number; signupPct: number; renewalPct: number; addonPct: number }[] =
        policy ? JSON.parse(policy.tiers) : []

      // 3. Signup commission
      type SignupLine = { businessId: string; businessName: string; plan: string; amount: number; tier: string; commissionPct: number; commissionEarned: number }
      const signupLines: SignupLine[] = []
      if (signupClientIds.length > 0) {
        const signupBizList = await db.business.findMany({
          where: { id: { in: signupClientIds }, createdAt: { gte: from, lte: to } },
          select: { id: true, name: true, businessSubscription: { select: { finalAmount: true, plan: { select: { name: true } } } } },
        })
        for (const biz of signupBizList) {
          const amount = biz.businessSubscription?.finalAmount ?? 0
          const tier   = tiers.find((t) => amount >= t.minRevenue && (t.maxRevenue === 0 || amount <= t.maxRevenue))
          signupLines.push({
            businessId:       biz.id,
            businessName:     biz.name,
            plan:             biz.businessSubscription?.plan?.name ?? 'N/A',
            amount,
            tier:             tier ? `₹${tier.minRevenue.toLocaleString()}–₹${tier.maxRevenue ? tier.maxRevenue.toLocaleString() : '∞'}` : 'No tier',
            commissionPct:    tier?.signupPct ?? 0,
            commissionEarned: applyTier(tiers, amount, 'signup'),
          })
        }
      }

      // 4. Renewal commission
      type RenewalLine = { businessId: string; businessName: string; plan: string; renewalAmount: number; commissionPct: number; commissionEarned: number }
      const renewalLines: RenewalLine[] = []
      if (renewalClientIds.length > 0) {
        const renewalSubs = await db.businessSubscription.findMany({
          where: { businessId: { in: renewalClientIds } },
          include: {
            billingHistory: { where: { status: 'paid', paidDate: { gte: from, lte: to } } },
            plan: { select: { name: true } },
            business: { select: { id: true, name: true } },
          },
        })
        for (const sub of renewalSubs) {
          for (const record of sub.billingHistory) {
            const amount = record.amount
            renewalLines.push({
              businessId:       sub.business.id,
              businessName:     sub.business.name,
              plan:             sub.plan?.name ?? 'N/A',
              renewalAmount:    amount,
              commissionPct:    tiers.find((t) => amount >= t.minRevenue && (t.maxRevenue === 0 || amount <= t.maxRevenue))?.renewalPct ?? 0,
              commissionEarned: applyTier(tiers, amount, 'renewal'),
            })
          }
        }
      }

      // 5. Addon commission
      type AddonLine = { businessId: string; businessName: string; addonName: string; addonType: string; amount: number; commissionPct: number; commissionEarned: number }
      const addonLines: AddonLine[] = []
      if (addonClientIds.length > 0) {
        const addons = await db.addon.findMany({
          where: { businessId: { in: addonClientIds }, startDate: { gte: from, lte: to }, status: 'ACTIVE' },
          include: { business: { select: { id: true, name: true } } },
        })
        for (const addon of addons) {
          const amount = addon.amount
          addonLines.push({
            businessId:       addon.business.id,
            businessName:     addon.business.name,
            addonName:        addon.name,
            addonType:        addon.billingType,
            amount,
            commissionPct:    tiers.find((t) => amount >= t.minRevenue && (t.maxRevenue === 0 || amount <= t.maxRevenue))?.addonPct ?? 0,
            commissionEarned: applyTier(tiers, amount, 'addon'),
          })
        }
      }

      const grossCommission =
        signupLines.reduce((s, l) => s + l.commissionEarned, 0) +
        renewalLines.reduce((s, l) => s + l.commissionEarned, 0) +
        addonLines.reduce((s, l) => s + l.commissionEarned, 0)

      const result = {
        signupLines, renewalLines, addonLines,
        policyId:            policy?.id ?? null,
        policyName:          policy?.name ?? null,
        grossCommission,
        adjustments:         body.adjustments ?? 0,
        finalPayable:        Math.max(0, grossCommission + (body.adjustments ?? 0)),
        totalSignupRevenue:  signupLines.reduce((s, l) => s + l.amount, 0),
        totalRenewalRevenue: renewalLines.reduce((s, l) => s + l.renewalAmount, 0),
        totalAddonRevenue:   addonLines.reduce((s, l) => s + l.amount, 0),
      }

      if (body.preview) {
        return NextResponse.json({ success: true, data: result })
      }

      const slip = await db.commissionSlip.create({
        data: {
          employeeId:     body.employeeId,
          periodType:     body.periodType ?? 'CUSTOM',
          periodFrom:     from,
          periodTo:       to,
          policyId:       policy?.id ?? null,
          signupLines:    JSON.stringify(signupLines),
          renewalLines:   JSON.stringify(renewalLines),
          addonLines:     JSON.stringify(addonLines),
          adjustments:    body.adjustments ?? 0,
          adjustmentNote: body.adjustmentNote,
          generatedBy:    body.generatedBy,
          notes:          body.notes,
          status:         'DRAFT',
        },
        include: { employee: { select: { id: true, name: true, employeeCode: true, designation: true } } },
      })

      return NextResponse.json({ success: true, data: { ...slip, ...result } }, { status: 201 })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
