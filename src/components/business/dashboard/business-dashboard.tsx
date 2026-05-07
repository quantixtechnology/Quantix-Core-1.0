"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import {
  LayoutDashboard,
  IndianRupee,
  ShoppingBag,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  Package,
  CreditCard,
  ArrowUpRight,
  RefreshCw,
  Bell,
} from "lucide-react"
import {
  businessOrders,
  dailySalesData,
  hourlySalesData,
  topProducts,
  recentActivity,
  deliveryPartners,
} from "@/components/business/data"
import { StatusBadge } from "@/components/admin/shared/status-badge"
import { PageHeader } from "@/components/admin/shared/page-header"
import { StatCard } from "@/components/admin/shared/stat-card"

// Chart configs
const dailySalesConfig: ChartConfig = {
  revenue: {
    label: "Revenue",
    color: "#10B981",
  },
}

const hourlySalesConfig: ChartConfig = {
  revenue: {
    label: "Revenue",
    color: "#10B981",
  },
}

// Activity icon map
const activityIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ORDER: ShoppingBag,
  DELIVERY: Package,
  PAYMENT: CreditCard,
  STOCK: Package,
  POS: CreditCard,
}

const activityColorMap: Record<string, string> = {
  ORDER: "bg-emerald-100 text-emerald-600",
  DELIVERY: "bg-sky-100 text-sky-600",
  PAYMENT: "bg-amber-100 text-amber-600",
  STOCK: "bg-red-100 text-red-600",
  POS: "bg-violet-100 text-violet-600",
}

export function BusinessDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 1500)
  }

  // Filter live orders (PENDING and CONFIRMED)
  const liveOrders = businessOrders.filter(
    (order) => order.status === "PENDING" || order.status === "CONFIRMED"
  )

  // Delivery partner stats
  const onlinePartners = deliveryPartners.filter((p) => p.status === "ONLINE").length
  const offlinePartners = deliveryPartners.filter((p) => p.status === "OFFLINE").length

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        description="FreshMart Grocers"
        icon={LayoutDashboard}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* Stat Cards Row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Revenue"
          value="₹18,500"
          change="+12.5% from yesterday"
          changeType="positive"
          icon={IndianRupee}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Today's Orders"
          value="42"
          change="3 pending"
          changeType="neutral"
          icon={ShoppingBag}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Active Customers"
          value="856"
          change="+24 this week"
          changeType="positive"
          icon={Users}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Avg Order Value"
          value="₹440"
          change="-2.3% from yesterday"
          changeType="negative"
          icon={IndianRupee}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Daily Sales Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Sales</CardTitle>
            <CardDescription>Revenue over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dailySalesConfig} className="h-[280px] w-full">
              <BarChart data={dailySalesData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                  className="text-xs"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
                    />
                  }
                />
                <Bar
                  dataKey="revenue"
                  fill="var(--color-revenue)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Hourly Sales Area Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hourly Sales</CardTitle>
            <CardDescription>Today's revenue by hour</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={hourlySalesConfig} className="h-[280px] w-full">
              <AreaChart data={hourlySalesData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                  className="text-xs"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  fill="url(#fillRevenue)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Live Orders + Recent Activity */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
        {/* Live Orders Section */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Live Orders</CardTitle>
                <CardDescription>Pending & confirmed orders requiring attention</CardDescription>
              </div>
              <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {liveOrders.length} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 px-6 pb-6">
            <ScrollArea className="max-h-96">
              <div className="space-y-3 pr-4">
                {liveOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{order.orderNumber}</span>
                          <StatusBadge status={order.status} />
                          {order.type === "POS" && (
                            <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-600 bg-violet-50">
                              POS
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{order.customerName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">₹{order.total.toLocaleString("en-IN")}</p>
                        <p className="text-xs text-muted-foreground">{order.items.length} items</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {order.createdAt.split(" ")[1]}
                      </div>
                      {order.status === "PENDING" && (
                        <div className="flex items-center gap-2">
                          <button
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {order.status === "CONFIRMED" && (
                        <div className="flex items-center gap-1 text-xs text-sky-600">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          {order.assignedTo ? `Assigned: ${order.assignedTo}` : "Assigning..."}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Separator className="my-4" />
            <div className="flex justify-center">
              <button className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                View All Orders
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription>Latest events from your store</CardDescription>
              </div>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-0 px-6 pb-6">
            <ScrollArea className="max-h-96">
              <div className="space-y-1 pr-4">
                {recentActivity.map((activity, index) => {
                  const ActivityIcon = activityIconMap[activity.type] || Package
                  const colorClass = activityColorMap[activity.type] || "bg-slate-100 text-slate-600"

                  return (
                    <div key={activity.id} className="relative flex gap-3 pb-4">
                      {/* Timeline line */}
                      {index < recentActivity.length - 1 && (
                        <div className="absolute left-[15px] top-9 h-full w-px bg-border" />
                      )}
                      {/* Icon */}
                      <div className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ${colorClass} z-10`}>
                        <ActivityIcon className="h-3.5 w-3.5" />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-sm leading-snug">{activity.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Footer Row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {/* Top Product */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Top Product</p>
                <p className="text-base font-bold truncate">{topProducts[0].name}</p>
                <p className="text-xs text-muted-foreground">{topProducts[0].sold} sold</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Partners */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50">
                <Package className="h-6 w-6 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Delivery Partners</p>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold">{onlinePartners} Online</span>
                  <span className="text-sm text-muted-foreground">{offlinePartners} Offline</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {deliveryPartners.map((partner) => (
                    <span
                      key={partner.id}
                      className={`h-2 w-2 rounded-full ${
                        partner.status === "ONLINE" ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                      title={`${partner.name} - ${partner.status}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* POS Session */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50">
                <CreditCard className="h-6 w-6 text-violet-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">POS Session</p>
                <p className="text-base font-bold">
                  Active since 8:00 AM
                </p>
                <p className="text-xs text-muted-foreground">₹12,450 collected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
