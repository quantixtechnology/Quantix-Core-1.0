"use client"

import { useState, useEffect, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import type { DeliveryAddress } from "@/stores/cart-store"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store";
import {
  ArrowLeft, MapPin, Plus, Loader2, CheckCircle2, CreditCard,
  User, Phone as PhoneIcon, Check, LogIn, UserX, Lock, Store, ChevronDown,
} from "lucide-react"
import { formatINR } from "@/lib/currency"
import { resolveImageUrl } from "@/lib/image-url"
import { formatAddressLine, shortAddressLabel } from "@/lib/delivery-address"
import type { WebNav } from "./storefront-website"

interface Address {
  id: string
  label?: string | null
  area?: string | null
  addressLine1: string
  addressLine2?: string | null
  landmark?: string | null
  city: string
  state: string
  pincode: string
  instructions?: string | null
  isDefault: boolean
  latitude?: number | null
  longitude?: number | null
}

interface StorefrontCheckoutProps {
  brandColor: string
  nav: WebNav
  onOpenAddressSheet: () => void
  storeClosed?: boolean
  storeClosedMessage?: string
}

type CheckoutStep = "choose" | "form"

const emptyGuest = () => ({
  name: "", phone: "",
})

interface NearestStoreInfo {
  id: string
  name: string
  distance?: number | null
}

interface ServiceabilityState {
  loading: boolean
  serviceable: boolean | null
  reason?: string
  nearest?: NearestStoreInfo | null
}

export function StorefrontCheckout({ brandColor, nav, onOpenAddressSheet, storeClosed = false, storeClosedMessage }: StorefrontCheckoutProps) {
  const { currentBusinessId } = useAdminStore()
  const { items, subtotal, storeDeliveryFee, couponDiscount, paymentGateways, clearCart, deliveryAddress, assignedStore, setDeliveryAddress, assignStore, clearAssignedStore } = useCartStore()
  const { isAuthenticated, user, token } = useAuthStore()

  const rawSubtotal = subtotal()
  const baseFee = assignedStore?.deliveryFee != null ? assignedStore.deliveryFee : (storeDeliveryFee ?? 0)
  const deliveryFee = (assignedStore?.freeDeliveryAbove && rawSubtotal >= assignedStore.freeDeliveryAbove) ? 0 : baseFee
  const discount = couponDiscount || 0
  const total = Math.round(rawSubtotal + deliveryFee - discount)

  const minOrderAmount = assignedStore?.minOrderAmount ?? 0
  const belowMinOrder = minOrderAmount > 0 && rawSubtotal < minOrderAmount

  const [allowGuest, setAllowGuest] = useState<boolean | null>(null)
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>(isAuthenticated ? "form" : "choose")
  const [isGuestMode, setIsGuestMode] = useState(false)

  // Authenticated saved-address quick picks (the header sheet is the canonical
  // address entry — selecting here just populates the same cart deliveryAddress).
  const [addresses, setAddresses] = useState<Address[]>([])

  // Guest contact
  const [guest, setGuest] = useState(emptyGuest())

  // Serviceability — the SELECTED DELIVERY ADDRESS drives store assignment.
  const [svc, setSvc] = useState<ServiceabilityState>({ loading: false, serviceable: null })

  // Payment & order
  const [paymentMethod, setPaymentMethod] = useState("COD")
  const [placing, setPlacing] = useState(false)
  const [orderError, setOrderError] = useState("")
  const [orderId, setOrderId] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState("")

  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/core/storefront/store-context?businessId=${currentBusinessId}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setAllowGuest(j.data?.allowGuestCheckout !== false); else setAllowGuest(true) })
      .catch(() => setAllowGuest(true))
  }, [currentBusinessId])

  useEffect(() => {
    if (isAuthenticated) { setCheckoutStep("form"); setIsGuestMode(false) }
  }, [isAuthenticated])

  const fetchAddresses = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/core/storefront/addresses", { headers: { Authorization: `Bearer ${token}`, "x-business-id": currentBusinessId || "" } })
      const data = await res.json()
      if (data.success && data.data?.length) setAddresses(data.data)
    } catch { /* non-critical */ }
  }, [token])

  useEffect(() => { if (isAuthenticated) fetchAddresses() }, [isAuthenticated, fetchAddresses])

  // ── Run the shared serviceability engine whenever the delivery address
  //    (or cart subtotal, for free-delivery) changes. Never device GPS.
  useEffect(() => {
    if (!currentBusinessId || !deliveryAddress) {
      setSvc({ loading: false, serviceable: null })
      return
    }
    const a = deliveryAddress
    if (typeof a.latitude !== "number" || typeof a.longitude !== "number") {
      setSvc({ loading: false, serviceable: null, reason: "Set the exact location (map / GPS) so we can find the nearest store." })
      clearAssignedStore()
      return
    }
    let cancelled = false
    setSvc({ loading: true, serviceable: null })
    const body: Record<string, unknown> = { orderAmount: Math.round(rawSubtotal * 100) / 100 }
    if (a.id) body.addressId = a.id
    else { body.lat = a.latitude; body.lng = a.longitude }

    fetch("/api/core/storefront/serviceability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (!j.success) {
          setSvc({ loading: false, serviceable: false, reason: j.error || "Could not check delivery for this address." })
          clearAssignedStore()
          return
        }
        const d = j.data
        const nearest = d.nearestStore
        if (!d.serviceable || !nearest) {
          setSvc({ loading: false, serviceable: false, reason: d.reason || "We don't deliver to this address yet.", nearest })
          clearAssignedStore()
          return
        }
        setSvc({ loading: false, serviceable: true, nearest })
        assignStore({
          id: nearest.id,
          kind: nearest.kind || "store",
          name: nearest.name,
          distanceKm: d.distance ?? nearest.distance ?? null,
          serviceable: true,
          deliveryFee: d.deliveryFee ?? nearest.deliveryFee ?? null,
          freeDeliveryAbove: d.freeDeliveryAbove ?? nearest.freeDeliveryAbove ?? null,
          minOrderAmount: d.minOrderAmount ?? nearest.minOrderAmount ?? null,
          preparationTime: nearest.preparationTime ?? null,
          latitude: nearest.latitude ?? null,
          longitude: nearest.longitude ?? null,
          matchedZoneId: d.matchedZoneId ?? null,
          matchedZoneName: d.matchedZoneName ?? null,
        })
      })
      .catch(() => {
        if (cancelled) return
        setSvc({ loading: false, serviceable: false, reason: "Could not check delivery for this address. Please try again." })
        clearAssignedStore()
      })
    return () => { cancelled = true }
  }, [currentBusinessId, deliveryAddress, rawSubtotal, assignStore, clearAssignedStore])

  const chooseSavedAddress = (row: Address) => {
    setDeliveryAddress({
      id: row.id,
      label: row.label,
      area: row.area,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      landmark: row.landmark,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      instructions: row.instructions,
      latitude: row.latitude,
      longitude: row.longitude,
    })
  }

  if (items.length === 0 && !orderId) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-5xl">🛒</div>
        <h2 className="text-lg font-bold text-gray-900">Your cart is empty</h2>
        <button onClick={() => nav.go("home")} className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: brandColor }}>
          Shop Now
        </button>
      </div>
    )
  }

  if (orderId) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h2>
          <p className="text-gray-500 mb-1">Your order has been received.</p>
          <p className="text-sm font-mono font-bold text-gray-700 mb-8">{orderNumber}</p>
          {isAuthenticated && (
            <button onClick={() => nav.go("order-tracking", { orderId })} className="w-full h-12 text-white font-bold text-sm rounded-xl mb-3" style={{ backgroundColor: brandColor }}>
              Track Order
            </button>
          )}
          <button onClick={() => nav.go("home")} className="w-full h-12 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl">
            Continue Shopping
          </button>
        </div>
      </div>
    )
  }

  if (checkoutStep === "choose") {
    const guestAllowed = allowGuest !== false
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <button onClick={() => nav.goBack("home")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="text-3xl mb-3">🛍️</div>
              <h1 className="text-xl font-bold text-gray-900">How would you like to continue?</h1>
              <p className="text-sm text-gray-500 mt-1">
                {guestAllowed ? "Sign in for order tracking, or check out as a guest." : "Please sign in to place your order."}
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => nav.go("auth")}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all hover:shadow-md"
                style={{ borderColor: brandColor, backgroundColor: `${brandColor}08` }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: brandColor }}>
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Login / Create Account</p>
                  <p className="text-xs text-gray-500 mt-0.5">Track orders, save addresses, earn rewards</p>
                </div>
              </button>
              {guestAllowed ? (
                <button
                  onClick={() => { setIsGuestMode(true); setCheckoutStep("form") }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 text-left transition-all hover:border-gray-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <UserX className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Continue as Guest</p>
                    <p className="text-xs text-gray-500 mt-0.5">No account needed — COD only</p>
                  </div>
                </button>
              ) : (
                <div className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-400">Guest Checkout Disabled</p>
                    <p className="text-xs text-gray-400 mt-0.5">Please sign in to continue</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {items.length} item{items.length !== 1 ? "s" : ""} in cart
            </p>
            {items.slice(0, 3).map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="flex justify-between text-sm text-gray-700 mb-1">
                <span className="truncate mr-2">{item.name} × {item.quantity}</span>
                <span className="font-semibold shrink-0">{formatINR(item.price * item.quantity)}</span>
              </div>
            ))}
            {items.length > 3 && <p className="text-xs text-gray-400 mt-1">+{items.length - 3} more items</p>}
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between text-sm font-bold text-gray-900">
              <span>Total</span><span>{formatINR(rawSubtotal + deliveryFee - discount)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Place order ────────────────────────────────────────────────────
  async function placeOrder() {
    if (storeClosed) {
      setOrderError(storeClosedMessage || "Store is currently closed. Please try again later.")
      return
    }
    if (!deliveryAddress) {
      setOrderError("Set your delivery address first.")
      return
    }
    if (svc.serviceable !== true || !assignedStore) {
      setOrderError(svc.reason || "This address is outside our delivery area. Please choose a different address.")
      return
    }
    if (belowMinOrder) {
      setOrderError(`Minimum order amount is ₹${minOrderAmount}. Add more items to proceed.`)
      return
    }
    if (isGuestMode && !isAuthenticated) {
      if (!guest.name || !guest.phone) {
        setOrderError("Name and phone number are required")
        return
      }
    }
    setPlacing(true); setOrderError("")
    const orderItems = items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }))
    try {
      if (isAuthenticated && token) {
        const res = await fetch("/api/core/storefront/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-business-id": currentBusinessId || "" },
          body: JSON.stringify({
            storeId: assignedStore.id,
            orderType: "DELIVERY",
            items: orderItems,
            deliveryAddressId: deliveryAddress.id || undefined,
            deliveryLat: deliveryAddress.latitude ?? undefined,
            deliveryLng: deliveryAddress.longitude ?? undefined,
            deliveryInstructions: deliveryAddress.instructions || undefined,
            deliveryFee,
            orderAmount: rawSubtotal,
            paymentMethod,
          }),
        })
        const data = await res.json()
        if (data.success) { clearCart(); setOrderId(data.data.id); setOrderNumber(data.data.orderNumber) }
        else setOrderError(data.error || "Failed to place order")
      } else {
        const res = await fetch("/api/core/storefront/orders/guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId: assignedStore.id,
            items: orderItems,
            customerName: guest.name,
            customerPhone: `+91${guest.phone.replace(/\D/g, "").slice(-10)}`,
            addressLine1: deliveryAddress.addressLine1,
            area: deliveryAddress.area || undefined,
            landmark: deliveryAddress.landmark || undefined,
            city: deliveryAddress.city,
            state: deliveryAddress.state || undefined,
            pincode: deliveryAddress.pincode,
            deliveryInstructions: deliveryAddress.instructions || undefined,
            deliveryLat: deliveryAddress.latitude ?? undefined,
            deliveryLng: deliveryAddress.longitude ?? undefined,
            googlePlaceId: deliveryAddress.googlePlaceId || undefined,
            formattedAddress: deliveryAddress.formattedAddress || undefined,
            deliveryFee,
            orderAmount: rawSubtotal,
            orderType: "DELIVERY",
          }),
        })
        const data = await res.json()
        if (data.success) { clearCart(); setOrderId(data.data.id); setOrderNumber(data.data.orderNumber) }
        else setOrderError(data.error || "Failed to place order")
      }
    } catch { setOrderError("Network error") } finally { setPlacing(false) }
  }

  const hasCOD = paymentGateways.length === 0 || paymentGateways.some((g) => g.gateway === "COD")
  const onlineGateways = paymentGateways.filter((g) => g.gateway !== "COD")

  // ── Delivery address + serviceability card ─────────────────────────
  const renderAddressGate = () => (
    <div>
      {deliveryAddress ? (
        <div className="flex items-start gap-3 p-4 rounded-xl border-2" style={{ borderColor: brandColor, backgroundColor: `${brandColor}08` }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: brandColor }}>
            <MapPin className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">{shortAddressLabel(deliveryAddress)}</p>
            <p className="text-xs text-gray-500 line-clamp-2">{formatAddressLine(deliveryAddress)}</p>
            {svc.serviceable === true && assignedStore && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  <Store className="w-3 h-3 inline mr-0.5" />
                  {assignedStore.name}
                  {assignedStore.distanceKm != null && <> · {assignedStore.distanceKm < 1 ? `${Math.round(assignedStore.distanceKm * 1000)} m` : `${assignedStore.distanceKm} km`} away</>}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onOpenAddressSheet}
            className="shrink-0 text-xs font-semibold px-3 h-9 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
            style={{ color: brandColor }}
          >
            Change
          </button>
        </div>
      ) : (
        <button
          onClick={onOpenAddressSheet}
          className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed text-left transition-colors"
          style={{ borderColor: `${brandColor}60`, color: brandColor, backgroundColor: `${brandColor}08` }}
        >
          <MapPin className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Set Delivery Address</p>
            <p className="text-xs opacity-80">Search, use GPS or drop a pin — store is chosen automatically</p>
          </div>
          <ChevronDown className="w-4 h-4 shrink-0 ml-auto" />
        </button>
      )}

      {/* Saved-address quick picks (authenticated) */}
      {isAuthenticated && !isGuestMode && addresses.length > 0 && (
        <div className="mt-3 space-y-2">
          {addresses.slice(0, 4).map((addr) => (
            <button
              key={addr.id}
              onClick={() => chooseSavedAddress(addr)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-colors text-left ${
                deliveryAddress?.id === addr.id ? "" : "border-gray-100 hover:border-gray-300"
              }`}
              style={deliveryAddress?.id === addr.id ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : {}}
            >
              <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900">
                  {addr.label || "Address"}
                  {addr.isDefault && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: brandColor }}>Default</span>}
                </p>
                <p className="text-xs text-gray-500 line-clamp-1">{formatAddressLine(addr)}</p>
              </div>
            </button>
          ))}
          <button onClick={onOpenAddressSheet} className="flex items-center gap-2 text-sm font-medium transition-colors" style={{ color: brandColor }}>
            <Plus className="w-4 h-4" /> Add or change address
          </button>
        </div>
      )}

      {/* Serviceability status */}
      {svc.loading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking delivery availability…
        </div>
      )}
      {!svc.loading && deliveryAddress && svc.serviceable === null && svc.reason && (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2.5 text-xs">
          {svc.reason}
          <button onClick={onOpenAddressSheet} className="mt-1.5 block font-semibold" style={{ color: brandColor }}>Set exact location</button>
        </div>
      )}
      {!svc.loading && svc.serviceable === false && (
        <div className="mt-3 rounded-xl border px-4 py-3" style={{ borderColor: `${brandColor}40`, backgroundColor: `${brandColor}0a` }}>
          <p className="text-xs font-bold text-gray-900 mb-1">This address is outside our delivery area</p>
          <p className="text-xs text-gray-600 mb-2">{svc.reason || "We can't deliver to this address right now."}</p>
          {svc.nearest && (
            <div className="flex items-center gap-2 text-xs text-gray-700 mb-2">
              <Store className="w-4 h-4 shrink-0" style={{ color: brandColor }} />
              <span>
                Nearest: <b>{svc.nearest.name}</b>
                {svc.nearest.distance != null && <> · {svc.nearest.distance < 1 ? `${Math.round(svc.nearest.distance * 1000)} m` : `${svc.nearest.distance} km`} away</>}
              </span>
            </div>
          )}
          <button onClick={onOpenAddressSheet} className="w-full h-9 text-white font-bold text-xs rounded-lg" style={{ backgroundColor: brandColor }}>
            Change Delivery Address
          </button>
        </div>
      )}
    </div>
  )

  const inputCls = "w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"

  // ── Checkout form ──────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => { if (isGuestMode && !isAuthenticated) setCheckoutStep("choose"); else nav.goBack("home") }}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {isGuestMode && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">Guest Checkout</span>
        )}
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* ── Left: Delivery details ────────────────────────── */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" style={{ color: brandColor }} />
              Delivery Address
            </h2>
            {renderAddressGate()}

            {/* Guest contact details */}
            {isGuestMode && !isAuthenticated && (
              <div className="mt-5 pt-5 border-t border-gray-100 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Contact Details</h3>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Full Name *" value={guest.name} onChange={(e) => setGuest((p) => ({ ...p, name: e.target.value }))} className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
                </div>
                <div className="relative">
                  <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="tel" placeholder="Phone Number *" value={guest.phone} onChange={(e) => setGuest((p) => ({ ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
                </div>
                <p className="text-xs text-gray-400">
                  <button onClick={() => nav.go("auth")} className="underline underline-offset-2 hover:text-gray-600">Sign in</button>
                  {" "}to save your address and track orders easily.
                </p>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4" style={{ color: brandColor }} />
              Payment Method
            </h2>
            <div className="space-y-2">
              {isGuestMode ? (
                <div className="flex items-center gap-3 p-4 rounded-xl border-2" style={{ borderColor: brandColor, backgroundColor: `${brandColor}08` }}>
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: brandColor }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Cash on Delivery</p>
                    <p className="text-xs text-gray-500">Pay when your order arrives</p>
                  </div>
                </div>
              ) : (
                <>
                  {hasCOD && (
                    <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${paymentMethod === "COD" ? "" : "border-gray-200"}`}
                      style={paymentMethod === "COD" ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : {}}
                      onClick={() => setPaymentMethod("COD")}>
                      <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={paymentMethod === "COD" ? { borderColor: brandColor } : { borderColor: "#d1d5db" }}>
                        {paymentMethod === "COD" && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }} />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Cash on Delivery</p>
                        <p className="text-xs text-gray-500">Pay when your order arrives</p>
                      </div>
                    </label>
                  )}
                  {onlineGateways.map((gw) => (
                    <label key={gw.id}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${paymentMethod === gw.id ? "" : "border-gray-200"}`}
                      style={paymentMethod === gw.id ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : {}}
                      onClick={() => setPaymentMethod(gw.id)}>
                      <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={paymentMethod === gw.id ? { borderColor: brandColor } : { borderColor: "#d1d5db" }}>
                        {paymentMethod === gw.id && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }} />}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{gw.name}</p>
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Order summary ────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sticky top-24">
            <h2 className="text-base font-bold text-gray-900 mb-4">Order Summary</h2>
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId}`} className="flex items-center gap-3">
                  {item.image ? (
                    <img src={resolveImageUrl(item.image)} alt={item.name} className="w-12 h-12 rounded-lg object-cover border border-gray-100 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-lg">🛍️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    {item.variantName && <p className="text-xs text-gray-500">{item.variantName}</p>}
                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 shrink-0">{formatINR(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatINR(rawSubtotal)}</span></div>
              {deliveryFee > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Delivery fee</span><span>{formatINR(deliveryFee)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>−{formatINR(discount)}</span></div>}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100"><span>Total</span><span>{formatINR(total)}</span></div>
            </div>

            {/* Store closed warning */}
            {storeClosed && (
              <div className="mt-3 rounded-lg bg-gray-900 text-white px-4 py-3 text-xs font-medium">
                🔴 {storeClosedMessage || "Store is currently closed"} — orders are not being accepted
              </div>
            )}

            {/* Assigned store + outside-area status */}
            {!storeClosed && svc.serviceable === true && assignedStore && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-xs font-medium">
                ✓ Delivering from <b>{assignedStore.name}</b>
                {assignedStore.distanceKm != null && ` · ${assignedStore.distanceKm < 1 ? `${Math.round(assignedStore.distanceKm * 1000)} m` : `${assignedStore.distanceKm} km`}`}
                {assignedStore.matchedZoneName && ` · ${assignedStore.matchedZoneName}`}
              </div>
            )}
            {!storeClosed && svc.serviceable === false && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-xs font-medium">
                This address is outside our delivery area. Change your address to continue.
              </div>
            )}

            {/* Minimum order warning */}
            {!storeClosed && svc.serviceable === true && belowMinOrder && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-xs font-medium">
                Minimum order is {formatINR(minOrderAmount)}. Add {formatINR(minOrderAmount - rawSubtotal)} more to proceed.
              </div>
            )}

            {/* Free delivery badge */}
            {!storeClosed && svc.serviceable === true && assignedStore?.freeDeliveryAbove && rawSubtotal >= assignedStore.freeDeliveryAbove && deliveryFee === 0 && (
              <div className="mt-3 rounded-lg bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-xs font-medium">
                ✓ Free delivery applied
              </div>
            )}

            {orderError && <p className="mt-3 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{orderError}</p>}

            <button
              onClick={placeOrder}
              disabled={placing || storeClosed || belowMinOrder || svc.serviceable !== true}
              className="w-full h-12 text-white font-bold text-sm rounded-xl mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: brandColor }}
            >
              {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : storeClosed ? (
                <>🔴 Store Closed</>
              ) : svc.serviceable !== true ? (
                <>Select a Deliverable Address</>
              ) : (
                <><Check className="w-4 h-4" /> Place Order · {formatINR(total)}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
