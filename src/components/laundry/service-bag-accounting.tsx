"use client"

// Service-level bag accounting — "Wash & Fold 2/2 ✓ · Dry Clean 1/2 ⚠", never
// just "4 bags". Presentational: it renders the accounting computed by
// src/lib/laundry-service-bags.ts and holds no state of its own.

import { CheckCircle2, AlertTriangle, ShoppingBag } from "lucide-react"
import type { ServiceBagAccounting } from "@/lib/laundry-service-bags"

export function ServiceBagAccountingPanel({ accounting, title = "Bag Accounting" }: {
  accounting: ServiceBagAccounting
  title?: string
}) {
  // No services booked (offline/store orders can be like this) → nothing to
  // account for. Never invent a requirement that was never made.
  if (accounting.services.length === 0) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
        <ShoppingBag className="h-3.5 w-3.5" /> {title}
      </p>

      {accounting.services.map((s) => (
        <div key={s.serviceId ?? s.serviceName} className={`rounded-lg border p-2.5 ${s.complete ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-slate-800">{s.serviceName}</span>
            <span className={`text-[13px] font-bold tabular-nums flex items-center gap-1 ${s.complete ? "text-emerald-700" : "text-amber-700"}`}>
              {s.label}
              {s.complete ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Required {s.required} · Received {s.assigned}</p>
          {s.bags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {s.bags.map((b, i) => (
                <span key={b.assignmentId} className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600">
                  Bag {i + 1} — {b.bagNumber}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* A bag filed against a service that is not on this order is shown, never
          quietly counted towards a requirement it cannot satisfy. */}
      {accounting.unmatched.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <p className="text-[11px] font-semibold text-slate-600">Not matched to a booked service</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {accounting.unmatched.map((b) => (
              <span key={b.assignmentId} className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600">{b.bagNumber}</span>
            ))}
          </div>
        </div>
      )}

      <div className={`flex items-center justify-between rounded-lg px-2.5 py-2 ${accounting.complete ? "bg-emerald-600" : "bg-amber-500"}`}>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/90">Total</span>
        <span className="text-sm font-bold text-white tabular-nums">{accounting.summary} {accounting.complete ? "✓" : "⚠"}</span>
      </div>
      {accounting.message && <p className="text-[11px] text-amber-700">{accounting.message}</p>}
    </div>
  )
}
