// ============================================================================
// Laundry Order Engine — the SINGLE creation path for every Laundry order.
//
// Walk-in, Store Drop, Home Pickup, Corporate, Subscription, Website, App and
// API orders all become the exact same LaundryOrder through this one function.
// Business logic NEVER branches on the source — `orderSource` is informational
// only. Each channel resolves its own inputs (customer, address, billing lines,
// subscription split) and hands the resolved order here; this persists the
// LaundryOrder + items + services + financial snapshot and updates customer
// history. There must be no other place that creates a LaundryOrder.
//
// (Phase 1: consolidates the previously-duplicated create blocks. Weight capture,
// invoice timing and piece-splitting are addressed in later phases — this change
// is behaviour-preserving.)
// ============================================================================
import { prisma } from "@/lib/prisma"
import { explodePieces } from "@/lib/laundry-order-items"
import { initPickupVerification } from "@/lib/laundry-verification"
import { notifyPickupOtpGenerated } from "@/lib/laundry-notify"
import { freezePromise } from "@/lib/laundry-delivery-promise"

export interface OrderEngineLine {
  serviceId: string | null
  serviceName: string
  garmentId: string | null
  garmentName: string
  categoryId: string | null
  pricingRuleId: string | null
  pricingType: string
  quantity: number
  weightKg?: number
  unitPrice: number
  lineAmount: number
  gstPercent: number
  gstAmount: number
  discount?: number
  total: number
}

export interface OrderEngineServiceLine {
  serviceId: string | null
  serviceName: string
  turnaroundHours: number
}

export interface CreateLaundryOrderInput {
  laundryBusinessId: string
  storeId: string
  orderNumber: string
  customerId?: string | null
  // Workflow type + informational channel. Neither branches the workflow.
  orderType: string // WALK_IN | STORE_DROP | HOME_PICKUP | CORPORATE | SUBSCRIPTION
  orderSource: string // ONLINE_WEB | ONLINE_APP | STORE_WALKIN | STORE_DROP | HOME_PICKUP | CORPORATE | SUBSCRIPTION | API
  source: string // legacy channel string kept for back-compat (MANUAL | CUSTOMER_STOREFRONT | APP | …)
  customerType: string
  status?: string // default PENDING_STORE_AUDIT — the one entry stage for all sources

  lines: OrderEngineLine[]
  serviceLines?: OrderEngineServiceLine[] // derived from lines when omitted

  financials: {
    subtotal: number
    gstTotal: number
    pickupCharge?: number
    deliveryCharge?: number
    expressCharge?: number
    discount?: number
    grandTotal: number
    amountPaid?: number
    balanceDue?: number
    paymentStatus?: string
    billed?: boolean // sets billedAt = now
  }

  isExpress?: boolean
  paymentPreference?: string
  expectedDeliveryDate?: Date | null
  deliveryOverride?: boolean
  overrideReason?: string | null
  pickupRequired?: boolean
  deliveryRequired?: boolean
  pickupDate?: Date | null
  pickupTimeSlot?: string | null
  deliveryDate?: Date | null
  deliveryTimeSlot?: string | null
  backupDeliveryDate?: Date | null
  backupDeliveryTimeSlot?: string | null
  pickupAddress?: string | null
  pickupInstructions?: string | null
  specialInstructions?: string | null
  notes?: string | null
  createdBy?: string | null

  // Address-first: the resolved Address row id + serviceability snapshot so the
  // order permanently records WHERE the pickup happened and WHY the store was
  // assigned (analytics / routing / SLA).
  pickupAddressId?: string | null
  // Copied from the chosen Address row so the field app can navigate without a
  // second lookup. Nullable everywhere — an order may have no address at all.
  pickupLandmark?: string | null
  pickupLat?: number | null
  pickupLng?: number | null
  pickupDistanceKm?: number | null
  serviceabilityStatus?: string | null
  deliveryZoneId?: string | null

  explode?: boolean // default true — PER_PIECE qty>1 → per-piece rows (see explodePieces)
  updateCustomerSpend?: boolean // default true — increment totalOrders/totalSpent/lastOrderAt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  include?: any
}

// Informational order-source default derived from the workflow type (used when a
// channel doesn't specify one explicitly). Never affects the workflow.
export function defaultOrderSource(orderType: string): string {
  switch (orderType) {
    case "STORE_DROP": return "STORE_DROP"
    case "HOME_PICKUP": return "HOME_PICKUP"
    case "CORPORATE": return "CORPORATE"
    case "SUBSCRIPTION": return "SUBSCRIPTION"
    default: return "STORE_WALKIN"
  }
}

const DEFAULT_INCLUDE = {
  services: true,
  items: true,
  store: { select: { storeName: true, storeCode: true } },
} as const

// The one and only LaundryOrder creator.
export async function createLaundryOrder(input: CreateLaundryOrderInput) {
  const explode = input.explode !== false
  const serviceLines =
    input.serviceLines ??
    Array.from(
      new Map(
        input.lines
          .filter((l) => l.serviceId)
          .map((l) => [l.serviceId, { serviceId: l.serviceId, serviceName: l.serviceName, turnaroundHours: 24 }]),
      ).values(),
    )

  const rows = (explode ? explodePieces(input.lines as never[]) : input.lines) as OrderEngineLine[]
  const itemRows = rows.map((l, i) => {
    const itemNumber = `ITM-${input.orderNumber}-${String(i + 1).padStart(4, "0")}`
    return {
      itemNumber,
      barcode: itemNumber,
      serviceId: l.serviceId,
      serviceName: l.serviceName,
      garmentId: l.garmentId,
      garmentName: l.garmentName,
      categoryId: l.categoryId,
      pricingRuleId: l.pricingRuleId,
      pricingType: l.pricingType,
      quantity: l.quantity,
      weightKg: l.weightKg ?? 0,
      unitPrice: l.unitPrice,
      lineAmount: l.lineAmount,
      gstPercent: l.gstPercent,
      gstAmount: l.gstAmount,
      discount: l.discount ?? 0,
      total: l.total,
    }
  })

  const f = input.financials
  const grandTotal = f.grandTotal
  const pickupReq = input.pickupRequired ?? input.orderType === "HOME_PICKUP"
  const deliveryReq = input.deliveryRequired ?? input.orderType === "HOME_PICKUP"

  const order = await prisma.laundryOrder.create({
    data: {
      orderNumber: input.orderNumber,
      businessId: input.laundryBusinessId,
      storeId: input.storeId,
      customerId: input.customerId || null,
      orderType: input.orderType,
      orderSource: input.orderSource,
      source: input.source,
      status: (input.status || (pickupReq ? "AWAITING_PICKUP_ASSIGNMENT" : "PENDING_STORE_AUDIT")) as never,
      pickupRequired: pickupReq,
      deliveryRequired: deliveryReq,
      paymentPreference: input.paymentPreference || "COD",
      expectedDeliveryDate: input.expectedDeliveryDate ?? null,
      deliveryOverride: input.deliveryOverride || false,
      overrideReason: input.overrideReason ?? null,
      pickupDate: input.pickupDate ?? null,
      pickupTimeSlot: input.pickupTimeSlot ?? null,
      deliveryDate: input.deliveryDate ?? null,
      deliveryTimeSlot: input.deliveryTimeSlot ?? null,
      backupDeliveryDate: input.backupDeliveryDate ?? null,
      backupDeliveryTimeSlot: input.backupDeliveryTimeSlot ?? null,
      // Freeze what the customer was told, at the one point every order passes
      // through. deliveryDate above is the operational schedule and the
      // dispatch desk will rewrite it; this copy is written once and never
      // again, so the promise survives every reschedule.
      ...freezePromise({
        deliveryDate: input.deliveryDate ?? null,
        deliveryTimeSlot: input.deliveryTimeSlot ?? null,
        backupDeliveryDate: input.backupDeliveryDate ?? null,
        backupDeliveryTimeSlot: input.backupDeliveryTimeSlot ?? null,
      }),
      pickupAddress: input.pickupAddress ?? null,
      pickupAddressId: input.pickupAddressId ?? null,
      pickupLandmark: input.pickupLandmark ?? null,
      pickupLat: input.pickupLat ?? null,
      pickupLng: input.pickupLng ?? null,
      pickupDistanceKm: input.pickupDistanceKm ?? null,
      serviceabilityStatus: input.serviceabilityStatus ?? null,
      deliveryZoneId: input.deliveryZoneId ?? null,
      pickupInstructions: input.pickupInstructions ?? null,
      specialInstructions: input.specialInstructions ?? null,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      subtotal: f.subtotal,
      gstTotal: f.gstTotal,
      pickupCharge: f.pickupCharge ?? 0,
      deliveryCharge: f.deliveryCharge ?? 0,
      expressCharge: f.expressCharge ?? 0,
      discount: f.discount ?? 0,
      grandTotal,
      amountPaid: f.amountPaid ?? 0,
      balanceDue: f.balanceDue ?? grandTotal,
      paymentStatus: f.paymentStatus || "UNPAID",
      isExpress: !!input.isExpress,
      customerType: input.customerType,
      billedAt: f.billed ? new Date() : null,
      services: { create: serviceLines },
      items: itemRows.length ? { create: itemRows } : undefined,
    },
    include: input.include ?? DEFAULT_INCLUDE,
  })

  if (input.customerId && input.updateCustomerSpend !== false) {
    await prisma.customer
      .update({
        where: { id: input.customerId },
        data: { totalOrders: { increment: 1 }, totalSpent: { increment: grandTotal || 0 }, lastOrderAt: new Date() },
      })
      .catch((e) => console.error("[laundry-order-engine] customer history update failed:", e))
  }

  // Pickup verification (Workflow Settings): snapshot the method and generate the
  // Pickup OTP for orders that have a pickup leg. Best-effort — a failure here
  // must NEVER block order creation; the admin can regenerate from the order
  // screen. The in-app ping to the customer is also best-effort + non-fatal.
  if (pickupReq) {
    try {
      const init = await initPickupVerification(input.laundryBusinessId, order.id)
      if (init?.method === "OTP" && init.otp) {
        await notifyPickupOtpGenerated(order.id, input.laundryBusinessId, init.otp)
      }
    } catch (e) {
      console.error("[laundry-order-engine] pickup verification init failed:", e)
    }
  }

  return order
}
