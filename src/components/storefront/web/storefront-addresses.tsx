"use client"

import { useState, useEffect, useCallback } from "react"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store";
import { useAdminStore } from "@/stores/admin-store"
import { ArrowLeft, MapPin, Plus, Trash2, Check, Loader2, Pencil } from "lucide-react"
import type { WebNav } from "./storefront-website"
import type { DeliveryAddress } from "@/stores/cart-store"
import { GoogleAddressPicker } from "./google/address-picker"

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
  latitude?: number | null
  longitude?: number | null
  googlePlaceId?: string | null
  formattedAddress?: string | null
  instructions?: string | null
  isDefault: boolean
}

interface StorefrontAddressesProps {
  brandColor: string
  nav: WebNav
}

export function StorefrontAddresses({ brandColor, nav }: StorefrontAddressesProps) {
  const { isAuthenticated, token } = useAuthStore()
  const { currentBusinessId } = useAdminStore()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editing, setEditing] = useState<DeliveryAddress | null>(null)
  const [error, setError] = useState("")

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

  const openAdd = () => {
    setEditing(null)
    setError("")
    setPickerOpen(true)
  }

  const openEdit = (row: Address) => {
    setEditing({
      id: row.id,
      label: row.label,
      area: row.area,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      landmark: row.landmark,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      latitude: row.latitude,
      longitude: row.longitude,
      googlePlaceId: row.googlePlaceId,
      formattedAddress: row.formattedAddress,
      instructions: row.instructions,
    })
    setError("")
    setPickerOpen(true)
  }

  async function saveAddress(addr: DeliveryAddress): Promise<boolean> {
    const body = {
      label: addr.label || "Home",
      area: addr.area || undefined,
      line1: addr.addressLine1,
      landmark: addr.landmark || undefined,
      city: addr.city,
      state: addr.state || undefined,
      pincode: addr.pincode,
      latitude: addr.latitude ?? undefined,
      longitude: addr.longitude ?? undefined,
      googlePlaceId: addr.googlePlaceId || undefined,
      formattedAddress: addr.formattedAddress || undefined,
      instructions: addr.instructions || undefined,
    }
    try {
      const res = await fetch(addr.id ? `/api/core/storefront/addresses/${addr.id}` : "/api/core/storefront/addresses", {
        method: addr.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-business-id": currentBusinessId || "" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setPickerOpen(false)
        await fetchAddresses()
        return true
      }
      setError(data.error || "Failed to save address")
      return false
    } catch {
      setError("Network error — please try again")
      return false
    }
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

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => nav.goBack("profile")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Saved Addresses</h1>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: brandColor }}>
          <Plus className="w-4 h-4" /> Add New
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-4">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-300" /></div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-2xl">
          <MapPin className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No saved addresses</p>
          <p className="text-xs text-gray-400 mt-1">Search, use your location, or drop a pin on the map</p>
          <button onClick={openAdd} className="mt-4 px-5 py-2 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: brandColor }}>
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
                  {addr.latitude && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      ({addr.latitude.toFixed(5)}, {addr.longitude?.toFixed(5)})
                    </p>
                  )}
                  {addr.instructions && <p className="text-xs text-gray-400 mt-0.5 italic">{addr.instructions}</p>}
                </div>
                <div className="flex gap-2 ml-3">
                  {!addr.isDefault && (
                    <button onClick={() => setDefault(addr.id)} title="Set as default" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-green-50 transition-colors">
                      <Check className="w-4 h-4 text-green-500" />
                    </button>
                  )}
                  <button onClick={() => openEdit(addr)} title="Edit on map" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
                    <Pencil className="w-4 h-4 text-gray-400" />
                  </button>
                  <button onClick={() => deleteAddress(addr.id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <GoogleAddressPicker
        open={pickerOpen}
        initial={editing}
        brandColor={brandColor}
        businessId={currentBusinessId}
        onSave={saveAddress}
        onClose={() => { setPickerOpen(false); setEditing(null); setError("") }}
      />
    </div>
  )
}
