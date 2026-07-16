"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store";
import { showSuccess, showError, showApiError } from "@/lib/toast-utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/loading-states"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, MapPin, Home, Building2, Loader2, Navigation, Trash2, Star } from "lucide-react"

interface Address {
  id: string
  label: string | null
  area: string | null
  addressLine1: string
  addressLine2: string | null
  landmark: string | null
  city: string
  state: string
  pincode: string
  instructions: string | null
  isDefault: boolean
  latitude?: number | null
  longitude?: number | null
}

export function CustomerAddresses() {
  const { token } = useAuthStore()
  const { currentBusinessPrimaryColor, currentBusinessId } = useAdminStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"

  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serviceabilityWarning, setServiceabilityWarning] = useState<string | null>(null)
  const [checkingServiceability, setCheckingServiceability] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)

  const [newAddress, setNewAddress] = useState({
    label: "Home",
    area: "",
    line1: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    instructions: "",
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    gpsAccuracy: undefined as number | undefined,
  })

  const fetchAddresses = useCallback(async () => {
    if (!token) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch("/api/core/storefront/addresses", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) setAddresses(json.data || [])
    } catch {
      setAddresses([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchAddresses() }, [fetchAddresses])

  const handleGPS = () => {
    if (!navigator.geolocation) { showError("GPS not available", "Your browser doesn't support location access."); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setNewAddress((prev) => ({ ...prev, latitude, longitude, gpsAccuracy: accuracy }))
        // Try reverse-geocode via nearest-store to get city/pincode hint
        try {
          const res = await fetch(
            `/api/core/storefront/nearest-store?businessId=${currentBusinessId}&lat=${latitude}&lng=${longitude}`
          )
          const json = await res.json()
          if (json.success && json.data?.store) {
            const store = json.data.store
            setNewAddress((prev) => ({
              ...prev,
              city: prev.city || store.city || "",
              pincode: prev.pincode || store.pincode || "",
            }))
            setServiceabilityWarning(null)
          } else {
            setServiceabilityWarning("Your GPS location may be outside our delivery area.")
          }
        } catch { /* ignore */ }
        setGpsLoading(false)
      },
      () => {
        showError("Location denied", "Please enable location permissions and try again.")
        setGpsLoading(false)
      },
      { timeout: 10000 }
    )
  }

  const handleAddAddress = async () => {
    if (!newAddress.line1 || !newAddress.city || !newAddress.pincode) return

    // Serviceability check
    setCheckingServiceability(true)
    setServiceabilityWarning(null)
    try {
      const res = await fetch(
        `/api/core/storefront/nearest-store?businessId=${currentBusinessId}&pincode=${newAddress.pincode}`
      )
      const json = await res.json()
      if (!json.success || json.serviceable === false) {
        setServiceabilityWarning("This pincode may be outside our delivery area. You can save it, but delivery may not be available.")
      }
    } catch { /* non-blocking */ }
    setCheckingServiceability(false)

    setSaving(true)
    try {
      const res = await fetch("/api/core/storefront/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          label: newAddress.label,
          area: newAddress.area || undefined,
          line1: newAddress.line1,
          landmark: newAddress.landmark || undefined,
          city: newAddress.city,
          state: newAddress.state || undefined,
          pincode: newAddress.pincode,
          instructions: newAddress.instructions || undefined,
          latitude: newAddress.latitude,
          longitude: newAddress.longitude,
          gpsAccuracy: newAddress.gpsAccuracy,
          isDefault: addresses.length === 0,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setAddresses((prev) => [...prev, json.data])
        showSuccess("Address added!", "Your new address has been saved.")
      } else {
        showError("Failed to save", json.error || "Could not save address.")
      }
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
      setShowAddDialog(false)
      setNewAddress({ label: "Home", area: "", line1: "", landmark: "", city: "", state: "", pincode: "", instructions: "", latitude: undefined, longitude: undefined, gpsAccuracy: undefined })
    }
  }

  const handleSetDefault = async (addressId: string) => {
    if (!token) return
    try {
      await fetch(`/api/core/storefront/addresses/${addressId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isDefault: true }),
      })
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === addressId })))
      showSuccess("Default updated", "This address is now your default.")
    } catch { showError("Failed", "Could not update default address.") }
  }

  const handleDelete = async (addressId: string) => {
    if (!token) return
    try {
      const res = await fetch(`/api/core/storefront/addresses/${addressId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== addressId))
        showSuccess("Removed", "Address deleted.")
      }
    } catch { showError("Failed", "Could not delete address.") }
  }

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border border-gray-100">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">My Addresses</h2>
        <Button
          size="sm"
          className="h-8 text-xs text-white"
          style={{ backgroundColor: brandColor }}
          onClick={() => { setServiceabilityWarning(null); setShowAddDialog(true) }}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add New
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Add a delivery address to get started."
          action={{ label: "Add Address", onClick: () => { setServiceabilityWarning(null); setShowAddDialog(true) } }}
          className="py-12"
        />
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <Card key={addr.id} className="border border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${brandColor}12` }}>
                    {addr.label === "Home" ? (
                      <Home className="h-5 w-5" style={{ color: brandColor }} />
                    ) : (
                      <Building2 className="h-5 w-5" style={{ color: brandColor }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{addr.label || "Address"}</span>
                      {addr.isDefault && (
                        <Badge className="border-0 text-[10px] h-5" style={{ backgroundColor: `${brandColor}12`, color: brandColor }}>Default</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{addr.addressLine1}</p>
                    {addr.area && <p className="text-xs text-gray-500">{addr.area}</p>}
                    {addr.landmark && <p className="text-xs text-gray-400">Near {addr.landmark}</p>}
                    <p className="text-sm text-gray-500">{addr.city}, {addr.state} - {addr.pincode}</p>
                    {addr.instructions && <p className="text-xs text-gray-400 italic">{addr.instructions}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {!addr.isDefault && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSetDefault(addr.id)} title="Set as default">
                        <Star className="h-3.5 w-3.5 text-gray-400" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(addr.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Address Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) setServiceabilityWarning(null) }}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add New Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Label chips */}
            <div className="flex gap-2">
              {["Home", "Office", "Other"].map((label) => (
                <button
                  key={label}
                  onClick={() => setNewAddress((prev) => ({ ...prev, label }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                  style={newAddress.label === label
                    ? { borderColor: brandColor, backgroundColor: `${brandColor}10`, color: brandColor }
                    : { borderColor: "#e5e7eb", color: "#4b5563" }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* GPS Button */}
            <button
              onClick={handleGPS}
              disabled={gpsLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed rounded-xl text-xs font-medium transition-colors"
              style={{ borderColor: `${brandColor}50`, color: brandColor }}
            >
              {gpsLoading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching location...</>
              ) : (
                <><Navigation className="w-3.5 h-3.5" /> Use my current location</>
              )}
            </button>
            {newAddress.latitude && (
              <p className="text-[10px] text-center" style={{ color: brandColor }}>
                GPS captured ({newAddress.latitude.toFixed(4)}, {newAddress.longitude?.toFixed(4)})
              </p>
            )}

            <Input
              placeholder="Area / Locality"
              value={newAddress.area}
              onChange={(e) => setNewAddress((prev) => ({ ...prev, area: e.target.value }))}
              className="h-9 text-xs"
            />
            <Input
              placeholder="House No / Street *"
              value={newAddress.line1}
              onChange={(e) => setNewAddress((prev) => ({ ...prev, line1: e.target.value }))}
              className="h-9 text-xs"
            />
            <Input
              placeholder="Landmark (optional)"
              value={newAddress.landmark}
              onChange={(e) => setNewAddress((prev) => ({ ...prev, landmark: e.target.value }))}
              className="h-9 text-xs"
            />
            <div className="flex gap-2">
              <Input
                placeholder="City *"
                value={newAddress.city}
                onChange={(e) => setNewAddress((prev) => ({ ...prev, city: e.target.value }))}
                className="h-9 text-xs flex-1"
              />
              <Input
                placeholder="State"
                value={newAddress.state}
                onChange={(e) => setNewAddress((prev) => ({ ...prev, state: e.target.value }))}
                className="h-9 text-xs flex-1"
              />
            </div>
            <Input
              placeholder="Pincode *"
              value={newAddress.pincode}
              onChange={(e) => setNewAddress((prev) => ({ ...prev, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
              className="h-9 text-xs"
              maxLength={6}
            />
            <Input
              placeholder="Delivery instructions (optional)"
              value={newAddress.instructions}
              onChange={(e) => setNewAddress((prev) => ({ ...prev, instructions: e.target.value }))}
              className="h-9 text-xs"
            />

            {serviceabilityWarning && (
              <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{serviceabilityWarning}</p>
            )}

            <Button
              onClick={handleAddAddress}
              disabled={!newAddress.line1 || !newAddress.city || !newAddress.pincode || saving || checkingServiceability}
              className="w-full h-10 rounded-xl text-xs text-white"
              style={{ backgroundColor: brandColor }}
            >
              {saving || checkingServiceability ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {checkingServiceability ? "Checking delivery..." : "Saving..."}
                </span>
              ) : "Save Address"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
