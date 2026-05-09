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
  Clock,
  Package,
  CreditCard,
  ArrowUpRight,
  RefreshCw,
  Bell,
  Truck,
  Receipt,
  Calendar,
} from "lucide-react"
import {
  useBusinessStats,
  useOrders,
  queryKeys,
} from "@/hooks/use-api"
import { useOrderUpdates } from "@/hooks/use-realtime"
import { useAdminStore, WORKFLOW_CONFIGS } from "@/stores/admin-store"
import {
  getDemoBusinessName,
  getDemoDashboardStats,
  getDemoDailySales,
  getDemoHourlySales,
  getDemoRecentActivity,
  getDemoTopProducts,
  getDemoCategories,
  getDemoProducts,
  getDemoCustomers,
  getDemoBusinessOrders,
} from "@/lib/demo-data"
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

// Activity icon map — maps lowercase activity types from demo data
const activityIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  order: ShoppingBag,
  payment: CreditCard,
  delivery: Package,
  stock: Package,
  pickup: Truck,
  service: Clock,
  subscription: CreditCard,
  appointment: Calendar,
  billing: Receipt,
  customer: Users,
}

const activityColorMap: Record<string, string> = {
  order: "bg-emerald-100 text-emerald-600",
  payment: "bg-amber-100 text-amber-600",
  delivery: "bg-sky-100 text-sky-600",
  stock: "bg-red-100 text-red-600",
  pickup: "bg-sky-100 text-sky-600",
  service: "bg-violet-100 text-violet-600",
  subscription: "bg-amber-100 text-amber-600",
  appointment: "bg-violet-100 text-violet-600",
  billing: "bg-rose-100 text-rose-600",
  customer: "bg-emerald-100 text-emerald-600",
}

// Workflow badge color helper
function getWorkflowBadgeClasses(workflow: string) {
  const config = WORKFLOW_CONFIGS.find(c => c.type === workflow)
  if (config) return config.bgColor
  return "bg-slate-50 border-slate-200"
}

function getWorkflowBadgeText(workflow: string) {
  const config = WORKFLOW_CONFIGS.find(c => c.type === workflow)
  if (config) return config.color
  return "text-slate-600"
}

export function BusinessDashboard() {
  const { demoBusinessId, setBusinessPage } = useAdminStore()
  const businessName = getDemoBusinessName(demoBusinessId)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const queryClient = useQueryClient()

  // Demo data — context-aware
  const demoStats = getDemoDashboardStats(demoBusinessId)
  const demoDailySales = getDemoDailySales(demoBusinessId)
  const demoHourlySales = getDemoHourlySales(demoBusinessId)
  const demoActivity = getDemoRecentActivity(demoBusinessId)
  const demoTopProducts = getDemoTopProducts(demoBusinessId)
  const demoCategories = getDemoCategories(demoBusinessId)
  const demoProducts = getDemoProducts(demoBusinessId)
  const demoCustomers = getDemoCustomers(demoBusinessId)
  const demoOrders = getDemoBusinessOrders(demoBusinessId)

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

  // Extract stats from API response — fall back to demo data
  const stats = statsData?.data

  // Merge API data with demo data (prefer API when available)
  const todayRevenue = stats?.todayRevenue || demoStats.todayRevenue
  const todayOrders = stats?.todayOrders || demoStats.todayOrders
  const pendingOrders = stats?.pendingOrders || demoStats.pendingOrders
  const totalCustomers = stats?.totalCustomers || demoStats.totalCustomers
  const avgOrderValue = stats?.avgOrderValue || demoStats.avgOrderValue
  const totalProducts = stats?.totalProducts || demoStats.totalProducts
  const lowStockProducts = stats?.lowStockProducts || demoStats.lowStockProducts
  const activeStores = stats?.activeStores || demoStats.activeStores
  const totalDeliveryPartners = stats?.totalDeliveryPartners || demoStats.totalDeliveryPartners
  const deliveryPartnersOnline = stats?.deliveryPartnersOnline || demoStats.deliveryPartnersOnline

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
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Revenue"
          value={`₹${todayRevenue.toLocaleString("en-IN")}`}
          change={`${todayOrders} orders today`}
          changeType="neutral"
          icon={IndianRupee}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Today's Orders"
          value={String(todayOrders)}
          change={pendingOrders ? `${pendingOrders} pending` : "No pending orders"}
          changeType="neutral"
          icon={ShoppingBag}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Active Customers"
          value={String(totalCustomers)}
          change="Total registered"
          changeType="neutral"
          icon={Users}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Avg Order Value"
          value={`₹${avgOrderValue.toLocaleString("en-IN")}`}
          change="Per order average"
          changeType="neutral"
          icon={IndianRupee}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
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
              <BarChart data={demoDailySales} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
              <AreaChart data={demoHourlySales} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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

      {/* Product Catalog Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Product Catalog</CardTitle>
              <CardDescription>{demoCategories.length} categories · {demoProducts.length} products</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setBusinessPage("products")}>
              View All
              <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {demoCategories.map((cat) => {
              const catProducts = demoProducts.filter(p => p.categoryId === cat.id)
              const isEmoji = cat.icon && /\p{Emoji}/u.test(cat.icon) && cat.icon.length <= 4
              return (
                <div
                  key={cat.id}
                  className="flex flex-col items-center gap-2 rounded-lg border p-3 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setBusinessPage("products")}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${cat.color}18`, color: cat.color }}>
                    {isEmoji ? <span className="text-lg">{cat.icon}</span> : <Package className="h-5 w-5" />}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium truncate max-w-[100px]">{cat.name}</p>
                    <p className="text-[10px] text-muted-foreground">{catProducts.length} products</p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">
                    {cat.workflow.replace(/_/g, " ")}
                  </Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Live Orders + Recent Activity */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
        {/* Live Orders Section */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Live Orders</CardTitle>
                <CardDescription>Active orders across all workflows</CardDescription>
              </div>
              <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {demoOrders.length} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 px-6 pb-6">
            <ScrollArea className="max-h-96">
              <div className="space-y-3 pr-4">
                {demoOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{order.orderNumber}</span>
                          <StatusBadge status={order.status} />
                          <Badge variant="outline" className={`text-[9px] ${getWorkflowBadgeClasses(order.workflow)} ${getWorkflowBadgeText(order.workflow)}`}>
                            {order.workflow.replace(/_/g, " ")}
                          </Badge>
                          {order.type && (
                            <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-600 bg-violet-50">
                              {order.type}
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
                        {order.createdAt ? new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                        <span className="text-muted-foreground/50">·</span>
                        <span>{order.paymentMethod}</span>
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
              <button
                className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                onClick={() => setBusinessPage("orders")}
              >
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
                {demoActivity.map((activity, index) => {
                  const ActivityIcon = activityIconMap[activity.type] || Package
                  const colorClass = activityColorMap[activity.type] || "bg-slate-100 text-slate-600"

                  return (
                    <div key={activity.id} className="relative flex gap-3 pb-4">
                      {/* Timeline line */}
                      {index < demoActivity.length - 1 && (
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

      {/* Bottom Summary: Top Products + Category/Workflow + Partners */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {/* Top Products */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Products</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2.5">
              {demoTopProducts.slice(0, 5).map((product, index) => (
                <div key={index} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-semibold text-emerald-600">
                      {index + 1}
                    </span>
                    <span className="text-sm truncate">{product.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium">₹{product.revenue.toLocaleString("en-IN")}</p>
                    <p className="text-[10px] text-muted-foreground">{product.sold} sold</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category & Workflow Summary */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Workflows Active</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2.5">
              {(() => {
                const workflowCounts = demoCategories.reduce((acc, cat) => {
                  acc[cat.workflow] = (acc[cat.workflow] || 0) + 1
                  return acc
                }, {} as Record<string, number>)
                return Object.entries(workflowCounts).map(([workflow, count]) => (
                  <div key={workflow} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${getWorkflowBadgeClasses(workflow)} ${getWorkflowBadgeText(workflow)}`}>
                        {workflow.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{count}</span>
                      <span className="text-[10px] text-muted-foreground">categories</span>
                    </div>
                  </div>
                ))
              })()}
              <Separator className="my-1" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total Products</span>
                <span className="text-sm font-medium">{demoProducts.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Low Stock</span>
                <span className="text-sm font-medium">{lowStockProducts}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Subscribers / Delivery Partners */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Operations</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                    <Package className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <span className="text-sm">Total Products</span>
                </div>
                <span className="text-sm font-semibold">{totalProducts}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50">
                    <Truck className="h-3.5 w-3.5 text-sky-600" />
                  </div>
                  <span className="text-sm">Delivery Partners</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">{totalDeliveryPartners}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">({deliveryPartnersOnline} online)</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
                    <CreditCard className="h-3.5 w-3.5 text-violet-600" />
                  </div>
                  <span className="text-sm">Active Stores</span>
                </div>
                <span className="text-sm font-semibold">{activeStores}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                    <Users className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <span className="text-sm">Customers</span>
                </div>
                <span className="text-sm font-semibold">{demoCustomers.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
