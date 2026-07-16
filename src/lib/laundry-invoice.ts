// ============================================================================
// Laundry OS — Invoice & Financial Engine (SINGLE source of truth).
//
// There is exactly ONE laundry invoice engine. Admin, Customer Website, Customer
// App, Reports and Accounting all consume THIS service — never a second renderer
// or a second set of totals.
//
// Reuse, never duplicate:
//   • Totals come from the LaundryOrder financial snapshot (subtotal / gstTotal /
//     grandTotal / amountPaid / balanceDue), finalised at Store Audit (billedAt).
//   • Payment history comes from the existing LaundryPayment records.
//   • Per-tenant financial identity (numbering / GST / branding / rounding) comes
//     from LaundryFinancialSettings.
//
// This module only ADDS: the invoice document identity (number/status/GST
// treatment), an idempotent generator, and a single resolveInvoiceView() payload.
// It does NOT modify the Order Engine, Store Audit, Pricing, or Payments.
// ============================================================================

import { prisma } from "@/lib/prisma"

export interface FinancialSettings {
  businessId: string
  invoicePrefix: string
  invoiceNextNumber: number
  invoiceNumberPadding: number
  gstEnabled: boolean
  gstNumber: string | null
  taxInclusive: boolean
  homeState: string | null
  currency: string
  rounding: string
  decimalPrecision: number
  businessLogo: string | null
  businessAddress: string | null
  invoiceFooter: string | null
  invoiceTerms: string | null
  signatureUrl: string | null
  paymentInstructions: string | null
}

const DEFAULTS: Omit<FinancialSettings, "businessId"> = {
  invoicePrefix: "INV-LND",
  invoiceNextNumber: 1,
  invoiceNumberPadding: 6,
  gstEnabled: false,
  gstNumber: null,
  taxInclusive: false,
  homeState: null,
  currency: "INR",
  rounding: "NEAREST",
  decimalPrecision: 2,
  businessLogo: null,
  businessAddress: null,
  invoiceFooter: null,
  invoiceTerms: null,
  signatureUrl: null,
  paymentInstructions: null,
}

function roundAmount(n: number, mode: string, precision: number): number {
  const f = Math.pow(10, precision)
  const v = (n || 0) * f
  if (mode === "UP") return Math.ceil(v) / f
  if (mode === "DOWN") return Math.floor(v) / f
  if (mode === "NONE") return n || 0
  return Math.round(v) / f
}

function periodYYYYMM(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`
}

// Per-tenant financial settings, with safe defaults when none are configured yet.
export async function getFinancialSettings(businessId: string): Promise<FinancialSettings> {
  const s = await prisma.laundryFinancialSettings.findUnique({ where: { businessId } })
  return { ...DEFAULTS, ...(s ?? {}), businessId }
}

// Idempotent invoice generation. Returns the existing invoice if present; else
// allocates the next sequential, tenant-scoped, gap-tolerant number and creates
// it. Requires billing to be final (billedAt set at Store Audit).
export async function generateLaundryInvoice(
  orderId: string,
): Promise<{ ok: boolean; invoiceId?: string; invoiceNumber?: string; error?: string; status?: number }> {
  const order = await prisma.laundryOrder.findUnique({
    where: { id: orderId },
    select: { id: true, businessId: true, billedAt: true },
  })
  if (!order) return { ok: false, error: "Order not found", status: 404 }

  const existing = await prisma.laundryInvoice.findUnique({ where: { orderId } })
  if (existing) return { ok: true, invoiceId: existing.id, invoiceNumber: existing.invoiceNumber }

  if (!order.billedAt) {
    return { ok: false, error: "Invoice is available after Store Audit finalises billing.", status: 409 }
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const s = await tx.laundryFinancialSettings.findUnique({ where: { businessId: order.businessId } })
    const prefix = s?.invoicePrefix ?? DEFAULTS.invoicePrefix
    const padding = s?.invoiceNumberPadding ?? DEFAULTS.invoiceNumberPadding
    const seq = s?.invoiceNextNumber ?? DEFAULTS.invoiceNextNumber
    // Advance the counter (gap-tolerant: a rolled-back txn simply skips a number).
    if (s) {
      await tx.laundryFinancialSettings.update({ where: { businessId: order.businessId }, data: { invoiceNextNumber: seq + 1 } })
    } else {
      await tx.laundryFinancialSettings.create({ data: { businessId: order.businessId, invoiceNextNumber: seq + 1 } })
    }
    const gstEnabled = s?.gstEnabled ?? DEFAULTS.gstEnabled
    const number = `${prefix}-${periodYYYYMM(new Date())}-${String(seq).padStart(padding, "0")}`
    return tx.laundryInvoice.create({
      data: {
        businessId: order.businessId,
        orderId,
        invoiceNumber: number,
        status: "GENERATED",
        gstTreatment: gstEnabled ? "INTRA_STATE" : "NONE",
      },
    })
  })
  return { ok: true, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber }
}

// The SINGLE invoice payload consumed by Admin UI, Customer UI, PDF and Reports.
// Lazily generates the invoice (idempotent) once billing is final, so the invoice
// is available "automatically after Store Audit" without touching the audit route.
export async function resolveInvoiceView(orderId: string, opts?: { autoGenerate?: boolean }) {
  const order = await prisma.laundryOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "asc" } },
      invoice: true,
      store: true,
    },
  })
  if (!order) return { ok: false as const, error: "Order not found", status: 404 }

  let invoice = order.invoice
  if (!invoice && (opts?.autoGenerate ?? true) && order.billedAt) {
    const g = await generateLaundryInvoice(orderId)
    if (g.ok && g.invoiceId) invoice = await prisma.laundryInvoice.findUnique({ where: { id: g.invoiceId } })
  }

  const settings = await getFinancialSettings(order.businessId)
  const customer = order.customerId
    ? await prisma.customer
        .findUnique({ where: { id: order.customerId }, select: { id: true, name: true, phone: true, email: true, gstNumber: true } })
        .catch(() => null)
    : null

  const p = settings.decimalPrecision
  const gstTotal = order.gstTotal || 0
  const treatment = invoice?.gstTreatment ?? (settings.gstEnabled ? "INTRA_STATE" : "NONE")
  const cgst = treatment === "INTRA_STATE" ? roundAmount(gstTotal / 2, settings.rounding, p) : 0
  const sgst = treatment === "INTRA_STATE" ? roundAmount(gstTotal - cgst, settings.rounding, p) : 0
  const igst = treatment === "INTER_STATE" ? roundAmount(gstTotal, settings.rounding, p) : 0

  // Payment status resolved from the persisted order snapshot (never recomputed
  // here — the Order/Payment engine owns it).
  const paymentStatus = order.paymentStatus

  return {
    ok: true as const,
    data: {
      invoice: invoice
        ? {
            number: invoice.invoiceNumber,
            status: invoice.status,
            gstTreatment: invoice.gstTreatment,
            issuedAt: invoice.issuedAt,
            cancelledAt: invoice.cancelledAt,
            cancelReason: invoice.cancelReason,
            notes: invoice.notes,
          }
        : null, // null → billing not final yet (no invoice)
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        orderType: order.orderType,
        billedAt: order.billedAt,
        pickupDate: order.pickupDate,
        pickupAddress: order.pickupAddress,
        createdAt: order.createdAt,
      },
      totals: {
        subtotal: order.subtotal,
        gstTotal,
        pickupCharge: order.pickupCharge,
        deliveryCharge: order.deliveryCharge,
        expressCharge: order.expressCharge,
        discount: order.discount,
        grandTotal: order.grandTotal,
        amountPaid: order.amountPaid,
        balanceDue: order.balanceDue,
        paymentStatus,
      },
      gst: {
        enabled: settings.gstEnabled,
        treatment,
        cgst,
        sgst,
        igst,
        sellerGstNumber: settings.gstNumber,
        buyerGstNumber: customer?.gstNumber ?? null,
      },
      items: order.items.map((it) => ({
        id: it.id,
        serviceName: it.serviceName,
        garmentName: it.garmentName,
        pricingType: it.pricingType,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        weightKg: it.weightKg,
        gstPercent: it.gstPercent,
        lineAmount: it.lineAmount,
        gstAmount: it.gstAmount,
        total: it.total,
        barcode: it.barcode,
      })),
      payments: order.payments.map((pay) => ({
        id: pay.id,
        method: pay.method,
        amount: pay.amount,
        reference: pay.reference,
        note: pay.note,
        collectedBy: pay.createdBy,
        at: pay.createdAt,
      })),
      customer: customer
        ? { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, gstNumber: customer.gstNumber }
        : null,
      store: order.store
        ? { name: order.store.storeName, address: order.store.address, city: order.store.city, state: order.store.state }
        : null,
      settings: {
        currency: settings.currency,
        businessLogo: settings.businessLogo,
        businessAddress: settings.businessAddress,
        invoiceFooter: settings.invoiceFooter,
        invoiceTerms: settings.invoiceTerms,
        signatureUrl: settings.signatureUrl,
        paymentInstructions: settings.paymentInstructions,
        gstNumber: settings.gstNumber,
      },
    },
  }
}
