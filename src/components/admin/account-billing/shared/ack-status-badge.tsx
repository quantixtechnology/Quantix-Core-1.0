"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export const ACK_STATUS_CONFIG: Record<string, { label: string; cls: string; desc: string }> = {
  RECEIVED:            { label: "Received",            cls: "bg-emerald-50 text-emerald-700 border-emerald-200", desc: "Full payment received and confirmed" },
  PARTIALLY_RECEIVED:  { label: "Partial",             cls: "bg-blue-50 text-blue-700 border-blue-200",         desc: "Partial payment received" },
  PENDING_VERIFICATION:{ label: "Pending Verification",cls: "bg-amber-50 text-amber-700 border-amber-200",      desc: "Payment received, awaiting verification" },
  REJECTED:            { label: "Rejected",            cls: "bg-red-50 text-red-700 border-red-200",            desc: "Payment was rejected or failed" },
  WAIVED:              { label: "Waived",              cls: "bg-purple-50 text-purple-700 border-purple-200",   desc: "Payment obligation waived" },
}

interface AckStatusBadgeProps {
  status: string | null | undefined
  className?: string
}

export function AckStatusBadge({ status, className }: AckStatusBadgeProps) {
  if (!status) return null
  const cfg = ACK_STATUS_CONFIG[status]
  if (!cfg) return <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", className)}>{status}</Badge>
  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-medium hover:bg-transparent", cfg.cls, className)}>
      {cfg.label}
    </Badge>
  )
}
