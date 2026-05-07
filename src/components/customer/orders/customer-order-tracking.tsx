"use client"

import React, { useMemo } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { customerOrders } from "@/components/customer/data"
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
} from "lucide-react"

const statusSteps = [
  { key: "PENDING", label: "Order Placed", icon: Package, time: "" },
  { key: "CONFIRMED", label: "Confirmed", icon: CheckCircle2, time: "" },
  { key: "PREPARING", label: "Preparing", icon: Clock, time: "" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: Truck, time: "" },
  { key: "DELIVERED", label: "Delivered", icon: CheckCircle2, time: "" },
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
  const [showDetails, setShowDetails] = React.useState(false)

  const order = useMemo(() => {
    return customerOrders.find((o) => o.id === selectedOrderId) || customerOrders[1]
  }, [selectedOrderId])

  const currentStepIndex = statusSteps.findIndex((s) => s.key === order.status)

  const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`

  const handleBack = () => {
    setCustomerPage("orders")
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
      </div>

      {/* Map Placeholder */}
      {(order.status === "OUT_FOR_DELIVERY" || order.status === "PREPARING") && (
        <div className="mx-4 mb-4 h-40 bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl flex items-center justify-center border border-emerald-100">
          <div className="text-center">
            <MapPin className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs text-emerald-700 font-medium">Live Tracking</p>
            <p className="text-[10px] text-gray-500">
              {order.status === "OUT_FOR_DELIVERY"
                ? "Your order is on the way!"
                : "Your order is being prepared"}
            </p>
          </div>
        </div>
      )}

      {/* Status Badge */}
      <div className="px-4 mb-4">
        <Badge className={`${statusColors[order.status]} text-xs px-3 py-1 border-0`}>
          {order.status.replace(/_/g, " ")}
        </Badge>
        {order.estimatedDelivery && order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
          <p className="text-xs text-gray-500 mt-1.5">
            Estimated delivery by {order.estimatedDelivery?.split(" ")[1] || "soon"}
          </p>
        )}
      </div>

      {/* Status Timeline */}
      {order.status !== "CANCELLED" && (
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
      {order.deliveryPartner && (order.status === "OUT_FOR_DELIVERY" || order.status === "PREPARING") && (
        <div className="px-4 mb-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Delivery Partner</h3>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-emerald-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{order.deliveryPartner.name}</p>
                <p className="text-[10px] text-gray-400">{order.deliveryPartner.vehicle}</p>
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
              <span className="text-xs font-medium">{order.createdAt}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Payment</span>
              <span className="text-xs font-medium">{order.paymentMethod}</span>
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
                <span className="text-sm font-bold">{formatPrice(order.total)}</span>
              </div>
              <div className="mt-3 p-2.5 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  <span className="text-[10px] font-medium text-gray-500">Delivery Address</span>
                </div>
                <p className="text-xs text-gray-700">{order.deliveryAddress}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Invoice Button */}
      {order.status === "DELIVERED" && (
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
