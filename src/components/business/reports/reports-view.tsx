"use client"

import { useState } from "react"
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
import {
  dailySalesData,
  hourlySalesData,
  topProducts,
  paymentSummary,
  storeTiming,
  deliveryPartners,
} from "@/components/business/data"
import { PageHeader } from "@/components/admin/shared/page-header"
import { StatCard } from "@/components/admin/shared/stat-card"

// ─── Chart Configs ──────────────────────────────────────────────────────────

const dailySalesChartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "#10B981" },
  orders: { label: "Orders", color: "#6366F1" },
}

const hourlyChartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "#8B5CF6" },
  orders: { label: "Orders", color: "#F59E0B" },
}

const orderTypeChartConfig: ChartConfig = {
  Delivery: { label: "Delivery", color: "#10B981" },
  POS: { label: "POS", color: "#3B82F6" },
  "Takeaway": { label: "Takeaway", color: "#F59E0B" },
}

const paymentChartConfig: ChartConfig = {
  UPI: { label: "UPI", color: "#10B981" },
  Cash: { label: "Cash", color: "#F59E0B" },
  Card: { label: "Card", color: "#6366F1" },
  COD: { label: "COD", color: "#EF4444" },
}

const PAYMENT_COLORS = ["#10B981", "#F59E0B", "#6366F1", "#EF4444"]
const ORDER_TYPE_COLORS = ["#10B981", "#3B82F6", "#F59E0B"]

// ─── Derived Data ───────────────────────────────────────────────────────────

const totalWeekRevenue = dailySalesData.reduce((s, d) => s + d.revenue, 0)
const totalWeekOrders = dailySalesData.reduce((s, d) => s + d.orders, 0)
const avgDailyRevenue = Math.round(totalWeekRevenue / 7)

const orderTypeData = [
  { name: "Delivery", value: 198, color: "#10B981" },
  { name: "POS", value: 87, color: "#3B82F6" },
  { name: "Takeaway", value: 34, color: "#F59E0B" },
]

const orderStatusData = [
  { status: "Pending", count: 12, percentage: "4.0%" },
  { status: "Confirmed", count: 18, percentage: "6.0%" },
  { status: "Preparing", count: 24, percentage: "8.0%" },
  { status: "Out for Delivery", count: 15, percentage: "5.0%" },
  { status: "Delivered", count: 210, percentage: "70.0%" },
  { status: "Cancelled", count: 21, percentage: "7.0%" },
]

const categoryRevenueData = [
  { category: "Fruits & Vegetables", revenue: 42500, percentage: "22%" },
  { category: "Dairy & Eggs", revenue: 31200, percentage: "16%" },
  { category: "Snacks & Chips", revenue: 28700, percentage: "15%" },
  { category: "Rice & Grains", revenue: 24100, percentage: "13%" },
  { category: "Beverages", revenue: 19800, percentage: "10%" },
  { category: "Spices & Masala", revenue: 16500, percentage: "9%" },
  { category: "Cleaning", revenue: 14200, percentage: "7%" },
  { category: "Others", revenue: 15100, percentage: "8%" },
]

const topProductsWithRating = topProducts.map((p, i) => ({
  ...p,
  rank: i + 1,
  avgRating: (3.8 + Math.random() * 1.2).toFixed(1),
}))

// ─── Component ──────────────────────────────────────────────────────────────

export function ReportsView() {
  const [dateRange, setDateRange] = useState("7d")

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
            <StatCard
              title="Today Revenue"
              value="₹26,800"
              change="+12.5% from yesterday"
              changeType="positive"
              icon={DollarSign}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
            />
            <StatCard
              title="This Week"
              value={`₹${totalWeekRevenue.toLocaleString()}`}
              change="+8.3% from last week"
              changeType="positive"
              icon={TrendingUp}
              iconColor="text-violet-600"
              iconBg="bg-violet-50"
            />
            <StatCard
              title="This Month"
              value="₹4,82,500"
              change="+15.2% from last month"
              changeType="positive"
              icon={BarChart3}
              iconColor="text-amber-600"
              iconBg="bg-amber-50"
            />
            <StatCard
              title="Avg Daily"
              value={`₹${avgDailyRevenue.toLocaleString()}`}
              change="-2.1% from last week"
              changeType="negative"
              icon={Clock}
              iconColor="text-rose-600"
              iconBg="bg-rose-50"
            />
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
              value="319"
              change="+14.2% from last week"
              changeType="positive"
              icon={ShoppingBag}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
            />
            <StatCard
              title="Delivery Orders"
              value="198"
              change="+10.5% from last week"
              changeType="positive"
              icon={Package}
              iconColor="text-violet-600"
              iconBg="bg-violet-50"
            />
            <StatCard
              title="POS Orders"
              value="87"
              change="+22.0% from last week"
              changeType="positive"
              icon={BarChart3}
              iconColor="text-amber-600"
              iconBg="bg-amber-50"
            />
            <StatCard
              title="Cancelled Rate"
              value="7.0%"
              change="+1.2% from last week"
              changeType="negative"
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
                                row.status === "Delivered"
                                  ? "default"
                                  : row.status === "Cancelled"
                                    ? "destructive"
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

          {/* UPI vs Cash vs Card Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">UPI vs Cash vs Card Comparison</CardTitle>
              <CardDescription>Side-by-side comparison of major payment methods</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                {/* UPI */}
                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-emerald-700">UPI</span>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-2xl font-bold text-emerald-900">₹89,400</p>
                    <p className="text-sm text-emerald-600">156 transactions</p>
                    <p className="text-sm text-emerald-600">Avg ₹573 / transaction</p>
                  </div>
                  <div className="h-2 rounded-full bg-emerald-200 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: "52%" }} />
                  </div>
                  <p className="text-xs text-emerald-600 font-medium">52% of total payments</p>
                </div>

                {/* Cash */}
                <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="font-semibold text-amber-700">Cash</span>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-2xl font-bold text-amber-900">₹38,200</p>
                    <p className="text-sm text-amber-600">68 transactions</p>
                    <p className="text-sm text-amber-600">Avg ₹562 / transaction</p>
                  </div>
                  <div className="h-2 rounded-full bg-amber-200 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: "23%" }} />
                  </div>
                  <p className="text-xs text-amber-600 font-medium">23% of total payments</p>
                </div>

                {/* Card */}
                <div className="rounded-xl border-2 border-violet-200 bg-violet-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-violet-500" />
                    <span className="font-semibold text-violet-700">Card</span>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-2xl font-bold text-violet-900">₹27,300</p>
                    <p className="text-sm text-violet-600">48 transactions</p>
                    <p className="text-sm text-violet-600">Avg ₹569 / transaction</p>
                  </div>
                  <div className="h-2 rounded-full bg-violet-200 overflow-hidden">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: "16%" }} />
                  </div>
                  <p className="text-xs text-violet-600 font-medium">16% of total payments</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
