"use client"

import React, { useState, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useAuthStore } from "@/stores/auth-store"
import { useCreateOrder } from "@/hooks/use-api"
import { useRazorpayCheckout } from "@/hooks/use-razorpay"
import { setBusinessContext, customerApi } from "@/lib/api-client"
import { showSuccess, showError, showApiError } from "@/lib/toast-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft, MapPin, CreditCard, Smartphone, Banknote, CheckCircle2,
  MessageSquare, ChevronRight, Package, Loader2, AlertTriangle, Store,
  Clock, Tag, Plus, Calendar, FileText,
} from "lucide-react"

interface SavedAddress {
  id: string
  label: string
  line1: string
  line2?: string
  city: string
  pincode: string
  isDefault?: boolean
}

// Delivery slot definition
interface Slot { id: string; label: string; time: string; available: boolean }

const TODAY = new Date()
const TOMORROW = new Date(TODAY); TOMORROW.setDate(TODAY.getDate() + 1)
const DAY_AFTER = new Date(TODAY); DAY_AFTER.setDate(TODAY.getDate() + 2)

const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })

const SLOTS: Slot[] = [
  { id: "now",  label: "Express",  time: "45–90 min",         available: true },
  { id: "am",   label: "Morning",  time: "8:00 – 11:00 AM",   available: true },
  { id: "noon", label: "Noon",     time: "11:00 AM – 2:00 PM",available: true },
  { id: "eve",  label: "Evening",  time: "2:00 – 6:00 PM",    available: true },
  { id: "night",label: "Night",    time: "6:00 – 9:00 PM",    available: true },
]

export function CustomerCheckout() {
  const {
    setCustomerPage, setSelectedOrderId,
    currentBusinessId, currentStoreId, currentStoreName, currentBusinessPrimaryColor,
  } = useAdminStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"
  const {
    items, storeId: cartStoreId,
    subtotal: getSubtotal, deliveryFee: getDeliveryFee, total: getTotal,
    couponCode, couponDiscount, totalSavings: getTotalSavings, clearCart,
  } = useCartStore()
  const { user } = useAuthStore()

  const subtotal    = getSubtotal()
  const deliveryFee = getDeliveryFee()
  const total       = getTotal()
  const totalSavings = getTotalSavings()

  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [addrLoading, setAddrLoading] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "cod">("upi")
  const [deliveryInstructions, setDeliveryInstructions] = useState("")
  const [orderPlaced, setOrderPlaced]     = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [placing, setPlacing]             = useState(false)
  const [zoneWarning, setZoneWarning]     = useState<string | null>(null)
  const [validatingZone, setValidatingZone] = useState(false)
  const [couponInput, setCouponInput]     = useState("")
  const [couponApplying, setCouponApplying] = useState(false)
  const [wantGstInvoice, setWantGstInvoice] = useState(false)
  const [gstInvoiceNumber, setGstInvoiceNumber] = useState("")

  // Delivery slot selection
  const [selectedDate, setSelectedDate] = useState<"today" | "tomorrow" | "day_after">("today")
  const [selectedSlot, setSelectedSlot]   = useState<string>("now")

  const createOrderMutation = useCreateOrder()
  const { checkout: razorpayCheckout, isProcessing: razorpayProcessing } = useRazorpayCheckout()

  useEffect(() => {
    if (currentBusinessId) setBusinessContext(currentBusinessId)
  }, [currentBusinessId])

  // Load customer addresses from API
  useEffect(() => {
    if (!user?.id) return
    setAddrLoading(true)
    customerApi.get(user.id)
      .then((res) => {
        const customer = res.data as unknown as Record<string, unknown>
        const saved = Array.isArray(customer?.addresses)
          ? (customer.addresses as Record<string, unknown>[]).map((a, i) => ({
              id:       (a.id as string) || `addr_${i}`,
              label:    (a.label as string) || "Home",
              line1:    (a.line1 as string) || (a.address as string) || "",
              line2:    (a.line2 as string) || "",
              city:     (a.city as string) || "",
              pincode:  (a.pincode as string) || "",
              isDefault:(a.isDefault as boolean) || i === 0,
            }))
          : []
        if (saved.length > 0) {
          setAddresses(saved)
          const def = saved.find((a) => a.isDefault) || saved[0]
          setSelectedAddress(def.id)
        }
      })
      .catch(() => { /* use empty — customer can add via Change button */ })
      .finally(() => setAddrLoading(false))
  }, [user?.id])

  // Validate delivery pincode
  useEffect(() => {
    const addr = addresses.find((a) => a.id === selectedAddress)
    if (!addr?.pincode || !currentBusinessId) { setZoneWarning(null); return }
    setValidatingZone(true)
    fetch(`/api/core/storefront/nearest-store?businessId=${encodeURIComponent(currentBusinessId)}&pincode=${encodeURIComponent(addr.pincode)}`)
      .then((r) => r.json())
      .then((json) => {
        setZoneWarning(!json.success || !json.serviceable
          ? "Delivery may not be available to this pincode. Our team will confirm after order placement."
          : null)
      })
      .catch(() => setZoneWarning(null))
      .finally(() => setValidatingZone(false))
  }, [selectedAddress, currentBusinessId, addresses])

  const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return
    setCouponApplying(true)
    await new Promise((r) => setTimeout(r, 600))  // placeholder until coupon API is wired
    showError("Invalid coupon", "This coupon code is not valid or has expired.")
    setCouponApplying(false)
  }

  const buildDeliverySlotLabel = () => {
    const dateLabel = selectedDate === "today" ? fmtDate(TODAY)
      : selectedDate === "tomorrow" ? fmtDate(TOMORROW) : fmtDate(DAY_AFTER)
    const slot = SLOTS.find((s) => s.id === selectedSlot)
    return slot?.id === "now" ? "Express Delivery (45–90 min)" : `${dateLabel} · ${slot?.time}`
  }

  const handlePlaceOrder = async () => {
    if (items.length === 0) return
    setPlacing(true)
    try {
      const orderItems = items.map((item) => ({
        productId: item.productId, variantId: item.variantId, quantity: item.quantity,
      }))
      const apiPaymentMethod = paymentMethod === "cod" ? "COD" as const : "UPI" as const
      const slotNote = buildDeliverySlotLabel()
      const orderData = {
        storeId: cartStoreId || currentStoreId,
        orderType: "DELIVERY" as const,
        paymentMethod: apiPaymentMethod,
        customerId: user?.id,
        customerName: user?.name || undefined,
        customerPhone: user?.email || undefined,
        deliveryAddressId: selectedAddress || undefined,
        deliveryInstructions: [slotNote, deliveryInstructions].filter(Boolean).join(" | ") || undefined,
        items: orderItems,
        promoCodeId: couponCode || undefined,
        ...(wantGstInvoice && gstInvoiceNumber ? { notes: `GST: ${gstInvoiceNumber}` } : {}),
      }

      const result = await createOrderMutation.mutateAsync(orderData)
      const orderId = (result.data as unknown as Record<string, unknown>)?.id as string || `order_${Date.now()}`
      setCreatedOrderId(orderId)

      if (paymentMethod === "upi" || paymentMethod === "card") {
        try {
          await razorpayCheckout({
            orderId, amount: total,
            customerName: user?.name || undefined,
            customerEmail: user?.email || undefined,
            customerPhone: undefined,
            onSuccess: (_pid, _oid) => { showSuccess("Payment successful!", "Order placed."); setOrderPlaced(true); setPlacing(false) },
            onFailure: (error) => { showError("Payment failed", error); setOrderPlaced(true); setPlacing(false) },
          })
        } catch {
          showSuccess("Order placed!", "Payment will be collected on delivery.")
          setOrderPlaced(true); setPlacing(false)
        }
      } else {
        setOrderPlaced(true); setPlacing(false)
      }
    } catch (error) {
      setPlacing(false); showApiError(error)
    }
  }

  const handleOrderSuccess = () => {
    setOrderPlaced(false)
    if (createdOrderId) setSelectedOrderId(createdOrderId)
    clearCart()
    setCustomerPage("order-tracking")
  }

  const activeAddress = addresses.find((a) => a.id === selectedAddress) || addresses[0]

  const DATES = [
    { id: "today" as const,     label: "Today",      sub: fmtDate(TODAY) },
    { id: "tomorrow" as const,  label: "Tomorrow",   sub: fmtDate(TOMORROW) },
    { id: "day_after" as const, label: "Day After",  sub: fmtDate(DAY_AFTER) },
  ]

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <button onClick={() => setCustomerPage("cart")} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900">Checkout</h1>
          {currentStoreName && (
            <div className="flex items-center gap-1 mt-0.5">
              <Store className="w-3 h-3 shrink-0" style={{ color: brandColor }} />
              <span className="text-[10px] text-gray-500 truncate">
                Delivering from <span className="font-semibold text-gray-700">{currentStoreName}</span>
              </span>
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
            <button onClick={() => setCustomerPage("addresses")} className="text-xs font-medium flex items-center gap-0.5" style={{ color: brandColor }}>
              {addresses.length === 0 ? "Add address" : "Change"} <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {addrLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="text-xs text-gray-400">Loading addresses…</span>
            </div>
          ) : addresses.length === 0 ? (
            <button
              onClick={() => setCustomerPage("addresses")}
              className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-gray-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add delivery address
            </button>
          ) : (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="p-3 rounded-lg border cursor-pointer transition-colors"
                  style={selectedAddress === addr.id ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : { borderColor: '#e5e7eb' }}
                  onClick={() => setSelectedAddress(addr.id)}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge className="text-white text-[9px] px-1.5 py-0 h-4" style={{ backgroundColor: brandColor }}>
                      {addr.label}
                    </Badge>
                    {addr.isDefault && <span className="text-[10px] text-gray-400">Default</span>}
                  </div>
                  <p className="text-xs text-gray-700">{addr.line1}</p>
                  <p className="text-xs text-gray-500">{[addr.line2, addr.city, addr.pincode].filter(Boolean).join(", ")}</p>
                </div>
              ))}
            </div>
          )}
        </div>

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

      {/* Delivery Slot */}
      <div className="px-4 mb-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4" style={{ color: brandColor }} />
            <span className="text-sm font-bold text-gray-900">Delivery Slot</span>
          </div>
          {/* Date tabs */}
          <div className="flex gap-2 mb-3">
            {DATES.map((d) => (
              <button
                key={d.id}
                onClick={() => { setSelectedDate(d.id); if (d.id !== "today") setSelectedSlot("am") }}
                className="flex-1 flex flex-col items-center py-2 rounded-lg border text-xs transition-all"
                style={selectedDate === d.id ? { borderColor: brandColor, backgroundColor: `${brandColor}10`, color: brandColor } : { borderColor: '#e5e7eb', color: '#6b7280' }}
              >
                <span className="font-semibold text-[11px]">{d.label}</span>
                <span className="text-[9px] opacity-70 mt-0.5">{d.sub}</span>
              </button>
            ))}
          </div>
          {/* Slot chips */}
          <div className="flex flex-wrap gap-2">
            {SLOTS.filter((s) => selectedDate !== "today" ? s.id !== "now" : true).map((slot) => (
              <button
                key={slot.id}
                onClick={() => setSelectedSlot(slot.id)}
                className="flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all"
                style={selectedSlot === slot.id ? { borderColor: brandColor, backgroundColor: `${brandColor}10` } : { borderColor: '#e5e7eb' }}
              >
                <span className="text-[11px] font-semibold" style={selectedSlot === slot.id ? { color: brandColor } : { color: '#374151' }}>
                  {slot.label}
                </span>
                <span className="text-[10px] text-gray-400">{slot.time}</span>
              </button>
            ))}
          </div>
        </div>
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
              { id: "upi" as const,  label: "UPI",               desc: "Google Pay, PhonePe, Paytm", icon: Smartphone },
              { id: "card" as const, label: "Card",              desc: "Credit or Debit Card",        icon: CreditCard },
              { id: "cod" as const,  label: "Cash on Delivery",  desc: "Pay when you receive",        icon: Banknote   },
            ].map((method) => {
              const Icon = method.icon; const active = paymentMethod === method.id
              return (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left"
                  style={active ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : { borderColor: '#e5e7eb' }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={active ? { backgroundColor: `${brandColor}20` } : { backgroundColor: '#f3f4f6' }}>
                    <Icon className="w-4 h-4" style={active ? { color: brandColor } : { color: '#6b7280' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-800">{method.label}</p>
                    <p className="text-[10px] text-gray-400">{method.desc}</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={active ? { borderColor: brandColor } : { borderColor: '#d1d5db' }}>
                    {active && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandColor }} />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Coupon Code */}
      <div className="px-4 mb-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4" style={{ color: brandColor }} />
            <span className="text-sm font-bold text-gray-900">Coupon Code</span>
          </div>
          {couponCode ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-xs text-green-700 font-medium">{couponCode} applied — saving {formatPrice(couponDiscount)}</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Enter coupon code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                className="h-9 text-xs rounded-lg border-gray-200 flex-1 uppercase"
              />
              <Button
                onClick={handleApplyCoupon}
                disabled={!couponInput.trim() || couponApplying}
                className="h-9 px-4 text-xs rounded-lg text-white"
                style={{ backgroundColor: brandColor }}
              >
                {couponApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
              </Button>
            </div>
          )}
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

      {/* GST Invoice */}
      <div className="px-4 mb-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <button
            onClick={() => setWantGstInvoice((v) => !v)}
            className="w-full flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brandColor}10` }}>
              <FileText className="w-4 h-4" style={{ color: brandColor }} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-800">GST Invoice</p>
              <p className="text-[10px] text-gray-400">For business purchases</p>
            </div>
            <div
              className={`w-10 h-5 rounded-full transition-colors relative ${wantGstInvoice ? "" : "bg-gray-200"}`}
              style={wantGstInvoice ? { backgroundColor: brandColor } : undefined}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${wantGstInvoice ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </div>
          </button>
          {wantGstInvoice && (
            <div className="mt-3">
              <Input
                placeholder="Enter your GST number (e.g. 22AAAAA0000A1Z5)"
                value={gstInvoiceNumber}
                onChange={(e) => setGstInvoiceNumber(e.target.value.toUpperCase())}
                className="h-9 text-xs rounded-lg border-gray-200"
                maxLength={15}
              />
            </div>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <div className="px-4 mb-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4" style={{ color: brandColor }} />
            <span className="text-sm font-bold text-gray-900">Order Summary</span>
          </div>
          {/* Delivery slot summary */}
          <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[11px] text-gray-600">{buildDeliverySlotLabel()}</span>
          </div>
          <div className="space-y-2 mb-3">
            {items.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="flex items-center justify-between">
                <span className="text-xs text-gray-600 truncate flex-1">
                  {item.name} × {item.quantity}
                  {item.variantName && <span className="text-gray-400 ml-1">({item.variantName})</span>}
                </span>
                <span className="text-xs font-medium ml-2">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between"><span className="text-xs text-gray-500">Subtotal</span><span className="text-xs">{formatPrice(subtotal)}</span></div>
            {totalSavings > 0 && (
              <div className="flex justify-between"><span className="text-xs" style={{ color: brandColor }}>Savings</span><span className="text-xs" style={{ color: brandColor }}>-{formatPrice(totalSavings)}</span></div>
            )}
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Delivery</span>
              <span className="text-xs" style={deliveryFee === 0 ? { color: brandColor } : undefined}>
                {deliveryFee === 0 ? "FREE" : formatPrice(deliveryFee)}
              </span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between"><span className="text-xs" style={{ color: brandColor }}>Coupon ({couponCode})</span><span className="text-xs" style={{ color: brandColor }}>-{formatPrice(couponDiscount)}</span></div>
            )}
            <Separator />
            <div className="flex justify-between pt-1">
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
          disabled={placing || razorpayProcessing || items.length === 0 || (addresses.length > 0 && !selectedAddress)}
          className="w-full h-12 text-sm font-bold rounded-xl text-white disabled:bg-gray-200 disabled:text-gray-400"
          style={{ backgroundColor: brandColor }}
        >
          {placing || razorpayProcessing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {razorpayProcessing ? "Processing payment..." : "Placing Order..."}
            </span>
          ) : `Place Order — ${formatPrice(total)}`}
        </Button>
        {addresses.length === 0 && (
          <p className="text-[11px] text-center text-amber-600 mt-2">Add a delivery address to continue</p>
        )}
      </div>

      {/* Success Dialog */}
      <Dialog open={orderPlaced} onOpenChange={setOrderPlaced}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader><DialogTitle className="sr-only">Order Placed</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center py-4 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${brandColor}20` }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: brandColor }} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Order Placed!</h2>
            <p className="text-sm text-gray-500 mb-1">Your order has been confirmed</p>
            <p className="text-xs text-gray-400 mb-4">{buildDeliverySlotLabel()}</p>
            <div className="flex gap-3 w-full">
              <Button variant="outline" onClick={() => { setOrderPlaced(false); clearCart(); setCustomerPage("home") }} className="flex-1 h-10 rounded-xl text-xs">
                Continue Shopping
              </Button>
              <Button onClick={handleOrderSuccess} className="flex-1 h-10 rounded-xl text-xs text-white" style={{ backgroundColor: brandColor }}>
                Track Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
