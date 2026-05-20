"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useAuthStore } from "@/stores/auth-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Tag,
  ArrowRight,
  Leaf,
  Truck,
  MapPin,
  X,
} from "lucide-react"

interface ApiCoupon {
  id: string
  code: string
  description: string | null
  type: "PERCENTAGE" | "FIXED_AMOUNT"
  value: number
  minOrder: number
  maxDiscount: number | null
  usageLeft: number | null
  validUntil: string
}

export function CustomerCart() {
  const { setCustomerPage, currentBusinessPrimaryColor, currentStoreName } = useAdminStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"
  const { token } = useAuthStore()

  const [apiCoupons, setApiCoupons] = useState<ApiCoupon[]>([])

  const fetchCoupons = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/core/storefront/coupons", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) setApiCoupons(json.data || [])
    } catch {
      // fall back to no coupons
    }
  }, [token])

  useEffect(() => { fetchCoupons() }, [fetchCoupons])

  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
    couponCode,
    couponDiscount,
    storeDeliveryFee,
  } = useCartStore()
  const subtotal = useCartStore((s) => s.subtotal())
  const totalSavings = useCartStore((s) => s.totalSavings())
  const deliveryFee = useCartStore((s) => s.deliveryFee())
  const total = useCartStore((s) => s.total())

  const [couponInput, setCouponInput] = useState("")
  const [couponError, setCouponError] = useState("")
  const [couponSuccess, setCouponSuccess] = useState("")

  const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`

  const handleApplyCoupon = () => {
    setCouponError("")
    setCouponSuccess("")
    const code = couponInput.toUpperCase().trim()
    const coupon = apiCoupons.find((c) => c.code === code)

    if (!coupon) {
      setCouponError("Invalid coupon code")
      return
    }

    if (subtotal < coupon.minOrder) {
      setCouponError(`Minimum order of ${formatPrice(coupon.minOrder)} required`)
      return
    }

    if (coupon.usageLeft !== null && coupon.usageLeft <= 0) {
      setCouponError("Coupon usage limit reached")
      return
    }

    const discount =
      coupon.type === "PERCENTAGE"
        ? Math.min(
            Math.round((subtotal * coupon.value) / 100),
            coupon.maxDiscount ?? Infinity,
          )
        : coupon.value

    applyCoupon(code, discount)
    setCouponSuccess(`Coupon ${code} applied! You save ${formatPrice(discount)}`)
    setCouponInput("")
  }

  const handleRemoveCoupon = () => {
    removeCoupon()
    setCouponSuccess("")
    setCouponError("")
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <ShoppingCart className="w-10 h-10 text-gray-300" />
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">Your cart is empty</h2>
        <p className="text-sm text-gray-400 mb-6 text-center">
          Looks like you haven&apos;t added anything to your cart yet
        </p>
        <Button
          onClick={() => setCustomerPage("home")}
          className="rounded-xl px-6 text-white"
          style={{ backgroundColor: brandColor }}
        >
          Start Shopping
        </Button>
      </div>
    )
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Your Cart</h1>
          <p className="text-xs text-gray-400">{items.length} item{items.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-red-500 font-medium hover:text-red-600"
        >
          Clear All
        </button>
      </div>

      {/* Selected Store */}
      {currentStoreName && (
        <div className="mx-4 mb-3 flex items-center gap-1.5">
          <MapPin className="w-3 h-3 shrink-0" style={{ color: brandColor }} />
          <span className="text-[11px] text-gray-500">Delivering from</span>
          <span className="text-[11px] font-semibold text-gray-700">{currentStoreName}</span>
        </div>
      )}

      {/* Free Delivery Banner */}
      {storeDeliveryFee === null && subtotal < 500 && (
        <div className="mx-4 mb-3 bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-2">
          <Truck className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-[11px] text-amber-700">
            Add {formatPrice(500 - subtotal)} more for <span className="font-semibold">FREE delivery</span>
          </p>
        </div>
      )}
      {(storeDeliveryFee === 0 || (storeDeliveryFee === null && subtotal >= 500)) && deliveryFee === 0 && (
        <div className="mx-4 mb-3 rounded-xl p-3 flex items-center gap-2 border" style={{ backgroundColor: `${brandColor}0d`, borderColor: `${brandColor}25` }}>
          <Truck className="w-4 h-4 flex-shrink-0" style={{ color: brandColor }} />
          <p className="text-[11px] font-medium" style={{ color: brandColor }}>You get FREE delivery on this order!</p>
        </div>
      )}

      {/* Cart Items */}
      <div className="px-4 space-y-2 mb-4">
        {items.map((item) => {
          const savings = (item.mrp - item.price) * item.quantity
          return (
            <div
              key={`${item.productId}-${item.variantId}`}
              className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl p-3"
            >
              <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Leaf className="w-7 h-7 text-gray-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      {item.isVeg && (
                        <div className="w-3 h-3 border border-green-600 flex items-center justify-center rounded-sm flex-shrink-0">
                          <div className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                        </div>
                      )}
                      <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                    </div>
                    <p className="text-[10px] text-gray-400">{item.variantName}</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId, item.variantId)}
                    className="p-1 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-900">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                    {savings > 0 && (
                      <span className="text-[10px] text-gray-400 line-through">
                        {formatPrice(item.mrp * item.quantity)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0 border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() =>
                        item.quantity === 1
                          ? removeItem(item.productId, item.variantId)
                          : updateQuantity(item.productId, item.variantId, item.quantity - 1)
                      }
                      className="w-7 h-7 flex items-center justify-center hover:bg-gray-50"
                    >
                      <Minus className="w-3 h-3 text-gray-500" />
                    </button>
                    <span className="w-7 h-7 flex items-center justify-center text-xs font-semibold border-x border-gray-200">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(item.productId, item.variantId, item.quantity + 1)
                      }
                      className="w-7 h-7 flex items-center justify-center hover:bg-gray-50"
                    >
                      <Plus className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Coupon Code */}
      <div className="px-4 mb-4">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4" style={{ color: brandColor }} />
            <span className="text-xs font-medium text-gray-700">Apply Coupon</span>
          </div>
          {couponCode ? (
            <div className="flex items-center justify-between rounded-lg px-3 py-2 border" style={{ backgroundColor: `${brandColor}0d`, borderColor: `${brandColor}25` }}>
              <div>
                <span className="text-xs font-bold" style={{ color: brandColor }}>{couponCode}</span>
                <span className="text-[10px] ml-2" style={{ color: brandColor }}>-{formatPrice(couponDiscount)}</span>
              </div>
              <button onClick={handleRemoveCoupon}>
                <X className="w-3.5 h-3.5" style={{ color: brandColor }} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter coupon code"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase())
                    setCouponError("")
                    setCouponSuccess("")
                  }}
                  className="h-9 text-xs rounded-lg bg-white border-gray-200"
                />
                <Button
                  onClick={handleApplyCoupon}
                  disabled={!couponInput.trim()}
                  variant="outline"
                  className="h-9 text-xs font-semibold rounded-lg"
                  style={{ borderColor: `${brandColor}50`, color: brandColor }}
                >
                  Apply
                </Button>
              </div>
              {couponError && (
                <p className="text-[10px] text-red-500 mt-1">{couponError}</p>
              )}
              {couponSuccess && (
                <p className="text-[10px] mt-1" style={{ color: brandColor }}>{couponSuccess}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <div className="px-4 mb-4">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Order Summary</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Subtotal</span>
              <span className="text-xs font-medium">{formatPrice(subtotal)}</span>
            </div>
            {totalSavings > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: brandColor }}>Savings</span>
                <span className="text-xs font-medium" style={{ color: brandColor }}>-{formatPrice(totalSavings)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Delivery Fee</span>
              <span className="text-xs font-medium" style={deliveryFee === 0 ? { color: brandColor } : undefined}>
                {deliveryFee === 0 ? "FREE" : formatPrice(deliveryFee)}
              </span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: brandColor }}>Coupon Discount</span>
                <span className="text-xs font-medium" style={{ color: brandColor }}>-{formatPrice(couponDiscount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-bold text-gray-900">Total</span>
              <span className="text-lg font-bold text-gray-900">{formatPrice(total)}</span>
            </div>
          </div>
          {totalSavings > 0 && (
            <div className="mt-3 rounded-lg px-3 py-2 flex items-center gap-1.5" style={{ backgroundColor: `${brandColor}0d` }}>
              <Badge className="text-white text-[9px] px-1 py-0 h-4" style={{ backgroundColor: brandColor }}>SAVING</Badge>
              <span className="text-xs font-medium" style={{ color: brandColor }}>
                You&apos;re saving {formatPrice(totalSavings)} on this order
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Proceed to Checkout */}
      <div className="px-4">
        <Button
          onClick={() => setCustomerPage("checkout")}
          className="w-full h-12 text-sm font-bold rounded-xl text-white"
          style={{ backgroundColor: brandColor }}
        >
          Proceed to Checkout
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
