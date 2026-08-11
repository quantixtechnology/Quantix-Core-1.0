"use client"

// Payment Details — the money actions, inside Payments & Ledger.
//
// Order Details remains the operational order screen and keeps its financial
// summary; this is where money is actually MOVED: discounts, collection and
// refunds. One panel, reusing the endpoints already built — no second payment,
// discount, refund, coupon or ledger engine.

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2, X, Plus, Undo2, IndianRupee, ClipboardCheck, Clock } from "lucide-react"
import {
  ADJUSTMENT_REASONS, REFUND_LABEL, reasonLabel, financialSummary, maxCompensation,
  validateCompensation, canRefund, discountAmount, KIND_LABEL, discountHint,
  type RefundStatus, type AdjustmentKind,
} from "@/lib/laundry-adjustment"

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const when = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

interface Adj {
  id: string; amount: number; reason: string; note: string | null; kind: string
  promotionCode: string | null; appliedToDue: number; refundable: number
  refundStatus: string; refundReference: string | null; gatewayRefundId: string | null; createdByName: string | null; createdAt: string
}
interface Pay { id: string; method: string; amount: number; reference: string | null; status: string; gatewayPaymentId: string | null; createdAt: string; createdBy: string | null }
interface Scheme { id: string; title: string; code: string | null; discountType: string; discountValue: number; maxDiscount: number | null; refusal: string | null; amount: number }
interface Money { id: string; orderNumber: string; grandTotal: number; amountPaid: number; balanceDue: number; discount: number; subscriptionCoveredAmount: number }

const PAY_METHODS = ["CASH", "UPI", "RAZORPAY"] as const

export function LaundryPaymentDetailsPanel({ orderId, businessId, onClose, onChanged }: {
  orderId: string; businessId: string; onClose: () => void; onChanged?: () => void
}) {
  const [showPayLater, setShowPayLater] = useState(false)
  const [showReturn, setShowReturn] = useState(false)
  const [returnReason, setReturnReason] = useState("")
  const [money, setMoney] = useState<Money | null>(null)
  const [adjustments, setAdjustments] = useState<Adj[]>([])
  const [payments, setPayments] = useState<Pay[]>([])
  const [schemes, setSchemes] = useState<Scheme[]>([])
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null)
  const [customer, setCustomer] = useState<{ name: string | null; phone: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const [showDiscount, setShowDiscount] = useState(false)
  const [kind, setKind] = useState<AdjustmentKind>("MANUAL_DISCOUNT")
  const [mode, setMode] = useState<"FIXED" | "PERCENT">("FIXED")
  const [value, setValue] = useState("")
  const [reason, setReason] = useState<string>(ADJUSTMENT_REASONS[0].value)
  const [note, setNote] = useState("")
  const [schemeId, setSchemeId] = useState("")

  const [showCollect, setShowCollect] = useState(false)
  const [payMethod, setPayMethod] = useState<string>("CASH")
  const [payAmount, setPayAmount] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/laundry/orders/${orderId}/adjustments?businessId=${encodeURIComponent(businessId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return
        setMoney(j.data.order); setAdjustments(j.data.adjustments || []); setPayments(j.data.payments || [])
        setSchemes(j.data.schemes || []); setInvoiceNumber(j.data.invoiceNumber); setCustomer(j.data.customer)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orderId, businessId])
  useEffect(() => { load() }, [load])

  const f = money ? financialSummary(money, adjustments) : null
  const max = money ? maxCompensation(money, adjustments) : 0
  const hint = money ? discountHint(money, adjustments) : null

  // The preview the brief asks for: what this discount does BEFORE saving.
  const preview = useMemo(() => {
    if (!money) return null
    if (kind === "SCHEME_DISCOUNT") {
      const s = schemes.find((x) => x.id === schemeId)
      return s ? s.amount : 0
    }
    const v = Number(value) || 0
    return mode === "PERCENT" ? discountAmount("PERCENT", v, money.grandTotal, null) : Math.round(v * 100) / 100
  }, [money, kind, mode, value, schemeId, schemes])

  const applyDiscount = async () => {
    if (!money || preview == null) return
    const err = validateCompensation(money, adjustments, preview)
    if (err) { toast.error(err); return }
    setBusy("discount")
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/adjustments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId, kind, reason, note: note.trim() || null,
          ...(kind === "SCHEME_DISCOUNT" ? { promotionId: schemeId } : {}),
          ...(kind !== "SCHEME_DISCOUNT" && mode === "PERCENT" ? { discountType: "PERCENT", discountValue: Number(value) || 0 } : { amount: Number(value) || 0 }),
        }),
      })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not apply discount")
      toast.success("Discount applied")
      setShowDiscount(false); setValue(""); setNote(""); setSchemeId("")
      load(); onChanged?.()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(null) }
  }

  const collect = async () => {
    const amt = Number(payAmount) || 0
    if (amt <= 0) { toast.error("Enter an amount greater than zero."); return }
    if (payMethod === "RAZORPAY") {
      // Deliberately refused rather than faked: recording a RAZORPAY payment
      // with no gateway reference would put an unverifiable row in the ledger.
      toast.error("Razorpay is not configured yet. Use Cash or UPI, or connect Razorpay in Settings.")
      return
    }
    setBusy("collect")
    try {
      // The EXISTING payment endpoint — payment collection is unchanged.
      const res = await fetch(`/api/laundry/orders/${orderId}/payment?businessId=${encodeURIComponent(businessId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, method: payMethod, amount: amt }),
      })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not record payment")
      // The endpoint advances PAYMENT_PENDING → READY_FOR_PROCESSING itself, so
      // collecting never leaves the order stuck in the queue.
      toast.success("Payment recorded")
      setShowCollect(false); setPayAmount("")
      load(); onChanged?.()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(null) }
  }

  // RETURN TO AUDIT. Uses the existing transition endpoint and the existing
  // REOPEN_AUDIT edge, so the workflow decides whether it is allowed — this adds
  // no new rule and no new permission. The button reappeared here because
  // Payments & Ledger became the landing page for this nav item, which moved it
  // off the path staff actually walk.
  const returnToAudit = async () => {
    if (!returnReason.trim()) { toast.error("Enter a reason."); return }
    setBusy("return")
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/transition`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, toStatus: "PENDING_STORE_AUDIT", note: `Returned to audit: ${returnReason.trim()}` }),
      })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not return this order to audit")
      toast.success("Order returned to Store Audit")
      setShowReturn(false); setReturnReason("")
      onChanged?.(); onClose()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(null) }
  }

  /**
   * Pay Later is a DECISION, not a payment: it posts no money, leaves
   * amountPaid alone and the balance outstanding, records a PAY_LATER event and
   * advances the order out of Payment Collection. All of that already exists on
   * the payment endpoint; this only offers it.
   *
   * The workspace payment policy still applies — a business set to
   * ADVANCE_REQUIRED gets a 403 and the reason is shown.
   */
  const payLater = async () => {
    setBusy("paylater")
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/payment?businessId=${encodeURIComponent(businessId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, action: "PAY_LATER" }),
      })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not approve pay later")
      toast.success(j.data?.payLater ? "Pay Later approved — order moved to Packing & Dispatch" : "No balance due — order moved to Packing & Dispatch")
      setShowPayLater(false)
      load(); onChanged?.()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(null) }
  }

  const refund = async (a: Adj) => {
    const reference = window.prompt(`Refund ${inr(a.refundable)} — reference (UTR / receipt), or blank:`)
    if (reference === null) return
    setBusy(a.id)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/adjustments/${a.id}/refund`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, status: "REFUNDED", reference: reference.trim() || null }),
      })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not record refund")
      toast.success("Refund recorded")
      load(); onChanged?.()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-6 w-full max-w-2xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><IndianRupee className="h-4 w-4 text-blue-600" /> Payment Details</p>
            <p className="truncate text-[11px] text-slate-400">
              {money?.orderNumber}{customer?.name ? ` · ${customer.name}` : ""}{customer?.phone ? ` · ${customer.phone}` : ""}{invoiceNumber ? ` · ${invoiceNumber}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-50"><X className="h-4 w-4 text-slate-500" /></button>
        </div>

        {loading || !f ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" /></div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-0.5 text-sm">
              <Row k="Invoice Total" v={inr(f.invoiceTotal)} />
              {f.subscriptionCovered > 0 && <Row k="Subscription" v={`- ${inr(f.subscriptionCovered)}`} tone="text-indigo-700" />}
              {f.discount > 0 && <Row k="Discount" v={`- ${inr(f.discount)}`} tone="text-amber-700" />}
              <Row k="Amount Payable" v={inr(f.netPayable)} bold />
              <Row k="Paid" v={inr(f.paid)} />
              {f.refundDue > 0 && <Row k="Refund Due" v={inr(f.refundDue)} tone="text-rose-700" bold />}
              {f.refunded > 0 && <Row k="Refunded" v={inr(f.refunded)} tone="text-emerald-700" />}
              <Row k="Balance" v={inr(f.balance)} bold />
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setShowDiscount((v) => !v); setShowCollect(false) }} disabled={max <= 0}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                <Plus className="h-3 w-3" /> Add Discount
              </button>
              <button onClick={() => { setShowCollect((v) => !v); setShowDiscount(false); setShowPayLater(false); setPayAmount(String(f.balance || "")) }} disabled={f.balance <= 0}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                <Plus className="h-3 w-3" /> Collect Payment
              </button>
              {/* The business explicitly authorising a later payment. Offered
                  beside collection, never instead of it. */}
              <button onClick={() => { setShowPayLater((v) => !v); setShowCollect(false); setShowDiscount(false) }} disabled={f.balance <= 0}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                <Clock className="h-3 w-3" /> Pay Later
              </button>
            </div>

            {showDiscount && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div className="flex gap-2">
                  {(["MANUAL_DISCOUNT", "SCHEME_DISCOUNT"] as const).map((k) => (
                    <button key={k} onClick={() => setKind(k)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${kind === k ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600"}`}>
                      {k === "MANUAL_DISCOUNT" ? "Manual Discount" : "Scheme / Coupon"}
                    </button>
                  ))}
                </div>

                {kind === "MANUAL_DISCOUNT" ? (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label>{mode === "PERCENT" ? "Percentage" : "Amount"}</Label>
                      <input type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex rounded-lg border border-slate-200 p-0.5">
                      {(["FIXED", "PERCENT"] as const).map((m) => (
                        <button key={m} onClick={() => setMode(m)}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === m ? "bg-blue-600 text-white" : "text-slate-600"}`}>
                          {m === "FIXED" ? "₹" : "%"}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label>Select Scheme</Label>
                    <select value={schemeId} onChange={(e) => setSchemeId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500">
                      <option value="">Choose…</option>
                      {schemes.map((s) => (
                        // Unusable schemes stay visible but disabled, with the
                        // reason, rather than quietly disappearing.
                        <option key={s.id} value={s.id} disabled={!!s.refusal}>
                          {s.code ? `${s.code} — ` : ""}{s.title} · {s.discountType === "PERCENT" ? `${s.discountValue}%` : inr(s.discountValue)}
                          {s.refusal ? ` — ${s.refusal}` : ` → ${inr(s.amount)}`}
                        </option>
                      ))}
                    </select>
                    {schemes.length === 0 && <p className="mt-1 text-[11px] text-slate-400">No schemes configured yet.</p>}
                  </div>
                )}

                <div>
                  <Label>Reason</Label>
                  <select value={reason} onChange={(e) => setReason(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500">
                    {ADJUSTMENT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Note (optional)</Label>
                  <input value={note} onChange={(e) => setNote(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>

                {/* Shown before saving, so nobody has to do the sum themselves. */}
                <div className="rounded-lg bg-slate-50 p-2.5 text-xs">
                  <Row k="Current Payable" v={inr(f.netPayable)} />
                  <Row k="Discount" v={`- ${inr(preview || 0)}`} tone="text-amber-700" />
                  <Row k="New Payable" v={inr(Math.max(0, f.netPayable - (preview || 0)))} bold />
                  {f.paid > 0 && (preview || 0) > 0 && (
                    <Row k="Refund Due" v={inr(Math.min(preview || 0, f.paid))} tone="text-rose-700" />
                  )}
                </div>
                {/* Says what has happened and what this will do, instead of a
                    bare ceiling figure the user has no way to interpret. */}
                {hint && (
                  <div className="text-[11px] leading-relaxed text-slate-500">
                    <p className="font-medium text-slate-600">{hint.status}</p>
                    <p>{hint.effect}</p>
                    {hint.refundLimit && <p className="text-rose-600">{hint.refundLimit}</p>}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowDiscount(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                  <button onClick={applyDiscount} disabled={busy === "discount" || !preview}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {busy === "discount" && <Loader2 className="h-3 w-3 animate-spin" />} Apply Discount
                  </button>
                </div>
              </div>
            )}

            {showPayLater && (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-xs text-amber-900">{inr(f.balance)} will remain outstanding. Allow this customer to pay later?</p>
                <p className="text-[11px] text-amber-800">No payment is recorded. The order moves to Packing &amp; Dispatch and stays in Payments &amp; Ledger until the balance is collected.</p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowPayLater(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                  <button onClick={payLater} disabled={busy === "paylater"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {busy === "paylater" && <Loader2 className="h-3 w-3 animate-spin" />} Confirm Pay Later
                  </button>
                </div>
              </div>
            )}

            {showCollect && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Amount Due: <span className="font-semibold text-slate-800">{inr(f.balance)}</span></p>
                <div className="flex gap-2">
                  {PAY_METHODS.map((m) => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${payMethod === m ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600"}`}>
                      {m === "RAZORPAY" ? "Razorpay" : m}
                    </button>
                  ))}
                </div>
                {payMethod === "RAZORPAY" && (
                  <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                    Razorpay is not connected yet. Once configured, this button will create a Razorpay order, take the customer through checkout, verify the payment and record it here with its real payment id.
                  </p>
                )}
                <div>
                  <Label>Amount</Label>
                  <input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowCollect(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                  <button onClick={collect} disabled={busy === "collect"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {busy === "collect" && <Loader2 className="h-3 w-3 animate-spin" />} Collect Payment
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3">
              {!showReturn ? (
                <button onClick={() => setShowReturn(true)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-blue-700">
                  <ClipboardCheck className="h-3.5 w-3.5" /> Return to Audit
                </button>
              ) : (
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold text-slate-700">Return Order to Audit?</p>
                  <p className="text-[11px] text-slate-500">This sends the order back to Store Audit for correction or review. The order, its payments, subscription and audit history are all kept — nothing is duplicated.</p>
                  <input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="Reason (required)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowReturn(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                    <button onClick={returnToAudit} disabled={busy === "return" || !returnReason.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      {busy === "return" && <Loader2 className="h-3 w-3 animate-spin" />} Return to Audit
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Section title="Payment History">
              {payments.length === 0 ? <Empty>No payments recorded yet.</Empty> : payments.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-2 border-b border-slate-50 py-1.5 last:border-0">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{inr(p.amount)} · {p.method}</p>
                    <p className="text-[11px] text-slate-400">
                      {when(p.createdAt)}{p.gatewayPaymentId ? ` · Payment ID: ${p.gatewayPaymentId}` : p.reference ? ` · Ref ${p.reference}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold text-slate-500">{p.status || "SUCCESS"}</span>
                </div>
              ))}
            </Section>

            <Section title="Discounts & Refunds">
              {adjustments.length === 0 ? <Empty>No discounts or compensation on this order.</Empty> : adjustments.map((a) => (
                <div key={a.id} className="border-b border-slate-50 py-1.5 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">
                      - {inr(a.amount)} · {KIND_LABEL[a.kind as AdjustmentKind] || a.kind}
                      {a.promotionCode ? ` (${a.promotionCode})` : ""}
                    </p>
                    <span className="shrink-0 text-[10px] font-semibold text-slate-500">{REFUND_LABEL[a.refundStatus as RefundStatus] || a.refundStatus}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {reasonLabel(a.reason)}{a.note ? ` · ${a.note}` : ""} · {a.createdByName || "—"} · {when(a.createdAt)}
                    {a.gatewayRefundId ? ` · Refund ID: ${a.gatewayRefundId}` : a.refundReference ? ` · Ref ${a.refundReference}` : ""}
                  </p>
                  {canRefund(a.refundStatus) && a.refundable > 0 && (
                    <button onClick={() => refund(a)} disabled={busy === a.id}
                      className="mt-1 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
                      {busy === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />} Refund {inr(a.refundable)}
                    </button>
                  )}
                </div>
              ))}
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ k, v, tone, bold }: { k: string; v: string; tone?: string; bold?: boolean }) {
  return <div className="flex justify-between"><span className="text-slate-500">{k}</span><span className={`${tone || "text-slate-800"} ${bold ? "font-semibold" : ""}`}>{v}</span></div>
}
function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{children}</label>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</p><div>{children}</div></div>
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-400">{children}</p>
}
