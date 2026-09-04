// TODAY'S TRANSACTIONS — the day's money, from the records that already hold it.
//
// Payments & Ledger answers "what is the money position of every order?". This
// answers a different question a counter asks at closing: "what actually came in
// today?" — so it is keyed on WHEN MONEY MOVED, never on when an order was
// created, delivered or subscribed. An order raised yesterday and paid today
// belongs here; an order raised today and unpaid does not.
//
// Nothing new is recorded. Two existing rows carry a real money movement:
//   LaundryPayment.createdAt      — written in the same transaction that moves
//                                   amountPaid, by every payment path (counter,
//                                   delivery COD, delivery QR, storefront
//                                   Razorpay, subscription coverage, refund).
//   SubscriptionPurchase.paidAt   — a subscription settled on its own.
// Pay Later writes no row at all, so an unpaid arrangement cannot appear here.
//
// KNOWN LIMITATION: a PARTIAL subscription collection records amountPaid and
// PROCESSING but no timestamp — applyPaymentToPurchase only stamps paidAt once
// the purchase is fully paid. Such a part-payment is therefore invisible to any
// date-based view until it completes. Fixing it means writing a timestamp on
// partial settlement, which is a payment-writer change and deliberately out of
// scope here.
import { PLATFORM } from "@/lib/constants"

/** The business's clock, not the server's and not the viewer's. */
export const LEDGER_TIMEZONE = PLATFORM.DEFAULT_TIMEZONE // "Asia/Kolkata"

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

/**
 * The instant a business day starts and ends, as UTC Dates for a query.
 *
 * Derived with Intl in the business timezone rather than the server's local
 * getDate(), which is what the delivery-promise dayKey uses — on a VPS running
 * UTC that would roll the day over at 05:30 IST and file the evening's takings
 * under tomorrow.
 */
export function businessDayBounds(now: Date = new Date(), timeZone: string = LEDGER_TIMEZONE): { start: Date; end: Date; dayKey: string } {
  // en-CA gives YYYY-MM-DD, so the parts need no reassembly.
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
  // What UTC instant is local midnight? Measure the zone's offset at `now` by
  // formatting it back, rather than hardcoding +05:30 — a fixed offset would be
  // wrong the moment this runs for a tenant in another zone.
  const asUtc = new Date(`${dayKey}T00:00:00Z`)
  const offsetMs = asUtc.getTime() - new Date(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(asUtc).replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$1-$2T$4:$5:$6Z")).getTime()
  const start = new Date(asUtc.getTime() + offsetMs)
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000), dayKey }
}

/** Allowance consumed against an order — a ledger entry, but no money arrived. */
export const SUBSCRIPTION_COVERAGE = "SUBSCRIPTION"
/** Money going out. Stored with a negative amount by the refund writer. */
export const REFUND = "REFUND"

/**
 * Was this order payment taken online?
 *
 * No writer populates LaundryPayment.gateway — the column is always null — and
 * the storefront records a Razorpay payment as method UPI, so the method alone
 * cannot tell an online payment from one typed at the counter. The existing
 * note and reference already say so, and this reads them rather than inventing
 * or persisting a new value.
 */
export function isOnlinePayment(row: { reference?: string | null; note?: string | null }): boolean {
  const ref = String(row.reference || "")
  const note = String(row.note || "").toLowerCase()
  return ref.startsWith("pay_") || note.includes("razorpay") || note.includes("online")
}

export type TxnKind = "LAUNDRY" | "SUBSCRIPTION" | "SUBSCRIPTION_COVERED" | "REFUND"

export interface TodayTransaction {
  id: string
  at: string
  kind: TxnKind
  customerName: string | null
  /** Order number for a laundry payment, plan name for a subscription. */
  reference: string | null
  /** Gateway/transaction id where one exists. */
  transactionRef: string | null
  method: string
  online: boolean
  amount: number
  status: string
}

export interface TodaySummary {
  /** Actual financial records only — payments in and refunds out. */
  transactions: number
  collected: number
  refunds: number
  net: number
  /** Allowance consumed against orders. Reported, never counted as money. */
  subscriptionCovered: number
  subscriptionCoveredOrders: number
  byMethod: Record<string, number>
}

/** Does this row represent money actually received? */
export function isCollected(t: { kind: TxnKind }): boolean {
  return t.kind === "LAUNDRY" || t.kind === "SUBSCRIPTION"
}

/**
 * Is this a financial transaction at all?
 *
 * Allowance coverage is a ledger entry against an order, not a payment: no
 * money arrived and no instrument was used. It is reported on its own so the
 * day's takings can be reconciled against a till, and it is kept out of the
 * transaction list and count for the same reason it is kept out of the totals.
 */
export function isMoneyTransaction(t: { kind: TxnKind }): boolean {
  return t.kind !== "SUBSCRIPTION_COVERED"
}

/**
 * The day's totals.
 *
 * Collected counts only money that arrived: allowance coverage is excluded
 * because nothing was paid, and refunds are excluded because they went the
 * other way. Refunds are reported as a positive magnitude and netted off, so
 * the three figures read the way a till does.
 */
export function summariseToday(rows: TodayTransaction[]): TodaySummary {
  let collected = 0, refunds = 0, subscriptionCovered = 0
  let transactions = 0, subscriptionCoveredOrders = 0
  const byMethod: Record<string, number> = {}
  for (const t of rows) {
    if (t.kind === "SUBSCRIPTION_COVERED") {
      // Counted on its own line only. Not a payment, so not a transaction.
      subscriptionCovered += t.amount
      subscriptionCoveredOrders += 1
      continue
    }
    transactions += 1
    if (t.kind === "REFUND") { refunds += Math.abs(t.amount); continue }
    collected += t.amount
    const key = t.online ? "ONLINE" : (t.method || "OTHER").toUpperCase()
    byMethod[key] = r2((byMethod[key] || 0) + t.amount)
  }
  return {
    transactions,
    collected: r2(collected),
    refunds: r2(refunds),
    net: r2(collected - refunds),
    subscriptionCovered: r2(subscriptionCovered),
    subscriptionCoveredOrders,
    byMethod,
  }
}

// ── Export ──────────────────────────────────────────────────────────────────
//
// The day's takings as a file, for a book-keeper or an accountant. It exports
// exactly what the screen shows — the same rows the Today API already returned
// and the same summary it already computed. Nothing is recomputed here, no
// second query is made, and allowance coverage stays out of the rows because
// the API never put it in them.

/** The one label per type, so the screen and the export cannot drift apart. */
export const TXN_LABEL: Record<TxnKind, string> = {
  LAUNDRY: "Laundry",
  SUBSCRIPTION: "Subscription",
  SUBSCRIPTION_COVERED: "Subscription Covered",
  REFUND: "Refund",
}

export const EXPORT_COLUMNS = ["Time", "Customer", "Order / Subscription", "Type", "Method", "Amount", "Status"] as const

/** Business-local clock, matching the screen — never the exporter's timezone. */
export function exportTime(iso: string, timeZone: string = LEDGER_TIMEZONE): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone })
}

/** Method as the screen presents it, online marker included. */
export function exportMethod(t: Pick<TodayTransaction, "method" | "online">): string {
  return t.online ? `${t.method} (Online / Razorpay)` : t.method
}

/** One export row, in column order. Amount stays negative for a refund. */
export function exportRow(t: TodayTransaction): (string | number)[] {
  return [
    exportTime(t.at),
    t.customerName || "Walk-in",
    t.reference || "—",
    TXN_LABEL[t.kind] ?? t.kind,
    exportMethod(t),
    t.amount,
    t.status,
  ]
}

/**
 * CSV. Every field is quoted and inner quotes doubled — the same escaping the
 * hardware event log uses — so a customer name with a comma, a quote or a
 * newline in it cannot break the column alignment.
 */
export function toCsv(rows: TodayTransaction[]): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  return [
    EXPORT_COLUMNS.map(esc).join(","),
    ...rows.map((t) => exportRow(t).map(esc).join(",")),
  ].join("\n")
}

/**
 * The worksheet, as rows of cells: the day's summary first, then the
 * transactions. Every figure is taken from the summary the API returned, so an
 * export can never disagree with the screen it was taken from.
 */
export function toWorkbookAoa(rows: TodayTransaction[], summary: TodaySummary, dayKey: string): (string | number)[][] {
  return [
    ["Today's Transactions", dayKey],
    [],
    ["Transactions", summary.transactions],
    ["Collected", summary.collected],
    ["Refunds", summary.refunds],
    ["Net Collected", summary.net],
    ["Subscription Covered", summary.subscriptionCovered],
    ["Subscription Covered Orders", summary.subscriptionCoveredOrders],
    [],
    [...EXPORT_COLUMNS],
    ...rows.map(exportRow),
  ]
}

/** Row index (0-based) of the Amount column, for number formatting. */
export const AMOUNT_COLUMN = EXPORT_COLUMNS.indexOf("Amount" as never)

/** payments-today-2026-09-04.csv — the business day, not the browser's. */
export function exportFilename(dayKey: string, ext: "csv" | "xlsx"): string {
  return `payments-today-${dayKey}.${ext}`
}
