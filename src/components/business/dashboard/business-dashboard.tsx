"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import { useBusinessContext } from "@/hooks/use-business-context"
import { useAuthStore } from "@/stores/auth-store"
import { showSuccess, showError, showOrderUpdate } from "@/lib/toast-utils"
import { ConnectionStatusBadge } from "@/components/ui/connection-status"
import { SkeletonCard, ErrorState } from "@/components/ui/loading-states"
import { StatusBadge } from "@/components/admin/shared/status-badge"
import { PageHeader } from "@/components/admin/shared/page-header"
import { StatCard } from "@/components/admin/shared/stat-card"
import { useQuery, useQueryClient } from "@tanstack/react-query"

// Business context constants

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
  const { businessId, businessName, isLoading: contextLoading } = useBusinessContext()
  const { setBusinessPage, currentStoreId, currentStoreName, currentBusinessType } = useAdminStore()
  const { currentRole } = useAuthStore()
  const isLaundry = currentBusinessType === "LAUNDRY"
  const isStoreManager = currentRole === "STORE_MANAGER"
  const [isRefreshing, setIsRefreshing] = useState(false)
  const queryClient = useQueryClient()

  // ---- Fetch real dashboard stats from API ----
  const { data: dashboardData, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ["business-dashboard", businessId],
    queryFn: async () => {
      if (!businessId) return null
      const response = await fetch(`/api/core/businesses/${encodeURIComponent(businessId)}/dashboard`)
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to fetch dashboard')
      return data.data
    },
    enabled: !!businessId,
    refetchInterval: 30000,
  })

  // ---- Fetch orders from API — STORE_MANAGER sees only their store ----
  const orderFilters = (
    isStoreManager && currentStoreId
      ? { businessId, storeId: currentStoreId, limit: 10 }
      : { businessId, limit: 10 }
  ) as Record<string, unknown>

  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useOrders(
    orderFilters,
    {
      refetchInterval: 30000,
      enabled: !!businessId,
    }
  )

  // ---- Fetch products from API ----
  const { data: productsData } = useQuery({
    queryKey: ["dashboard-products", businessId],
    queryFn: async () => {
      if (!businessId) return { data: [] }
      const response = await fetch(`/api/core/storefront/products?businessId=${encodeURIComponent(businessId)}&status=ALL&limit=10`)
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to fetch products')
      return data
    },
    enabled: !!businessId,
  })

  // ---- Fetch categories from API ----
  const { data: categoriesData } = useQuery({
    queryKey: ["dashboard-categories", businessId],
    queryFn: async () => {
      if (!businessId) return { data: [] }
      const response = await fetch(`/api/core/storefront/categories?businessId=${encodeURIComponent(businessId)}&includeInactive=true&productStatus=ALL`)
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to fetch categories')
      return data
    },
    enabled: !!businessId,
  })

  // ---- Fetch customers from API ----
  const { data: customersData } = useQuery({
    queryKey: ["dashboard-customers", businessId],
    queryFn: async () => {
      if (!businessId) return { data: [] }
      const response = await fetch(`/api/core/businesses/${encodeURIComponent(businessId)}/customers?limit=10`)
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to fetch customers')
      return data
    },
    enabled: !!businessId,
  })

  // Real-time order updates
  const { latestOrder, orderCount } = useOrderUpdates(businessId)

  // Show toast when new order arrives via WebSocket
  useEffect(() => {
    if (latestOrder && latestOrder.orderNumber) {
      showOrderUpdate(latestOrder.status || "placed", latestOrder.orderNumber)
    }
  }, [orderCount, latestOrder])

  // Extract stats from API response
  const todayRevenue = dashboardData?.revenue?.today || 0
  const todayOrders = dashboardData?.orders?.today || 0
  const pendingOrders = dashboardData?.orders?.pending || 0
  const totalCustomers = dashboardData?.customers?.total || 0
  const totalProducts = dashboardData?.products?.total || 0
  const totalOrders = dashboardData?.orders?.total || 0
  const totalRevenue = dashboardData?.revenue?.total || 0
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

  // Map orders from API
  const apiOrders: Record<string, unknown>[] = useMemo(() => {
    if (!ordersData?.data) return []
    const rawData = ordersData.data
    if (!Array.isArray(rawData)) return []
    return rawData as unknown as Record<string, unknown>[]
  }, [ordersData])

  // Map categories from API
  const categoriesList = useMemo(() => {
    if (!categoriesData?.data) return []
    if (!Array.isArray(categoriesData.data)) return []
    return categoriesData.data as Record<string, unknown>[]
  }, [categoriesData])

  // Map products from API
  const productsList = useMemo(() => {
    if (!productsData?.data) return []
    if (!Array.isArray(productsData.data)) return []
    return productsData.data as Record<string, unknown>[]
  }, [productsData])

  // Low stock products count (must come after productsList)
  const lowStockProducts = useMemo(() => {
    return productsList.filter((p: Record<string, unknown>) => {
      const stock = Number((p as Record<string, unknown>).availableStock || 0)
      return stock > 0 && stock <= 10
    }).length
  }, [productsList])

  const activeStores = dashboardData?.stores?.total || 0
  const totalDeliveryPartners = 0
  const deliveryPartnersOnline = 0

  // Map customers from API
  const customersList = useMemo(() => {
    if (!customersData?.data) return []
    if (!Array.isArray(customersData.data)) return []
    return customersData.data as Record<string, unknown>[]
  }, [customersData])

  // Daily sales chart data — generate from orders
  const dailySalesData = useMemo(() => {
    // Group orders by date
    const dateMap: Record<string, number> = {}
    const now = new Date()
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      dateMap[key] = 0
    }
    // Fill with order data
    apiOrders.forEach((order) => {
      const date = String(order.createdAt || '').split('T')[0]
      if (dateMap[date] !== undefined) {
        dateMap[date] += Number(order.totalAmount || 0)
      }
    })
    return Object.entries(dateMap).map(([date, revenue]) => ({
      date: new Date(date).toLocaleDateString('en-IN', { weekday: 'short' }),
      revenue,
    }))
  }, [apiOrders])

  // Hourly sales chart data — generate from today's orders
  const hourlySalesData = useMemo(() => {
    const hourMap: Record<number, number> = {}
    for (let h = 8; h <= 22; h++) {
      hourMap[h] = 0
    }
    const today = new Date().toDateString()
    apiOrders.forEach((order) => {
      const orderDate = new Date(String(order.createdAt || '')).toDateString()
      if (orderDate === today) {
        const hour = new Date(String(order.createdAt || '')).getHours()
        if (hourMap[hour] !== undefined) {
          hourMap[hour] += Number(order.totalAmount || 0)
        }
      }
    })
    return Object.entries(hourMap).map(([hour, revenue]) => ({
      hour: `${hour.padStart(2, '0')}:00`,
      revenue,
    }))
  }, [apiOrders])

  // Recent activity from orders
  const recentActivity = useMemo(() => {
    return apiOrders.slice(0, 8).map((order, idx) => ({
      id: String(order.id || idx),
      type: "order",
      message: `Order ${String(order.orderNumber || '')} — ₹${Number(order.totalAmount || 0).toLocaleString("en-IN")} by ${String(order.customerName || "Customer")}`,
      time: order.createdAt ? new Date(String(order.createdAt)).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Just now",
    }))
  }, [apiOrders])

  // Top products from product data — compute from real prices
  const topProducts = useMemo(() => {
    return productsList
      .filter((p: Record<string, unknown>) => String(p.status) === 'ACTIVE')
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.isFeatured || 0) - Number(a.isFeatured || 0))
      .slice(0, 5)
      .map((p, idx) => ({
        name: String(p.name || `Product ${idx + 1}`),
        revenue: Number((p as Record<string, unknown>).defaultPrice || 0),
        sold: Number((p as Record<string, unknown>).availableStock || 0),
      }))
  }, [productsList])

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
  if (statsError && !dashboardData) {
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
        description={
          isStoreManager && currentStoreName
            ? `${businessName} · ${currentStoreName}`
            : businessName
        }
        icon={LayoutDashboard}
        action={
          <div className="flex items-center gap-3">
            {isStoreManager && (
              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs font-medium">
                Store view
              </Badge>
            )}
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

      {/* Laundry-specific Phase 1 KPIs — subscription-based metrics only */}
      {isLaundry && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Subscriptions"
            value={String(dashboardData?.laundry?.activeSubscriptions || 0)}
            change="Subscribed customers"
            changeType="neutral"
            icon={Users}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
          />
          <StatCard
            title="KG Consumed This Month"
            value={String(dashboardData?.laundry?.kgConsumedThisMonth || 0)}
            change="Total weight processed"
            changeType="neutral"
            icon={Package}
            iconColor="text-sky-600"
            iconBg="bg-sky-50"
          />
          <StatCard
            title="Renewals Due"
            value={String(dashboardData?.laundry?.renewalsDue || 0)}
            change="Awaiting renewal"
            changeType="neutral"
            icon={RefreshCw}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
          <StatCard
            title="Extra KG Revenue"
            value={`₹${(dashboardData?.laundry?.extraKgRevenue || 0).toLocaleString("en-IN")}`}
            change="Overage charges"
            changeType="neutral"
            icon={TrendingUp}
            iconColor="text-violet-600"
            iconBg="bg-violet-50"
          />
        </div>
      )}

      {/* Laundry Monthly Revenue */}
      {isLaundry && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-1 lg:grid-cols-1">
          <StatCard
            title="Monthly Revenue"
            value={`₹${(dashboardData?.laundry?.monthlyRevenue || 0).toLocaleString("en-IN")}`}
            change="Subscription + one-time combined"
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
            <CardDescription>Today&apos;s revenue by hour</CardDescription>
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

      {/* Product Catalog Overview — Prominent */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Product Catalog
              </CardTitle>
              <CardDescription className="mt-1">{categoriesList.length} categories · {productsList.length} products · {productsList.filter((p: Record<string, unknown>) => String(p.status) === 'ACTIVE').length} active</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setBusinessPage("products")}>
              View All
              <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {categoriesList.map((cat) => {
              const catProducts = productsList.filter((p: Record<string, unknown>) => String(p.categoryId) === String(cat.id))
              const isEmoji = cat.icon && /\p{Emoji}/u.test(String(cat.icon)) && String(cat.icon).length <= 4
              const catColor = String(cat.color || cat.image || '#10B981')
              return (
                <div
                  key={String(cat.id)}
                  className="flex flex-col items-center gap-2 rounded-lg border p-3 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setBusinessPage("products")}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${catColor}18`, color: catColor }}>
                    {isEmoji ? <span className="text-lg">{String(cat.icon)}</span> : <Package className="h-5 w-5" />}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium truncate max-w-[100px]">{String(cat.name)}</p>
                    <p className="text-[10px] text-muted-foreground">{catProducts.length} products</p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">
                    {String(cat.workflow || cat.workflowType || "ECOMMERCE").replace(/_/g, " ")}
                  </Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recently Added Products */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Recently Added Products</CardTitle>
              <CardDescription className="text-xs">Latest products in your catalog</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setBusinessPage("products")}>
              See All Products
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {productsList.slice(-5).reverse().map((product) => {
              const defaultVariant = Array.isArray((product as Record<string, unknown>).variants) ? ((product as Record<string, unknown>).variants as Record<string, unknown>[]).find((v: Record<string, unknown>) => v.isDefault) || ((product as Record<string, unknown>).variants as Record<string, unknown>[])[0] : null
              const catInfo = categoriesList.find((c: Record<string, unknown>) => String(c.id) === String((product as Record<string, unknown>).categoryId))
              const isEmoji = catInfo?.icon && /\p{Emoji}/u.test(String(catInfo.icon)) && String(catInfo.icon).length <= 4
              const catColor = catInfo ? String(catInfo.color || catInfo.image || '#f3f4f6') : '#f3f4f6'
              return (
                <div key={String(product.id)} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setBusinessPage("products")}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${catColor}18`, color: catColor }}>
                      {isEmoji ? <span className="text-sm">{String(catInfo?.icon)}</span> : <Package className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{String((product as Record<string, unknown>).name)}</p>
                      <p className="text-[10px] text-muted-foreground">{String(((product as Record<string, unknown>).category as { name?: string } | null)?.name || (product as Record<string, unknown>).category || "")} · {defaultVariant ? String(defaultVariant.name) : ""}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold">₹{Number(defaultVariant?.price || 0).toLocaleString("en-IN")}</p>
                      {String((product as Record<string, unknown>).status) === "ACTIVE" ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1.5 py-0">Active</Badge>
                      ) : String((product as Record<string, unknown>).status) === "OUT_OF_STOCK" ? (
                        <Badge className="bg-red-50 text-red-700 border-red-200 text-[9px] px-1.5 py-0">Out of Stock</Badge>
                      ) : (
                        <Badge className="bg-slate-50 text-slate-700 border-slate-200 text-[9px] px-1.5 py-0">{String((product as Record<string, unknown>).status)}</Badge>
                      )}
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
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
                {apiOrders.length} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 px-6 pb-6">
            <ScrollArea className="max-h-96">
              <div className="space-y-3 pr-4">
                {apiOrders.map((order: Record<string, unknown>) => { const orderWorkflow = String(order.workflowType || 'ECOMMERCE'); const orderType = String(order.orderType || ''); return (
                  <div
                    key={String(order.id)}
                    className="flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{String(order.orderNumber || '')}</span>
                          <StatusBadge status={String(order.status || 'PENDING')} />
                          <Badge variant="outline" className={`text-[9px] ${getWorkflowBadgeClasses(orderWorkflow)} ${getWorkflowBadgeText(orderWorkflow)}`}>
                            {orderWorkflow.replace(/_/g, " ")}
                          </Badge>
                          {orderType && (
                            <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-600 bg-violet-50">
                              {orderType}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{String(order.customerName || '')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">₹{Number(order.totalAmount || 0).toLocaleString("en-IN")}</p>
                        <p className="text-xs text-muted-foreground">{Array.isArray(order.items) ? order.items.length : 0} items</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {order.createdAt ? new Date(order.createdAt as string | number | Date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                        <span className="text-muted-foreground/50">·</span>
                        <span>{String(order.paymentMethod || 'UPI')}</span>
                      </div>
                      {String(order.status) === "PENDING" && (
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
                      {String(order.status) === "CONFIRMED" && (
                        <div className="flex items-center gap-1 text-xs text-sky-600">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          Assigning...
                        </div>
                      )}
                    </div>
                  </div>
                )})}
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

      {/* Bottom Summary: Top Products + Category/Workflow + Partners */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {/* Top Products */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Products</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2.5">
              {topProducts.slice(0, 5).map((product, index) => (
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
                const workflowCounts = categoriesList.reduce((acc: Record<string, number>, cat) => {
                  const wf = String((cat as Record<string, unknown>).workflow || (cat as Record<string, unknown>).workflowType || 'ECOMMERCE')
                  acc[wf] = (acc[wf] || 0) + 1
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
                <span className="text-sm font-medium">{productsList.length}</span>
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
                <span className="text-sm font-semibold">{customersList.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
