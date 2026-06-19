"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { ArrowLeft, Package, ChevronRight, Clock, CheckCircle2, Truck, XCircle, Loader2 } from "lucide-react"
import { formatINR } from "@/lib/currency"
import { buildLabelMap, getLabel } from "@/lib/order-stages"
import type { WebNav } from "./storefront-website"

interface OrderItem { itemName: string; quantity: number; unitPrice: number; totalPrice: number }

interface Order {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string | null
  totalAmount: number
  createdAt: string
  items: OrderItem[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:    { label: "Pending",    color: "#F59E0B", icon: Clock },
  CONFIRMED:  { label: "Confirmed",  color: "#3B82F6", icon: CheckCircle2 },
  PREPARING:  { label: "Preparing",  color: "#8B5CF6", icon: Clock },
  OUT_FOR_DELIVERY: { label: "On the way", color: "#0EA5E9", icon: Truck },
  DELIVERED:  { label: "Delivered",  color: "#10B981", icon: CheckCircle2 },
  CANCELLED:  { label: "Cancelled",  color: "#EF4444", icon: XCircle },
}

interface StorefrontOrdersProps {
  brandColor: string
  nav: WebNav
}

export function StorefrontOrders({ brandColor, nav }: StorefrontOrdersProps) {
  const { isAuthenticated, token } = useAuthStore()
  const { orderStages, currentBusinessId } = useAdminStore()
  const labelMap = useMemo(() => buildLabelMap(orderStages), [orderStages])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isAuthenticated || !token) { setLoading(false); return }
    fetch("/api/core/storefront/orders", {
      headers: { Authorization: `Bearer ${token}`, "x-business-id": currentBusinessId || "" },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setOrders(data.data || [])
        else setError(data.error || "Failed to load orders")
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false))
  }, [isAuthenticated, token])

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <Package className="w-16 h-16 text-gray-200" />
        <h2 className="text-lg font-bold text-gray-900">Sign in to view orders</h2>
        <button
          onClick={() => nav.go("auth")}
          className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl"
          style={{ backgroundColor: brandColor }}
        >
          Sign In
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => nav.goBack("home")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-gray-700 mb-2">No orders yet</h3>
          <p className="text-sm text-gray-400 mb-6">Your order history will appear here.</p>
          <button
            onClick={() => nav.go("home")}
            className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl"
            style={{ backgroundColor: brandColor }}
          >
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const cfg = STATUS_CONFIG[order.status] || { label: order.status, color: "#6B7280", icon: Clock }
            const Icon = cfg.icon
            const statusLabel = getLabel(order.status, labelMap) || cfg.label
            return (
              <button
                key={order.id}
                onClick={() => nav.go("order-tracking", { orderId: order.id })}
                className="w-full bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-300 transition-colors text-left group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900 font-mono">{order.orderNumber}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: cfg.color }}
                    >
                      <Icon className="w-3 h-3" />
                      {statusLabel}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  {order.items.slice(0, 3).map((item) => `${item.itemName} ×${item.quantity}`).join(", ")}
                  {order.items.length > 3 && ` +${order.items.length - 3} more`}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-gray-900">{formatINR(order.totalAmount)}</span>
                  <span className="text-xs text-gray-400">{order.paymentMethod || "COD"}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
