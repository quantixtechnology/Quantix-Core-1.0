// GET /api/laundry/payments-ledger — the persistent financial view.
//
// Payment Collection is a QUEUE: it shows orders at PAYMENT_PENDING and they
// leave it as soon as the workflow moves on. That is correct for an operational
// queue and wrong for a financial record, so this endpoint answers the other
// question — "what is the money position of every order?" — across every
// status, including DELIVERED and CANCELLED.
//
// It is READ-ONLY and touches no status. The operational workflow is unchanged;
// this is a different lens on the same rows.
//
// It answers for TWO kinds of money. An order's payments live on LaundryOrder /
// LaundryPayment. A subscription sold on its own has no order to hang from —
// LaundryPayment.orderId is required — and its money lives on
// SubscriptionPurchase, which stays its source of truth. Rather than fabricate
// an order to carry it, the ledger reads both and marks each row with its
// `kind`. Nothing is written here and no LaundryPayment row is invented.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { requireLaundryLevel } from "@/lib/laundry-rbac"
import { Level } from "@/lib/laundry-rbac-registry"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { financialSummary, matchesLedgerFilter, type LedgerFilter } from "@/lib/laundry-adjustment"
import {
  businessDayBounds, summariseToday, isOnlinePayment,
  SUBSCRIPTION_COVERAGE, REFUND, isMoneyTransaction, type TodayTransaction,
} from "@/lib/laundry-today-transactions"

export const runtime = "nodejs"

const r2 = (n: number) => Math.round(n * 100) / 100

export async function GET(request: Request) {
  try {
    const u = new URL(request.url)
    const businessId = u.searchParams.get("businessId")
    const guard = await requireLaundryLevel(request, businessId, "store_ops.payment_collection", Level.VIEW)
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    // ── TODAY'S TRANSACTIONS ───────────────────────────────────────────────
    //
    // A different question from the rest of this route: not "what is owed on
    // each order?" but "what money moved today?". It is keyed on the moment a
    // payment was recorded, so an order raised yesterday and paid today belongs
    // here and an order raised today and unpaid does not. Nothing is inferred
    // from order status or balance — a row exists only where a payment record
    // does. Every other filter below is untouched.
    if ((u.searchParams.get("filter") || "") === "TODAY") {
      const { start, end, dayKey } = businessDayBounds()
      const platformId = biz.platformBusinessId || biz.id

      const [payments, purchases] = await Promise.all([
        // Order-side money: counter, delivery COD, delivery QR, storefront
        // Razorpay, subscription coverage and refunds all land here.
        prisma.laundryPayment.findMany({
          where: { businessId: biz.id, status: "SUCCESS", createdAt: { gte: start, lt: end } },
          orderBy: { createdAt: "desc" },
        }),
        // A subscription settled on its own. One bought with an order is left
        // out: its money is already a LaundryPayment above, and counting the
        // purchase too would double it.
        prisma.subscriptionPurchase.findMany({
          where: { businessId: platformId, laundryOrderId: null, paidAt: { gte: start, lt: end } },
          orderBy: { paidAt: "desc" },
        }),
      ])

      const ordIds = [...new Set(payments.map((p) => p.orderId))]
      const orders = ordIds.length
        ? await prisma.laundryOrder.findMany({ where: { id: { in: ordIds } }, select: { id: true, orderNumber: true, customerId: true } })
        : []
      const planIds = [...new Set(purchases.map((p) => p.planId))]
      const plans = planIds.length
        ? await prisma.subscriptionPlan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } })
        : []
      const custIds = [...new Set([...orders.map((o) => o.customerId).filter(Boolean) as string[], ...purchases.map((p) => p.customerId)])]
      const custs = custIds.length
        ? await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } })
        : []
      const orderById = new Map(orders.map((o) => [o.id, o]))
      const planById = new Map(plans.map((p) => [p.id, p.name]))
      const custById = new Map(custs.map((c) => [c.id, c.name]))

      const rows: TodayTransaction[] = [
        ...payments.map((p) => {
          const o = orderById.get(p.orderId)
          const online = isOnlinePayment(p)
          return {
            id: p.id,
            at: p.createdAt.toISOString(),
            // Allowance consumption is a ledger entry, not money in the till,
            // and is classified so it can never be summed as collection.
            kind: p.method === SUBSCRIPTION_COVERAGE ? "SUBSCRIPTION_COVERED" as const
                : p.method === REFUND ? "REFUND" as const
                : "LAUNDRY" as const,
            customerName: o?.customerId ? custById.get(o.customerId) ?? null : null,
            reference: o?.orderNumber ?? null,
            transactionRef: p.reference ?? null,
            method: p.method,
            online,
            amount: p.amount,          // refunds are already negative on the row
            status: p.status,
          }
        }),
        ...purchases.map((p) => ({
          id: p.id,
          at: (p.paidAt as Date).toISOString(),
          kind: "SUBSCRIPTION" as const,
          customerName: custById.get(p.customerId) ?? null,
          reference: planById.get(p.planId) ?? "Subscription",
          transactionRef: p.paymentTransactionId || p.paymentReference || null,
          method: p.paymentMethod || p.gateway || "OTHER",
          online: (p.paymentMethod || "").toUpperCase() === "RAZORPAY" || !!p.gateway,
          amount: p.amountPaid,
          status: p.paymentStatus,
        })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

      // The list is the money: allowance coverage is summarised separately
      // rather than sitting among the payments, so the count and the list both
      // mean "what was actually taken today".
      return NextResponse.json({
        success: true,
        data: rows.filter(isMoneyTransaction),
        summary: summariseToday(rows),
        dayKey,
      })
    }

    const q = (u.searchParams.get("search") || "").trim()
    const filter = (u.searchParams.get("filter") || "ALL") as LedgerFilter
    const take = Math.min(200, Math.max(1, Number(u.searchParams.get("limit")) || 100))

    // Order number, invoice number, customer name and mobile — the four things
    // a counter actually searches by.
    // LaundryOrder has no customer relation — it stores customerId against the
    // platform Customer table, which is how the invoice resolver reads it too.
    // A name/mobile search therefore resolves ids first, exactly once.
    let customerIds: string[] | null = null
    if (q) {
      const matches = await prisma.customer.findMany({
        where: { OR: [{ name: { contains: q } }, { phone: { contains: q } }] },
        select: { id: true }, take: 200,
      })
      customerIds = matches.map((c) => c.id)
    }

    // Built as a typed array — an inline literal makes TS infer a union that
    // does not match Prisma's input type.
    const or: Prisma.LaundryOrderWhereInput[] = []
    if (q) {
      or.push({ orderNumber: { contains: q } })
      or.push({ invoice: { is: { invoiceNumber: { contains: q } } } })
      if (customerIds && customerIds.length) or.push({ customerId: { in: customerIds } })
    }
    const where: Prisma.LaundryOrderWhereInput = { businessId: biz.id, ...(or.length ? { OR: or } : {}) }

    const orders = await prisma.laundryOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true, orderNumber: true, status: true, paymentStatus: true, createdAt: true,
        grandTotal: true, amountPaid: true, balanceDue: true, discount: true, subscriptionCoveredAmount: true,
        customerId: true,
        // The order's recorded weight (measured at Store Audit) and its booked
        // services, so the ledger shows the same Service/Weight the other
        // operational screens do. Both are read as stored — never derived.
        totalWeightKg: true,
        services: { select: { serviceId: true, serviceName: true } },
        // The order's garment count, from the same _count.items the Orders
        // screen reads. Counted by the database inside the query already being
        // run — no extra round trip, and never inferred from the weight.
        _count: { select: { items: true } },
        invoice: { select: { invoiceNumber: true } },
        adjustments: { select: { amount: true, appliedToDue: true, refundable: true, refundStatus: true } },
      },
    })

    // Orders the business explicitly authorised to pay later. Derived from the
    // PAY_LATER event the payment endpoint already writes — no new status field
    // and no second mechanism.
    const orderIds = orders.map((o) => o.id)
    const payLaterRows = orderIds.length
      ? await prisma.laundryOrderEvent.findMany({
          where: { orderId: { in: orderIds }, action: "PAY_LATER" },
          select: { orderId: true }, distinct: ["orderId"],
        })
      : []
    const payLater = new Set(payLaterRows.map((e) => e.orderId))

    // One lookup for the page, not one per row.
    const custIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean))] as string[]
    const custs = custIds.length
      ? await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true, phone: true } })
      : []
    const custById = new Map(custs.map((c) => [c.id, c]))

    const rows = orders.map((o) => {
      const c = o.customerId ? custById.get(o.customerId) : null
      const f = financialSummary(o, o.adjustments)
      return {
        id: o.id, orderNumber: o.orderNumber, invoiceNumber: o.invoice?.invoiceNumber ?? null,
        customerName: c?.name ?? null, customerPhone: c?.phone ?? null,
        services: o.services.map((s) => ({ serviceId: s.serviceId, serviceName: s.serviceName })),
        totalWeightKg: o.totalWeightKg,
        itemCount: o._count.items,
        orderDate: o.createdAt, orderStatus: o.status,
        // Only while something is still owed; once collected it reverts to the
        // real payment status.
        paymentStatus: payLater.has(o.id) && f.balance > 0 ? "PAY LATER" : o.paymentStatus,
        orderTotal: f.invoiceTotal, subscriptionCovered: f.subscriptionCovered, discount: f.discount,
        paid: f.paid, refunded: f.refunded, refundDue: f.refundDue, balance: f.balance,
      }
    }).filter((r) => matchesLedgerFilter(filter, r))

    // ── Standalone subscription sales ──────────────────────────────────────
    // Only those with no laundryOrderId: one bought alongside an order is
    // already settled through that order's payment and would otherwise be
    // counted twice. Cancelled requests never took money, so they are not
    // financial rows.
    const purchases = await prisma.subscriptionPurchase.findMany({
      where: {
        businessId: biz.platformBusinessId || biz.id,
        laundryOrderId: null,
        status: { notIn: ["CANCELLED", "INITIATED"] },
        ...(customerIds ? { customerId: { in: customerIds } } : {}),
      },
      orderBy: { createdAt: "desc" },
    })
    const subPlanIds = [...new Set(purchases.map((p) => p.planId))]
    const subCustIds = [...new Set(purchases.map((p) => p.customerId))]
    const [subPlans, subCusts] = await Promise.all([
      subPlanIds.length ? prisma.subscriptionPlan.findMany({ where: { id: { in: subPlanIds } }, select: { id: true, name: true } }) : [],
      subCustIds.length ? prisma.customer.findMany({ where: { id: { in: subCustIds } }, select: { id: true, name: true, phone: true } }) : [],
    ])
    const subPlanById = new Map<string, string>(subPlans.map((p) => [p.id, p.name] as [string, string]))
    const subCustById = new Map<string, { id: string; name: string | null; phone: string | null }>(
      subCusts.map((c) => [c.id, c] as [string, { id: string; name: string | null; phone: string | null }]),
    )

    const subRows = purchases.map((p) => {
      const c = subCustById.get(p.customerId)
      const paid = r2(p.amountPaid)
      const balance = r2(Math.max(0, p.amount - p.amountPaid))
      return {
        id: p.id,
        kind: "SUBSCRIPTION" as const,
        // A subscription has no order number and one is never invented for it.
        orderNumber: null,
        planName: subPlanById.get(p.planId) || "Subscription",
        invoiceNumber: null,
        customerName: c?.name ?? null, customerPhone: c?.phone ?? null,
        services: [], totalWeightKg: null, itemCount: null,
        orderDate: p.createdAt, paidAt: p.paidAt,
        orderStatus: p.status, paymentStatus: p.paymentStatus,
        paymentMethod: p.paymentMethod ?? p.gateway ?? null,
        reference: p.paymentTransactionId || p.paymentReference || null,
        orderTotal: r2(p.amount), subscriptionCovered: 0, discount: 0,
        paid, refunded: 0, refundDue: 0, balance,
      }
    }).filter((r) => matchesLedgerFilter(filter, r))
      .filter((r) => !q || (r.customerName || "").toLowerCase().includes(q.toLowerCase()) || (r.planName || "").toLowerCase().includes(q.toLowerCase()))

    // Newest first across both kinds, so the ledger reads as one list.
    const all = [...rows.map((r) => ({ ...r, kind: "ORDER" as const, planName: null, paidAt: null, paymentMethod: null, reference: null })), ...subRows]
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())

    return NextResponse.json({ success: true, data: all })
  } catch (e) {
    console.error("[payments-ledger] GET", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
