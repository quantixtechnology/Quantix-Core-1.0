"use client"

// Payments & Ledger — the permanent financial view of every laundry order.
//
// Payment Collection remains exactly what it is: an operational QUEUE at
// PAYMENT_PENDING that orders leave when the workflow advances. This screen
// answers the other question — what is the money position of every order — and
// never leaves anything out, including DELIVERED and CANCELLED.
//
// It is read-only. Opening a row goes to the existing Order Details page, where
// the existing financial section handles discounts and refunds. No second
// order page, no second financial engine.

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { Loader2, Search, IndianRupee, Download } from "lucide-react"
import type { LedgerFilter } from "@/lib/laundry-adjustment"
import * as XLSX from "xlsx"
import {
  LEDGER_TIMEZONE, TXN_LABEL, toCsv, toWorkbookAoa, exportFilename, AMOUNT_COLUMN, EXPORT_COLUMNS,
} from "@/lib/laundry-today-transactions"
import { orderServiceLabel, orderWeightLabel } from "@/lib/laundry-order-display"
import { LaundryPaymentDetailsPanel } from "./laundry-payment-details-panel"

interface Row {
  /**
   * WHICH KIND OF MONEY this row is. An order's payments live on LaundryOrder /
   * LaundryPayment; a subscription sold on its own lives on
   * SubscriptionPurchase, which stays its source of truth. A subscription has
   * no order number and none is invented for it — the row shows the plan
   * instead, and the fields an order carries (service, items, weight, invoice)
   * are simply absent.
   */
  kind?: "ORDER" | "SUBSCRIPTION"
  planName?: string | null
  paidAt?: string | null
  paymentMethod?: string | null
  reference?: string | null
  id: string; orderNumber: string | null; invoiceNumber: string | null
  customerName: string | null; customerPhone: string | null
  orderDate: string; orderStatus: string; paymentStatus: string
  // The order's booked services and its RECORDED weight (measured at Store
  // Audit), returned by /api/laundry/payments-ledger. Read as stored.
  services?: { serviceId: string | null; serviceName: string }[]
  totalWeightKg?: number | null
  // The real garment count (_count.items) — the same semantic source the
  // Orders screen uses. Independent of the weight in both directions.
  itemCount?: number | null
  orderTotal: number; subscriptionCovered: number; discount: number
  paid: number; refunded: number; refundDue: number; balance: number
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
/** Business clock, so a till reading is the same wherever it is opened. */
const clock = (d: string) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: LEDGER_TIMEZONE })

/** Colour only — the wording comes from TXN_LABEL, which the export also uses. */
const TXN_TONE: Record<string, string> = {
  LAUNDRY: "border-blue-200 bg-blue-50 text-blue-700",
  SUBSCRIPTION: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SUBSCRIPTION_COVERED: "border-violet-200 bg-violet-50 text-violet-700",
  REFUND: "border-rose-200 bg-rose-50 text-rose-700",
}
function TxnType({ kind }: { kind: string }) {
  const cls = TXN_TONE[kind] ?? TXN_TONE.LAUNDRY
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{TXN_LABEL[kind as keyof typeof TXN_LABEL] ?? kind}</span>
}

/**
 * TODAY is a different question from the rest of these: not "what is owed on
 * each order?" but "what money moved today?". It is an additional view — every
 * other filter keeps its existing behaviour and its existing server path.
 */
type LedgerView = LedgerFilter | "TODAY"

interface TodayRow {
  id: string; at: string
  kind: "LAUNDRY" | "SUBSCRIPTION" | "SUBSCRIPTION_COVERED" | "REFUND"
  customerName: string | null; reference: string | null; transactionRef: string | null
  method: string; online: boolean; amount: number; status: string
}
interface TodaySummaryData {
  transactions: number; collected: number; refunds: number; net: number
  subscriptionCovered: number; subscriptionCoveredOrders: number
  byMethod: Record<string, number>
}

const FILTERS: { key: LedgerView; label: string }[] = [
  { key: "TODAY", label: "Today" },
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "PAID", label: "Paid" },
  { key: "PARTIAL", label: "Partial" },
  { key: "DISCOUNTED", label: "Discounted" },
  { key: "REFUNDED", label: "Refunded" },
]

export function LaundryPaymentsLedger() {
  const { currentBusinessId } = useAuthStore()
  const { setLaundryPage } = useAdminStore()
  // Money actions happen HERE. Order Details stays the operational screen and
  // keeps its own financial summary — this is not a second copy of it.
  const [openOrder, setOpenOrder] = useState<Row | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<LedgerView>("ALL")
  const [today, setToday] = useState<TodayRow[]>([])
  const [todaySummary, setTodaySummary] = useState<TodaySummaryData | null>(null)
  const [todayKey, setTodayKey] = useState("")

  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  // Both exports take the rows and totals already on screen. Nothing is
  // recomputed and no second request is made, so a file cannot disagree with
  // the view it came from.
  const downloadCsv = () => {
    save(new Blob([toCsv(today)], { type: "text/csv;charset=utf-8" }), exportFilename(todayKey, "csv"))
  }

  const downloadExcel = () => {
    if (!todaySummary) return
    const ws = XLSX.utils.aoa_to_sheet(toWorkbookAoa(today, todaySummary, todayKey))
    ws["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 26 }, { wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 12 }]
    // Amounts as numbers with two decimals, negatives kept negative so a refund
    // still reads as money out in a spreadsheet.
    const range = XLSX.utils.decode_range(ws["!ref"] as string)
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: AMOUNT_COLUMN })]
      if (cell && typeof cell.v === "number") { cell.t = "n"; cell.z = "#,##0.00" }
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Today's Transactions")
    XLSX.writeFile(wb, exportFilename(todayKey, "xlsx"))
  }
  const [search, setSearch] = useState("")
  const [q, setQ] = useState("")

  // Debounced so typing a mobile number does not fire a request per keystroke.
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t) }, [search])

  const load = useCallback(() => {
    if (!currentBusinessId) return
    setLoading(true)
    const p = new URLSearchParams({ businessId: currentBusinessId, filter })
    if (q) p.set("search", q)
    fetch(`/api/laundry/payments-ledger?${p}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return
        if (filter === "TODAY") { setToday(j.data || []); setTodaySummary(j.summary ?? null); setTodayKey(j.dayKey || "") }
        else setRows(j.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentBusinessId, filter, q])
  useEffect(() => { load() }, [load])

  const totals = useMemo(() => rows.reduce((a, r) => ({
    paid: a.paid + r.paid, balance: a.balance + r.balance, refundDue: a.refundDue + r.refundDue,
  }), { paid: 0, balance: 0, refundDue: 0 }), [rows])



  return (
    <div className="px-4 lg:px-6 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-blue-600" /> Payments &amp; Ledger
        </h1>
        <p className="text-sm text-slate-500">Every order&apos;s money position — at any stage, including delivered and cancelled.</p>
      </div>

      {/* The operational queue is untouched and still the place to collect
          payment; this screen is the record, not a replacement for the step. */}
      <button onClick={() => setLaundryPage("payment-queue")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        Open Payment Collection queue →
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Order #, invoice #, customer or mobile"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${filter === f.key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filter !== "TODAY" && !loading && rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Collected" value={inr(totals.paid)} />
          <Tile label="Outstanding" value={inr(totals.balance)} tone="text-amber-700" />
          <Tile label="Refund Due" value={inr(totals.refundDue)} tone="text-rose-700" />
        </div>
      )}

      {/* ── TODAY ────────────────────────────────────────────────────────────
          The day's takings, read from the payment records themselves. Collected
          counts only money that arrived: subscription allowance is shown
          separately because nothing was paid for it, and refunds are netted off
          rather than hidden. */}
      {filter === "TODAY" && (
        <>
          {todaySummary && (
            <>
              {/* Only in this view, and only once there is something to export —
                  the file is the day's takings, not an empty sheet. */}
              <div className="flex items-center justify-end gap-2">
                <button onClick={downloadCsv} disabled={today.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                  <Download className="h-3.5 w-3.5" /> Download CSV
                </button>
                <button onClick={downloadExcel} disabled={today.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40">
                  <Download className="h-3.5 w-3.5" /> Download Excel
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <Tile label="Transactions" value={String(todaySummary.transactions)} />
                <Tile label="Collected" value={inr(todaySummary.collected)} tone="text-emerald-700" />
                <Tile label="Refunds" value={inr(todaySummary.refunds)} tone="text-rose-700" />
                <Tile label="Net Collected" value={inr(todaySummary.net)} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {Object.entries(todaySummary.byMethod).sort((a, b) => b[1] - a[1]).map(([m, v]) => (
                  <span key={m} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                    {m === "ONLINE" ? "Online / Razorpay" : m}
                    <span className="ml-1.5 font-semibold text-slate-800">{inr(v)}</span>
                  </span>
                ))}
              </div>
              {/* Reported, never counted. No money arrived and no instrument was
                  used, so it is neither a transaction nor a collection — it sits
                  apart so the day's takings still reconcile against a till. */}
              {todaySummary.subscriptionCovered > 0 && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Subscription Covered</p>
                  <p className="mt-0.5 text-lg font-bold text-violet-800">{inr(todaySummary.subscriptionCovered)}</p>
                  <p className="text-[11px] text-violet-700/80">
                    {todaySummary.subscriptionCoveredOrders} order{todaySummary.subscriptionCoveredOrders === 1 ? "" : "s"} covered ·
                    allowance consumed, not money received
                  </p>
                </div>
              )}
            </>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {/* The same column list the export writes, so the file and
                      the screen can never show different columns. */}
                  {EXPORT_COLUMNS.map((h, i) => (
                    <th key={h} className={`px-3 py-2.5 font-semibold ${i === 5 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
                ) : today.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400">No payments received yet today.</td></tr>
                ) : today.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 tabular-nums text-slate-600">{clock(t.at)}</td>
                    <td className="px-3 py-2.5 text-slate-700">{t.customerName || "Walk-in"}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-[12px] text-slate-700">{t.reference || "—"}</div>
                      {t.transactionRef && <div className="font-mono text-[10px] text-slate-400">{t.transactionRef}</div>}
                    </td>
                    <td className="px-3 py-2.5"><TxnType kind={t.kind} /></td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {t.method}
                      {t.online && <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700">Online / Razorpay</span>}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${t.amount < 0 ? "text-rose-700" : "text-slate-800"}`}>{inr(t.amount)}</td>
                    <td className="px-3 py-2.5 text-[11px] font-semibold text-slate-600">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className={`overflow-x-auto rounded-xl border border-slate-200 bg-white ${filter === "TODAY" ? "hidden" : ""}`}>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">Order</th>
              <th className="px-3 py-2.5 text-left font-semibold">Customer</th>
              <th className="px-3 py-2.5 text-left font-semibold">Service</th>
              <th className="px-3 py-2.5 text-right font-semibold">Items</th>
              <th className="px-3 py-2.5 text-right font-semibold">Weight</th>
              <th className="px-3 py-2.5 text-left font-semibold">Invoice</th>
              <th className="px-3 py-2.5 text-right font-semibold">Total</th>
              <th className="px-3 py-2.5 text-right font-semibold">Discount</th>
              <th className="px-3 py-2.5 text-right font-semibold">Paid</th>
              <th className="px-3 py-2.5 text-right font-semibold">Refund</th>
              <th className="px-3 py-2.5 text-right font-semibold">Balance</th>
              <th className="px-3 py-2.5 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={12} className="py-12 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={12} className="py-12 text-center text-slate-400">No transactions match this view.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} onClick={() => { if (r.kind !== "SUBSCRIPTION") setOpenOrder(r) }} className={`${r.kind === "SUBSCRIPTION" ? "" : "cursor-pointer"} hover:bg-slate-50/60`}>
                <td className="px-3 py-2.5">
                  {r.kind === "SUBSCRIPTION" ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700">Subscription</span>
                        <span className="font-medium text-slate-800">{r.planName || "Subscription"}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {day(r.orderDate)}
                        {r.paymentMethod ? ` · ${r.paymentMethod}` : ""}
                      </div>
                      {r.reference && <div className="font-mono text-[10px] text-slate-400">{r.reference}</div>}
                    </>
                  ) : (
                    <>
                      <div className="font-medium text-slate-800">{r.orderNumber}</div>
                      <div className="text-[11px] text-slate-400">{day(r.orderDate)}</div>
                    </>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-slate-700">{r.customerName || "Walk-in"}</div>
                  {r.customerPhone && <div className="text-[11px] text-slate-400">{r.customerPhone}</div>}
                </td>
                <td className="px-3 py-2.5 text-slate-600">{r.kind === "SUBSCRIPTION" ? <span className="text-slate-300">—</span> : orderServiceLabel(r.services)}</td>
                {/* Count and weight are independent readings of the same order:
                    the count is _count.items, the weight is what Store Audit
                    measured. Neither is derived from the other, and an unweighed
                    order shows an em dash rather than 0 kg. */}
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.kind === "SUBSCRIPTION" ? <span className="text-slate-300">—</span> : (r.itemCount ?? 0)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.kind === "SUBSCRIPTION" ? <span className="text-slate-300">—</span> : orderWeightLabel(r.totalWeightKg)}</td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{r.invoiceNumber || "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{inr(r.orderTotal)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.discount > 0 ? <span className="text-amber-700">-{inr(r.discount)}</span> : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{inr(r.paid)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {r.refundDue > 0 ? <span className="text-rose-700">{inr(r.refundDue)} due</span>
                    : r.refunded > 0 ? <span className="text-emerald-700">{inr(r.refunded)}</span>
                      : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-800">{inr(r.balance)}</td>
                <td className="px-3 py-2.5">
                  <div className="text-[11px] font-semibold text-slate-600">{r.paymentStatus}</div>
                  <div className="text-[11px] text-slate-400">{r.orderStatus.replace(/_/g, " ")}</div>
                  {r.kind === "SUBSCRIPTION" && r.paidAt && <div className="text-[10px] text-slate-400">{day(r.paidAt)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openOrder && currentBusinessId && (
        <LaundryPaymentDetailsPanel
          orderId={openOrder.id} businessId={currentBusinessId}
          onClose={() => setOpenOrder(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${tone || "text-slate-800"}`}>{value}</div>
    </div>
  )
}
