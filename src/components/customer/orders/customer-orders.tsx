"use client"

import { useState, useMemo, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useOrders } from "@/hooks/use-api"
import { useCartStore } from "@/stores/cart-store"
import { setBusinessContext } from "@/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState, EmptyState } from "@/components/ui/loading-states"
import { Badge } from "@/components/ui/badge"
import { showSuccess, showError } from "@/lib/toast-utils"
import { ClipboardList, ChevronRight, Package, RotateCcw, Loader2 } from "lucide-react"

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-purple-100 text-purple-700",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
  DELIVERED: "",
  CANCELLED: "bg-red-100 text-red-700",
  READY_FOR_PICKUP: "bg-teal-100 text-teal-700",
}

type TabFilter = "active" | "past" | "cancelled"

interface OrderItem {
  id: string
  orderNumber: string
  status: string
  orderType: string
  totalAmount: number
  createdAt: string
  customerName: string | null
  store: { id: string; name: string }
  _count?: { items: number }
  items?: Array<{ name: string; qty: number; price: number }>
}

export function CustomerOrders() {
  const { setCustomerPage, setSelectedOrderId, currentBusinessId, currentBusinessName, currentBusinessPrimaryColor } = useAdminStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"
  const { user, token } = useAuthStore()
  const addItem = useCartStore((s) => s.addItem)
  const [activeTab, setActiveTab] = useState<TabFilter>("active")
  const [reordering, setReordering] = useState<string | null>(null)

  useEffect(() => {
    if (currentBusinessId) setBusinessContext(currentBusinessId)
  }, [currentBusinessId])

  // Fetch orders - use customerId filter if available
  const { data: ordersData, isLoading: ordersLoading, error: ordersError, refetch } = useOrders({
    ...(user?.id ? { customerId: user.id } : {}),
    limit: 50,
  })

  // Parse orders from API
  const orders: OrderItem[] = useMemo(() => {
    if (!ordersData?.data) return []
    const ords = Array.isArray(ordersData.data) ? ordersData.data : []
    return ords.map((raw) => {
      const o = raw as unknown as Record<string, unknown>
      return {
        id: o.id as string,
        orderNumber: o.orderNumber as string,
        status: o.status as string,
        orderType: o.orderType as string,
        totalAmount: o.totalAmount as number,
        createdAt: o.createdAt as string,
        customerName: o.customerName as string | null,
        store: (o.store as { id: string; name: string }) || { id: "", name: currentBusinessName || "My Store" },
        _count: o._count as { items: number } | undefined,
        items: o.items as Array<{ name: string; qty: number; price: number }> | undefined,
      }
    })
  }, [ordersData, currentBusinessName])

  const filteredOrders = useMemo(() => {
    switch (activeTab) {
      case "active":
        return orders.filter(
          (o) => !["DELIVERED", "CANCELLED", "REFUNDED"].includes(o.status)
        )
      case "past":
        return orders.filter((o) => o.status === "DELIVERED")
      case "cancelled":
        return orders.filter((o) => ["CANCELLED", "REFUNDED"].includes(o.status))
      default:
        return orders
    }
  }, [orders, activeTab])

  const handleOrderClick = (orderId: string) => {
    setSelectedOrderId(orderId)
    setCustomerPage("order-tracking")
  }

  const handleReorder = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    setReordering(orderId)
    try {
      const res = await fetch(`/api/core/storefront/orders/${orderId}/reorder`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!json.success) { showError(json.error || "Failed to reorder"); return }
      const cartItems = (json.data as Array<Record<string, unknown>>) || []
      cartItems.forEach((item) => {
        addItem({
          productId: item.productId as string,
          variantId: item.variantId as string,
          name: item.name as string,
          variantName: item.variantName as string || "",
          price: item.price as number,
          mrp: item.mrp as number,
          quantity: item.quantity as number,
          image: item.image as string || "",
          isVeg: (item.isVeg as boolean) || false,
        })
      })
      showSuccess("Items added to cart")
      setCustomerPage("cart")
    } catch {
      showError("Failed to reorder")
    } finally {
      setReordering(null)
    }
  }

  const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    } catch {
      return dateStr
    }
  }

  const tabs: { id: TabFilter; label: string; count: number }[] = [
    { id: "active", label: "Active", count: orders.filter((o) => !["DELIVERED", "CANCELLED", "REFUNDED"].includes(o.status)).length },
    { id: "past", label: "Past", count: orders.filter((o) => o.status === "DELIVERED").length },
    { id: "cancelled", label: "Cancelled", count: orders.filter((o) => ["CANCELLED", "REFUNDED"].includes(o.status)).length },
  ]

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <h1 className="text-lg font-bold text-gray-900">My Orders</h1>
      </div>

      {/* Tab Filters */}
      <div className="flex gap-1 px-4 mb-4 bg-gray-100 mx-4 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 text-[10px]">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {ordersLoading ? (
        <div className="px-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-48 mb-2" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : ordersError ? (
        <ErrorState
          title="Could not load orders"
          description="Something went wrong while fetching your orders."
          onRetry={() => refetch()}
          className="py-16"
        />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No orders found"
          description={
            activeTab === "active"
              ? "Your active orders will appear here"
              : activeTab === "past"
              ? "Your past orders will appear here"
              : "Your cancelled orders will appear here"
          }
          className="py-16"
        />
      ) : (
        <div className="px-4 space-y-3">
          {filteredOrders.map((order) => (
            <button
              key={order.id}
              onClick={() => handleOrderClick(order.id)}
              className="w-full bg-white border border-gray-100 rounded-xl p-4 text-left hover:border-gray-200 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">{order.orderNumber}</span>
                  <Badge
                    className={`${statusColors[order.status] || "bg-gray-100 text-gray-700"} text-[9px] px-1.5 py-0 h-4 border-0`}
                    style={order.status === "DELIVERED" ? { backgroundColor: `${brandColor}20`, color: brandColor } : undefined}
                  >
                    {order.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>

              <div className="flex items-center gap-2 mb-2">
                <div className="flex -space-x-1">
                  {Array.from({ length: Math.min(3, order._count?.items || 1) }).map((_, idx) => (
                    <div
                      key={idx}
                      className="w-7 h-7 bg-gray-100 rounded-md flex items-center justify-center border border-white"
                    >
                      <Package className="w-3 h-3 text-gray-400" />
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-gray-500">
                  {order._count?.items || 1} item{(order._count?.items || 1) !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">{formatDate(order.createdAt)}</span>
                <span className="text-sm font-bold text-gray-900">{formatPrice(order.totalAmount)}</span>
              </div>

              {order.status === "OUT_FOR_DELIVERY" && (
                <div className="mt-2 rounded-lg px-3 py-2 flex items-center gap-2" style={{ backgroundColor: `${brandColor}0d` }}>
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: brandColor }} />
                  <span className="text-[10px] font-medium" style={{ color: brandColor }}>
                    Your order is on the way!
                  </span>
                </div>
              )}
              {order.status === "DELIVERED" && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={(e) => handleReorder(e, order.id)}
                    disabled={reordering === order.id}
                    className="flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-semibold border transition-colors"
                    style={{ borderColor: `${brandColor}50`, color: brandColor }}
                  >
                    {reordering === order.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <RotateCcw className="w-3 h-3" />
                    }
                    Reorder
                  </button>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
