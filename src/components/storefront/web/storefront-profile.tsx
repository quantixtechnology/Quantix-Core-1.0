"use client"

import { useAuthStore } from "@/stores/auth-store"
import { Package, MapPin, LogOut, ArrowLeft, Phone, Lock } from "lucide-react"
import type { WebNav } from "./storefront-website"

interface StorefrontProfileProps {
  brandColor: string
  nav: WebNav
}

export function StorefrontProfile({ brandColor, nav }: StorefrontProfileProps) {
  const { isAuthenticated, user, logout } = useAuthStore()
  const hasPassword = user?.hasPassword

  if (!isAuthenticated || !user) {
    nav.go("auth")
    return null
  }

  const initial = (user.name || "U").charAt(0).toUpperCase()
  const displayPhone = user.email?.endsWith("@otp.placeholder")
    ? user.email.replace("@otp.placeholder", "")
    : null

  function handleLogout() {
    logout()
    nav.go("home")
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => nav.goBack("home")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Account</h1>

      {/* Profile card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0"
            style={{ backgroundColor: brandColor }}
          >
            {initial}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{user.name || "Guest"}</h2>
            {displayPhone && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                <Phone className="w-3.5 h-3.5" />
                <span>+91 {displayPhone}</span>
              </div>
            )}
            {!displayPhone && user.email && !user.email.endsWith("@otp.placeholder") && (
              <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
            )}
          </div>
        </div>
      </div>

      {/* Nav links */}
      <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 mb-6">
        <button
          onClick={() => nav.go("orders")}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
            <Package className="w-4 h-4" style={{ color: brandColor }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">My Orders</p>
            <p className="text-xs text-gray-500">Track and view your orders</p>
          </div>
          <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180" />
        </button>

        <button
          onClick={() => nav.go("addresses")}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
            <MapPin className="w-4 h-4" style={{ color: brandColor }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Saved Addresses</p>
            <p className="text-xs text-gray-500">Manage your delivery addresses</p>
          </div>
          <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180" />
        </button>

        <button
          onClick={() => nav.go("password")}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
            <Lock className="w-4 h-4" style={{ color: brandColor }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">
              {hasPassword ? "Change Password" : "Create Password"}
            </p>
            <p className="text-xs text-gray-500">
              {hasPassword ? "Update your login password" : "Set a password for quick login"}
            </p>
          </div>
          <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180" />
        </button>
      </div>

      {/* Logout */}
      <div className="bg-white border border-gray-200 rounded-2xl">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-red-50 transition-colors text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
            <LogOut className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-sm font-semibold text-red-600">Sign Out</p>
        </button>
      </div>
    </div>
  )
}
