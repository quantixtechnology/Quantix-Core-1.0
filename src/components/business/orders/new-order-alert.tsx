"use client"

// ============================================================================
// QUANTIX CORE — New Order Alert
// Mounts once in BusinessLayout. Listens for order:created socket events and
// shows a modal popup with full order details plus Accept / Cancel buttons.
//
// Behaviour:
//   - Plays a buzzer sound on every new (non-POS) order
//   - Queues multiple simultaneous orders; shows one at a time
//   - Accept → PUT /api/core/orders/{id}/status { status: CONFIRMED }
//   - Cancel → PUT /api/core/orders/{id}/status { status: CANCELLED }
//   - Both paths trigger the existing customer notification (push + in-app)
// ============================================================================

import { useEffect, useRef, useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  ShoppingBag,
  Phone,
  MapPin,
  User,
  CheckCircle2,
  X,
  Bell,
  Package,
  Clock,
} from "lucide-react"
import { useAuthStore } from "@/stores/auth-store"
import { useRealtime, type RealtimePayload } from "@/hooks/use-realtime"
import {
  playNewOrderSound,
  playOrderAcceptedSound,
  playOrderCancelledSound,
} from "@/lib/notification-sounds"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlertItem {
  name: string
  variant?: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  isVeg?: boolean | null
}

interface PendingOrder {
  orderId: string
  orderNumber: string
  orderType: string
  totalAmount: number
  subtotal?: number
  totalTax?: number
  totalDiscount?: number
  deliveryFee?: number
  customerName: string
  customerPhone?: string | null
  deliveryAddress?: string | null
  storeId?: string
  items: AlertItem[]
  arrivedAt: number // Date.now()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatOrderType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function orderTypeBadgeColor(t: string): string {
  switch (t) {
    case "DELIVERY": return "bg-blue-100 text-blue-800"
    case "PICKUP": return "bg-purple-100 text-purple-800"
    case "DINE_IN": return "bg-orange-100 text-orange-800"
    case "SUBSCRIPTION": return "bg-teal-100 text-teal-800"
    case "PICKUP_AND_DELIVERY": return "bg-indigo-100 text-indigo-800"
    default: return "bg-gray-100 text-gray-700"
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewOrderAlert() {
  const { currentBusinessId } = useAuthStore()
  const [queue, setQueue] = useState<PendingOrder[]>([])
  const [accepting, setAccepting] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Use the realtime hook to get subscribe — autoConnect: false because the
  // BusinessLayout/BusinessDashboard already owns the socket connection.
  const { subscribe } = useRealtime({ businessId: currentBusinessId || undefined, autoConnect: true })

  // Subscribe to order:created events
  useEffect(() => {
    if (!currentBusinessId) return

    const unsub = subscribe("order:created", (payload: RealtimePayload) => {
      const data = payload.data as Record<string, unknown>

      // Skip POS-terminal orders — cashier is standing there; no alert needed
      const orderType = String(data.orderType || "")
      const orderSource = String(data.orderSource || "")
      if (orderType === "POS" || orderSource === "pos") return

      const newOrder: PendingOrder = {
        orderId: String(data.orderId || ""),
        orderNumber: String(data.orderNumber || ""),
        orderType,
        totalAmount: Number(data.totalAmount) || 0,
        subtotal: data.subtotal !== undefined ? Number(data.subtotal) : undefined,
        totalTax: data.totalTax !== undefined ? Number(data.totalTax) : undefined,
        totalDiscount: data.totalDiscount !== undefined ? Number(data.totalDiscount) : undefined,
        deliveryFee: data.deliveryFee !== undefined ? Number(data.deliveryFee) : undefined,
        customerName: String(data.customerName || "Customer"),
        customerPhone: (data.customerPhone as string) || null,
        deliveryAddress: (data.deliveryAddress as string) || null,
        storeId: (data.storeId as string) || undefined,
        items: Array.isArray(data.items)
          ? (data.items as Array<Record<string, unknown>>).map((i) => ({
              name: String(i.name || ""),
              variant: (i.variant as string) || null,
              quantity: Number(i.quantity) || 1,
              unitPrice: Number(i.unitPrice) || 0,
              totalPrice: Number(i.totalPrice) || 0,
              isVeg: i.isVeg !== undefined ? Boolean(i.isVeg) : null,
            }))
          : [],
        arrivedAt: Date.now(),
      }

      setQueue((prev) => [...prev, newOrder])
      playNewOrderSound()
    })

    return unsub
  }, [currentBusinessId, subscribe])

  const current = queue[0] ?? null

  const dismiss = useCallback(() => {
    setQueue((prev) => prev.slice(1))
    setAccepting(false)
    setCancelling(false)
  }, [])

  const handleAccept = useCallback(async () => {
    if (!current || accepting) return
    setAccepting(true)
    try {
      const res = await fetch(`/api/core/orders/${current.orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "CONFIRMED", note: "Accepted by business" }),
      })
      if (res.ok) {
        await playOrderAcceptedSound()
      }
    } catch {
      // Non-blocking — the business can always go to the Orders page to manage
    } finally {
      dismiss()
    }
  }, [current, accepting, dismiss])

  const handleCancel = useCallback(async () => {
    if (!current || cancelling) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/core/orders/${current.orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "CANCELLED", note: "Rejected by business" }),
      })
      if (res.ok) {
        await playOrderCancelledSound()
      }
    } catch {
      // Non-blocking
    } finally {
      dismiss()
    }
  }, [current, cancelling, dismiss])

  if (!current) return null

  const queueTail = queue.length - 1

  return (
    <Dialog open modal>
      {/* Custom overlay with pulsing ring to draw attention */}
      <DialogContent
        className="max-w-md w-full p-0 overflow-hidden border-0 shadow-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Amber top banner */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center gap-3">
          <div className="flex-shrink-0 bg-white/20 rounded-full p-2 animate-bounce">
            <Bell className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogHeader>
              <DialogTitle className="text-white text-lg font-bold leading-tight">
                New Order Received!
              </DialogTitle>
              <DialogDescription className="text-amber-100 text-sm">
                Order #{current.orderNumber}
              </DialogDescription>
            </DialogHeader>
          </div>
          {queueTail > 0 && (
            <span className="flex-shrink-0 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
              +{queueTail} more
            </span>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Order type + time */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full ${orderTypeBadgeColor(current.orderType)}`}>
              <Package className="h-3 w-3" />
              {formatOrderType(current.orderType)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Just now
            </span>
          </div>

          {/* Customer info */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-semibold text-foreground">{current.customerName}</span>
            </div>
            {current.customerPhone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>{current.customerPhone}</span>
              </div>
            )}
            {current.deliveryAddress && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">{current.deliveryAddress}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">
                {current.items.length} {current.items.length === 1 ? "item" : "items"}
              </span>
            </div>
            <ScrollArea className="max-h-44">
              <div className="space-y-1.5 pr-2">
                {current.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.isVeg === true && (
                        <span className="flex-shrink-0 w-3 h-3 rounded-full bg-green-500 border border-green-700" title="Veg" />
                      )}
                      {item.isVeg === false && (
                        <span className="flex-shrink-0 w-3 h-3 rounded-full bg-red-500 border border-red-700" title="Non-veg" />
                      )}
                      <span className="font-medium truncate">{item.name}</span>
                      {item.variant && (
                        <span className="text-muted-foreground text-xs flex-shrink-0">({item.variant})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge variant="secondary" className="text-xs px-2 py-0">
                        ×{item.quantity}
                      </Badge>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {formatCurrency(item.totalPrice)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-1.5 text-sm">
            {current.subtotal !== undefined && current.subtotal !== current.totalAmount && (
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(current.subtotal)}</span>
              </div>
            )}
            {current.totalDiscount !== undefined && current.totalDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>−{formatCurrency(current.totalDiscount)}</span>
              </div>
            )}
            {current.totalTax !== undefined && current.totalTax > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax / GST</span>
                <span>{formatCurrency(current.totalTax)}</span>
              </div>
            )}
            {current.deliveryFee !== undefined && current.deliveryFee > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery Fee</span>
                <span>{formatCurrency(current.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
              <span>Total</span>
              <span className="text-amber-600">{formatCurrency(current.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12 text-base font-semibold border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-400"
            onClick={handleCancel}
            disabled={cancelling || accepting}
          >
            <X className="h-5 w-5 mr-2" />
            {cancelling ? "Cancelling…" : "Cancel Order"}
          </Button>
          <Button
            className="h-12 text-base font-semibold bg-green-600 hover:bg-green-700 text-white"
            onClick={handleAccept}
            disabled={accepting || cancelling}
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            {accepting ? "Accepting…" : "Accept Order"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
