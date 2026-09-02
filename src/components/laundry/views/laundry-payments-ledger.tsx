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
import { Loader2, Search, IndianRupee } from "lucide-react"
import type { LedgerFilter } from "@/lib/laundry-adjustment"
import { orderServiceLabel, orderWeightLabel } from "@/lib/laundry-order-display"
import { LaundryPaymentDetailsPanel } from "./laundry-payment-details-panel"

interface Row {
  id: string; orderNumber: string; invoiceNumber: string | null
  customerName: string | null; customerPhone: string | null
  orderDate: string; orderStatus: string; paymentStatus: string
  // The order's booked services and its RECORDED weight (measured at Store
  // Audit), returned by /api/laundry/payments-ledger. Read as stored.
  services?: { serviceId: string | null; serviceName: string }[]
  totalWeightKg?: number | null
  orderTotal: number; subscriptionCovered: number; discount: number
  paid: number; refunded: number; refundDue: number; balance: number
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

const FILTERS: { key: LedgerFilter; label: string }[] = [
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
  const [filter, setFilter] = useState<LedgerFilter>("ALL")
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
      .then((j) => { if (j.success) setRows(j.data || []) })
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

      {!loading && rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Collected" value={inr(totals.paid)} />
          <Tile label="Outstanding" value={inr(totals.balance)} tone="text-amber-700" />
          <Tile label="Refund Due" value={inr(totals.refundDue)} tone="text-rose-700" />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">Order</th>
              <th className="px-3 py-2.5 text-left font-semibold">Customer</th>
              <th className="px-3 py-2.5 text-left font-semibold">Service</th>
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
              <tr><td colSpan={11} className="py-12 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={11} className="py-12 text-center text-slate-400">No orders match this view.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} onClick={() => setOpenOrder(r)} className="cursor-pointer hover:bg-slate-50/60">
                <td className="px-3 py-2.5">
                  <div className="font-medium text-slate-800">{r.orderNumber}</div>
                  <div className="text-[11px] text-slate-400">{day(r.orderDate)}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-slate-700">{r.customerName || "Walk-in"}</div>
                  {r.customerPhone && <div className="text-[11px] text-slate-400">{r.customerPhone}</div>}
                </td>
                <td className="px-3 py-2.5 text-slate-600">{orderServiceLabel(r.services)}</td>
                {/* Recorded weight only — an unweighed order shows an em dash,
                    never 0 kg, and is never derived from the garment count. */}
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{orderWeightLabel(r.totalWeightKg)}</td>
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
