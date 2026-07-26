// GET/PUT /api/laundry/payment-gateway?businessId= — online payment gateway
// config for a laundry business. Providers are enabled globally by the platform
// (PlatformPaymentPlugin.isGloballyEnabled); the business enters its OWN keys
// here (encrypted, business-level — laundry has no core Store for the standard
// StorePaymentGateway). Secrets are NEVER returned — only has* flags.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { encrypt } from "@/lib/encrypt"

export const runtime = "nodejs"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const maskConfig = (c: any) => ({
  gateway: c.gateway, environment: c.environment, isActive: c.isActive, merchantId: c.merchantId ?? null,
  hasApiKey: !!c.apiKeyEnc, hasSecret: !!c.secretKeyEnc, hasWebhookSecret: !!c.webhookSecretEnc,
  updatedAt: c.updatedAt,
})

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const [plugins, configs] = await Promise.all([
      prisma.platformPaymentPlugin.findMany({ where: { isGloballyEnabled: true }, select: { gateway: true, displayName: true, description: true, supportedMethods: true, docsUrl: true } }),
      prisma.laundryPaymentGateway.findMany({ where: { businessId: biz.id } }),
    ])
    const byGateway = new Map(configs.map((c) => [c.gateway, c]))
    return NextResponse.json({
      success: true,
      data: {
        providers: plugins.map((p) => ({ ...p, config: byGateway.has(p.gateway) ? maskConfig(byGateway.get(p.gateway)) : null })),
      },
    })
  } catch (e) {
    console.error("[laundry-payment-gateway] GET", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const b = await request.json()
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const gateway = String(b.gateway || "").trim()
    if (!gateway) return NextResponse.json({ success: false, error: "gateway is required" }, { status: 400 })
    // Only a platform-enabled provider can be configured.
    const plugin = await prisma.platformPaymentPlugin.findFirst({ where: { gateway, isGloballyEnabled: true }, select: { gateway: true } })
    if (!plugin) return NextResponse.json({ success: false, error: "This provider isn't enabled for your account. Ask the platform to enable it." }, { status: 403 })

    // Only overwrite a secret when a new value is supplied (blank = keep existing).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {
      environment: b.environment === "LIVE" ? "LIVE" : "SANDBOX",
      isActive: !!b.isActive,
      merchantId: b.merchantId ? String(b.merchantId) : null,
    }
    if (typeof b.apiKey === "string" && b.apiKey.trim()) data.apiKeyEnc = encrypt(b.apiKey.trim())
    if (typeof b.secretKey === "string" && b.secretKey.trim()) data.secretKeyEnc = encrypt(b.secretKey.trim())
    if (typeof b.webhookSecret === "string" && b.webhookSecret.trim()) data.webhookSecretEnc = encrypt(b.webhookSecret.trim())

    const saved = await prisma.laundryPaymentGateway.upsert({
      where: { businessId_gateway: { businessId: biz.id, gateway } },
      update: data,
      create: { businessId: biz.id, gateway, ...data },
    })
    return NextResponse.json({ success: true, data: maskConfig(saved) })
  } catch (e) {
    console.error("[laundry-payment-gateway] PUT", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
