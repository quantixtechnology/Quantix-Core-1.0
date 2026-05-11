"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Phone,
  CalendarCheck,
  TrendingUp,
  Flame,
  Snowflake,
  Target,
  BarChart3,
  Users,
} from "lucide-react"
import { leadStageColors } from "@/components/dashboard/data"
import type { LeadStage } from "@/components/dashboard/data"
import { salesRepMetrics, stageFunnelData, leadContactStats, followUpReminders } from "./crm-data"

interface LeadData {
  id: string; businessName: string; contactName: string; contactEmail: string
  contactPhone: string; businessType: string; source: string; stage: string
  estimatedValue: number | null; notes: string | null; followUpDate: string | null
  lastContactedAt: string | null; tags: string; createdAt: string; updatedAt: string
  salesRep: { id: string; name: string; email: string } | null
}

interface SalesCrmReportsProps {
  onClose?: () => void
  leads?: LeadData[]
}

export function SalesCrmReports({ onClose, leads: leadsProp }: SalesCrmReportsProps) {
  // Use passed leads data if available, otherwise fall back to CRM mock data lookups
  const leads = leadsProp || []

  // Leads contacted today (lastContactedAt within 24h from real data)
  const contactedToday = leads.filter((lead) => {
    if (!lead.lastContactedAt) return false
    const diffHours = (Date.now() - new Date(lead.lastContactedAt).getTime()) / (1000 * 60 * 60)
    return diffHours <= 24
  }).length

  // Pending follow-ups count (leads with followUpDate in the future or from CRM data)
  const pendingFollowUps = followUpReminders.filter(
    (r) => r.type === "PENDING" || r.type === "OVERDUE"
  )
  const overdueCount = followUpReminders.filter((r) => r.type === "OVERDUE").length

  // Hot leads (contacted in last 48 hours)
  const hotLeads = leads.filter((lead) => {
    if (!lead.lastContactedAt) return false
    const diffHours = (Date.now() - new Date(lead.lastContactedAt).getTime()) / (1000 * 60 * 60)
    return diffHours <= 48 && lead.stage !== "LOST" && lead.stage !== "CHURNED" && lead.stage !== "ACTIVE"
  })

  // Inactive leads (not contacted in 7+ days or never contacted)
  const inactiveLeads = leads.filter((lead) => {
    if (lead.stage === "LOST" || lead.stage === "CHURNED" || lead.stage === "ACTIVE") return false
    if (!lead.lastContactedAt) return true // Never contacted
    const diffDays = (Date.now() - new Date(lead.lastContactedAt).getTime()) / (1000 * 60 * 60 * 24)
    return diffDays >= 7
  })

  // Average touchpoints before conversion (mock)
  const avgTouchpoints = 5.3

  // Max revenue for bar chart scaling
  const maxRevenue = Math.max(...salesRepMetrics.map((r) => r.revenueGenerated))

  return (
    <div className="space-y-4">
      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Phone className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold">{contactedToday}</p>
            <p className="text-xs text-muted-foreground">Contacted Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CalendarCheck className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold">{pendingFollowUps.length}</p>
            <p className="text-xs text-muted-foreground">Pending Follow-ups</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-violet-600" />
            </div>
            <p className="text-2xl font-bold">{avgTouchpoints}</p>
            <p className="text-xs text-muted-foreground">Avg. Touchpoints</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Target className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Ratio Per Sales Rep */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Sales Rep Conversion Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {salesRepMetrics.map((rep) => (
            <div key={rep.repId} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{rep.repName}</span>
                <span className="text-sm font-semibold">{rep.conversionRate}%</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                  style={{ width: `${rep.conversionRate}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{rep.conversions} conversions</span>
                <span>₹{(rep.revenueGenerated / 1000).toFixed(0)}K revenue</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Stage-wise Conversion Funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Stage Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stageFunnelData.map((item) => (
            <div key={item.stage} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${leadStageColors[item.stage as LeadStage] || ""}`}
                  >
                    {item.stage.replace(/_/g, " ")}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {item.count} leads ({item.conversionRate}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-slate-400 to-slate-600 transition-all"
                  style={{ width: `${Math.max(item.conversionRate, 2)}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Hot Leads */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" /> Hot Leads
              <Badge variant="secondary" className="text-[10px] ml-1">{hotLeads.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-48">
              <div className="space-y-0">
                {hotLeads.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No hot leads</div>
                ) : (
                  hotLeads.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between px-4 py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{lead.businessName}</p>
                        <p className="text-[11px] text-muted-foreground">{lead.contactName}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${leadStageColors[lead.stage as LeadStage] || ""}`}
                      >
                        {lead.stage.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Inactive Leads */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-blue-500" /> Inactive Leads
              <Badge variant="secondary" className="text-[10px] ml-1">{inactiveLeads.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-48">
              <div className="space-y-0">
                {inactiveLeads.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No inactive leads</div>
                ) : (
                  inactiveLeads.map((lead) => {
                    const daysSince = lead.lastContactedAt
                      ? Math.floor((Date.now() - new Date(lead.lastContactedAt).getTime()) / (1000 * 60 * 60 * 24))
                      : null
                    return (
                      <div key={lead.id} className="flex items-center justify-between px-4 py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{lead.businessName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {daysSince !== null ? `${daysSince} days ago` : "Never contacted"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] text-red-600 border-red-200">
                          Inactive
                        </Badge>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
