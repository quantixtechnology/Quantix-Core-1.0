"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { leadActivities, formatRelativeTime, activityTypeConfig } from "./crm-data"
import type { ActivityType } from "./crm-data"
import { leadStageColors } from "@/components/dashboard/data"
import type { LeadStage } from "@/components/dashboard/data"

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

interface LeadActivityTimelineProps {
  leadId: string
  maxHeight?: string
}

export function LeadActivityTimeline({ leadId, maxHeight = "400px" }: LeadActivityTimelineProps) {
  const [filterType, setFilterType] = useState<ActivityType | "ALL">("ALL")

  const activities = leadActivities
    .filter((a) => a.leadId === leadId)
    .filter((a) => filterType === "ALL" || a.type === filterType)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const activityTypes: ActivityType[] = [
    "STAGE_CHANGE", "COMMENT", "FOLLOW_UP", "CALL", "WHATSAPP", "DEMO_SHARED", "PAYMENT_FOLLOW_UP", "ONBOARDING_NOTE"
  ]

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
          const count = leadActivities.filter((a) => a.leadId === leadId && a.type === type).length
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
      {activities.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No activities recorded for this lead.
        </div>
      ) : (
        <ScrollArea style={{ maxHeight }}>
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-4">
              {activities.map((activity) => {
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
                          {formatRelativeTime(activity.timestamp)}
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
