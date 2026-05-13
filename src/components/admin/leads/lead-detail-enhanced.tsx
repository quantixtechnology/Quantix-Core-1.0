"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Phone,
  Mail,
  UserCircle,
  Share2,
  StickyNote,
  Calendar,
  CheckCircle2,
  MessageCircle,
  PhoneCall,
  AlertTriangle,
  ArrowLeft,
  Activity,
  MessageSquare,
  History,
  LayoutDashboard,
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { businessTypeConfig, leadStageColors } from "@/components/dashboard/data"
import type { BusinessType, LeadStage } from "@/components/dashboard/data"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { getRelativeTime } from "@/lib/utils"
import { LeadActivityTimeline } from "./lead-activity-timeline"
import { LeadCommentsFeed } from "./lead-comments-feed"
import { LeadContactCounters } from "./lead-contact-counters"

const allStages: LeadStage[] = ["LEAD", "DEMO_SHARED", "NEGOTIATION", "PAYMENT_PENDING", "PAYMENT_RECEIVED", "ONBOARDING", "DEPLOYMENT", "ACTIVE"]
const stageProgressMap: Record<LeadStage, number> = {
  LEAD: 0, DEMO_SHARED: 1, NEGOTIATION: 2, PAYMENT_PENDING: 3, PAYMENT_RECEIVED: 4, ONBOARDING: 5, DEPLOYMENT: 6, ACTIVE: 7, LOST: -1, CHURNED: -1
}

// Real API lead data type
interface LeadApiData {
  id: string; businessName: string; contactName: string; contactEmail: string
  contactPhone: string; businessType: string; source: string; stage: string
  estimatedValue: number | null; notes: string | null; followUpDate: string | null
  lastContactedAt: string | null; tags: string; createdAt: string; updatedAt: string
  salesRep: { id: string; name: string; email: string } | null
  demoTenantId: string | null; demoSharedAt: string | null
  negotiatedMonthlyPrice: number | null; negotiatedYearlyPrice: number | null
  paymentVerifiedAt: string | null; convertedBusinessId: string | null; convertedAt: string | null
  lostReason: string | null; selectedBillingCycle: string | null
}

// API activity shape for the contact history tab
interface ApiActivity {
  id: string
  action: string
  details: {
    type?: string
    content?: string
  } | null
  user: {
    id: string
    name: string
  } | null
  createdAt: string
}

interface ActivityEntry {
  id: string
  type: string
  userName: string
  content: string
  timestamp: string
}

interface LeadDetailEnhancedProps {
  lead: LeadApiData
  onBack: () => void
}

export function LeadDetailEnhanced({ lead, onBack }: LeadDetailEnhancedProps) {
  const { crmLeadTab, setCrmLeadTab } = useAdminStore()
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)

  // Fetch activities for the contact history tab
  const fetchActivities = useCallback(async () => {
    if (!lead.id) return
    setActivitiesLoading(true)
    try {
      const res = await fetch(`/api/core/leads/${lead.id}/activities`, {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (json.success && json.data?.activities) {
        const mapped: ActivityEntry[] = (json.data.activities as ApiActivity[]).map((a) => ({
          id: a.id,
          type: a.details?.type || a.action.replace("lead.", ""),
          userName: a.user?.name || "Unknown",
          content: a.details?.content || "",
          timestamp: a.createdAt,
        }))
        setActivities(mapped)
      } else {
        setActivities([])
      }
    } catch (err) {
      console.error("Failed to fetch lead activities:", err)
      setActivities([])
    } finally {
      setActivitiesLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchActivities()
  }, [lead.id])

  // Compute days since last contact from real data
  const daysSinceContact = lead.lastContactedAt
    ? Math.floor((Date.now() - new Date(lead.lastContactedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null

  // Check for overdue follow-up
  const hasOverdue = daysSinceContact !== null && daysSinceContact > 3

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{lead.businessName}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className={`text-[10px] ${leadStageColors[lead.stage as LeadStage] || ""}`}>
              {lead.stage.replace(/_/g, " ")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {businessTypeConfig[lead.businessType as BusinessType]?.label || lead.businessType}
            </span>
          </div>
        </div>
      </div>

      {/* Overdue banner */}
      {hasOverdue && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-xs text-red-700">
            <span className="font-semibold">Follow-up overdue!</span> Last contact was {daysSinceContact} days ago.
          </p>
          <Button variant="outline" size="sm" className="h-6 text-[10px] ml-auto border-red-300 text-red-700 hover:bg-red-100">
            Contact Now
          </Button>
        </div>
      )}

      {/* Quick action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <PhoneCall className="h-3.5 w-3.5" /> Call
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-green-600 hover:text-green-700">
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <Calendar className="h-3.5 w-3.5" /> Schedule Follow-up
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <Share2 className="h-3.5 w-3.5" /> Share Demo
        </Button>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs value={crmLeadTab} onValueChange={setCrmLeadTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="text-xs gap-1">
            <LayoutDashboard className="h-3 w-3" /> Overview
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs gap-1">
            <Activity className="h-3 w-3" /> Activity
          </TabsTrigger>
          <TabsTrigger value="comments" className="text-xs gap-1">
            <MessageSquare className="h-3 w-3" /> Comments
          </TabsTrigger>
          <TabsTrigger value="contact" className="text-xs gap-1">
            <History className="h-3 w-3" /> Contact
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Contact Info */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Contact Information</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.contactName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.contactEmail}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.contactPhone}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Counters */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Contact Summary</h4>
              <LeadContactCounters leadId={lead.id} lastContactedAt={lead.lastContactedAt} />
            </CardContent>
          </Card>

          {/* Pipeline Progress */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Pipeline Progress</h4>
              <div className="space-y-2">
                {allStages.map((stage, idx) => {
                  const currentIdx = stageProgressMap[lead.stage as LeadStage] ?? -1
                  const isCompleted = idx <= currentIdx
                  const isCurrent = stage === lead.stage
                  return (
                    <div key={stage} className="flex items-center gap-3">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium shrink-0 ${
                          isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? "✓" : idx + 1}
                      </div>
                      <span
                        className={`text-xs ${
                          isCurrent
                            ? "font-semibold"
                            : isCompleted
                            ? "text-muted-foreground"
                            : "text-muted-foreground/60"
                        }`}
                      >
                        {stage.replace(/_/g, " ")}
                      </span>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-[9px]">
                          Current
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Business Details */}
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">Business Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-2.5">
                  <p className="text-[10px] text-muted-foreground">Type</p>
                  <p className="text-xs font-medium">{businessTypeConfig[lead.businessType as BusinessType]?.label || lead.businessType}</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <p className="text-[10px] text-muted-foreground">Source</p>
                  <p className="text-xs font-medium">{lead.source.replace(/_/g, " ")}</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <p className="text-[10px] text-muted-foreground">Est. Value</p>
                  <p className="text-xs font-medium">{lead.estimatedValue ? `₹${lead.estimatedValue.toLocaleString("en-IN")}` : "—"}</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <p className="text-[10px] text-muted-foreground">Sales Rep</p>
                  <p className="text-xs font-medium">{lead.salesRep?.name || "Unassigned"}</p>
                </div>
              </div>
              {/* Additional real data fields */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                {lead.followUpDate && (
                  <div className="rounded-lg border p-2.5">
                    <p className="text-[10px] text-muted-foreground">Follow-up Date</p>
                    <p className="text-xs font-medium">{new Date(lead.followUpDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                )}
                {lead.selectedBillingCycle && (
                  <div className="rounded-lg border p-2.5">
                    <p className="text-[10px] text-muted-foreground">Billing Cycle</p>
                    <p className="text-xs font-medium capitalize">{lead.selectedBillingCycle}</p>
                  </div>
                )}
                {lead.negotiatedMonthlyPrice && (
                  <div className="rounded-lg border p-2.5">
                    <p className="text-[10px] text-muted-foreground">Negotiated Monthly</p>
                    <p className="text-xs font-medium">₹{lead.negotiatedMonthlyPrice.toLocaleString("en-IN")}</p>
                  </div>
                )}
                {lead.negotiatedYearlyPrice && (
                  <div className="rounded-lg border p-2.5">
                    <p className="text-[10px] text-muted-foreground">Negotiated Yearly</p>
                    <p className="text-xs font-medium">₹{lead.negotiatedYearlyPrice.toLocaleString("en-IN")}</p>
                  </div>
                )}
              </div>
              {lead.notes && (
                <div className="mt-3 rounded-lg border p-2.5">
                  <p className="text-[10px] text-muted-foreground">Notes</p>
                  <p className="text-xs text-muted-foreground">{lead.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <LeadActivityTimeline leadId={lead.id} maxHeight="500px" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <LeadCommentsFeed leadId={lead.id} maxHeight="500px" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact History Tab */}
        <TabsContent value="contact" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">By</TableHead>
                      <TableHead className="text-xs">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activitiesLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            <span className="text-sm text-muted-foreground">Loading...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : activities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                          No contact history recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      activities
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .map((activity) => (
                          <TableRow key={activity.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {getRelativeTime(activity.timestamp)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {activity.type.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{activity.userName}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{activity.content}</TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
