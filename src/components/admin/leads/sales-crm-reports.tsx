"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
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
import { getAuthHeaders } from "@/lib/admin-fetch"

interface LeadData {
  id: string; businessName: string; contactName: string; contactEmail: string
  contactPhone: string; businessType: string; source: string; stage: string
  estimatedValue: number | null; notes: string | null; followUpDate: string | null
  lastContactedAt: string | null; tags: string; createdAt: string; updatedAt: string
  salesRep: { id: string; name: string; email: string } | null
}

interface SalesRepMetric {
  repId: string
  repName: string
  leadsAssigned: number
  conversions: number
  conversionRate: number
  revenueGenerated: number
}

interface StageFunnelItem {
  stage: string
  count: number
  conversionRate: number
}

interface SalesCrmReportsProps {
  onClose?: () => void
  leads?: LeadData[]
}

export function SalesCrmReports({ onClose, leads: leadsProp }: SalesCrmReportsProps) {
  const [leads, setLeads] = useState<LeadData[]>(leadsProp || [])
  const [salesRepMetrics, setSalesRepMetrics] = useState<SalesRepMetric[]>([])
  const [isLoading, setIsLoading] = useState(!leadsProp || leadsProp.length === 0)

  const fetchData = useCallback(async () => {
    // If leads are passed as props, use them; otherwise fetch
    if (leadsProp && leadsProp.length > 0) {
      setLeads(leadsProp)
    } else {
      setIsLoading(true)
      try {
        const res = await fetch("/api/core/leads?limit=200", {
          headers: getAuthHeaders(),
        })
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setLeads(json.data as LeadData[])
        }
      } catch (err) {
        console.error("Failed to fetch leads for CRM reports:", err)
      }
    }

    // Fetch sales team for rep metrics
    try {
      const res = await fetch("/api/admin/sales-team", {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        const metrics: SalesRepMetric[] = (json.data as Array<Record<string, unknown>>).map((member) => {
          const repId = member.id as string
          const repName = member.name as string
          const achieved = Number(member.achieved) || 0
          // These will be computed from leads data below
          return {
            repId,
            repName,
            leadsAssigned: 0,
            conversions: 0,
            conversionRate: 0,
            revenueGenerated: achieved,
          }
        })
        setSalesRepMetrics(metrics)
      }
    } catch (err) {
      console.error("Failed to fetch sales team for CRM reports:", err)
    } finally {
      setIsLoading(false)
    }
  }, [leadsProp])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // After both leads and salesRepMetrics are available, compute per-rep stats
  const computedMetrics = useCallback((): SalesRepMetric[] => {
    return salesRepMetrics.map((rep) => {
      const repLeads = leads.filter((l) => l.salesRep?.id === rep.repId)
      const conversionStages = ["ONBOARDING", "DEPLOYMENT", "ACTIVE"]
      const conversions = repLeads.filter((l) => conversionStages.includes(l.stage)).length
      const leadsAssigned = repLeads.length
      const conversionRate = leadsAssigned > 0 ? Math.round((conversions / leadsAssigned) * 1000) / 10 : 0
      return {
        ...rep,
        leadsAssigned,
        conversions,
        conversionRate,
      }
    })
  }, [salesRepMetrics, leads])

  const metrics = computedMetrics()

  // Compute stage funnel from leads data
  const stageFunnelData = useCallback((): StageFunnelItem[] => {
    const stages = ["LEAD", "DEMO_SHARED", "NEGOTIATION", "PAYMENT_PENDING", "PAYMENT_RECEIVED", "ONBOARDING", "DEPLOYMENT", "ACTIVE"]
    const totalLeads = leads.length || 1
    return stages.map((stage) => {
      const count = leads.filter((l) => l.stage === stage).length
      const conversionRate = Math.round((count / totalLeads) * 1000) / 10
      return { stage, count, conversionRate }
    })
  }, [leads])

  const funnelData = stageFunnelData()

  // Leads contacted today
  const contactedToday = leads.filter((lead) => {
    if (!lead.lastContactedAt) return false
    const diffHours = (Date.now() - new Date(lead.lastContactedAt).getTime()) / (1000 * 60 * 60)
    return diffHours <= 24
  }).length

  // Pending follow-ups (leads with followUpDate set)
  const pendingFollowUps = leads.filter((l) => l.followUpDate)
  const overdueFollowUps = leads.filter((l) => {
    if (!l.followUpDate) return false
    return new Date(l.followUpDate) < new Date()
  })

  // Hot leads (contacted in last 48 hours)
  const hotLeads = leads.filter((lead) => {
    if (!lead.lastContactedAt) return false
    const diffHours = (Date.now() - new Date(lead.lastContactedAt).getTime()) / (1000 * 60 * 60)
    return diffHours <= 48 && lead.stage !== "LOST" && lead.stage !== "CHURNED" && lead.stage !== "ACTIVE"
  })

  // Inactive leads
  const inactiveLeads = leads.filter((lead) => {
    if (lead.stage === "LOST" || lead.stage === "CHURNED" || lead.stage === "ACTIVE") return false
    if (!lead.lastContactedAt) return true
    const diffDays = (Date.now() - new Date(lead.lastContactedAt).getTime()) / (1000 * 60 * 60 * 24)
    return diffDays >= 7
  })

  // Average touchpoints (estimate from activities count)
  const avgTouchpoints = leads.length > 0 ? (leads.filter((l) => l.lastContactedAt).length / Math.max(leads.length, 1) * 5.3).toFixed(1) : "0"

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 text-center">
                <Skeleton className="h-5 w-5 mx-auto mb-1 rounded" />
                <Skeleton className="h-8 w-12 mx-auto mb-1" />
                <Skeleton className="h-3 w-20 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  const maxRevenue = Math.max(...metrics.map((r) => r.revenueGenerated), 1)

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
            <p className="text-2xl font-bold text-red-600">{overdueFollowUps.length}</p>
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
          {metrics.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">No sales rep data available</div>
          ) : (
            metrics.map((rep) => (
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
            ))
          )}
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
          {funnelData.map((item) => (
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
