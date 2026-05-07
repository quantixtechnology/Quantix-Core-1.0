"use client"

import { useState, useEffect, useMemo } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useDeliveryOrders, useUpdateDeliveryStatus, queryKeys } from "@/hooks/use-api"
import { useDeliveryUpdates } from "@/hooks/use-realtime"
import { setBusinessContext } from "@/lib/api-client"
import { showSuccess, showError, showApiError } from "@/lib/toast-utils"
import { SkeletonList, EmptyState, ErrorState } from "@/components/ui/loading-states"
import { ConnectionStatusBadge } from "@/components/ui/connection-status"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Package,
  MapPin,
  Phone,
  Navigation,
  IndianRupee,
  Star,
  Truck,
  Clock,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  Smartphone,
  Bike,
  Loader2,
} from "lucide-react"

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  ASSIGNED: { label: "Ready for Pickup", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200", icon: Clock },
  PICKUP: { label: "Ready for Pickup", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200", icon: Clock },
  PICKED_UP: { label: "Picked Up", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200", icon: Package },
  ON_THE_WAY: { label: "On the Way", color: "text-teal-700", bgColor: "bg-teal-50 border-teal-200", icon: Truck },
  ARRIVED: { label: "Arrived", color: "text-cyan-700", bgColor: "bg-cyan-50 border-cyan-200", icon: MapPin },
  DELIVERED: { label: "Delivered", color: "text-green-700", bgColor: "bg-green-50 border-green-200", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "text-red-700", bgColor: "bg-red-50 border-red-200", icon: AlertCircle },
}

const paymentIcons: Record<string, React.ElementType> = {
  UPI: Smartphone,
  CARD: CreditCard,
  CASH: Banknote,
  COD: Banknote,
  CASH_ON_DELIVERY: Banknote,
  RAZORPAY: CreditCard,
}

// Normalize delivery order from API to a consistent shape for the UI
interface NormalizedDeliveryOrder {
  id: string
  deliveryId: string
  orderNumber: string
  status: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  totalAmount: number
  paymentMethod: string
  storeName: string
  storeAddress: string
  deliveryOtp: string
  estimatedDelivery: string
  distance: string
  itemsCount: number
}

function normalizeOrder(raw: Record<string, unknown>): NormalizedDeliveryOrder {
  const order = (raw.order || {}) as Record<string, unknown>
  const store = (order.store || {}) as Record<string, unknown>

  return {
    id: (order.id || raw.deliveryId || "") as string,
    deliveryId: (raw.deliveryId || "") as string,
    orderNumber: (order.orderNumber || "") as string,
    status: (raw.deliveryStatus || order.status || "") as string,
    customerName: (order.customerName || "Customer") as string,
    customerPhone: (order.customerPhone || "") as string,
    deliveryAddress: (raw.dropAddress || order.deliveryAddress || "") as string,
    totalAmount: Number(order.totalAmount || 0),
    paymentMethod: (order.paymentMethod || "COD") as string,
    storeName: (store.name || "Store") as string,
    storeAddress: (store.address || raw.pickupAddress || "") as string,
    deliveryOtp: (order.deliveryOtp || "") as string,
    estimatedDelivery: raw.estimatedDeliveryTime
      ? new Date(raw.estimatedDeliveryTime as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : (order.estimatedDelivery || "30 min") as string,
    distance: (raw.distance || "") as string,
    itemsCount: Number(order.itemsCount || 0),
  }
}

export function DeliveryDashboard() {
  const { setDeliveryPage, setSelectedOrderId } = useAdminStore()
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active")

  // Set business context
  useEffect(() => {
    setBusinessContext("biz_1")
  }, [])

  // Fetch orders using React Query
  const { data: activeData, isLoading: isLoadingActive, error: activeError, refetch: refetchActive } = useDeliveryOrders("active")
  const { data: completedData, isLoading: isLoadingCompleted, error: completedError, refetch: refetchCompleted } = useDeliveryOrders("completed")

  // Real-time delivery updates
  const { latestUpdate } = useDeliveryUpdates()

  // Status update mutation
  const updateStatusMutation = useUpdateDeliveryStatus({
    onSuccess: () => {
      showSuccess("Status Updated", "Delivery status has been updated")
    },
    onError: (err) => {
      showApiError(err)
    },
  })

  // Normalize API data
  const activeOrders = useMemo(() => {
    if (!activeData?.data) return []
    const rawOrders = Array.isArray(activeData.data) ? activeData.data : []
    return rawOrders.map((o: unknown) => normalizeOrder(o as Record<string, unknown>))
  }, [activeData])

  const completedOrders = useMemo(() => {
    if (!completedData?.data) return []
    const rawOrders = Array.isArray(completedData.data) ? completedData.data : []
    return rawOrders.map((o: unknown) => normalizeOrder(o as Record<string, unknown>))
  }, [completedData])

  const displayOrders = activeTab === "active" ? activeOrders : completedOrders
  const isLoading = activeTab === "active" ? isLoadingActive : isLoadingCompleted
  const error = activeTab === "active" ? activeError : completedError

  // Compute summary stats from active orders data
  const todayEarnings = useMemo(() => {
    return activeOrders.reduce((sum, o) => sum + o.totalAmount, 0)
  }, [activeOrders])

  const handleOrderClick = (orderId: string) => {
    setSelectedOrderId(orderId)
    setDeliveryPage("order-detail")
  }

  const handleStatusUpdate = (deliveryId: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation()
    updateStatusMutation.mutate({ deliveryId, status: newStatus })
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <ConnectionStatusBadge size="sm" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-teal-500 to-teal-600 border-0 text-white shadow-md">
          <CardContent className="p-3 text-center">
            <IndianRupee className="h-5 w-5 mx-auto mb-1 text-teal-100" />
            <p className="text-lg font-bold">₹{todayEarnings.toFixed(0)}</p>
            <p className="text-[10px] text-teal-100 font-medium">Today&apos;s Earnings</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 text-white shadow-md">
          <CardContent className="p-3 text-center">
            <Package className="h-5 w-5 mx-auto mb-1 text-emerald-100" />
            <p className="text-lg font-bold">{activeOrders.length}</p>
            <p className="text-[10px] text-emerald-100 font-medium">Active</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 border-0 text-white shadow-md">
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-amber-100" />
            <p className="text-lg font-bold">{completedOrders.length}</p>
            <p className="text-[10px] text-amber-100 font-medium">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="flex gap-2">
        <div className="flex-1 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center">
            <Bike className="h-4 w-4 text-teal-600" />
          </div>
          <div>
            <p className="text-xs text-teal-600 font-medium">Active Orders</p>
            <p className="text-lg font-bold text-teal-700">{activeOrders.length}</p>
          </div>
        </div>
        <div className="flex-1 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-green-600 font-medium">Completed</p>
            <p className="text-lg font-bold text-green-700">{completedOrders.length}</p>
          </div>
        </div>
      </div>

      {/* Map Placeholder */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 h-36 relative flex items-center justify-center">
          <div className="text-center">
            <div className="relative">
              <MapPin className="h-8 w-8 text-teal-600 mx-auto" />
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white" />
            </div>
            <p className="text-sm font-medium text-teal-700 mt-2">Pickup: FreshMart Grocers</p>
            <p className="text-xs text-teal-500 mt-0.5">{activeOrders.length} orders ready for pickup</p>
          </div>
          {/* Decorative map elements */}
          <div className="absolute top-3 left-3 h-2 w-2 rounded-full bg-teal-400/50" />
          <div className="absolute top-8 right-8 h-3 w-3 rounded-full bg-emerald-400/50" />
          <div className="absolute bottom-6 left-12 h-2 w-2 rounded-full bg-cyan-400/50" />
          <div className="absolute bottom-10 right-4 h-2 w-2 rounded-full bg-teal-400/30" />
          {/* Grid lines */}
          <div className="absolute inset-0 opacity-5">
            <div className="h-full w-full" style={{ backgroundImage: "linear-gradient(#0D9488 1px, transparent 1px), linear-gradient(90deg, #0D9488 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
          </div>
        </div>
      </Card>

      {/* Tab Switcher */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "active"
              ? "bg-white text-teal-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("active")}
        >
          Active ({activeOrders.length})
        </button>
        <button
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "completed"
              ? "bg-white text-teal-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("completed")}
        >
          Completed ({completedOrders.length})
        </button>
      </div>

      {/* Loading State */}
      {isLoading && <SkeletonList count={3} showAvatar showAction />}

      {/* Error State */}
      {error && !isLoading && (
        <ErrorState
          title="Failed to load orders"
          description="Could not fetch your delivery orders. Please try again."
          onRetry={() => activeTab === "active" ? refetchActive() : refetchCompleted()}
        />
      )}

      {/* Orders List */}
      {!isLoading && !error && displayOrders.length === 0 && (
        <EmptyState
          icon={Package}
          title={`No ${activeTab} orders`}
          description={activeTab === "active" ? "New orders will appear here" : "Completed deliveries will show here"}
        />
      )}

      {!isLoading && !error && displayOrders.length > 0 && (
        <div className="space-y-3">
          {displayOrders.map((order) => {
            const config = statusConfig[order.status] || statusConfig.ASSIGNED
            const PaymentIcon = paymentIcons[order.paymentMethod] || Banknote

            return (
              <Card
                key={order.deliveryId || order.id}
                className="border-0 shadow-sm overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => handleOrderClick(order.id)}
              >
                <CardContent className="p-0">
                  {/* Order header */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">
                        {order.orderNumber}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-5 ${config.color} ${config.bgColor} border-0 font-medium`}
                      >
                        {config.label}
                      </Badge>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>

                  {/* Customer and address */}
                  <div className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-gray-600">
                          {order.customerName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {order.customerName}
                        </p>
                        <div className="flex items-start gap-1 mt-1">
                          <MapPin className="h-3 w-3 text-gray-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {order.deliveryAddress}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Order details row */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-3">
                        {order.distance && (
                          <div className="flex items-center gap-1">
                            <Navigation className="h-3.5 w-3.5 text-teal-500" />
                            <span className="text-xs font-medium text-teal-600">{order.distance}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <PaymentIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-xs text-gray-500">{order.paymentMethod}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <IndianRupee className="h-3.5 w-3.5 text-gray-600" />
                        <span className="text-sm font-bold text-gray-900">₹{order.totalAmount.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action button */}
                  {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
                    <div className="px-4 pb-3">
                      <Button
                        className={`w-full h-10 rounded-xl font-semibold text-sm ${
                          order.status === "ASSIGNED" || order.status === "PICKUP"
                            ? "bg-amber-500 hover:bg-amber-600 text-white"
                            : order.status === "PICKED_UP"
                            ? "bg-blue-500 hover:bg-blue-600 text-white"
                            : "bg-teal-600 hover:bg-teal-700 text-white"
                        }`}
                        disabled={updateStatusMutation.isPending}
                        onClick={(e) => {
                          if (order.status === "ASSIGNED" || order.status === "PICKUP") {
                            handleStatusUpdate(order.deliveryId, "PICKED_UP", e)
                          } else if (order.status === "PICKED_UP") {
                            handleStatusUpdate(order.deliveryId, "ON_THE_WAY", e)
                          } else {
                            handleOrderClick(order.id)
                          }
                        }}
                      >
                        {updateStatusMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        {(order.status === "ASSIGNED" || order.status === "PICKUP") && (
                          <>
                            <Package className="h-4 w-4 mr-2" />
                            Mark as Picked Up
                          </>
                        )}
                        {order.status === "PICKED_UP" && (
                          <>
                            <Truck className="h-4 w-4 mr-2" />
                            Start Delivery
                          </>
                        )}
                        {(order.status === "ON_THE_WAY" || order.status === "ARRIVED") && (
                          <>
                            <Phone className="h-4 w-4 mr-2" />
                            Call Customer
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Bottom spacing */}
      <div className="h-4" />
    </div>
  )
}
