// ============================================================================
// Delivery slot capacity — the SINGLE source of "is this delivery slot full?".
//
// Capacity is per (date + time slot). One limit (`deliveryMaxPerSlot` on
// LaundryOperationalConfig) applies to every generated delivery slot. Usage
// counts the Standard Delivery AND the Backup (Alternate) Delivery schedule of
// every order still in play (Scheduled / Assigned / Accepted) — orders that are
// DELIVERED or CANCELLED free up the slot. A limit of 0 means unlimited.
//
// Used by the customer website, the Dispatch Center and server-side validation
// on order creation / delivery scheduling so a full slot can never be booked.
// ============================================================================
import { prisma } from "@/lib/prisma"
import { LaundryOrderStatus } from "@prisma/client"
import { generateSlots, slotConfigsFrom } from "@/lib/laundry-slots"

export const DEFAULT_DELIVERY_MAX_PER_SLOT = 100

export function deliveryMaxPerSlot(cfg: unknown): number {
  const row = (cfg ?? {}) as { deliveryMaxPerSlot?: unknown }
  const n = Math.round(Number(row.deliveryMaxPerSlot))
  return Number.isFinite(n) && n > 0 ? n : 0 // 0 = unlimited
}

// Orders in these statuses still hold their delivery slot.
const ACTIVE_STATUSES = { notIn: [LaundryOrderStatus.DELIVERED, LaundryOrderStatus.CANCELLED] }

// Local-midnight-free UTC window for a yyyy-mm-dd date. All order-creation paths
// persist `new Date("yyyy-mm-dd")` (UTC midnight), so comparing via UTC keeps
// the match stable regardless of the server timezone.
export function dateUtcRange(dateISO: string): { start: Date; end: Date } {
  const start = new Date(`${dateISO}T00:00:00.000Z`)
  if (isNaN(start.getTime())) return { start, end: start }
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

const dateKey = (d: Date | null | undefined): string | null => {
  if (!d || isNaN(d.getTime())) return null
  return d.toISOString().split("T")[0]
}

export interface DeliverySlotCapacity {
  limit: number
  slots: string[]
  usage: Record<string, number>
  full: string[]
}

// Usage + full slots for a given delivery date. One indexed query for the whole
// day (standard + backup schedules), tallied in memory — no per-slot queries.
export async function deliverySlotCapacity(
  businessId: string,
  dateISO: string,
  options: { excludeOrderId?: string } = {},
): Promise<DeliverySlotCapacity> {
  const cfg = await prisma.laundryOperationalConfig.findUnique({ where: { businessId } })
  const limit = deliveryMaxPerSlot(cfg)
  const { delivery } = slotConfigsFrom(cfg)
  const slots = generateSlots(delivery)
  if (limit <= 0 || !dateISO) return { limit, slots, usage: {}, full: [] }

  const { start, end } = dateUtcRange(dateISO)
  if (isNaN(start.getTime())) return { limit, slots, usage: {}, full: [] }

  const orders = await prisma.laundryOrder.findMany({
    where: {
      businessId,
      ...(options.excludeOrderId ? { id: { not: options.excludeOrderId } } : {}),
      status: ACTIVE_STATUSES,
      OR: [
        { deliveryDate: { gte: start, lt: end }, deliveryTimeSlot: { not: null } },
        { backupDeliveryDate: { gte: start, lt: end }, backupDeliveryTimeSlot: { not: null } },
      ],
    },
    select: { deliveryDate: true, deliveryTimeSlot: true, backupDeliveryDate: true, backupDeliveryTimeSlot: true },
  })

  const usage: Record<string, number> = {}
  const bump = (d: Date | null, s: string | null) => {
    if (dateKey(d) === dateISO && s) usage[s] = (usage[s] || 0) + 1
  }
  for (const o of orders) {
    bump(o.deliveryDate, o.deliveryTimeSlot)
    bump(o.backupDeliveryDate, o.backupDeliveryTimeSlot)
  }
  const full = slots.filter((s) => (usage[s] || 0) >= limit)
  return { limit, slots, usage, full }
}

// Convenience guard for order-creation / dispatch endpoints.
export async function assertDeliverySlotAvailable(
  businessId: string,
  dateISO: string,
  timeSlot: string,
  options: { excludeOrderId?: string } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!dateISO || !timeSlot) return { ok: true } // no slot scheduled → nothing to check
  const { limit, usage } = await deliverySlotCapacity(businessId, dateISO, options)
  if (limit > 0 && (usage[timeSlot] || 0) >= limit) {
    return { ok: false, error: "Selected delivery slot is full. Please choose another available slot." }
  }
  return { ok: true }
}
