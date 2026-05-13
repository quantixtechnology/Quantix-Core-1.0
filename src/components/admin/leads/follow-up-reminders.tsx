"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Clock,
  AlertTriangle,
  CalendarClock,
  UserX,
  CheckCircle2,
  Calendar,
  Phone,
  ChevronDown,
  Bell,
  RefreshCw,
} from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { useAuthStore } from "@/stores/auth-store"

type ReminderType = "PENDING" | "OVERDUE" | "INACTIVITY"

interface FollowUpReminder {
  id: string
  leadId: string
  leadName: string
  type: ReminderType
  scheduledDate: string
  salesRepId: string
  salesRepName: string
}

const reminderTypeConfig: Record<ReminderType, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  PENDING: { icon: Clock, color: "text-amber-700", bgColor: "bg-amber-100", label: "Pending" },
  OVERDUE: { icon: AlertTriangle, color: "text-red-700", bgColor: "bg-red-100", label: "Overdue" },
  INACTIVITY: { icon: UserX, color: "text-slate-700", bgColor: "bg-slate-100", label: "Inactivity" },
}

// API activity shape for follow-ups
interface ApiActivity {
  id: string
  action: string
  details: {
    type?: string
    content?: string
    leadName?: string
    scheduledDate?: string
    addedBy?: string
  } | null
  user: {
    id: string
    name: string
  } | null
  createdAt: string
}

interface FollowUpRemindersProps {
  compact?: boolean
}

export function FollowUpReminders({ compact = false }: FollowUpRemindersProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [reminders, setReminders] = useState<FollowUpReminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { currentBusinessId } = useAuthStore()

  const fetchReminders = useCallback(async () => {
    setIsLoading(true)
    try {
      // Fetch leads that have followUpDate set
      const res = await fetch("/api/core/leads?limit=100", {
        headers: getAuthHeaders(),
      })
      const json = await res.json()

      if (json.success && Array.isArray(json.data)) {
        const now = new Date()
        const today = now.toISOString().split("T")[0]
        const reminderList: FollowUpReminder[] = []

        for (const lead of json.data as Array<Record<string, unknown>>) {
          const followUpDate = lead.followUpDate as string | null
          if (!followUpDate) continue

          const leadId = lead.id as string
          const leadName = lead.businessName as string
          const salesRep = lead.salesRep as { id: string; name: string } | null
          const salesRepId = salesRep?.id || ""
          const salesRepName = salesRep?.name || "Unassigned"
          const scheduledDate = followUpDate.split("T")[0]

          let type: ReminderType
          if (scheduledDate < today) {
            type = "OVERDUE"
          } else if (scheduledDate === today) {
            type = "PENDING"
          } else {
            type = "PENDING"
          }

          // Check for inactivity (no lastContactedAt or very old)
          const lastContactedAt = lead.lastContactedAt as string | null
          const daysSinceContact = lastContactedAt
            ? Math.floor((now.getTime() - new Date(lastContactedAt).getTime()) / (1000 * 60 * 60 * 24))
            : 999

          if (daysSinceContact > 7 && !followUpDate) {
            type = "INACTIVITY"
          }

          reminderList.push({
            id: `rem_${leadId}`,
            leadId,
            leadName,
            type,
            scheduledDate,
            salesRepId,
            salesRepName,
          })
        }

        setReminders(reminderList)
      } else {
        setReminders([])
      }
    } catch (err) {
      console.error("Failed to fetch follow-up reminders:", err)
      setReminders([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReminders()
  }, [])

  const overdue = reminders.filter((r) => r.type === "OVERDUE")
  const pending = reminders.filter((r) => r.type === "PENDING")
  const inactivity = reminders.filter((r) => r.type === "INACTIVITY")

  const today = new Date().toISOString().split("T")[0]
  const pendingToday = pending.filter((r) => r.scheduledDate === today).length
  const upcoming = pending.filter((r) => r.scheduledDate > today).length

  if (isLoading) {
    return (
      <Card className="border-l-4 border-l-amber-400">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`border-l-4 ${overdue.length > 0 ? "border-l-red-400" : "border-l-amber-400"}`}>
        <CollapsibleTrigger asChild>
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="h-5 w-5 text-amber-600" />
                {overdue.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                    {overdue.length}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold">Follow-up Reminders</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {overdue.length > 0 && (
                    <Badge variant="outline" className="text-[10px] h-4 text-red-600 border-red-200">
                      {overdue.length} overdue
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] h-4 text-amber-600 border-amber-200">
                    {pendingToday} today
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-4 text-slate-600 border-slate-200">
                    {upcoming} upcoming
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => { e.stopPropagation(); fetchReminders() }}
                title="Refresh"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            <ScrollArea className="max-h-72">
              <div className="space-y-2">
                {reminders.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No follow-up reminders
                  </div>
                ) : (
                  <>
                    {/* Overdue first */}
                    {overdue.map((reminder) => (
                      <ReminderItem key={reminder.id} reminder={reminder} />
                    ))}
                    {/* Then pending */}
                    {pending.map((reminder) => (
                      <ReminderItem key={reminder.id} reminder={reminder} />
                    ))}
                    {/* Then inactivity */}
                    {inactivity.map((reminder) => (
                      <ReminderItem key={reminder.id} reminder={reminder} />
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function ReminderItem({ reminder }: { reminder: FollowUpReminder }) {
  const config = reminderTypeConfig[reminder.type]
  const TypeIcon = config.icon
  const isOverdue = reminder.type === "OVERDUE"

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${
        isOverdue ? "border-red-200 bg-red-50/50" : "border-border"
      }`}
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${config.bgColor}`}>
        <TypeIcon className={`h-4 w-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{reminder.leadName}</p>
          <Badge variant="outline" className={`text-[9px] h-4 ${config.color} shrink-0`}>
            {config.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            <CalendarClock className="h-3 w-3 inline mr-0.5" />
            {reminder.scheduledDate}
          </span>
          <span className="text-[11px] text-muted-foreground">• {reminder.salesRepName}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700" title="Mark Complete">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-amber-600 hover:text-amber-700" title="Reschedule">
          <Calendar className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700" title="Contact Now">
          <Phone className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
