// GET /api/core/storefront/laundry-payment-methods?businessId= — PUBLIC. Which
// payment options the storefront should show: COD (unless switched off) and the
// business's ACTIVE online gateway (returns only the PUBLIC key id — never the
// secret). Drives the checkout payment picker.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { decrypt } from "@/lib/encrypt"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ success: false, error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })

    const [cfg, gw] = await Promise.all([
      prisma.laundryOperationalConfig.findUnique({ where: { businessId: biz.id }, select: { codEnabled: true } }),
      prisma.laundryPaymentGateway.findFirst({ where: { businessId: biz.id, isActive: true, apiKeyEnc: { not: null } } }),
    ])
    // Razorpay key_id (apiKey) is a PUBLIC value used by the checkout widget.
    const online = gw && gw.apiKeyEnc ? { gateway: gw.gateway, keyId: decrypt(gw.apiKeyEnc), environment: gw.environment } : null
    return NextResponse.json({ success: true, data: { cod: cfg?.codEnabled ?? true, online } })
  } catch (e) {
    console.error("[storefront-laundry-payment-methods] GET", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
