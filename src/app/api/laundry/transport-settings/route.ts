import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { TransportQrMode } from "@prisma/client"

export const runtime = "nodejs"

const VALID = new Set(["PACKET", "BAG", "BOTH"])

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const row = await prisma.laundryBusiness.findUnique({
      where: { id: biz.id },
      select: { storeToProcessingTransportMode: true, processingToStoreTransportMode: true },
    })
    return NextResponse.json({
      success: true,
      data: {
        storeToProcessingTransportMode: row?.storeToProcessingTransportMode || "PACKET",
        processingToStoreTransportMode: row?.processingToStoreTransportMode || "PACKET",
      },
    })
  } catch (e) {
    console.error("[transport-settings] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const b = await request.json()
    const businessId = b.businessId as string | undefined
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const storeToProcessing = VALID.has(b.storeToProcessingTransportMode) ? b.storeToProcessingTransportMode : "PACKET"
    const processingToStore = VALID.has(b.processingToStoreTransportMode) ? b.processingToStoreTransportMode : "PACKET"

    await prisma.laundryBusiness.update({
      where: { id: biz.id },
      data: {
        storeToProcessingTransportMode: storeToProcessing as TransportQrMode,
        processingToStoreTransportMode: processingToStore as TransportQrMode,
      },
    })
    return NextResponse.json({ success: true, data: { storeToProcessingTransportMode: storeToProcessing, processingToStoreTransportMode: processingToStore } })
  } catch (e) {
    console.error("[transport-settings] PUT", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
