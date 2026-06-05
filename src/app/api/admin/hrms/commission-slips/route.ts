// ============================================================================
// Commission Slip API
//
// Amounts are generated dynamically from:
//   OwnershipAssignment + BusinessSubscription + Addon + CommissionPolicy
//
// A saved slip stores a snapshot of the lines (JSON) so the record is
// immutable after approval even if tiers change in the future.
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

// Apply commission policy tiers to a revenue amount
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
      const businessId  = searchParams.get('businessId') || ''
      const employeeId  = searchParams.get('employeeId') || undefined
      const status      = searchParams.get('status') || undefined
      const page        = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
      const limit       = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))

      const where = {
        businessId,
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

      return NextResponse.json({
        success: true,
        data: rows,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (req: NextRequest) => {
    try {
      const body = await req.json() as {
        businessId: string       // HRMS business ID
        employeeId: string
        periodType: string
        periodFrom: string
        periodTo: string
        adjustments?: number
        adjustmentNote?: string
        notes?: string
        preview?: boolean        // true = calculate only, do not save
        generatedBy?: string
      }

      if (!body.businessId || !body.employeeId || !body.periodFrom || !body.periodTo) {
        return createErrorResponse('businessId, employeeId, periodFrom, periodTo required', 400)
      }

      const from = new Date(body.periodFrom)
      const to   = new Date(body.periodTo)

      // 1. Find all ownership records where this employee is an owner
      const allOwnership = await db.ownershipAssignment.findMany({
        where: {
          hrmsBusinessId: body.businessId,
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

      // 2. Active commission policy for this period
      const policy = await db.commissionPolicy.findFirst({
        where: {
          businessId: body.businessId,
          isActive:   true,
          effectiveFrom: { lte: to },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      })

      const tiers: { minRevenue: number; maxRevenue: number; signupPct: number; renewalPct: number; addonPct: number }[] =
        policy ? JSON.parse(policy.tiers) : []

      // 3. Signup commission — businesses created in the period
      type SignupLine = { businessId: string; businessName: string; plan: string; amount: number; tier: string; commissionPct: number; commissionEarned: number }
      const signupLines: SignupLine[] = []
      if (signupClientIds.length > 0) {
        const signupBizList = await db.business.findMany({
          where: { id: { in: signupClientIds }, createdAt: { gte: from, lte: to } },
          select: { id: true, name: true, businessSubscription: { select: { finalAmount: true, plan: { select: { name: true } } } } },
        })
        for (const biz of signupBizList) {
          const amount = biz.businessSubscription?.finalAmount ?? 0
          const tier = tiers.find((t) => amount >= t.minRevenue && (t.maxRevenue === 0 || amount <= t.maxRevenue))
          const pct  = tier?.signupPct ?? 0
          signupLines.push({
            businessId:      biz.id,
            businessName:    biz.name,
            plan:            biz.businessSubscription?.plan?.name ?? 'N/A',
            amount,
            tier:            tier ? `₹${tier.minRevenue.toLocaleString()}–₹${tier.maxRevenue ? tier.maxRevenue.toLocaleString() : '∞'}` : 'No tier',
            commissionPct:   pct,
            commissionEarned: applyTier(tiers, amount, 'signup'),
          })
        }
      }

      // 4. Renewal commission — paid billing records in the period
      type RenewalLine = { businessId: string; businessName: string; plan: string; renewalAmount: number; commissionPct: number; commissionEarned: number }
      const renewalLines: RenewalLine[] = []
      if (renewalClientIds.length > 0) {
        const renewalSubs = await db.businessSubscription.findMany({
          where: { businessId: { in: renewalClientIds } },
          include: {
            billingHistory: {
              where: { status: 'paid', paidDate: { gte: from, lte: to } },
            },
            plan: { select: { name: true } },
            business: { select: { id: true, name: true } },
          },
        })

        for (const sub of renewalSubs) {
          for (const record of sub.billingHistory) {
            const amount = record.amount
            const pct    = tiers.find((t) => amount >= t.minRevenue && (t.maxRevenue === 0 || amount <= t.maxRevenue))?.renewalPct ?? 0
            renewalLines.push({
              businessId:      sub.business.id,
              businessName:    sub.business.name,
              plan:            sub.plan?.name ?? 'N/A',
              renewalAmount:   amount,
              commissionPct:   pct,
              commissionEarned: applyTier(tiers, amount, 'renewal'),
            })
          }
        }
      }

      // 5. Addon commission — addons activated in the period
      type AddonLine = { businessId: string; businessName: string; addonName: string; addonType: string; amount: number; commissionPct: number; commissionEarned: number }
      const addonLines: AddonLine[] = []
      if (addonClientIds.length > 0) {
        const addons = await db.addon.findMany({
          where: {
            businessId: { in: addonClientIds },
            startDate: { gte: from, lte: to },
            status: 'ACTIVE',
          },
          include: { business: { select: { id: true, name: true } } },
        })
        for (const addon of addons) {
          const amount = addon.amount
          const pct    = tiers.find((t) => amount >= t.minRevenue && (t.maxRevenue === 0 || amount <= t.maxRevenue))?.addonPct ?? 0
          addonLines.push({
            businessId:      addon.business.id,
            businessName:    addon.business.name,
            addonName:       addon.name,
            addonType:       addon.billingType,
            amount,
            commissionPct:   pct,
            commissionEarned: applyTier(tiers, amount, 'addon'),
          })
        }
      }

      const grossCommission =
        signupLines.reduce((s, l) => s + l.commissionEarned, 0) +
        renewalLines.reduce((s, l) => s + l.commissionEarned, 0) +
        addonLines.reduce((s, l) => s + l.commissionEarned, 0)

      const result = {
        signupLines,
        renewalLines,
        addonLines,
        policyId:    policy?.id ?? null,
        policyName:  policy?.name ?? null,
        grossCommission,
        adjustments: body.adjustments ?? 0,
        finalPayable: Math.max(0, grossCommission + (body.adjustments ?? 0)),
        totalSignupRevenue:  signupLines.reduce((s, l) => s + l.amount, 0),
        totalRenewalRevenue: renewalLines.reduce((s, l) => s + l.renewalAmount, 0),
        totalAddonRevenue:   addonLines.reduce((s, l) => s + l.amount, 0),
      }

      // Preview mode — return calculation without saving
      if (body.preview) {
        return NextResponse.json({ success: true, data: result })
      }

      // Save as DRAFT slip
      const slip = await db.commissionSlip.create({
        data: {
          businessId:    body.businessId,
          employeeId:    body.employeeId,
          periodType:    body.periodType ?? 'CUSTOM',
          periodFrom:    from,
          periodTo:      to,
          policyId:      policy?.id ?? null,
          signupLines:   JSON.stringify(signupLines),
          renewalLines:  JSON.stringify(renewalLines),
          addonLines:    JSON.stringify(addonLines),
          adjustments:   body.adjustments ?? 0,
          adjustmentNote: body.adjustmentNote,
          generatedBy:   body.generatedBy,
          notes:         body.notes,
          status:        'DRAFT',
        },
        include: { employee: { select: { id: true, name: true, employeeCode: true, designation: true } } },
      })

      return NextResponse.json({ success: true, data: { ...slip, ...result } }, { status: 201 })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
