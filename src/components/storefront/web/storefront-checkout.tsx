"use client"

import { useState, useEffect, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useAuthStore } from "@/stores/auth-store"
import {
  ArrowLeft, MapPin, Plus, Loader2, CheckCircle2, CreditCard,
  User, Phone as PhoneIcon, Check, LogIn, UserX, Lock, Navigation,
} from "lucide-react"
import { formatINR } from "@/lib/currency"
import { resolveImageUrl } from "@/lib/image-url"
import type { WebNav } from "./storefront-types"
import type { PickedStore } from "./storefront-store-picker"

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
  currentStore?: PickedStore | null
  storeClosed?: boolean
  storeClosedMessage?: string
}

type CheckoutStep = "choose" | "form"

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const LABELS = ["Home", "Office", "Other"]

const emptyNewAddr = () => ({
  label: "Home", area: "", line1: "", landmark: "", city: "", state: "", pincode: "", instructions: "",
  lat: undefined as number | undefined, lng: undefined as number | undefined, gpsAccuracy: undefined as number | undefined,
})

const emptyGuest = () => ({
  area: "", line1: "", landmark: "", city: "", state: "", pincode: "", instructions: "",
  lat: undefined as number | undefined, lng: undefined as number | undefined, gpsAccuracy: undefined as number | undefined,
})

export function StorefrontCheckout({ brandColor, nav, currentStore, storeClosed = false, storeClosedMessage }: StorefrontCheckoutProps) {
  const { currentBusinessId, currentStoreId } = useAdminStore()
  const { items, subtotal, storeDeliveryFee, couponDiscount, paymentGateways, clearCart } = useCartStore()
  const { isAuthenticated, user, token } = useAuthStore()

  const rawSubtotal = subtotal()
  // Apply free delivery above threshold from store config
  const effectiveDeliveryFee = (currentStore?.freeDeliveryAbove && rawSubtotal >= currentStore.freeDeliveryAbove)
    ? 0
    : (storeDeliveryFee ?? 0)
  const deliveryFee = effectiveDeliveryFee
  const discount = couponDiscount || 0
  const total = Math.round(rawSubtotal + deliveryFee - discount)

  // Minimum order check (client-side pre-validation)
  const minOrderAmount = currentStore?.minOrderAmount ?? 0
  const belowMinOrder  = minOrderAmount > 0 && rawSubtotal < minOrderAmount

  const [allowGuest, setAllowGuest] = useState<boolean | null>(null)
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>(isAuthenticated ? "form" : "choose")
  const [isGuestMode, setIsGuestMode] = useState(false)

  // Authenticated address flow
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newAddr, setNewAddr] = useState(emptyNewAddr())
  const [addingGps, setAddingGps] = useState(false)
  const [addrError, setAddrError] = useState("")
  const [rangeWarning, setRangeWarning] = useState("")

  // Guest form
  const [guestName, setGuestName] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [guestAddr, setGuestAddr] = useState(emptyGuest())
  const [guestGpsLoading, setGuestGpsLoading] = useState(false)

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
      if (data.success && data.data?.length) {
        setAddresses(data.data)
        const def = data.data.find((a: Address) => a.isDefault)
        setSelectedAddressId(def?.id || data.data[0]?.id || null)
      }
    } catch { /* non-critical */ }
  }, [token])

  useEffect(() => { if (isAuthenticated) fetchAddresses() }, [isAuthenticated, fetchAddresses])

  // Check if selected address is out of delivery range
  useEffect(() => {
    if (!currentStore?.latitude || !currentStore?.longitude || !currentStore?.deliveryRadius) { setRangeWarning(""); return }
    const addr = addresses.find((a) => a.id === selectedAddressId)
    if (!addr?.latitude || !addr?.longitude) { setRangeWarning(""); return }
    const dist = haversineKm(addr.latitude, addr.longitude, currentStore.latitude, currentStore.longitude)
    if (dist > currentStore.deliveryRadius) {
      setRangeWarning(`This address is ${dist.toFixed(1)} km from the store. Delivery radius is ${currentStore.deliveryRadius} km.`)
    } else {
      setRangeWarning("")
    }
  }, [selectedAddressId, addresses, currentStore])

  const captureGpsForNewAddr = () => {
    if (!navigator.geolocation) return
    setAddingGps(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewAddr((p) => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude, gpsAccuracy: pos.coords.accuracy }))
        setAddingGps(false)
      },
      () => setAddingGps(false),
      { timeout: 10000 },
    )
  }

  const captureGpsForGuest = () => {
    if (!navigator.geolocation) return
    setGuestGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGuestAddr((p) => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude, gpsAccuracy: pos.coords.accuracy }))
        setGuestGpsLoading(false)
      },
      () => setGuestGpsLoading(false),
      { timeout: 10000 },
    )
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
              <span>Total</span><span>{formatINR(total)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Address helpers ────────────────────────────────────────────────
  async function addAddress() {
    if (!newAddr.line1 || !newAddr.city || !newAddr.pincode) { setAddrError("House/street, city, and pincode are required"); return }
    setAddrError("")
    try {
      const res = await fetch("/api/core/storefront/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-business-id": currentBusinessId || "" },
        body: JSON.stringify({
          label: newAddr.label,
          area: newAddr.area || undefined,
          line1: newAddr.line1,
          landmark: newAddr.landmark || undefined,
          city: newAddr.city,
          state: newAddr.state || undefined,
          pincode: newAddr.pincode,
          instructions: newAddr.instructions || undefined,
          latitude: newAddr.lat,
          longitude: newAddr.lng,
          gpsAccuracy: newAddr.gpsAccuracy,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setNewAddr(emptyNewAddr()); setShowAddForm(false); setAddrError("")
        await fetchAddresses()
        setSelectedAddressId(data.data.id)
      } else setAddrError(data.error || "Failed to add address")
    } catch { setAddrError("Network error") }
  }

  // ── Place order ────────────────────────────────────────────────────
  async function placeOrder() {
    // Client-side guards — backend will also enforce these
    if (storeClosed) {
      setOrderError(storeClosedMessage || "Store is currently closed. Please try again later.")
      return
    }
    if (belowMinOrder) {
      setOrderError(`Minimum order amount is ₹${minOrderAmount}. Add more items to proceed.`)
      return
    }
    setPlacing(true); setOrderError("")
    try {
      if (isAuthenticated && token) {
        if (!selectedAddressId) { setOrderError("Please select a delivery address"); setPlacing(false); return }
        if (rangeWarning) { setOrderError("This address is outside the delivery range. Please choose a different address."); setPlacing(false); return }
        const selAddr = addresses.find((a) => a.id === selectedAddressId)
        const res = await fetch("/api/core/storefront/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-business-id": currentBusinessId || "" },
          body: JSON.stringify({
            storeId: currentStoreId,
            orderType: "DELIVERY",
            items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
            deliveryAddressId: selectedAddressId,
            deliveryInstructions: selAddr?.instructions || undefined,
            deliveryFee,
            paymentMethod,
          }),
        })
        const data = await res.json()
        if (data.success) { clearCart(); setOrderId(data.data.id); setOrderNumber(data.data.orderNumber) }
        else setOrderError(data.error || "Failed to place order")
      } else {
        // Guest checkout
        if (!guestName || !guestPhone || !guestAddr.line1 || !guestAddr.city || !guestAddr.pincode) {
          setOrderError("Name, phone, house/street, city, and pincode are required"); setPlacing(false); return
        }
        const res = await fetch("/api/core/storefront/orders/guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId: currentStoreId,
            items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
            customerName: guestName,
            customerPhone: `+91${guestPhone.replace(/\D/g, "").slice(-10)}`,
            // Structured address fields
            addressLine1: guestAddr.line1,
            area: guestAddr.area || undefined,
            landmark: guestAddr.landmark || undefined,
            city: guestAddr.city,
            state: guestAddr.state || undefined,
            pincode: guestAddr.pincode,
            deliveryInstructions: guestAddr.instructions || undefined,
            deliveryLat: guestAddr.lat,
            deliveryLng: guestAddr.lng,
            gpsAccuracy: guestAddr.gpsAccuracy,
            deliveryFee,
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

  // ── Address form shared style ──────────────────────────────────────
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

            {isAuthenticated && !isGuestMode ? (
              <>
                {/* Saved addresses list */}
                {addresses.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${selectedAddressId === addr.id ? "" : "border-gray-200 hover:border-gray-300"}`}
                        style={selectedAddressId === addr.id ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : {}}
                        onClick={() => setSelectedAddressId(addr.id)}
                      >
                        <div
                          className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                          style={selectedAddressId === addr.id ? { borderColor: brandColor } : { borderColor: "#d1d5db" }}
                        >
                          {selectedAddressId === addr.id && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }} />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {addr.label && <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{addr.label}</span>}
                            {addr.isDefault && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: brandColor }}>Default</span>}
                          </div>
                          <p className="text-sm font-medium text-gray-900">{addr.addressLine1}</p>
                          {addr.area && <p className="text-xs text-gray-500">{addr.area}</p>}
                          {addr.landmark && <p className="text-xs text-gray-400">Near {addr.landmark}</p>}
                          <p className="text-sm text-gray-600">{addr.city}, {addr.state} - {addr.pincode}</p>
                          {addr.instructions && <p className="text-xs text-gray-400 mt-0.5 italic">{addr.instructions}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {rangeWarning && (
                  <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{rangeWarning}</p>
                )}

                {/* Add new address form */}
                {showAddForm ? (
                  <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Add New Address</h3>

                    {/* Label chips */}
                    <div className="flex gap-2">
                      {LABELS.map((l) => (
                        <button key={l} type="button" onClick={() => setNewAddr((p) => ({ ...p, label: l }))}
                          className="px-3 py-1 rounded-lg text-xs font-medium border transition-colors"
                          style={newAddr.label === l ? { borderColor: brandColor, backgroundColor: `${brandColor}10`, color: brandColor } : { borderColor: "#e5e7eb", color: "#4b5563" }}>
                          {l}
                        </button>
                      ))}
                    </div>

                    {/* GPS button */}
                    <button type="button" onClick={captureGpsForNewAddr} disabled={addingGps}
                      className="w-full flex items-center justify-center gap-2 py-2 border border-dashed rounded-xl text-xs font-medium transition-colors"
                      style={{ borderColor: `${brandColor}60`, color: brandColor }}>
                      {addingGps ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Detecting location…</> : <><Navigation className="w-3.5 h-3.5" /> Use Current Location</>}
                    </button>
                    {newAddr.lat && (
                      <p className="text-[10px] text-center text-green-600">GPS captured ({newAddr.lat.toFixed(4)}, {newAddr.lng?.toFixed(4)})</p>
                    )}

                    <input type="text" placeholder="Area / Locality" value={newAddr.area} onChange={(e) => setNewAddr((p) => ({ ...p, area: e.target.value }))} className={inputCls} />
                    <input type="text" placeholder="House No / Street *" value={newAddr.line1} onChange={(e) => setNewAddr((p) => ({ ...p, line1: e.target.value }))} className={inputCls} />
                    <input type="text" placeholder="Landmark (optional)" value={newAddr.landmark} onChange={(e) => setNewAddr((p) => ({ ...p, landmark: e.target.value }))} className={inputCls} />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" placeholder="City *" value={newAddr.city} onChange={(e) => setNewAddr((p) => ({ ...p, city: e.target.value }))} className={inputCls} />
                      <input type="text" placeholder="State" value={newAddr.state} onChange={(e) => setNewAddr((p) => ({ ...p, state: e.target.value }))} className={inputCls} />
                    </div>
                    <input type="text" placeholder="Pincode *" value={newAddr.pincode} onChange={(e) => setNewAddr((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} className={inputCls} />
                    <textarea placeholder="Delivery instructions (optional)" value={newAddr.instructions} onChange={(e) => setNewAddr((p) => ({ ...p, instructions: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white resize-none" />

                    {addrError && <p className="text-xs text-red-500">{addrError}</p>}
                    <div className="flex gap-2">
                      <button onClick={addAddress} className="flex-1 h-9 text-sm font-semibold text-white rounded-lg" style={{ backgroundColor: brandColor }}>Save Address</button>
                      <button onClick={() => { setShowAddForm(false); setNewAddr(emptyNewAddr()); setAddrError("") }} className="flex-1 h-9 text-sm text-gray-600 border border-gray-200 rounded-lg">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 text-sm font-medium transition-colors" style={{ color: brandColor }}>
                    <Plus className="w-4 h-4" /> Add new address
                  </button>
                )}
              </>
            ) : (
              // ── Guest form ───────────────────────────────────────────
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Full Name *" value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
                  </div>
                  <div className="relative">
                    <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="tel" placeholder="Phone Number *" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
                  </div>
                </div>

                {/* GPS button for guest */}
                <button type="button" onClick={captureGpsForGuest} disabled={guestGpsLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed rounded-xl text-xs font-medium transition-colors"
                  style={{ borderColor: `${brandColor}60`, color: brandColor }}>
                  {guestGpsLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Detecting location…</> : <><Navigation className="w-3.5 h-3.5" /> Use Current Location</>}
                </button>
                {guestAddr.lat && (
                  <p className="text-[10px] text-center text-green-600">GPS captured ({guestAddr.lat.toFixed(4)}, {guestAddr.lng?.toFixed(4)})</p>
                )}

                <input type="text" placeholder="Area / Locality" value={guestAddr.area} onChange={(e) => setGuestAddr((p) => ({ ...p, area: e.target.value }))} className={inputCls + " rounded-xl"} />
                <input type="text" placeholder="House No / Street *" value={guestAddr.line1} onChange={(e) => setGuestAddr((p) => ({ ...p, line1: e.target.value }))} className={inputCls + " rounded-xl"} />
                <input type="text" placeholder="Landmark (optional)" value={guestAddr.landmark} onChange={(e) => setGuestAddr((p) => ({ ...p, landmark: e.target.value }))} className={inputCls + " rounded-xl"} />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="City *" value={guestAddr.city} onChange={(e) => setGuestAddr((p) => ({ ...p, city: e.target.value }))} className={inputCls + " rounded-xl"} />
                  <input type="text" placeholder="State" value={guestAddr.state} onChange={(e) => setGuestAddr((p) => ({ ...p, state: e.target.value }))} className={inputCls + " rounded-xl"} />
                </div>
                <input type="text" placeholder="Pincode *" value={guestAddr.pincode} onChange={(e) => setGuestAddr((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} className={inputCls + " rounded-xl"} />
                <textarea placeholder="Delivery instructions (optional)" value={guestAddr.instructions} onChange={(e) => setGuestAddr((p) => ({ ...p, instructions: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 resize-none" />

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

            {/* Minimum order warning */}
            {!storeClosed && belowMinOrder && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-xs font-medium">
                Minimum order is {formatINR(minOrderAmount)}. Add {formatINR(minOrderAmount - rawSubtotal)} more to proceed.
              </div>
            )}

            {/* Free delivery badge */}
            {!storeClosed && currentStore?.freeDeliveryAbove && rawSubtotal >= currentStore.freeDeliveryAbove && deliveryFee === 0 && (
              <div className="mt-3 rounded-lg bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-xs font-medium">
                ✓ Free delivery applied
              </div>
            )}

            {orderError && <p className="mt-3 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{orderError}</p>}

            <button
              onClick={placeOrder}
              disabled={placing || storeClosed || belowMinOrder}
              className="w-full h-12 text-white font-bold text-sm rounded-xl mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: brandColor }}
            >
              {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : storeClosed ? (
                <>🔴 Store Closed</>
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
