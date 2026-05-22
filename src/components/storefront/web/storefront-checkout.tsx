"use client"

import { useState, useEffect, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useAuthStore } from "@/stores/auth-store"
import {
  ArrowLeft, MapPin, Plus, Loader2, CheckCircle2, CreditCard,
  User, Phone as PhoneIcon, Home, Trash2, Check,
} from "lucide-react"
import { formatINR } from "@/lib/currency"
import type { WebNav } from "./storefront-website"

interface Address {
  id: string
  label?: string | null
  addressLine1: string
  addressLine2?: string | null
  city: string
  state: string
  pincode: string
  isDefault: boolean
}

interface StorefrontCheckoutProps {
  brandColor: string
  nav: WebNav
}

export function StorefrontCheckout({ brandColor, nav }: StorefrontCheckoutProps) {
  const { currentBusinessId, currentStoreId } = useAdminStore()
  const { items, subtotal, storeDeliveryFee, couponDiscount, paymentGateways, clearCart } = useCartStore()
  const { isAuthenticated, user, token } = useAuthStore()

  const deliveryFee = storeDeliveryFee ?? 0
  const discount = couponDiscount || 0
  const total = Math.round(subtotal() + deliveryFee - discount)

  // Addresses (authenticated flow)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // New address form
  const [newAddr, setNewAddr] = useState({ line1: "", line2: "", city: "", pincode: "", label: "" })

  // Guest form
  const [guestName, setGuestName] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [guestAddress, setGuestAddress] = useState("")

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("COD")

  // Order state
  const [placing, setPlacing] = useState(false)
  const [orderError, setOrderError] = useState("")
  const [orderId, setOrderId] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState("")

  const fetchAddresses = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/core/storefront/addresses", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success && data.data?.length) {
        setAddresses(data.data)
        const def = data.data.find((a: Address) => a.isDefault)
        setSelectedAddressId(def?.id || data.data[0]?.id || null)
      }
    } catch { /* non-critical */ }
  }, [token])

  useEffect(() => {
    if (isAuthenticated) fetchAddresses()
  }, [isAuthenticated, fetchAddresses])

  if (items.length === 0 && !orderId) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-5xl">🛒</div>
        <h2 className="text-lg font-bold text-gray-900">Your cart is empty</h2>
        <button
          onClick={() => nav.go("home")}
          className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl"
          style={{ backgroundColor: brandColor }}
        >
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
          <button
            onClick={() => nav.go("order-tracking", { orderId })}
            className="w-full h-12 text-white font-bold text-sm rounded-xl mb-3"
            style={{ backgroundColor: brandColor }}
          >
            Track Order
          </button>
          <button
            onClick={() => nav.go("home")}
            className="w-full h-12 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    )
  }

  async function addAddress() {
    if (!newAddr.line1 || !newAddr.city || !newAddr.pincode) {
      setOrderError("Address line 1, city, and pincode are required"); return
    }
    try {
      const res = await fetch("/api/core/storefront/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          label: newAddr.label || undefined,
          line1: newAddr.line1,
          line2: newAddr.line2 || undefined,
          city: newAddr.city,
          pincode: newAddr.pincode,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setNewAddr({ line1: "", line2: "", city: "", pincode: "", label: "" })
        setShowAddForm(false)
        await fetchAddresses()
        setSelectedAddressId(data.data.id)
      } else setOrderError(data.error || "Failed to add address")
    } catch { setOrderError("Network error") }
  }

  async function placeOrder() {
    setPlacing(true); setOrderError("")
    try {
      if (isAuthenticated && token) {
        if (!selectedAddressId) { setOrderError("Please select a delivery address"); setPlacing(false); return }
        const res = await fetch("/api/core/storefront/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            storeId: currentStoreId,
            orderType: "DELIVERY",
            items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
            deliveryAddressId: selectedAddressId,
            deliveryFee,
            paymentMethod,
          }),
        })
        const data = await res.json()
        if (data.success) {
          clearCart()
          setOrderId(data.data.id)
          setOrderNumber(data.data.orderNumber)
        } else setOrderError(data.error || "Failed to place order")
      } else {
        // Guest checkout
        if (!guestName || !guestPhone || !guestAddress) {
          setOrderError("Name, phone, and address are required"); setPlacing(false); return
        }
        const res = await fetch("/api/core/storefront/orders/guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId: currentStoreId,
            items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
            customerName: guestName,
            customerPhone: `+91${guestPhone.replace(/\D/g, "").slice(-10)}`,
            deliveryAddress: guestAddress,
            deliveryFee,
            orderType: "DELIVERY",
          }),
        })
        const data = await res.json()
        if (data.success) {
          clearCart()
          setOrderId(data.data.id)
          setOrderNumber(data.data.orderNumber)
        } else setOrderError(data.error || "Failed to place order")
      }
    } catch { setOrderError("Network error") } finally { setPlacing(false) }
  }

  const hasCOD = paymentGateways.length === 0 || paymentGateways.some((g) => g.gateway === "COD")
  const onlineGateways = paymentGateways.filter((g) => g.gateway !== "COD")

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => nav.go(nav.prevPage || "home")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* ── Left: Delivery details ── */}
        <div className="space-y-6">
          {/* Delivery address */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" style={{ color: brandColor }} />
              Delivery Address
            </h2>

            {isAuthenticated ? (
              <>
                {addresses.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                          selectedAddressId === addr.id
                            ? "border-current bg-opacity-5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        style={selectedAddressId === addr.id ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : {}}
                        onClick={() => setSelectedAddressId(addr.id)}
                      >
                        <div
                          className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            selectedAddressId === addr.id ? "border-current" : "border-gray-300"
                          }`}
                          style={selectedAddressId === addr.id ? { borderColor: brandColor } : {}}
                        >
                          {selectedAddressId === addr.id && (
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }} />
                          )}
                        </div>
                        <div className="flex-1">
                          {addr.label && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{addr.label}</span>
                              {addr.isDefault && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: brandColor }}>Default</span>
                              )}
                            </div>
                          )}
                          <p className="text-sm font-medium text-gray-900">{addr.addressLine1}</p>
                          {addr.addressLine2 && <p className="text-sm text-gray-600">{addr.addressLine2}</p>}
                          <p className="text-sm text-gray-600">{addr.city}, {addr.state} - {addr.pincode}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {showAddForm ? (
                  <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Add New Address</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Label (Home, Work…)"
                          value={newAddr.label}
                          onChange={(e) => setNewAddr((p) => ({ ...p, label: e.target.value }))}
                          className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Address Line 1 *"
                          value={newAddr.line1}
                          onChange={(e) => setNewAddr((p) => ({ ...p, line1: e.target.value }))}
                          className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Address Line 2"
                          value={newAddr.line2}
                          onChange={(e) => setNewAddr((p) => ({ ...p, line2: e.target.value }))}
                          className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="City *"
                        value={newAddr.city}
                        onChange={(e) => setNewAddr((p) => ({ ...p, city: e.target.value }))}
                        className="h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="Pincode *"
                        value={newAddr.pincode}
                        onChange={(e) => setNewAddr((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                        className="h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={addAddress}
                        className="flex-1 h-9 text-sm font-semibold text-white rounded-lg"
                        style={{ backgroundColor: brandColor }}
                      >
                        Save Address
                      </button>
                      <button
                        onClick={() => { setShowAddForm(false); setNewAddr({ line1: "", line2: "", city: "", pincode: "", label: "" }) }}
                        className="flex-1 h-9 text-sm text-gray-600 border border-gray-200 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 text-sm font-medium transition-colors"
                    style={{ color: brandColor }}
                  >
                    <Plus className="w-4 h-4" />
                    Add new address
                  </button>
                )}
              </>
            ) : (
              // Guest form
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Full Name *"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
                    />
                  </div>
                  <div className="relative">
                    <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      placeholder="Phone Number *"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
                    />
                  </div>
                </div>
                <div className="relative">
                  <Home className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea
                    placeholder="Full Delivery Address *"
                    value={guestAddress}
                    onChange={(e) => setGuestAddress(e.target.value)}
                    rows={3}
                    className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 resize-none"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  <button
                    onClick={() => nav.go("auth", { prevPage: "checkout" } as never)}
                    className="underline underline-offset-2 hover:text-gray-600"
                  >
                    Sign in
                  </button>
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
              {hasCOD && (
                <label
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                    paymentMethod === "COD" ? "" : "border-gray-200"
                  }`}
                  style={paymentMethod === "COD" ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : {}}
                  onClick={() => setPaymentMethod("COD")}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center`}
                    style={paymentMethod === "COD" ? { borderColor: brandColor } : { borderColor: "#d1d5db" }}
                  >
                    {paymentMethod === "COD" && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Cash on Delivery</p>
                    <p className="text-xs text-gray-500">Pay when your order arrives</p>
                  </div>
                </label>
              )}
              {onlineGateways.map((gw) => (
                <label
                  key={gw.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                    paymentMethod === gw.id ? "" : "border-gray-200"
                  }`}
                  style={paymentMethod === gw.id ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : {}}
                  onClick={() => setPaymentMethod(gw.id)}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={paymentMethod === gw.id ? { borderColor: brandColor } : { borderColor: "#d1d5db" }}
                  >
                    {paymentMethod === gw.id && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }} />}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{gw.name}</p>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Order summary ── */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sticky top-24">
            <h2 className="text-base font-bold text-gray-900 mb-4">Order Summary</h2>

            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId}`} className="flex items-center gap-3">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover border border-gray-100 shrink-0" />
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
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatINR(subtotal())}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery fee</span>
                  <span>{formatINR(deliveryFee)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>−{formatINR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
                <span>Total</span>
                <span>{formatINR(total)}</span>
              </div>
            </div>

            {orderError && (
              <p className="mt-3 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{orderError}</p>
            )}

            <button
              onClick={placeOrder}
              disabled={placing}
              className="w-full h-12 text-white font-bold text-sm rounded-xl mt-4 flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: brandColor }}
            >
              {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <Check className="w-4 h-4" />
                  Place Order · {formatINR(total)}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
