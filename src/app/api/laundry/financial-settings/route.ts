// Laundry — Business Financial Settings (central config for the Invoice Engine).
//   GET /api/laundry/financial-settings?businessId=  → current settings (+defaults)
//   PUT /api/laundry/financial-settings { businessId, ...fields } → upsert
//
// Controls invoice numbering, GST, currency, rounding and branding so no
// financial rule is hardcoded. Keyed by the LaundryBusiness id (same id the
// LaundryOrder / invoice engine use).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getFinancialSettings } from "@/lib/laundry-invoice"

export const runtime = "nodejs"

// Only these fields are writable via the API.
const EDITABLE = [
  "invoicePrefix", "invoiceNextNumber", "invoiceNumberPadding",
  "gstEnabled", "gstNumber", "taxInclusive", "homeState",
  "currency", "rounding", "decimalPrecision",
  "businessLogo", "businessAddress", "invoiceFooter", "invoiceTerms",
  "signatureUrl", "paymentInstructions",
] as const

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ success: false, error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const settings = await getFinancialSettings(biz.id)
    return NextResponse.json({ success: true, data: settings })
  } catch (e) {
    console.error("[laundry-financial-settings] GET", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    if (!body.businessId) return NextResponse.json({ success: false, error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, body.businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(body.businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const data: Record<string, unknown> = {}
    for (const k of EDITABLE) if (body[k] !== undefined) data[k] = body[k]

    const settings = await prisma.laundryFinancialSettings.upsert({
      where: { businessId: biz.id },
      create: { businessId: biz.id, ...data },
      update: data,
    })
    return NextResponse.json({ success: true, data: settings })
  } catch (e) {
    console.error("[laundry-financial-settings] PUT", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
