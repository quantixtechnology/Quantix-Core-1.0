"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { buildLabelMap, getLabel } from "@/lib/order-stages"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ShoppingBag,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  X,
  Phone,
  MapPin,
  Truck,
  User,
  ArrowRight,
  Eye,
  RefreshCw,
  Workflow,
  Plus,
} from "lucide-react"
import {
  useOrders,
  useUpdateOrderStatus,
} from "@/hooks/use-api"
import { useOrderUpdates } from "@/hooks/use-realtime"
import { setBusinessContext } from "@/lib/api-client"
import { showSuccess, showError, showOrderUpdate } from "@/lib/toast-utils"
import { SkeletonTable, ErrorState } from "@/components/ui/loading-states"
import { StatusBadge } from "@/components/admin/shared/status-badge"
import { PageHeader } from "@/components/admin/shared/page-header"
import { StatCard } from "@/components/admin/shared/stat-card"
import { useAdminStore, WORKFLOW_CONFIGS } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useBusinessContext } from "@/hooks/use-business-context"
import { CreateOrderDialog } from "./create-order-dialog"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"

type OrderType = "DELIVERY" | "POS" | "PICKUP" | "PICKUP_AND_DELIVERY" | "APPOINTMENT" | "SUBSCRIPTION"

interface OrderItem {
  name: string
  qty: number
  price: number
  variant?: string
}

interface Order {
  id: string
  orderNumber: string
  type: OrderType
  status: OrderStatus | "PROCESSING" | "PACKED" | "SCHEDULED" | "ACTIVE" | "COMPLETED"
  customerName: string
  customerPhone: string
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  tax: number
  total: number
  paymentMethod: string
  paymentStatus: string
  createdAt: string
  deliveryAddress: string | null
  assignedTo: string | null
  workflow?: string
}

// ---------------------------------------------------------------------------
// Status colour helpers
// ---------------------------------------------------------------------------

const statusColorMap: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  CONFIRMED: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  PREPARING: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  READY_FOR_PICKUP: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  DELIVERED: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  CANCELLED: "bg-red-100 text-red-700 hover:bg-red-100",
}

const statusDotColor: Record<OrderStatus, string> = {
  PENDING: "bg-amber-500",
  CONFIRMED: "bg-blue-500",
  PREPARING: "bg-yellow-500",
  READY_FOR_PICKUP: "bg-orange-500",
  OUT_FOR_DELIVERY: "bg-purple-500",
  DELIVERED: "bg-emerald-500",
  CANCELLED: "bg-red-500",
}

function OrderStatusBadge({ status, labelMap }: { status: OrderStatus; labelMap: Record<string, string> }) {
  return (
    <Badge
      variant="secondary"
      className={`font-medium text-xs border-0 ${statusColorMap[status] || "bg-slate-100 text-slate-700"}`}
    >
      {getLabel(status, labelMap)}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Timeline helpers
// ---------------------------------------------------------------------------

const allStatusSteps: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
]

function getTimelineSteps(status: OrderStatus): { step: OrderStatus; completed: boolean; current: boolean }[] {
  if (status === "CANCELLED") {
    return [{ step: "CANCELLED", completed: true, current: true }]
  }
  const idx = allStatusSteps.indexOf(status)
  return allStatusSteps.map((s, i) => ({
    step: s,
    completed: i < idx,
    current: i === idx,
  }))
}

// ---------------------------------------------------------------------------
// Map API order data to local Order interface
// ---------------------------------------------------------------------------
function mapApiOrder(apiOrder: Record<string, unknown>): Order {
  return {
    id: String(apiOrder.id || ""),
    orderNumber: String(apiOrder.orderNumber || apiOrder.id || ""),
    type: (String(apiOrder.orderType || "DELIVERY") as OrderType),
    status: String(apiOrder.status || "PENDING") as OrderStatus,
    customerName: String(apiOrder.customerName || "Unknown"),
    customerPhone: String(apiOrder.customerPhone || ""),
    items: Array.isArray(apiOrder.items)
      ? apiOrder.items.map((item: Record<string, unknown>) => ({
          name: String(item.itemName || item.name || "Item"),
          qty: Number(item.quantity || 1),
          price: Number(item.unitPrice || item.price || 0),
        }))
      : [],
    subtotal: Number(apiOrder.subtotal || 0),
    deliveryFee: Number(apiOrder.deliveryFee || 0),
    tax: Number(apiOrder.tax || apiOrder.gstAmount || 0),
    total: Number(apiOrder.totalAmount || apiOrder.total || 0),
    paymentMethod: String(apiOrder.paymentMethod || "UPI"),
    paymentStatus: String(apiOrder.paymentStatus || "PENDING"),
    createdAt: apiOrder.createdAt ? String(apiOrder.createdAt) : new Date().toISOString(),
    deliveryAddress: apiOrder.deliveryAddress ? String(apiOrder.deliveryAddress) : null,
    assignedTo: apiOrder.assignedTo ? String(apiOrder.assignedTo) : null,
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function OrdersView() {
  // Get real business ID from context
  const { businessId } = useBusinessContext()
  const { user, token } = useAuthStore()
  const { currentStoreId, setOrderStages } = useAdminStore()
  const [labelMap, setLabelMap] = useState<Record<string, string>>({})
  const labelFetchedFor = useRef<string | null>(null)
  // STORE_MANAGER: their assigned store always takes precedence.
  // BUSINESS_OWNER: respects context bar store selection.
  const effectiveStoreId = user?.storeId || currentStoreId || undefined

  // Set business context for API client
  useEffect(() => {
    if (businessId) {
      setBusinessContext(businessId)
    }
  }, [businessId])

  // Fetch order stage labels for this business
  useEffect(() => {
    if (!businessId || !token || labelFetchedFor.current === businessId) return
    labelFetchedFor.current = businessId
    fetch(`/api/core/businesses/${businessId}/order-stages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.stages) {
          setOrderStages(json.data.stages)
          setLabelMap(buildLabelMap(json.data.stages))
        }
      })
      .catch(() => {})
  }, [businessId, token, setOrderStages])

  // ---- API hooks — scoped to effectiveStoreId when set ----
  const orderFilter = (
    effectiveStoreId
      ? { businessId, storeId: effectiveStoreId, limit: 100 }
      : { businessId, limit: 100 }
  ) as Record<string, unknown>

  const { data: ordersData, isLoading: ordersLoading, error: ordersError, refetch: refetchOrders } = useOrders(
    orderFilter,
    {
      refetchInterval: 30000,
      enabled: !!businessId,
    }
  )

  const updateStatusMutation = useUpdateOrderStatus()

  // Real-time order updates — scoped to effectiveStoreId
  const { latestOrder, orderCount } = useOrderUpdates(businessId, effectiveStoreId)

  // Show toast on real-time order updates
  useEffect(() => {
    if (latestOrder && latestOrder.orderNumber) {
      showOrderUpdate(latestOrder.status || "placed", latestOrder.orderNumber)
      refetchOrders()
    }
  }, [orderCount, latestOrder, refetchOrders])

  // Map API data to local Order type
  const allOrders: Order[] = useMemo(() => {
    if (!ordersData?.data) return []
    const rawData = ordersData.data
    if (!Array.isArray(rawData)) return []
    return (rawData as unknown as Record<string, unknown>[]).map((o) => mapApiOrder(o))
  }, [ordersData])

  // ---- State ----
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [paymentFilter, setPaymentFilter] = useState("ALL")
  const [dateFilter, setDateFilter] = useState("ALL")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Status update dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{
    order: Order
    newStatus: OrderStatus
  } | null>(null)
  const [statusNotes, setStatusNotes] = useState("")

  // Create order dialog
  const [createOrderOpen, setCreateOrderOpen] = useState(false)

  // ---- Computed ----
  const pendingCount = allOrders.filter((o) => o.status === "PENDING").length
  const preparingCount = allOrders.filter(
    (o) => o.status === "CONFIRMED" || o.status === "PREPARING" || o.status === "PROCESSING"
  ).length
  const outForDeliveryCount = allOrders.filter(
    (o) => o.status === "OUT_FOR_DELIVERY"
  ).length
  const deliveredTodayCount = allOrders.filter(
    (o) => o.status === "DELIVERED" || o.status === "COMPLETED"
  ).length

  const filteredOrders = useMemo(() => {
    let result = [...allOrders]

    // Tab filter
    if (activeTab !== "all") {
      const tabMap: Record<string, OrderStatus[]> = {
        pending: ["PENDING"],
        active: ["CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"],
        completed: ["DELIVERED"],
        cancelled: ["CANCELLED"],
      }
      const allowed = tabMap[activeTab]
      if (allowed) {
        result = result.filter((o) => allowed.includes(o.status as OrderStatus))
      }
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.items.some((i) => i.name.toLowerCase().includes(q))
      )
    }

    // Type filter
    if (typeFilter !== "ALL") {
      result = result.filter((o) => o.type === typeFilter)
    }

    // Payment filter
    if (paymentFilter !== "ALL") {
      result = result.filter((o) => o.paymentMethod === paymentFilter)
    }

    // Date filter
    if (dateFilter !== "ALL") {
      const now = new Date()
      result = result.filter((o) => {
        const orderDate = new Date(o.createdAt)
        if (dateFilter === "TODAY") {
          return orderDate.toDateString() === now.toDateString()
        }
        if (dateFilter === "YESTERDAY") {
          const yesterday = new Date(now)
          yesterday.setDate(yesterday.getDate() - 1)
          return orderDate.toDateString() === yesterday.toDateString()
        }
        return true
      })
    }

    return result
  }, [allOrders, activeTab, searchQuery, typeFilter, paymentFilter, dateFilter])

  // ---- Handlers ----
  function openDetail(order: Order) {
    setSelectedOrder(order)
    setSheetOpen(true)
  }

  function requestStatusUpdate(order: Order, newStatus: OrderStatus) {
    setPendingStatusUpdate({ order, newStatus })
    setStatusNotes("")
    setStatusDialogOpen(true)
  }

  const confirmStatusUpdate = useCallback(async () => {
    if (!pendingStatusUpdate) return

    try {
      await updateStatusMutation.mutateAsync({
        orderId: pendingStatusUpdate.order.id,
        status: pendingStatusUpdate.newStatus,
        note: statusNotes || undefined,
      })
      showSuccess(
        `Order ${pendingStatusUpdate.order.orderNumber} updated to ${getLabel(pendingStatusUpdate.newStatus, labelMap)}`
      )
      setStatusDialogOpen(false)
      setPendingStatusUpdate(null)
      setStatusNotes("")
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to update order status"
      showError(msg || "Failed to update order status")
    }
  }, [pendingStatusUpdate, statusNotes, updateStatusMutation])

  function getActionButtons(order: Order) {
    const isLoading = updateStatusMutation.isPending
    switch (order.status) {
      case "PENDING":
        return (
          <>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isLoading}
              onClick={() => requestStatusUpdate(order, "CONFIRMED")}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isLoading}
              onClick={() => requestStatusUpdate(order, "CANCELLED")}
            >
              Reject
            </Button>
          </>
        )
      case "CONFIRMED":
        return (
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isLoading}
            onClick={() => requestStatusUpdate(order, "PREPARING")}
          >
            Move to {getLabel("PREPARING", labelMap)}
          </Button>
        )
      case "PREPARING":
        return (
          <Button
            size="sm"
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
            disabled={isLoading}
            onClick={() => requestStatusUpdate(order, "READY_FOR_PICKUP")}
          >
            Move to {getLabel("READY_FOR_PICKUP", labelMap)}
          </Button>
        )
      case "READY_FOR_PICKUP":
        return (
          <Button
            size="sm"
            className="bg-orange-600 hover:bg-orange-700 text-white"
            disabled={isLoading}
            onClick={() => requestStatusUpdate(order, "OUT_FOR_DELIVERY")}
          >
            Move to {getLabel("OUT_FOR_DELIVERY", labelMap)}
          </Button>
        )
      case "OUT_FOR_DELIVERY":
        return (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={isLoading}
            onClick={() => requestStatusUpdate(order, "DELIVERED")}
          >
            Mark as {getLabel("DELIVERED", labelMap)}
          </Button>
        )
      default:
        return null
    }
  }

  function resetFilters() {
    setSearchQuery("")
    setTypeFilter("ALL")
    setPaymentFilter("ALL")
    setDateFilter("ALL")
  }

  // ---- Error state ----
  if (ordersError && !ordersData) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Orders"
          description="Manage and track all customer orders"
          icon={ShoppingBag}
        />
        <ErrorState
          title="Failed to load orders"
          description="Could not fetch orders. Please try again."
          onRetry={() => refetchOrders()}
        />
      </div>
    )
  }

  // ---- Render ----
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Orders"
        description="Manage and track all customer orders"
        icon={ShoppingBag}
        action={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm px-3 py-1 bg-primary/10 text-primary hover:bg-primary/10">
              {allOrders.length} orders
            </Badge>
            <Button
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setCreateOrderOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New Order
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Pending Orders"
          value={ordersLoading ? "..." : pendingCount}
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          title="Preparing"
          value={ordersLoading ? "..." : preparingCount}
          icon={RefreshCw}
          iconColor="text-yellow-600"
          iconBg="bg-yellow-50"
        />
        <StatCard
          title="Out for Delivery"
          value={ordersLoading ? "..." : outForDeliveryCount}
          icon={Truck}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
        <StatCard
          title="Delivered Today"
          value={ordersLoading ? "..." : deliveredTodayCount}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
      </div>

      {/* Tabs + Filters + Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </div>

        {/* Filter Bar */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders, customers, items..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Order Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="DELIVERY">Delivery</SelectItem>
              <SelectItem value="PICKUP">Pickup</SelectItem>
              <SelectItem value="POS">POS</SelectItem>
              <SelectItem value="PICKUP_AND_DELIVERY">Pickup & Delivery</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Payments</SelectItem>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="CARD">Card</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Dates</SelectItem>
              <SelectItem value="TODAY">Today</SelectItem>
              <SelectItem value="YESTERDAY">Yesterday</SelectItem>
            </SelectContent>
          </Select>
          {(searchQuery || typeFilter !== "ALL" || paymentFilter !== "ALL" || dateFilter !== "ALL") && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        {/* Table – shared across all tabs */}
        {["all", "pending", "active", "completed", "cancelled"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                {ordersLoading ? (
                  <div className="p-6">
                    <SkeletonTable rows={5} columns={7} showSearch={false} showPagination={false} />
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                      <ShoppingBag className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">No orders found</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try adjusting your filters or search query
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[160px]">Order #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead className="w-[80px]">Type</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-[80px]">Payment</TableHead>
                          <TableHead className="w-[140px]">Status</TableHead>
                          <TableHead className="w-[90px]">Time</TableHead>
                          <TableHead className="w-[60px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => (
                          <TableRow
                            key={order.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => openDetail(order)}
                          >
                            <TableCell className="font-mono font-medium text-sm">
                              {order.orderNumber}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                                <span className="text-sm">{order.customerName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] w-fit ${
                                    order.type === "DELIVERY"
                                      ? "border-purple-200 text-purple-700 bg-purple-50"
                                      : order.type === "POS"
                                      ? "border-teal-200 text-teal-700 bg-teal-50"
                                      : order.type === "PICKUP"
                                      ? "border-sky-200 text-sky-700 bg-sky-50"
                                      : order.type === "APPOINTMENT"
                                      ? "border-violet-200 text-violet-700 bg-violet-50"
                                      : order.type === "SUBSCRIPTION"
                                      ? "border-amber-200 text-amber-700 bg-amber-50"
                                      : "border-slate-200 text-slate-700 bg-slate-50"
                                  }`}
                                >
                                  {order.type}
                                </Badge>
                                {order.workflow && (
                                  <Badge variant="outline" className={`text-[9px] w-fit ${(() => {
                                    const cfg = WORKFLOW_CONFIGS.find(c => c.type === order.workflow)
                                    return cfg ? `${cfg.bgColor} ${cfg.color}` : ""
                                  })()}`}>
                                    {order.workflow.replace(/_/g, " ")}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {order.items.length} item{order.items.length > 1 ? "s" : ""}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-sm">
                              ₹{order.total.toLocaleString("en-IN")}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-medium">{order.paymentMethod}</span>
                            </TableCell>
                            <TableCell>
                              <OrderStatusBadge status={order.status as OrderStatus} labelMap={labelMap} />
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {order.createdAt ? new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openDetail(order)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* ===== Order Detail Sheet ===== */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedOrder && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center justify-between pr-6">
                  <SheetTitle className="text-lg font-bold">
                    {selectedOrder.orderNumber}
                  </SheetTitle>
                  <OrderStatusBadge status={selectedOrder.status as OrderStatus} labelMap={labelMap} />
                </div>
                <SheetDescription>
                  Order placed on {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString("en-IN") : "N/A"}
                </SheetDescription>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-140px)] pr-1">
                <div className="space-y-6 pb-6">
                  {/* Customer Info */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Customer
                    </h4>
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{selectedOrder.customerName}</p>
                            {selectedOrder.customerPhone && (
                              <a
                                href={`tel:${selectedOrder.customerPhone.replace(/\s/g, "")}`}
                                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone className="h-3 w-3" />
                                {selectedOrder.customerPhone}
                              </a>
                            )}
                          </div>
                        </div>
                        {selectedOrder.deliveryAddress && (
                          <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                            <span>{selectedOrder.deliveryAddress}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Items
                    </h4>
                    <Card>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {selectedOrder.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between px-4 py-3"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium">{item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Qty: {item.qty} × ₹{item.price.toLocaleString("en-IN")}
                                </p>
                              </div>
                              <p className="text-sm font-semibold">
                                ₹{(item.qty * item.price).toLocaleString("en-IN")}
                              </p>
                            </div>
                          ))}
                        </div>
                        <Separator />
                        <div className="px-4 py-3 space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>₹{selectedOrder.subtotal.toLocaleString("en-IN")}</span>
                          </div>
                          {selectedOrder.deliveryFee > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Delivery Fee</span>
                              <span>₹{selectedOrder.deliveryFee.toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          {selectedOrder.tax > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Tax (GST)</span>
                              <span>₹{selectedOrder.tax.toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          <Separator />
                          <div className="flex justify-between font-bold">
                            <span>Total</span>
                            <span>₹{selectedOrder.total.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Payment Info */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Payment
                    </h4>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{selectedOrder.paymentMethod}</span>
                          </div>
                          <StatusBadge status={selectedOrder.paymentStatus} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Delivery Partner */}
                  {selectedOrder.assignedTo && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Delivery Partner
                      </h4>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100">
                              <Truck className="h-4 w-4 text-purple-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{selectedOrder.assignedTo}</p>
                              <p className="text-xs text-muted-foreground">Assigned to this order</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Order Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Timeline
                    </h4>
                    <Card>
                      <CardContent className="p-4">
                        <div className="space-y-0">
                          {getTimelineSteps(selectedOrder.status as OrderStatus).map((t, idx, arr) => (
                            <div key={t.step} className="flex gap-3">
                              {/* Dot + Line */}
                              <div className="flex flex-col items-center">
                                <div
                                  className={`h-3 w-3 rounded-full shrink-0 ${
                                    t.completed
                                      ? statusDotColor[selectedOrder.status] || "bg-emerald-500"
                                      : t.current
                                      ? statusDotColor[selectedOrder.status]
                                      : "bg-muted-foreground/30"
                                  } ${t.current ? "ring-4 ring-offset-1 ring-primary/20" : ""}`}
                                />
                                {idx < arr.length - 1 && (
                                  <div
                                    className={`w-0.5 h-8 ${
                                      t.completed ? "bg-emerald-300" : "bg-muted-foreground/20"
                                    }`}
                                  />
                                )}
                              </div>
                              {/* Label */}
                              <div className="pb-4">
                                <p
                                  className={`text-sm font-medium ${
                                    t.current
                                      ? "text-foreground"
                                      : t.completed
                                      ? "text-muted-foreground"
                                      : "text-muted-foreground/50"
                                  }`}
                                >
                                  {getLabel(t.step, labelMap)}
                                </p>
                                {t.current && (
                                  <p className="text-xs text-muted-foreground mt-0.5">Current status</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Action Buttons */}
                  {selectedOrder.status !== "DELIVERED" &&
                    selectedOrder.status !== "CANCELLED" && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                          Actions
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {getActionButtons(selectedOrder)}
                        </div>
                      </div>
                    )}
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ===== Create Order Dialog ===== */}
      <CreateOrderDialog
        open={createOrderOpen}
        onOpenChange={setCreateOrderOpen}
        businessId={businessId || ""}
        onOrderCreated={() => refetchOrders()}
      />

      {/* ===== Status Update Confirmation Dialog ===== */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingStatusUpdate?.newStatus === "CANCELLED"
                ? "Reject Order"
                : "Update Order Status"}
            </DialogTitle>
            <DialogDescription>
              {pendingStatusUpdate?.newStatus === "CANCELLED"
                ? `Are you sure you want to reject order ${pendingStatusUpdate?.order.orderNumber}? This action cannot be undone.`
                : `Change status of ${pendingStatusUpdate?.order.orderNumber} to ${getLabel(pendingStatusUpdate?.newStatus ?? "", labelMap)}?`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="status-notes">Notes (optional)</Label>
              <Textarea
                id="status-notes"
                placeholder="Add any notes about this status change..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setStatusDialogOpen(false)}
              disabled={updateStatusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStatusUpdate}
              disabled={updateStatusMutation.isPending}
              variant={
                pendingStatusUpdate?.newStatus === "CANCELLED"
                  ? "destructive"
                  : "default"
              }
              className={
                pendingStatusUpdate?.newStatus !== "CANCELLED"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : ""
              }
            >
              {updateStatusMutation.isPending
                ? "Updating..."
                : pendingStatusUpdate?.newStatus === "CANCELLED"
                ? "Reject Order"
                : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
