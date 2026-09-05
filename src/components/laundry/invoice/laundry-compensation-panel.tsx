"use client"

// Payment & Adjustments — post-order customer compensation on Order Details.
//
// Lives here, not in Store Audit or Payment Collection, because the situations
// it exists for (a late express delivery, a damaged garment, an unhappy
// customer) are discovered AFTER those steps are closed.
//
// It never edits the invoice or a payment. The figures below are read from the
// order's existing financial snapshot plus the adjustment rows; the arithmetic
// lives in src/lib/laundry-adjustment.ts so the server and this panel cannot
// disagree.

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, HandCoins, Undo2 } from "lucide-react"
import {
  ADJUSTMENT_REASONS, REFUND_LABEL, reasonLabel, summarise, maxCompensation,
  validateCompensation, canRefund, type RefundStatus,
} from "@/lib/laundry-adjustment"

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const when = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

interface Adj {
  id: string; amount: number; reason: string; note: string | null
  appliedToDue: number; refundable: number
  refundStatus: string; refundReference: string | null; refundedAt: string | null
  createdByName: string | null; createdAt: string
  /** Set once the adjustment has been voided; it then counts for nothing. */
  voidedAt: string | null; voidedByName: string | null; voidReason: string | null
}
interface Money { grandTotal: number; amountPaid: number; balanceDue: number }

const STATUS_STYLE: Record<string, string> = {
  REFUNDED: "border-emerald-200 text-emerald-700 bg-emerald-50",
  PENDING: "border-amber-200 text-amber-700 bg-amber-50",
  PROCESSING: "border-blue-200 text-blue-700 bg-blue-50",
  FAILED: "border-rose-200 text-rose-700 bg-rose-50",
  NOT_REQUIRED: "border-slate-200 text-slate-500 bg-slate-50",
}

export function LaundryCompensationPanel({ orderId, businessId, onChanged }: { orderId: string; businessId: string; onChanged?: () => void }) {
  const [money, setMoney] = useState<Money | null>(null)
  const [rows, setRows] = useState<Adj[]>([])
  const [loading, setLoading] = useState(true)
  // 403 is a legitimate answer, not an error: a user without the financial
  // permission simply does not see this section.
  const [allowed, setAllowed] = useState(true)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState<string>(ADJUSTMENT_REASONS[0].value)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [refunding, setRefunding] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!orderId || !businessId) return
    setLoading(true)
    fetch(`/api/laundry/orders/${orderId}/adjustments?businessId=${encodeURIComponent(businessId)}`)
      .then(async (r) => {
        if (r.status === 403 || r.status === 401) { setAllowed(false); return null }
        return r.json()
      })
      .then((j) => { if (j?.success) { setMoney(j.data.order); setRows(j.data.adjustments || []) } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orderId, businessId])
  useEffect(() => { load() }, [load])

  if (!allowed) return null
  if (loading && !money) return null

  const s = money ? summarise(money, rows) : null
  const max = money ? maxCompensation(money, rows) : 0

  const apply = async () => {
    if (!money) return
    const amt = Number(amount)
    const err = validateCompensation(money, rows, amt)
    if (err) { toast.error(err); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/adjustments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, amount: amt, reason, note: note.trim() || null }),
      })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not apply compensation")
      toast.success("Compensation recorded")
      setOpen(false); setAmount(""); setNote(""); setReason(ADJUSTMENT_REASONS[0].value)
      load(); onChanged?.()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setSaving(false) }
  }

  const markRefunded = async (a: Adj) => {
    // Explicit, and only ever after the money has genuinely been sent — there is
    // no automated laundry refund call to do it for us.
    const reference = window.prompt(`Refund ${inr(a.refundable)} — enter a reference (UPI/UTR/receipt), or leave blank:`)
    if (reference === null) return
    setRefunding(a.id)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/adjustments/${a.id}/refund`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, status: "REFUNDED", reference: reference.trim() || null }),
      })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not record refund")
      toast.success("Refund recorded")
      load(); onChanged?.()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setRefunding(null) }
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Payment &amp; Adjustments</p>
        <button
          onClick={() => setOpen(true)} disabled={max <= 0}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
          <Plus className="h-3 w-3" /> Add Customer Compensation
        </button>
      </div>

      {s && (
        <div className="mt-2 space-y-0.5 text-xs">
          {/* The invoice total is shown unchanged, on purpose — compensation
              sits beside it rather than rewriting it. */}
          <Row k="Invoice Total" v={inr(s.invoiceTotal)} />
          <Row k="Paid" v={inr(s.paid)} />
          {s.compensation > 0 && <Row k="Customer Compensation" v={`- ${inr(s.compensation)}`} tone="text-amber-700" />}
          {s.refundDue > 0 && <Row k="Refund Due" v={inr(s.refundDue)} tone="text-rose-700" bold />}
          {s.refunded > 0 && <Row k="Refunded" v={inr(s.refunded)} tone="text-emerald-700" />}
          <Row k="Balance" v={inr(s.balance)} bold />
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Customer Compensation History</p>
          <div className="mt-1 space-y-1.5">
            {rows.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-100 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">{inr(a.amount)} — {reasonLabel(a.reason)}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[a.refundStatus] || STATUS_STYLE.NOT_REQUIRED}`}>
                    {REFUND_LABEL[a.refundStatus as RefundStatus] || a.refundStatus}
                  </span>
                </div>
                {a.note && <p className="mt-0.5 text-[11px] text-slate-500">{a.note}</p>}
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Added by {a.createdByName || "—"} · {when(a.createdAt)}
                  {a.refundReference && ` · Ref ${a.refundReference}`}
                </p>
                {canRefund(a.refundStatus) && a.refundable > 0 && (
                  <button
                    onClick={() => markRefunded(a)} disabled={refunding === a.id}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
                    {refunding === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />} Refund {inr(a.refundable)}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><HandCoins className="h-4 w-4 text-amber-600" /> Add Customer Compensation</p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Amount</label>
                <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                <p className="mt-1 text-[11px] text-slate-400">Up to {inr(max)} for this order.</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Reason</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500">
                  {ADJUSTMENT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Note (optional)</label>
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={apply} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                {saving && <Loader2 className="h-3 w-3 animate-spin" />} Apply Compensation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ k, v, tone, bold }: { k: string; v: string; tone?: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{k}</span>
      <span className={`${tone || "text-slate-800"} ${bold ? "font-semibold" : ""}`}>{v}</span>
    </div>
  )
}
