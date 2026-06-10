"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const SERVICE_TYPE_CONFIG: Record<string, string> = {
  "Platform Plan":        "bg-violet-50 text-violet-700 border-violet-200",
  "Add-On":               "bg-sky-50 text-sky-700 border-sky-200",
  "Mobile App":           "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Implementation":       "bg-orange-50 text-orange-700 border-orange-200",
  "Training":             "bg-teal-50 text-teal-700 border-teal-200",
  "Support":              "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Integration":          "bg-blue-50 text-blue-700 border-blue-200",
  "Credits":              "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Custom Development":   "bg-pink-50 text-pink-700 border-pink-200",
  "Other":                "bg-gray-50 text-gray-600 border-gray-200",
}

interface ServiceTypeBadgeProps {
  type: string | null | undefined
  className?: string
}

export function ServiceTypeBadge({ type, className }: ServiceTypeBadgeProps) {
  if (!type) return null
  const cls = SERVICE_TYPE_CONFIG[type] ?? "bg-gray-50 text-gray-600 border-gray-200"
  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-medium hover:bg-transparent", cls, className)}>
      {type}
    </Badge>
  )
}

export const BILLING_TYPE_CONFIG: Record<string, string> = {
  "Recurring":     "bg-sky-50 text-sky-700 border-sky-200",
  "One-Time":      "bg-amber-50 text-amber-700 border-amber-200",
  "Usage Based":   "bg-violet-50 text-violet-700 border-violet-200",
  "Credit":        "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Discount":      "bg-orange-50 text-orange-700 border-orange-200",
  "Refund":        "bg-rose-50 text-rose-700 border-rose-200",
}

export function BillingTypeBadge({ type, className }: ServiceTypeBadgeProps) {
  if (!type) return null
  const cls = BILLING_TYPE_CONFIG[type] ?? "bg-gray-50 text-gray-600 border-gray-200"
  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-medium hover:bg-transparent", cls, className)}>
      {type}
    </Badge>
  )
}
