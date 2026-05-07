"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
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
} from "lucide-react"
import { followUpReminders } from "./crm-data"
import type { ReminderType } from "./crm-data"

const reminderTypeConfig: Record<ReminderType, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  PENDING: { icon: Clock, color: "text-amber-700", bgColor: "bg-amber-100", label: "Pending" },
  OVERDUE: { icon: AlertTriangle, color: "text-red-700", bgColor: "bg-red-100", label: "Overdue" },
  INACTIVITY: { icon: UserX, color: "text-slate-700", bgColor: "bg-slate-100", label: "Inactivity" },
}

interface FollowUpRemindersProps {
  compact?: boolean
}

export function FollowUpReminders({ compact = false }: FollowUpRemindersProps) {
  const [isOpen, setIsOpen] = useState(true)

  const overdue = followUpReminders.filter((r) => r.type === "OVERDUE")
  const pending = followUpReminders.filter((r) => r.type === "PENDING")
  const inactivity = followUpReminders.filter((r) => r.type === "INACTIVITY")

  const pendingToday = pending.filter((r) => r.scheduledDate === "2025-01-20").length
  const upcoming = pending.filter((r) => r.scheduledDate > "2025-01-20").length

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
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            <ScrollArea className="max-h-72">
              <div className="space-y-2">
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
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function ReminderItem({ reminder }: { reminder: (typeof followUpReminders)[0] }) {
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
