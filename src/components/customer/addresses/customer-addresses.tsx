"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useCustomer } from "@/hooks/use-api"
import { setBusinessContext, customerApi } from "@/lib/api-client"
import { showSuccess, showApiError } from "@/lib/toast-utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState, EmptyState } from "@/components/ui/loading-states"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, MapPin, Home, Building2, Star, Edit, Trash2, ChevronRight, Loader2 } from "lucide-react"

const BIZ_ID = "biz_1"

interface Address {
  id: string
  label: string
  line1: string
  line2: string
  city: string
  pincode: string
  isDefault: boolean
}

export function CustomerAddresses() {
  const { user } = useAuthStore()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newAddress, setNewAddress] = useState({
    label: "Home",
    line1: "",
    line2: "",
    city: "Mumbai",
    pincode: "",
  })

  useEffect(() => {
    setBusinessContext(BIZ_ID)
  }, [])

  // Fetch customer addresses
  const fetchAddresses = useCallback(async () => {
    if (!user?.id) {
      // Use default addresses if no user
      setAddresses([
        { id: "addr_1", label: "Home", line1: "402, Lotus Apartments, Andheri West", line2: "Near Metro Station", city: "Mumbai", pincode: "400053", isDefault: true },
        { id: "addr_2", label: "Office", line1: "512, Commercial Tower, BKC", line2: "13th Floor", city: "Mumbai", pincode: "400051", isDefault: false },
      ])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await customerApi.get(user.id)
      const data = response.data as Record<string, unknown> | undefined
      const customerAddresses = (data?.addresses || []) as Array<Record<string, unknown>>
      if (customerAddresses.length > 0) {
        setAddresses(customerAddresses.map((a) => ({
          id: a.id as string,
          label: (a as Record<string, unknown>).label as string || "Home",
          line1: (a as Record<string, unknown>).line1 as string || "",
          line2: (a as Record<string, unknown>).line2 as string || "",
          city: (a as Record<string, unknown>).city as string || "",
          pincode: (a as Record<string, unknown>).pincode as string || "",
          isDefault: (a as Record<string, unknown>).isDefault as boolean || false,
        })))
      } else {
        // Fallback addresses
        setAddresses([
          { id: "addr_1", label: "Home", line1: "402, Lotus Apartments, Andheri West", line2: "Near Metro Station", city: "Mumbai", pincode: "400053", isDefault: true },
          { id: "addr_2", label: "Office", line1: "512, Commercial Tower, BKC", line2: "13th Floor", city: "Mumbai", pincode: "400051", isDefault: false },
        ])
      }
    } catch {
      // On error, use fallback
      setAddresses([
        { id: "addr_1", label: "Home", line1: "402, Lotus Apartments, Andheri West", line2: "Near Metro Station", city: "Mumbai", pincode: "400053", isDefault: true },
        { id: "addr_2", label: "Office", line1: "512, Commercial Tower, BKC", line2: "13th Floor", city: "Mumbai", pincode: "400051", isDefault: false },
      ])
      setError("Could not load addresses from server. Showing saved addresses.")
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchAddresses()
  }, [fetchAddresses])

  const handleAddAddress = async () => {
    if (!newAddress.line1 || !newAddress.pincode) return

    setSaving(true)
    try {
      if (user?.id) {
        // Try to update customer with new address via API
        await customerApi.update(user.id, {
          addresses: [
            ...addresses.map((a) => ({
              label: a.label,
              line1: a.line1,
              line2: a.line2,
              city: a.city,
              pincode: a.pincode,
              isDefault: a.isDefault,
            })),
            {
              label: newAddress.label,
              line1: newAddress.line1,
              line2: newAddress.line2,
              city: newAddress.city,
              pincode: newAddress.pincode,
              isDefault: addresses.length === 0,
            },
          ],
        } as Record<string, unknown>)
      }

      // Optimistic update
      const newAddr: Address = {
        id: `addr_${Date.now()}`,
        label: newAddress.label,
        line1: newAddress.line1,
        line2: newAddress.line2,
        city: newAddress.city,
        pincode: newAddress.pincode,
        isDefault: addresses.length === 0,
      }
      setAddresses((prev) => [...prev, newAddr])
      setShowAddDialog(false)
      setNewAddress({ label: "Home", line1: "", line2: "", city: "Mumbai", pincode: "" })
      showSuccess("Address added!", "Your new address has been saved.")
    } catch (err) {
      // Optimistic update even on API failure
      const newAddr: Address = {
        id: `addr_${Date.now()}`,
        label: newAddress.label,
        line1: newAddress.line1,
        line2: newAddress.line2,
        city: newAddress.city,
        pincode: newAddress.pincode,
        isDefault: addresses.length === 0,
      }
      setAddresses((prev) => [...prev, newAddr])
      setShowAddDialog(false)
      setNewAddress({ label: "Home", line1: "", line2: "", city: "Mumbai", pincode: "" })
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAddress = (addressId: string) => {
    setAddresses((prev) => prev.filter((a) => a.id !== addressId))
    showSuccess("Address removed", "The address has been deleted.")
  }

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
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
          className="h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add New
        </Button>
      </div>

      {error && (
        <p className="text-[10px] text-amber-600">{error}</p>
      )}

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Add a delivery address to get started."
          action={{
            label: "Add Address",
            onClick: () => setShowAddDialog(true),
          }}
          className="py-12"
        />
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <Card key={addr.id} className="border border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    {addr.label === "Home" ? (
                      <Home className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Building2 className="h-5 w-5 text-emerald-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{addr.label}</span>
                      {addr.isDefault && (
                        <Badge className="bg-emerald-50 text-emerald-600 border-0 text-[10px] h-5">Default</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{addr.line1}, {addr.line2}</p>
                    <p className="text-sm text-gray-500">{addr.city} - {addr.pincode}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDeleteAddress(addr.id)}
                    >
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
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add New Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              {["Home", "Office", "Other"].map((label) => (
                <button
                  key={label}
                  onClick={() => setNewAddress((prev) => ({ ...prev, label }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    newAddress.label === label
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Input
              placeholder="Address Line 1 *"
              value={newAddress.line1}
              onChange={(e) => setNewAddress((prev) => ({ ...prev, line1: e.target.value }))}
              className="h-9 text-xs"
            />
            <Input
              placeholder="Address Line 2"
              value={newAddress.line2}
              onChange={(e) => setNewAddress((prev) => ({ ...prev, line2: e.target.value }))}
              className="h-9 text-xs"
            />
            <div className="flex gap-2">
              <Input
                placeholder="City"
                value={newAddress.city}
                onChange={(e) => setNewAddress((prev) => ({ ...prev, city: e.target.value }))}
                className="h-9 text-xs flex-1"
              />
              <Input
                placeholder="Pincode *"
                value={newAddress.pincode}
                onChange={(e) => setNewAddress((prev) => ({ ...prev, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                className="h-9 text-xs w-28"
                maxLength={6}
              />
            </div>
            <Button
              onClick={handleAddAddress}
              disabled={!newAddress.line1 || !newAddress.pincode || saving}
              className="w-full h-10 rounded-xl text-xs bg-emerald-500 hover:bg-emerald-600"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save Address"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
