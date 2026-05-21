"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { ArrowLeft, Tag, Copy, Check, Clock, Loader2 } from "lucide-react"
import { showSuccess } from "@/lib/toast-utils"

interface Coupon {
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

export function CustomerCoupons() {
  const { setCustomerPage, currentBusinessPrimaryColor } = useAdminStore()
  const { token } = useAuthStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  const fetchCoupons = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/core/storefront/coupons", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) setCoupons(json.data || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchCoupons() }, [fetchCoupons])

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(code)
    showSuccess(`Code "${code}" copied!`)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatDiscount = (c: Coupon) =>
    c.type === "PERCENTAGE" ? `${c.value}% off` : `₹${c.value} off`

  const formatExpiry = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    } catch {
      return iso
    }
  }

  const daysLeft = (iso: string) => {
    const diff = new Date(iso).getTime() - Date.now()
    const days = Math.ceil(diff / 86_400_000)
    if (days <= 0) return "Expires today"
    if (days === 1) return "1 day left"
    return `${days} days left`
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setCustomerPage("profile")}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900">My Coupons</h1>
          {!loading && <p className="text-xs text-gray-400">{coupons.length} available</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <Tag className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-sm font-semibold text-gray-600 mb-1">No coupons available</h3>
          <p className="text-xs text-gray-400">Check back later for exclusive offers</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="bg-white border border-dashed border-gray-200 rounded-2xl overflow-hidden"
            >
              {/* Colored band */}
              <div className="h-1.5 w-full" style={{ backgroundColor: brandColor }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Code + copy */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-extrabold tracking-widest text-gray-900">
                        {coupon.code}
                      </span>
                      <button
                        onClick={() => handleCopy(coupon.code)}
                        className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
                        style={{ backgroundColor: `${brandColor}15` }}
                      >
                        {copied === coupon.code
                          ? <Check className="w-3.5 h-3.5" style={{ color: brandColor }} />
                          : <Copy className="w-3.5 h-3.5" style={{ color: brandColor }} />
                        }
                      </button>
                    </div>

                    <p className="text-xs font-semibold mb-0.5" style={{ color: brandColor }}>
                      {formatDiscount(coupon)}
                      {coupon.maxDiscount ? ` (max ₹${coupon.maxDiscount})` : ""}
                    </p>
                    {coupon.description && (
                      <p className="text-[11px] text-gray-500 mb-1">{coupon.description}</p>
                    )}
                    <p className="text-[10px] text-gray-400">
                      Min order ₹{coupon.minOrder}
                      {coupon.usageLeft !== null ? ` • ${coupon.usageLeft} uses left` : ""}
                    </p>
                  </div>

                  {/* Discount badge */}
                  <div
                    className="shrink-0 rounded-xl px-3 py-2 text-center"
                    style={{ backgroundColor: `${brandColor}10` }}
                  >
                    <p className="text-lg font-extrabold leading-tight" style={{ color: brandColor }}>
                      {coupon.type === "PERCENTAGE" ? `${coupon.value}%` : `₹${coupon.value}`}
                    </p>
                    <p className="text-[9px] text-gray-500">{coupon.type === "PERCENTAGE" ? "OFF" : "FLAT"}</p>
                  </div>
                </div>

                {/* Expiry */}
                <div className="mt-3 pt-3 border-t border-dashed border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] text-gray-400">Expires {formatExpiry(coupon.validUntil)}</span>
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: brandColor }}>
                    {daysLeft(coupon.validUntil)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
