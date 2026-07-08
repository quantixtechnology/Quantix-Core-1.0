import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureCrmDefaults, CRM_FEATURE_KEY } from "@/lib/laundry-crm"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params
    // Accept the LaundryBusiness id OR the linked platform Business id — the
    // Super Admin wizard works with platform ids. 404 for non-laundry
    // businesses lets callers (e.g. the wizard feature card) self-hide.
    const biz = await resolveLaundryBusiness(rawId)
    if (!biz) return NextResponse.json({ error: "Not a laundry business" }, { status: 404 })
    const features = await prisma.laundryBusinessFeature.findMany({
      where: { businessId: biz.id },
    })
    return NextResponse.json(features)
  } catch (error) {
    console.error("Error fetching laundry features:", error)
    return NextResponse.json({ error: "Failed to fetch features" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params
    const biz = await resolveLaundryBusiness(rawId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const id = biz.id
    const body = await request.json()
    const { features } = body as { features: { featureKey: string; enabled: boolean }[] }

    if (!Array.isArray(features)) {
      return NextResponse.json({ error: "features array is required" }, { status: 400 })
    }

    const result = await prisma.$transaction(
      features.map((f) =>
        prisma.laundryBusinessFeature.upsert({
          where: { businessId_featureKey: { businessId: id, featureKey: f.featureKey } },
          update: { enabled: f.enabled },
          create: { businessId: id, featureKey: f.featureKey, enabled: f.enabled },
        })
      )
    )

    // Feature toggles are Quantix-controlled — record them in the business audit log.
    await prisma.laundryAuditLog.createMany({
      data: features.map((f) => ({
        businessId: id, section: "features", field: f.featureKey,
        oldValue: null, newValue: f.enabled ? "ENABLED" : "DISABLED",
        actorId: body.actorId || null, actorName: body.actorName || null,
      })),
    }).catch(() => {})

    // Enabling CRM initializes the tenant's default CRM configuration
    // (statuses, sources, stages, lost reasons, activity types, lead fields).
    const crmOn = features.find((f) => f.featureKey === CRM_FEATURE_KEY && f.enabled)
    if (crmOn) await ensureCrmDefaults(id).catch((e) => console.error("[features] CRM defaults init failed", e))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error updating laundry features:", error)
    return NextResponse.json({ error: "Failed to update features" }, { status: 500 })
  }
}
