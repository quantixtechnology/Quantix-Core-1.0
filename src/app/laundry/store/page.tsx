"use client"

// ── Store Admin PWA (Phase 1: Auth · Store Context · Dashboard · Quick Actions) ─
// A mobile-first operational app for Store Managers / Counter Staff. NOT the
// desktop Admin Dashboard. It reuses the platform session store and enforces
// Store isolation on the server (every call is scoped to the signed-in store).
// Phases 2–4 (Orders/Dispatch, Store Operations, Barcode/Offline) layer on top.

import { useCallback, useEffect, useState } from "react"
import {
  Store, LogOut, Loader2, ClipboardList, Truck, PackageCheck, ClipboardCheck,
  Wallet, Boxes, CheckCircle2, PlusCircle, Search, Radar, RefreshCw,
} from "lucide-react"

const TOKEN_KEY = "qx_store_token"

interface Staff { name: string | null; roleName: string; storeName: string | null; storeCode: string | null }
interface Counts {
  todaysOrders: number; todaysPickup: number; todaysDelivery: number; pendingAudit: number
  pendingPayment: number; readyProcessing: number; readyDelivery: number; completedToday: number
}

export default function StoreAdminApp() {
  const [token, setToken] = useState<string | null>(null)
  const [staff, setStaff] = useState<Staff | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [booting, setBooting] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // login form
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loggingIn, setLoggingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authFetch = useCallback((url: string, init: RequestInit = {}, tk?: string) =>
    fetch(url, { ...init, headers: { ...(init.headers || {}), "Content-Type": "application/json", Authorization: `Bearer ${tk ?? token}` } }), [token])

  const loadDashboard = useCallback(async (tk?: string) => {
    setRefreshing(true)
    try {
      const j = await authFetch("/api/laundry/store-admin/dashboard", {}, tk).then((r) => r.json())
      if (j.success) setCounts(j.data)
    } catch { /* noop */ } finally { setRefreshing(false) }
  }, [authFetch])

  // Restore session on load.
  useEffect(() => {
    const tk = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null
    if (!tk) { setBooting(false); return }
    authFetch("/api/laundry/store-admin/me", {}, tk).then((r) => r.json()).then((j) => {
      if (j.success) { setToken(tk); setStaff(j.data); loadDashboard(tk) }
      else localStorage.removeItem(TOKEN_KEY)
    }).catch(() => {}).finally(() => setBooting(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async () => {
    setError(null); setLoggingIn(true)
    try {
      const res = await fetch("/api/laundry/store-admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Login failed")
      localStorage.setItem(TOKEN_KEY, j.data.token)
      setToken(j.data.token); setStaff(j.data.staff); setPassword("")
      loadDashboard(j.data.token)
    } catch (e) { setError(e instanceof Error ? e.message : "Login failed") } finally { setLoggingIn(false) }
  }

  const logout = async () => {
    try { await authFetch("/api/laundry/store-admin/auth/logout", { method: "POST" }) } catch { /* noop */ }
    localStorage.removeItem(TOKEN_KEY); setToken(null); setStaff(null); setCounts(null)
  }

  if (booting) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!token || !staff) {
    return (
      <div className="min-h-screen flex flex-col justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm mx-auto">
          <div className="flex flex-col items-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-3"><Store className="h-7 w-7" /></div>
            <h1 className="text-xl font-bold text-slate-800">Store Admin</h1>
            <p className="text-sm text-slate-400">Sign in to run your store</p>
          </div>
          <div className="space-y-3">
            <input type="email" inputMode="email" autoComplete="username" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} className="w-full h-12 rounded-xl border border-slate-200 px-4 text-[15px] bg-white" />
            <input type="password" autoComplete="current-password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()}
              className="w-full h-12 rounded-xl border border-slate-200 px-4 text-[15px] bg-white" />
            {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={login} disabled={loggingIn || !email || !password}
              className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {loggingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
            </button>
            <p className="text-[11px] text-slate-400 text-center pt-2">Only Store Managers, Supervisors and Counter Staff can sign in. Accounts are created by your admin.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  const tiles: { key: keyof Counts; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { key: "todaysOrders", label: "Today's Orders", icon: ClipboardList, color: "text-slate-700 bg-slate-50 border-slate-200" },
    { key: "todaysPickup", label: "Today's Pickup", icon: Truck, color: "text-amber-700 bg-amber-50 border-amber-200" },
    { key: "todaysDelivery", label: "Today's Delivery", icon: PackageCheck, color: "text-violet-700 bg-violet-50 border-violet-200" },
    { key: "pendingAudit", label: "Pending Audit", icon: ClipboardCheck, color: "text-blue-700 bg-blue-50 border-blue-200" },
    { key: "pendingPayment", label: "Pending Payment", icon: Wallet, color: "text-rose-700 bg-rose-50 border-rose-200" },
    { key: "readyProcessing", label: "Ready for Processing", icon: Boxes, color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
    { key: "readyDelivery", label: "Ready for Delivery", icon: PackageCheck, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { key: "completedToday", label: "Completed Today", icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  ]
  const quickActions = [
    { key: "walkin", label: "Walk-in Order", icon: PlusCircle },
    { key: "pickup", label: "Home Pickup", icon: Truck },
    { key: "search", label: "Search Orders", icon: Search },
    { key: "dispatch", label: "Dispatch Center", icon: Radar },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 pt-5 pb-6 rounded-b-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Store className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold truncate">{staff.storeName || "Your Store"}</p>
              <p className="text-[11px] text-blue-100 truncate">{staff.name} · {staff.roleName}{staff.storeCode ? ` · ${staff.storeCode}` : ""}</p>
            </div>
          </div>
          <button onClick={logout} className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0" title="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      <main className="px-4 -mt-3 space-y-4">
        {/* Dashboard counts */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-[13px] font-semibold text-slate-700">Today at a glance</h2>
            <button onClick={() => loadDashboard()} className="text-slate-400"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tiles.map((t) => {
              const Icon = t.icon
              return (
                <div key={t.key} className={`rounded-xl border ${t.color} p-3`}>
                  <div className="flex items-center justify-between">
                    <Icon className="h-4 w-4 opacity-70" />
                    <span className="text-xl font-bold tabular-nums">{counts ? counts[t.key] : "—"}</span>
                  </div>
                  <p className="text-[11px] mt-1 font-medium leading-tight">{t.label}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Quick actions (Phase 2 wires these to their flows) */}
        <section>
          <h2 className="text-[13px] font-semibold text-slate-700 px-1 mb-2">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((a) => {
              const Icon = a.icon
              return (
                <button key={a.key} onClick={() => alert("Available in the next update (Phase 2).")}
                  className="rounded-xl bg-white border border-slate-200 p-3.5 flex flex-col items-center gap-1.5 active:scale-[0.98] transition-transform">
                  <Icon className="h-5 w-5 text-blue-600" />
                  <span className="text-[12px] font-medium text-slate-700">{a.label}</span>
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-3">Order creation, dispatch, audit, payment, processing &amp; delivery arrive in the next updates.</p>
        </section>
      </main>
    </div>
  )
}
