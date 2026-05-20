// ============================================================================
// GET /api/core/businesses/[businessId]/payment-gateways
// Returns globally-enabled + business-assigned gateways with per-store configs
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { decrypt } from '@/lib/encrypt'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true })(
  async (req, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const plugins = await db.platformPaymentPlugin.findMany({
        where: { isGloballyEnabled: true },
        include: {
          businessAccess: {
            where: { businessId, isAssigned: true },
            take: 1,
            include: {
              storeConfigs: {
                where: { businessId },
                include: {
                  store: { select: { id: true, name: true, storeCode: true } },
                },
              },
            },
          },
        },
        orderBy: { displayName: 'asc' },
      })

      const assigned = plugins.filter((p) => p.businessAccess.length > 0)

      const data = assigned.map((p) => {
        const access = p.businessAccess[0]
        let assignedStoreIds: string[] = []
        try { assignedStoreIds = JSON.parse(access.assignedStoreIds) } catch { assignedStoreIds = [] }

        const storeConfigs = access.storeConfigs.map((sc) => ({
          id:          sc.id,
          storeId:     sc.storeId,
          storeName:   sc.store.name,
          storeCode:   sc.store.storeCode,
          isActive:    sc.isActive,
          environment: sc.environment,
          merchantId:  sc.merchantId ?? null,
          hasApiKey:   !!sc.apiKeyEnc,
          hasSecret:   !!sc.secretKeyEnc,
          hasWebhookSecret: !!sc.webhookSecretEnc,
          // Never expose raw decrypted keys to the client — only presence flags
        }))

        return {
          pluginId:        p.id,
          gateway:         p.gateway,
          displayName:     p.displayName,
          description:     p.description,
          supportedMethods: (() => { try { return JSON.parse(p.supportedMethods) } catch { return [] } })(),
          webhookPath:     p.webhookPath,
          docsUrl:         p.docsUrl,
          accessId:        access.id,
          canConfigure:    access.canConfigure,
          isActive:        access.isActive,
          assignedStoreIds,
          storeConfigs,
        }
      })

      return NextResponse.json({ success: true, data })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to list gateways', 500)
    }
  },
)
