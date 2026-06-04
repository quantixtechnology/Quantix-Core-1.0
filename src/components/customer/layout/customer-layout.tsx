"use client"

import React, { useEffect, useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { formatINR } from "@/lib/currency"
import {
  Home, LayoutGrid, Search, ClipboardList, User,
  Bell, ShoppingBag, ChevronRight,
} from "lucide-react"

export function CustomerLayout({ children }: { children: React.ReactNode }) {
  const {
    customerPage, setCustomerPage, customerNavStack, pushCustomerPage, popCustomerPage,
    customerLoggedIn, currentBusinessName, currentBusinessPrimaryColor, currentStoreName,
  } = useAdminStore()

  const navigate = pushCustomerPage
  const businessName = currentBusinessName || "My Store"
  const businessInitials = businessName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()

  const totalItems  = useCartStore((s) => s.totalItems())
  const cartSubtotal = useCartStore((s) => s.subtotal())

  // Track which products sub-entry was last used so the correct tab highlights
  const [productsVia, setProductsVia] = useState<"categories" | "search">("categories")

  // Wire browser back button to in-app nav stack
  useEffect(() => {
    const onPopState = () => {
      if (customerNavStack.length > 0) {
        history.pushState(null, "", window.location.href)
        popCustomerPage()
      }
    }
    history.pushState(null, "", window.location.href)
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerNavStack.length])

  const brandColor  = currentBusinessPrimaryColor || "#10B981"
  const activeStyle = { color: brandColor }

  const handleTabPress = (page: "home" | "products" | "cart" | "orders" | "profile", via?: "categories" | "search") => {
    if (!customerLoggedIn && (page === "orders" || page === "profile")) {
      pushCustomerPage("auth")
      return
    }
    if (page === "products" && via) setProductsVia(via)
    setCustomerPage(page)
  }

  const getActiveTab = (): string => {
    if (customerPage === "home") return "home"
    if (customerPage === "products" || customerPage === "product-detail") return productsVia
    if (customerPage === "orders" || customerPage === "order-tracking") return "orders"
    if (
      customerPage === "profile" || customerPage === "addresses" ||
      customerPage === "support" || customerPage === "notifications" ||
      customerPage === "wishlist" || customerPage === "coupons"
    ) return "profile"
    return "" // cart, checkout — no tab highlighted; floating bar is the CTA
  }

  const activeTab   = getActiveTab()
  const showHeader  = customerPage !== "auth"
  const showCartBar = totalItems > 0 && customerPage !== "cart" && customerPage !== "checkout" && showHeader

  const tabs = [
    { id: "home",       label: "Home",       icon: Home,        action: () => handleTabPress("home") },
    { id: "categories", label: "Categories", icon: LayoutGrid,  action: () => handleTabPress("products", "categories") },
    { id: "search",     label: "Search",     icon: Search,      action: () => handleTabPress("products", "search") },
    { id: "orders",     label: "Orders",     icon: ClipboardList, action: () => handleTabPress("orders") },
    { id: "profile",    label: "Profile",    icon: User,        action: () => handleTabPress("profile") },
  ]

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col relative overflow-hidden">

        {/* ── Top header ─────────────────────────────────────────────────── */}
        {showHeader && (
          <header
            className="sticky top-0 z-50 text-white px-4 pt-3 pb-2.5 flex items-center justify-between shadow-sm"
            style={{ backgroundColor: brandColor }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                <span className="font-extrabold text-sm" style={activeStyle}>{businessInitials}</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold leading-none text-white">{businessName}</h1>
                <div className="flex items-center gap-0.5 mt-0.5">
                  <svg className="w-2.5 h-2.5 text-white/70 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-[10px] text-white/70 truncate leading-none">
                    {currentStoreName ? `Delivering from ${currentStoreName}` : "Select a store"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => navigate("notifications")}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/20 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCustomerPage("cart")}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/20 transition-colors"
                aria-label="Cart"
              >
                <ShoppingBag className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </button>
            </div>
          </header>
        )}

        {/* ── Main content (page transition via key remount + animate-in) ── */}
        <main
          key={customerPage}
          className="flex-1 overflow-y-auto animate-in fade-in duration-200"
          style={{
            paddingBottom: showHeader
              ? showCartBar
                ? "calc(8.5rem + env(safe-area-inset-bottom, 0px))"
                : "calc(4.5rem + env(safe-area-inset-bottom, 0px))"
              : "0",
          }}
        >
          {children}
        </main>

        {/* ── Floating cart bar (Blinkit-style) ─────────────────────────── */}
        {showCartBar && (
          <div
            className="fixed left-1/2 -translate-x-1/2 w-full max-w-md px-3 z-40"
            style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <button
              onClick={() => setCustomerPage("cart")}
              className="w-full rounded-2xl px-4 py-3 flex items-center justify-between shadow-[0_8px_30px_rgba(0,0,0,0.18)] active:scale-[0.98] transition-transform"
              style={{ backgroundColor: brandColor }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-medium text-white/75 leading-none">
                    {totalItems} item{totalItems !== 1 ? "s" : ""} in cart
                  </p>
                  <p className="text-base font-extrabold text-white leading-tight mt-0.5">
                    {formatINR(cartSubtotal)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-white/20 rounded-xl px-3.5 py-2">
                <span className="text-sm font-bold text-white">View Cart</span>
                <ChevronRight className="w-4 h-4 text-white" />
              </div>
            </button>
          </div>
        )}

        {/* ── Bottom navigation (Material-style active pill) ─────────────── */}
        {showHeader && (
          <nav
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 z-50"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="flex items-center justify-around py-1.5 px-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={tab.action}
                    className="flex flex-col items-center gap-0.5 min-w-[56px] py-0.5 transition-opacity active:opacity-60"
                    aria-label={tab.label}
                  >
                    {/* Icon container — filled pill when active */}
                    <div
                      className="w-12 h-7 rounded-2xl flex items-center justify-center transition-all duration-200"
                      style={isActive ? { backgroundColor: `${brandColor}1a` } : {}}
                    >
                      <Icon
                        className="w-[19px] h-[19px] transition-colors duration-200"
                        style={{ color: isActive ? brandColor : "#94a3b8" }}
                        strokeWidth={isActive ? 2.5 : 1.75}
                      />
                    </div>
                    {/* Label */}
                    <span
                      className="text-[9.5px] leading-none font-medium transition-colors duration-200 tracking-tight"
                      style={{ color: isActive ? brandColor : "#94a3b8" }}
                    >
                      {tab.label}
                    </span>
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
