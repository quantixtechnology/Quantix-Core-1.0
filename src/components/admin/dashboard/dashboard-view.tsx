"use client"

import { StatCard } from "../shared/stat-card"
import { PageHeader } from "../shared/page-header"
import { StatusBadge } from "../shared/status-badge"
import {
  Building2,
  TrendingUp,
  IndianRupee,
  Clock,
  Users,
  Globe,
  AlertTriangle,
  RefreshCw,
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid } from "recharts"
import { businesses, clientSubscriptions, leads, deployments, domains, revenueData, businessTypeData, leadSourceData } from "@/components/dashboard/data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAdminStore } from "@/stores/admin-store"

const revenueChartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
}

const leadChartConfig: ChartConfig = {
  converted: { label: "Converted", color: "hsl(var(--chart-1))" },
  lost: { label: "Lost", color: "hsl(var(--chart-5))" },
}

const subscriptionChartConfig: ChartConfig = {
  monthly: { label: "Monthly", color: "hsl(var(--chart-1))" },
  yearly: { label: "Yearly", color: "hsl(var(--chart-2))" },
}

const leadConversionData = [
  { month: "Aug", converted: 2, lost: 1 },
  { month: "Sep", converted: 3, lost: 0 },
  { month: "Oct", converted: 1, lost: 2 },
  { month: "Nov", converted: 4, lost: 1 },
  { month: "Dec", converted: 3, lost: 1 },
  { month: "Jan", converted: 5, lost: 1 },
]

const subscriptionBreakdown = [
  { name: "Monthly", value: clientSubscriptions.filter(s => s.billingCycle === "MONTHLY").length, color: "#10B981" },
  { name: "Yearly", value: clientSubscriptions.filter(s => s.billingCycle === "YEARLY").length, color: "#F59E0B" },
]

export function DashboardView() {
  const { setActivePage } = useAdminStore()

  const activeBusinesses = businesses.filter(b => b.status === "ACTIVE").length
  const totalBusinesses = businesses.length
  const onboardingCount = businesses.filter(b => b.status === "ONBOARDING").length
  const monthlyRevenue = businesses.reduce((sum, b) => sum + b.monthlyRevenue, 0)
  const activeSubscriptions = clientSubscriptions.filter(s => s.status === "ACTIVE").length
  const pendingRenewals = clientSubscriptions.filter(s => s.status === "PAST_DUE").length
  const activeLeads = leads.filter(l => !["ACTIVE", "LOST", "CHURNED"].includes(l.stage)).length
  const pendingDeployments = deployments.filter(d => d.status !== "LIVE").length
  const expiringSubs = clientSubscriptions.filter(s => s.status === "PAST_DUE" || s.status === "SUSPENDED").length
  const yearlyRevenue = clientSubscriptions.reduce((sum, s) => {
    const price = s.customPrice || s.planPrice
    return sum + (s.billingCycle === "YEARLY" ? price : price * 12)
  }, 0)

  const recentLeads = leads.filter(l => !["ACTIVE", "LOST"].includes(l.stage)).slice(0, 5)
  const recentDeployments = deployments.filter(d => d.status !== "LIVE").slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Quantix Core Platform overview"
        icon={LayoutDashboard}
        action={
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Businesses"
          value={totalBusinesses}
          change={`${activeBusinesses} active, ${onboardingCount} onboarding`}
          changeType="neutral"
          icon={Building2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Monthly Revenue"
          value={`₹${(monthlyRevenue / 100000).toFixed(1)}L`}
          change="+12.5% from last month"
          changeType="positive"
          icon={TrendingUp}
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
        />
        <StatCard
          title="Yearly Revenue"
          value={`₹${(yearlyRevenue / 100000).toFixed(1)}L`}
          change={`${activeSubscriptions} active subscriptions`}
          changeType="neutral"
          icon={IndianRupee}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          title="Pending Renewals"
          value={pendingRenewals}
          change={`${expiringSubs} expiring soon`}
          changeType="negative"
          icon={Clock}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Leads"
          value={activeLeads}
          change="In pipeline"
          changeType="neutral"
          icon={Users}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
        />
        <StatCard
          title="Pending Deployments"
          value={pendingDeployments}
          change="Awaiting deployment"
          changeType="neutral"
          icon={Globe}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        />
        <StatCard
          title="Active Domains"
          value={domains.filter(d => d.status === "ACTIVE").length}
          change={`${domains.filter(d => d.status !== "ACTIVE").length} pending`}
          changeType="neutral"
          icon={Globe}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
        />
        <StatCard
          title="Expiring Subs"
          value={expiringSubs}
          change="Requires attention"
          changeType="negative"
          icon={AlertTriangle}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend</CardTitle>
            <CardDescription>Monthly platform revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="h-[280px] w-full">
              <AreaChart data={revenueData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} />} />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" fill="url(#fillRevenue)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Lead Conversion Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead Conversion</CardTitle>
            <CardDescription>Monthly leads converted vs lost</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={leadChartConfig} className="h-[280px] w-full">
              <BarChart data={leadConversionData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="converted" fill="var(--color-converted)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lost" fill="var(--color-lost)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Subscription Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription Breakdown</CardTitle>
            <CardDescription>Monthly vs Yearly plans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <ChartContainer config={subscriptionChartConfig} className="h-[220px] w-[220px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie data={subscriptionBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} strokeWidth={2}>
                    {subscriptionBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="space-y-4">
                {subscriptionBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.value} businesses</p>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3">
                  <p className="text-sm font-medium">₹4,999/mo &amp; ₹49,999/yr</p>
                  <p className="text-xs text-muted-foreground">2 fixed plans only</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business Types</CardTitle>
            <CardDescription>Distribution across verticals</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={leadChartConfig} className="h-[220px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={businessTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} strokeWidth={2}>
                  {businessTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="mt-3 flex flex-wrap gap-3">
              {businessTypeData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.name} ({item.value}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Active Leads */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Active Leads</CardTitle>
              <CardDescription>Leads in pipeline</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setActivePage("leads")}>
              View All <ArrowUpRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{lead.businessName}</p>
                  <p className="text-xs text-muted-foreground">{lead.contactName} · {lead.type}</p>
                </div>
                <StatusBadge status={lead.stage} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pending Deployments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Pending Deployments</CardTitle>
              <CardDescription>Needs attention</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setActivePage("domains")}>
              View All <ArrowUpRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentDeployments.map((dep) => (
              <div key={dep.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{dep.businessName}</p>
                  <p className="text-xs text-muted-foreground">{dep.type} · {dep.hostingProvider}</p>
                </div>
                <StatusBadge status={dep.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
