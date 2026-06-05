"use client"

import React, { useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useAuthStore } from "@/stores/auth-store"
import {
  ShoppingCart, Search, X, User, Trash2, Plus, Minus,
  Package, MapPin, ChevronDown, Home,
  ChevronRight, ArrowLeft,
} from "lucide-react"
import type { WebNav } from "./storefront-website"
import type { PickedStore } from "./storefront-store-picker"
import { ProductImage } from "./product-image"
import { formatINR } from "@/lib/currency"
import { resolveImageUrl } from "@/lib/image-url"
import { InstallAppButton } from "@/components/storefront/install-app-button"

interface StorefrontLayoutProps {
  children: React.ReactNode
  brandColor: string
  nav: WebNav
  currentStore?: PickedStore | null
  onOpenStorePicker?: () => void
}

export function StorefrontLayout({
  children,
  brandColor,
  nav,
  currentStore,
  onOpenStorePicker,
}: StorefrontLayoutProps) {
  const { currentBusinessName, currentBusinessLogo } = useAdminStore()
  const { items, totalItems, subtotal, updateQuantity, removeItem } = useCartStore()
  const { isAuthenticated, user } = useAuthStore()
  const [cartOpen, setCartOpen] = useState(false)

  const cartCount    = totalItems()
  const cartSubtotal = subtotal()

  // ── Active bottom nav tab ───────────────────────────────────────────────
  const activeTab = (() => {
    const p = nav.current
    if (p === "home")                                          return "home"
    if (p === "orders" || p === "order-tracking")             return "orders"
    if (p === "profile" || p === "addresses" || p === "password") return "profile"
    return "browse"
  })()

  // ── Mobile app-bar title ───────────────────────────────────────────────
  const mobileTitle = (() => {
    switch (nav.current) {
      case "category":      return nav.categoryName || "Products"
      case "orders":        return "My Orders"
      case "order-tracking":return "Track Order"
      case "checkout":      return "Checkout"
      case "auth":          return "Login / Sign Up"
      case "profile":       return "My Profile"
      case "addresses":     return "Addresses"
      case "password":      return "Change Password"
      default:              return currentBusinessName || "Store"
    }
  })()

  const showBackOnMobile  = nav.canGoBack && nav.current !== "home"
  const showFloatingCart  = cartCount > 0 && nav.current !== "checkout"
  const BOTTOM_NAV_H      = 64   // px  – bottom nav bar
  const CART_BAR_H        = 68   // px  – floating cart bar (above nav)

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* ══════════════════════════════════════════════════════════════
          MOBILE APP BAR  ·  h-14  ·  shows only on < md
      ══════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white md:hidden shadow-sm">
        <div className="flex items-center gap-3 px-4" style={{ height: 56 }}>

          {/* Left: back or logo */}
          {showBackOnMobile ? (
            <button
              onClick={() => nav.goBack()}
              className="w-9 h-9 -ml-1 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-800" />
            </button>
          ) : (
            <button onClick={() => nav.go("home")} className="shrink-0">
              <img
                src={currentBusinessLogo || "/placeholder-logo.svg"}
                alt={currentBusinessName || "Store"}
                className="w-8 h-8 rounded-xl object-contain border border-gray-100"
                onError={(e) => {
                  const img = e.currentTarget
                  if (!img.src.endsWith("/placeholder-logo.svg")) img.src = "/placeholder-logo.svg"
                }}
              />
            </button>
          )}

          {/* Center: brand or page title */}
          <div className="flex-1 min-w-0">
            {nav.current === "home" ? (
              <div>
                <p className="text-[15px] font-bold text-gray-900 leading-tight truncate">
                  {currentBusinessName || "Store"}
                </p>
                {currentStore && (
                  <button
                    onClick={onOpenStorePicker}
                    className="flex items-center gap-0.5 text-[11px] leading-none mt-0.5 active:opacity-70"
                    style={{ color: brandColor }}
                  >
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[150px]">{currentStore.name}</span>
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </button>
                )}
              </div>
            ) : (
              <h1 className="text-[15px] font-bold text-gray-900 truncate">{mobileTitle}</h1>
            )}
          </div>

          {/* Right: search + cart icon */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Search"
            >
              <Search className="w-[18px] h-[18px] text-gray-700" />
            </button>
            <button
              onClick={() => setCartOpen(true)}
              className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              aria-label={`Cart (${cartCount} items)`}
            >
              <ShoppingCart className="w-[18px] h-[18px] text-gray-700" />
              {cartCount > 0 && (
                <span
                  className="absolute top-0.5 right-0.5 w-[15px] h-[15px] text-white text-[9px] font-bold rounded-full flex items-center justify-center"
                  style={{ backgroundColor: brandColor }}
                >
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP HEADER  ·  kept from original design
      ══════════════════════════════════════════════════════════════ */}
      <header className="hidden md:block sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-3">

            <button onClick={() => nav.go("home")} className="flex items-center gap-2.5 shrink-0 mr-2">
              <img
                src={currentBusinessLogo || "/placeholder-logo.svg"}
                alt={currentBusinessName || "Store"}
                className="w-9 h-9 rounded-xl object-contain bg-white border border-gray-100"
                onError={(e) => {
                  const img = e.currentTarget
                  if (!img.src.endsWith("/placeholder-logo.svg")) img.src = "/placeholder-logo.svg"
                }}
              />
              <div className="text-left">
                <div className="font-bold text-gray-900 text-sm leading-tight">{currentBusinessName || "Store"}</div>
                {currentStore && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenStorePicker?.() }}
                    className="flex items-center gap-0.5 text-[10px] leading-tight hover:opacity-80 transition-opacity"
                    style={{ color: brandColor }}
                  >
                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                    <span className="max-w-[120px] truncate">{currentStore.name}</span>
                    <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                  </button>
                )}
              </div>
            </button>

            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.currentTarget.value.trim()) {
                      nav.go("category", {
                        categoryId: undefined,
                        categoryName: `Search: ${e.currentTarget.value.trim()}`,
                      })
                    }
                  }}
                  className="w-full pl-10 pr-4 h-10 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <InstallAppButton brandColor={brandColor} />
              <button
                onClick={() => setCartOpen(true)}
                className="relative flex items-center gap-1.5 px-3 h-9 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <ShoppingCart className="w-4 h-4 text-gray-700" />
                <span className="text-sm font-medium text-gray-700">Cart</span>
                {cartCount > 0 && (
                  <span
                    className="w-5 h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                    style={{ backgroundColor: brandColor }}
                  >
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => nav.go(isAuthenticated ? "profile" : "auth")}
                className="flex items-center gap-1.5 px-3 h-9 text-sm font-medium rounded-xl border border-gray-200 hover:border-gray-300 transition-colors whitespace-nowrap"
              >
                <User className="w-4 h-4 text-gray-600" />
                <span className="text-gray-700">
                  {isAuthenticated ? (user?.name?.split(" ")[0] || "Account") : "Login"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          MAIN CONTENT
          Mobile: padding-bottom clears bottom nav + optional cart bar
          Desktop: no extra padding
      ══════════════════════════════════════════════════════════════ */}
      <main
        className="flex-1 md:pb-0"
        style={{
          paddingBottom: `calc(${
            showFloatingCart ? BOTTOM_NAV_H + CART_BAR_H : BOTTOM_NAV_H
          }px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        {children}
      </main>

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP FOOTER
      ══════════════════════════════════════════════════════════════ */}
      <footer className="hidden md:block bg-gray-900 text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={currentBusinessLogo || "/placeholder-logo.svg"}
                alt={currentBusinessName || "Store"}
                className="w-8 h-8 rounded-xl object-contain"
                onError={(e) => {
                  const img = e.currentTarget
                  if (!img.src.endsWith("/placeholder-logo.svg")) img.src = "/placeholder-logo.svg"
                }}
              />
              <span className="font-bold text-base">{currentBusinessName}</span>
            </div>
            <p className="text-xs text-gray-500">
              Powered by{" "}
              <span className="text-gray-400 font-medium">Quantix Technology</span>
            </p>
          </div>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════════════════
          MOBILE BOTTOM NAVIGATION  ·  fixed  ·  md:hidden
      ══════════════════════════════════════════════════════════════ */}
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Floating cart bar — above the bottom nav */}
        {showFloatingCart && (
          <div className="bg-white border-t border-gray-100 px-3 pt-2 pb-1">
            <button
              onClick={() => setCartOpen(true)}
              className="w-full h-[52px] rounded-2xl flex items-center justify-between px-4 text-white active:opacity-90 transition-opacity"
              style={{
                background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}ee 100%)`,
              }}
            >
              {/* Left: icon + count */}
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center">
                  <ShoppingCart className="w-[15px] h-[15px]" />
                </div>
                <span className="text-[13px] font-semibold">
                  {cartCount} item{cartCount !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Right: price + CTA */}
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold">{formatINR(cartSubtotal)}</span>
                <div className="flex items-center gap-0.5 text-[13px] font-semibold opacity-90">
                  View Cart <ChevronRight className="w-[15px] h-[15px]" />
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Bottom nav bar */}
        <nav className="bg-white border-t border-gray-100 flex items-stretch h-16">
          {(
            [
              {
                id:     "home",
                label:  "Home",
                icon:   Home,
                action: () => nav.go("home"),
              },
              {
                id:     "browse",
                label:  "Browse",
                icon:   Search,
                action: () =>
                  nav.go("category", { categoryId: undefined, categoryName: "All Products" }),
              },
              {
                id:     "cart",
                label:  "Cart",
                icon:   ShoppingCart,
                action: () => setCartOpen(true),
                badge:  cartCount > 0 ? cartCount : undefined,
              },
              {
                id:     "orders",
                label:  "Orders",
                icon:   Package,
                action: () => nav.go("orders"),
              },
              {
                id:     "profile",
                label:  "Profile",
                icon:   User,
                action: () => nav.go(isAuthenticated ? "profile" : "auth"),
              },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={tab.action}
                className="flex-1 flex flex-col items-center justify-center gap-[3px] relative py-1"
              >
                {/* M3 indicator pill */}
                <div
                  className={`relative flex items-center justify-center rounded-full h-7 transition-all duration-200 ${
                    isActive ? "w-14" : "w-8"
                  }`}
                  style={isActive ? { backgroundColor: `${brandColor}22` } : {}}
                >
                  <tab.icon
                    className={`w-[19px] h-[19px] transition-colors duration-200 ${
                      isActive ? "" : "text-gray-400"
                    }`}
                    style={isActive ? { color: brandColor } : {}}
                  />
                  {/* Badge for cart */}
                  {"badge" in tab && tab.badge !== undefined && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center"
                      style={{ backgroundColor: brandColor }}
                    >
                      {tab.badge > 9 ? "9+" : tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] transition-all duration-200 ${
                    isActive ? "font-semibold" : "text-gray-400 font-medium"
                  }`}
                  style={isActive ? { color: brandColor } : {}}
                >
                  {tab.label}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          CART DRAWER  ·  right slide-in  ·  shared desktop + mobile
      ══════════════════════════════════════════════════════════════ */}
      {cartOpen && (
        <div className="fixed inset-0 z-[100] flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setCartOpen(false)}
          />

          {/* Panel */}
          <div className="w-full max-w-sm bg-white h-full flex flex-col shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" style={{ color: brandColor }} />
                <h2 className="font-bold text-gray-900 text-[15px]">Your Cart</h2>
                {cartCount > 0 && (
                  <span className="text-sm text-gray-400">
                    ({cartCount} {cartCount === 1 ? "item" : "items"})
                  </span>
                )}
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Empty state */}
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}12` }}
                >
                  <ShoppingCart className="w-9 h-9" style={{ color: brandColor }} />
                </div>
                <p className="text-sm font-semibold text-gray-700">Your cart is empty</p>
                <p className="text-xs text-gray-400">Add items to get started</p>
                <button
                  onClick={() => { setCartOpen(false); nav.go("category") }}
                  className="mt-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
                  style={{ backgroundColor: brandColor }}
                >
                  Browse Products
                </button>
              </div>
            ) : (
              <>
                {/* Item list */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                  {items.map((item) => (
                    <div
                      key={`${item.productId}-${item.variantId}`}
                      className="flex items-start gap-3 bg-gray-50/80 rounded-2xl p-3"
                    >
                      <ProductImage
                        src={resolveImageUrl(item.image)}
                        alt={item.name}
                        className="w-[52px] h-[52px] rounded-xl shrink-0 border border-gray-100"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 leading-tight line-clamp-2">
                          {item.name}
                        </p>
                        {item.variantName && (
                          <p className="text-[11px] text-gray-500 mt-0.5">{item.variantName}</p>
                        )}
                        <p className="text-sm font-bold mt-1" style={{ color: brandColor }}>
                          {formatINR(item.price * item.quantity)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          onClick={() => removeItem(item.productId, item.variantId)}
                          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                        {/* Qty stepper */}
                        <div
                          className="flex items-center h-7 rounded-xl overflow-hidden"
                          style={{ border: `1.5px solid ${brandColor}` }}
                        >
                          <button
                            onClick={() =>
                              updateQuantity(item.productId, item.variantId, item.quantity - 1)
                            }
                            className="w-7 h-full flex items-center justify-center active:opacity-70"
                            style={{ color: brandColor }}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span
                            className="w-6 text-center text-[13px] font-bold"
                            style={{ color: brandColor }}
                          >
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.productId, item.variantId, item.quantity + 1)
                            }
                            className="w-7 h-full flex items-center justify-center active:opacity-70"
                            style={{ color: brandColor }}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Subtotal</span>
                    <span className="text-base font-bold text-gray-900">{formatINR(cartSubtotal)}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Taxes &amp; delivery calculated at checkout</p>
                  <button
                    onClick={() => { setCartOpen(false); nav.go("checkout") }}
                    className="w-full h-12 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-opacity hover:opacity-90 active:opacity-80"
                    style={{ backgroundColor: brandColor }}
                  >
                    Proceed to Checkout
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
