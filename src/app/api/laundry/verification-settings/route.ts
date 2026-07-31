import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

const VALID = new Set(["OTP", "NAME"])

// Workflow Settings → Pickup/Delivery verification method (Customer Name | OTP).
export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const row = await prisma.laundryWorkflowQualityConfig.findUnique({ where: { businessId: biz.id } })
    return NextResponse.json({
      success: true,
      data: {
        pickupVerificationMethod: row?.pickupVerificationMethod || "OTP",
        deliveryVerificationMethod: row?.deliveryVerificationMethod || "OTP",
      },
    })
  } catch (e) {
    console.error("[verification-settings] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const businessId = b.businessId as string | undefined
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const pickup = VALID.has(b.pickupVerificationMethod) ? b.pickupVerificationMethod : "OTP"
    const delivery = VALID.has(b.deliveryVerificationMethod) ? b.deliveryVerificationMethod : "OTP"

    await prisma.laundryWorkflowQualityConfig.upsert({
      where: { businessId: biz.id },
      update: { pickupVerificationMethod: pickup, deliveryVerificationMethod: delivery },
      create: { businessId: biz.id, pickupVerificationMethod: pickup, deliveryVerificationMethod: delivery },
    })
    await prisma.laundryAuditLog.create({
      data: {
        businessId: biz.id, actorId: b.actorId || null, actorName: b.actorName || null,
        section: "WORKFLOW_SETTINGS", field: "verificationMethod",
        oldValue: null, newValue: `pickup=${pickup}, delivery=${delivery}`,
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      },
    }).catch(() => null)

    return NextResponse.json({ success: true, data: { pickupVerificationMethod: pickup, deliveryVerificationMethod: delivery } })
  } catch (e) {
    console.error("[verification-settings] PUT", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
