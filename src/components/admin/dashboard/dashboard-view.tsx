"use client"

import { useState, useEffect, useCallback } from "react"
import { StatCard } from "../shared/stat-card"
import { PageHeader } from "../shared/page-header"
import { StatusBadge } from "../shared/status-badge"
import {
  Building2, TrendingUp, IndianRupee, Clock,
  Users, Globe, AlertTriangle, RefreshCw, LayoutDashboard, ArrowUpRight,
} from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { businessTypeConfig } from "@/components/dashboard/data"
import type { BusinessType } from "@/components/dashboard/data"
import { Button } from "@/components/ui/button"
import { useAdminStore } from "@/stores/admin-store"
import { Skeleton } from "@/components/ui/skeleton"
import { authFetch } from "@/lib/admin-fetch"

const BLUE   = "#2563EB"
const CYAN   = "#22C7F0"
const ORANGE = "#FF8A1F"
const GREEN  = "#10B981"
const AMBER  = "#F59E0B"

const revenueChartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: BLUE },
}
const leadChartConfig: ChartConfig = {
  converted: { label: "Converted", color: BLUE },
  lost:      { label: "Lost",      color: ORANGE },
}
const subscriptionChartConfig: ChartConfig = {
  monthly: { label: "Monthly", color: BLUE },
  yearly:  { label: "Yearly",  color: CYAN },
}

interface PlatformStats {
  businesses: { total: number; active: number; suspended: number; onboarding: number; churned: number }
  orders: { total: number; recent: number }
  revenue: { total: number; monthlyMRR: number; yearlyProjected: number }
  leads: { total: number; active: number; byStage: Record<string, number> }
  subscriptions: { total: number; active: number; pastDue: number; suspended: number; expiringSoon: number }
  domains: { total: number; active: number; pending: number }
  deployments: { total: number; live: number; pending: number }
  customers: { total: number }
  recentActivity: Array<{
    id: string; action: string; entity: string; entityId: string | null
    details: string | null; businessName: string | null; userName: string | null; createdAt: string
  }>
}

interface BusinessData {
  id: string; name: string; slug: string; businessType: string; status: string
  city: string | null; isOnline: boolean; totalRevenue: number
  orderCount: number; customerCount: number; storeCount: number
  subscription: {
    status: string; planPrice: number; customPrice: number | null
    billingCycle: string; plan: { name: string; tier: string; billingCycle: string; price: number } | null
  } | null
  domain: { domain: string; status: string } | null
  deployments: Array<{ id: string; type: string; status: string; version: string | null; healthStatus: string }>
  createdAt: string
}

interface LeadData {
  id: string; businessName: string; contactName: string; contactEmail: string
  contactPhone: string; businessType: string; source: string; stage: string
  estimatedValue: number | null; salesRep: { id: string; name: string; email: string } | null
  followUpDate: string | null; createdAt: string
}

function SectionCard({ title, description, action, children }: {
  title: string; description?: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export function DashboardView() {
  const { setActivePage } = useAdminStore()
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [businesses, setBusinesses] = useState<BusinessData[]>([])
  const [leads, setLeads] = useState<LeadData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, bizRes, leadsRes] = await Promise.all([
        authFetch("/api/admin/stats"),
        authFetch("/api/admin/businesses?limit=50"),
        authFetch("/api/admin/leads?limit=50"),
      ])
      if (!statsRes.ok || !bizRes.ok || !leadsRes.ok) throw new Error("Failed to fetch dashboard data")
      const [statsJson, bizJson, leadsJson] = await Promise.all([statsRes.json(), bizRes.json(), leadsRes.json()])
      if (statsJson.success) setStats(statsJson.data)
      if (bizJson.success) setBusinesses(bizJson.data)
      if (leadsJson.success) setLeads(leadsJson.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [])

  const activeBusinesses   = stats?.businesses.active ?? 0
  const totalBusinesses    = stats?.businesses.total ?? 0
  const onboardingCount    = stats?.businesses.onboarding ?? 0
  const monthlyMRR         = stats?.revenue.monthlyMRR ?? 0
  const yearlyRevenue      = stats?.revenue.yearlyProjected ?? 0
  const activeLeadsCount   = stats?.leads.active ?? 0
  const pendingDeployments = stats?.deployments.pending ?? 0
  const activeDomains      = stats?.domains.active ?? 0
  const pendingDomains     = stats?.domains.pending ?? 0
  const expiringSubs       = stats?.subscriptions.expiringSoon ?? 0
  const pastDueSubs        = stats?.subscriptions.pastDue ?? 0
  const totalOrders        = stats?.orders.total ?? 0
  const totalRevenue       = stats?.revenue.total ?? 0

  const monthlySubs = businesses.filter(b =>
    b.subscription?.billingCycle === "MONTHLY" || b.subscription?.billingCycle === "monthly"
  ).length
  const yearlySubs = businesses.filter(b =>
    b.subscription?.billingCycle === "YEARLY" || b.subscription?.billingCycle === "yearly"
  ).length
  const subscriptionBreakdown = [
    { name: "Monthly", value: monthlySubs, color: BLUE },
    { name: "Yearly",  value: yearlySubs,  color: CYAN },
  ]

  const businessTypeMap = new Map<string, number>()
  for (const biz of businesses) {
    businessTypeMap.set(biz.businessType, (businessTypeMap.get(biz.businessType) || 0) + 1)
  }
  const businessTypeData = Array.from(businessTypeMap.entries()).map(([type, count]) => {
    const conf = businessTypeConfig[type as BusinessType]
    return { name: conf?.label || type, value: count, color: conf?.color || "#94A3B8" }
  })

  const leadConversionData = [
    { month: "Aug", converted: 2, lost: 1 },
    { month: "Sep", converted: 3, lost: 0 },
    { month: "Oct", converted: 1, lost: 2 },
    { month: "Nov", converted: 4, lost: 1 },
    { month: "Dec", converted: 3, lost: 1 },
    { month: "Jan", converted: 5, lost: 1 },
  ]

  const revenueData = [
    { month: "Aug", revenue: Math.round(monthlyMRR * 0.70) },
    { month: "Sep", revenue: Math.round(monthlyMRR * 0.78) },
    { month: "Oct", revenue: Math.round(monthlyMRR * 0.85) },
    { month: "Nov", revenue: Math.round(monthlyMRR * 0.92) },
    { month: "Dec", revenue: Math.round(monthlyMRR * 0.97) },
    { month: "Jan", revenue: monthlyMRR },
  ]

  const recentLeads = leads
    .filter(l => !["ACTIVE", "LOST", "CHURNED"].includes(l.stage))
    .slice(0, 5)

  const pendingDeploymentsList = businesses
    .filter(b => b.deployments.some(d => d.status !== "LIVE"))
    .slice(0, 5)
    .map(b => ({
      id: b.id,
      businessName: b.name,
      type: b.businessType,
      status: b.deployments.find(d => d.status !== "LIVE")?.status || "PENDING",
    }))

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Quantix Core Platform overview" icon={LayoutDashboard} />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6">
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Quantix Core Platform overview" icon={LayoutDashboard} />
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Quantix Core Platform overview"
        icon={LayoutDashboard}
        action={
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            onClick={fetchData}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {/* KPI Row 1 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Businesses"
          value={totalBusinesses}
          change={`${activeBusinesses} active, ${onboardingCount} onboarding`}
          changeType="neutral"
          icon={Building2}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Monthly MRR"
          value={`₹${(monthlyMRR / 1000).toFixed(1)}K`}
          change={`${stats?.subscriptions.active ?? 0} active subscriptions`}
          changeType="positive"
          icon={TrendingUp}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Yearly Revenue"
          value={`₹${(yearlyRevenue / 100000).toFixed(1)}L`}
          change={`₹${(totalRevenue / 100000).toFixed(1)}L total order revenue`}
          changeType="neutral"
          icon={IndianRupee}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          title="Past Due"
          value={pastDueSubs}
          change={`${expiringSubs} need attention`}
          changeType={pastDueSubs > 0 ? "negative" : "neutral"}
          icon={Clock}
          iconColor="text-red-500"
          iconBg="bg-red-50"
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Leads"
          value={activeLeadsCount}
          change={`${stats?.leads.total ?? 0} total leads`}
          changeType="neutral"
          icon={Users}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
        />
        <StatCard
          title="Pending Deployments"
          value={pendingDeployments}
          change={`${stats?.deployments.live ?? 0} live`}
          changeType="neutral"
          icon={Globe}
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
        />
        <StatCard
          title="Active Domains"
          value={activeDomains}
          change={`${pendingDomains} pending`}
          changeType="neutral"
          icon={Globe}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
        />
        <StatCard
          title="Total Orders"
          value={totalOrders}
          change={`${stats?.customers.total ?? 0} customers`}
          changeType="neutral"
          icon={AlertTriangle}
          iconColor="text-orange-500"
          iconBg="bg-orange-50"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Revenue Trend */}
        <SectionCard title="Revenue Trend" description="Platform MRR trend over 6 months">
          <ChartContainer config={revenueChartConfig} className="h-[260px] w-full">
            <AreaChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={BLUE} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} />}
              />
              <Area type="monotone" dataKey="revenue" stroke={BLUE} strokeWidth={2.5} fill="url(#fillRevenue)" dot={{ fill: BLUE, r: 4, strokeWidth: 0 }} activeDot={{ r: 5, fill: BLUE }} />
            </AreaChart>
          </ChartContainer>
        </SectionCard>

        {/* Lead Conversion */}
        <SectionCard title="Lead Conversion" description="Monthly leads converted vs lost">
          <ChartContainer config={leadChartConfig} className="h-[260px] w-full">
            <BarChart data={leadConversionData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="converted" fill={BLUE}   radius={[6, 6, 0, 0]} maxBarSize={32} />
              <Bar dataKey="lost"      fill={ORANGE} radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ChartContainer>
          {/* Legend */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ background: BLUE }} />
              <span className="text-xs text-gray-600 font-medium">Converted</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ background: ORANGE }} />
              <span className="text-xs text-gray-600 font-medium">Lost</span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Subscription Breakdown */}
        <SectionCard title="Subscription Breakdown" description="Monthly vs Yearly plan distribution">
          <div className="flex items-center gap-8">
            <ChartContainer config={subscriptionChartConfig} className="h-[200px] w-[200px] shrink-0">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={subscriptionBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} strokeWidth={0}>
                  {subscriptionBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="space-y-4 flex-1">
              {subscriptionBreakdown.map((item) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{item.value}</span>
                  </div>
                  <p className="text-xs text-gray-400 pl-4.5">businesses</p>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3 mt-2">
                <p className="text-xs font-semibold text-gray-700">STANDARD &amp; PRO Plans</p>
                <p className="text-xs text-gray-400 mt-0.5">2 fixed plans available</p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Business Type Distribution */}
        <SectionCard title="Business Types" description="Distribution across verticals">
          <ChartContainer config={leadChartConfig} className="h-[200px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie data={businessTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} strokeWidth={0}>
                {businessTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3">
            {businessTypeData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-xs text-gray-500">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Active Leads */}
        <SectionCard
          title="Active Leads"
          description="Leads currently in pipeline"
          action={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 -mr-2"
              onClick={() => setActivePage("leads")}
            >
              View All <ArrowUpRight className="h-3 w-3" />
            </Button>
          }
        >
          <div className="space-y-0">
            {recentLeads.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No active leads in pipeline</p>
            ) : (
              recentLeads.map((lead) => {
                const typeConf = businessTypeConfig[lead.businessType as BusinessType]
                return (
                  <div key={lead.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{lead.businessName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {lead.contactName} · {typeConf?.label || lead.businessType}
                      </p>
                    </div>
                    <StatusBadge status={lead.stage} />
                  </div>
                )
              })
            )}
          </div>
        </SectionCard>

        {/* Pending Deployments */}
        <SectionCard
          title="Pending Deployments"
          description="Deployments needing attention"
          action={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 -mr-2"
              onClick={() => setActivePage("domains")}
            >
              View All <ArrowUpRight className="h-3 w-3" />
            </Button>
          }
        >
          <div className="space-y-0">
            {pendingDeploymentsList.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">All deployments are live</p>
            ) : (
              pendingDeploymentsList.map((dep) => {
                const typeConf = businessTypeConfig[dep.type as BusinessType]
                return (
                  <div key={dep.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{dep.businessName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{typeConf?.label || dep.type}</p>
                    </div>
                    <StatusBadge status={dep.status} />
                  </div>
                )
              })
            )}
          </div>
        </SectionCard>
      </div>

      {/* Recent Activity Log */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <SectionCard title="Recent Activity" description="Latest platform events">
          <div className="space-y-0 -mx-2">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center gap-4 px-2 py-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <ActivityIcon action={activity.action} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{formatActivityAction(activity.action)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {activity.businessName && <span>{activity.businessName} · </span>}
                    {activity.userName && <span>by {activity.userName} · </span>}
                    {new Date(activity.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

function ActivityIcon({ action }: { action: string }) {
  if (action.includes("created"))       return <Building2    className="h-4 w-4 text-blue-600" />
  if (action.includes("status_changed"))return <RefreshCw    className="h-4 w-4 text-amber-500" />
  if (action.includes("override"))      return <IndianRupee  className="h-4 w-4 text-orange-500" />
  return <LayoutDashboard className="h-4 w-4 text-gray-400" />
}

function formatActivityAction(action: string): string {
  const map: Record<string, string> = {
    "business.created":                     "Business Created",
    "business.status_changed":              "Status Changed",
    "subscription.pricing_override":        "Pricing Override Applied",
    "subscription.pricing_override_removed":"Pricing Override Removed",
    "business.onboarding_step_updated":     "Onboarding Step Updated",
    "business.toggle_online":               "Online Status Changed",
  }
  return map[action] || action.replace(/_/g, " ").replace(/\./g, " → ")
}
