"use client"

import { useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { assignedOrders, earningsData, partnerProfile } from "@/components/delivery/data"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
} from "lucide-react"

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  PICKUP: { label: "Ready for Pickup", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200", icon: Clock },
  PICKED_UP: { label: "Picked Up", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200", icon: Package },
  ON_THE_WAY: { label: "On the Way", color: "text-teal-700", bgColor: "bg-teal-50 border-teal-200", icon: Truck },
  DELIVERED: { label: "Delivered", color: "text-green-700", bgColor: "bg-green-50 border-green-200", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "text-red-700", bgColor: "bg-red-50 border-red-200", icon: AlertCircle },
}

const paymentIcons: Record<string, React.ElementType> = {
  UPI: Smartphone,
  CARD: CreditCard,
  CASH: Banknote,
  COD: Banknote,
}

export function DeliveryDashboard() {
  const { setDeliveryPage, setSelectedOrderId } = useAdminStore()
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active")

  const activeOrders = assignedOrders.filter(
    (o) => o.status === "PICKUP" || o.status === "PICKED_UP" || o.status === "ON_THE_WAY"
  )
  const completedOrders = assignedOrders.filter((o) => o.status === "DELIVERED")

  const displayOrders = activeTab === "active" ? activeOrders : completedOrders

  const handleOrderClick = (orderId: string) => {
    setSelectedOrderId(orderId)
    setDeliveryPage("order-detail")
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-teal-500 to-teal-600 border-0 text-white shadow-md">
          <CardContent className="p-3 text-center">
            <IndianRupee className="h-5 w-5 mx-auto mb-1 text-teal-100" />
            <p className="text-lg font-bold">₹{earningsData.todayEarnings}</p>
            <p className="text-[10px] text-teal-100 font-medium">Today&apos;s Earnings</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 text-white shadow-md">
          <CardContent className="p-3 text-center">
            <Package className="h-5 w-5 mx-auto mb-1 text-emerald-100" />
            <p className="text-lg font-bold">{earningsData.todayDeliveries}</p>
            <p className="text-[10px] text-emerald-100 font-medium">Deliveries</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 border-0 text-white shadow-md">
          <CardContent className="p-3 text-center">
            <Star className="h-5 w-5 mx-auto mb-1 text-amber-100" />
            <p className="text-lg font-bold">{partnerProfile.rating}</p>
            <p className="text-[10px] text-amber-100 font-medium">Rating</p>
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

      {/* Orders List */}
      <div className="space-y-3">
        {displayOrders.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">No {activeTab} orders</p>
              <p className="text-xs text-gray-400 mt-1">
                {activeTab === "active" ? "New orders will appear here" : "Completed deliveries will show here"}
              </p>
            </CardContent>
          </Card>
        ) : (
          displayOrders.map((order) => {
            const config = statusConfig[order.status]
            const PaymentIcon = paymentIcons[order.paymentMethod] || Banknote

            return (
              <Card
                key={order.id}
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
                        <div className="flex items-center gap-1">
                          <Navigation className="h-3.5 w-3.5 text-teal-500" />
                          <span className="text-xs font-medium text-teal-600">{order.distance}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <PaymentIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-xs text-gray-500">{order.paymentMethod}</span>
                        </div>
                        <span className="text-xs text-gray-400">{order.items.length} items</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <IndianRupee className="h-3.5 w-3.5 text-gray-600" />
                        <span className="text-sm font-bold text-gray-900">₹{order.totalAmount.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action button */}
                  {order.status !== "DELIVERED" && (
                    <div className="px-4 pb-3">
                      <Button
                        className={`w-full h-10 rounded-xl font-semibold text-sm ${
                          order.status === "PICKUP"
                            ? "bg-amber-500 hover:bg-amber-600 text-white"
                            : order.status === "PICKED_UP"
                            ? "bg-blue-500 hover:bg-blue-600 text-white"
                            : "bg-teal-600 hover:bg-teal-700 text-white"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOrderClick(order.id)
                        }}
                      >
                        {order.status === "PICKUP" && (
                          <>
                            <Package className="h-4 w-4 mr-2" />
                            Go to Pickup
                          </>
                        )}
                        {order.status === "PICKED_UP" && (
                          <>
                            <Truck className="h-4 w-4 mr-2" />
                            Start Delivery
                          </>
                        )}
                        {order.status === "ON_THE_WAY" && (
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
          })
        )}
      </div>

      {/* Bottom spacing */}
      <div className="h-4" />
    </div>
  )
}
