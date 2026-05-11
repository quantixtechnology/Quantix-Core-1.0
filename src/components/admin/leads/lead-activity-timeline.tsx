"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowRightLeft,
  MessageSquare,
  CalendarCheck,
  Phone,
  MessageCircle,
  MonitorPlay,
  IndianRupee,
  Rocket,
  ArrowRight,
  Filter,
} from "lucide-react"
import { activityTypeConfig } from "./crm-data"
import type { ActivityType } from "./crm-data"
import { leadStageColors } from "@/components/dashboard/data"
import type { LeadStage } from "@/components/dashboard/data"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { getRelativeTime } from "@/lib/utils"

const iconMap: Record<string, React.ElementType> = {
  ArrowRightLeft,
  MessageSquare,
  CalendarCheck,
  Phone,
  MessageCircle,
  MonitorPlay,
  IndianRupee,
  Rocket,
}

// API response activity shape
interface ApiActivity {
  id: string
  action: string
  details: {
    type?: string
    content?: string
    metadata?: Record<string, string>
    previousStage?: string
    newStage?: string
    leadName?: string
    addedBy?: string
  } | null
  user: {
    id: string
    name: string
    email: string
    avatar: string | null
  } | null
  ip: string | null
  createdAt: string
}

// Internal activity type matching the UI expectations
interface LeadActivity {
  id: string
  leadId: string
  type: ActivityType
  userId: string
  userName: string
  timestamp: string
  previousStage?: string
  newStage?: string
  content: string
  metadata?: Record<string, string>
}

// Map API action string to ActivityType
function actionToActivityType(action: string, detailsType?: string): ActivityType {
  if (detailsType) {
    const upper = detailsType.toUpperCase()
    const validTypes: ActivityType[] = [
      "STAGE_CHANGE", "COMMENT", "FOLLOW_UP", "CALL",
      "WHATSAPP", "DEMO_SHARED", "PAYMENT_FOLLOW_UP", "ONBOARDING_NOTE"
    ]
    if (validTypes.includes(upper as ActivityType)) return upper as ActivityType
  }
  // Fallback: parse from action string like "lead.STAGE_CHANGE"
  const suffix = action.replace("lead.", "").toUpperCase()
  const validTypes: ActivityType[] = [
    "STAGE_CHANGE", "COMMENT", "FOLLOW_UP", "CALL",
    "WHATSAPP", "DEMO_SHARED", "PAYMENT_FOLLOW_UP", "ONBOARDING_NOTE"
  ]
  if (validTypes.includes(suffix as ActivityType)) return suffix as ActivityType
  return "COMMENT"
}

function mapApiActivity(api: ApiActivity, leadId: string): LeadActivity {
  const details = api.details || {}
  return {
    id: api.id,
    leadId,
    type: actionToActivityType(api.action, details.type),
    userId: api.user?.id || "",
    userName: api.user?.name || details.addedBy || "Unknown",
    timestamp: api.createdAt,
    previousStage: details.previousStage,
    newStage: details.newStage,
    content: details.content || "",
    metadata: details.metadata,
  }
}

interface LeadActivityTimelineProps {
  leadId: string
  maxHeight?: string
}

export function LeadActivityTimeline({ leadId, maxHeight = "400px" }: LeadActivityTimelineProps) {
  const [filterType, setFilterType] = useState<ActivityType | "ALL">("ALL")
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActivities = useCallback(async () => {
    if (!leadId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/core/leads/${leadId}/activities`, {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (json.success && json.data?.activities) {
        const mapped = (json.data.activities as ApiActivity[]).map((a) =>
          mapApiActivity(a, leadId)
        )
        setActivities(mapped)
      } else {
        setActivities([])
      }
    } catch (err) {
      console.error("Failed to fetch lead activities:", err)
      setError("Failed to load activities")
      setActivities([])
    } finally {
      setIsLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const filteredActivities = activities
    .filter((a) => filterType === "ALL" || a.type === filterType)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const activityTypes: ActivityType[] = [
    "STAGE_CHANGE", "COMMENT", "FOLLOW_UP", "CALL", "WHATSAPP", "DEMO_SHARED", "PAYMENT_FOLLOW_UP", "ONBOARDING_NOTE"
  ]

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-16 flex-1" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {error}
        <Button variant="link" size="sm" onClick={fetchActivities} className="ml-2">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Button
          variant={filterType === "ALL" ? "default" : "outline"}
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => setFilterType("ALL")}
        >
          All
        </Button>
        {activityTypes.map((type) => {
          const config = activityTypeConfig[type]
          const count = activities.filter((a) => a.type === type).length
          if (count === 0) return null
          return (
            <Button
              key={type}
              variant={filterType === type ? "default" : "outline"}
              size="sm"
              className={`h-6 text-xs px-2 gap-1 ${filterType === type ? "" : config.color}`}
              onClick={() => setFilterType(type)}
            >
              {config.label}
              <span className="ml-0.5 opacity-70">({count})</span>
            </Button>
          )
        })}
      </div>

      {/* Timeline */}
      {filteredActivities.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No activities recorded for this lead.
        </div>
      ) : (
        <ScrollArea style={{ maxHeight }}>
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-4">
              {filteredActivities.map((activity) => {
                const config = activityTypeConfig[activity.type]
                const IconComponent = iconMap[config.icon]

                return (
                  <div key={activity.id} className="relative">
                    {/* Dot */}
                    <div
                      className={`absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full ${config.bgColor} ring-2 ring-background`}
                    >
                      <IconComponent className={`h-2.5 w-2.5 ${config.color}`} />
                    </div>

                    <div className="ml-2 space-y-1">
                      {/* Header */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getRelativeTime(activity.timestamp)}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="rounded-lg border bg-card p-3 text-sm">
                        {/* Stage change special rendering */}
                        {activity.type === "STAGE_CHANGE" && activity.previousStage && activity.newStage && (
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${leadStageColors[activity.previousStage as LeadStage] || "bg-muted"}`}
                            >
                              {activity.previousStage.replace(/_/g, " ")}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${leadStageColors[activity.newStage as LeadStage] || "bg-muted"}`}
                            >
                              {activity.newStage.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        )}
                        <p className="text-muted-foreground leading-relaxed">{activity.content}</p>

                        {/* Metadata */}
                        {activity.metadata && (
                          <div className="mt-2 flex gap-2 flex-wrap">
                            {Object.entries(activity.metadata).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-[10px] font-normal">
                                {key.replace(/([A-Z])/g, " $1").trim()}: {value}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* User */}
                      <p className="text-[11px] text-muted-foreground">by {activity.userName}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
