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
  Truck,
  MessageSquare,
  Plus,
  ChevronRight,
  Package,
  Loader2,
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
  const { setCustomerPage, setSelectedOrderId, currentBusinessId, currentStoreId } = useAdminStore()
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

  const createOrderMutation = useCreateOrder()
  const { checkout: razorpayCheckout, isProcessing: razorpayProcessing } = useRazorpayCheckout()

  useEffect(() => {
    if (currentBusinessId) setBusinessContext(currentBusinessId)
  }, [currentBusinessId])

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
            onSuccess: (paymentId, _orderId) => {
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
        <h1 className="text-lg font-bold text-gray-900">Checkout</h1>
      </div>

      {/* Delivery Address */}
      <div className="px-4 mb-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-gray-900">Delivery Address</span>
            </div>
            <button
              onClick={() => setCustomerPage("addresses")}
              className="text-xs text-emerald-600 font-medium flex items-center gap-0.5"
            >
              Change <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {activeAddress && (
            <div
              className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                selectedAddress === activeAddress.id
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-gray-200"
              }`}
              onClick={() => setSelectedAddress(activeAddress.id)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0 h-4">
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
                    className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedAddress === addr.id
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-gray-200"
                    }`}
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
      </div>

      {/* Payment Method */}
      <div className="px-4 mb-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-emerald-600" />
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
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                    paymentMethod === method.id
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-gray-200"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      paymentMethod === method.id ? "bg-emerald-100" : "bg-gray-100"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${paymentMethod === method.id ? "text-emerald-600" : "text-gray-500"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-800">{method.label}</p>
                    <p className="text-[10px] text-gray-400">{method.desc}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      paymentMethod === method.id ? "border-emerald-500" : "border-gray-300"
                    }`}
                  >
                    {paymentMethod === method.id && (
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
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
            <MessageSquare className="w-4 h-4 text-emerald-600" />
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
            <Package className="w-4 h-4 text-emerald-600" />
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
                <span className="text-xs text-emerald-600">Savings</span>
                <span className="text-xs text-emerald-600">-{formatPrice(totalSavings)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Delivery</span>
              <span className={`text-xs ${deliveryFee === 0 ? "text-emerald-600" : ""}`}>
                {deliveryFee === 0 ? "FREE" : formatPrice(deliveryFee)}
              </span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600">Coupon ({couponCode})</span>
                <span className="text-xs text-emerald-600">-{formatPrice(couponDiscount)}</span>
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
          className="w-full h-12 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400"
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
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
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
                className="flex-1 h-10 rounded-xl text-xs bg-emerald-500 hover:bg-emerald-600"
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
