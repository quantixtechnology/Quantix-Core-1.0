// Permanent customer deletion — Super Admin only. Deletes the customer and ALL
// dependent data within the same tenant in FK-safe order, inside a single
// transaction (the caller wraps it; any failure rolls the whole thing back).
//
// FK notes (from schema audit):
//  • LaundryOrder.customerId and SubscriptionPurchase.customerId have NO FK →
//    they must be deleted explicitly (a Customer delete does NOT cascade them).
//  • LaundryItemEvent has NO cascade → delete before its order items/orders.
//  • Address / CustomerSubscription(+usage) / CustomerNote / Invoice / Review /
//    CartItem / Favorite / SupportTicket / Order(+children) cascade from
//    Customer, but we delete them explicitly to return per-entity counts and to
//    keep deletion deterministic.
import type { Prisma } from "@prisma/client"

export type DeletedCounts = Record<string, number>

export async function hardDeleteCustomer(tx: Prisma.TransactionClient, customerId: string): Promise<DeletedCounts> {
  const counts: DeletedCounts = {}
  const del = async (label: string, n: Promise<{ count: number }>) => { counts[label] = (counts[label] || 0) + (await n).count }

  // ── Laundry orders + their operational children ──────────────────────────
  const laundryOrders = await tx.laundryOrder.findMany({ where: { customerId }, select: { id: true } })
  const orderIds = laundryOrders.map((o) => o.id)
  if (orderIds.length) {
    const items = await tx.laundryOrderItem.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
    const itemIds = items.map((i) => i.id)
    // LaundryItemEvent has no cascade — remove first (by order or item).
    await del("laundryItemEvents", tx.laundryItemEvent.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, ...(itemIds.length ? [{ itemId: { in: itemIds } }] : [])] } }))
    await del("laundryPayments", tx.laundryPayment.deleteMany({ where: { orderId: { in: orderIds } } }))
    await del("laundryStageTimestamps", tx.laundryStageTimestamp.deleteMany({ where: { orderId: { in: orderIds } } }))
    await del("laundryOrderEvents", tx.laundryOrderEvent.deleteMany({ where: { orderId: { in: orderIds } } }))
    await del("laundryOrderServices", tx.laundryOrderService.deleteMany({ where: { orderId: { in: orderIds } } }))
    await del("laundryOrderItems", tx.laundryOrderItem.deleteMany({ where: { orderId: { in: orderIds } } }))
    await del("laundryOrders", tx.laundryOrder.deleteMany({ where: { id: { in: orderIds } } }))
  }

  // ── Subscriptions + allowance/purchase history ───────────────────────────
  const subs = await tx.customerSubscription.findMany({ where: { customerId }, select: { id: true } })
  const subIds = subs.map((s) => s.id)
  if (subIds.length) await del("subscriptionUsages", tx.subscriptionUsage.deleteMany({ where: { subscriptionId: { in: subIds } } }))
  await del("customerSubscriptions", tx.customerSubscription.deleteMany({ where: { customerId } }))
  await del("subscriptionPurchases", tx.subscriptionPurchase.deleteMany({ where: { customerId } })) // scalar FK — explicit

  // ── Commerce orders + their children (cascade from Order) ────────────────
  await del("commerceOrders", tx.order.deleteMany({ where: { customerId } }))

  // ── Direct customer-owned records ────────────────────────────────────────
  await del("addresses", tx.address.deleteMany({ where: { customerId } }))
  await del("customerNotes", tx.customerNote.deleteMany({ where: { customerId } }))
  await del("invoices", tx.invoice.deleteMany({ where: { customerId } }))
  await del("reviews", tx.review.deleteMany({ where: { customerId } }))
  await del("cartItems", tx.cartItem.deleteMany({ where: { customerId } }))
  await del("favorites", tx.favorite.deleteMany({ where: { customerId } }))
  await del("supportTickets", tx.supportTicket.deleteMany({ where: { customerId } }))

  // ── The customer itself ──────────────────────────────────────────────────
  await del("customer", tx.customer.deleteMany({ where: { id: customerId } }))
  return counts
}
