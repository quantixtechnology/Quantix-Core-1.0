"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Phone,
  CalendarCheck,
  MessageCircle,
  MonitorPlay,
  Clock,
  Hash,
} from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"

interface ContactStats {
  totalAttempts: number
  totalFollowUps: number
  totalCalls: number
  totalWhatsApp: number
  totalDemosShared: number
  daysSinceLastContact: number
}

// API activity shape
interface ApiActivity {
  id: string
  action: string
  details: {
    type?: string
  } | null
  createdAt: string
}

function computeStats(activities: ApiActivity[], lastContactedAt: string | null): ContactStats {
  let totalCalls = 0
  let totalWhatsApp = 0
  let totalDemosShared = 0
  let totalFollowUps = 0

  for (const activity of activities) {
    const type = activity.details?.type || activity.action.replace("lead.", "")
    const upper = type.toUpperCase()
    if (upper === "CALL") totalCalls++
    else if (upper === "WHATSAPP") totalWhatsApp++
    else if (upper === "DEMO_SHARED") totalDemosShared++
    else if (upper === "FOLLOW_UP") totalFollowUps++
  }

  const totalAttempts = activities.length
  const daysSinceLastContact = lastContactedAt
    ? Math.floor((Date.now() - new Date(lastContactedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999

  return {
    totalAttempts,
    totalFollowUps,
    totalCalls,
    totalWhatsApp,
    totalDemosShared,
    daysSinceLastContact,
  }
}

interface LeadContactCountersProps {
  leadId: string
  lastContactedAt?: string | null
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

export function LeadContactCounters({ leadId, lastContactedAt }: LeadContactCountersProps) {
  const [stats, setStats] = useState<ContactStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    if (!leadId) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/core/leads/${leadId}/activities`, {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (json.success && json.data?.activities) {
        const computed = computeStats(json.data.activities as ApiActivity[], lastContactedAt || null)
        setStats(computed)
      } else {
        // No activities — compute from lastContactedAt only
        if (lastContactedAt) {
          setStats({
            totalAttempts: 0,
            totalFollowUps: 0,
            totalCalls: 0,
            totalWhatsApp: 0,
            totalDemosShared: 0,
            daysSinceLastContact: Math.floor((Date.now() - new Date(lastContactedAt).getTime()) / (1000 * 60 * 60 * 24)),
          })
        } else {
          setStats(null)
        }
      }
    } catch (err) {
      console.error("Failed to fetch lead contact stats:", err)
      // Fallback: compute from lastContactedAt only
      if (lastContactedAt) {
        setStats({
          totalAttempts: 0,
          totalFollowUps: 0,
          totalCalls: 0,
          totalWhatsApp: 0,
          totalDemosShared: 0,
          daysSinceLastContact: Math.floor((Date.now() - new Date(lastContactedAt).getTime()) / (1000 * 60 * 60 * 24)),
        })
      } else {
        setStats(null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [leadId, lastContactedAt])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats()
  }, [leadId, lastContactedAt])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-md" />
        ))}
      </div>
    )
  }

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
