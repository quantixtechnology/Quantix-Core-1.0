"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { ArrowLeft, MapPin, Plus, Trash2, Check, Loader2 } from "lucide-react"
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

interface StorefrontAddressesProps {
  brandColor: string
  nav: WebNav
}

export function StorefrontAddresses({ brandColor, nav }: StorefrontAddressesProps) {
  const { isAuthenticated, token } = useAuthStore()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ label: "", line1: "", line2: "", city: "", pincode: "" })

  const fetchAddresses = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/core/storefront/addresses", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setAddresses(data.data || [])
    } catch { /* non-critical */ } finally { setLoading(false) }
  }, [token])

  useEffect(() => {
    if (isAuthenticated) fetchAddresses()
    else setLoading(false)
  }, [isAuthenticated, fetchAddresses])

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <MapPin className="w-16 h-16 text-gray-200" />
        <h2 className="text-lg font-bold text-gray-900">Sign in to manage addresses</h2>
        <button
          onClick={() => nav.go("auth", { prevPage: "addresses" } as never)}
          className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl"
          style={{ backgroundColor: brandColor }}
        >
          Sign In
        </button>
      </div>
    )
  }

  async function saveAddress() {
    if (!form.line1 || !form.city || !form.pincode) { setError("Address, city, and pincode are required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/core/storefront/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label: form.label || undefined, line1: form.line1, line2: form.line2 || undefined, city: form.city, pincode: form.pincode }),
      })
      const data = await res.json()
      if (data.success) {
        setForm({ label: "", line1: "", line2: "", city: "", pincode: "" })
        setShowForm(false)
        await fetchAddresses()
      } else setError(data.error || "Failed to save")
    } catch { setError("Network error") } finally { setSaving(false) }
  }

  async function deleteAddress(id: string) {
    if (!confirm("Delete this address?")) return
    try {
      await fetch(`/api/core/storefront/addresses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      await fetchAddresses()
    } catch { /* non-critical */ }
  }

  async function setDefault(id: string) {
    try {
      await fetch(`/api/core/storefront/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isDefault: true }),
      })
      await fetchAddresses()
    } catch { /* non-critical */ }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => nav.go(nav.prevPage || "profile")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Saved Addresses</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl"
            style={{ backgroundColor: brandColor }}
          >
            <Plus className="w-4 h-4" />
            Add New
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">New Address</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Label (Home, Work…)"
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
            />
            <input
              type="text"
              placeholder="Address Line 1 *"
              value={form.line1}
              onChange={(e) => setForm((p) => ({ ...p, line1: e.target.value }))}
              className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
            />
            <input
              type="text"
              placeholder="Address Line 2"
              value={form.line2}
              onChange={(e) => setForm((p) => ({ ...p, line2: e.target.value }))}
              className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="City *"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                className="h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
              />
              <input
                type="text"
                placeholder="Pincode *"
                value={form.pincode}
                onChange={(e) => setForm((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                className="h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveAddress}
                disabled={saving}
                className="flex-1 h-10 text-sm font-semibold text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: brandColor }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Address"}
              </button>
              <button
                onClick={() => { setShowForm(false); setForm({ label: "", line1: "", line2: "", city: "", pincode: "" }); setError("") }}
                className="flex-1 h-10 text-sm text-gray-600 border border-gray-200 rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-2xl">
          <MapPin className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No saved addresses</p>
          <p className="text-xs text-gray-400 mt-1">Add an address to speed up checkout</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {addr.label && <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{addr.label}</span>}
                    {addr.isDefault && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: brandColor }}>
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{addr.addressLine1}</p>
                  {addr.addressLine2 && <p className="text-sm text-gray-600">{addr.addressLine2}</p>}
                  <p className="text-sm text-gray-600">{addr.city}, {addr.state} - {addr.pincode}</p>
                </div>
                <div className="flex gap-2 ml-3">
                  {!addr.isDefault && (
                    <button
                      onClick={() => setDefault(addr.id)}
                      title="Set as default"
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-green-50 transition-colors"
                    >
                      <Check className="w-4 h-4 text-green-500" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteAddress(addr.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
