"use client"

import React, { useMemo } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useOrders } from "@/hooks/use-api"
import { buildLabelMap, getLabel } from "@/lib/order-stages"
import { ArrowLeft, Package, Tag, Truck, CheckCircle2, Clock, Bell, AlertCircle } from "lucide-react"

interface Notification {
  id: string
  type: "order" | "offer" | "system"
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  body: string
  time: string
  read: boolean
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)    return "just now"
  if (mins < 60)   return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}

export function CustomerNotifications() {
  const { setCustomerPage, currentBusinessPrimaryColor, orderStages } = useAdminStore()
  const { user } = useAuthStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"
  const labelMap = useMemo(() => buildLabelMap(orderStages), [orderStages])

  const { data: ordersData, isLoading } = useOrders({ customerId: user?.id || "", limit: 10 })

  const notifications = useMemo<Notification[]>(() => {
    const list: Notification[] = []

    // Static promotional notifications (in production, fetch from API)
    list.push({
      id: "promo_1",
      type: "offer",
      icon: Tag,
      iconBg: "#FEF3C7",
      iconColor: "#D97706",
      title: "Today's Special Offer",
      body: "Get 10% off on fresh chicken orders above ₹300. Use code FRESH10",
      time: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      read: false,
    })

    // Order-based notifications from recent orders
    const orders = (Array.isArray(ordersData?.data) ? ordersData!.data : []) as unknown as Record<string, unknown>[]
    orders.forEach((order) => {
      const id       = order.id as string
      const num      = order.orderNumber as string || id?.slice(-6)
      const status   = order.status as string || "PENDING"
      const updatedAt = (order.updatedAt as string) || new Date().toISOString()
      const label    = getLabel(status, labelMap)

      let icon: React.ElementType = Package
      let iconBg = "#EFF6FF"
      let iconColor = "#3B82F6"

      if (status === "OUT_FOR_DELIVERY")   { icon = Truck;         iconBg = "#F0FDF4"; iconColor = "#16A34A" }
      else if (status === "DELIVERED")     { icon = CheckCircle2;  iconBg = "#F0FDF4"; iconColor = "#16A34A" }
      else if (status === "CANCELLED")     { icon = AlertCircle;   iconBg = "#FEF2F2"; iconColor = "#DC2626" }
      else if (status === "PREPARING")     { icon = Clock;         iconBg = "#FFF7ED"; iconColor = "#EA580C" }

      list.push({
        id: `order_${id}`,
        type: "order",
        icon,
        iconBg,
        iconColor,
        title: label,
        body: `Order #${num} · ${label.toLowerCase()}`,
        time: updatedAt,
        read: status === "DELIVERED" || status === "CANCELLED",
      })
    })

    // Sort by time descending
    return list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  }, [ordersData, labelMap])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setCustomerPage("home")}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-xs text-gray-400">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button className="text-xs font-medium" style={{ color: brandColor }}>
            Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-sm font-semibold text-gray-600 mb-1">No notifications yet</h3>
          <p className="text-xs text-gray-400">We&apos;ll notify you about your orders and offers here</p>
        </div>
      ) : (
        <div>
          {notifications.map((notif, idx) => {
            const Icon = notif.icon
            return (
              <React.Fragment key={notif.id}>
                <div
                  className={`flex gap-3 px-4 py-3.5 transition-colors ${!notif.read ? "bg-blue-50/40" : "bg-white"}`}
                  onClick={() => notif.type === "order" && setCustomerPage("orders")}
                  style={{ cursor: notif.type === "order" ? "pointer" : "default" }}
                >
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: notif.iconBg }}
                  >
                    <Icon className="w-5 h-5" style={{ color: notif.iconColor }} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${!notif.read ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{timeAgo(notif.time)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
                  </div>
                  {/* Unread dot */}
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ backgroundColor: brandColor }} />
                  )}
                </div>
                {idx < notifications.length - 1 && <div className="h-px bg-gray-50 mx-4" />}
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
