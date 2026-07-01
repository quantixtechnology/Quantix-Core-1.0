"use client"

// Reusable workflow timeline — the operational lifecycle shown on every order
// screen. Maps the order's current status to the ordered stages and renders
// completed / current / pending with the standard status colors. Mirrors the
// workflow engine (single source of truth); it never mutates state.

import { Check } from "lucide-react"

const STAGES = [
  { key: "created", label: "Order Created" },
  { key: "audit", label: "Store Audit" },
  { key: "payment", label: "Payment & Invoice" },
  { key: "packing", label: "Packing & Dispatch" },
  { key: "processing", label: "Processing" },
  { key: "qc", label: "QC & Packing" },
  { key: "ready", label: "Ready for Delivery" },
  { key: "delivered", label: "Delivered" },
]

// Engine statuses in order → timeline stage index (created is stage 0).
const STATUS_ORDER = ["PENDING_STORE_AUDIT", "PAYMENT_PENDING", "READY_FOR_PROCESSING", "PROCESSING", "QC_PENDING", "READY_FOR_DELIVERY", "DELIVERED"]

function currentStageIndex(status: string): number {
  const s = status === "UNDER_AUDIT" ? "PENDING_STORE_AUDIT" : status
  const idx = STATUS_ORDER.indexOf(s)
  return idx < 0 ? 0 : idx + 1
}

export function LaundryWorkflowTimeline({ status, className = "" }: { status: string; className?: string }) {
  const cancelled = status === "CANCELLED"
  const cur = currentStageIndex(status)

  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="flex items-start gap-0 min-w-max px-1">
        {STAGES.map((stage, i) => {
          const completed = !cancelled && i < cur
          const current = !cancelled && i === cur
          const dotClass = cancelled
            ? "bg-red-100 text-red-600 border-red-300"
            : completed
              ? "bg-emerald-500 text-white border-emerald-500"
              : current
                ? "bg-sky-600 text-white border-sky-600 ring-4 ring-sky-100"
                : "bg-white text-muted-foreground border-slate-200"
          const lineClass = !cancelled && i < cur ? "bg-emerald-400" : "bg-slate-200"
          return (
            <div key={stage.key} className="flex flex-col items-center" style={{ minWidth: 96 }}>
              <div className="flex items-center w-full">
                <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : lineClass}`} />
                <div className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold shrink-0 ${dotClass}`}>
                  {completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <div className={`h-0.5 flex-1 ${i === STAGES.length - 1 ? "opacity-0" : (!cancelled && i < cur ? "bg-emerald-400" : "bg-slate-200")}`} />
              </div>
              <p className={`mt-1.5 text-[10px] text-center leading-tight px-1 ${current ? "font-semibold text-sky-700" : completed ? "text-emerald-700" : "text-muted-foreground"}`}>{stage.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
