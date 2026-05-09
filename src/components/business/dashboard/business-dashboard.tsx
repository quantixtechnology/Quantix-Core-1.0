"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
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
  useBusinessStats,
  useOrders,
  queryKeys,
} from "@/hooks/use-api"
import { useOrderUpdates } from "@/hooks/use-realtime"
import { useAdminStore } from "@/stores/admin-store"
import { getDemoBusinessName } from "@/lib/demo-data"
import { showSuccess, showError, showOrderUpdate } from "@/lib/toast-utils"
import { ConnectionStatusBadge } from "@/components/ui/connection-status"
import { SkeletonCard, ErrorState } from "@/components/ui/loading-states"
import { StatusBadge } from "@/components/admin/shared/status-badge"
import { PageHeader } from "@/components/admin/shared/page-header"
import { StatCard } from "@/components/admin/shared/stat-card"
import { useQueryClient } from "@tanstack/react-query"

// Business context constants
const BUSINESS_ID = "biz_1"

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

// Fallback chart data (used when API doesn't return chart data)
const fallbackDailySales = [
  { date: "Mon", revenue: 14200, orders: 32 },
  { date: "Tue", revenue: 18500, orders: 42 },
  { date: "Wed", revenue: 15800, orders: 38 },
  { date: "Thu", revenue: 21300, orders: 48 },
  { date: "Fri", revenue: 19800, orders: 45 },
  { date: "Sat", revenue: 24500, orders: 55 },
  { date: "Sun", revenue: 22300, orders: 50 },
]

const fallbackHourlySales = [
  { hour: "8AM", revenue: 1200 },
  { hour: "9AM", revenue: 2800 },
  { hour: "10AM", revenue: 3500 },
  { hour: "11AM", revenue: 4200 },
  { hour: "12PM", revenue: 5100 },
  { hour: "1PM", revenue: 4800 },
  { hour: "2PM", revenue: 3200 },
  { hour: "3PM", revenue: 2800 },
  { hour: "4PM", revenue: 2400 },
  { hour: "5PM", revenue: 3100 },
  { hour: "6PM", revenue: 4500 },
  { hour: "7PM", revenue: 5200 },
  { hour: "8PM", revenue: 3800 },
  { hour: "9PM", revenue: 2100 },
]

const fallbackRecentActivity = [
  { id: "1", type: "ORDER", message: "New order #ORD-1028 placed by Priya Sharma", time: "2 min ago" },
  { id: "2", type: "PAYMENT", message: "Payment of ₹1,240 received via UPI", time: "5 min ago" },
  { id: "3", type: "DELIVERY", message: "Order #ORD-1025 out for delivery via Rajesh K.", time: "12 min ago" },
  { id: "4", type: "POS", message: "POS bill FM-20260507-1234 settled — ₹890", time: "18 min ago" },
  { id: "5", type: "STOCK", message: "Low stock alert: Organic Milk (2 variants)", time: "25 min ago" },
]

export function BusinessDashboard() {
  const { demoBusinessId } = useAdminStore()
  const businessName = getDemoBusinessName(demoBusinessId)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const queryClient = useQueryClient()

  // Fetch business stats with auto-refresh every 30 seconds
  const { data: statsData, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useBusinessStats(BUSINESS_ID, {
    refetchInterval: 30000,
  })

  // Fetch orders for live orders section
  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useOrders(
    { businessId: BUSINESS_ID, status: "PENDING,CONFIRMED", limit: 10 } as Record<string, unknown>,
    {
      refetchInterval: 30000,
    }
  )

  // Real-time order updates
  const { latestOrder, orderCount } = useOrderUpdates(BUSINESS_ID)

  // Show toast when new order arrives via WebSocket
  useEffect(() => {
    if (latestOrder && latestOrder.orderNumber) {
      showOrderUpdate(latestOrder.status || "placed", latestOrder.orderNumber)
    }
  }, [orderCount, latestOrder])

  // Extract stats from API response
  const stats = statsData?.data

  // Extract orders from API response
  const liveOrders = (() => {
    if (ordersData?.data && Array.isArray(ordersData.data)) {
      return ordersData.data.filter(
        (order: Record<string, unknown>) =>
          (order as Record<string, unknown>).status === "PENDING" ||
          (order as Record<string, unknown>).status === "CONFIRMED"
      )
    }
    return []
  })()

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([refetchStats(), refetchOrders()])
      showSuccess("Dashboard refreshed")
    } catch {
      showError("Failed to refresh dashboard")
    } finally {
      setIsRefreshing(false)
    }
  }, [refetchStats, refetchOrders])

  // Handle error state
  if (statsError && !statsData) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description={businessName}
          icon={LayoutDashboard}
          action={
            <ConnectionStatusBadge size="sm" />
          }
        />
        <ErrorState
          title="Failed to load dashboard"
          description="Could not fetch business statistics. Please try again."
          onRetry={handleRefresh}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        description={businessName}
        icon={LayoutDashboard}
        action={
          <div className="flex items-center gap-3">
            <ConnectionStatusBadge size="sm" />
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
          </div>
        }
      />

      {/* Stat Cards Row */}
      {statsLoading ? (
        <SkeletonCard count={4} />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Today's Revenue"
            value={stats?.todayRevenue ? `₹${stats.todayRevenue.toLocaleString("en-IN")}` : "₹0"}
            change={stats?.todayOrders ? `${stats.todayOrders} orders today` : "No orders yet"}
            changeType="neutral"
            icon={IndianRupee}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
          />
          <StatCard
            title="Today's Orders"
            value={String(stats?.todayOrders || 0)}
            change={stats?.pendingOrders ? `${stats.pendingOrders} pending` : "No pending orders"}
            changeType="neutral"
            icon={ShoppingBag}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
          />
          <StatCard
            title="Active Customers"
            value={stats?.totalCustomers ? String(stats.totalCustomers) : "0"}
            change="Total registered"
            changeType="neutral"
            icon={Users}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
          />
          <StatCard
            title="Avg Order Value"
            value={stats?.avgOrderValue ? `₹${stats.avgOrderValue.toLocaleString("en-IN")}` : "₹0"}
            change="Per order average"
            changeType="neutral"
            icon={IndianRupee}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
          />
        </div>
      )}

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
              <BarChart data={fallbackDailySales} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
            <CardDescription>Today&apos;s revenue by hour</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={hourlySalesConfig} className="h-[280px] w-full">
              <AreaChart data={fallbackHourlySales} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
                {liveOrders.length + (orderCount > 0 ? 1 : 0)} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 px-6 pb-6">
            {ordersLoading ? (
              <div className="space-y-3 pr-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : liveOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ShoppingBag className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No active orders</p>
                <p className="text-xs mt-1">New orders will appear here in real-time</p>
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                <div className="space-y-3 pr-4">
                  {liveOrders.map((order: Record<string, unknown>) => (
                    <div
                      key={String(order.id)}
                      className="flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{String(order.orderNumber || order.id)}</span>
                            <StatusBadge status={String(order.status || "PENDING")} />
                            {order.orderType === "POS" && (
                              <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-600 bg-violet-50">
                                POS
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{String(order.customerName || "Unknown")}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm">₹{Number(order.totalAmount || 0).toLocaleString("en-IN")}</p>
                          <p className="text-xs text-muted-foreground">{String(order.itemCount || 0)} items</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {order.createdAt ? new Date(String(order.createdAt)).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Just now"}
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
                            {order.assignedTo ? `Assigned: ${String(order.assignedTo)}` : "Assigning..."}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
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
                {fallbackRecentActivity.map((activity, index) => {
                  const ActivityIcon = activityIconMap[activity.type] || Package
                  const colorClass = activityColorMap[activity.type] || "bg-slate-100 text-slate-600"

                  return (
                    <div key={activity.id} className="relative flex gap-3 pb-4">
                      {/* Timeline line */}
                      {index < fallbackRecentActivity.length - 1 && (
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
                <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                <p className="text-base font-bold">
                  {statsLoading ? "..." : String(stats?.totalProducts || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats?.lowStockProducts ? `${stats.lowStockProducts} low stock` : "Catalog items"}
                </p>
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
                  <span className="text-base font-bold">
                    {statsLoading ? "..." : String(stats?.totalDeliveryPartners || 0)}
                  </span>
                  <span className="text-sm text-muted-foreground">total</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats?.deliveryPartnersOnline ? `${stats.deliveryPartnersOnline} online now` : "Fleet management"}
                </p>
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
                <p className="text-sm font-medium text-muted-foreground">Active Stores</p>
                <p className="text-base font-bold">
                  {statsLoading ? "..." : String(stats?.activeStores || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Store locations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
