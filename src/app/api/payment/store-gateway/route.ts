// ============================================================================
// GET /api/payment/store-gateway?storeId=xxx&gateway=razorpay
// Runtime gateway lookup — used by POS, Storefront, Customer App.
// Returns decrypted credentials ONLY server-side for initiation flows.
// Never expose raw keys to the browser; call this from server actions only.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { decrypt } from '@/lib/encrypt'

export const GET = withMiddleware({ requireAuth: true })(
  async (req) => {
    try {
      const { searchParams } = new URL(req.url)
      const storeId  = searchParams.get('storeId')
      const gateway  = searchParams.get('gateway')
      const expose   = searchParams.get('expose') === 'true'  // Only allowed server-side calls should set this

      if (!storeId || !gateway) return createErrorResponse('storeId and gateway are required', 400)

      const plugin = await db.platformPaymentPlugin.findUnique({ where: { gateway } })
      if (!plugin) return createErrorResponse('Gateway not found', 404)
      if (!plugin.isGloballyEnabled) return createErrorResponse('Gateway is not enabled', 403)

      const config = await db.storePaymentGateway.findUnique({
        where: { storeId_pluginId: { storeId, pluginId: plugin.id } },
        include: {
          store:   { select: { id: true, name: true, businessId: true } },
          plugin:  { select: { id: true, gateway: true, displayName: true, supportedMethods: true } },
          access:  { select: { isAssigned: true, isActive: true } },
        },
      })

      if (!config) return createErrorResponse('Gateway not configured for this store', 404)
      if (!config.access.isAssigned) return createErrorResponse('Gateway not assigned to this business', 403)
      if (!config.isActive) return createErrorResponse('Gateway is inactive for this store', 403)

      const supportedMethods = (() => {
        try { return JSON.parse(config.plugin.supportedMethods) } catch { return [] }
      })()

      const baseResponse = {
        storeId:          config.storeId,
        storeName:        config.store.name,
        businessId:       config.store.businessId,
        gateway:          config.plugin.gateway,
        displayName:      config.plugin.displayName,
        supportedMethods,
        environment:      config.environment,
        isActive:         config.isActive,
        merchantId:       config.merchantId ?? null,
        webhookUrl:       `/api/payment/webhook/${storeId}/${gateway}`,
      }

      if (expose) {
        return NextResponse.json({
          success: true,
          data: {
            ...baseResponse,
            apiKey:        config.apiKeyEnc        ? decrypt(config.apiKeyEnc)        : null,
            secretKey:     config.secretKeyEnc     ? decrypt(config.secretKeyEnc)     : null,
            webhookSecret: config.webhookSecretEnc ? decrypt(config.webhookSecretEnc) : null,
          },
        })
      }

      return NextResponse.json({ success: true, data: baseResponse })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to load gateway', 500)
    }
  },
)
