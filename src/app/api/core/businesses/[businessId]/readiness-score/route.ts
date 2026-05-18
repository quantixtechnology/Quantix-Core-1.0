// ============================================================================
// GET /api/core/businesses/[businessId]/readiness-score
// Phase 12 — Final App Readiness Score
// Returns readiness % and blocking checklist for:
//   Customer App, Delivery App, POS App, Admin App
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

interface Check {
  key:    string
  label:  string
  passed: boolean
  weight: number
}

function score(checks: Check[]): { score: number; passed: number; total: number; checks: Check[] } {
  const totalWeight  = checks.reduce((s, c) => s + c.weight, 0)
  const passedWeight = checks.filter(c => c.passed).reduce((s, c) => s + c.weight, 0)
  const pct = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0
  return { score: pct, passed: checks.filter(c => c.passed).length, total: checks.length, checks }
}

export const GET = withMiddleware({ requireAuth: true })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const [
        business, stores, categories, products, inventory, taxConfigs,
        deliveryZones, paymentGateways, featureFlags, branding, appConfig,
        deliveryPartners, posSession, customers,
      ] = await Promise.all([
        db.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, gstNumber: true, contactPhone: true, contactEmail: true, status: true, isOnline: true } }),
        db.store.findMany({ where: { businessId }, select: { id: true, posEnabled: true, status: true } }),
        db.category.count({ where: { businessId, isActive: true } }),
        db.product.count({ where: { businessId, status: 'ACTIVE' } }),
        db.inventory.count({ where: { product: { businessId }, status: { in: ['IN_STOCK', 'LOW_STOCK'] } } }),
        db.taxConfig.count({ where: { businessId, isActive: true } }),
        db.deliveryZone.count({ where: { businessId, isActive: true } }),
        db.paymentGateway.count({ where: { businessId, isActive: true } }),
        db.featureFlag.findMany({ where: { businessId }, select: { key: true, enabled: true } }),
        db.businessBranding.findUnique({ where: { businessId }, select: { id: true, logo: true, primaryColor: true } }),
        db.appConfig.findUnique({ where: { businessId }, select: { id: true, appName: true } }),
        db.deliveryPartner.count({ where: { businessId, isActive: true } }),
        db.pOSSession.count({ where: { businessId } }),
        db.customer.count({ where: { businessId, isActive: true } }),
      ])

      if (!business) return createErrorResponse('Business not found', 404)

      const flagMap = Object.fromEntries(featureFlags.map(f => [f.key, f.enabled]))
      const activeStores  = stores.filter(s => s.status === 'ACTIVE').length
      const posStores     = stores.filter(s => s.posEnabled).length

      // ── Customer App ────────────────────────────────────────────────────────
      const customerChecks: Check[] = [
        { key: 'business_active',      label: 'Business is active',              passed: business.status === 'ACTIVE',               weight: 10 },
        { key: 'active_store',         label: 'At least one active store',       passed: activeStores > 0,                           weight: 10 },
        { key: 'categories_exist',     label: 'Categories configured',           passed: categories > 0,                             weight: 8  },
        { key: 'products_exist',       label: 'Active products listed',          passed: products > 0,                               weight: 10 },
        { key: 'inventory_stocked',    label: 'Products have stock',             passed: inventory > 0,                              weight: 8  },
        { key: 'branding_set',         label: 'Branding configured',             passed: !!branding,                                 weight: 6  },
        { key: 'logo_uploaded',        label: 'Business logo uploaded',          passed: !!branding?.logo,                           weight: 4  },
        { key: 'app_config_set',       label: 'App name configured',             passed: !!appConfig?.appName,                       weight: 4  },
        { key: 'delivery_zone',        label: 'Delivery zone defined',           passed: deliveryZones > 0,                          weight: 8  },
        { key: 'payment_gateway',      label: 'Payment method configured',       passed: paymentGateways > 0,                        weight: 8  },
        { key: 'online_orders',        label: 'Online orders enabled',           passed: !!flagMap['online_orders_enabled'],          weight: 8  },
        { key: 'contact_phone',        label: 'Contact phone set',               passed: !!business.contactPhone,                    weight: 4  },
        { key: 'gst_number',           label: 'GST number configured',           passed: !!business.gstNumber,                       weight: 4  },
        { key: 'tax_config',           label: 'Tax slabs configured',            passed: taxConfigs > 0,                             weight: 6  },
        { key: 'customers_exist',      label: 'Has registered customers',        passed: customers > 0,                              weight: 2  },
      ]

      // ── Delivery App ─────────────────────────────────────────────────────────
      const deliveryChecks: Check[] = [
        { key: 'business_active',      label: 'Business is active',              passed: business.status === 'ACTIVE',               weight: 10 },
        { key: 'delivery_enabled',     label: 'Delivery module enabled',         passed: !!flagMap['delivery_enabled'],               weight: 15 },
        { key: 'delivery_zone',        label: 'Delivery zones defined',          passed: deliveryZones > 0,                          weight: 15 },
        { key: 'delivery_partners',    label: 'Active delivery partners',        passed: deliveryPartners > 0,                       weight: 20 },
        { key: 'active_store',         label: 'Active store with orders',        passed: activeStores > 0,                           weight: 10 },
        { key: 'payment_gateway',      label: 'Payment methods configured',      passed: paymentGateways > 0,                        weight: 10 },
        { key: 'products_exist',       label: 'Products available',              passed: products > 0,                               weight: 10 },
        { key: 'contact_phone',        label: 'Support phone configured',        passed: !!business.contactPhone,                    weight: 10 },
      ]

      // ── POS App ──────────────────────────────────────────────────────────────
      const posChecks: Check[] = [
        { key: 'business_active',      label: 'Business is active',              passed: business.status === 'ACTIVE',               weight: 10 },
        { key: 'pos_enabled',          label: 'POS module enabled',              passed: !!flagMap['pos_enabled'],                   weight: 15 },
        { key: 'pos_store',            label: 'Store with POS enabled',          passed: posStores > 0,                              weight: 15 },
        { key: 'products_exist',       label: 'Active products listed',          passed: products > 0,                               weight: 10 },
        { key: 'inventory_stocked',    label: 'Inventory has stock',             passed: inventory > 0,                              weight: 10 },
        { key: 'tax_config',           label: 'Tax slabs configured',            passed: taxConfigs > 0,                             weight: 10 },
        { key: 'payment_gateway',      label: 'Payment methods configured',      passed: paymentGateways > 0,                        weight: 10 },
        { key: 'categories_exist',     label: 'Product categories set up',       passed: categories > 0,                             weight: 8  },
        { key: 'gst_number',           label: 'GST number for invoices',         passed: !!business.gstNumber,                       weight: 7  },
        { key: 'pos_session_used',     label: 'POS session history',             passed: posSession > 0,                             weight: 5  },
      ]

      // ── Admin App ────────────────────────────────────────────────────────────
      const adminChecks: Check[] = [
        { key: 'business_active',      label: 'Business is active',              passed: business.status === 'ACTIVE',               weight: 10 },
        { key: 'active_store',         label: 'At least one active store',       passed: activeStores > 0,                           weight: 10 },
        { key: 'products_exist',       label: 'Products configured',             passed: products > 0,                               weight: 10 },
        { key: 'categories_exist',     label: 'Categories set up',               passed: categories > 0,                             weight: 8  },
        { key: 'inventory_stocked',    label: 'Inventory tracked',               passed: inventory > 0,                              weight: 8  },
        { key: 'tax_config',           label: 'Tax configured',                  passed: taxConfigs > 0,                             weight: 8  },
        { key: 'payment_gateway',      label: 'Payment methods set up',          passed: paymentGateways > 0,                        weight: 8  },
        { key: 'branding_set',         label: 'Branding configured',             passed: !!branding,                                 weight: 6  },
        { key: 'gst_number',           label: 'GST number set',                  passed: !!business.gstNumber,                       weight: 6  },
        { key: 'contact_email',        label: 'Contact email set',               passed: !!business.contactEmail,                    weight: 4  },
        { key: 'contact_phone',        label: 'Contact phone set',               passed: !!business.contactPhone,                    weight: 4  },
        { key: 'delivery_zone',        label: 'Delivery configured',             passed: deliveryZones > 0,                          weight: 8  },
        { key: 'customers_exist',      label: 'Has customer data',               passed: customers > 0,                              weight: 4  },
        { key: 'app_config_set',       label: 'App config complete',             passed: !!appConfig,                                weight: 6  },
      ]

      const customerResult = score(customerChecks)
      const deliveryResult = score(deliveryChecks)
      const posResult      = score(posChecks)
      const adminResult    = score(adminChecks)

      const overallScore = Math.round(
        (customerResult.score + deliveryResult.score + posResult.score + adminResult.score) / 4,
      )

      const blockers = [
        ...customerChecks.filter(c => !c.passed && c.weight >= 8).map(c => ({ app: 'customer', ...c })),
        ...deliveryChecks.filter(c => !c.passed && c.weight >= 10).map(c => ({ app: 'delivery', ...c })),
        ...posChecks.filter(c => !c.passed && c.weight >= 10).map(c => ({ app: 'pos', ...c })),
        ...adminChecks.filter(c => !c.passed && c.weight >= 8).map(c => ({ app: 'admin', ...c })),
      ]

      return NextResponse.json({
        success: true,
        data: {
          businessId,
          businessName:  business.name,
          overallScore,
          readyForFlutter: overallScore >= 80,
          apps: {
            customer: customerResult,
            delivery: deliveryResult,
            pos:      posResult,
            admin:    adminResult,
          },
          topBlockers: blockers.sort((a, b) => b.weight - a.weight).slice(0, 10),
          checkedAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to compute readiness score', 500)
    }
  },
)
