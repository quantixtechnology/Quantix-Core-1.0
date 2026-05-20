// ============================================================================
// GET   /api/core/businesses/[businessId]/stores/[storeId]/payment-config
//        → List all store gateway configs (credentials masked)
// POST  /api/core/businesses/[businessId]/stores/[storeId]/payment-config
//        → Create / upsert per-store gateway config with encrypted credentials
// PATCH /api/core/businesses/[businessId]/stores/[storeId]/payment-config
//        → Toggle isActive or update individual fields
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/encrypt'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

// ── GET ──────────────────────────────────────────────────────────────────────

export const GET = withMiddleware({ requireAuth: true })(
  async (req, ctx?: Ctx) => {
    try {
      const params     = await ctx?.params
      const businessId = params?.businessId as string | undefined
      const storeId    = params?.storeId    as string | undefined
      if (!businessId || !storeId) return createErrorResponse('Missing params', 400)

      const configs = await db.storePaymentGateway.findMany({
        where: { businessId, storeId },
        include: {
          plugin: { select: { id: true, gateway: true, displayName: true, supportedMethods: true, webhookPath: true } },
        },
        orderBy: { createdAt: 'asc' },
      })

      const data = configs.map((c) => ({
        id:               c.id,
        pluginId:         c.pluginId,
        gateway:          c.plugin.gateway,
        displayName:      c.plugin.displayName,
        supportedMethods: (() => { try { return JSON.parse(c.plugin.supportedMethods) } catch { return [] } })(),
        webhookPath:      c.plugin.webhookPath,
        isActive:         c.isActive,
        environment:      c.environment,
        merchantId:       c.merchantId ?? null,
        hasApiKey:        !!c.apiKeyEnc,
        hasSecret:        !!c.secretKeyEnc,
        hasWebhookSecret: !!c.webhookSecretEnc,
        webhookUrl: c.plugin.webhookPath
          ? `/api/payment/webhook/${storeId}/${c.plugin.gateway}`
          : null,
      }))

      return NextResponse.json({ success: true, data })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to get configs', 500)
    }
  },
)

// ── POST ─────────────────────────────────────────────────────────────────────

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'CLIENT_OWNER', 'STORE_MANAGER'],
})(async (req, ctx?: Ctx) => {
  try {
    const params     = await ctx?.params
    const businessId = params?.businessId as string | undefined
    const storeId    = params?.storeId    as string | undefined
    if (!businessId || !storeId) return createErrorResponse('Missing params', 400)

    const body = await req.json() as {
      pluginId:      string
      accessId:      string
      environment?:  string
      merchantId?:   string
      apiKey?:       string
      secretKey?:    string
      webhookSecret?: string
      isActive?:     boolean
      extraConfig?:  Record<string, unknown>
    }

    if (!body.pluginId || !body.accessId) return createErrorResponse('pluginId and accessId required', 400)

    // Verify the access record belongs to this business
    const access = await db.businessGatewayAccess.findFirst({
      where: { id: body.accessId, businessId },
    })
    if (!access) return createErrorResponse('Gateway access not found', 404)
    if (!access.canConfigure) return createErrorResponse('Business is not permitted to configure this gateway', 403)

    const config = await db.storePaymentGateway.upsert({
      where: { storeId_pluginId: { storeId, pluginId: body.pluginId } },
      update: {
        environment:      body.environment  ?? 'SANDBOX',
        merchantId:       body.merchantId   ?? null,
        apiKeyEnc:        body.apiKey       ? encrypt(body.apiKey)       : undefined,
        secretKeyEnc:     body.secretKey    ? encrypt(body.secretKey)    : undefined,
        webhookSecretEnc: body.webhookSecret ? encrypt(body.webhookSecret): undefined,
        isActive:         body.isActive     ?? false,
        extraConfig:      JSON.stringify(body.extraConfig ?? {}),
      },
      create: {
        businessId,
        storeId,
        pluginId:         body.pluginId,
        accessId:         body.accessId,
        environment:      body.environment  ?? 'SANDBOX',
        merchantId:       body.merchantId   ?? null,
        apiKeyEnc:        body.apiKey       ? encrypt(body.apiKey)       : undefined,
        secretKeyEnc:     body.secretKey    ? encrypt(body.secretKey)    : undefined,
        webhookSecretEnc: body.webhookSecret ? encrypt(body.webhookSecret): undefined,
        isActive:         body.isActive     ?? false,
        extraConfig:      JSON.stringify(body.extraConfig ?? {}),
      },
    })

    // Mark parent BusinessGatewayAccess as active when any store is configured
    await db.businessGatewayAccess.update({
      where: { id: body.accessId },
      data:  { isActive: true },
    })

    return NextResponse.json({ success: true, data: { id: config.id } }, { status: 201 })
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : 'Failed to save config', 500)
  }
})

// ── PATCH ─────────────────────────────────────────────────────────────────────

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'CLIENT_OWNER', 'STORE_MANAGER'],
})(async (req, ctx?: Ctx) => {
  try {
    const params     = await ctx?.params
    const businessId = params?.businessId as string | undefined
    const storeId    = params?.storeId    as string | undefined
    if (!businessId || !storeId) return createErrorResponse('Missing params', 400)

    const body = await req.json() as {
      pluginId:      string
      environment?:  string
      merchantId?:   string
      apiKey?:       string
      secretKey?:    string
      webhookSecret?: string
      isActive?:     boolean
    }

    if (!body.pluginId) return createErrorResponse('pluginId required', 400)

    const updates: Record<string, unknown> = {}
    if (body.environment  !== undefined) updates.environment     = body.environment
    if (body.merchantId   !== undefined) updates.merchantId      = body.merchantId || null
    if (body.apiKey)                     updates.apiKeyEnc        = encrypt(body.apiKey)
    if (body.secretKey)                  updates.secretKeyEnc     = encrypt(body.secretKey)
    if (body.webhookSecret)              updates.webhookSecretEnc  = encrypt(body.webhookSecret)
    if (body.isActive     !== undefined) updates.isActive         = body.isActive

    await db.storePaymentGateway.update({
      where: { storeId_pluginId: { storeId, pluginId: body.pluginId } },
      data:  updates,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : 'Failed to update config', 500)
  }
})
