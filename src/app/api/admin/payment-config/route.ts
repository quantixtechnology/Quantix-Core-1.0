// ============================================================================
// GET  /api/admin/payment-config  — Read bank & payment QR config
// PATCH /api/admin/payment-config — Upsert bank & payment QR config
// Super Admin (payment_config:view / payment_config:edit)
// Stored as a single JSON blob under PlatformConfig key "payment.config"
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

const CONFIG_KEY = 'payment.config'

// ── GET ───────────────────────────────────────────────────────────────────────
export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'proposals:view',
})(async (_req: NextRequest) => {
  try {
    const row = await db.platformConfig.findUnique({ where: { key: CONFIG_KEY } })
    const config = row ? JSON.parse(row.value) : {}
    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch payment config'
    return createErrorResponse(message, 500)
  }
})

// ── PATCH ─────────────────────────────────────────────────────────────────────
export const PATCH = withMiddleware({
  requireAuth: true,
  requiredPermission: 'payment_config:edit',
})(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const {
      accountName, bankName, accountNumber, ifsc,
      upiId, branch, qrUrl, active,
    } = body

    const config = {
      accountName:   accountName   ?? '',
      bankName:      bankName      ?? '',
      accountNumber: accountNumber ?? '',
      ifsc:          ifsc          ?? '',
      upiId:         upiId         ?? '',
      branch:        branch        ?? '',
      qrUrl:         qrUrl         ?? '',
      active:        active        !== false,
    }

    await db.platformConfig.upsert({
      where:  { key: CONFIG_KEY },
      create: { key: CONFIG_KEY, value: JSON.stringify(config) },
      update: { value: JSON.stringify(config) },
    })

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save payment config'
    return createErrorResponse(message, 500)
  }
})
