// Leaving Payment Collection — the one transition that moves an order from
// PAYMENT_PENDING into the processing queue.
//
// This is lifted verbatim out of the payment route so a second caller can reuse
// the SAME transition instead of copying it. Nothing about it changed: the same
// financial guard, the same conditional update keyed on PAYMENT_PENDING, the
// same LaundryOrderEvent. The payment route still owns recording money; this
// owns only the status move that follows it.
import { prisma } from "@/lib/prisma"
import { guardFinancialAdvance } from "@/lib/laundry-order-state"

export async function advanceAfterPayment(
  orderId: string,
  businessId: string,
  action: "COLLECT_PAYMENT" | "PAY_LATER",
  actor?: string | null,
  note?: string | null,
): Promise<boolean> {
  // The payment edge still answers to the state invariants: an order whose
  // garments were never identified cannot be pushed into the Packing queue.
  // COLLECT_PAYMENT is `internal` (only the payment path records money) but is
  // NOT a custody edge — no garment moves — so the financial entry point grants
  // it. The evidence invariants still apply on top.
  const verdict = await guardFinancialAdvance({ orderId, businessId, from: "PAYMENT_PENDING", to: "READY_FOR_PROCESSING" })
  if (!verdict.ok) return false
  const advanced = await prisma.laundryOrder.updateMany({
    where: { id: orderId, status: "PAYMENT_PENDING" },
    data: { status: "READY_FOR_PROCESSING" },
  })
  if (advanced.count > 0) {
    await prisma.laundryOrderEvent.create({
      data: { orderId, businessId, fromStatus: "PAYMENT_PENDING", toStatus: "READY_FOR_PROCESSING", action, actorName: actor || null, note: note || null },
    }).catch(() => null)
  }
  return advanced.count > 0
}
