"use client"

// ── Commerce Store Admin PWA ──────────────────────────────────────────────────
// A mobile OPERATIONAL interface for the EXISTING Commerce platform. It owns NO
// business logic and NO data of its own — every screen calls the SAME /api/core/*
// services (with the commerce access token + x-business-id) that the Desktop
// Admin, POS and Website use. Store scope, pricing, the order state machine, tax,
// inventory and invoices are ALL enforced server-side. No duplicate models, APIs,
// workflows or auth. One source of truth: the Commerce database.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Store, LogOut, Loader2, ClipboardList, Clock, ChefHat, PackageCheck, Truck, CheckCircle2,
  Users, LayoutGrid, User, Search, ChevronLeft, Phone, PlusCircle, X, RefreshCw, XCircle,
  Menu, Package, Boxes, FileText, ReceiptText, BarChart3, FolderTree, IndianRupee,
  ChevronRight, MapPin, AlertTriangle,
} from "lucide-react"

const TOKEN_KEY = "qx_commerce_store_token"
const REFRESH_KEY = "qx_commerce_store_refresh"
const USER_KEY = "qx_commerce_store_user"

interface Tenant { platformBusinessId: string; name: string; logo: string | null; primaryColor: string }
interface SessionUser { name: string; role: string; businessId: string; businessName?: string; storeId?: string | null }
type Tab = "home" | "orders" | "packing" | "dispatch" | "profile"
type Screen = "products" | "categories" | "customers" | "inventory" | "payments" | "invoices" | "reports"

const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() }
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return d.toISOString() }
const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending", CONFIRMED: "Confirmed", PREPARING: "Preparing", READY_FOR_PICKUP: "Ready",
  READY_FOR_DELIVERY: "Ready for Delivery", OUT_FOR_DELIVERY: "Out for Delivery", DELIVERED: "Delivered",
  CANCELLED: "Cancelled", REFUNDED: "Refunded", PICKED_UP: "Picked Up", PICKUP_ASSIGNED: "Pickup Assigned",
  PROCESSING: "Processing", SCHEDULED: "Scheduled",
}

// Client mirror of the server order state machine (src/lib/core/order.ts). The
// server is the authority and re-validates every transition; this only decides
// which forward action to OFFER so we never present an invalid move.
const TRANSITIONS: Record<string, Record<string, string[]>> = {
  DELIVERY: { PENDING: ["CONFIRMED"], CONFIRMED: ["PREPARING"], PREPARING: ["READY_FOR_PICKUP"], READY_FOR_PICKUP: ["OUT_FOR_DELIVERY"], OUT_FOR_DELIVERY: ["DELIVERED"], SCHEDULED: ["CONFIRMED"] },
  PICKUP: { PENDING: ["CONFIRMED"], CONFIRMED: ["PREPARING"], PREPARING: ["READY_FOR_PICKUP"], READY_FOR_PICKUP: ["DELIVERED"] },
  DINE_IN: { PENDING: ["CONFIRMED"], CONFIRMED: ["PREPARING"], PREPARING: ["READY_FOR_PICKUP"], READY_FOR_PICKUP: ["DELIVERED"] },
  POS: { PENDING: ["CONFIRMED"], CONFIRMED: ["DELIVERED"] },
  PICKUP_AND_DELIVERY: { PENDING: ["PICKUP_ASSIGNED"], PICKUP_ASSIGNED: ["PICKED_UP"], PICKED_UP: ["PROCESSING"], PROCESSING: ["READY_FOR_DELIVERY"], READY_FOR_DELIVERY: ["OUT_FOR_DELIVERY"], OUT_FOR_DELIVERY: ["DELIVERED"], SCHEDULED: ["PICKUP_ASSIGNED"] },
  SUBSCRIPTION: { PENDING: ["CONFIRMED"], CONFIRMED: ["PREPARING"], PREPARING: ["READY_FOR_PICKUP"], READY_FOR_PICKUP: ["DELIVERED"], OUT_FOR_DELIVERY: ["DELIVERED"] },
}
const forwardStatuses = (orderType: string, status: string) => (TRANSITIONS[orderType] || TRANSITIONS.DELIVERY)[status] || []
const isTerminal = (s: string) => s === "DELIVERED" || s === "CANCELLED" || s === "REFUNDED"
const isDeliveryType = (t: string) => t === "DELIVERY" || t === "PICKUP_AND_DELIVERY"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = (path: string, init?: RequestInit, tk?: string, biz?: string) => Promise<any>

export function CommerceStoreApp({ tenant }: { tenant: Tenant }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [booting, setBooting] = useState(true)
  const [tab, setTab] = useState<Tab>("home")
  const [screen, setScreen] = useState<Screen | null>(null)
  const [online, setOnline] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [ordersStatus, setOrdersStatus] = useState<string>("")
  const [showCreate, setShowCreate] = useState(false)
  const [drawer, setDrawer] = useState(false)

  const [email, setEmail] = useState(""); const [password, setPassword] = useState("")
  const [loggingIn, setLoggingIn] = useState(false); const [error, setError] = useState<string | null>(null)

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); localStorage.removeItem(USER_KEY)
    setToken(null); setUser(null)
  }, [])

  // Single-flight token refresh via the EXISTING /api/core/auth/refresh (rotation).
  // The dashboard fires ~8 calls at once; if the access token has expired they must
  // share ONE refresh, not stampede the endpoint.
  const refreshingRef = useRef<Promise<string | null> | null>(null)
  const refreshAccess = useCallback((): Promise<string | null> => {
    if (refreshingRef.current) return refreshingRef.current
    const p = (async () => {
      const rt = typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null
      if (!rt) return null
      try {
        const res = await fetch("/api/core/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: rt }) })
        const j = await res.json().catch(() => ({}))
        if (!res.ok || !j?.success || !j?.data?.accessToken) return null
        localStorage.setItem(TOKEN_KEY, j.data.accessToken)
        if (j.data.refreshToken) localStorage.setItem(REFRESH_KEY, j.data.refreshToken)
        setToken(j.data.accessToken)
        return j.data.accessToken as string
      } catch { return null }
    })()
    refreshingRef.current = p
    p.finally(() => { refreshingRef.current = null })
    return p
  }, [])

  // Every screen calls the SAME /api/core/* services through this helper. On a 401
  // (expired/rotated access token) it transparently refreshes and retries ONCE; if
  // refresh fails it drops to the login screen instead of silently blanking the UI.
  const api = useCallback<Api>(async (path, init = {}, tk?, biz?) => {
    const bid = biz ?? user?.businessId ?? tenant.platformBusinessId
    const call = (t: string | null | undefined) => fetch(path, { ...init, headers: { ...(init.headers || {}), "Content-Type": "application/json", Authorization: `Bearer ${t ?? ""}`, "x-business-id": bid } })
    let res = await call(tk ?? token)
    if (res.status === 401 && !tk) {
      const nt = await refreshAccess()
      if (nt) res = await call(nt)
      else { clearSession(); return { success: false, error: "Session expired. Please sign in again." } }
    }
    return res.json().catch(() => ({}))
  }, [token, user, tenant.platformBusinessId, refreshAccess, clearSession])

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false)
    setOnline(navigator.onLine); window.addEventListener("online", on); window.addEventListener("offline", off)
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off) }
  }, [])
  useEffect(() => {
    const tk = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null
    const u = typeof window !== "undefined" ? localStorage.getItem(USER_KEY) : null
    if (tk && u) {
      try {
        const parsed = JSON.parse(u) as SessionUser
        // Heal any session (incl. ones stored before this fix, or a platform admin)
        // that has no business context → scope to the store host's tenant business.
        if (!parsed.businessId) parsed.businessId = tenant.platformBusinessId
        setToken(tk); setUser(parsed)
      } catch { /* ignore */ }
    }
    setBooting(false)
  }, [tenant.platformBusinessId])

  const login = async () => {
    setError(null); setLoggingIn(true)
    try {
      const res = await fetch("/api/core/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Login failed")
      const tk = j.data?.accessToken; const su = j.data?.user; const rt = j.data?.refreshToken
      if (!tk || !su) throw new Error("Login failed")
      // The store host IS the tenant. A platform Super Admin has NO businessUser, so
      // login returns businessId=undefined — without this fallback every tenant-scoped
      // URL becomes /businesses/undefined/... → WHERE businessId="undefined" → 0 rows
      // (blank Products/Customers/Inventory/Categories). Scope to the host's business.
      const sess: SessionUser = { name: su.name, role: su.role, businessId: su.businessId || tenant.platformBusinessId, businessName: su.businessName || tenant.name, storeId: su.storeId }
      localStorage.setItem(TOKEN_KEY, tk); localStorage.setItem(USER_KEY, JSON.stringify(sess))
      if (rt) localStorage.setItem(REFRESH_KEY, rt) // enables transparent 401 refresh
      setToken(tk); setUser(sess); setPassword("")
    } catch (e) { setError(e instanceof Error ? e.message : "Login failed") } finally { setLoggingIn(false) }
  }
  const logout = clearSession
  const goOrders = (status: string) => { setScreen(null); setOrdersStatus(status); setTab("orders") }
  const openModule = (s: Screen) => { setDrawer(false); setScreen(s) }

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
          </div>
        </div>
      </div>
    )
  }

  const modules: { key: Screen; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "products", label: "Products", icon: Package },
    { key: "categories", label: "Categories", icon: FolderTree },
    { key: "customers", label: "Customers", icon: Users },
    { key: "inventory", label: "Inventory", icon: Boxes },
    { key: "payments", label: "Payments", icon: IndianRupee },
    { key: "invoices", label: "Invoices", icon: ReceiptText },
    { key: "reports", label: "Reports", icon: BarChart3 },
  ]
  const chrome = openId || screen

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {openId ? (
        <OrderDetail id={openId} tenant={tenant} api={api} onBack={() => setOpenId(null)} />
      ) : screen ? (
        <ModuleScreen screen={screen} tenant={tenant} user={user} api={api} onBack={() => setScreen(null)} onOpenOrder={(id) => { setScreen(null); setOpenId(id) }} />
      ) : (
        <>
          {tab === "home" && <Dashboard tenant={tenant} user={user} api={api} online={online} onCounter={goOrders} onMenu={() => setDrawer(true)} onModule={openModule} />}
          {tab === "orders" && <Orders tenant={tenant} api={api} status={ordersStatus} setStatus={setOrdersStatus} onOpen={setOpenId} />}
          {tab === "packing" && <Queue title="Packing" subtitle="Prepare & pack — advances the same order lifecycle" tenant={tenant} api={api} statuses="CONFIRMED,PREPARING,READY_FOR_PICKUP" onOpen={setOpenId} />}
          {tab === "dispatch" && <Dispatch tenant={tenant} api={api} onOpen={setOpenId} />}
          {tab === "profile" && <Profile tenant={tenant} user={user} online={online} onLogout={logout} />}
        </>
      )}

      {showCreate && <CreateSheet tenant={tenant} user={user} api={api} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setTab("orders"); setOrdersStatus("") }} />}

      {drawer && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative ml-auto w-72 max-w-[80%] bg-white h-full shadow-xl p-3 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b border-slate-100"><span className="text-[13px] font-semibold text-slate-700">Store Modules</span><button onClick={() => setDrawer(false)}><X className="h-5 w-5 text-slate-400" /></button></div>
            {modules.map((m) => { const Icon = m.icon; return (
              <button key={m.key} onClick={() => openModule(m.key)} className="w-full flex items-center gap-3 px-2 py-3 rounded-lg active:bg-slate-50 text-left">
                <Icon className="h-5 w-5 text-slate-400" /><span className="text-[14px] font-medium text-slate-700 flex-1">{m.label}</span><ChevronRight className="h-4 w-4 text-slate-300" />
              </button>
            )})}
          </div>
        </div>
      )}

      {!chrome && (
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 grid grid-cols-5 z-30">
          {([["home", "Home", LayoutGrid], ["orders", "Orders", ClipboardList], ["packing", "Packing", PackageCheck], ["dispatch", "Dispatch", Truck], ["profile", "Profile", User]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className="flex flex-col items-center gap-0.5 py-2" style={{ color: tab === k ? tenant.primaryColor : "#94a3b8" }}>
              <Icon className="h-5 w-5" /><span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </nav>
      )}
      {!chrome && (tab === "home" || tab === "orders") && (
        <button onClick={() => setShowCreate(true)} className="fixed bottom-20 right-4 h-14 w-14 rounded-full text-white shadow-lg flex items-center justify-center z-30" style={{ backgroundColor: tenant.primaryColor }} aria-label="New order"><PlusCircle className="h-7 w-7" /></button>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ tenant, user, api, online, onCounter, onMenu, onModule }: { tenant: Tenant; user: SessionUser; api: Api; online: boolean; onCounter: (s: string) => void; onMenu: () => void; onModule: (s: Screen) => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [revenue, setRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  const biz = user.businessId
  const load = useCallback(async () => {
    setLoading(true)
    const total = async (qs: string) => { const j = await api(`/api/core/orders?businessId=${biz}&limit=1&${qs}`); return j?.pagination?.total ?? (Array.isArray(j?.data) ? j.data.length : 0) }
    const today = `dateFrom=${encodeURIComponent(todayStart())}`
    const [todays, pending, preparing, readyPickup, readyDelivery, ofd, delivered, cancelled] = await Promise.all([
      total(today), total("status=PENDING"), total("status=CONFIRMED,PREPARING"), total("status=READY_FOR_PICKUP"),
      total("status=READY_FOR_DELIVERY"), total("status=OUT_FOR_DELIVERY"), total(`status=DELIVERED&${today}`), total(`status=CANCELLED&${today}`),
    ])
    setCounts({ todays, pending, preparing, readyPickup, readyDelivery, ofd, delivered, cancelled })
    const rev = await api(`/api/core/orders?businessId=${biz}&limit=200&${today}`)
    setRevenue(Array.isArray(rev?.data) ? rev.data.reduce((s: number, o: { totalAmount?: number }) => s + (o.totalAmount || 0), 0) : 0)
    setLoading(false)
  }, [api, biz])
  useEffect(() => { load() }, [load])

  const tiles: { label: string; key: string; icon: React.ComponentType<{ className?: string }>; status: string }[] = [
    { label: "Today's Orders", key: "todays", icon: ClipboardList, status: "" },
    { label: "Pending", key: "pending", icon: Clock, status: "PENDING" },
    { label: "Preparing", key: "preparing", icon: ChefHat, status: "CONFIRMED,PREPARING" },
    { label: "Ready", key: "readyPickup", icon: PackageCheck, status: "READY_FOR_PICKUP" },
    { label: "Out for Delivery", key: "ofd", icon: Truck, status: "OUT_FOR_DELIVERY" },
    { label: "Delivered Today", key: "delivered", icon: CheckCircle2, status: "DELIVERED" },
    { label: "Cancelled", key: "cancelled", icon: XCircle, status: "CANCELLED" },
    { label: "AOV Today", key: "aov", icon: IndianRupee, status: "" },
  ]
  const aov = counts.todays ? Math.round(revenue / counts.todays) : 0
  const quick: { key: Screen; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[] = [
    { key: "products", label: "Products", icon: Package }, { key: "inventory", label: "Inventory", icon: Boxes },
    { key: "customers", label: "Customers", icon: Users }, { key: "reports", label: "Reports", icon: BarChart3 },
  ]
  return (
    <>
      <header className="text-white px-4 pt-5 pb-6 rounded-b-2xl" style={{ backgroundColor: tenant.primaryColor }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden">{tenant.logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={tenant.logo} alt="" className="h-full w-full object-contain" /> : <Store className="h-5 w-5" style={{ color: tenant.primaryColor }} />}</div>
            <div className="min-w-0"><p className="text-[15px] font-bold truncate leading-tight">{tenant.name}</p><p className="text-[12px] text-white/80 truncate">{user.businessName || "Store"} · {user.role}</p></div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${online ? "bg-white/20" : "bg-amber-400/30"}`}><span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-300" : "bg-amber-300"}`} />{online ? "Online" : "Offline"}</span>
            <button onClick={onMenu} className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center" aria-label="Modules"><Menu className="h-4.5 w-4.5" /></button>
          </div>
        </div>
        <div className="mt-3 bg-white/15 rounded-xl px-3 py-2 flex items-center justify-between">
          <span className="text-[12px] text-white/80">Revenue Today</span><span className="text-lg font-bold">{inr(revenue)}</span>
        </div>
      </header>
      <main className="px-4 -mt-3 space-y-4">
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
          <div className="flex items-center justify-between mb-2 px-1"><h2 className="text-[13px] font-semibold text-slate-700">Today at a glance</h2><button onClick={load} className="text-slate-400" aria-label="Refresh"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button></div>
          <div className="grid grid-cols-2 gap-2">
            {tiles.map((t) => { const Icon = t.icon; const isAov = t.key === "aov"; return (
              <button key={t.key} onClick={() => !isAov && onCounter(t.status)} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between"><Icon className="h-4 w-4 text-slate-400" /><span className="text-xl font-bold tabular-nums text-slate-800">{loading ? "—" : isAov ? inr(aov) : (counts[t.key] ?? 0)}</span></div>
                <p className="text-[11px] mt-1 font-medium text-slate-600 leading-tight">{t.label}</p>
              </button>
            )})}
          </div>
        </section>
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
          <h2 className="text-[13px] font-semibold text-slate-700 mb-2 px-1">Quick actions</h2>
          <div className="grid grid-cols-4 gap-2">
            {quick.map((q) => { const Icon = q.icon; return (
              <button key={q.key} onClick={() => onModule(q.key)} className="flex flex-col items-center gap-1.5 py-2 rounded-xl border border-slate-100 active:bg-slate-50">
                <Icon className="h-5 w-5" style={{ color: tenant.primaryColor }} /><span className="text-[11px] font-medium text-slate-600">{q.label}</span>
              </button>
            )})}
          </div>
        </section>
      </main>
    </>
  )
}

// ── Orders list ───────────────────────────────────────────────────────────────
function Orders({ tenant, api, status, setStatus, onOpen }: { tenant: Tenant; api: Api; status: string; setStatus: (s: string) => void; onOpen: (id: string) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orders, setOrders] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [q, setQ] = useState("")
  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams({ limit: "50" }); if (status) p.set("status", status); if (q.trim()) p.set("search", q.trim())
    api(`/api/core/orders?${p}`).then((j) => { if (j.success) setOrders(j.data || []) }).finally(() => setLoading(false))
  }, [api, status, q])
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [load, q])
  const chips = [["", "All"], ["PENDING", "Pending"], ["CONFIRMED,PREPARING", "Preparing"], ["READY_FOR_PICKUP", "Ready"], ["OUT_FOR_DELIVERY", "Out for Delivery"], ["DELIVERED", "Delivered"], ["CANCELLED", "Cancelled"]] as const
  return (
    <div className="px-3 pt-3 space-y-3">
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order # / customer / phone" className="w-full h-11 pl-9 rounded-xl border border-slate-200 bg-white text-[15px]" /></div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">{chips.map(([v, l]) => (<button key={v} onClick={() => setStatus(v)} className={`shrink-0 px-3 h-8 rounded-full text-[12px] font-medium border ${status === v ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200"}`} style={status === v ? { backgroundColor: tenant.primaryColor } : undefined}>{l}</button>))}</div>
      {loading ? <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin inline" style={{ color: tenant.primaryColor }} /></div>
        : orders.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">No orders.</p>
        : <div className="space-y-2">{orders.map((o) => <OrderRow key={o.id} o={o} onOpen={onOpen} />)}</div>}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OrderRow({ o, onOpen }: { o: any; onOpen: (id: string) => void }) {
  return (
    <button onClick={() => onOpen(o.id)} className="w-full text-left bg-white rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between"><span className="font-mono font-bold text-[13px] text-slate-800">{o.orderNumber}</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{STATUS_LABEL[o.status] || o.status}</span></div>
      <div className="flex items-center justify-between mt-1 text-[12px] text-slate-500"><span className="truncate">{o.customerName || o.customer?.name || "—"} · {o.orderType}</span><span className="font-semibold text-slate-700">{inr(o.totalAmount)}</span></div>
    </button>
  )
}

// ── Generic status queue (Packing) ─────────────────────────────────────────────
function Queue({ title, subtitle, tenant, api, statuses, onOpen }: { title: string; subtitle: string; tenant: Tenant; api: Api; statuses: string; onOpen: (id: string) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orders, setOrders] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [busyId, setBusyId] = useState<string | null>(null)
  const load = useCallback(() => { setLoading(true); api(`/api/core/orders?status=${statuses}&limit=100`).then((j) => { if (j.success) setOrders(j.data || []) }).finally(() => setLoading(false)) }, [api, statuses])
  useEffect(() => { load() }, [load])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const advance = async (o: any, next: string) => {
    setBusyId(o.id)
    try { const j = await api(`/api/core/orders/${o.id}/status`, { method: "PUT", body: JSON.stringify({ status: next }) }); if (j.success) load() } finally { setBusyId(null) }
  }
  return (
    <div className="px-3 pt-4 space-y-3">
      <div className="flex items-center justify-between"><div><h1 className="text-[16px] font-bold text-slate-800">{title}</h1><p className="text-[11px] text-slate-400">{subtitle}</p></div><button onClick={load} className="text-slate-400"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
      {loading ? <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin inline" style={{ color: tenant.primaryColor }} /></div>
        : orders.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">Nothing in the {title.toLowerCase()} queue.</p>
        : <div className="space-y-2">{orders.map((o) => { const next = forwardStatuses(o.orderType, o.status)[0]; return (
            <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-3">
              <button onClick={() => onOpen(o.id)} className="w-full text-left">
                <div className="flex items-center justify-between"><span className="font-mono font-bold text-[13px] text-slate-800">{o.orderNumber}</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{STATUS_LABEL[o.status] || o.status}</span></div>
                <div className="flex items-center justify-between mt-1 text-[12px] text-slate-500"><span className="truncate">{o.customerName || o.customer?.name || "—"} · {(o.items?.length ?? o._count?.items ?? "")} items</span><span className="font-semibold text-slate-700">{inr(o.totalAmount)}</span></div>
              </button>
              {next && <button onClick={() => advance(o, next)} disabled={busyId === o.id} className="mt-2 w-full h-9 rounded-lg text-white text-[13px] font-semibold flex items-center justify-center gap-1 disabled:opacity-60" style={{ backgroundColor: tenant.primaryColor }}>{busyId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Mark {STATUS_LABEL[next]}</>}</button>}
            </div>
          )})}</div>}
    </div>
  )
}

// ── Dispatch (assign executive + track OFD) ────────────────────────────────────
function Dispatch({ tenant, api, onOpen }: { tenant: Tenant; api: Api; onOpen: (id: string) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orders, setOrders] = useState<any[]>([]); const [loading, setLoading] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [partners, setPartners] = useState<any[]>([])
  const [assignFor, setAssignFor] = useState<string | null>(null); const [busyId, setBusyId] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true)
    api(`/api/core/orders?status=READY_FOR_PICKUP,READY_FOR_DELIVERY,OUT_FOR_DELIVERY&limit=100`).then((j) => { if (j.success) setOrders((j.data || []).filter((o: { orderType: string }) => isDeliveryType(o.orderType))) }).finally(() => setLoading(false))
  }, [api])
  useEffect(() => { load() }, [load])
  useEffect(() => { api(`/api/core/delivery/partners?isActive=true`).then((j) => { if (j.success) setPartners(j.data || []) }) }, [api])
  const assign = async (orderId: string, partnerId: string) => {
    setBusyId(orderId)
    try { const j = await api(`/api/core/orders/${orderId}/assign-partner`, { method: "POST", body: JSON.stringify({ partnerId }) }); if (j.success) { setAssignFor(null); load() } } finally { setBusyId(null) }
  }
  const markStatus = async (orderId: string, status: string) => { setBusyId(orderId); try { const j = await api(`/api/core/orders/${orderId}/status`, { method: "PUT", body: JSON.stringify({ status }) }); if (j.success) load() } finally { setBusyId(null) } }
  return (
    <div className="px-3 pt-4 space-y-3">
      <div className="flex items-center justify-between"><div><h1 className="text-[16px] font-bold text-slate-800">Dispatch</h1><p className="text-[11px] text-slate-400">Assign delivery executives — reuses the Commerce delivery engine</p></div><button onClick={load} className="text-slate-400"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
      {loading ? <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin inline" style={{ color: tenant.primaryColor }} /></div>
        : orders.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">No deliveries to dispatch.</p>
        : <div className="space-y-2">{orders.map((o) => { const ofd = o.status === "OUT_FOR_DELIVERY"; return (
            <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-3">
              <button onClick={() => onOpen(o.id)} className="w-full text-left">
                <div className="flex items-center justify-between"><span className="font-mono font-bold text-[13px] text-slate-800">{o.orderNumber}</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{STATUS_LABEL[o.status] || o.status}</span></div>
                <div className="flex items-center justify-between mt-1 text-[12px] text-slate-500"><span className="truncate">{o.customerName || o.customer?.name || "—"}</span><span className="font-semibold text-slate-700">{inr(o.totalAmount)}</span></div>
                {o.deliveryPartner?.name && <p className="text-[11px] text-emerald-600 mt-1">Executive: {o.deliveryPartner.name}</p>}
              </button>
              {ofd ? (
                <button onClick={() => markStatus(o.id, "DELIVERED")} disabled={busyId === o.id} className="mt-2 w-full h-9 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold flex items-center justify-center gap-1 disabled:opacity-60">{busyId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark Delivered"}</button>
              ) : assignFor === o.id ? (
                <div className="mt-2 space-y-1">
                  {partners.length === 0 && <p className="text-[11px] text-slate-400 px-1">No active executives. Add one in Desktop → Delivery.</p>}
                  {partners.map((p) => (<button key={p.id} onClick={() => assign(o.id, p.id)} disabled={busyId === o.id} className="w-full flex items-center justify-between px-3 h-10 rounded-lg border border-slate-200 text-[13px]"><span className="text-slate-700">{p.name}</span><span className="text-slate-400 text-[11px]">{p.phone}</span></button>))}
                  <button onClick={() => setAssignFor(null)} className="w-full h-8 text-[12px] text-slate-400">Cancel</button>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button onClick={() => setAssignFor(o.id)} className="h-9 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 flex items-center justify-center gap-1"><User className="h-4 w-4" />{o.deliveryPartner ? "Reassign" : "Assign"}</button>
                  <button onClick={() => markStatus(o.id, "OUT_FOR_DELIVERY")} disabled={busyId === o.id || !o.deliveryPartner} className="h-9 rounded-lg text-white text-[13px] font-semibold flex items-center justify-center gap-1 disabled:opacity-40" style={{ backgroundColor: tenant.primaryColor }}>{busyId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Out for Delivery"}</button>
                </div>
              )}
            </div>
          )})}</div>}
    </div>
  )
}

// ── Order detail + lifecycle actions ───────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OrderDetail({ id, tenant, api, onBack }: { id: string; tenant: Tenant; api: Api; onBack: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [order, setOrder] = useState<any>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  const load = useCallback(() => { setLoading(true); api(`/api/core/orders/${id}`).then((j) => { if (j.success) setOrder(j.data) }).finally(() => setLoading(false)) }, [api, id])
  useEffect(() => { load() }, [load])
  const setStatus = async (status: string) => {
    setErr(null); setBusy(true)
    try { const j = await api(`/api/core/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }); if (!j.success) throw new Error(j.error || "Could not update"); load() }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }
  if (loading || !order) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: tenant.primaryColor }} /></div>
  const phone = order.customerPhone || order.customer?.phone
  const next = forwardStatuses(order.orderType, order.status)
  const canCancel = !isTerminal(order.status)
  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="bg-white border-b border-slate-200 px-3 py-3 flex items-center gap-2 sticky top-0 z-20">
        <button onClick={onBack} className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center"><ChevronLeft className="h-5 w-5" /></button>
        <div className="min-w-0"><p className="font-mono font-bold text-[14px] text-slate-800 truncate">{order.orderNumber}</p><p className="text-[11px] text-slate-400">{STATUS_LABEL[order.status] || order.status} · {order.orderType}</p></div>
      </header>
      <div className="p-3 space-y-3">
        <div className="rounded-xl p-3 text-white" style={{ backgroundColor: tenant.primaryColor }}><p className="text-[10px] uppercase text-white/70">Current Status</p><p className="text-[17px] font-bold">{STATUS_LABEL[order.status] || order.status}</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
          <div className="flex items-center gap-2 text-[14px] font-medium"><User className="h-4 w-4 text-slate-400" />{order.customerName || order.customer?.name || "—"}</div>
          {phone && <div className="flex items-center gap-2"><span className="flex-1 flex items-center gap-2 text-[13px] text-slate-500"><Phone className="h-4 w-4 text-slate-400" />{phone}</span>
            <a href={`tel:${phone}`} className="h-9 px-3 rounded-lg bg-slate-50 text-slate-700 text-[12px] font-medium flex items-center gap-1"><Phone className="h-3.5 w-3.5" />Call</a>
            <a href={`https://wa.me/${String(phone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-[12px] font-medium">WhatsApp</a></div>}
          {order.deliveryPartner?.name && <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-[12px] text-slate-600"><Truck className="h-4 w-4 text-slate-400" />Executive: <span className="font-medium">{order.deliveryPartner.name}</span></div>}
        </div>
        {Array.isArray(order.items) && order.items.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-3"><p className="text-[12px] font-semibold text-slate-600 mb-2">Items ({order.items.length})</p>
            <div className="space-y-1">{order.items.map((it: { id: string; itemName: string; quantity: number; unitPrice: number }) => (<div key={it.id} className="flex items-center justify-between text-[12px]"><span className="text-slate-700">{it.quantity} × {it.itemName}</span><span className="text-slate-500">{inr(it.unitPrice * it.quantity)}</span></div>))}</div>
          </div>
        )}
        {/* Invoice / bill breakdown — computed & persisted server-side by the Commerce pricing engine */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-[13px] space-y-1">
          <p className="text-[12px] font-semibold text-slate-600 mb-1 flex items-center gap-1"><ReceiptText className="h-4 w-4 text-slate-400" />Bill</p>
          <Row k="Subtotal" v={inr(order.subtotal ?? 0)} />
          {order.discountAmount > 0 && <Row k="Discount" v={`- ${inr(order.discountAmount)}`} />}
          {order.taxAmount > 0 && <Row k="Tax (GST)" v={inr(order.taxAmount)} />}
          {order.deliveryFee > 0 && <Row k="Delivery" v={inr(order.deliveryFee)} />}
          <div className="flex justify-between pt-1 border-t border-slate-100 font-bold text-slate-800"><span>Total</span><span>{inr(order.totalAmount)}</span></div>
          <div className="flex justify-between text-[12px] text-slate-400"><span>Payment</span><span>{order.paymentStatus || order.payment?.status || "—"} · {order.paymentMethod || order.payment?.method || "—"}</span></div>
        </div>
        {order.deliveryAddress && <div className="bg-white rounded-xl border border-slate-200 p-3 text-[12px] text-slate-600"><p className="font-semibold text-slate-500 mb-1 flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-400" />Delivery Address</p>{typeof order.deliveryAddress === "string" ? order.deliveryAddress : [order.deliveryAddress?.addressLine1, order.deliveryAddress?.city].filter(Boolean).join(", ")}</div>}
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
      {/* Lifecycle action bar — only offers server-valid transitions */}
      {(next.length > 0 || canCancel) && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-3 flex gap-2 z-20">
          {canCancel && <button onClick={() => setStatus("CANCELLED")} disabled={busy} className="h-12 px-4 rounded-xl border border-rose-200 text-rose-600 text-[13px] font-semibold disabled:opacity-50">Cancel</button>}
          {next.map((s) => (
            <button key={s} onClick={() => setStatus(s)} disabled={busy} className="flex-1 h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: tenant.primaryColor }}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : `Mark ${STATUS_LABEL[s] || s}`}</button>
          ))}
        </div>
      )}
    </div>
  )
}
function Row({ k, v }: { k: string; v: string }) { return <div className="flex justify-between text-slate-500"><span>{k}</span><span className="text-slate-700">{v}</span></div> }

// ── Create Order ────────────────────────────────────────────────────────────────
function CreateSheet({ tenant, user, api, onClose, onCreated }: { tenant: Tenant; user: SessionUser; api: Api; onClose: () => void; onCreated: () => void }) {
  // orderType MUST be a valid OrderType enum value (PICKUP | DELIVERY | …) — NOT a
  // display string; the order engine + state machine key off it.
  const [orderType, setOrderType] = useState<"PICKUP" | "DELIVERY">("PICKUP")
  const [q, setQ] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [products, setProducts] = useState<any[]>([])
  const [lines, setLines] = useState<{ itemId: string; variantId?: string; itemName: string; unitPrice: number; quantity: number }[]>([])
  // Customer — reuse the SAME Desktop customer master API (search + create).
  const [custQ, setCustQ] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [custMatches, setCustMatches] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customer, setCustomer] = useState<any>(null)
  const [newCust, setNewCust] = useState({ name: "", phone: "" }); const [creatingCust, setCreatingCust] = useState(false)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  const biz = user.businessId
  useEffect(() => {
    const t = setTimeout(() => api(`/api/core/businesses/${biz}/products?search=${encodeURIComponent(q.trim())}&limit=20`).then((j) => setProducts(j.success ? (j.data || []) : [])), 300)
    return () => clearTimeout(t)
  }, [q, api, biz])
  useEffect(() => {
    if (customer || custQ.trim().length < 2) { setCustMatches([]); return }
    const t = setTimeout(() => api(`/api/core/businesses/${biz}/customers?search=${encodeURIComponent(custQ.trim())}&limit=8`).then((j) => setCustMatches(j.success ? (j.data || []) : [])), 300)
    return () => clearTimeout(t)
  }, [custQ, customer, api, biz])
  const createCustomer = async () => {
    if (!newCust.name.trim() || !newCust.phone.trim()) return
    setCreatingCust(true)
    try {
      const j = await api(`/api/core/businesses/${biz}/customers`, { method: "POST", body: JSON.stringify({ name: newCust.name.trim(), phone: newCust.phone.trim() }) })
      if (j.success && j.data) setCustomer(j.data); else setErr(j.error || "Could not create customer")
    } finally { setCreatingCust(false) }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addProduct = (p: any) => {
    const v = (p.variants || []).find((x: { isDefault?: boolean }) => x.isDefault) || (p.variants || [])[0]
    const price = v?.price ?? p.price ?? 0
    // itemId MUST be the PRODUCT id — the order engine keys inventory + the product
    // master on it (deduct on CONFIRMED WHERE productId = item.itemId). Variant is
    // tracked separately for pricing.
    setLines((prev) => { const ex = prev.find((l) => l.itemId === p.id && l.variantId === v?.id); if (ex) return prev.map((l) => l === ex ? { ...l, quantity: l.quantity + 1 } : l); return [...prev, { itemId: p.id, variantId: v?.id, itemName: p.name, unitPrice: price, quantity: 1 }] })
  }
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0), [lines])
  const submit = async () => {
    setErr(null)
    if (!customer) { setErr("Select or create a customer"); return }
    if (lines.length === 0) { setErr("Add at least one product"); return }
    setBusy(true)
    try {
      const j = await api("/api/core/orders", { method: "POST", body: JSON.stringify({
        businessId: biz, storeId: user.storeId, orderType, orderSource: "admin",
        customerId: customer.id, customerName: customer.name, customerPhone: customer.phone || undefined,
        items: lines.map((l) => ({ itemType: "PRODUCT", itemId: l.itemId, variantId: l.variantId, itemName: l.itemName, quantity: l.quantity, unitPrice: l.unitPrice })),
      }) })
      if (!j.success) throw new Error(j.error || "Could not create order")
      onCreated()
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col">
      <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0"><h3 className="font-semibold text-slate-800">New Order</h3><button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button></header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 rounded-xl p-1">{(["PICKUP", "DELIVERY"] as const).map((t) => (<button key={t} onClick={() => setOrderType(t)} className={`h-9 rounded-lg text-[13px] font-medium ${orderType === t ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>{t === "PICKUP" ? "Store Pickup" : "Home Delivery"}</button>))}</div>
        {/* Customer — SAME customer master as Desktop (/api/core/businesses/[id]/customers): search + create */}
        <section className="space-y-2">
          {customer ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
              <div><p className="font-medium text-[14px] text-slate-800">{customer.name}</p><p className="text-[12px] text-slate-500">{customer.phone || customer.email || ""}</p></div>
              <button onClick={() => { setCustomer(null); setCustQ("") }} className="text-[12px] font-medium text-slate-500">Change</button>
            </div>
          ) : (
            <>
              <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={custQ} onChange={(e) => setCustQ(e.target.value)} placeholder="Search customer by name, mobile or email" className="w-full h-11 pl-9 rounded-xl border border-slate-200 text-[15px]" /></div>
              {custMatches.length > 0 && <div className="space-y-1">{custMatches.slice(0, 6).map((c) => (
                <button key={c.id} onClick={() => { setCustomer(c); setCustMatches([]) }} className="w-full text-left bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px]"><span className="font-medium text-slate-800">{c.name}</span>{(c.phone || c.email) && <span className="text-slate-500"> · {c.phone || c.email}</span>}</button>
              ))}</div>}
              {custQ.trim().length >= 2 && custMatches.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-2.5 space-y-2">
                  <p className="text-[11px] text-slate-400">No match — add new customer</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newCust.name} onChange={(e) => setNewCust((c) => ({ ...c, name: e.target.value }))} placeholder="Name" className="h-10 rounded-lg border border-slate-200 px-3 text-[14px]" />
                    <input value={newCust.phone} onChange={(e) => setNewCust((c) => ({ ...c, phone: e.target.value }))} inputMode="tel" placeholder="Mobile" className="h-10 rounded-lg border border-slate-200 px-3 text-[14px]" />
                  </div>
                  <button onClick={createCustomer} disabled={creatingCust || !newCust.name.trim() || !newCust.phone.trim()} className="w-full h-10 rounded-lg bg-slate-800 text-white text-[13px] font-medium disabled:opacity-50">{creatingCust ? "Creating…" : "Create customer"}</button>
                </div>
              )}
            </>
          )}
        </section>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="w-full h-11 pl-9 rounded-xl border border-slate-200 text-[15px]" /></div>
        <div className="space-y-1">{products.slice(0, 8).map((p) => { const v = (p.variants || [])[0]; const price = v?.price ?? p.price ?? 0; return (<button key={p.id} onClick={() => addProduct(p)} className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px]"><span className="text-slate-800">{p.name}</span><span className="text-slate-500">{inr(price)} +</span></button>) })}</div>
        {lines.length > 0 && <div className="bg-slate-50 rounded-xl p-2 space-y-1">{lines.map((l, i) => (<div key={i} className="flex items-center justify-between text-[13px] px-1"><span>{l.quantity} × {l.itemName}</span><div className="flex items-center gap-2"><span className="text-slate-500">{inr(l.unitPrice * l.quantity)}</span><button onClick={() => setLines((p) => p.filter((_, j) => j !== i))}><X className="h-4 w-4 text-slate-400" /></button></div></div>))}<div className="flex justify-between px-1 pt-1 border-t border-slate-200 text-[13px] font-semibold"><span>Subtotal</span><span>{inr(subtotal)}</span></div></div>}
        <p className="text-[10px] text-slate-400">Final pricing (tax, discounts, charges) is computed by the same Commerce pricing engine on save.</p>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
      <div className="p-3 border-t border-slate-200 shrink-0"><button onClick={submit} disabled={busy || lines.length === 0 || !customer} className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: tenant.primaryColor }}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Order"}</button></div>
    </div>
  )
}

// ── Reference modules (read views over the SAME /api/core/* masters) ────────────
function ModuleScreen({ screen, tenant, user, api, onBack, onOpenOrder }: { screen: Screen; tenant: Tenant; user: SessionUser; api: Api; onBack: () => void; onOpenOrder: (id: string) => void }) {
  const titles: Record<Screen, string> = { products: "Products", categories: "Categories", customers: "Customers", inventory: "Inventory", payments: "Payments", invoices: "Invoices", reports: "Reports" }
  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-white border-b border-slate-200 px-3 py-3 flex items-center gap-2 sticky top-0 z-20">
        <button onClick={onBack} className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center"><ChevronLeft className="h-5 w-5" /></button>
        <p className="font-bold text-[15px] text-slate-800">{titles[screen]}</p>
      </header>
      <div className="p-3">
        {screen === "products" && <ProductsModule tenant={tenant} user={user} api={api} />}
        {screen === "categories" && <CategoriesModule tenant={tenant} user={user} api={api} />}
        {screen === "customers" && <CustomersModule tenant={tenant} user={user} api={api} />}
        {screen === "inventory" && <InventoryModule tenant={tenant} user={user} api={api} />}
        {screen === "payments" && <PaymentsModule tenant={tenant} user={user} api={api} onOpenOrder={onOpenOrder} />}
        {screen === "invoices" && <InvoicesModule tenant={tenant} user={user} api={api} onOpenOrder={onOpenOrder} />}
        {screen === "reports" && <ReportsModule tenant={tenant} user={user} api={api} />}
      </div>
    </div>
  )
}

function useList(api: Api, path: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]); const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null); const [nonce, setNonce] = useState(0)
  useEffect(() => {
    let live = true; setLoading(true); setError(null)
    api(path)
      .then((j) => { if (!live) return; if (j?.success) setData(j.data || []); else setError(j?.error || "Couldn't load — please retry.") })
      .catch(() => { if (live) setError("Network error — please retry.") })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [api, path, nonce])
  return { data, loading, error, reload: () => setNonce((n) => n + 1) }
}
function Spin({ color }: { color: string }) { return <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin inline" style={{ color }} /></div> }
function Empty({ label }: { label: string }) { return <p className="py-16 text-center text-sm text-slate-400">{label}</p> }
// Never render a load failure as a silent empty state — surface it with a retry.
function ErrorState({ msg, onRetry, color }: { msg: string; onRetry: () => void; color: string }) {
  return <div className="py-16 text-center space-y-3"><div className="flex justify-center"><AlertTriangle className="h-6 w-6 text-rose-400" /></div><p className="text-[13px] text-rose-600 px-8">{msg}</p><button onClick={onRetry} className="h-9 px-4 rounded-lg text-white text-[13px] font-medium" style={{ backgroundColor: color }}>Retry</button></div>
}

function ProductsModule({ tenant, user, api }: { tenant: Tenant; user: SessionUser; api: Api }) {
  const [q, setQ] = useState("")
  const { data, loading, error, reload } = useList(api, `/api/core/businesses/${user.businessId}/products?search=${encodeURIComponent(q)}&limit=100`)
  return (
    <div className="space-y-3">
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="w-full h-11 pl-9 rounded-xl border border-slate-200 bg-white text-[15px]" /></div>
      {error ? <ErrorState msg={error} onRetry={reload} color={tenant.primaryColor} /> : loading ? <Spin color={tenant.primaryColor} /> : data.length === 0 ? <Empty label="No products." /> : <div className="space-y-2">{data.map((p) => { const v = (p.variants || []).find((x: { isDefault?: boolean }) => x.isDefault) || (p.variants || [])[0]; const price = v?.price ?? p.price ?? 0; return (
        <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
          <div className="min-w-0"><p className="text-[14px] font-medium text-slate-800 truncate">{p.name}</p><p className="text-[11px] text-slate-400">{p.category?.name || "Uncategorized"} · {p.sku || p.status}{(p.variants?.length ?? 0) > 1 ? ` · ${p.variants.length} variants` : ""}</p></div>
          <div className="text-right shrink-0 ml-2"><p className="text-[14px] font-bold text-slate-800">{inr(price)}</p><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{p.status}</span></div>
        </div>
      )})}</div>}
      <p className="text-[10px] text-slate-400 px-1">Same Product master as Desktop & Website. Add / edit products in Desktop Admin.</p>
    </div>
  )
}

function CategoriesModule({ tenant, user, api }: { tenant: Tenant; user: SessionUser; api: Api }) {
  const { data, loading, error, reload } = useList(api, `/api/core/businesses/${user.businessId}/categories`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const render = (c: any, depth: number) => (
    <div key={c.id}>
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between" style={{ marginLeft: depth * 14 }}>
        <div className="flex items-center gap-2 min-w-0"><FolderTree className="h-4 w-4 text-slate-400 shrink-0" /><span className="text-[14px] font-medium text-slate-800 truncate">{c.name}</span></div>
        <span className="text-[11px] text-slate-400 shrink-0">{c._count?.products ?? 0} products</span>
      </div>
      {Array.isArray(c.children) && c.children.length > 0 && <div className="mt-2 space-y-2">{c.children.map((ch: unknown) => render(ch, depth + 1))}</div>}
    </div>
  )
  return error ? <ErrorState msg={error} onRetry={reload} color={tenant.primaryColor} /> : loading ? <Spin color={tenant.primaryColor} /> : data.length === 0 ? <Empty label="No categories." /> : (
    <div className="space-y-2">{data.map((c) => render(c, 0))}<p className="text-[10px] text-slate-400 px-1 pt-1">Same Category tree as Website, POS & Desktop.</p></div>
  )
}

function CustomersModule({ tenant, user, api }: { tenant: Tenant; user: SessionUser; api: Api }) {
  const [q, setQ] = useState("")
  const { data, loading, error, reload } = useList(api, `/api/core/businesses/${user.businessId}/customers?search=${encodeURIComponent(q)}&limit=100`)
  return (
    <div className="space-y-3">
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, mobile or email" className="w-full h-11 pl-9 rounded-xl border border-slate-200 bg-white text-[15px]" /></div>
      {error ? <ErrorState msg={error} onRetry={reload} color={tenant.primaryColor} /> : loading ? <Spin color={tenant.primaryColor} /> : data.length === 0 ? <Empty label="No customers." /> : <div className="space-y-2">{data.map((c) => (
        <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
          <div className="min-w-0"><p className="text-[14px] font-medium text-slate-800 truncate">{c.name}</p><p className="text-[11px] text-slate-400">{c.phone || c.email || "—"} · {c._count?.orders ?? 0} orders</p></div>
          {c.phone && <a href={`tel:${c.phone}`} className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0"><Phone className="h-4 w-4 text-slate-500" /></a>}
        </div>
      ))}</div>}
      <p className="text-[10px] text-slate-400 px-1">Same Customer master used across Website, Desktop, POS & Store Admin.</p>
    </div>
  )
}

function InventoryModule({ tenant, user, api }: { tenant: Tenant; user: SessionUser; api: Api }) {
  const scope = user.storeId ? `&storeId=${user.storeId}` : ""
  const { data, loading, error, reload } = useList(api, `/api/core/businesses/${user.businessId}/inventory?limit=200${scope}`)
  const low = data.filter((i) => i.status === "LOW_STOCK" || i.status === "OUT_OF_STOCK")
  return error ? <ErrorState msg={error} onRetry={reload} color={tenant.primaryColor} /> : loading ? <Spin color={tenant.primaryColor} /> : data.length === 0 ? <Empty label="No inventory records." /> : (
    <div className="space-y-3">
      {low.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-[12px] text-amber-700"><AlertTriangle className="h-4 w-4" />{low.length} item{low.length > 1 ? "s" : ""} low or out of stock</div>}
      <div className="space-y-2">{data.map((i) => (
        <div key={i.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
          <div className="min-w-0"><p className="text-[14px] font-medium text-slate-800 truncate">{i.product?.name || "—"}{i.variant?.name ? ` · ${i.variant.name}` : ""}</p><p className="text-[11px] text-slate-400">{i.product?.sku || ""}{i.store?.name ? ` · ${i.store.name}` : ""}</p></div>
          <div className="text-right shrink-0 ml-2"><p className="text-[15px] font-bold tabular-nums text-slate-800">{i.quantity}</p><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${i.status === "IN_STOCK" ? "bg-emerald-50 text-emerald-600" : i.status === "LOW_STOCK" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"}`}>{(i.status || "").replace(/_/g, " ")}</span></div>
        </div>
      ))}</div>
      <p className="text-[10px] text-slate-400 px-1">Live stock from the Commerce Inventory engine (store-scoped). Deducted automatically on order confirmation.</p>
    </div>
  )
}

function PaymentsModule({ tenant, user, api, onOpenOrder }: { tenant: Tenant; user: SessionUser; api: Api; onOpenOrder: (id: string) => void }) {
  const { data, loading, error, reload } = useList(api, `/api/core/payments?businessId=${user.businessId}&limit=100`)
  return error ? <ErrorState msg={error} onRetry={reload} color={tenant.primaryColor} /> : loading ? <Spin color={tenant.primaryColor} /> : data.length === 0 ? <Empty label="No payments." /> : (
    <div className="space-y-2">{data.map((p) => (
      <button key={p.id} onClick={() => p.order?.id && onOpenOrder(p.order.id)} className="w-full text-left bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
        <div className="min-w-0"><p className="text-[13px] font-medium text-slate-800">{p.order?.orderNumber || p.method}</p><p className="text-[11px] text-slate-400">{p.method} · {new Date(p.createdAt).toLocaleDateString("en-IN")}</p></div>
        <div className="text-right shrink-0 ml-2"><p className="text-[14px] font-bold text-slate-800">{inr(p.amount)}</p><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.status === "COMPLETED" || p.status === "PAID" ? "bg-emerald-50 text-emerald-600" : p.status === "PENDING" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>{p.status}</span></div>
      </button>
    ))}</div>
  )
}

function InvoicesModule({ tenant, user, api, onOpenOrder }: { tenant: Tenant; user: SessionUser; api: Api; onOpenOrder: (id: string) => void }) {
  const [q, setQ] = useState("")
  const { data, loading, error, reload } = useList(api, `/api/core/businesses/${user.businessId}/invoices?search=${encodeURIComponent(q)}&limit=100`)
  return (
    <div className="space-y-3">
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Invoice # or customer" className="w-full h-11 pl-9 rounded-xl border border-slate-200 bg-white text-[15px]" /></div>
      {error ? <ErrorState msg={error} onRetry={reload} color={tenant.primaryColor} /> : loading ? <Spin color={tenant.primaryColor} /> : data.length === 0 ? <Empty label="No invoices." /> : <div className="space-y-2">{data.map((v) => (
        <button key={v.id} onClick={() => v.order?.id && onOpenOrder(v.order.id)} className="w-full text-left bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
          <div className="min-w-0"><p className="text-[13px] font-mono font-semibold text-slate-800">{v.invoiceNumber}</p><p className="text-[11px] text-slate-400">{v.customer?.name || "—"} · {v.order?.orderNumber || ""}</p></div>
          <div className="text-right shrink-0 ml-2"><p className="text-[14px] font-bold text-slate-800">{inr(v.totalAmount)}</p><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${v.status === "PAID" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{v.status}</span></div>
        </button>
      ))}</div>}
      <p className="text-[10px] text-slate-400 px-1">Same Invoice engine as Desktop (GST + tax breakup persisted server-side).</p>
    </div>
  )
}

function ReportsModule({ tenant, user, api }: { tenant: Tenant; user: SessionUser; api: Api }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rep, setRep] = useState<any>(null); const [loading, setLoading] = useState(true)
  const scope = user.storeId ? `&storeId=${user.storeId}` : ""
  useEffect(() => { setLoading(true); api(`/api/core/businesses/${user.businessId}/reports/sales?from=${encodeURIComponent(daysAgo(30))}${scope}`).then((j) => setRep(j?.success ? j.data : null)).finally(() => setLoading(false)) }, [api, user.businessId, scope])
  if (loading) return <Spin color={tenant.primaryColor} />
  if (!rep) return <Empty label="No report data." />
  const s = rep.summary || {}
  const cards = [
    { label: "Revenue", value: inr(s.totalRevenue) }, { label: "Orders", value: String(s.orderCount ?? 0) },
    { label: "Avg Order", value: inr(s.aov) }, { label: "Tax", value: inr(s.totalTax) },
    { label: "Discounts", value: inr(s.totalDiscount) }, { label: "Delivery", value: inr(s.totalDelivery) },
  ]
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-slate-400 px-1">Last 30 days{user.storeId ? " · this store" : ""}</p>
      <div className="grid grid-cols-2 gap-2">{cards.map((c) => (<div key={c.label} className="bg-white rounded-xl border border-slate-200 p-3"><p className="text-[11px] text-slate-400">{c.label}</p><p className="text-[17px] font-bold text-slate-800">{c.value}</p></div>))}</div>
      {Array.isArray(rep.topProducts) && rep.topProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-3"><p className="text-[13px] font-semibold text-slate-700 mb-2">Top products</p>
          <div className="space-y-1.5">{rep.topProducts.slice(0, 8).map((p: { name?: string; itemName?: string; quantity?: number; qty?: number; revenue?: number }, i: number) => (
            <div key={i} className="flex items-center justify-between text-[12px]"><span className="text-slate-700 truncate">{p.name || p.itemName}</span><span className="text-slate-500 shrink-0 ml-2">{p.quantity ?? p.qty ?? 0} · {inr(p.revenue ?? 0)}</span></div>
          ))}</div>
        </div>
      )}
      {rep.paymentBreakdown && Object.keys(rep.paymentBreakdown).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-3"><p className="text-[13px] font-semibold text-slate-700 mb-2">Payments</p>
          <div className="space-y-1.5">{Object.entries(rep.paymentBreakdown as Record<string, number>).map(([k, v]) => (<div key={k} className="flex items-center justify-between text-[12px]"><span className="text-slate-600">{k}</span><span className="text-slate-700 font-medium">{typeof v === "number" && v > 1000 ? inr(v) : v}</span></div>))}</div>
        </div>
      )}
      <p className="text-[10px] text-slate-400 px-1">Same Reports engine as Desktop — store-scoped for this account.</p>
    </div>
  )
}

// ── Profile ─────────────────────────────────────────────────────────────────────
function Profile({ tenant, user, online, onLogout }: { tenant: Tenant; user: SessionUser; online: boolean; onLogout: () => void }) {
  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-[13px]">
        <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="font-medium text-slate-700">{user.name}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Role</span><span className="font-medium text-slate-700">{user.role}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Business</span><span className="font-medium text-slate-700">{user.businessName || tenant.name}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Store</span><span className="font-medium text-slate-700">{user.storeId ? user.storeId.slice(-6) : "All stores"}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Connection</span><span className={`font-medium ${online ? "text-emerald-600" : "text-amber-600"}`}>{online ? "Online" : "Offline"}</span></div>
      </div>
      <button onClick={onLogout} className="w-full h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-semibold flex items-center justify-center gap-2"><LogOut className="h-5 w-5" /> Sign Out</button>
    </div>
  )
}
