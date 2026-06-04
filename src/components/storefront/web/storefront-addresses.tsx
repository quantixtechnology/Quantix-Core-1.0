"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { ArrowLeft, MapPin, Plus, Trash2, Check, Loader2, Navigation } from "lucide-react"
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
}

interface StorefrontAddressesProps {
  brandColor: string
  nav: WebNav
}

const LABELS = ["Home", "Office", "Other"]

const emptyForm = () => ({
  label: "Home", area: "", line1: "", landmark: "", city: "", state: "", pincode: "", instructions: "",
  lat: undefined as number | undefined, lng: undefined as number | undefined, gpsAccuracy: undefined as number | undefined,
})

export function StorefrontAddresses({ brandColor, nav }: StorefrontAddressesProps) {
  const { isAuthenticated, token } = useAuthStore()
  const { currentBusinessId } = useAdminStore()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState(emptyForm())
  const [gpsLoading, setGpsLoading] = useState(false)

  const fetchAddresses = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/core/storefront/addresses", { headers: { Authorization: `Bearer ${token}`, "x-business-id": currentBusinessId || "" } })
      const data = await res.json()
      if (data.success) setAddresses(data.data || [])
    } catch { /* non-critical */ } finally { setLoading(false) }
  }, [token, currentBusinessId])

  useEffect(() => {
    if (isAuthenticated) fetchAddresses()
    else setLoading(false)
  }, [isAuthenticated, fetchAddresses])

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <MapPin className="w-16 h-16 text-gray-200" />
        <h2 className="text-lg font-bold text-gray-900">Sign in to manage addresses</h2>
        <button onClick={() => nav.go("auth")} className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: brandColor }}>
          Sign In
        </button>
      </div>
    )
  }

  const captureGps = () => {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((p) => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude, gpsAccuracy: pos.coords.accuracy }))
        setGpsLoading(false)
      },
      () => setGpsLoading(false),
      { timeout: 10000 },
    )
  }

  async function saveAddress() {
    if (!form.line1 || !form.city || !form.pincode) { setError("House/street, city, and pincode are required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/core/storefront/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-business-id": currentBusinessId || "" },
        body: JSON.stringify({
          label: form.label,
          area: form.area || undefined,
          line1: form.line1,
          landmark: form.landmark || undefined,
          city: form.city,
          state: form.state || undefined,
          pincode: form.pincode,
          instructions: form.instructions || undefined,
          latitude: form.lat,
          longitude: form.lng,
          gpsAccuracy: form.gpsAccuracy,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setForm(emptyForm()); setShowForm(false); await fetchAddresses()
      } else setError(data.error || "Failed to save")
    } catch { setError("Network error") } finally { setSaving(false) }
  }

  async function deleteAddress(id: string) {
    if (!confirm("Delete this address?")) return
    try {
      await fetch(`/api/core/storefront/addresses/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}`, "x-business-id": currentBusinessId || "" } })
      await fetchAddresses()
    } catch { /* non-critical */ }
  }

  async function setDefault(id: string) {
    try {
      await fetch(`/api/core/storefront/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-business-id": currentBusinessId || "" },
        body: JSON.stringify({ isDefault: true }),
      })
      await fetchAddresses()
    } catch { /* non-critical */ }
  }

  const inputCls = "w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white"

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => nav.goBack("profile")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Saved Addresses</h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: brandColor }}>
            <Plus className="w-4 h-4" /> Add New
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">New Address</h2>
          <div className="space-y-3">
            {/* Label chips */}
            <div className="flex gap-2">
              {LABELS.map((l) => (
                <button key={l} type="button" onClick={() => setForm((p) => ({ ...p, label: l }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                  style={form.label === l ? { borderColor: brandColor, backgroundColor: `${brandColor}10`, color: brandColor } : { borderColor: "#e5e7eb", color: "#4b5563" }}>
                  {l}
                </button>
              ))}
            </div>

            {/* GPS button */}
            <button type="button" onClick={captureGps} disabled={gpsLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed rounded-xl text-xs font-medium transition-colors"
              style={{ borderColor: `${brandColor}60`, color: brandColor }}>
              {gpsLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Detecting location…</> : <><Navigation className="w-3.5 h-3.5" /> Use Current Location</>}
            </button>
            {form.lat && <p className="text-[10px] text-center text-green-600">GPS captured ({form.lat.toFixed(4)}, {form.lng?.toFixed(4)})</p>}

            <input type="text" placeholder="Area / Locality" value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))} className={inputCls} />
            <input type="text" placeholder="House No / Street *" value={form.line1} onChange={(e) => setForm((p) => ({ ...p, line1: e.target.value }))} className={inputCls} />
            <input type="text" placeholder="Landmark (optional)" value={form.landmark} onChange={(e) => setForm((p) => ({ ...p, landmark: e.target.value }))} className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="City *" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} className={inputCls} />
              <input type="text" placeholder="State" value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} className={inputCls} />
            </div>
            <input type="text" placeholder="Pincode *" value={form.pincode} onChange={(e) => setForm((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} className={inputCls} />
            <textarea placeholder="Delivery instructions (optional)" value={form.instructions} onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 resize-none bg-white" />

            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={saveAddress} disabled={saving} className="flex-1 h-10 text-sm font-semibold text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: brandColor }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Address"}
              </button>
              <button onClick={() => { setShowForm(false); setForm(emptyForm()); setError("") }} className="flex-1 h-10 text-sm text-gray-600 border border-gray-200 rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-300" /></div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-2xl">
          <MapPin className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No saved addresses</p>
          <p className="text-xs text-gray-400 mt-1">Add an address to speed up checkout</p>
          <button onClick={() => setShowForm(true)} className="mt-4 px-5 py-2 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: brandColor }}>
            Add Address
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {addr.label && <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{addr.label}</span>}
                    {addr.isDefault && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: brandColor }}>Default</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{addr.addressLine1}</p>
                  {addr.area && <p className="text-xs text-gray-500">{addr.area}</p>}
                  {addr.landmark && <p className="text-xs text-gray-400">Near {addr.landmark}</p>}
                  <p className="text-sm text-gray-600">{addr.city}, {addr.state} - {addr.pincode}</p>
                  {addr.instructions && <p className="text-xs text-gray-400 mt-0.5 italic">{addr.instructions}</p>}
                </div>
                <div className="flex gap-2 ml-3">
                  {!addr.isDefault && (
                    <button onClick={() => setDefault(addr.id)} title="Set as default" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-green-50 transition-colors">
                      <Check className="w-4 h-4 text-green-500" />
                    </button>
                  )}
                  <button onClick={() => deleteAddress(addr.id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors">
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
