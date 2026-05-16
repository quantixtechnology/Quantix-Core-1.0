"use client"

import React, { useState, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useAuthStore } from "@/stores/auth-store"
import { useCreateOrder } from "@/hooks/use-api"
import { useRazorpayCheckout } from "@/hooks/use-razorpay"
import { setBusinessContext } from "@/lib/api-client"
import { showSuccess, showError, showApiError } from "@/lib/toast-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  MapPin,
  CreditCard,
  Smartphone,
  Banknote,
  CheckCircle2,
  MessageSquare,
  ChevronRight,
  Package,
  Loader2,
  AlertTriangle,
  Store,
} from "lucide-react"

// STORE_ID resolved dynamically from admin store (set by StorefrontParamDetector or store selection)

// Local address data (can be replaced with API later)
const defaultAddresses = [
  {
    id: "addr_1",
    label: "Home",
    line1: "402, Prestige Shantiniketan, Whitefield",
    line2: "Near ITPL Road",
    city: "Bengaluru",
    pincode: "560048",
    isDefault: true,
  },
  {
    id: "addr_2",
    label: "Office",
    line1: "512, Embassy Tech Village, Outer Ring Road",
    line2: "Tower B, 13th Floor",
    city: "Bengaluru",
    pincode: "560103",
    isDefault: false,
  },
]

export function CustomerCheckout() {
  const { setCustomerPage, setSelectedOrderId, currentBusinessId, currentStoreId, currentStoreName, currentBusinessPrimaryColor } = useAdminStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"
  const {
    items,
    storeId: cartStoreId,
    subtotal: getSubtotal,
    deliveryFee: getDeliveryFee,
    total: getTotal,
    couponCode,
    couponDiscount,
    totalSavings: getTotalSavings,
    clearCart,
  } = useCartStore()
  const { user } = useAuthStore()

  const subtotal = getSubtotal()
  const deliveryFee = getDeliveryFee()
  const total = getTotal()
  const totalSavings = getTotalSavings()

  const [selectedAddress, setSelectedAddress] = useState(defaultAddresses[0]?.id || "")
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "cod">("upi")
  const [deliveryInstructions, setDeliveryInstructions] = useState("")
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [zoneWarning, setZoneWarning] = useState<string | null>(null)
  const [validatingZone, setValidatingZone] = useState(false)

  const createOrderMutation = useCreateOrder()
  const { checkout: razorpayCheckout, isProcessing: razorpayProcessing } = useRazorpayCheckout()

  useEffect(() => {
    if (currentBusinessId) setBusinessContext(currentBusinessId)
  }, [currentBusinessId])

  // Validate delivery pincode against store's delivery zones
  useEffect(() => {
    const addr = defaultAddresses.find((a) => a.id === selectedAddress)
    if (!addr?.pincode || !currentBusinessId) {
      setZoneWarning(null)
      return
    }
    setValidatingZone(true)
    fetch(
      `/api/core/storefront/nearest-store?businessId=${encodeURIComponent(currentBusinessId)}&pincode=${encodeURIComponent(addr.pincode)}`
    )
      .then((r) => r.json())
      .then((json) => {
        if (!json.success || !json.serviceable) {
          setZoneWarning("Delivery may not be available to this pincode. Our team will confirm after order placement.")
        } else {
          setZoneWarning(null)
        }
      })
      .catch(() => setZoneWarning(null))
      .finally(() => setValidatingZone(false))
  }, [selectedAddress, currentBusinessId])

  const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`

  const handlePlaceOrder = async () => {
    if (items.length === 0) return

    setPlacing(true)

    try {
      // Build order items from cart
      const orderItems = items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      }))

      // Determine payment method for API
      const apiPaymentMethod = paymentMethod === "cod" ? "COD" as const : "UPI" as const

      // Create order via API
      const orderData = {
        storeId: cartStoreId || currentStoreId,
        orderType: "DELIVERY" as const,
        paymentMethod: apiPaymentMethod,
        customerId: user?.id,
        customerName: user?.name || undefined,
        customerPhone: user?.email || undefined,
        deliveryAddressId: selectedAddress,
        deliveryInstructions: deliveryInstructions || undefined,
        items: orderItems,
        promoCodeId: couponCode || undefined,
      }

      const result = await createOrderMutation.mutateAsync(orderData)

      const orderId = (result.data as unknown as Record<string, unknown>)?.id as string || `order_${Date.now()}`
      setCreatedOrderId(orderId)

      // Handle payment
      if (paymentMethod === "upi" || paymentMethod === "card") {
        try {
          await razorpayCheckout({
            orderId,
            amount: total,
            customerName: user?.name || undefined,
            customerEmail: user?.email || undefined,
            customerPhone: undefined,
            onSuccess: (_paymentId, _orderId) => {
              showSuccess("Payment successful!", "Your order has been placed and payment confirmed.")
              setOrderPlaced(true)
              setPlacing(false)
            },
            onFailure: (error) => {
              showError("Payment failed", error)
              // Order was created but payment failed — still show success with COD fallback
              setOrderPlaced(true)
              setPlacing(false)
            },
          })
        } catch {
          // Razorpay failed/cancelled — order still created, switch to COD
          showSuccess("Order placed!", "Payment will be collected on delivery (COD).")
          setOrderPlaced(true)
          setPlacing(false)
        }
      } else {
        // COD — order already created
        setOrderPlaced(true)
        setPlacing(false)
      }
    } catch (error) {
      setPlacing(false)
      showApiError(error)
    }
  }

  const handleOrderSuccess = () => {
    setOrderPlaced(false)
    if (createdOrderId) {
      setSelectedOrderId(createdOrderId)
    }
    clearCart()
    setCustomerPage("order-tracking")
  }

  const activeAddress = defaultAddresses.find((a) => a.id === selectedAddress) || defaultAddresses[0]

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <button
          onClick={() => setCustomerPage("cart")}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900">Checkout</h1>
          {currentStoreName && (
            <div className="flex items-center gap-1 mt-0.5">
              <Store className="w-3 h-3 shrink-0" style={{ color: brandColor }} />
              <span className="text-[10px] text-gray-500 truncate">Delivering from <span className="font-semibold text-gray-700">{currentStoreName}</span></span>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Address */}
      <div className="px-4 mb-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" style={{ color: brandColor }} />
              <span className="text-sm font-bold text-gray-900">Delivery Address</span>
            </div>
            <button
              onClick={() => setCustomerPage("addresses")}
              className="text-xs font-medium flex items-center gap-0.5" style={{ color: brandColor }}
            >
              Change <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {activeAddress && (
            <div
              className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                selectedAddress === activeAddress.id
                  ? "border-gray-200"
                  : "border-gray-200"
              }`}
              style={selectedAddress === activeAddress.id ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : undefined}
              onClick={() => setSelectedAddress(activeAddress.id)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Badge className="text-white text-[9px] px-1.5 py-0 h-4" style={{ backgroundColor: brandColor }}>
                  {activeAddress.label}
                </Badge>
                {activeAddress.isDefault && (
                  <span className="text-[10px] text-gray-400">Default</span>
                )}
              </div>
              <p className="text-xs text-gray-700">{activeAddress.line1}</p>
              <p className="text-xs text-gray-500">
                {activeAddress.line2}, {activeAddress.city} - {activeAddress.pincode}
              </p>
            </div>
          )}
          {defaultAddresses.length > 1 && (
            <div className="mt-2 space-y-2">
              {defaultAddresses
                .filter((a) => a.id !== activeAddress?.id)
                .map((addr) => (
                  <div
                    key={addr.id}
                    className="p-3 rounded-lg border transition-colors cursor-pointer border-gray-200"
                    style={selectedAddress === addr.id ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : undefined}
                    onClick={() => setSelectedAddress(addr.id)}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                        {addr.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-700">{addr.line1}</p>
                    <p className="text-xs text-gray-500">
                      {addr.line2}, {addr.city} - {addr.pincode}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Zone validation feedback */}
        {validatingZone && (
          <div className="flex items-center gap-2 px-1">
            <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
            <span className="text-[10px] text-gray-400">Checking delivery availability…</span>
          </div>
        )}
        {!validatingZone && zoneWarning && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">{zoneWarning}</p>
          </div>
        )}
      </div>

      {/* Payment Method */}
      <div className="px-4 mb-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4" style={{ color: brandColor }} />
            <span className="text-sm font-bold text-gray-900">Payment Method</span>
          </div>
          <div className="space-y-2">
            {[
              { id: "upi" as const, label: "UPI", desc: "Google Pay, PhonePe, Paytm", icon: Smartphone },
              { id: "card" as const, label: "Card", desc: "Credit or Debit Card", icon: CreditCard },
              { id: "cod" as const, label: "Cash on Delivery", desc: "Pay when you receive", icon: Banknote },
            ].map((method) => {
              const Icon = method.icon
              return (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left border-gray-200"
                  style={paymentMethod === method.id ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : undefined}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={paymentMethod === method.id ? { backgroundColor: `${brandColor}20` } : { backgroundColor: '#f3f4f6' }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={paymentMethod === method.id ? { color: brandColor } : { color: '#6b7280' }}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-800">{method.label}</p>
                    <p className="text-[10px] text-gray-400">{method.desc}</p>
                  </div>
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                    style={paymentMethod === method.id ? { borderColor: brandColor } : { borderColor: '#d1d5db' }}
                  >
                    {paymentMethod === method.id && (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandColor }} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Delivery Instructions */}
      <div className="px-4 mb-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4" style={{ color: brandColor }} />
            <span className="text-sm font-bold text-gray-900">Delivery Instructions</span>
          </div>
          <Input
            placeholder="E.g. Ring the bell twice, leave at door..."
            value={deliveryInstructions}
            onChange={(e) => setDeliveryInstructions(e.target.value)}
            className="h-9 text-xs rounded-lg border-gray-200"
          />
        </div>
      </div>

      {/* Order Summary */}
      <div className="px-4 mb-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4" style={{ color: brandColor }} />
            <span className="text-sm font-bold text-gray-900">Order Summary</span>
          </div>
          <div className="space-y-2 mb-3">
            {items.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="flex items-center justify-between">
                <span className="text-xs text-gray-600 truncate flex-1">
                  {item.name} × {item.quantity}
                </span>
                <span className="text-xs font-medium ml-2">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Subtotal</span>
              <span className="text-xs">{formatPrice(subtotal)}</span>
            </div>
            {totalSavings > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: brandColor }}>Savings</span>
                <span className="text-xs" style={{ color: brandColor }}>-{formatPrice(totalSavings)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Delivery</span>
              <span className="text-xs" style={deliveryFee === 0 ? { color: brandColor } : undefined}>
                {deliveryFee === 0 ? "FREE" : formatPrice(deliveryFee)}
              </span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: brandColor }}>Coupon ({couponCode})</span>
                <span className="text-xs" style={{ color: brandColor }}>-{formatPrice(couponDiscount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-bold">Total</span>
              <span className="text-lg font-bold">{formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Place Order */}
      <div className="px-4">
        <Button
          onClick={handlePlaceOrder}
          disabled={placing || razorpayProcessing || items.length === 0}
          className="w-full h-12 text-sm font-bold rounded-xl text-white disabled:bg-gray-200 disabled:text-gray-400"
          style={{ backgroundColor: brandColor }}
        >
          {placing || razorpayProcessing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {razorpayProcessing ? "Processing payment..." : "Placing Order..."}
            </span>
          ) : (
            `Place Order — ${formatPrice(total)}`
          )}
        </Button>
      </div>

      {/* Success Dialog */}
      <Dialog open={orderPlaced} onOpenChange={setOrderPlaced}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Order Placed</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${brandColor}20` }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: brandColor }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Order Placed!</h2>
            <p className="text-sm text-gray-500 mb-1">Your order has been confirmed</p>
            <p className="text-xs text-gray-400 mb-4">
              Estimated delivery in 30-45 minutes
            </p>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={() => {
                  setOrderPlaced(false)
                  clearCart()
                  setCustomerPage("home")
                }}
                className="flex-1 h-10 rounded-xl text-xs"
              >
                Continue Shopping
              </Button>
              <Button
                onClick={handleOrderSuccess}
                className="flex-1 h-10 rounded-xl text-xs text-white"
                style={{ backgroundColor: brandColor }}
              >
                Track Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
