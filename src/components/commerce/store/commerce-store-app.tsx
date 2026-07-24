"use client"

// ── Commerce Store Admin PWA (Phase 1: shell) ─────────────────────────────────
// Another frontend for the EXISTING Commerce platform — one DB, one order engine,
// one auth. Reuses commerce auth (/api/core/auth/login → access token + user with
// role/storeId) and will reuse /api/core/orders (already store-scoped + role-
// enforced) for the operational modules in Phase 2. This phase ships auth, branded
// shell, navigation and dashboard placeholders. No duplicate models or logic.

import { useCallback, useEffect, useState } from "react"
import {
  Store, LogOut, Loader2, ClipboardList, Clock, ChefHat, PackageCheck, Truck, CheckCircle2,
  Wallet, Users, LayoutGrid, ScanLine, Boxes, User,
} from "lucide-react"

const TOKEN_KEY = "qx_commerce_store_token"
const USER_KEY = "qx_commerce_store_user"

interface Tenant { platformBusinessId: string; name: string; logo: string | null; primaryColor: string }
interface SessionUser { name: string; role: string; businessId: string; businessName?: string; storeId?: string | null }
type Tab = "home" | "orders" | "packing" | "dispatch" | "profile"

export function CommerceStoreApp({ tenant }: { tenant: Tenant }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [booting, setBooting] = useState(true)
  const [tab, setTab] = useState<Tab>("home")
  const [online, setOnline] = useState(true)

  const [email, setEmail] = useState(""); const [password, setPassword] = useState("")
  const [loggingIn, setLoggingIn] = useState(false); const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false)
    setOnline(navigator.onLine); window.addEventListener("online", on); window.addEventListener("offline", off)
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off) }
  }, [])
  useEffect(() => {
    const tk = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null
    const u = typeof window !== "undefined" ? localStorage.getItem(USER_KEY) : null
    if (tk && u) { try { setToken(tk); setUser(JSON.parse(u)) } catch { /* ignore */ } }
    setBooting(false)
  }, [])

  const login = async () => {
    setError(null); setLoggingIn(true)
    try {
      const res = await fetch("/api/core/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Login failed")
      const tk = j.data?.accessToken; const su = j.data?.user
      if (!tk || !su) throw new Error("Login failed")
      const sess: SessionUser = { name: su.name, role: su.role, businessId: su.businessId, businessName: su.businessName, storeId: su.storeId }
      localStorage.setItem(TOKEN_KEY, tk); localStorage.setItem(USER_KEY, JSON.stringify(sess))
      setToken(tk); setUser(sess); setPassword("")
    } catch (e) { setError(e instanceof Error ? e.message : "Login failed") } finally { setLoggingIn(false) }
  }
  const logout = useCallback(async () => {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); setToken(null); setUser(null)
  }, [])

  if (booting) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin" style={{ color: tenant.primaryColor }} /></div>

  if (!token || !user) {
    return (
      <div className="min-h-screen flex flex-col justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm mx-auto">
          <div className="flex flex-col items-center mb-8">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3 overflow-hidden bg-white border border-slate-200">
              {tenant.logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={tenant.logo} alt="" className="h-full w-full object-contain" /> : <Store className="h-7 w-7" style={{ color: tenant.primaryColor }} />}
            </div>
            <h1 className="text-xl font-bold text-slate-800">{tenant.name}</h1>
            <p className="text-sm text-slate-400">Store Admin · sign in to run your store</p>
          </div>
          <div className="space-y-3">
            <input type="email" inputMode="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 rounded-xl border border-slate-200 px-4 text-[15px] bg-white" />
            <input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} className="w-full h-12 rounded-xl border border-slate-200 px-4 text-[15px] bg-white" />
            {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={login} disabled={loggingIn || !email || !password} className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: tenant.primaryColor }}>{loggingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}</button>
            <p className="text-[11px] text-slate-400 text-center pt-2">Store staff sign in with their Commerce account.</p>
          </div>
        </div>
      </div>
    )
  }

  const kpis = [
    { label: "Today's Orders", icon: ClipboardList }, { label: "Pending", icon: Clock },
    { label: "Preparing", icon: ChefHat }, { label: "Ready for Pickup", icon: PackageCheck },
    { label: "Ready for Delivery", icon: Boxes }, { label: "Out for Delivery", icon: Truck },
    { label: "Delivered Today", icon: CheckCircle2 }, { label: "Today's Revenue", icon: Wallet },
    { label: "Pending Payments", icon: Wallet }, { label: "Today's Customers", icon: Users },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="text-white px-4 pt-5 pb-6 rounded-b-2xl" style={{ backgroundColor: tenant.primaryColor }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden">
              {tenant.logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={tenant.logo} alt="" className="h-full w-full object-contain" /> : <Store className="h-5 w-5" style={{ color: tenant.primaryColor }} />}
            </div>
            <div className="min-w-0"><p className="text-[15px] font-bold truncate leading-tight">{tenant.name}</p><p className="text-[12px] text-white/80 truncate">{user.businessName || "Store"} · {user.role}</p></div>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${online ? "bg-white/20" : "bg-amber-400/30"}`}><span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-300" : "bg-amber-300"}`} />{online ? "Online" : "Offline"}</span>
        </div>
      </header>

      <main className="px-4 -mt-3 space-y-4">
        {tab === "home" && (
          <>
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
              <h2 className="text-[13px] font-semibold text-slate-700 mb-2 px-1">Today at a glance</h2>
              <div className="grid grid-cols-2 gap-2">
                {kpis.map((k) => { const Icon = k.icon; return (
                  <div key={k.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between"><Icon className="h-4 w-4 text-slate-400" /><span className="text-xl font-bold text-slate-300">—</span></div>
                    <p className="text-[11px] mt-1 font-medium text-slate-600 leading-tight">{k.label}</p>
                  </div>
                )})}
              </div>
            </section>
            <p className="text-[12px] text-slate-400 text-center px-6">Live counts, orders, packing, dispatch, payments and reports arrive in the next update — all reusing the existing Commerce APIs and order engine.</p>
          </>
        )}
        {tab !== "home" && tab !== "profile" && (
          <div className="py-20 text-center text-slate-400"><p className="text-sm capitalize">{tab}</p><p className="text-[12px] mt-1">Available in the next update (Phase 2).</p></div>
        )}
        {tab === "profile" && (
          <div className="space-y-4 pt-2">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-[13px]">
              <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="font-medium text-slate-700">{user.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Role</span><span className="font-medium text-slate-700">{user.role}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Business</span><span className="font-medium text-slate-700">{user.businessName || tenant.name}</span></div>
            </div>
            <button onClick={logout} className="w-full h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-semibold flex items-center justify-center gap-2"><LogOut className="h-5 w-5" /> Sign Out</button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 grid grid-cols-5 z-30">
        {([["home", "Home", LayoutGrid], ["orders", "Orders", ClipboardList], ["packing", "Packing", PackageCheck], ["dispatch", "Dispatch", Truck], ["profile", "Profile", User]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className="flex flex-col items-center gap-0.5 py-2" style={{ color: tab === k ? tenant.primaryColor : "#94a3b8" }}>
            <Icon className="h-5 w-5" /><span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </nav>
      <button className="fixed bottom-20 right-4 h-14 w-14 rounded-full text-white shadow-lg flex items-center justify-center z-30" style={{ backgroundColor: tenant.primaryColor }} onClick={() => setTab("orders")}><ScanLine className="h-6 w-6" /></button>
    </div>
  )
}
