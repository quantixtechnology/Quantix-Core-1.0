// GET /api/laundry/app/history — orders, payments/invoices and subscription
// usage in one place (Phase 9). Read-only against the frozen engines.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveSession, bearerToken } from "@/lib/laundry-app-auth"

export const runtime = "nodejs"
const r2 = (n: number) => Math.round(n * 100) / 100

export async function GET(request: Request) {
  const sess = await resolveSession(bearerToken(request))
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const orders = await prisma.laundryOrder.findMany({
    where: { customerId: sess.customerId },
    select: { id: true, orderNumber: true, status: true, grandTotal: true, amountPaid: true, balanceDue: true, subscriptionCoveredAmount: true, paymentStatus: true, createdAt: true },
    orderBy: { createdAt: "desc" }, take: 100,
  })
  const orderIds = orders.map((o) => o.id)
  const orderNo = new Map(orders.map((o) => [o.id, o.orderNumber]))
  const [payments, subs] = await Promise.all([
    orderIds.length ? prisma.laundryPayment.findMany({ where: { orderId: { in: orderIds } }, select: { orderId: true, method: true, amount: true, createdAt: true }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    prisma.customerSubscription.findMany({ where: { customerId: sess.customerId }, include: { plan: { select: { name: true } }, usages: { orderBy: { createdAt: "desc" }, take: 50 } } }),
  ])

  return NextResponse.json({ success: true, data: {
    orders: orders.map((o) => ({ ...o, grandTotal: r2(o.grandTotal), subscriptionCoveredAmount: r2(o.subscriptionCoveredAmount || 0), balanceDue: r2(o.balanceDue) })),
    payments: payments.map((p) => ({ orderNumber: orderNo.get(p.orderId) || null, method: p.method, amount: r2(p.amount), at: p.createdAt })),
    subscriptionUsage: subs.flatMap((s) => s.usages.map((u) => ({ planName: s.plan.name, description: u.description, at: u.createdAt }))),
  } })
}
