// ============================================================================
// ORDERS & CUSTOMER REPORT — the column contract, in one place.
//
// ONE ROW PER ORDER. Garments are summarised into a readable cell rather than
// exploded into rows, so the money columns are the order's own figures and a
// three-garment order cannot multiply its total by three — the mistake this
// shape exists to prevent.
//
// Pure: no prisma, no React, no XLSX. The server shapes rows with buildReportRow
// and the screen writes them with the same COLUMNS array, so the header order
// and the value order cannot drift apart.
//
// Every value comes from a record that already exists. Pickup in particular is
// LaundryOrder.pickupDate / pickupTimeSlot and nothing else: it is never
// inferred from the delivery date or the creation time, which answer different
// questions.
// ============================================================================

/** Header row, in export order. The row builder emits values in this order. */
export const REPORT_COLUMNS = [
  "Order Number",
  "Store",
  "Stage",
  "Order Type",
  "Created",
  "Pickup Date",
  "Pickup Time Slot",
  "Delivery Date",
  "Delivery Time Slot",
  "Customer Name",
  "Mobile",
  "Email",
  "Customer Code",
  "Address",
  "Items",
  "Garments Summary",
  "Services",
  "Subtotal",
  "Discount",
  "Tax",
  "Total",
  "Amount Paid",
  "Balance Due",
  "Payment Status",
  "Payment Method",
  "Bag Numbers",
  "Audited At",
  "Delivered At",
] as const

export interface ReportItem {
  garmentName: string | null
  serviceName: string | null
  quantity: number | null
  unitPrice: number | null
  total: number | null
}

export interface ReportOrder {
  orderNumber: string | null
  storeName: string | null
  status: string | null
  orderType: string | null
  createdAt: Date | string | null
  pickupDate: Date | string | null
  pickupTimeSlot: string | null
  deliveryDate: Date | string | null
  deliveryTimeSlot: string | null
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  customerCode: string | null
  address: string | null
  items: ReportItem[]
  services: string[]
  subtotal: number | null
  discount: number | null
  gstTotal: number | null
  grandTotal: number | null
  amountPaid: number | null
  balanceDue: number | null
  paymentStatus: string | null
  paymentMethods: string[]
  bagNumbers: string[]
  auditedAt: Date | string | null
  deliveredAt: Date | string | null
}

const d = (v: Date | string | null | undefined): string => {
  if (!v) return ""
  const t = v instanceof Date ? v : new Date(v)
  return isNaN(t.getTime()) ? "" : t.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

const dt = (v: Date | string | null | undefined): string => {
  if (!v) return ""
  const t = v instanceof Date ? v : new Date(v)
  return isNaN(t.getTime())
    ? ""
    : t.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

const money = (n: number | null | undefined): number => (typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) / 100 : 0)

/**
 * "2 × Shirt (Wash & Fold) @ 35 = 70" per line — readable in a cell, never a
 * dumped object. Quantity, garment, service and price are the four things an
 * operator reads off a line, in the order they read them.
 */
export function garmentsSummary(items: ReportItem[]): string {
  return (items || [])
    .map((i) => {
      const qty = typeof i.quantity === "number" && i.quantity > 0 ? i.quantity : 1
      const name = i.garmentName || "Item"
      const svc = i.serviceName ? ` (${i.serviceName})` : ""
      const rate = typeof i.unitPrice === "number" && i.unitPrice > 0 ? ` @ ${money(i.unitPrice)}` : ""
      const line = typeof i.total === "number" && i.total > 0 ? ` = ${money(i.total)}` : ""
      return `${qty} × ${name}${svc}${rate}${line}`
    })
    .join("\n")
}

/** Total pieces on the order — the count, not the number of lines. */
export function totalPieces(items: ReportItem[]): number {
  return (items || []).reduce((n, i) => n + (typeof i.quantity === "number" && i.quantity > 0 ? i.quantity : 1), 0)
}

/**
 * One order → one row, values in REPORT_COLUMNS order.
 *
 * Money is the ORDER's own figure in every case. Nothing is summed from the
 * item lines, so a multi-garment order reports the same total the counter and
 * the invoice show.
 */
export function buildReportRow(o: ReportOrder): (string | number)[] {
  return [
    o.orderNumber || "",
    o.storeName || "",
    o.status || "",
    o.orderType || "",
    dt(o.createdAt),
    d(o.pickupDate),
    o.pickupTimeSlot || "",
    d(o.deliveryDate),
    o.deliveryTimeSlot || "",
    o.customerName || "",
    o.customerPhone || "",
    o.customerEmail || "",
    o.customerCode || "",
    o.address || "",
    totalPieces(o.items),
    garmentsSummary(o.items),
    (o.services || []).join(", "),
    money(o.subtotal),
    money(o.discount),
    money(o.gstTotal),
    money(o.grandTotal),
    money(o.amountPaid),
    money(o.balanceDue),
    o.paymentStatus || "",
    (o.paymentMethods || []).join(", "),
    (o.bagNumbers || []).join(", "),
    dt(o.auditedAt),
    dt(o.deliveredAt),
  ]
}
