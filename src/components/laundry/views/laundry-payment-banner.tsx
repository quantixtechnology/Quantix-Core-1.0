"use client"

// Compact payment status card for the page header of every workflow screen.
// Shows payment status (colored), method, paid, pending, and txn reference when
// available. Reads the order (paymentStatus, amounts) + its latest payment.

import { useEffect, useState } from "react"
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react"

interface Payment { method?: string | null; reference?: string | null; receiptNumber?: string | null; collectedBy?: string | null; createdAt?: string | null }
interface OrderPay { orderNumber: string; paymentStatus: string; paymentPreference?: string | null; amountPaid: number; balanceDue: number; payments?: Payment[] }

const inr = (n: number) => `₹${(n || 0).toFixed(0)}`

export function LaundryPaymentBanner({ orderId }: { orderId: string }) {
  const [o, setO] = useState<OrderPay | null>(null)
  useEffect(() => {
    if (!orderId) return
    fetch(`/api/laundry/orders/${orderId}`).then((r) => r.json()).then((j) => { if (j.success) setO(j.data) }).catch(() => {})
  }, [orderId])
  if (!o) return null

  const st = o.paymentStatus
  const s = st === "PAID" || st === "SUBSCRIPTION"
    ? { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", Icon: CheckCircle2, label: st === "SUBSCRIPTION" ? "Covered" : "PAID" }
    : st === "PARTIAL"
      ? { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700", Icon: AlertTriangle, label: "PARTIAL" }
      : { border: "border-rose-200", bg: "bg-rose-50", text: "text-rose-700", Icon: XCircle, label: "UNPAID" }
  const last = o.payments?.[0]

  return (
    <div className={`inline-flex items-center gap-3 rounded-lg border ${s.border} ${s.bg} px-3 py-1.5`}>
      <span className={`inline-flex items-center gap-1 text-xs font-bold ${s.text}`}><s.Icon className="h-3.5 w-3.5" /> {s.label}</span>
      <span className="text-[11px] text-slate-500">Method <b className="text-slate-700 font-medium">{last?.method || o.paymentPreference || "—"}</b></span>
      <span className="text-[11px] text-slate-500">Paid <b className="text-slate-700 font-medium">{inr(o.amountPaid)}</b></span>
      <span className="text-[11px] text-slate-500">Pending <b className={o.balanceDue > 0 ? "text-rose-600 font-medium" : "text-emerald-600 font-medium"}>{inr(o.balanceDue)}</b></span>
      {(last?.reference || last?.receiptNumber) && <span className="text-[11px] text-slate-500">Txn <b className="text-slate-700 font-mono">{last.reference || last.receiptNumber}</b></span>}
    </div>
  )
}
