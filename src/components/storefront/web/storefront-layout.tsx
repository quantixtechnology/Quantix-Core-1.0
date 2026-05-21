"use client"

import React, { useState, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useAuthStore } from "@/stores/auth-store"
import {
  ShoppingCart, Search, Menu, X, User, ChevronRight, Trash2, Plus, Minus,
  MapPin, Phone, Mail, Package,
} from "lucide-react"
import type { WebNav } from "./storefront-website"

interface Category { id: string; name: string; slug: string; image: string | null }

interface StorefrontLayoutProps {
  children: React.ReactNode
  brandColor: string
  nav: WebNav
}

export function StorefrontLayout({ children, brandColor, nav }: StorefrontLayoutProps) {
  const { currentBusinessId, currentBusinessName } = useAdminStore()
  const { items, totalItems, subtotal, updateQuantity, removeItem } = useCartStore()
  const { isAuthenticated, user } = useAuthStore()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [categories, setCategories] = useState<Category[]>([])

  const cartCount = totalItems()

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

  const initial = (currentBusinessName || "Q").charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── Sticky Header ───────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-3">
            {/* Logo */}
            <button onClick={() => nav.go("home")} className="flex items-center gap-2.5 shrink-0 mr-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base"
                style={{ backgroundColor: brandColor }}
              >
                {initial}
              </div>
              <div className="hidden sm:block text-left">
                <div className="font-bold text-gray-900 text-sm leading-tight">{currentBusinessName || "Store"}</div>
                <div className="text-[10px] text-gray-400 leading-tight">Fresh Delivery</div>
              </div>
            </button>

            {/* Desktop search */}
            <div className="flex-1 max-w-xl hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search chicken, mutton, fish…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  className="w-full pl-10 pr-4 h-10 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-colors"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-auto">
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
                onClick={() => nav.go("auth")}
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

          {/* Mobile search */}
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

        {/* Category nav strip */}
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
                    style={nav.categoryId === c.id ? { color: brandColor, backgroundColor: `${brandColor}10` } : {}}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white py-2 px-4">
            <button onClick={() => { nav.go("home"); setMobileMenuOpen(false) }} className="block w-full text-left py-2.5 text-sm font-medium text-gray-700 border-b border-gray-100">Home</button>
            <button onClick={() => { nav.go("category"); setMobileMenuOpen(false) }} className="block w-full text-left py-2.5 text-sm font-medium text-gray-700 border-b border-gray-100">All Products</button>
            {categories.slice(0, 5).map((c) => (
              <button key={c.id} onClick={() => { nav.go("category", { categoryId: c.id, categoryName: c.name }); setMobileMenuOpen(false) }} className="block w-full text-left py-2.5 text-sm text-gray-600 pl-4 border-b border-gray-50">{c.name}</button>
            ))}
          </div>
        )}
      </header>

      {/* ── Main content ─────────────────────────────────── */}
      <main className="flex-1">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="bg-gray-900 text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: brandColor }}>
                  {initial}
                </div>
                <span className="font-bold text-lg">{currentBusinessName}</span>
              </div>
              <p className="text-sm text-gray-400 mb-4">Fresh. Halal. Delivered fast.</p>
              <div className="space-y-1 text-sm text-gray-400">
                <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /><span>+91 98765 43210</span></div>
                <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /><span>support@{currentBusinessName?.toLowerCase().replace(/\s/g, "")||"store"}.com</span></div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3 text-gray-200">Shop</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button onClick={() => nav.go("home")} className="hover:text-white transition-colors">Home</button></li>
                <li><button onClick={() => nav.go("category")} className="hover:text-white transition-colors">All Products</button></li>
                {categories.slice(0, 3).map((c) => (
                  <li key={c.id}><button onClick={() => nav.go("category", { categoryId: c.id, categoryName: c.name })} className="hover:text-white transition-colors">{c.name}</button></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3 text-gray-200">Account</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button onClick={() => nav.go("auth")} className="hover:text-white transition-colors">Login / Register</button></li>
                <li><button onClick={() => nav.go("orders" as WebNav["current"])} className="hover:text-white transition-colors">My Orders</button></li>
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
            <p className="text-xs text-gray-500">© {new Date().getFullYear()} {currentBusinessName}. All rights reserved.</p>
            <p className="text-xs text-gray-600">Powered by <span className="text-gray-400 font-medium">Quantix Technology</span></p>
          </div>
        </div>
      </footer>

      {/* ── Cart Drawer ──────────────────────────────────── */}
      {cartOpen && (
        <div className="fixed inset-0 z-[100] flex">
          <div className="flex-1 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
            {/* Cart header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" style={{ color: brandColor }} />
                <h2 className="font-bold text-gray-900">Your Cart</h2>
                {cartCount > 0 && <span className="text-sm text-gray-500">({cartCount} items)</span>}
              </div>
              <button onClick={() => setCartOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Cart items */}
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center px-6">
                <Package className="w-14 h-14 text-gray-200" />
                <p className="text-sm font-medium text-gray-500">Your cart is empty</p>
                <p className="text-xs text-gray-400">Browse products and add to cart</p>
                <button
                  onClick={() => { setCartOpen(false); nav.go("category") }}
                  className="mt-2 px-5 py-2 text-sm font-semibold text-white rounded-xl"
                  style={{ backgroundColor: brandColor }}
                >
                  Shop Now
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {items.map((item) => (
                    <div key={`${item.productId}-${item.variantId}`} className="flex items-start gap-3">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover border border-gray-100 shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-2xl">🥩</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{item.name}</p>
                        {item.variantName && <p className="text-xs text-gray-500">{item.variantName}</p>}
                        <p className="text-sm font-bold mt-0.5" style={{ color: brandColor }}>₹{(item.price * item.quantity).toLocaleString("en-IN")}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeItem(item.productId, item.variantId)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cart footer */}
                <div className="px-5 py-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">Subtotal</span>
                    <span className="text-base font-bold text-gray-900">₹{subtotal().toLocaleString("en-IN")}</span>
                  </div>
                  <button
                    onClick={() => { setCartOpen(false); nav.go("auth") }}
                    className="w-full h-12 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
                    style={{ backgroundColor: brandColor }}
                  >
                    Proceed to Checkout <ChevronRight className="w-4 h-4" />
                  </button>
                  <p className="text-[11px] text-gray-400 text-center mt-2">Delivery fees calculated at checkout</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
