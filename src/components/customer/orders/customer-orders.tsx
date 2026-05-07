"use client"

import React, { useState, useMemo } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { customerOrders } from "@/components/customer/data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ClipboardList, ChevronRight, Package } from "lucide-react"

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-purple-100 text-purple-700",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
}

type TabFilter = "active" | "past" | "cancelled"

export function CustomerOrders() {
  const { setCustomerPage, setSelectedOrderId } = useAdminStore()
  const [activeTab, setActiveTab] = useState<TabFilter>("active")

  const filteredOrders = useMemo(() => {
    switch (activeTab) {
      case "active":
        return customerOrders.filter(
          (o) => !["DELIVERED", "CANCELLED"].includes(o.status)
        )
      case "past":
        return customerOrders.filter((o) => o.status === "DELIVERED")
      case "cancelled":
        return customerOrders.filter((o) => o.status === "CANCELLED")
      default:
        return customerOrders
    }
  }, [activeTab])

  const handleOrderClick = (orderId: string) => {
    setSelectedOrderId(orderId)
    setCustomerPage("order-tracking")
  }

  const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`

  const tabs: { id: TabFilter; label: string; count: number }[] = [
    { id: "active", label: "Active", count: customerOrders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status)).length },
    { id: "past", label: "Past", count: customerOrders.filter((o) => o.status === "DELIVERED").length },
    { id: "cancelled", label: "Cancelled", count: customerOrders.filter((o) => o.status === "CANCELLED").length },
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
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <ClipboardList className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-800">No orders found</p>
          <p className="text-xs text-gray-400 mt-1">
            {activeTab === "active"
              ? "Your active orders will appear here"
              : activeTab === "past"
              ? "Your past orders will appear here"
              : "Your cancelled orders will appear here"}
          </p>
        </div>
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
                  <Badge className={`${statusColors[order.status]} text-[9px] px-1.5 py-0 h-4 border-0`}>
                    {order.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>

              <div className="flex items-center gap-2 mb-2">
                <div className="flex -space-x-1">
                  {order.items.slice(0, 3).map((_, idx) => (
                    <div
                      key={idx}
                      className="w-7 h-7 bg-gray-100 rounded-md flex items-center justify-center border border-white"
                    >
                      <Package className="w-3 h-3 text-gray-400" />
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-gray-500">
                  {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                </span>
              </div>

              <p className="text-[10px] text-gray-400 truncate mb-1.5">
                {order.items.map((i) => i.name).join(", ")}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">{order.createdAt}</span>
                <span className="text-sm font-bold text-gray-900">{formatPrice(order.total)}</span>
              </div>

              {order.status === "OUT_FOR_DELIVERY" && (
                <div className="mt-2 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-emerald-700 font-medium">
                    Your order is on the way!
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
