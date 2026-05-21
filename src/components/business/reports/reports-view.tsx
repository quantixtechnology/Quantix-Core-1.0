"use client"

import { useState, useEffect, useMemo } from "react"
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Package,
  Calendar,
  Download,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useBusinessStats,
  useOrders,
} from "@/hooks/use-api"
import { setBusinessContext } from "@/lib/api-client"
import { SkeletonCard, ErrorState } from "@/components/ui/loading-states"
import { PageHeader } from "@/components/admin/shared/page-header"
import { StatCard } from "@/components/admin/shared/stat-card"
import { useAdminStore } from "@/stores/admin-store"
import { useBusinessContext } from "@/hooks/use-business-context"
import { useAuthStore } from "@/stores/auth-store"
import {
  getDemoDailySales,
  getDemoHourlySales,
  getDemoTopProducts,
  getDemoCategoryRevenueData,
  getDemoPaymentSummary,
  getDemoOrderTypeData,
  getDemoOrderStatusData,
} from "@/lib/demo-data"

const PAYMENT_COLORS = ["#10B981", "#F59E0B", "#6366F1", "#EF4444", "#8B5CF6"]

// ─── Chart Configs ──────────────────────────────────────────────────────────

const dailySalesChartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "#10B981" },
  orders: { label: "Orders", color: "#6366F1" },
}

const hourlyChartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "#8B5CF6" },
  orders: { label: "Orders", color: "#F59E0B" },
}

// Chart configs are built dynamically based on business context
function buildOrderTypeChartConfig(orderTypes: { name: string; color: string }[]): ChartConfig {
  const config: ChartConfig = {}
  for (const ot of orderTypes) {
    config[ot.name] = { label: ot.name, color: ot.color }
  }
  return config
}

function buildPaymentChartConfig(payments: { method: string }[]): ChartConfig {
  const config: ChartConfig = {}
  payments.forEach((p, i) => {
    config[p.method] = { label: p.method, color: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }
  })
  return config
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ReportsView() {
  const [dateRange, setDateRange] = useState("7d")
  const { currentBusinessType, currentStoreId } = useAdminStore()
  const { businessId } = useBusinessContext()
  const { user } = useAuthStore()
  // STORE_MANAGER: their assigned store takes precedence.
  // BUSINESS_OWNER: respects context bar store selection.
  const effectiveStoreId = user?.storeId || currentStoreId || undefined

  // Set business context on mount
  useEffect(() => {
    if (businessId) setBusinessContext(businessId)
  }, [businessId])

  // ---- API hooks — scoped to effectiveStoreId when set ----
  const { data: statsData, isLoading: statsLoading } = useBusinessStats(businessId || "")
  const { data: ordersData, isLoading: ordersLoading } = useOrders(
    (effectiveStoreId
      ? { businessId: businessId || "", storeId: effectiveStoreId, limit: 100 }
      : { businessId: businessId || "", limit: 100 }
    ) as Record<string, unknown>,
    { enabled: !!businessId }
  )

  // Extract stats
  const stats = statsData?.data

  // ---- Context-aware demo data ----
  const dailySalesData = useMemo(() => getDemoDailySales(currentBusinessType), [currentBusinessType])

  const hourlySalesData = useMemo(() => getDemoHourlySales(currentBusinessType), [currentBusinessType])

  const topProducts = useMemo(() => getDemoTopProducts(currentBusinessType), [currentBusinessType])

  const paymentSummary = useMemo(() => getDemoPaymentSummary(currentBusinessType), [currentBusinessType])

  const orderTypeData = useMemo(() => getDemoOrderTypeData(currentBusinessType), [currentBusinessType])

  const orderStatusData = useMemo(() => getDemoOrderStatusData(currentBusinessType), [currentBusinessType])

  const categoryRevenueData = useMemo(() => getDemoCategoryRevenueData(currentBusinessType), [currentBusinessType])

  // Dynamic chart configs based on business data
  const orderTypeChartConfig = useMemo(
    () => buildOrderTypeChartConfig(orderTypeData),
    [orderTypeData]
  )

  const paymentChartConfig = useMemo(
    () => buildPaymentChartConfig(paymentSummary),
    [paymentSummary]
  )

  // Keep derived data calculations
  const totalWeekRevenue = dailySalesData.reduce((s, d) => s + d.revenue, 0)
  const totalWeekOrders = dailySalesData.reduce((s, d) => s + d.orders, 0)
  const avgDailyRevenue = Math.round(totalWeekRevenue / 7)

  const topProductsWithRating = topProducts.map((p, i) => ({
    ...p,
    rank: i + 1,
    avgRating: (3.8 + Math.random() * 1.2).toFixed(1),
  }))

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Reports"
        description="Analyze your business performance"
        icon={BarChart3}
        action={
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[160px] h-9">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        {/* ── Sales Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="sales" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statsLoading ? (
              <SkeletonCard count={4} />
            ) : (
              <>
            <StatCard
              title="Today Revenue"
              value={stats?.todayRevenue ? `₹${stats.todayRevenue.toLocaleString("en-IN")}` : "₹0"}
              change={`${stats?.todayOrders || 0} orders today`}
              changeType="neutral"
              icon={DollarSign}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
            />
            <StatCard
              title="This Week"
              value={`₹${totalWeekRevenue.toLocaleString()}`}
              change={`${totalWeekOrders} total orders`}
              changeType="neutral"
              icon={TrendingUp}
              iconColor="text-violet-600"
              iconBg="bg-violet-50"
            />
            <StatCard
              title="This Month"
              value={stats?.totalRevenue ? `₹${stats.totalRevenue.toLocaleString("en-IN")}` : "₹0"}
              change="Total revenue"
              changeType="neutral"
              icon={BarChart3}
              iconColor="text-amber-600"
              iconBg="bg-amber-50"
            />
            <StatCard
              title="Avg Daily"
              value={`₹${avgDailyRevenue.toLocaleString()}`}
              change="7-day average"
              changeType="neutral"
              icon={Clock}
              iconColor="text-rose-600"
              iconBg="bg-rose-50"
            />
            </>
            )}
          </div>

          {/* Daily Sales Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Sales (Last 7 Days)</CardTitle>
              <CardDescription>Revenue and order trends over the past week</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={dailySalesChartConfig} className="h-[320px] w-full">
                <BarChart data={dailySalesData} barCategoryGap="20%">
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Hourly Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hourly Breakdown</CardTitle>
              <CardDescription>Sales distribution by hour of the day</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={hourlyChartConfig} className="h-[280px] w-full">
                <BarChart data={hourlySalesData} barCategoryGap="8%">
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Orders Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="orders" className="space-y-6">
          {/* Order Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Orders"
              value={stats?.totalOrders ? String(stats.totalOrders) : "0"}
              change="All time"
              changeType="neutral"
              icon={ShoppingBag}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
            />
            <StatCard
              title="Today's Orders"
              value={stats?.todayOrders ? String(stats.todayOrders) : "0"}
              change="Today"
              changeType="neutral"
              icon={Package}
              iconColor="text-violet-600"
              iconBg="bg-violet-50"
            />
            <StatCard
              title="Pending"
              value={stats?.pendingOrders ? String(stats.pendingOrders) : "0"}
              change="Awaiting action"
              changeType="neutral"
              icon={BarChart3}
              iconColor="text-amber-600"
              iconBg="bg-amber-50"
            />
            <StatCard
              title="Avg Order Value"
              value={stats?.avgOrderValue ? `₹${stats.avgOrderValue.toLocaleString("en-IN")}` : "₹0"}
              change="Per order"
              changeType="neutral"
              icon={Clock}
              iconColor="text-rose-600"
              iconBg="bg-rose-50"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Order Type Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Type Distribution</CardTitle>
                <CardDescription>Breakdown by delivery method</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={orderTypeChartConfig} className="mx-auto h-[280px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                    <Pie
                      data={orderTypeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={55}
                      paddingAngle={3}
                      strokeWidth={2}
                    >
                      {orderTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="flex justify-center gap-6 mt-2">
                  {orderTypeData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Order Status Breakdown Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Status Breakdown</CardTitle>
                <CardDescription>Current order status distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderStatusData.map((row) => (
                      <TableRow key={row.status}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                row.status === "Delivered" || row.status === "Delivered/Completed" || row.status === "Completed"
                                  ? "default"
                                  : row.status === "Cancelled"
                                    ? "destructive"
                                    : row.status === "Out for Delivery" || row.status === "Ready for Delivery"
                                      ? "outline"
                                      : "secondary"
                              }
                              className="text-xs"
                            >
                              {row.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{row.count}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.percentage}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Products Tab ────────────────────────────────────────────────── */}
        <TabsContent value="products" className="space-y-6">
          {/* Top Products Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Products</CardTitle>
              <CardDescription>Best performing products by units sold</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Rank</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-right">Units Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProductsWithRating.map((product) => (
                    <TableRow key={product.rank}>
                      <TableCell>
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            product.rank <= 3
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {product.rank}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-right">{product.sold}</TableCell>
                      <TableCell className="text-right">₹{product.revenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          <span className="text-amber-500">★</span>
                          {product.avgRating}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Category-wise Revenue */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Category-wise Revenue</CardTitle>
              <CardDescription>Revenue breakdown by product category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoryRevenueData.map((cat) => (
                  <div key={cat.category} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{cat.category}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">₹{cat.revenue.toLocaleString()}</span>
                        <Badge variant="secondary" className="text-xs">
                          {cat.percentage}
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: cat.percentage.replace("%", "") + "%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payments Tab ────────────────────────────────────────────────── */}
        <TabsContent value="payments" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Payment Method Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Method Distribution</CardTitle>
                <CardDescription>Transaction breakdown by payment method</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={paymentChartConfig} className="mx-auto h-[280px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="method" />} />
                    <Pie
                      data={paymentSummary}
                      dataKey="amount"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={55}
                      paddingAngle={3}
                      strokeWidth={2}
                    >
                      {paymentSummary.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-2">
                  {paymentSummary.map((item, index) => (
                    <div key={item.method} className="flex items-center gap-2 text-sm">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: PAYMENT_COLORS[index] }}
                      />
                      <span className="text-muted-foreground">{item.method}</span>
                      <span className="font-semibold">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Payment Summary Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Summary</CardTitle>
                <CardDescription>Detailed breakdown of payment transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentSummary.map((row) => (
                      <TableRow key={row.method}>
                        <TableCell className="font-medium">{row.method}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell className="text-right">₹{row.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{row.percentage}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {paymentSummary.reduce((s, r) => s + r.count, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{paymentSummary.reduce((s, r) => s + r.amount, 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Top Payment Methods Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Payment Methods Comparison</CardTitle>
              <CardDescription>Side-by-side comparison of payment methods</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {paymentSummary.slice(0, 3).map((item, index) => {
                  const colorClasses = [
                    { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "bg-emerald-500", title: "text-emerald-700", amount: "text-emerald-900", sub: "text-emerald-600", barBg: "bg-emerald-200", barFill: "bg-emerald-500", label: "text-emerald-600" },
                    { border: "border-amber-200", bg: "bg-amber-50/50", dot: "bg-amber-500", title: "text-amber-700", amount: "text-amber-900", sub: "text-amber-600", barBg: "bg-amber-200", barFill: "bg-amber-500", label: "text-amber-600" },
                    { border: "border-violet-200", bg: "bg-violet-50/50", dot: "bg-violet-500", title: "text-violet-700", amount: "text-violet-900", sub: "text-violet-600", barBg: "bg-violet-200", barFill: "bg-violet-500", label: "text-violet-600" },
                  ]
                  const c = colorClasses[index] || colorClasses[0]
                  const avgPerTxn = item.count > 0 ? Math.round(item.amount / item.count) : 0
                  return (
                    <div key={item.method} className={`rounded-xl border-2 ${c.border} ${c.bg} p-4 space-y-3`}>
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${c.dot}`} />
                        <span className={`font-semibold ${c.title}`}>{item.method}</span>
                      </div>
                      <div className="space-y-1.5">
                        <p className={`text-2xl font-bold ${c.amount}`}>₹{item.amount.toLocaleString()}</p>
                        <p className={`text-sm ${c.sub}`}>{item.count} transactions</p>
                        <p className={`text-sm ${c.sub}`}>Avg ₹{avgPerTxn.toLocaleString()} / transaction</p>
                      </div>
                      <div className={`h-2 rounded-full ${c.barBg} overflow-hidden`}>
                        <div className={`h-full rounded-full ${c.barFill}`} style={{ width: `${item.percentage}%` }} />
                      </div>
                      <p className={`text-xs ${c.label} font-medium`}>{item.percentage}% of total payments</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
