"use client"

// Customer Delivery Promise — the shared card and badge.
//
// Both read `deliveryPromise()`, the one function that decides the status, so a
// badge on a workstation card, the card on the order page and a report filter
// can never disagree about whether an order is late.
//
// Presentation only. Nothing here fetches, mutates or gates a workflow: a
// screen that drops the badge in keeps behaving exactly as it did.

import { deliveryPromise, formatPromiseLine } from "@/lib/laundry-delivery-promise"
import type { DeliveryPromiseInput, DeliveryPromise } from "@/lib/laundry-delivery-promise"

const TONE_CLS: Record<DeliveryPromise["tone"], string> = {
  neutral: "border-slate-200 text-slate-500 bg-slate-50",
  good: "border-emerald-300 text-emerald-700 bg-emerald-50",
  warn: "border-amber-300 text-amber-700 bg-amber-50",
  late: "border-orange-300 text-orange-700 bg-orange-50",
  critical: "border-rose-300 text-rose-700 bg-rose-50",
}

const TONE_DOT: Record<DeliveryPromise["tone"], string> = {
  neutral: "bg-slate-300",
  good: "bg-emerald-500",
  warn: "bg-amber-400",
  late: "bg-orange-500",
  critical: "bg-rose-500",
}

/**
 * Compact badge for order cards, queues and search results.
 *
 * Renders nothing for an order with no promise on record — a neutral chip on
 * every legacy order would be noise on screens that are mostly legacy data.
 */
export function DeliveryPromiseBadge({ order, className = "" }: { order: DeliveryPromiseInput; className?: string }) {
  const p = deliveryPromise(order)
  if (!p.captured) return null
  return (
    <span
      title={p.label + (p.rescheduled ? " · rescheduled by the business" : "")}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${TONE_CLS[p.tone]} ${className}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${TONE_DOT[p.tone]}`} />
      {p.shortLabel}
      {p.breached && p.daysLate ? ` · ${p.daysLate}d` : ""}
    </span>
  )
}

/**
 * The full card, for the order page and any screen with room for it.
 *
 * Primary and Backup are always the CUSTOMER's dates. When the business has
 * moved the working date, that appears as a separate "Rescheduled to" line
 * underneath rather than replacing what was promised — the whole point.
 */
export function DeliveryPromiseCard({ order, compact = false }: { order: DeliveryPromiseInput; compact?: boolean }) {
  const p = deliveryPromise(order)

  if (!p.captured) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Customer Delivery Promise</p>
        <p className="text-xs text-slate-400 mt-1">
          Not recorded for this order. Orders placed before delivery promises were captured show no promise rather than a guess.
        </p>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border bg-white ${compact ? "p-2.5" : "p-3"} ${p.breached ? "border-orange-200" : "border-slate-200"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Customer Delivery Promise</p>
        <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${TONE_CLS[p.tone]}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${TONE_DOT[p.tone]}`} />{p.label}
        </span>
      </div>

      <div className={`mt-2 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
        <Line label="Primary" value={formatPromiseLine(p.primary.date, p.primary.slot)} strong />
        <Line label="Backup" value={p.backup.date ? formatPromiseLine(p.backup.date, p.backup.slot) : "Not selected"} />
      </div>

      {p.rescheduled && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 px-2 py-1.5">
          <p className="text-[10px] font-medium text-amber-800">
            Business rescheduled to {formatPromiseLine(p.rescheduled.date, p.rescheduled.slot)}
          </p>
          <p className="text-[10px] text-amber-700">
            The customer&apos;s promise above is unchanged.
            {p.rescheduled.reason ? ` Reason: ${p.rescheduled.reason}` : ""}
          </p>
        </div>
      )}

      {p.deliveredAt && (
        <p className="mt-2 text-[10px] text-slate-500">
          Delivered {new Date(p.deliveredAt).toLocaleString("en-IN")}
          {p.daysLate && p.daysLate > 0 ? ` · ${p.daysLate} day${p.daysLate === 1 ? "" : "s"} after the primary promise` : ""}
        </p>
      )}
    </div>
  )
}

/** Urgency banner for the Delivery Executive PWA — prioritises the round. */
export function DeliveryPromiseUrgency({ order }: { order: DeliveryPromiseInput }) {
  const p = deliveryPromise(order)
  if (!p.captured || !p.breached || p.deliveredAt) return null
  return (
    <div className="rounded-xl border border-orange-300 bg-orange-50 px-3 py-2">
      <p className="text-sm font-semibold text-orange-800">⚠ Customer Promise Missed</p>
      <p className="text-xs text-orange-700">
        {p.status === "BACKUP_MISSED"
          ? "Both the promised and backup dates have passed. Deliver this order urgently."
          : "The promised date has passed. Deliver this order urgently."}
      </p>
    </div>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xs ${strong ? "font-semibold text-slate-800" : "text-slate-600"}`}>{value}</p>
    </div>
  )
}
