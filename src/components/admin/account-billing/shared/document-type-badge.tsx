"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const DOC_TYPE_CONFIG: Record<string, { label: string; cls: string }> = {
  PROFORMA:         { label: "Proforma",         cls: "bg-sky-50 text-sky-700 border-sky-200" },
  TAX_INVOICE:      { label: "Tax Invoice",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CREDIT_NOTE:      { label: "Credit Note",      cls: "bg-violet-50 text-violet-700 border-violet-200" },
  DEBIT_NOTE:       { label: "Debit Note",       cls: "bg-orange-50 text-orange-700 border-orange-200" },
  PAYMENT_RECEIPT:  { label: "Receipt",          cls: "bg-teal-50 text-teal-700 border-teal-200" },
  ADJUSTMENT_NOTE:  { label: "Adjustment",       cls: "bg-amber-50 text-amber-700 border-amber-200" },
}

const DOC_STATUS_CONFIG: Record<string, string> = {
  Draft:           "bg-gray-50 text-gray-600 border-gray-200",
  Sent:            "bg-sky-50 text-sky-700 border-sky-200",
  Accepted:        "bg-blue-50 text-blue-700 border-blue-200",
  Expired:         "bg-amber-50 text-amber-700 border-amber-200",
  Cancelled:       "bg-red-50 text-red-700 border-red-200",
  "Partially Paid":"bg-orange-50 text-orange-700 border-orange-200",
  Paid:            "bg-emerald-50 text-emerald-700 border-emerald-200",
}

interface DocBadgeProps {
  value: string | null | undefined
  className?: string
}

export function DocumentTypeBadge({ value, className }: DocBadgeProps) {
  if (!value) return null
  const cfg = DOC_TYPE_CONFIG[value]
  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-medium hover:bg-transparent", cfg?.cls ?? "bg-gray-50 text-gray-600 border-gray-200", className)}>
      {cfg?.label ?? value}
    </Badge>
  )
}

export function DocumentStatusBadge({ value, className }: DocBadgeProps) {
  if (!value) return null
  const cls = DOC_STATUS_CONFIG[value] ?? "bg-gray-50 text-gray-600 border-gray-200"
  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-medium hover:bg-transparent", cls, className)}>
      {value}
    </Badge>
  )
}
