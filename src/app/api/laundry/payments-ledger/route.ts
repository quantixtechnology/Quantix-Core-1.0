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
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { requireLaundryLevel } from "@/lib/laundry-rbac"
import { Level } from "@/lib/laundry-rbac-registry"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { financialSummary, matchesLedgerFilter, type LedgerFilter } from "@/lib/laundry-adjustment"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const u = new URL(request.url)
    const businessId = u.searchParams.get("businessId")
    const guard = await requireLaundryLevel(request, businessId, "store_ops.payment_collection", Level.VIEW)
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

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

    return NextResponse.json({ success: true, data: rows })
  } catch (e) {
    console.error("[payments-ledger] GET", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
