// Transport identity — database resolution (server only).
//
// Every transport endpoint routes its identifier lookup through this module so
// the configured mode (Workspace Settings → Transport Setup) is the ONLY thing
// that decides whether a packet or a bag identifies the package.
//
// See `laundry-transport.ts` for the mode semantics and the pure helpers.

import { prisma } from "@/lib/prisma"
import {
  DEFAULT_TRANSPORT_MODES, EMPTY_TRANSPORT_REF, normalizeTransportMode,
  usesBag, usesPacket,
  type TransportDirection, type TransportMode, type TransportModes, type TransportRef,
} from "@/lib/laundry-transport"

export type { TransportMode, TransportModes, TransportRef }

/** Both directions for a laundry business (falls back to the PACKET default). */
export async function getTransportModes(lbId: string): Promise<TransportModes> {
  const row = await prisma.laundryBusiness.findUnique({
    where: { id: lbId },
    select: { storeToProcessingTransportMode: true, processingToStoreTransportMode: true },
  }).catch(() => null)
  if (!row) return DEFAULT_TRANSPORT_MODES
  return {
    storeToProcessing: normalizeTransportMode(row.storeToProcessingTransportMode),
    processingToStore: normalizeTransportMode(row.processingToStoreTransportMode),
  }
}

export async function getTransportMode(lbId: string, direction: TransportDirection): Promise<TransportMode> {
  const modes = await getTransportModes(lbId)
  return direction === "PROCESSING_TO_STORE" ? modes.processingToStore : modes.storeToProcessing
}

interface BagRef { bagNumber: string; qrValue: string }

/**
 * The bag that identifies each order: the bag currently holding it, else the
 * most recent assignment (history survives the bag being released, so a
 * delivered order still shows the bag it travelled in).
 */
async function bagRefsForOrders(lbId: string, orderIds: string[]): Promise<Map<string, BagRef>> {
  const out = new Map<string, BagRef>()
  if (orderIds.length === 0) return out

  // Newest first, so an order carrying more than one bag (pickup bag + a bag
  // scanned later) always resolves to the same, most recent one.
  const live = await prisma.laundryBag.findMany({
    where: { businessId: lbId, currentOrderId: { in: orderIds } },
    orderBy: { lastUsedAt: "desc" },
    select: { currentOrderId: true, bagNumber: true, qrValue: true },
  })
  for (const b of live) {
    if (!b.currentOrderId || out.has(b.currentOrderId)) continue
    out.set(b.currentOrderId, { bagNumber: b.bagNumber, qrValue: b.qrValue || b.bagNumber })
  }

  const missing = orderIds.filter((id) => !out.has(id))
  if (missing.length) {
    const past = await prisma.laundryBagAssignment.findMany({
      where: { businessId: lbId, orderId: { in: missing } },
      orderBy: { assignedAt: "desc" },
      select: { orderId: true, bag: { select: { bagNumber: true, qrValue: true } } },
    })
    // Ordered newest-first → the first row per order wins.
    for (const a of past) {
      if (!a.bag || out.has(a.orderId)) continue
      out.set(a.orderId, { bagNumber: a.bag.bagNumber, qrValue: a.bag.qrValue || a.bag.bagNumber })
    }
  }
  return out
}

/**
 * Resolve the transport identifier for a set of orders under `mode`.
 * BAG mode falls back to an existing packet ONLY for orders that predate the
 * setting change (never generated going forward) — flagged `legacy: true`.
 */
export async function transportRefsForOrders(
  lbId: string, orderIds: string[], mode: TransportMode,
): Promise<Map<string, TransportRef>> {
  const ids = [...new Set(orderIds.filter(Boolean))]
  const refs = new Map<string, TransportRef>()
  if (ids.length === 0) return refs

  const [packets, bags] = await Promise.all([
    prisma.laundryPacket.findMany({
      where: { businessId: lbId, orderId: { in: ids } },
      select: { orderId: true, packetNumber: true, qrValue: true },
    }),
    usesBag(mode) ? bagRefsForOrders(lbId, ids) : Promise.resolve(new Map<string, BagRef>()),
  ])
  const packetMap = new Map(packets.map((p) => [p.orderId, p]))

  for (const id of ids) {
    const packet = packetMap.get(id) || null
    const bag = bags.get(id) || null
    const packetNumber = packet?.packetNumber || null
    const bagNumber = bag?.bagNumber || null

    if (mode === "BAG") {
      if (bagNumber) refs.set(id, { kind: "BAG", code: bagNumber, qrValue: bag!.qrValue, packetNumber: null, bagNumber, legacy: false })
      else if (packetNumber) refs.set(id, { kind: "PACKET", code: packetNumber, qrValue: packet!.qrValue || packetNumber, packetNumber, bagNumber: null, legacy: true })
      else refs.set(id, { ...EMPTY_TRANSPORT_REF })
      continue
    }
    if (mode === "PACKET") {
      if (packetNumber) refs.set(id, { kind: "PACKET", code: packetNumber, qrValue: packet!.qrValue || packetNumber, packetNumber, bagNumber: null, legacy: false })
      else refs.set(id, { ...EMPTY_TRANSPORT_REF })
      continue
    }
    // BOTH — the packet is the printed label, the bag is an equally valid scan.
    if (packetNumber) refs.set(id, { kind: "PACKET", code: packetNumber, qrValue: packet!.qrValue || packetNumber, packetNumber, bagNumber, legacy: false })
    else if (bagNumber) refs.set(id, { kind: "BAG", code: bagNumber, qrValue: bag!.qrValue, packetNumber: null, bagNumber, legacy: false })
    else refs.set(id, { ...EMPTY_TRANSPORT_REF })
  }
  return refs
}

export async function transportRefForOrder(lbId: string, orderId: string, mode: TransportMode): Promise<TransportRef> {
  const map = await transportRefsForOrders(lbId, [orderId], mode)
  return map.get(orderId) || { ...EMPTY_TRANSPORT_REF }
}

/**
 * Free-text search over transport identifiers → order ids. Only the
 * identifiers the configured mode actually uses are searched, so a BAG-mode
 * business never gets hits on stale packet numbers.
 */
export async function orderIdsByTransportSearch(lbId: string, q: string, mode: TransportMode, take = 200): Promise<string[]> {
  const term = (q || "").trim()
  if (!term) return []
  const ids = new Set<string>()

  if (usesPacket(mode)) {
    const packets = await prisma.laundryPacket.findMany({
      where: { businessId: lbId, packetNumber: { contains: term } }, select: { orderId: true }, take,
    })
    for (const p of packets) ids.add(p.orderId)
  }
  if (usesBag(mode)) {
    const bags = await prisma.laundryBag.findMany({
      where: { businessId: lbId, OR: [{ bagNumber: { contains: term } }, { qrValue: { contains: term } }] },
      select: { id: true, currentOrderId: true }, take,
    })
    for (const b of bags) if (b.currentOrderId) ids.add(b.currentOrderId)
    if (bags.length) {
      const asg = await prisma.laundryBagAssignment.findMany({
        where: { businessId: lbId, bagId: { in: bags.map((b) => b.id) } }, select: { orderId: true }, take,
      })
      for (const a of asg) ids.add(a.orderId)
    }
  }
  return [...ids]
}

export interface TransportResolution {
  orderId: string
  orderNumber: string
  status: string
  ref: TransportRef
  /** How the scanned code matched — lets a screen explain a legacy packet scan. */
  matchedBy: "PACKET" | "BAG" | "ORDER"
}

/**
 * Scan / manual entry → order, honouring the configured mode.
 *   · The order number always resolves (operators type it when a QR won't scan).
 *   · Packet codes resolve when the mode uses packets, or as a legacy fallback
 *     in BAG mode so packages already in transit stay receivable.
 *   · Bag codes resolve when the mode uses bags.
 */
export async function resolveOrderByTransportCode(
  lbId: string, rawCode: string, mode: TransportMode,
): Promise<TransportResolution | null> {
  const code = (rawCode || "").trim()
  if (!code) return null

  const finish = async (orderId: string, matchedBy: TransportResolution["matchedBy"]): Promise<TransportResolution | null> => {
    const order = await prisma.laundryOrder.findFirst({
      where: { id: orderId, businessId: lbId },
      select: { id: true, orderNumber: true, status: true },
    })
    if (!order) return null
    const ref = await transportRefForOrder(lbId, order.id, mode)
    return { orderId: order.id, orderNumber: order.orderNumber, status: order.status, ref, matchedBy }
  }

  if (usesPacket(mode)) {
    const p = await prisma.laundryPacket.findFirst({
      where: { businessId: lbId, OR: [{ packetNumber: code }, { qrValue: code }] },
      select: { orderId: true },
    })
    if (p) return finish(p.orderId, "PACKET")
  }

  if (usesBag(mode)) {
    const bag = await prisma.laundryBag.findFirst({
      where: { businessId: lbId, OR: [{ bagNumber: code }, { qrValue: code }] },
      select: { currentOrderId: true, id: true },
    })
    if (bag?.currentOrderId) return finish(bag.currentOrderId, "BAG")
    if (bag) {
      const last = await prisma.laundryBagAssignment.findFirst({
        where: { businessId: lbId, bagId: bag.id, status: "ASSIGNED" },
        orderBy: { assignedAt: "desc" },
        select: { orderId: true },
      })
      if (last) return finish(last.orderId, "BAG")
    }
  }

  const order = await prisma.laundryOrder.findFirst({
    where: { businessId: lbId, orderNumber: code },
    select: { id: true },
  })
  if (order) return finish(order.id, "ORDER")

  // Legacy safety net: an order packed under PACKET mode before the business
  // switched to BAG is still carrying its PKT label — keep it receivable.
  if (!usesPacket(mode)) {
    const p = await prisma.laundryPacket.findFirst({
      where: { businessId: lbId, OR: [{ packetNumber: code }, { qrValue: code }] },
      select: { orderId: true },
    })
    if (p) return finish(p.orderId, "PACKET")
  }
  return null
}
