// GET /api/laundry/processing/finishing?businessId=&stage=[&code=][&containerId=]
// Finishing workstations (Iron / Folding) operate on the PROCESSING
// CONTAINER after Quality Check — garment barcodes are never scanned here.
//
//   without code/containerId → the containers (Processing Packages) waiting at
//                              this finishing station.
//   with code                → resolve a SCANNED container. Any configured scan
//                              target (Processing Package QR, or the reused bag
//                              QR — the workspace setting processingPackageQrMode
//                              decides which is expected; both resolve the same
//                              batch) is accepted and loads the whole batch.
//   with containerId         → load a container from the waiting list.
//
// Validation: the container must exist, belong to this business, and the order
// must still be live. Garment-level actions still go through the existing
// single-item process endpoint (server-guarded, backward compatible).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { stageLabel, hasPassedQc, isProcessingTerminal } from "@/lib/laundry-processing"
import { packageGarmentsWhere, PACKAGE_STATUS_FINISHING_READY, finishingScanTarget, scanModeAcceptance, syncPackageLifecycle } from "@/lib/laundry-finishing"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

const STAGE_SCREEN: Record<string, string> = { IRON: "ironing", FOLD: "folding" }

type Pkg = {
  id: string; code: string; qrValue: string; status: string
  orderId: string; orderNumber: string | null; serviceId: string | null
  serviceName: string | null; garmentCount: number; reusedBagQr: boolean
  updatedAt: Date
}

type Garment = {
  id: string; itemNumber: string | null; barcode: string | null; garmentScanCode: string | null
  garmentName: string; serviceName: string | null; quantity: number
  processingStage: string | null; processingStatus: string | null
  stageLabel: string; hasPassedQc: boolean; atThisStage: boolean
}

type Batch = {
  package: Pkg; order: { id: string; orderNumber: string; status: string }
  customer: string | null; store: string | null
  garments: Garment[]; summary: { atStage: number; awaitingQc: number; finished: number }
}

async function loadBatch(pkg: Pkg, businessId: string, stage: string): Promise<Batch | null> {
  const order = await prisma.laundryOrder.findUnique({
    where: { id: pkg.orderId },
    select: { id: true, orderNumber: true, status: true, customerId: true, storeId: true },
  })
  if (!order) return null
  const [customer, store] = await Promise.all([
    order.customerId ? prisma.customer.findUnique({ where: { id: order.customerId }, select: { name: true } }) : null,
    order.storeId ? prisma.laundryStore.findUnique({ where: { id: order.storeId }, select: { storeName: true } }) : null,
  ])
  const items = await prisma.laundryOrderItem.findMany({
    where: packageGarmentsWhere({ orderId: pkg.orderId, serviceId: pkg.serviceId }),
    orderBy: { itemNumber: "asc" },
  })
  const garments: Garment[] = items.map((i) => ({
    id: i.id, itemNumber: i.itemNumber, barcode: i.barcode, garmentScanCode: i.garmentScanCode,
    garmentName: i.garmentName, serviceName: i.serviceName, quantity: i.quantity,
    processingStage: i.processingStage, processingStatus: i.processingStatus,
    stageLabel: stageLabel(i.processingStage),
    hasPassedQc: hasPassedQc(i.processingStage), atThisStage: i.processingStage === stage,
  }))
  const atStage = garments.filter((g) => g.atThisStage).length
  const awaitingQc = garments.filter((g) => !g.hasPassedQc).length
  const finished = garments.filter((g) => isProcessingTerminal(g.processingStage)).length
  return {
    package: {
      id: pkg.id, code: pkg.code, qrValue: pkg.qrValue, status: pkg.status,
      orderId: pkg.orderId, orderNumber: pkg.orderNumber, serviceId: pkg.serviceId,
      serviceName: pkg.serviceName, garmentCount: pkg.garmentCount, reusedBagQr: pkg.reusedBagQr,
      updatedAt: pkg.updatedAt,
    },
    order: { id: order.id, orderNumber: order.orderNumber, status: order.status },
    customer: customer?.name || null, store: store?.storeName || null,
    garments, summary: { atStage, awaitingQc, finished },
  }
}

// Pick the container of an order that is relevant at this finishing station:
// one that still has garments here, else the ready container, else the newest.
async function pickContainerForStage(orderId: string, stage: string): Promise<Pkg | null> {
  const packages = await prisma.laundryProcessingPackage.findMany({
    where: { orderId },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true, code: true, qrValue: true, status: true, orderId: true, orderNumber: true,
      serviceId: true, serviceName: true, garmentCount: true, reusedBagQr: true, updatedAt: true,
    },
  })
  if (!packages.length) return null
  for (const pkg of packages) {
    const n = await prisma.laundryOrderItem.count({ where: { ...packageGarmentsWhere({ orderId, serviceId: pkg.serviceId }), processingStage: stage } })
    if (n > 0) return pkg
  }
  return packages.find((p) => p.status === PACKAGE_STATUS_FINISHING_READY) || packages[packages.length - 1]
}

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    const stage = (sp.get("stage") || "").toUpperCase()
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    if (!STAGE_SCREEN[stage]) return NextResponse.json({ error: "Missing or invalid finishing stage" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, `processing.${STAGE_SCREEN[stage]}.view`)
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: { containers: [], container: null } })
    const settings = await prisma.laundryBusiness.findUnique({
      where: { id: biz.id },
      select: { processingPackageQrMode: true, workstationScanSound: true },
    })
    const mode = settings?.processingPackageQrMode || "GENERATE_NEW"
    const target = finishingScanTarget(mode)
    const soundEnabled = settings?.workstationScanSound ?? true
    const code = (sp.get("code") || "").trim()
    const containerId = (sp.get("containerId") || "").trim()

    // ── Resolve a scanned / selected container ─────────────────────────────
    let resolved: Batch | null = null
    if (code) {
      const c = code.toUpperCase()

      // Workspace scan-mode gate: the tenant setting decides the ONLY scan
      // target for the finishing stations (GENERATE_NEW → package QR only,
      // REUSE_BAG → bag QR only, BOTH → either). A wrong-kind scan is rejected
      // with operator guidance — a bag QR is never accepted where the workspace
      // is configured for the Processing Package and vice versa.
      const modeError = scanModeAcceptance(c, mode)
      if (modeError) return NextResponse.json({ success: false, error: modeError }, { status: 409 })

      let pkg: Pkg | null = null
      let orderId = ""

      const byPackage = await prisma.laundryProcessingPackage.findFirst({
        where: { businessId: biz.id, OR: [{ code: c }, { qrValue: c }] },
        select: {
          id: true, code: true, qrValue: true, status: true, orderId: true, orderNumber: true,
          serviceId: true, serviceName: true, garmentCount: true, reusedBagQr: true, updatedAt: true,
        },
      })
      if (byPackage) { pkg = byPackage; orderId = byPackage.orderId }
      else {
        const bag = await prisma.laundryBag.findFirst({
          where: { businessId: biz.id, OR: [{ bagNumber: c }, { qrValue: c }] },
          select: { id: true, bagNumber: true, currentOrderId: true },
        })
        if (bag) {
          // A bag's currentOrderId is a LIVE pointer, not a record of the past.
          // If it still names an order that has been delivered or cancelled, the
          // pointer is stale — following it sent the operator to a finished
          // order and produced "This order has already been delivered" while a
          // perfectly good bag sat in their hand.
          //
          // Clear it here so the bag becomes genuinely available again. This is
          // the same release the handover would have done, just recovered late.
          let live = bag.currentOrderId
          if (live) {
            const linked = await prisma.laundryOrder.findUnique({ where: { id: live }, select: { status: true } })
            if (!linked || linked.status === "DELIVERED" || linked.status === "CANCELLED") {
              await prisma.laundryBag.updateMany({
                where: { id: bag.id, currentOrderId: live },
                data: { status: "AVAILABLE", currentOrderId: null, currentOrderNumber: null, currentServiceId: null, currentServiceName: null },
              }).catch(() => null)
              live = null
            }
          }
          if (!live) {
            return NextResponse.json({ success: false, error: `Bag ${bag.bagNumber} is not linked to an active order. Scan the processing packet, or assign this bag to the order first.` }, { status: 409 })
          }
          orderId = live
        } else {
          const pickupBag = await prisma.laundryPickupBag.findFirst({
            where: { businessId: biz.id, OR: [{ code: c }, { qrValue: c }] },
            select: { orderId: true },
          })
          if (pickupBag) orderId = pickupBag.orderId
        }
      }

      if (!pkg && orderId) pkg = await pickContainerForStage(orderId, stage)
      if (!pkg) {
        return NextResponse.json({
          success: false,
          error: `"${code}" is not a ${target.isPackage ? "Processing Packet" : "bag"} QR. After Quality Check, garment barcodes are not scanned — scan the ${target.isPackage ? "processing packet" : "bag"} to load the batch.`,
        }, { status: 404 })
      }

      const order = await prisma.laundryOrder.findUnique({ where: { id: pkg.orderId }, select: { status: true } })
      if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
      if (order.status === "CANCELLED") return NextResponse.json({ success: false, error: "This order has been cancelled — it cannot be finished." }, { status: 409 })
      if (order.status === "DELIVERED") return NextResponse.json({ success: false, error: "This order has already been delivered." }, { status: 409 })

      // Re-sync the container lifecycle before rendering so the status shown is
      // never stale (self-healing, forward-only, no orphan containers).
      await syncPackageLifecycle(pkg.orderId, businessId).catch(() => null)
      const refreshed = await prisma.laundryProcessingPackage.findFirst({
        where: { id: pkg.id, businessId: biz.id },
        select: {
          id: true, code: true, qrValue: true, status: true, orderId: true, orderNumber: true,
          serviceId: true, serviceName: true, garmentCount: true, reusedBagQr: true, updatedAt: true,
        },
      })
      pkg = refreshed || pkg

      resolved = await loadBatch(pkg, businessId, stage)
    } else if (containerId) {
      const pkg = await prisma.laundryProcessingPackage.findFirst({
        where: { id: containerId, businessId: biz.id },
        select: {
          id: true, code: true, qrValue: true, status: true, orderId: true, orderNumber: true,
          serviceId: true, serviceName: true, garmentCount: true, reusedBagQr: true, updatedAt: true,
        },
      })
      if (pkg) resolved = await loadBatch(pkg, businessId, stage)
    }

    // ── Waiting containers for this finishing station ──────────────────────
    const waitingItems = await prisma.laundryOrderItem.findMany({
      where: { order: { businessId: biz.id, status: { notIn: ["CANCELLED", "DELIVERED"] } }, processingStage: stage },
      select: { orderId: true },
      distinct: ["orderId"],
      orderBy: { orderId: "asc" },
      take: 60,
    })
    const orderIds = [...new Set(waitingItems.map((i) => i.orderId))]
    // Auto-create + re-sync a container for every order waiting at this station
    // (legacy in-flight orders may not have one yet — this self-heals so no
    // garment is stranded and no container is orphaned).
    await Promise.all(orderIds.map((oid) => syncPackageLifecycle(oid, biz.id).catch(() => null)))
    const packages = orderIds.length
      ? await prisma.laundryProcessingPackage.findMany({
          where: { businessId: biz.id, orderId: { in: orderIds } },
          orderBy: { updatedAt: "asc" },
          select: {
            id: true, code: true, qrValue: true, status: true, orderId: true, orderNumber: true,
            serviceId: true, serviceName: true, garmentCount: true, reusedBagQr: true, updatedAt: true,
          },
        })
      : []
    const orderIdsWith = new Set(packages.map((p) => p.orderId))
    // A scanned container's order may also appear — include it so the active row stays visible.
    if (resolved) orderIdsWith.add(resolved.order.id)
    const allOrderIds = [...orderIdsWith]
    const custIds: string[] = []
    const ords = allOrderIds.length
      ? await prisma.laundryOrder.findMany({ where: { id: { in: allOrderIds } }, select: { id: true, orderNumber: true, customerId: true, storeId: true } })
      : []
    const orderInfo = new Map(ords.map((o) => [o.id, o]))
    orderInfo.forEach((o) => { if (o.customerId) custIds.push(o.customerId) })
    const custs = custIds.length ? await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } }) : []
    const custMap = new Map(custs.map((c) => [c.id, c.name]))

    const containers = await Promise.all(packages.map(async (pkg) => {
      const o = orderInfo.get(pkg.orderId)
      const atStage = await prisma.laundryOrderItem.count({
        where: { ...packageGarmentsWhere({ orderId: pkg.orderId, serviceId: pkg.serviceId }), processingStage: stage },
      })
      return {
        id: pkg.id, code: pkg.code, status: pkg.status,
        orderId: pkg.orderId, orderNumber: pkg.orderNumber || o?.orderNumber || null,
        serviceName: pkg.serviceName, garmentCount: pkg.garmentCount, atStage,
        customer: o?.customerId ? custMap.get(o.customerId) || null : null,
        updatedAt: pkg.updatedAt,
      }
    }))

    return NextResponse.json({ success: true, data: { mode, target, soundEnabled, containers, container: resolved } })
  } catch (e) {
    console.error("[laundry-processing-finishing] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
