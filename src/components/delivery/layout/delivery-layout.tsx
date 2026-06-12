"use client"

import { useState, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { usePwaInstall } from "@/hooks/use-pwa-install"
import { partnerProfile, notifications } from "@/components/delivery/data"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Home,
  DollarSign,
  User,
  Bell,
  Wifi,
  WifiOff,
  ChevronLeft,
  Download,
  X,
} from "lucide-react"

// "Install Delivery App" banner — Android/desktop get the native prompt,
// iOS Safari gets Add-to-Home-Screen instructions (no beforeinstallprompt).
function DeliveryInstallBanner({ businessName }: { businessName?: string | null }) {
  const { canInstall, isIos, install, dismiss } = usePwaInstall()
  if (!canInstall) return null
  return (
    <div className="bg-teal-50 border-b border-teal-200 px-4 py-2.5 flex items-center gap-3">
      <Download className="h-4 w-4 text-teal-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-teal-800">Install Delivery App</p>
        <p className="text-[11px] text-teal-600 truncate">
          {isIos
            ? "Tap Share, then “Add to Home Screen”"
            : `Add ${businessName ? `${businessName} Delivery` : "the delivery app"} to your home screen`}
        </p>
      </div>
      {!isIos && (
        <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white shrink-0" onClick={install}>
          Install
        </Button>
      )}
      <button onClick={dismiss} className="text-teal-400 hover:text-teal-600 shrink-0" aria-label="Dismiss install banner">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const { deliveryPage, setDeliveryPage, deliveryLoggedIn, deliveryPartnerName } = useAdminStore()
  const { currentBusinessName } = useAuthStore()
  const [isOnline, setIsOnline] = useState(true)
  const [showNotifications, setShowNotifications] = useState(false)

  // Delivery PWA identity — swap the manifest to the delivery flavor and
  // retitle the tab ("{Business} Delivery") while the delivery UI is mounted.
  // The browser reads the manifest at install time, so installs from any
  // delivery screen get the workforce app, not the customer storefront.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    const prevHref = link?.getAttribute("href") ?? null
    link?.setAttribute("href", "/manifest.json?app=delivery")
    const prevTitle = document.title
    document.title = currentBusinessName ? `${currentBusinessName} Delivery` : "Delivery App"
    return () => {
      if (link && prevHref) link.setAttribute("href", prevHref)
      document.title = prevTitle
    }
  }, [currentBusinessName])

  const unreadCount = notifications.filter((n) => !n.read).length

  const navItems = [
    { id: "dashboard" as const, label: "Orders", icon: Home },
    { id: "earnings" as const, label: "Earnings", icon: DollarSign },
    { id: "profile" as const, label: "Profile", icon: User },
  ]

  const currentPageNav = deliveryPage === "order-detail" || deliveryPage === "otp-verify" || deliveryPage === "navigation"

  if (!deliveryLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-full max-w-md mx-auto min-h-screen bg-white">
          <DeliveryInstallBanner businessName={currentBusinessName} />
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="w-full max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col relative">
        {/* Header */}
        <header className="bg-teal-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-3">
            {currentPageNav ? (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-teal-700 h-9 w-9 -ml-1"
                onClick={() => setDeliveryPage("dashboard")}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            ) : null}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center text-sm font-bold border-2 border-white/30">
                {(deliveryPartnerName || partnerProfile.name).charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">
                  {deliveryPartnerName || partnerProfile.name}
                </p>
                <div className="flex items-center gap-1.5">
                  {isOnline ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-green-300 animate-pulse" />
                      <span className="text-xs text-teal-100">Online</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-gray-400" />
                      <span className="text-xs text-teal-200">Offline</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Online/Offline Toggle */}
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-300" />
              ) : (
                <WifiOff className="h-4 w-4 text-gray-300" />
              )}
              <Switch
                checked={isOnline}
                onCheckedChange={setIsOnline}
                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-400 h-5 w-9"
              />
            </div>

            {/* Notification Bell */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-teal-700 h-9 w-9 relative"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center p-0 border-0">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </div>
        </header>

        {/* Notification Panel */}
        {showNotifications && (
          <div className="absolute top-14 right-2 left-2 z-50 bg-white rounded-lg shadow-xl border border-gray-200 max-h-80 overflow-y-auto">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Notifications</h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-teal-600 text-xs h-7"
                onClick={() => setShowNotifications(false)}
              >
                Close
              </Button>
            </div>
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 border-b border-gray-50 last:border-0 ${!n.read ? "bg-teal-50/50" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && (
                    <span className="h-2 w-2 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                  )}
                  <div className={!n.read ? "" : "pl-4"}>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Install banner */}
        <DeliveryInstallBanner businessName={currentBusinessName} />

        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">
              You are offline. Go online to receive new delivery orders.
            </p>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-20">
          {children}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 z-50 safe-area-bottom">
          <div className="flex items-center justify-around py-1">
            {navItems.map((item) => {
              const isActive =
                (item.id === "dashboard" && (deliveryPage === "dashboard" || deliveryPage === "order-detail" || deliveryPage === "navigation" || deliveryPage === "otp-verify")) ||
                (item.id === "earnings" && deliveryPage === "earnings") ||
                (item.id === "profile" && deliveryPage === "profile")

              return (
                <button
                  key={item.id}
                  onClick={() => setDeliveryPage(item.id)}
                  className={`flex flex-col items-center gap-0.5 py-2 px-4 rounded-lg transition-colors min-w-[72px] ${
                    isActive
                      ? "text-teal-600"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : ""}`} />
                  <span className={`text-[10px] ${isActive ? "font-semibold" : "font-medium"}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="h-0.5 w-4 rounded-full bg-teal-600 -mt-0.5" />
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
