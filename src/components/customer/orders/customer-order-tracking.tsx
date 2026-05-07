"use client"

import React, { useMemo, useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useOrder, useTrackOrder } from "@/hooks/use-api"
import { useDeliveryUpdates } from "@/hooks/use-realtime"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/loading-states"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Phone,
  MapPin,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  User,
  Download,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Loader2,
} from "lucide-react"

const statusSteps = [
  { key: "PENDING", label: "Order Placed", icon: Package },
  { key: "CONFIRMED", label: "Confirmed", icon: CheckCircle2 },
  { key: "PREPARING", label: "Preparing", icon: Clock },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: Truck },
  { key: "DELIVERED", label: "Delivered", icon: CheckCircle2 },
]

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-purple-100 text-purple-700",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
}

export function CustomerOrderTracking() {
  const { selectedOrderId, setCustomerPage } = useAdminStore()
  const [showDetails, setShowDetails] = useState(false)

  // Fetch order details
  const { data: orderData, isLoading: orderLoading, error: orderError, refetch } = useOrder(selectedOrderId || "")

  // Fetch delivery tracking data (auto-refreshes every 15s)
  const { data: trackingData } = useTrackOrder(selectedOrderId || "")

  // Real-time delivery updates via WebSocket
  const { latestUpdate, partnerLocation } = useDeliveryUpdates(selectedOrderId || "")

  // Parse order from API
  const order = useMemo(() => {
    if (!orderData?.data) return null
    const o = orderData.data as Record<string, unknown>
    return {
      id: o.id as string,
      orderNumber: o.orderNumber as string,
      status: o.status as string,
      totalAmount: o.totalAmount as number,
      createdAt: o.createdAt as string,
      paymentMethod: (o as Record<string, unknown>).paymentMethod as string | undefined,
      items: Array.isArray(o.items)
        ? (o.items as Array<Record<string, unknown>>).map((i) => ({
            name: (i as Record<string, unknown>).productName as string || "Item",
            qty: (i as Record<string, unknown>).quantity as number || 1,
            price: (i as Record<string, unknown>).unitPrice as number || 0,
          }))
        : [],
      deliveryAddress: (o as Record<string, unknown>).deliveryAddress as string | undefined,
      estimatedDelivery: (o as Record<string, unknown>).estimatedDelivery as string | undefined,
      deliveryPartner: (o as Record<string, unknown>).deliveryPartner as { name: string; phone: string; vehicle?: string } | undefined,
    }
  }, [orderData])

  // Merge real-time updates into tracking
  const currentStatus = latestUpdate?.status || order?.status || "PENDING"

  const currentStepIndex = statusSteps.findIndex((s) => s.key === currentStatus)

  const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    } catch {
      return dateStr
    }
  }

  const handleBack = () => {
    setCustomerPage("orders")
  }

  // Loading state
  if (orderLoading) {
    return (
      <div className="pb-4">
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-full" />
          <div>
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="mx-4 mb-4">
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <div className="px-4 space-y-4">
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  // Error state
  if (orderError || !order) {
    return (
      <div className="pb-4">
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Track Order</h1>
        </div>
        <ErrorState
          title="Order not found"
          description="We couldn't load this order. It may have been removed or is temporarily unavailable."
          onRetry={() => refetch()}
          className="py-20"
        />
      </div>
    )
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <button
          onClick={handleBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Track Order</h1>
          <p className="text-xs text-gray-400">{order.orderNumber}</p>
        </div>
        {latestUpdate && (
          <div className="ml-auto">
            <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-emerald-700 font-medium">Live</span>
            </div>
          </div>
        )}
      </div>

      {/* Map Placeholder */}
      {(currentStatus === "OUT_FOR_DELIVERY" || currentStatus === "PREPARING") && (
        <div className="mx-4 mb-4 h-40 bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl flex items-center justify-center border border-emerald-100 relative">
          <div className="text-center">
            <MapPin className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs text-emerald-700 font-medium">Live Tracking</p>
            <p className="text-[10px] text-gray-500">
              {currentStatus === "OUT_FOR_DELIVERY"
                ? "Your order is on the way!"
                : "Your order is being prepared"}
            </p>
            {partnerLocation && (
              <p className="text-[10px] text-emerald-600 mt-1">
                📍 {partnerLocation.lat.toFixed(4)}, {partnerLocation.lng.toFixed(4)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Status Badge */}
      <div className="px-4 mb-4">
        <Badge className={`${statusColors[currentStatus] || "bg-gray-100 text-gray-700"} text-xs px-3 py-1 border-0`}>
          {currentStatus.replace(/_/g, " ")}
        </Badge>
        {order.estimatedDelivery && currentStatus !== "DELIVERED" && currentStatus !== "CANCELLED" && (
          <p className="text-xs text-gray-500 mt-1.5">
            Estimated delivery by {formatDate(order.estimatedDelivery)}
          </p>
        )}
      </div>

      {/* Status Timeline */}
      {currentStatus !== "CANCELLED" && (
        <div className="px-4 mb-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Order Status</h3>
            <div className="space-y-0">
              {statusSteps.map((step, idx) => {
                const isCompleted = idx <= currentStepIndex
                const isCurrent = idx === currentStepIndex
                const Icon = step.icon

                return (
                  <div key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isCompleted
                            ? isCurrent
                              ? "bg-emerald-500 text-white"
                              : "bg-emerald-100 text-emerald-600"
                            : "bg-gray-100 text-gray-300"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      {idx < statusSteps.length - 1 && (
                        <div
                          className={`w-0.5 h-8 ${
                            idx < currentStepIndex ? "bg-emerald-300" : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                    <div className="pb-6">
                      <p
                        className={`text-xs font-medium ${
                          isCompleted ? "text-gray-900" : "text-gray-400"
                        }`}
                      >
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="text-[10px] text-emerald-600">In progress</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Delivery Partner */}
      {(order.deliveryPartner || latestUpdate?.partnerName) && (currentStatus === "OUT_FOR_DELIVERY" || currentStatus === "PREPARING") && (
        <div className="px-4 mb-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Delivery Partner</h3>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-emerald-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {order.deliveryPartner?.name || latestUpdate?.partnerName || "Assigned Partner"}
                </p>
                <p className="text-[10px] text-gray-400">
                  {order.deliveryPartner?.vehicle || "On the way"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-9 h-9 bg-emerald-50 rounded-full flex items-center justify-center">
                  <Phone className="w-4 h-4 text-emerald-600" />
                </button>
                <button className="w-9 h-9 bg-emerald-50 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Details */}
      <div className="px-4 mb-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="text-sm font-bold text-gray-900">Order Details</h3>
            {showDetails ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Order Number</span>
              <span className="text-xs font-medium">{order.orderNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Placed On</span>
              <span className="text-xs font-medium">{formatDate(order.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Payment</span>
              <span className="text-xs font-medium">{order.paymentMethod || "UPI"}</span>
            </div>
          </div>

          {showDetails && (
            <>
              <Separator className="my-3" />
              <div className="space-y-2 mb-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">
                      {item.name} × {item.qty}
                    </span>
                    <span className="text-xs font-medium">{formatPrice(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-bold">Total</span>
                <span className="text-sm font-bold">{formatPrice(order.totalAmount)}</span>
              </div>
              {order.deliveryAddress && (
                <div className="mt-3 p-2.5 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-500">Delivery Address</span>
                  </div>
                  <p className="text-xs text-gray-700">{order.deliveryAddress}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Invoice Button */}
      {currentStatus === "DELIVERED" && (
        <div className="px-4">
          <Button
            variant="outline"
            className="w-full h-10 rounded-xl text-xs border-emerald-200 text-emerald-600"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Invoice
          </Button>
        </div>
      )}
    </div>
  )
}
