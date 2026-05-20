"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useOrders } from "@/hooks/use-api"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { showSuccess, showError } from "@/lib/toast-utils"
import {
  ChevronRight, Package, MapPin, Heart, HeadphonesIcon, Info,
  LogOut, User, Shield, Store, Settings, Edit2, Check, X, Loader2,
} from "lucide-react"

interface CustomerProfile {
  id: string
  name: string
  email: string | null
  phone: string | null
  gstNumber: string | null
  loyaltyTier: string
  loyaltyPoints: number
  totalOrders: number
  totalSpent: number
}

export function CustomerProfile() {
  const {
    currentBusinessId, currentBusinessName, currentBusinessPrimaryColor,
    setCustomerLoggedIn, setCustomerName, setCustomerPage, setViewMode,
  } = useAdminStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"
  const { user, logout, token } = useAuthStore()

  const { data: ordersData } = useOrders({
    ...(user?.id ? { customerId: user.id } : {}),
    limit: 1,
  })

  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", phone: "", gstNumber: "" })

  const fetchProfile = useCallback(async () => {
    if (!token) return
    setProfileLoading(true)
    try {
      const res = await fetch("/api/core/storefront/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success && json.data) {
        setProfile(json.data)
        setForm({
          name: json.data.name || "",
          email: json.data.email || "",
          phone: json.data.phone || "",
          gstNumber: json.data.gstNumber || "",
        })
      }
    } catch {
      // silently fail — use authStore fallback
    } finally {
      setProfileLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (currentBusinessId) fetchProfile()
  }, [currentBusinessId, fetchProfile])

  const handleSave = async () => {
    if (!form.name.trim()) { showError("Name is required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/core/storefront/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        setProfile(json.data)
        setEditMode(false)
        showSuccess("Profile updated")
      } else {
        showError(json.error || "Failed to update profile")
      }
    } catch {
      showError("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setForm({
      name: profile?.name || user?.name || "",
      email: profile?.email || user?.email || "",
      phone: profile?.phone || "",
      gstNumber: profile?.gstNumber || "",
    })
    setEditMode(false)
  }

  const handleLogout = () => {
    logout()
    setCustomerLoggedIn(false)
    setCustomerName("")
    setCustomerPage("auth")
  }

  const orderCount = ordersData?.pagination?.total || profile?.totalOrders || 0
  const displayName = profile?.name || user?.name || "Guest User"
  const displayPhone = profile?.phone || ""
  const displayEmail = profile?.email || user?.email || ""
  const loyaltyTier = profile?.loyaltyTier || "BRONZE"
  const loyaltyPoints = profile?.loyaltyPoints ?? 0

  const menuItems = [
    {
      id: "orders",
      label: "My Orders",
      desc: "View your order history",
      icon: Package,
      action: () => setCustomerPage("orders"),
    },
    {
      id: "addresses",
      label: "Saved Addresses",
      desc: "Manage delivery addresses",
      icon: MapPin,
      action: () => setCustomerPage("addresses"),
    },
    {
      id: "wishlist",
      label: "Saved Products",
      desc: "Items you saved for later",
      icon: Heart,
      action: () => setCustomerPage("wishlist"),
    },
    {
      id: "support",
      label: "Support",
      desc: "Get help with your orders",
      icon: HeadphonesIcon,
      action: () => setCustomerPage("support"),
    },
    {
      id: "about",
      label: `About ${currentBusinessName || "My Store"}`,
      desc: "App version 2.1.0",
      icon: Info,
      action: () => {},
    },
  ]

  const demoMenuItems = [
    {
      id: "super_admin",
      label: "Super Admin Panel",
      desc: "Switch to platform admin view",
      icon: Shield,
      action: () => setViewMode("super_admin"),
    },
    {
      id: "business",
      label: "Business Owner Panel",
      desc: "Switch to store management view",
      icon: Store,
      action: () => setViewMode("business_owner"),
    },
    {
      id: "delivery",
      label: "Delivery Partner App",
      desc: "Switch to delivery partner view",
      icon: Package,
      action: () => setViewMode("delivery_partner"),
    },
  ]

  return (
    <div className="pb-4">
      {/* Profile Header */}
      <div className="mx-4 mt-3 rounded-2xl p-5 text-white" style={{ background: `linear-gradient(to bottom right, ${brandColor}, ${brandColor}cc)` }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            {profileLoading ? (
              <Loader2 className="w-6 h-6 text-white/70 animate-spin" />
            ) : (
              <User className="w-8 h-8 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{displayName}</h2>
            {displayPhone && <p className="text-sm text-white/70">{displayPhone}</p>}
            {displayEmail && <p className="text-xs text-white/60 truncate">{displayEmail}</p>}
          </div>
          <button
            onClick={() => setEditMode(true)}
            className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors shrink-0"
          >
            <Edit2 className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 flex-1 text-center">
            <p className="text-lg font-bold">{orderCount}</p>
            <p className="text-[10px] text-white/70">Orders</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 flex-1 text-center">
            <p className="text-lg font-bold">{loyaltyTier}</p>
            <p className="text-[10px] text-white/70">Tier</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 flex-1 text-center">
            <p className="text-lg font-bold">{loyaltyPoints.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-white/70">Points</p>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      {editMode && (
        <div className="mx-4 mt-4 bg-white border border-gray-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-800">Edit Profile</p>
            <button onClick={handleCancelEdit} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          {[
            { key: "name", label: "Full Name", type: "text", placeholder: "Your full name" },
            { key: "phone", label: "Phone Number", type: "tel", placeholder: "+91 98765 43210" },
            { key: "email", label: "Email Address", type: "email", placeholder: "you@example.com" },
            { key: "gstNumber", label: "GST Number (optional)", type: "text", placeholder: "22AAAAA0000A1Z5" },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="text-[11px] font-medium text-gray-500 mb-1 block">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400"
              />
            </div>
          ))}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-10 text-sm font-semibold rounded-xl text-white mt-1"
            style={{ backgroundColor: brandColor }}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
            ) : (
              <><Check className="w-4 h-4 mr-2" />Save Changes</>
            )}
          </Button>
        </div>
      )}

      {/* Menu Items */}
      <div className="px-4 mt-4">
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {menuItems.map((item, idx) => {
            const Icon = item.icon
            return (
              <React.Fragment key={item.id}>
                {idx > 0 && <Separator />}
                <button
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-800">{item.label}</p>
                    <p className="text-[10px] text-gray-400">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Demo Mode Switcher */}
      <div className="px-4 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-400">Demo Mode</span>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {demoMenuItems.map((item, idx) => {
            const Icon = item.icon
            return (
              <React.Fragment key={item.id}>
                {idx > 0 && <Separator />}
                <button
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs font-medium text-gray-800">{item.label}</p>
                    <p className="text-[10px] text-gray-400">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 mt-4">
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full h-11 rounded-xl text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      <div className="text-center mt-6 pb-2">
        <p className="text-[10px] text-gray-300">{currentBusinessName || "My Store"} v2.1.0</p>
        <p className="text-[10px] text-gray-300">Powered by Quantix Core</p>
      </div>
    </div>
  )
}
