"use client"

import { Badge } from "@/components/ui/badge"
import {
  Phone,
  CalendarCheck,
  MessageCircle,
  MonitorPlay,
  Clock,
  Hash,
} from "lucide-react"
import { leadContactStats } from "./crm-data"

interface LeadContactCountersProps {
  leadId: string
}

function getDaysColor(days: number): string {
  if (days < 3) return "text-emerald-600 bg-emerald-50 border-emerald-200"
  if (days <= 7) return "text-amber-600 bg-amber-50 border-amber-200"
  return "text-red-600 bg-red-50 border-red-200"
}

function getDaysLabel(days: number): string {
  if (days === 0) return "Today"
  if (days === 1) return "1 day ago"
  return `${days} days ago`
}

export function LeadContactCounters({ leadId }: LeadContactCountersProps) {
  const stats = leadContactStats[leadId]

  if (!stats) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs gap-1">
          <Hash className="h-3 w-3" /> No contact data
        </Badge>
      </div>
    )
  }

  const counters = [
    { icon: Hash, label: "Attempts", value: stats.totalAttempts, color: "text-slate-600 bg-slate-50 border-slate-200" },
    { icon: CalendarCheck, label: "Follow-ups", value: stats.totalFollowUps, color: "text-amber-600 bg-amber-50 border-amber-200" },
    { icon: Phone, label: "Calls", value: stats.totalCalls, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    { icon: MessageCircle, label: "WhatsApp", value: stats.totalWhatsApp, color: "text-green-600 bg-green-50 border-green-200" },
    { icon: MonitorPlay, label: "Demos", value: stats.totalDemosShared, color: "text-blue-600 bg-blue-50 border-blue-200" },
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {counters.map((counter) => (
        <div
          key={counter.label}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${counter.color}`}
        >
          <counter.icon className="h-3 w-3" />
          <span>{counter.value}</span>
          <span className="font-normal opacity-70">{counter.label}</span>
        </div>
      ))}
      <div
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${getDaysColor(stats.daysSinceLastContact)}`}
      >
        <Clock className="h-3 w-3" />
        <span>{getDaysLabel(stats.daysSinceLastContact)}</span>
      </div>
    </div>
  )
}
