"use client"

import React, { useState, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useAuthStore } from "@/stores/auth-store"
import {
  ShoppingCart, Search, X, User, Trash2, Plus, Minus,
  Package, MapPin, ChevronDown, Home, Menu,
  ChevronRight, ArrowLeft,
} from "lucide-react"
import type { WebNav } from "./storefront-website"
import type { PickedStore } from "./storefront-store-picker"
import { ProductImage } from "./product-image"
import { formatINR } from "@/lib/currency"
import { resolveImageUrl } from "@/lib/image-url"
import { InstallAppButton } from "@/components/storefront/install-app-button"
import { usePwaMode } from "@/hooks/use-pwa-mode"
import { PwaModeContext } from "@/contexts/pwa-mode-context"
import { PwaAppearanceContext } from "@/contexts/pwa-appearance-context"
import {
  getPwaHeaderBg, getPwaHeaderFg, getPwaHeaderMuted, getPwaHeaderIcon,
} from "@/lib/pwa-appearance"

interface Category { id: string; name: string; slug: string; image: string | null }

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
  const { currentBusinessId, currentBusinessName, currentBusinessLogo, currentPwaAppearance } = useAdminStore()
  const { items, totalItems, subtotal, updateQuantity, removeItem } = useCartStore()
  const { isAuthenticated, user } = useAuthStore()
  const isPwa = usePwaMode()

  const [cartOpen, setCartOpen]           = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery]     = useState("")
  const [categories, setCategories]       = useState<Category[]>([])

  const cartCount    = totalItems()
  const cartSubtotal = subtotal()

  // ── Categories for desktop nav strip + mobile hamburger (web only) ─────
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/core/storefront/categories?businessId=${currentBusinessId}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setCategories(j.data?.slice(0, 8) || []) })
      .catch(() => {})
  }, [currentBusinessId])

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      nav.go("category", { categoryId: undefined, categoryName: `Search: ${searchQuery}` })
    }
  }

  // ── PWA bottom nav helpers ─────────────────────────────────────────────
  const activeTab = (() => {
    const p = nav.current
    if (p === "home")                                              return "home"
    if (p === "orders" || p === "order-tracking")                 return "orders"
    if (p === "profile" || p === "addresses" || p === "password") return "profile"
    return "browse"
  })()

  const pwaPageTitle = (() => {
    switch (nav.current) {
      case "category":       return nav.categoryName || "Products"
      case "orders":         return "My Orders"
      case "order-tracking": return "Track Order"
      case "checkout":       return "Checkout"
      case "auth":           return "Login / Sign Up"
      case "profile":        return "My Profile"
      case "addresses":      return "Addresses"
      case "password":       return "Change Password"
      default:               return currentBusinessName || "Store"
    }
  })()

  const showBackInPwa    = nav.canGoBack && nav.current !== "home"
  const showFloatingCart = cartCount > 0 && nav.current !== "checkout"
  const BOTTOM_NAV_H     = 64
  const CART_BAR_H       = 68

  // ── Shared cart drawer ─────────────────────────────────────────────────
  const CartDrawer = cartOpen ? (
    <div className="fixed inset-0 z-[100] flex">
      <div
        className="flex-1 bg-black/50 backdrop-blur-[2px]"
        onClick={() => setCartOpen(false)}
      />
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
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

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
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                    <div
                      className="flex items-center h-7 rounded-xl overflow-hidden"
                      style={{ border: `1.5px solid ${brandColor}` }}
                    >
                      <button
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                        className="w-7 h-full flex items-center justify-center active:opacity-70"
                        style={{ color: brandColor }}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-[13px] font-bold" style={{ color: brandColor }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
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
            <div className="px-4 py-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="text-base font-bold text-gray-900">{formatINR(cartSubtotal)}</span>
              </div>
              <p className="text-[11px] text-gray-400">Taxes &amp; delivery calculated at checkout</p>
              <button
                onClick={() => { setCartOpen(false); nav.go("checkout") }}
                className="w-full h-12 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                Proceed to Checkout <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null

  // ══════════════════════════════════════════════════════════════════════════
  // PWA LAYOUT — installed PWA only (display-mode: standalone)
  // Compact app bar + bottom navigation + floating cart
  // ══════════════════════════════════════════════════════════════════════════
  if (isPwa) {
    // ── Header theme derived colors (only affect PWA mode) ──────────────────
    const hTheme   = currentPwaAppearance.headerTheme
    const hBg      = getPwaHeaderBg(hTheme, brandColor)
    const hFg      = getPwaHeaderFg(hTheme)
    const hMuted   = getPwaHeaderMuted(hTheme, brandColor)
    const hIcon    = getPwaHeaderIcon(hTheme)
    const hHover   = hTheme === "brandColor" ? "hover:bg-white/20" : "hover:bg-gray-100"
    const logoBorder = hTheme === "brandColor" ? "border-white/30" : "border-gray-100"
    const cartBadgeBg   = hTheme === "brandColor" ? "#FFFFFF" : brandColor
    const cartBadgeText = hTheme === "brandColor" ? brandColor  : "#FFFFFF"

    return (
      <PwaAppearanceContext.Provider value={currentPwaAppearance}>
      <PwaModeContext.Provider value={isPwa}>
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* PWA App Bar — dedicated spacer + themed header background.
             The spacer ensures content sits below the device status bar on all
             Android/iOS variants (max guards against env() returning 0). */}
        <header className="sticky top-0 z-40 shadow-sm" style={{ backgroundColor: hBg }}>
          {/* Status-bar spacer: header background fills behind system status bar */}
          <div aria-hidden="true" style={{ height: "max(env(safe-area-inset-top, 0px), 24px)" }} />
          {/* Toolbar: 60px gives comfortable vertical room for 20px name + 13px store */}
          <div className="flex items-center gap-3 px-4" style={{ height: 60 }}>
            {showBackInPwa ? (
              <>
                {/* Back button — 44px touch target */}
                <button
                  onClick={() => nav.goBack()}
                  className={`w-11 h-11 -ml-2 flex items-center justify-center rounded-full transition-colors shrink-0 ${hHover}`}
                >
                  <ArrowLeft className="w-5 h-5" style={{ color: hFg }} />
                </button>
                <h1
                  className="flex-1 min-w-0 text-[17px] font-semibold truncate"
                  style={{ color: hFg }}
                >
                  {pwaPageTitle}
                </h1>
              </>
            ) : (
              <>
                {/* Logo — 40×40, never stretches header */}
                <img
                  src={currentBusinessLogo || "/placeholder-logo.svg"}
                  alt={currentBusinessName || "Store"}
                  className={`rounded-xl object-contain border block shrink-0 cursor-pointer active:opacity-70 ${logoBorder}`}
                  style={{ width: 40, height: 40 }}
                  onClick={() => nav.go("home")}
                  onError={(e) => {
                    const img = e.currentTarget
                    if (!img.src.endsWith("/placeholder-logo.svg")) img.src = "/placeholder-logo.svg"
                  }}
                />
                {/* Business name + store selector — centered as a unit with logo */}
                <div
                  className="flex-1 min-w-0 flex flex-col gap-[3px] cursor-pointer"
                  onClick={() => nav.go("home")}
                  role="button"
                  tabIndex={0}
                >
                  {/* 20px bold — premium native-app feel */}
                  <span
                    className="text-[20px] font-bold leading-none truncate block"
                    style={{ color: hFg }}
                  >
                    {currentBusinessName || "Store"}
                  </span>
                  {currentStore && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenStorePicker?.() }}
                      className="flex items-center gap-1 p-0 border-0 bg-transparent active:opacity-70 w-fit"
                      style={{ color: hMuted }}
                    >
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="text-[13px] leading-none truncate max-w-[160px]">{currentStore.name}</span>
                      <ChevronDown className="w-3 h-3 shrink-0" />
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Action icons — 44px touch targets, equal spacing */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors ${hHover}`}
              >
                <Search className="w-5 h-5" style={{ color: hIcon }} />
              </button>
              <button
                onClick={() => setCartOpen(true)}
                className={`relative w-11 h-11 flex items-center justify-center rounded-full transition-colors ${hHover}`}
              >
                <ShoppingCart className="w-5 h-5" style={{ color: hIcon }} />
                {cartCount > 0 && (
                  <span
                    className="absolute top-[7px] right-[7px] w-[15px] h-[15px] text-[9px] font-bold rounded-full flex items-center justify-center"
                    style={{ backgroundColor: cartBadgeBg, color: cartBadgeText }}
                  >
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main
          className="flex-1"
          style={{
            paddingBottom: `calc(${
              showFloatingCart ? BOTTOM_NAV_H + CART_BAR_H : BOTTOM_NAV_H
            }px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          {children}
        </main>

        {/* PWA Bottom Navigation */}
        <div
          className="fixed bottom-0 inset-x-0 z-50"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {/* Floating cart bar */}
          {showFloatingCart && (
            <div className="bg-white border-t border-gray-100 px-4 pt-3 pb-1.5">
              <button
                onClick={() => setCartOpen(true)}
                className="w-full h-[60px] rounded-[28px] flex items-center justify-between px-5 text-white active:opacity-90 transition-opacity"
                style={{
                  background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}ee 100%)`,
                  boxShadow: `0 8px 24px ${brandColor}55, 0 2px 8px rgba(0,0,0,0.12)`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center shrink-0">
                    <ShoppingCart className="w-[16px] h-[16px]" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[13px] font-bold leading-none">
                      {cartCount} item{cartCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[11px] font-medium opacity-80 leading-none mt-0.5">in your cart</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-bold">{formatINR(cartSubtotal)}</span>
                  <ChevronRight className="w-[18px] h-[18px] opacity-90" />
                </div>
              </button>
            </div>
          )}

          {/* Bottom nav bar */}
          <nav className="bg-white border-t border-gray-100 flex items-stretch h-16">
            {(
              [
                { id: "home",    label: "Home",    icon: Home,         action: () => nav.go("home") },
                { id: "browse",  label: "Browse",  icon: Search,       action: () => nav.go("category", { categoryId: undefined, categoryName: "All Products" }) },
                { id: "cart",    label: "Cart",    icon: ShoppingCart, action: () => setCartOpen(true), badge: cartCount > 0 ? cartCount : undefined },
                { id: "orders",  label: "Orders",  icon: Package,      action: () => nav.go("orders") },
                { id: "profile", label: "Profile", icon: User,         action: () => nav.go(isAuthenticated ? "profile" : "auth") },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={tab.action}
                  className="flex-1 flex flex-col items-center justify-center gap-[3px] relative py-1"
                >
                  <div
                    className={`relative flex items-center justify-center rounded-full h-7 transition-all duration-200 ${isActive ? "w-14" : "w-8"}`}
                    style={isActive ? { backgroundColor: `${brandColor}22` } : {}}
                  >
                    <tab.icon
                      className={`w-[19px] h-[19px] transition-colors duration-200 ${isActive ? "" : "text-gray-400"}`}
                      style={isActive ? { color: brandColor } : {}}
                    />
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
                    className={`text-[10px] transition-all duration-200 ${isActive ? "font-semibold" : "text-gray-400 font-medium"}`}
                    style={isActive ? { color: brandColor } : {}}
                  >
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>

        {CartDrawer}
      </div>
      </PwaModeContext.Provider>
      </PwaAppearanceContext.Provider>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WEB LAYOUT — desktop website + mobile browser
  // Full header with logo, business name, search, cart, login, install CTA
  // Desktop: category nav strip  |  Mobile: hamburger menu
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <PwaModeContext.Provider value={isPwa}>
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── Full web header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-3">

            {/* Logo + Business name + location */}
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
              <div className="hidden sm:block text-left">
                <div className="font-bold text-gray-900 text-sm leading-tight">
                  {currentBusinessName || "Store"}
                </div>
                {currentStore ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenStorePicker?.() }}
                    className="flex items-center gap-0.5 text-[10px] leading-tight hover:opacity-80 transition-opacity"
                    style={{ color: brandColor }}
                  >
                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                    <span className="max-w-[120px] truncate">{currentStore.name}</span>
                    <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                  </button>
                ) : (
                  <div className="text-[10px] text-gray-400 leading-tight">Online Store</div>
                )}
              </div>
            </button>

            {/* Desktop search bar */}
            <div className="flex-1 max-w-xl hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  className="w-full pl-10 pr-4 h-10 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-colors"
                />
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 ml-auto">
              <InstallAppButton brandColor={brandColor} />

              {/* Cart */}
              <button
                onClick={() => setCartOpen(true)}
                className="relative flex items-center gap-1.5 px-3 h-9 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <ShoppingCart className="w-4 h-4 text-gray-700" />
                <span className="text-sm font-medium text-gray-700 hidden sm:block">Cart</span>
                {cartCount > 0 && (
                  <span
                    className="w-5 h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                    style={{ backgroundColor: brandColor }}
                  >
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </button>

              {/* Account */}
              <button
                onClick={() => nav.go(isAuthenticated ? "profile" : "auth")}
                className="flex items-center gap-1.5 px-3 h-9 text-sm font-medium rounded-xl border border-gray-200 hover:border-gray-300 transition-colors whitespace-nowrap"
              >
                <User className="w-4 h-4 text-gray-600" />
                <span className="hidden sm:block text-gray-700">
                  {isAuthenticated ? (user?.name?.split(" ")[0] || "Account") : "Login"}
                </span>
              </button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors md:hidden"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile search bar */}
          <div className="md:hidden pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                className="w-full pl-10 pr-4 h-9 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Desktop category nav strip */}
        {categories.length > 0 && (
          <div className="border-t border-gray-100 hidden md:block">
            <div className="max-w-7xl mx-auto px-8">
              <div className="flex items-center gap-1 h-10 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
                  className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => nav.go("category", { categoryId: c.id, categoryName: c.name })}
                    className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                    style={
                      nav.categoryId === c.id
                        ? { color: brandColor, backgroundColor: `${brandColor}10` }
                        : {}
                    }
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mobile hamburger dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white py-2 px-4 shadow-lg">
            <button
              onClick={() => { nav.go("home"); setMobileMenuOpen(false) }}
              className="block w-full text-left py-2.5 text-sm font-medium text-gray-700 border-b border-gray-100"
            >
              Home
            </button>
            <button
              onClick={() => { nav.go("category"); setMobileMenuOpen(false) }}
              className="block w-full text-left py-2.5 text-sm font-medium text-gray-700 border-b border-gray-100"
            >
              All Products
            </button>
            {categories.slice(0, 6).map((c) => (
              <button
                key={c.id}
                onClick={() => { nav.go("category", { categoryId: c.id, categoryName: c.name }); setMobileMenuOpen(false) }}
                className="block w-full text-left py-2.5 text-sm text-gray-600 pl-4 border-b border-gray-50"
              >
                {c.name}
              </button>
            ))}
            <button
              onClick={() => { nav.go("orders"); setMobileMenuOpen(false) }}
              className="block w-full text-left py-2.5 text-sm font-medium text-gray-700 border-b border-gray-100"
            >
              My Orders
            </button>
            <button
              onClick={() => { nav.go(isAuthenticated ? "profile" : "auth"); setMobileMenuOpen(false) }}
              className="block w-full text-left py-2.5 text-sm font-medium text-gray-700"
            >
              {isAuthenticated ? "My Account" : "Login / Sign Up"}
            </button>
          </div>
        )}
      </header>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="flex-1">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <img
                  src={currentBusinessLogo || "/placeholder-logo.svg"}
                  alt={currentBusinessName || "Store"}
                  className="w-8 h-8 rounded-xl object-contain"
                  onError={(e) => {
                    const img = e.currentTarget
                    if (!img.src.endsWith("/placeholder-logo.svg")) img.src = "/placeholder-logo.svg"
                  }}
                />
                <span className="font-bold text-lg">{currentBusinessName}</span>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Quality products, delivered to your door.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3 text-gray-200">Shop</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button onClick={() => nav.go("home")} className="hover:text-white transition-colors">Home</button></li>
                <li><button onClick={() => nav.go("category")} className="hover:text-white transition-colors">All Products</button></li>
                {categories.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => nav.go("category", { categoryId: c.id, categoryName: c.name })}
                      className="hover:text-white transition-colors"
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3 text-gray-200">Account</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button onClick={() => nav.go("auth")} className="hover:text-white transition-colors">Login / Register</button></li>
                <li><button onClick={() => nav.go("orders")} className="hover:text-white transition-colors">My Orders</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3 text-gray-200">Help</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><span>Delivery Policy</span></li>
                <li><span>Return &amp; Refund</span></li>
                <li><span>Privacy Policy</span></li>
                <li><span>Terms of Service</span></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} {currentBusinessName}. All rights reserved.
            </p>
            <p className="text-xs text-gray-600">
              Powered by <span className="text-gray-400 font-medium">Quantix Technology</span>
            </p>
          </div>
        </div>
      </footer>

      {CartDrawer}
    </div>
    </PwaModeContext.Provider>
  )
}
