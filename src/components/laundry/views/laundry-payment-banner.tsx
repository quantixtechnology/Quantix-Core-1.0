"use client"

// Reusable payment banner — shown on every order/workflow screen. Colored by
// status (green PAID / amber PARTIAL / red UNPAID) with the payment details.
// Reads the order (paymentStatus, amounts) + its latest payment record.

import { useEffect, useState } from "react"
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react"

interface Payment { method?: string | null; reference?: string | null; receiptNumber?: string | null; collectedBy?: string | null; createdAt?: string | null; amount?: number | null }
interface OrderPay { orderNumber: string; paymentStatus: string; paymentPreference?: string | null; grandTotal: number; amountPaid: number; balanceDue: number; payments?: Payment[]; customer?: { name: string } | null; store?: { storeName: string } | null }

const inr = (n: number) => `₹${(n || 0).toFixed(2)}`
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—")

export function LaundryPaymentBanner({ orderId, compact = false }: { orderId: string; compact?: boolean }) {
  const [o, setO] = useState<OrderPay | null>(null)
  useEffect(() => {
    if (!orderId) return
    fetch(`/api/laundry/orders/${orderId}`).then((r) => r.json()).then((j) => { if (j.success) setO(j.data) }).catch(() => {})
  }, [orderId])
  if (!o) return null

  const st = o.paymentStatus
  const style = st === "PAID" || st === "SUBSCRIPTION"
    ? { wrap: "border-emerald-200 bg-emerald-50", pill: "bg-emerald-600", Icon: CheckCircle2, label: st === "SUBSCRIPTION" ? "COVERED (Subscription)" : "PAID" }
    : st === "PARTIAL"
      ? { wrap: "border-amber-200 bg-amber-50", pill: "bg-amber-500", Icon: AlertTriangle, label: "PARTIAL" }
      : { wrap: "border-rose-200 bg-rose-50", pill: "bg-rose-600", Icon: XCircle, label: "UNPAID" }
  const last = o.payments?.[0]

  return (
    <div className={`rounded-xl border ${style.wrap} px-4 py-3`}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className={`inline-flex items-center gap-1.5 rounded-lg ${style.pill} text-white text-xs font-bold px-2.5 py-1`}><style.Icon className="h-3.5 w-3.5" /> {style.label}</span>
        {!compact && <span className="text-sm text-slate-600">Order <span className="font-mono font-medium text-slate-800">{o.orderNumber}</span></span>}
        <Field label="Method" value={last?.method || o.paymentPreference || "—"} />
        <Field label="Paid" value={inr(o.amountPaid)} />
        <Field label="Pending" value={inr(o.balanceDue)} valueClass={o.balanceDue > 0 ? "text-rose-600" : "text-emerald-600"} />
        {last?.receiptNumber && <Field label="Receipt" value={last.receiptNumber} mono />}
        {last?.reference && <Field label="Txn" value={last.reference} mono />}
        {last?.collectedBy && <Field label="Collected By" value={last.collectedBy} />}
        {last?.createdAt && <Field label="Collected" value={fmt(last.createdAt)} />}
      </div>
    </div>
  )
}

function Field({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return <span className="text-sm"><span className="text-[11px] text-slate-400 mr-1">{label}:</span><span className={`font-medium text-slate-800 ${mono ? "font-mono text-xs" : ""} ${valueClass || ""}`}>{value}</span></span>
}
