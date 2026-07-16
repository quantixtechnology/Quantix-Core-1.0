"use client"

// Generic Customer Account Center — reusable by EVERY Quantix workspace
// (Laundry, Commerce, Pharmacy…). The menu is module-driven: each product only
// changes the AccountModules config; the Account Center itself never changes.
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { User, ShoppingBag, Repeat, MapPin, FileText, CreditCard, KeyRound, LogOut, ChevronRight } from "lucide-react"
import type { WebNav, WebPage } from "../storefront-website"

export interface AccountModules {
  profile: boolean
  orders: boolean
  subscriptions: boolean
  addresses: boolean
  invoices: boolean
  payments: boolean
  password: boolean
}

// Module visibility per workspace. Products enable only what they use — future
// products vary these by workspace feature flags without touching the Account
// Center. subscriptions/invoices/payments turn on as their pages ship (2B/2C).
export function accountModulesFor(_businessType: string | null | undefined): AccountModules {
  return {
    profile: true,
    orders: true,
    addresses: true,
    password: true,
    subscriptions: false, // → true in 2C (Subscriptions page)
    invoices: false,      // → true in 2B (Invoices list)
    payments: false,      // → true in 2B (Payment History)
  }
}

interface MenuDef { key: keyof AccountModules; label: string; icon: typeof User; page: WebPage }
const MENU: MenuDef[] = [
  { key: "profile", label: "My Profile", icon: User, page: "my-profile" },
  { key: "orders", label: "My Orders", icon: ShoppingBag, page: "orders" },
  { key: "subscriptions", label: "Subscriptions", icon: Repeat, page: "subscriptions" },
  { key: "addresses", label: "Saved Addresses", icon: MapPin, page: "addresses" },
  { key: "invoices", label: "Invoices", icon: FileText, page: "invoices" },
  { key: "payments", label: "Payment History", icon: CreditCard, page: "payments" },
  { key: "password", label: "Change Password", icon: KeyRound, page: "password" },
]

export function CustomerAccountCenter({ brandColor, nav }: { brandColor: string; nav: WebNav }) {
  const { isAuthenticated, user, logout } = useAuthStore()
  const { currentBusinessType } = useAdminStore()
  const modules = accountModulesFor(currentBusinessType)

  if (!isAuthenticated || !user) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-gray-500">Sign in to access your account.</p>
        <button onClick={() => nav.go("auth")} className="mt-3 rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: brandColor }}>Sign in</button>
      </div>
    )
  }

  const initial = (user.name || "U").charAt(0).toUpperCase()
  const items = MENU.filter((m) => modules[m.key])

  return (
    <div className="px-4 sm:px-6 py-5 pb-24 max-w-2xl mx-auto">
      <h1 className="text-lg font-bold text-gray-900">My Account</h1>

      {/* Header */}
      <button onClick={() => nav.go("my-profile")} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm active:bg-gray-50">
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white" style={{ backgroundColor: brandColor }}>{initial}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-gray-900">{user.name || "Customer"}</p>
          {user.phone && <p className="text-xs text-gray-400">{user.phone}</p>}
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300" />
      </button>

      {/* Module-driven menu */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-50">
        {items.map((m) => (
          <button key={m.key} onClick={() => nav.go(m.page)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${brandColor}12` }}><m.icon className="h-4 w-4" style={{ color: brandColor }} /></span>
            <span className="flex-1 text-sm font-semibold text-gray-900">{m.label}</span>
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </button>
        ))}
      </div>

      <button onClick={() => { logout(); nav.go("home") }} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 text-left shadow-sm active:bg-gray-50">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50"><LogOut className="h-4 w-4 text-red-500" /></span>
        <span className="flex-1 text-sm font-semibold text-red-600">Sign Out</span>
      </button>
    </div>
  )
}
