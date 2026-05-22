"use client"

import React, { useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { Home, Grid3X3, ShoppingCart, ClipboardList, User, Search, Bell } from "lucide-react"

export function CustomerLayout({ children }: { children: React.ReactNode }) {
  const {
    customerPage, setCustomerPage, customerNavStack, pushCustomerPage, popCustomerPage,
    customerLoggedIn, currentBusinessName, currentBusinessPrimaryColor,
  } = useAdminStore()
  // expose navigate as pushCustomerPage so deep links build the back stack correctly
  const navigate = pushCustomerPage
  const businessName = currentBusinessName || "My Store"
  const businessInitials = businessName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const totalItems = useCartStore((s) => s.totalItems())

  // Wire browser back button to the in-app navigation stack
  useEffect(() => {
    const onPopState = () => {
      if (customerNavStack.length > 0) {
        // Prevent the real URL from changing — we handle navigation ourselves
        history.pushState(null, "", window.location.href)
        popCustomerPage()
      }
    }
    // Push a synthetic state so the back button fires popstate
    history.pushState(null, "", window.location.href)
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerNavStack.length])

  // Brand color: use business primary color or fall back to emerald-500
  const brandColor = currentBusinessPrimaryColor || "#10B981"
  const headerStyle = { backgroundColor: brandColor }
  const activeStyle = { color: brandColor }

  const handleTabPress = (page: "home" | "products" | "cart" | "orders" | "profile") => {
    // Guests can browse products and cart; only orders and profile require login
    if (!customerLoggedIn && (page === "orders" || page === "profile")) {
      // Push auth so user can go back after login
      pushCustomerPage("auth")
      return
    }
    // Tab bar always resets the stack — it's a root navigation action
    setCustomerPage(page)
  }

  const tabs = [
    { id: "home" as const, label: "Home", icon: Home, page: "home" as const },
    { id: "categories" as const, label: "Categories", icon: Grid3X3, page: "products" as const },
    { id: "cart" as const, label: "Cart", icon: ShoppingCart, page: "cart" as const },
    { id: "orders" as const, label: "Orders", icon: ClipboardList, page: "orders" as const },
    { id: "profile" as const, label: "Profile", icon: User, page: "profile" as const },
  ]

  const getActiveTab = () => {
    if (customerPage === "home") return "home"
    if (customerPage === "products" || customerPage === "product-detail") return "categories"
    if (customerPage === "cart" || customerPage === "checkout") return "cart"
    if (customerPage === "orders" || customerPage === "order-tracking") return "orders"
    if (customerPage === "profile" || customerPage === "addresses" || customerPage === "support" || customerPage === "notifications") return "profile"
    return "home"
  }

  const activeTab = getActiveTab()

  const showHeader = customerPage !== "auth"

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col relative">
        {/* Top Header */}
        {showHeader && (
          <header className="sticky top-0 z-50 text-white px-4 py-3 flex items-center justify-between shadow-sm" style={headerStyle}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <span className="font-bold text-sm" style={activeStyle}>{businessInitials}</span>
              </div>
              <div>
                <h1 className="text-sm font-bold leading-tight">{businessName.split(' ')[0]}</h1>
                <p className="text-[10px] text-white/70 leading-tight">{businessName.split(' ').slice(1).join(' ') || 'Store'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                onClick={() => navigate("home")}
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                aria-label="Notifications"
                onClick={() => navigate("notifications")}
              >
                <Bell className="w-5 h-5" />
              </button>
              <button
                className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                onClick={() => handleTabPress("cart")}
                aria-label="Cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </button>
            </div>
          </header>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-16">
          {children}
        </main>

        {/* Bottom Navigation */}
        {showHeader && (
          <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 z-50 safe-area-bottom">
            <div className="flex items-center justify-around py-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabPress(tab.page)}
                    className={`flex flex-col items-center justify-center py-1.5 px-3 min-w-[60px] transition-colors ${
                      isActive ? "" : "text-gray-400"
                    }`}
                    style={isActive ? activeStyle : undefined}
                    aria-label={tab.label}
                  >
                    <div className="relative">
                      <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5px]" : ""}`} />
                      {tab.id === "cart" && totalItems > 0 && (
                        <span className="absolute -top-1.5 -right-2 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5" style={{ backgroundColor: brandColor }}>
                          {totalItems > 99 ? "99+" : totalItems}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] mt-0.5 ${isActive ? "font-semibold" : "font-medium"}`}>
                      {tab.label}
                    </span>
                    {isActive && (
                      <div className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: brandColor }} />
                    )}
                  </button>
                )
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}
