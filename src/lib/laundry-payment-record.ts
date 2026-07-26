// Book a payment against a laundry order — the ONE place amountPaid / balanceDue /
// paymentStatus move. Used by the storefront online verify, the delivery-app cash
// collect, and the delivery-app QR poll. Idempotent by (orderId, reference).
import { prisma } from "@/lib/prisma"

const r2 = (n: number) => Math.round(n * 100) / 100

export async function recordLaundryPayment(opts: {
  orderId: string
  businessId: string
  amount?: number // omit → pay the full remaining balance
  method: string // CASH | UPI | CARD | …
  reference?: string | null
  note?: string | null
  createdBy?: string | null
}): Promise<{ ok: true; alreadyBooked: boolean; amountPaid: number; balanceDue: number; paymentStatus: string } | { ok: false; error: string }> {
  const order = await prisma.laundryOrder.findFirst({
    where: { id: opts.orderId, businessId: opts.businessId },
    select: { id: true, grandTotal: true, amountPaid: true, balanceDue: true },
  })
  if (!order) return { ok: false, error: "Order not found" }

  // Idempotent: a gateway reference is booked at most once.
  if (opts.reference) {
    const dup = await prisma.laundryPayment.findFirst({ where: { orderId: order.id, reference: opts.reference }, select: { id: true } })
    if (dup) {
      return { ok: true, alreadyBooked: true, amountPaid: order.amountPaid, balanceDue: order.balanceDue ?? r2(order.grandTotal - order.amountPaid), paymentStatus: (order.balanceDue ?? 1) <= 0 ? "PAID" : "PARTIAL" }
    }
  }

  const due = r2(Math.max(0, order.balanceDue ?? order.grandTotal - order.amountPaid))
  const pay = r2(opts.amount != null ? Math.min(Math.max(0, opts.amount), due) : due)
  if (pay <= 0) return { ok: true, alreadyBooked: false, amountPaid: order.amountPaid, balanceDue: due, paymentStatus: due <= 0 ? "PAID" : "PARTIAL" }

  const newPaid = r2((order.amountPaid || 0) + pay)
  const newBalance = r2(Math.max(0, order.grandTotal - newPaid))
  const paymentStatus = newBalance <= 0 ? "PAID" : "PARTIAL"
  await prisma.$transaction([
    prisma.laundryPayment.create({ data: { orderId: order.id, businessId: opts.businessId, method: opts.method, amount: pay, reference: opts.reference || null, note: opts.note || null, createdBy: opts.createdBy || null } }),
    prisma.laundryOrder.update({ where: { id: order.id }, data: { amountPaid: newPaid, balanceDue: newBalance, paymentStatus } }),
  ])
  return { ok: true, alreadyBooked: false, amountPaid: newPaid, balanceDue: newBalance, paymentStatus }
}
