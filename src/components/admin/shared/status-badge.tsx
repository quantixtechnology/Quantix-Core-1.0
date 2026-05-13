"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const colorMap: Record<string, string> = {
  // Lead stages
  LEAD: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  DEMO_SHARED: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  NEGOTIATION: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  PAYMENT_PENDING: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  PAYMENT_RECEIVED: "bg-teal-100 text-teal-700 hover:bg-teal-100",
  KYC_PENDING: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  ONBOARDING: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  DEPLOYMENT: "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
  ACTIVE: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  LOST: "bg-red-100 text-red-700 hover:bg-red-100",
  CHURNED: "bg-slate-100 text-slate-500 hover:bg-slate-100",
  // Business status
  SUSPENDED: "bg-red-100 text-red-700 hover:bg-red-100",
  // Subscription status
  PAST_DUE: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  EXPIRED: "bg-slate-100 text-slate-500 hover:bg-slate-100",
  PENDING_ACTIVATION: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  CANCELLED: "bg-slate-100 text-slate-500 hover:bg-slate-100",
  // Domain status
  PENDING_DNS: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  DNS_PROPAGATING: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  SSL_PENDING: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  ERROR: "bg-red-100 text-red-700 hover:bg-red-100",
  // Deployment status
  PENDING: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  BUILDING: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  DEPLOYING: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  LIVE: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  FAILED: "bg-red-100 text-red-700 hover:bg-red-100",
  MAINTENANCE: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  // Demo tenant
  AVAILABLE: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  IN_USE: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  MAINTENANCE_DEMO: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  DISABLED: "bg-slate-100 text-slate-500 hover:bg-slate-100",
  // Order statuses
  PENDING_ORDER: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  CONFIRMED: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  PREPARING: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  OUT_FOR_DELIVERY: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  DELIVERED: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  // Payment
  COMPLETED: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  PROCESSING: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  REFUNDED: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  // Onboarding
  IN_PROGRESS: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  COMPLETED_STEP: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  SKIPPED: "bg-slate-100 text-slate-500 hover:bg-slate-100",
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClass = colorMap[status] || "bg-slate-100 text-slate-700 hover:bg-slate-100"
  return (
    <Badge variant="secondary" className={cn("font-medium text-xs border-0", colorClass, className)}>
      {status.replace(/_/g, " ")}
    </Badge>
  )
}

export function CurrencyBadge({ amount, override, original }: { amount: number; override?: boolean; original?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold">₹{amount.toLocaleString("en-IN")}</span>
      {override && original && (
        <span className="text-xs text-muted-foreground line-through">₹{original.toLocaleString("en-IN")}</span>
      )}
      {override && (
        <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px] border-0">
          CUSTOM
        </Badge>
      )}
    </div>
  )
}
