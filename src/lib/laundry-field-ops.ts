// Field Operations (Pickup & Delivery PWA) — shared server helpers. The Admin
// Portal is the master system; these helpers only RECORD assignment + live field
// status and append an immutable LaundryOrderEvent to the order timeline. They
// NEVER change the order's own status lifecycle or any existing engine.
import { prisma } from "@/lib/prisma"

// Denormalised live field status (mirrors the timeline for fast dashboard/PWA
// reads). The authoritative history is always the LaundryOrderEvent rows.
export const FIELD_STATUS = {
  ASSIGNED: "ASSIGNED",
  STARTED: "STARTED",
  NAVIGATING: "NAVIGATING",
  REACHED: "REACHED",
  PICKUP_STARTED: "PICKUP_STARTED",
  PICKUP_COMPLETED: "PICKUP_COMPLETED",
  RETURNING_STORE: "RETURNING_STORE",
  STORE_RECEIVED: "STORE_RECEIVED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
} as const
export type FieldStatus = (typeof FIELD_STATUS)[keyof typeof FIELD_STATUS]

// Field statuses that mean the pickup leg is done (order has left the customer).
export const PICKUP_DONE = new Set<string>([
  FIELD_STATUS.PICKUP_COMPLETED, FIELD_STATUS.RETURNING_STORE, FIELD_STATUS.STORE_RECEIVED,
])

export interface FieldActor { id?: string | null; name?: string | null }

// Append a field-ops event to the order timeline (reuses LaundryOrderEvent — no
// new parallel history). `toStatus` defaults to the order's CURRENT status so a
// pure field action never rewrites the order's lifecycle state.
export async function logFieldEvent(opts: {
  orderId: string
  businessId: string
  action: string
  note?: string | null
  actor?: FieldActor
  toStatus?: string
}) {
  let toStatus = opts.toStatus
  if (!toStatus) {
    const o = await prisma.laundryOrder.findUnique({ where: { id: opts.orderId }, select: { status: true } })
    toStatus = o?.status ?? "DRAFT"
  }
  return prisma.laundryOrderEvent.create({
    data: {
      orderId: opts.orderId,
      businessId: opts.businessId,
      toStatus,
      action: opts.action,
      note: opts.note ?? null,
      actorId: opts.actor?.id ?? null,
      actorName: opts.actor?.name ?? null,
    },
  })
}
