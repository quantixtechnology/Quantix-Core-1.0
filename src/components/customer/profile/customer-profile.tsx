"use client"

import React, { useEffect, useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useOrders } from "@/hooks/use-api"
import { setBusinessContext } from "@/lib/api-client"
import { getDemoBusinessName } from "@/lib/demo-data"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  ChevronRight,
  Package,
  MapPin,
  Heart,
  HeadphonesIcon,
  Info,
  LogOut,
  User,
  Shield,
  Store,
  Settings,
} from "lucide-react"

const BIZ_ID = "biz_1"

export function CustomerProfile() {
  const {
    customerName,
    demoBusinessId,
    setCustomerLoggedIn,
    setCustomerName,
    setCustomerPage,
    setViewMode,
  } = useAdminStore()
  const { user, logout } = useAuthStore()

  // Fetch order count for stats
  const { data: ordersData } = useOrders({
    ...(user?.id ? { customerId: user.id } : {}),
    limit: 1,
  })

  useEffect(() => {
    setBusinessContext(BIZ_ID)
  }, [])

  const orderCount = ordersData?.pagination?.total || 0
  const displayName = user?.name || customerName || "Guest User"
  const displayPhone = user?.email ? `+91 ${user.email}` : "+91 98765 11111"
  const displayEmail = user?.email || ""

  const handleLogout = () => {
    logout()
    setCustomerLoggedIn(false)
    setCustomerName("")
    setCustomerPage("auth")
  }

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
      action: () => {},
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
      label: `About ${getDemoBusinessName(demoBusinessId)}`,
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
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 mx-4 mt-3 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{displayName}</h2>
            {displayPhone && <p className="text-sm text-emerald-100">{displayPhone}</p>}
            {displayEmail && <p className="text-xs text-emerald-200">{displayEmail}</p>}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 flex-1 text-center">
            <p className="text-lg font-bold">{orderCount}</p>
            <p className="text-[10px] text-emerald-100">Orders</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 flex-1 text-center">
            <p className="text-lg font-bold">GOLD</p>
            <p className="text-[10px] text-emerald-100">Tier</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 flex-1 text-center">
            <p className="text-lg font-bold">1,420</p>
            <p className="text-[10px] text-emerald-100">Points</p>
          </div>
        </div>
      </div>

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

      {/* App Info */}
      <div className="text-center mt-6 pb-2">
        <p className="text-[10px] text-gray-300">{getDemoBusinessName(demoBusinessId)} v2.1.0</p>
        <p className="text-[10px] text-gray-300">Powered by Quantix Core</p>
      </div>
    </div>
  )
}
