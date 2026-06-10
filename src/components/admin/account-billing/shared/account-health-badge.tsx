"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type HealthScore = "Excellent" | "Good" | "Attention" | "Critical"

const HEALTH_CONFIG: Record<HealthScore, { cls: string; dot: string }> = {
  Excellent: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50", dot: "bg-emerald-500" },
  Good:      { cls: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50",               dot: "bg-sky-500"     },
  Attention: { cls: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50",       dot: "bg-amber-500"   },
  Critical:  { cls: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",               dot: "bg-red-500"     },
}

interface AccountHealthBadgeProps {
  score: HealthScore | string
  reason?: string
  className?: string
}

export function AccountHealthBadge({ score, reason, className }: AccountHealthBadgeProps) {
  const cfg = HEALTH_CONFIG[score as HealthScore] ?? HEALTH_CONFIG.Attention
  const badge = (
    <Badge
      variant="outline"
      className={cn("text-[10px] h-5 px-1.5 gap-1 font-medium", cfg.cls, className)}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
      {score}
    </Badge>
  )

  if (!reason) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px]">{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
