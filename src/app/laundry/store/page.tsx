"use client"

// ── Store Admin PWA (Phase 2: mobile execution layer over Laundry OS) ──────────
// A phone-first app for store staff. It owns NO business logic — every screen
// calls the SAME existing Laundry OS endpoints with the store-admin bearer token
// (resolved by getLaundryAuthContext → the staff user's RBAC role) and scopes
// reads to the signed-in store. Workflow transitions reuse the shared state
// machine (laundry-workflow) and the existing dedicated endpoints.

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Store, LogOut, Loader2, ClipboardList, Truck, PackageCheck, ClipboardCheck, Wallet, Boxes,
  CheckCircle2, PlusCircle, Search, ScanLine, LayoutGrid, ChevronLeft, User, Phone, RefreshCw, X, MapPin, Lock,
} from "lucide-react"
import { getTransitions, statusLabel } from "@/lib/laundry-workflow"
import { BagScanButton } from "@/components/laundry/bag-scanner"
import { PwaInstallButton } from "@/components/laundry/pwa-install-button"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { NO_EXECUTIVES_FOR_STORE } from "@/lib/laundry-eligible-executives"

const TOKEN_KEY = "qx_store_token"

interface Staff { name: string | null; businessId: string; businessName?: string | null; businessLogo?: string | null; roleName: string; storeId: string; storeName: string | null; storeCode: string | null; isSuperAdmin?: boolean }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SuperAdmin { name: string; businesses: { businessId: string; businessName: string; stores: { id: string; storeName: string; storeCode: string | null }[] }[] }

function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false)
    setOnline(navigator.onLine)
    window.addEventListener("online", on); window.addEventListener("offline", off)
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off) }
  }, [])
  return online
}
interface Counts { todaysOrders: number; todaysPickup: number; todaysDelivery: number; pendingReceipt: number; pendingAudit: number; pendingPayment: number; readyProcessing: number; readyDelivery: number; completedToday: number }
type Tab = "dashboard" | "orders" | "dispatch" | "scan" | "profile"

// Internal (side-effect) workflow actions → their dedicated endpoint. Non-internal
// actions go through /transition. Mirrors the LOCKED state machine, never changes it.
const ACTION_ENDPOINT: Record<string, string> = {
  PACK_ORDER: "pack", DISPATCH_TO_PROCESSING: "dispatch", RECEIVE_AT_PROCESSING: "receive",
  DISPATCH_TO_STORE: "return-dispatch", RECEIVE_AT_STORE: "store-receive", MARK_DELIVERED: "deliver",
}
const inr = (n: number) => `₹${(n || 0).toFixed(0)}`
const fmtDay = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "")

export default function StoreAdminApp() {
  const [token, setToken] = useState<string | null>(null)
  const [staff, setStaff] = useState<Staff | null>(null)
  const [sa, setSa] = useState<SuperAdmin | null>(null) // Super Admin awaiting a store pick
  const [booting, setBooting] = useState(true)
  const [tab, setTab] = useState<Tab>("dashboard")
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)
  const [ordersStatus, setOrdersStatus] = useState<string>("") // filter carried from a dashboard tap
  const [showCreate, setShowCreate] = useState(false)

  // login form
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("")
  const [loggingIn, setLoggingIn] = useState(false); const [error, setError] = useState<string | null>(null)

  const api = useCallback(async (path: string, init: RequestInit = {}, tk?: string) => {
    const res = await fetch(path, { ...init, headers: { ...(init.headers || {}), "Content-Type": "application/json", Authorization: `Bearer ${tk ?? token}` } })
    return res.json().catch(() => ({}))
  }, [token])

  // Resolve the session via /me (routes Super Admins to the store picker).
  const loadSession = useCallback(async (tk: string) => {
    const j = await api("/api/laundry/store-admin/me", {}, tk)
    if (!j.success) { localStorage.removeItem(TOKEN_KEY); return false }
    setToken(tk)
    if (j.data.isSuperAdmin) { setSa({ name: j.data.name, businesses: j.data.businesses || [] }); setStaff(null) }
    else { setSa(null); setStaff(j.data) }
    return true
  }, [api])

  useEffect(() => {
    const tk = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null
    if (!tk) { setBooting(false); return }
    loadSession(tk).catch(() => {}).finally(() => setBooting(false))
  }, [loadSession])

  const login = async () => {
    setError(null); setLoggingIn(true)
    try {
      const res = await fetch("/api/laundry/store-admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Login failed")
      localStorage.setItem(TOKEN_KEY, j.data.token); setPassword("")
      await loadSession(j.data.token)
    } catch (e) { setError(e instanceof Error ? e.message : "Login failed") } finally { setLoggingIn(false) }
  }
  // Super Admin picks a business + store to operate as.
  const pickStore = (b: SuperAdmin["businesses"][number], st: { id: string; storeName: string; storeCode: string | null }) =>
    setStaff({ name: sa?.name ?? "Super Admin", isSuperAdmin: true, roleName: "Super Admin", businessId: b.businessId, businessName: b.businessName, businessLogo: null, storeId: st.id, storeName: st.storeName, storeCode: st.storeCode })
  const logout = async () => {
    try { await api("/api/laundry/store-admin/auth/logout", { method: "POST" }) } catch { /* noop */ }
    localStorage.removeItem(TOKEN_KEY); setToken(null); setStaff(null); setSa(null)
  }
  const goOrders = (status: string) => { setOrdersStatus(status); setTab("orders") }

  if (booting) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>

  // Super Admin: pick a business + store to operate as (unrestricted).
  if (token && !staff && sa) return <StorePicker sa={sa} onPick={pickStore} onLogout={logout} />

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
            <input type="email" inputMode="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 rounded-xl border border-slate-200 px-4 text-[15px] bg-white" />
            <input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} className="w-full h-12 rounded-xl border border-slate-200 px-4 text-[15px] bg-white" />
            {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={login} disabled={loggingIn || !email || !password} className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{loggingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}</button>
            <PwaInstallButton />
            <p className="text-[11px] text-slate-400 text-center pt-2">Store staff only. Accounts are created by your admin.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {openOrderId ? (
        <OrderDetail id={openOrderId} staff={staff} api={api} onBack={() => setOpenOrderId(null)} />
      ) : (
        <>
          {tab === "dashboard" && <Dashboard staff={staff} api={api} onCounter={goOrders} onTab={setTab} />}
          {tab === "orders" && <Orders staff={staff} api={api} status={ordersStatus} setStatus={setOrdersStatus} onOpen={setOpenOrderId} />}
          {tab === "dispatch" && <Dispatch staff={staff} api={api} onOpen={setOpenOrderId} />}
          {tab === "scan" && <ScanScreen staff={staff} api={api} onOpen={setOpenOrderId} />}
          {tab === "profile" && <Profile staff={staff} onLogout={logout} onSwitch={staff.isSuperAdmin ? () => { setStaff(null); setTab("dashboard") } : undefined} />}
        </>
      )}

      {showCreate && <CreateSheet staff={staff} api={api} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setTab("orders"); setOrdersStatus("") }} />}

      {/* Bottom navigation */}
      {!openOrderId && (
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 grid grid-cols-5 z-30">
          {([["dashboard", "Home", LayoutGrid], ["orders", "Orders", ClipboardList], ["dispatch", "Dispatch", Truck], ["scan", "Scan", ScanLine], ["profile", "Profile", User]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex flex-col items-center gap-0.5 py-2 ${tab === k ? "text-blue-600" : "text-slate-400"}`}>
              <Icon className="h-5 w-5" /><span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </nav>
      )}
      {/* New order FAB */}
      {!openOrderId && (tab === "dashboard" || tab === "orders") && (
        <button onClick={() => setShowCreate(true)} className="fixed bottom-20 right-4 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center z-30"><PlusCircle className="h-7 w-7" /></button>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = (path: string, init?: RequestInit, tk?: string) => Promise<any>

function Field({ label, value, tone }: { label: string; value: string; tone?: "rose" | "emerald" }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className={`font-medium ${tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-700"}`}>{value}</p>
    </div>
  )
}

function Header({ staff }: { staff: Staff }) {
  const online = useOnline()
  const today = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })
  return (
    <header className="bg-blue-600 text-white px-4 pt-5 pb-6 rounded-b-2xl">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden">
            {staff.businessLogo
              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={staff.businessLogo} alt="" className="h-full w-full object-contain" />
              : <Store className="h-5 w-5 text-blue-600" />}
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold truncate leading-tight">{staff.businessName || "Laundry"}</p>
            <p className="text-[12px] text-blue-100 truncate">{staff.storeName || "Your Store"}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${online ? "bg-emerald-400/20 text-emerald-50" : "bg-amber-400/20 text-amber-50"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-300" : "bg-amber-300"}`} />{online ? "Online" : "Offline"}
          </span>
          <p className="text-[10px] text-blue-100 mt-1">{today}</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-blue-100">
        <User className="h-3 w-3" />{staff.name} · <span className="text-white font-medium">{staff.roleName}</span>
      </div>
    </header>
  )
}

function Dashboard({ staff, api, onCounter, onTab }: { staff: Staff; api: Api; onCounter: (s: string) => void; onTab: (t: Tab) => void }) {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback((silent = false) => { if (!silent) setLoading(true); api(`/api/laundry/store-admin/dashboard?businessId=${staff.businessId}&storeId=${staff.storeId}`).then((j) => { if (j.success) setCounts(j.data) }).finally(() => { if (!silent) setLoading(false) }) }, [api, staff.businessId, staff.storeId])
  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true), { intervalMs: 12000 })

  const tiles: { key: keyof Counts; label: string; icon: React.ComponentType<{ className?: string }>; color: string; go: () => void }[] = [
    { key: "todaysOrders", label: "Today's Orders", icon: ClipboardList, color: "text-slate-700 bg-slate-50 border-slate-200", go: () => onCounter("") },
    { key: "todaysPickup", label: "Today's Pickup", icon: Truck, color: "text-amber-700 bg-amber-50 border-amber-200", go: () => onTab("dispatch") },
    { key: "todaysDelivery", label: "Today's Delivery", icon: PackageCheck, color: "text-violet-700 bg-violet-50 border-violet-200", go: () => onTab("dispatch") },
    { key: "pendingReceipt", label: "Pending Store Receipt", icon: ScanLine, color: "text-orange-700 bg-orange-50 border-orange-200", go: () => onCounter("IN_TRANSIT_TO_STORE") },
    { key: "pendingAudit", label: "Pending Audit", icon: ClipboardCheck, color: "text-blue-700 bg-blue-50 border-blue-200", go: () => onCounter("PENDING_STORE_AUDIT") },
    { key: "pendingPayment", label: "Pending Payment", icon: Wallet, color: "text-rose-700 bg-rose-50 border-rose-200", go: () => onCounter("PAYMENT_PENDING") },
    { key: "readyProcessing", label: "Ready for Processing", icon: Boxes, color: "text-indigo-700 bg-indigo-50 border-indigo-200", go: () => onCounter("READY_FOR_PROCESSING") },
    { key: "readyDelivery", label: "Ready for Delivery", icon: PackageCheck, color: "text-emerald-700 bg-emerald-50 border-emerald-200", go: () => onCounter("READY_FOR_DELIVERY") },
    { key: "completedToday", label: "Completed Today", icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50 border-emerald-200", go: () => onCounter("DELIVERED") },
  ]
  return (
    <>
      <Header staff={staff} />
      <main className="px-4 -mt-3 space-y-4">
        {/* Pending Actions — what needs attention right now */}
        {counts && (() => {
          const items = [
            counts.pendingAudit > 0 && { n: counts.pendingAudit, label: "awaiting audit", color: "text-blue-700 bg-blue-50 border-blue-200", go: () => onCounter("PENDING_STORE_AUDIT") },
            counts.pendingPayment > 0 && { n: counts.pendingPayment, label: "payments pending", color: "text-rose-700 bg-rose-50 border-rose-200", go: () => onCounter("PAYMENT_PENDING") },
            counts.readyDelivery > 0 && { n: counts.readyDelivery, label: "ready to deliver", color: "text-emerald-700 bg-emerald-50 border-emerald-200", go: () => onCounter("READY_FOR_DELIVERY") },
          ].filter(Boolean) as { n: number; label: string; color: string; go: () => void }[]
          if (items.length === 0) return null
          return (
            <section>
              <h2 className="text-[13px] font-semibold text-slate-700 px-1 mb-2">Needs attention</h2>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {items.map((it, i) => (
                  <button key={i} onClick={it.go} className={`shrink-0 rounded-xl border ${it.color} px-3 py-2 text-left active:scale-[0.98] transition-transform`}>
                    <span className="text-lg font-bold tabular-nums">{it.n}</span>
                    <span className="text-[11px] ml-1.5 font-medium">{it.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )
        })()}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-[13px] font-semibold text-slate-700">Today at a glance</h2>
            <button onClick={() => load()} className="text-slate-400"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tiles.map((t) => { const Icon = t.icon; return (
              <button key={t.key} onClick={t.go} className={`rounded-xl border ${t.color} p-3 text-left active:scale-[0.98] transition-transform`}>
                <div className="flex items-center justify-between"><Icon className="h-4 w-4 opacity-70" /><span className="text-xl font-bold tabular-nums">{counts ? counts[t.key] : "—"}</span></div>
                <p className="text-[11px] mt-1 font-medium leading-tight">{t.label}</p>
              </button>
            )})}
          </div>
        </section>
      </main>
    </>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Orders({ staff, api, status, setStatus, onOpen }: { staff: Staff; api: Api; status: string; setStatus: (s: string) => void; onOpen: (id: string) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    const p = new URLSearchParams({ businessId: staff.businessId, storeId: staff.storeId, limit: "50" })
    if (status) p.set("status", status)
    if (q.trim()) p.set("search", q.trim())
    api(`/api/laundry/orders?${p}`).then((j) => { if (j.success) setOrders(j.data) }).finally(() => { if (!silent) setLoading(false) })
  }, [api, staff, status, q])
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [load, q])
  useAutoRefresh(() => load(true), { intervalMs: 12000 })

  const chips = [["", "All"], ["PENDING_STORE_AUDIT", "Audit"], ["PAYMENT_PENDING", "Payment"], ["READY_FOR_PROCESSING", "Packing"], ["PROCESSING", "Processing"], ["READY_FOR_DELIVERY", "Delivery"], ["DELIVERED", "Done"]] as const
  return (
    <div className="px-3 pt-3 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order # / customer / mobile" className="w-full h-11 pl-9 rounded-xl border border-slate-200 bg-white text-[15px]" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {chips.map(([v, l]) => (
          <button key={v} onClick={() => setStatus(v)} className={`shrink-0 px-3 h-8 rounded-full text-[12px] font-medium border ${status === v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}>{l}</button>
        ))}
      </div>
      {loading ? <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-blue-600" /></div>
        : orders.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">No orders.</p>
        : <div className="space-y-2">{orders.map((o) => (
            <button key={o.id} onClick={() => onOpen(o.id)} className="w-full text-left bg-white rounded-xl border border-slate-200 p-3 active:scale-[0.99] transition-transform">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-[13px] text-slate-800">{o.orderNumber}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{statusLabel(o.status)}</span>
              </div>
              <div className="flex items-center justify-between mt-1 text-[12px] text-slate-500">
                <span className="truncate">{o.customer?.name || o.customerName || "—"}</span>
                <span className={o.balanceDue > 0 ? "text-rose-600 font-semibold" : "text-emerald-600"}>{o.balanceDue > 0 ? `${inr(o.balanceDue)} due` : "Paid"}</span>
              </div>
            </button>
          ))}</div>}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OrderDetail({ id, staff, api, onBack }: { id: string; staff: Staff; api: Api; onBack: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pay, setPay] = useState(false)
  const [audit, setAudit] = useState(false)
  const load = useCallback(() => { setLoading(true); api(`/api/laundry/orders/${id}`).then((j) => { if (j.success) setOrder(j.data) }).finally(() => setLoading(false)) }, [api, id])
  useEffect(() => { load() }, [load])

  // Chain of custody: internal transitions (executive pickup completion) and the
  // store receive are NEVER one-tap here — receive happens by scanning the bag.
  const primaryRaw = useMemo(() => order ? getTransitions(order.status).find((t) => t.primary) : null, [order])
  const awaitingScanReceive = !!order && (order.status === "IN_TRANSIT_TO_STORE" || (order.status === "AWAITING_PICKUP_ASSIGNMENT" && order.fieldStatus === "PICKUP_COMPLETED"))
  const primary = primaryRaw && !primaryRaw.internal && primaryRaw.action !== "RECEIVE_PICKUP_AT_STORE" ? primaryRaw : null
  const primaryLabel = primary?.action === "APPROVE_AUDIT" ? "Start Store Audit" : primary?.label

  const advance = async () => {
    if (!order || !primary) return
    if (primary.action === "COLLECT_PAYMENT") { setPay(true); return }
    // The audit is NEVER a one-tap approve — it opens the real garment audit
    // (edit garments, weight, photos) which approves via the same inspect API.
    if (primary.action === "APPROVE_AUDIT") { setAudit(true); return }
    setBusy(true)
    try {
      const ep = ACTION_ENDPOINT[primary.action]
      const j = ep
        ? await api(`/api/laundry/orders/${id}/${ep}`, { method: "POST", body: JSON.stringify({ businessId: staff.businessId, actorName: staff.name }) })
        : await api(`/api/laundry/orders/${id}/transition`, { method: "POST", body: JSON.stringify({ toStatus: primary.to, actorName: staff.name }) })
      if (!j.success && j.error) alert(j.error)
      load()
    } finally { setBusy(false) }
  }

  // Corrective edit: a garment was missed and the order is already at Payment.
  // Reopen it back into Store Audit, then jump straight into the audit editor to
  // add + inspect the garment and re-approve. Only offered at PAYMENT_PENDING.
  const reopenAudit = async () => {
    if (!order || busy) return
    if (!confirm("Reopen this order for editing? It goes back to Store Audit so you can add and inspect the missed garment, then re-approve.")) return
    setBusy(true)
    try {
      const j = await api(`/api/laundry/orders/${id}/transition`, { method: "POST", body: JSON.stringify({ toStatus: "PENDING_STORE_AUDIT", actorName: staff.name, note: "Reopened to edit garments (missed garment)" }) })
      if (!j.success) { alert(j.error || "Could not reopen the order"); return }
      await load()
      setAudit(true)
    } finally { setBusy(false) }
  }

  if (loading || !order) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white border-b border-slate-200 px-3 py-3 flex items-center gap-2 sticky top-0 z-20">
        <button onClick={onBack} className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center"><ChevronLeft className="h-5 w-5" /></button>
        <div className="min-w-0"><p className="font-mono font-bold text-[14px] text-slate-800 truncate">{order.orderNumber}</p><p className="text-[11px] text-slate-400">{statusLabel(order.status)}</p></div>
      </header>
      <div className="p-3 space-y-3">
        {/* Prominent current-stage banner — staff instantly know what's expected */}
        <div className="rounded-xl bg-blue-600 text-white p-3">
          <p className="text-[10px] uppercase tracking-wide text-blue-100">Current Stage</p>
          <p className="text-[17px] font-bold leading-tight">{statusLabel(order.status)}</p>
          {primary && <p className="text-[11px] text-blue-100 mt-0.5">Next: {primary.label}</p>}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
          <div className="flex items-center gap-2 text-[14px] font-medium"><User className="h-4 w-4 text-slate-400" />{order.customer?.name || "—"}</div>
          {order.customer?.phone && (
            <div className="flex items-center gap-2">
              <span className="flex-1 flex items-center gap-2 text-[13px] text-slate-500"><Phone className="h-4 w-4 text-slate-400" />{order.customer.phone}</span>
              <a href={`tel:${order.customer.phone}`} className="h-9 px-3 rounded-lg bg-blue-50 text-blue-700 text-[12px] font-medium flex items-center gap-1"><Phone className="h-3.5 w-3.5" />Call</a>
              <a href={`https://wa.me/${String(order.customer.phone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-[12px] font-medium flex items-center gap-1"><Phone className="h-3.5 w-3.5" />WhatsApp</a>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[13px]">
            <span className="text-slate-500">Total {inr(order.grandTotal)}</span>
            <span className={order.balanceDue > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-semibold"}>{order.balanceDue > 0 ? `${inr(order.balanceDue)} due` : "Paid"}</span>
          </div>
        </div>

        {/* Status panel */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 grid grid-cols-2 gap-y-2 gap-x-3 text-[12px]">
          <Field label="Payment" value={order.balanceDue > 0 ? "Pending" : "Paid"} tone={order.balanceDue > 0 ? "rose" : "emerald"} />
          <Field label="Order Type" value={order.orderType || "—"} />
          {order.pickupRequired && <Field label="Pickup Slot" value={[fmtDay(order.pickupDate), order.pickupTimeSlot].filter(Boolean).join(" ") || "—"} />}
          {order.pickupRequired && <Field label="Pickup Exec" value={order.pickupExecutiveId ? "Assigned" : "Unassigned"} />}
          {order.deliveryRequired && <Field label="Delivery Slot" value={[fmtDay(order.deliveryDate), order.deliveryTimeSlot].filter(Boolean).join(" ") || "—"} />}
          {order.deliveryRequired && <Field label="Delivery Exec" value={order.deliveryExecutiveId ? "Assigned" : "Unassigned"} />}
          {/* Transport identity per Transport Setup — both when the mode is BOTH. */}
          {order.transport?.packetNumber && <Field label="Packet" value={order.transport.packetNumber} />}
          {order.transport?.bagNumber && <Field label="Bag" value={order.transport.bagNumber} />}
        </div>
        {Array.isArray(order.items) && order.items.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-[12px] font-semibold text-slate-600 mb-2">Garments ({order.items.length})</p>
            <div className="space-y-1">{order.items.slice(0, 12).map((it: { id: string; garmentName: string; serviceName: string; processingStage: string | null }) => (
              <div key={it.id} className="flex items-center justify-between text-[12px]"><span className="text-slate-700">{it.garmentName} · {it.serviceName}</span>{it.processingStage && <span className="text-[10px] text-slate-400">{statusLabel(it.processingStage)}</span>}</div>
            ))}</div>
          </div>
        )}
        {Array.isArray(order.events) && order.events.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-[12px] font-semibold text-slate-600 mb-2">Timeline</p>
            <div className="space-y-1.5">{order.events.slice(0, 8).map((e: { id: string; toStatus: string; createdAt: string; note: string | null }) => (
              <div key={e.id} className="text-[11px] text-slate-500"><span className="text-slate-700 font-medium">{statusLabel(e.toStatus)}</span> · {new Date(e.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
            ))}</div>
          </div>
        )}
      </div>
      {primary && (
        <div className="fixed bottom-0 inset-x-0 p-3 bg-white border-t border-slate-200 space-y-2">
          <button onClick={advance} disabled={busy} className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : primaryLabel}
          </button>
          {order.status === "PAYMENT_PENDING" && (
            <button onClick={reopenAudit} disabled={busy} className="w-full h-10 rounded-xl border border-slate-300 text-slate-600 font-medium text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-50">
              <ClipboardCheck className="h-4 w-4" /> Edit / Reopen Audit
            </button>
          )}
        </div>
      )}
      {!primary && awaitingScanReceive && (
        <div className="fixed bottom-0 inset-x-0 p-3 bg-white border-t border-slate-200">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-[12px] text-blue-800 text-center font-medium">
            Garments are in transit — scan the pickup bag in the <b>Scan</b> tab to receive them at the store.
          </div>
        </div>
      )}
      {pay && <PaymentSheet order={order} staff={staff} api={api} onClose={() => setPay(false)} onDone={() => { setPay(false); load() }} />}
      {audit && <AuditScreen order={order} staff={staff} api={api} onClose={() => setAudit(false)} onDone={() => { setAudit(false); load() }} />}
    </div>
  )
}

// Store Audit — the SAME workflow as desktop: review/add garments, capture total
// weight, damage/customer notes and photos, then Approve (or Reject) through the
// existing inspect + items + uploads + transition APIs. No mobile-only shortcut.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AuditScreen({ order, staff, api, onClose, onDone }: { order: any; staff: Staff; api: Api; onClose: () => void; onDone: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>(order.items || [])
  const [weight, setWeight] = useState(order.totalWeightKg ? String(order.totalWeightKg) : "")
  const [notes, setNotes] = useState("")
  const [photos, setPhotos] = useState<string[]>([])
  const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [err, setErr] = useState<string | null>(null)
  // add-garment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [services, setServices] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [garments, setGarments] = useState<any[]>([])
  const [svc, setSvc] = useState(""); const [gar, setGar] = useState(""); const [qty, setQty] = useState("1"); const [adding, setAdding] = useState(false)

  useEffect(() => {
    api(`/api/laundry/services?businessId=${staff.businessId}`).then((j) => { if (j.success) setServices(j.data || j.services || []) })
    api(`/api/laundry/garments?businessId=${staff.businessId}`).then((j) => { if (j.success) setGarments(j.data || j.garments || []) })
  }, [api, staff.businessId])
  const reload = () => api(`/api/laundry/orders/${order.id}`).then((j) => { if (j.success) setItems(j.data.items || []) })

  const addGarment = async () => {
    const s = services.find((x) => x.id === svc), g = garments.find((x) => x.id === gar)
    // A garment can't be priced without a service — alert instead of silently ignoring.
    if (!s) { setErr("Select a service for this garment."); return }
    if (!g) { setErr("Select a garment."); return }
    setErr(null)
    setAdding(true)
    try {
      const j = await api(`/api/laundry/orders/${order.id}/items`, { method: "POST", body: JSON.stringify({ items: [{ serviceId: s.id, garmentId: g.id, quantity: Math.max(1, Number(qty) || 1), weightKg: 0 }] }) })
      if (!j.success) { setErr(j.error || "Could not add garment"); return }
      setGar(""); setQty("1"); await reload()
    } finally { setAdding(false) }
  }
  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData(); fd.append("file", file); fd.append("businessId", staff.businessId); fd.append("type", "image"); fd.append("category", "audit")
        const res = await fetch("/api/uploads", { method: "POST", body: fd })
        const j = await res.json()
        if (j.success && (j.url || j.data?.url)) setPhotos((p) => [...p, j.url || j.data.url])
      }
    } finally { setUploading(false) }
  }
  const finish = async (approve: boolean) => {
    setErr(null); setBusy(true)
    try {
      // Persist audit data (weight/notes/photos) via the SAME inspect API desktop uses.
      // Stamp EVERY garment as inspected — the store audit gate (checkAuditComplete)
      // requires an inspectedAt on each item before the order can leave audit, and
      // the PWA audits at the whole-order level (no per-garment condition screen).
      await api(`/api/laundry/orders/${order.id}/inspect`, { method: "PUT", body: JSON.stringify({
        businessId: staff.businessId, auditedBy: staff.name, auditNotes: notes || null, auditPhotos: photos,
        items: (items || []).map((it: { id: string }) => ({ itemId: it.id })),
        ...(weight ? { totalWeightKg: Number(weight) } : {}),
      }) })
      // Then move the order through the state machine (approve → payment, reject → cancel).
      const j = await api(`/api/laundry/orders/${order.id}/transition`, { method: "POST", body: JSON.stringify({ toStatus: approve ? "PAYMENT_PENDING" : "CANCELLED", actorName: staff.name, note: approve ? "Audit approved" : "Audit rejected" }) })
      if (!j.success) throw new Error(j.error || "Failed")
      onDone()
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col">
      <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div><h3 className="font-semibold text-slate-800">Store Audit</h3><p className="text-[11px] text-slate-400 font-mono">{order.orderNumber}</p></div>
        <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <section className="space-y-2">
          <p className="text-[12px] font-semibold text-slate-600">Garments ({items.length})</p>
          <div className="space-y-1">{items.map((it: { id: string; garmentName: string; serviceName: string; quantity: number }) => (
            <div key={it.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-[13px]"><span>{it.quantity} × {it.garmentName} · {it.serviceName}</span></div>
          ))}</div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <select value={svc} onChange={(e) => setSvc(e.target.value)} className="h-10 rounded-lg border border-slate-200 px-2 text-[12px] bg-white"><option value="">Service</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select value={gar} onChange={(e) => setGar(e.target.value)} className="h-10 rounded-lg border border-slate-200 px-2 text-[12px] bg-white"><option value="">Garment</option>{garments.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className="h-10 w-12 rounded-lg border border-slate-200 px-2 text-[13px] text-center" />
          </div>
          <button onClick={addGarment} disabled={adding || !svc || !gar} className="w-full h-9 rounded-lg border border-blue-200 text-blue-700 text-[12px] font-medium disabled:opacity-40">{adding ? "Adding…" : "+ Add missing garment"}</button>
        </section>
        <section className="space-y-2">
          <p className="text-[12px] font-semibold text-slate-600">Total Weight (kg)</p>
          <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="e.g. 3.5" className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[15px]" />
        </section>
        <section className="space-y-2">
          <p className="text-[12px] font-semibold text-slate-600">Photos <span className="text-slate-400 font-normal">(damage, missing, stains…)</span></p>
          <div className="flex gap-2 flex-wrap">
            {photos.map((p, i) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={i} src={p} alt="" className="h-16 w-16 rounded-lg object-cover border border-slate-200" />)}
            <label className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 cursor-pointer">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlusCircle className="h-6 w-6" />}
              <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
          </div>
        </section>
        <section className="space-y-2">
          <p className="text-[12px] font-semibold text-slate-600">Notes</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Damage / missing / customer notes" className="w-full rounded-xl border border-slate-200 px-4 py-2 text-[14px]" />
        </section>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
      <div className="p-3 border-t border-slate-200 grid grid-cols-2 gap-2 shrink-0">
        <button onClick={() => finish(false)} disabled={busy} className="h-12 rounded-xl border border-rose-200 text-rose-600 font-semibold disabled:opacity-50">Reject</button>
        <button onClick={() => finish(true)} disabled={busy} className="h-12 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Approve Audit"}</button>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PaymentSheet({ order, staff, api, onClose, onDone }: { order: any; staff: Staff; api: Api; onClose: () => void; onDone: () => void }) {
  const [method, setMethod] = useState("CASH")
  const [amount, setAmount] = useState(String(order.balanceDue || 0))
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      const j = await api(`/api/laundry/orders/${order.id}/payment`, { method: "POST", body: JSON.stringify({ businessId: staff.businessId, method, amount: Number(amount) || 0, createdBy: staff.name }) })
      if (!j.success && j.error) { alert(j.error); return }
      onDone()
    } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end" onClick={onClose}>
      <div className="w-full bg-white rounded-t-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-800">Collect Payment</h3><button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button></div>
        <div className="grid grid-cols-4 gap-2">{["CASH", "UPI", "CARD", "WALLET"].map((m) => (
          <button key={m} onClick={() => setMethod(m)} className={`h-11 rounded-xl text-[12px] font-medium border ${method === m ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}>{m}</button>
        ))}</div>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full h-12 rounded-xl border border-slate-200 px-4 text-[15px]" placeholder="Amount" />
        <button onClick={submit} disabled={busy} className="w-full h-12 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : `Collect ${inr(Number(amount) || 0)}`}</button>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Dispatch({ staff, api, onOpen }: { staff: Staff; api: Api; onOpen: (id: string) => void }) {
  const [mode, setMode] = useState<"pickup" | "delivery">("pickup")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [jobs, setJobs] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [execs, setExecs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api(`/api/laundry/pickup-scheduler?businessId=${staff.businessId}&storeId=${staff.storeId}&type=${mode}&scope=active`),
      // This PWA is already isolated to one store, so the assignable list is
      // that store's executives (plus All Stores) — never the whole chain.
      api(`/api/laundry/delivery-executives?businessId=${staff.businessId}&storeId=${staff.storeId}&assignable=1`),
    ]).then(([s, e]) => { if (s.success) setJobs(s.data); if (e.success) setExecs(e.data) }).finally(() => setLoading(false))
  }, [api, staff, mode])
  useEffect(() => { setSel(new Set()); load() }, [load])

  const assign = async (orderId: string, executiveId: string | null) => {
    const j = await api("/api/laundry/pickup-scheduler", { method: "POST", body: JSON.stringify({ businessId: staff.businessId, orderId, type: mode, executiveId }) })
    if (!j.success && j.error) alert(j.error); load()
  }
  const bulk = async (executiveId: string | null) => {
    const ids = [...sel].filter((id) => { const j = jobs.find((x) => x.id === id); return j && !(j.bucket === "completed" || !!j.completedAt) })
    if (!ids.length) { setSel(new Set()); return }
    const j = await api("/api/laundry/pickup-scheduler", { method: "POST", body: JSON.stringify({ businessId: staff.businessId, orderIds: ids, type: mode, executiveId }) })
    if (!j.success && j.error) alert(j.error); setSel(new Set()); load()
  }
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="pb-4">
      <div className="bg-blue-600 text-white px-4 pt-4 pb-3"><h2 className="font-semibold">Dispatch — {staff.storeName}</h2></div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 rounded-xl p-1">
          {(["pickup", "delivery"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`h-9 rounded-lg text-[13px] font-medium capitalize ${mode === m ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>{m === "pickup" ? "Pickups" : "Deliveries"}</button>
          ))}
        </div>
        {sel.size > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
            <span className="text-[12px] font-medium text-blue-800">{sel.size} selected</span>
            <select defaultValue="" disabled={execs.length === 0} onChange={(e) => { if (e.target.value) { bulk(e.target.value); e.currentTarget.value = "" } }} className="h-9 text-[12px] rounded-lg border border-blue-200 px-2 bg-white flex-1 disabled:bg-slate-50 disabled:text-slate-400">
              <option value="" disabled>{execs.length === 0 ? "None for this store" : "Assign to…"}</option>{execs.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
            <button onClick={() => bulk(null)} className="h-9 px-3 rounded-lg border border-blue-200 text-blue-700 text-[12px]">Unassign</button>
          </div>
        )}
        {loading ? <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-blue-600" /></div>
          : jobs.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">No {mode === "pickup" ? "pickups" : "deliveries"} today.</p>
          : <div className="space-y-2">{jobs.map((j) => {
              const frozen = j.bucket === "completed" || !!j.completedAt
              return (
              <div key={j.id} className={`bg-white rounded-xl border p-3 ${sel.has(j.id) ? "border-blue-300" : "border-slate-200"}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={sel.has(j.id)} disabled={frozen} onChange={() => !frozen && toggle(j.id)} className="h-4 w-4" />
                  <button onClick={() => onOpen(j.id)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center justify-between"><span className="font-mono font-bold text-[13px]">{j.orderNumber}</span><span className="text-[10px] text-slate-400">{fmtDay(j.scheduledDate)} {j.timeSlot || ""}</span></div>
                    <div className="text-[12px] text-slate-500 truncate">{j.customerName}{mode === "pickup" && j.address ? ` · ${j.address}` : ""}{mode === "delivery" ? ` · ${j.amountDue > 0 ? inr(j.amountDue) + " due" : "Paid"}` : ""}</div>
                  </button>
                </div>
                {j.executiveId && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${j.bucket === "accepted" || j.bucket === "completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                      {mode === "pickup" ? "Pickup" : "Delivery"} · {j.bucket === "accepted" ? "Accepted" : j.bucket === "completed" ? "Completed" : j.acceptance === "REJECTED" ? "Rejected" : "Pending acceptance"}
                    </span>
                    <span className="text-slate-500">Assigned to <span className="font-medium text-slate-700">{j.executiveName}</span></span>
                  </div>
                )}
                {frozen ? (
                  <div className="mt-2 w-full h-9 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center px-2 text-[12px] font-medium text-emerald-700">
                    <Lock className="h-3.5 w-3.5 mr-1.5" />{j.executiveName || "Store / Counter"} — completed
                  </div>
                ) : (
                  execs.length === 0 ? (
                  <div className="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[12px] text-amber-700">{NO_EXECUTIVES_FOR_STORE}</div>
                ) : (
                  <select value={j.executiveId || ""} onChange={(e) => assign(j.id, e.target.value || null)} className="mt-2 w-full h-9 rounded-lg border border-slate-200 px-2 text-[12px] bg-white">
                    <option value="">{j.executiveId ? "Reassign / Unassign…" : "— Unassigned —"}</option>
                    {execs.map((ex) => (
                      <option key={ex.id} value={ex.id} disabled={!ex.isActive}>
                        {ex.name}{ex.isActive === false ? " (inactive)" : ""}{ex.availability && ex.availability !== "AVAILABLE" ? ` · ${ex.availability}` : ""} — P{ex.todaysPickups ?? 0}/D{ex.todaysDeliveries ?? 0}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
              )})}</div>}
      </div>
    </div>
  )
}

// Unified store scan: a Pickup Bag QR (PB-…/PKG-…) confirms the pickup was
// physically RECEIVED AT STORE (more accurate than the manual bridge) and advances
// the order to Store Audit; a garment barcode/GAR/ITM code identifies its order.
// Either way the order is one tap away.
function ScanScreen({ staff, api, onOpen }: { staff: Staff; api: Api; onOpen: (orderId: string) => void }) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [garment, setGarment] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bag, setBag] = useState<any>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [bulk, setBulk] = useState(false)
  const [mode, setMode] = useState<"pickup" | "delivery">("pickup")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [queue, setQueue] = useState<any[]>([]) // bulk queue of previewed bags

  const scopeQs = `businessId=${encodeURIComponent(staff.businessId)}&storeId=${encodeURIComponent(staff.storeId)}`
  // Delivery bag returned by the executive after a completed delivery — same flow
  // as desktop Bag Management "Receive Returned Bag" (marks returned + releases).
  const deliveryReturn = async (raw: string) => {
    const c = raw.trim(); if (!c) return
    setBusy(true); setMsg(null); setBag(null); setGarment(null)
    try {
      const j = await api(`/api/laundry/bags/delivery-return?${scopeQs}`, { method: "POST", body: JSON.stringify({ code: c, actorName: staff.name }) })
      if (!j.success) { setMsg({ ok: false, text: j.error || "Not accepted" }); return }
      setMsg({ ok: true, text: `Delivery bag ${j.data.bagNumber} received · ${j.data.orderNumber}${j.data.released ? " → Available" : ""}` })
    } finally { setBusy(false); setCode("") }
  }
  const previewCall = (c: string) => api(`/api/laundry/bags/receive-at-store?${scopeQs}`, { method: "POST", body: JSON.stringify({ code: c, actorName: staff.name }) })
  // Chain of custody: preview the bag → the RECEIVER confirms (with condition).
  const previewBag = async (c: string) => {
    const j = await previewCall(c)
    if (j.success && j.preview) { setBag({ ...j.data, code: c }); setGarment(null); return true }
    if (j.success && j.alreadyReceived) { setMsg({ ok: true, text: j.message }); return true }
    if (!j.success && j.error && !/No bag found/i.test(j.error)) { setMsg({ ok: false, text: j.error }); return true } // real validation error (wrong store etc.)
    return false
  }
  const doReceive = (c: string, condition: string) => api(`/api/laundry/bags/receive-at-store?${scopeQs}`, { method: "POST", body: JSON.stringify({ code: c, confirm: true, condition, actorName: staff.name }) })
  const confirmReceive = async (condition: string) => {
    if (!bag?.code) return
    setBusy(true)
    try {
      const j = await doReceive(bag.code, condition)
      if (!j.success) { setMsg({ ok: false, text: j.error || "Receive failed" }); return }
      if (j.rejected) { setMsg({ ok: false, text: j.message || "Receipt rejected — returned to executive." }); setBag(null); return }
      setMsg({ ok: true, text: `Received ${j.data.bag} · ${j.data.orderNumber} → Store Audit${j.exception ? " (exception recorded)" : ""}` })
      setBag((b: typeof bag) => ({ ...b, received: true, orderId: j.data.orderId, orderNumber: j.data.orderNumber }))
    } finally { setBusy(false) }
  }
  // Bulk: queue each scanned bag, then receive them all in one pass.
  const queueBag = async (c: string) => {
    if (queue.some((q) => q.code === c)) { setMsg({ ok: false, text: "Already in the list" }); return true }
    const j = await previewCall(c)
    if (j.success && j.preview) { setQueue((q) => [{ code: c, order: j.data.order, customer: j.data.customer, bag: j.data.bag }, ...q]); setMsg(null); return true }
    if (j.success && j.alreadyReceived) { setMsg({ ok: false, text: j.message }); return true }
    if (!j.success && j.error && !/No bag found/i.test(j.error)) { setMsg({ ok: false, text: j.error }); return true }
    return false
  }
  const receiveAll = async () => {
    setBusy(true)
    try {
      let ok = 0, fail = 0
      for (const q of queue) { const j = await doReceive(q.code, "OK"); if (j.success && j.received) ok++; else fail++ }
      setMsg({ ok: fail === 0, text: `Received ${ok} bag${ok === 1 ? "" : "s"} → Store Audit${fail ? ` · ${fail} failed` : ""}` })
      setQueue([])
    } finally { setBusy(false) }
  }
  const lookup = async (raw: string) => {
    const c = raw.trim(); if (!c) return
    if (mode === "delivery") { deliveryReturn(c); return }
    setBusy(true); setMsg(null); if (!bulk) { setGarment(null); setBag(null) }
    try {
      if (bulk) { if (await queueBag(c)) return; const j = await api(`/api/laundry/scan?barcode=${encodeURIComponent(c)}`); setMsg({ ok: false, text: j.success ? "That is a garment, not a pickup bag." : "No pickup bag found for this code." }); return }
      // Single: bag first (pickup receive is the store's most common scan)…
      if (await previewBag(c)) return
      // …else a garment code → identify the order.
      const j = await api(`/api/laundry/scan?barcode=${encodeURIComponent(c)}`)
      if (j.success) { setGarment(j.data); return }
      setMsg({ ok: false, text: j.error || "No bag or garment found for this code." })
    } finally { setBusy(false); setCode("") }
  }
  const process = async () => {
    if (!garment?.item) return
    const item = garment.item
    const action = item.processingStatus === "WAITING" ? "START" : item.processingStatus === "IN_PROGRESS" ? (item.processingStage === "QC" ? "QC_PASS" : "COMPLETE") : null
    if (!action) { setMsg({ ok: false, text: `Garment is ${item.processingStatus}` }); return }
    setBusy(true)
    try {
      const j = await api(`/api/laundry/items/${item.id}/process`, { method: "POST", body: JSON.stringify({ action, actorName: staff.name, expectedStage: item.processingStage }) })
      if (!j.success) setMsg({ ok: false, text: j.error || "Action failed" })
      else { setMsg({ ok: true, text: `${action === "START" ? "Started" : "Completed"} ${item.garmentName}` }); setGarment(null) }
    } finally { setBusy(false) }
  }
  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">{mode === "delivery" ? "Receive Returned Bag" : "Receive Pickup Bag"}</h2>
        {mode === "pickup" && <button onClick={() => { setBulk((v) => !v); setBag(null); setGarment(null); setQueue([]); setMsg(null) }} className={`text-[12px] font-semibold rounded-full px-3 h-8 border ${bulk ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-600 border-blue-200"}`}>{bulk ? "Bulk: On" : "Bulk"}</button>}
      </div>
      {/* Mode: receive a pickup bag (in) vs a returned delivery bag (back). */}
      <div className="flex rounded-xl border border-slate-200 overflow-hidden text-[12px] font-semibold">
        {(["pickup", "delivery"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setBulk(false); setBag(null); setGarment(null); setQueue([]); setMsg(null); setCode("") }} className={`flex-1 h-9 ${mode === m ? "bg-blue-600 text-white" : "bg-white text-slate-500"}`}>{m === "pickup" ? "Pickup Receive" : "Delivery Bag Return"}</button>
        ))}
      </div>
      <p className="text-[12px] text-slate-400 -mt-2">{mode === "delivery" ? "Scan the delivery bag the executive brought back after a completed delivery — it's marked returned and freed for reuse." : bulk ? "Scan several pickup bags, then receive them all in one go." : "Scan the pickup bag QR (or enter the bag number) to confirm it arrived — or scan a garment to open its order."}</p>
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        {/* Primary: open the device camera to scan the bag QR (mobile). The scanner
            also offers USB/Bluetooth modes via its settings gear for desktop guns. */}
        <BagScanButton label="Scan with Camera" onScan={lookup} disabled={busy} closeOnScan={!bulk} className="w-full h-14 rounded-xl text-[16px] justify-center" />
        <div className="flex items-center gap-2 text-[11px] text-slate-400"><div className="h-px flex-1 bg-slate-100" />or enter the bag number<div className="h-px flex-1 bg-slate-100" /></div>
        <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup(code)} placeholder={bulk ? "Scan pickup bag" : "Scan bag or garment code"} className="w-full h-14 rounded-xl border-2 border-blue-200 px-4 text-center text-[16px] font-mono" />
        <button onClick={() => lookup(code)} disabled={busy || !code.trim()} className="w-full h-14 rounded-xl bg-slate-700 text-white font-semibold text-[16px] flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <><ScanLine className="h-6 w-6" /> {bulk ? "Add to List" : "Look Up"}</>}</button>
      </div>
      {msg && <div className={`rounded-xl px-4 py-3 text-[14px] ${msg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>{msg.text}</div>}
      {bulk && queue.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <p className="font-semibold text-slate-800">{queue.length} bag{queue.length === 1 ? "" : "s"} to receive</p>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {queue.map((q) => (
              <div key={q.code} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-[13px]">
                <div className="min-w-0"><p className="font-mono font-semibold text-slate-700 truncate">{q.bag?.number}</p><p className="text-[11px] text-slate-400 truncate">{q.order?.orderNumber} · {q.customer?.name || "—"}</p></div>
                <button onClick={() => setQueue((qq) => qq.filter((x) => x.code !== q.code))} className="text-slate-300 hover:text-rose-500"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={receiveAll} disabled={busy} className="w-full h-12 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="h-5 w-5" /> Receive All ({queue.length}) — All OK</>}</button>
          <p className="text-[10px] text-slate-400 text-center">For a damaged/rejected bag, receive it individually in single mode.</p>
        </div>
      )}
      {bag && !bag.received && (
        <div className="bg-white rounded-2xl border border-blue-200 p-4 space-y-3">
          <p className="font-semibold text-slate-800">Receive at Store</p>
          <div className="text-[13px] text-slate-600 space-y-1">
            <p><span className="text-slate-400">Bag</span> · <span className="font-mono font-semibold">{bag.bag?.number}</span>{bag.bag?.service ? ` · ${bag.bag.service}` : ""}</p>
            <p><span className="text-slate-400">Order</span> · <span className="font-mono">{bag.order?.orderNumber}</span></p>
            {bag.customer && <p><span className="text-slate-400">Customer</span> · {bag.customer.name}{bag.customer.phone ? ` (${bag.customer.phone})` : ""}</p>}
            {bag.executive && <p><span className="text-slate-400">Executive</span> · {bag.executive}</p>}
            {bag.pickupCompletedAt && <p><span className="text-slate-400">Picked up</span> · {new Date(bag.pickupCompletedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
          </div>
          <button onClick={() => confirmReceive("OK")} disabled={busy} className="w-full h-12 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="h-5 w-5" /> Receive — All OK</>}</button>
          <div className="grid grid-cols-3 gap-1.5">
            {([["BAG_DAMAGED", "Bag Damaged"], ["SEAL_BROKEN", "Seal Broken"], ["GARMENTS_MISSING", "Items Missing"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => confirmReceive(v)} disabled={busy} className="h-10 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-semibold disabled:opacity-50">{l}</button>
            ))}
          </div>
          <button onClick={() => confirmReceive("REJECT")} disabled={busy} className="w-full h-10 rounded-lg border border-rose-200 text-rose-600 text-[12px] font-semibold disabled:opacity-50">Reject Receipt — return to executive</button>
        </div>
      )}
      {bag && bag.received && bag.orderId && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-2">
          <p className="font-semibold text-emerald-800 flex items-center gap-1"><CheckCircle2 className="h-5 w-5" /> Pickup Received</p>
          <p className="text-[13px] text-slate-500">{bag.orderNumber}</p>
          <button onClick={() => onOpen(bag.orderId)} className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold">Open Order · Start Store Audit</button>
        </div>
      )}
      {garment?.item && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <p className="font-semibold text-slate-800">{garment.item.garmentName}</p>
          <p className="text-[13px] text-slate-500">{garment.item.serviceName} · {garment.order?.orderNumber}</p>
          <p className="text-[12px] text-slate-400">Stage: {statusLabel(garment.item.processingStage)} · {garment.item.processingStatus}</p>
          {garment.order?.id && <button onClick={() => onOpen(garment.order.id)} className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold">Open Order {garment.order.orderNumber}</button>}
          {garment.item.processingStatus && garment.item.processingStatus !== "DONE" && (
            <button onClick={process} disabled={busy} className="w-full h-12 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Process at this Workstation"}</button>
          )}
        </div>
      )}
    </div>
  )
}

// Real order creation — the SAME backend as desktop: customer search/create
// (customers APIs) → garment lines (services + garments) → orders POST, which
// prices through the shared billing engine and drives the same state machine.
// No simplified mobile lifecycle.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CreateSheet({ staff, api, onClose, onCreated }: { staff: Staff; api: Api; onClose: () => void; onCreated: () => void }) {
  const [kind, setKind] = useState<"WALK_IN" | "HOME_PICKUP">("WALK_IN")
  // customer
  const [q, setQ] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [matches, setMatches] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customer, setCustomer] = useState<any>(null)
  const [newName, setNewName] = useState(""); const [newMobile, setNewMobile] = useState(""); const [creatingCust, setCreatingCust] = useState(false)
  // catalog
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [services, setServices] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [garments, setGarments] = useState<any[]>([])
  const [svc, setSvc] = useState(""); const [gar, setGar] = useState(""); const [qty, setQty] = useState("1")
  const [lines, setLines] = useState<{ serviceId: string; serviceName: string; garmentId: string; garmentName: string; quantity: number }[]>([])
  // pickup
  const [date, setDate] = useState(""); const [slot, setSlot] = useState("")
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  // saved addresses (reuse the existing customer address module — single source)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [addresses, setAddresses] = useState<any[]>([])
  const [addrId, setAddrId] = useState("")
  const [showAddAddr, setShowAddAddr] = useState(false)
  const [na, setNa] = useState({ addressType: "HOME", addressLine1: "", area: "", city: "", pincode: "" })
  const [savingAddr, setSavingAddr] = useState(false)
  const fmtAddr = (a: { addressLine1: string; area?: string | null; city?: string | null }) => [a.addressLine1, a.area, a.city].filter(Boolean).join(", ")

  const loadAddresses = useCallback(async (custId: string) => {
    const j = await api(`/api/laundry/customers/${custId}/addresses?businessId=${staff.businessId}`)
    const list = j.success ? (j.data || []) : []
    setAddresses(list)
    // Preselect the pickup-default, else the default, else the only/first one.
    const pref = list.find((a: { isPickupDefault?: boolean }) => a.isPickupDefault) || list.find((a: { isDefault?: boolean }) => a.isDefault) || list[0]
    setAddrId(pref?.id || "")
    setShowAddAddr(list.length === 0)
  }, [api, staff.businessId])
  useEffect(() => {
    if (kind === "HOME_PICKUP" && customer?.id) loadAddresses(customer.id)
    else { setAddresses([]); setAddrId(""); setShowAddAddr(false) }
  }, [kind, customer, loadAddresses])

  const saveAddress = async () => {
    if (!customer?.id || !na.addressLine1.trim()) return
    setSavingAddr(true)
    try {
      const j = await api(`/api/laundry/customers/${customer.id}/addresses`, { method: "POST", body: JSON.stringify({ businessId: staff.businessId, ...na, isPickupDefault: addresses.length === 0 }) })
      if (!j.success) { setErr(j.error || "Could not save address"); return }
      setNa({ addressType: "HOME", addressLine1: "", area: "", city: "", pincode: "" }); setShowAddAddr(false)
      await loadAddresses(customer.id)
      if (j.data?.id) setAddrId(j.data.id) // select the newly-added address
    } finally { setSavingAddr(false) }
  }

  useEffect(() => {
    api(`/api/laundry/services?businessId=${staff.businessId}`).then((j) => { if (j.success) setServices(j.data || j.services || []) })
    api(`/api/laundry/garments?businessId=${staff.businessId}`).then((j) => { if (j.success) setGarments(j.data || j.garments || []) })
  }, [api, staff.businessId])
  useEffect(() => {
    if (customer || q.trim().length < 2) { setMatches([]); return }
    const t = setTimeout(() => api(`/api/laundry/customers/search?businessId=${staff.businessId}&q=${encodeURIComponent(q.trim())}`).then((j) => setMatches(j.success ? (j.data || []) : [])), 300)
    return () => clearTimeout(t)
  }, [q, customer, api, staff.businessId])

  const createCustomer = async () => {
    if (!newName.trim() || !newMobile.trim()) return
    setCreatingCust(true)
    try {
      const j = await api("/api/laundry/customers", { method: "POST", body: JSON.stringify({ businessId: staff.businessId, name: newName.trim(), mobile: newMobile.trim() }) })
      if (j.success && j.data) setCustomer(j.data); else setErr(j.error || "Could not create customer")
    } finally { setCreatingCust(false) }
  }
  const addLine = () => {
    const s = services.find((x) => x.id === svc), g = garments.find((x) => x.id === gar)
    if (!s || !g) return
    setLines((p) => [...p, { serviceId: s.id, serviceName: s.name, garmentId: g.id, garmentName: g.name, quantity: Math.max(1, Number(qty) || 1) }])
    setGar(""); setQty("1")
  }
  const submit = async () => {
    setErr(null)
    if (!customer) { setErr("Select or create a customer"); return }
    if (lines.length === 0) { setErr("Add at least one garment"); return }
    const selAddr = addresses.find((a) => a.id === addrId)
    if (kind === "HOME_PICKUP" && !selAddr) { setErr("Select or add a pickup address"); return }
    setBusy(true)
    try {
      const j = await api("/api/laundry/orders", { method: "POST", body: JSON.stringify({
        businessId: staff.businessId, storeId: staff.storeId, customerId: customer.id, orderType: kind,
        createdBy: staff.name,
        items: lines.map((l) => ({ serviceId: l.serviceId, garmentId: l.garmentId, quantity: l.quantity, weightKg: 0 })),
        ...(kind === "HOME_PICKUP" ? { pickupRequired: true, pickupAddress: selAddr ? fmtAddr(selAddr) : null, pickupDate: date || null, pickupTimeSlot: slot || null } : {}),
      }) })
      if (!j.success) throw new Error(j.error || "Failed to create order")
      onCreated()
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col">
      <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-slate-800">New Order</h3><button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 rounded-xl p-1">
          {(["WALK_IN", "HOME_PICKUP"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`h-9 rounded-lg text-[13px] font-medium ${kind === k ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>{k === "WALK_IN" ? "Walk-in" : "Home Pickup"}</button>
          ))}
        </div>

        {/* Customer */}
        <section className="space-y-2">
          <p className="text-[12px] font-semibold text-slate-600">Customer</p>
          {customer ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
              <div><p className="font-medium text-[14px] text-slate-800">{customer.name}</p><p className="text-[12px] text-slate-500">{customer.phone || customer.mobile}</p></div>
              <button onClick={() => { setCustomer(null); setQ("") }} className="text-[12px] text-slate-500">Change</button>
            </div>
          ) : (
            <>
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by mobile or name" className="w-full h-11 pl-9 rounded-xl border border-slate-200 text-[15px]" /></div>
              {matches.length > 0 && <div className="space-y-1">{matches.slice(0, 6).map((c) => (
                <button key={c.id} onClick={() => setCustomer(c)} className="w-full text-left bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px]"><span className="font-medium text-slate-800">{c.name}</span> · <span className="text-slate-500">{c.phone}</span></button>
              ))}</div>}
              <div className="rounded-xl border border-dashed border-slate-200 p-2.5 space-y-2">
                <p className="text-[11px] text-slate-400">New customer</p>
                <div className="grid grid-cols-2 gap-2">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" className="h-10 rounded-lg border border-slate-200 px-3 text-[14px]" />
                  <input value={newMobile} onChange={(e) => setNewMobile(e.target.value)} inputMode="tel" placeholder="Mobile" className="h-10 rounded-lg border border-slate-200 px-3 text-[14px]" />
                </div>
                <button onClick={createCustomer} disabled={creatingCust || !newName.trim() || !newMobile.trim()} className="w-full h-10 rounded-lg bg-slate-800 text-white text-[13px] font-medium disabled:opacity-50">{creatingCust ? "Creating…" : "Create customer"}</button>
              </div>
            </>
          )}
        </section>

        {/* Garments */}
        <section className="space-y-2">
          <p className="text-[12px] font-semibold text-slate-600">Garments</p>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <select value={svc} onChange={(e) => setSvc(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-2 text-[13px] bg-white"><option value="">Service</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select value={gar} onChange={(e) => setGar(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-2 text-[13px] bg-white"><option value="">Garment</option>{garments.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className="h-11 w-14 rounded-xl border border-slate-200 px-2 text-[14px] text-center" />
          </div>
          <button onClick={addLine} disabled={!svc || !gar} className="w-full h-10 rounded-xl border border-blue-200 text-blue-700 text-[13px] font-medium disabled:opacity-40">+ Add garment</button>
          {lines.length > 0 && <div className="space-y-1">{lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-[13px]"><span>{l.quantity} × {l.garmentName} · {l.serviceName}</span><button onClick={() => setLines((p) => p.filter((_, j) => j !== i))}><X className="h-4 w-4 text-slate-400" /></button></div>
          ))}</div>}
          <p className="text-[10px] text-slate-400">Pricing is applied by the same billing engine on save — walk-ins go straight to Store Audit; the audit finalises weight, pricing and photos.</p>
        </section>

        {kind === "HOME_PICKUP" && (
          <section className="space-y-2">
            <p className="text-[12px] font-semibold text-slate-600">Pickup Address</p>
            {!customer ? (
              <p className="text-[12px] text-slate-400">Select a customer to load their saved addresses.</p>
            ) : (
              <>
                {addresses.map((a) => (
                  <label key={a.id} className={`flex items-start gap-2 rounded-xl border p-3 ${addrId === a.id ? "border-blue-400 bg-blue-50/50" : "border-slate-200"}`}>
                    <input type="radio" checked={addrId === a.id} onChange={() => setAddrId(a.id)} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="text-[13px] font-medium text-slate-800">{a.label || a.addressType}{a.isPickupDefault ? " · Default" : ""}</span>
                      <span className="block text-[12px] text-slate-500">{fmtAddr(a)}{a.pincode ? ` — ${a.pincode}` : ""}</span>
                    </span>
                  </label>
                ))}
                {addresses.length === 0 && !showAddAddr && <p className="text-[12px] text-slate-400">No saved addresses.</p>}
                {!showAddAddr ? (
                  <button onClick={() => setShowAddAddr(true)} className="w-full h-10 rounded-xl border border-dashed border-blue-200 text-blue-700 text-[13px] font-medium flex items-center justify-center gap-1"><MapPin className="h-4 w-4" /> Add New Address</button>
                ) : (
                  <div className="rounded-xl border border-slate-200 p-2.5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={na.addressType} onChange={(e) => setNa((p) => ({ ...p, addressType: e.target.value }))} className="h-10 rounded-lg border border-slate-200 px-2 text-[13px] bg-white">{["HOME", "OFFICE", "APARTMENT", "OTHER"].map((t) => <option key={t} value={t}>{t}</option>)}</select>
                      <input value={na.pincode} onChange={(e) => setNa((p) => ({ ...p, pincode: e.target.value }))} inputMode="numeric" placeholder="Pincode" className="h-10 rounded-lg border border-slate-200 px-3 text-[13px]" />
                    </div>
                    <input value={na.addressLine1} onChange={(e) => setNa((p) => ({ ...p, addressLine1: e.target.value }))} placeholder="Address line" className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[14px]" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={na.area} onChange={(e) => setNa((p) => ({ ...p, area: e.target.value }))} placeholder="Area" className="h-10 rounded-lg border border-slate-200 px-3 text-[13px]" />
                      <input value={na.city} onChange={(e) => setNa((p) => ({ ...p, city: e.target.value }))} placeholder="City" className="h-10 rounded-lg border border-slate-200 px-3 text-[13px]" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveAddress} disabled={savingAddr || !na.addressLine1.trim()} className="flex-1 h-10 rounded-lg bg-blue-600 text-white text-[13px] font-medium disabled:opacity-50">{savingAddr ? "Saving…" : "Save Address"}</button>
                      {addresses.length > 0 && <button onClick={() => setShowAddAddr(false)} className="h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-500">Cancel</button>}
                    </div>
                  </div>
                )}
                <p className="text-[12px] font-semibold text-slate-600 pt-1">Pickup Schedule</p>
                <div className="grid grid-cols-2 gap-2"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-[14px]" /><input value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="Time slot" className="h-11 rounded-xl border border-slate-200 px-3 text-[14px]" /></div>
              </>
            )}
          </section>
        )}
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
      <div className="p-3 border-t border-slate-200 shrink-0">
        <button onClick={submit} disabled={busy || !customer || lines.length === 0} className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : `Create ${kind === "WALK_IN" ? "Walk-in" : "Pickup"} Order`}</button>
      </div>
    </div>
  )
}

function Profile({ staff, onLogout, onSwitch }: { staff: Staff; onLogout: () => void; onSwitch?: () => void }) {
  return (
    <div className="px-4 pt-6 space-y-4">
      <Header staff={staff} />
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-[13px]">
        <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="font-medium text-slate-700">{staff.name}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Role</span><span className="font-medium text-slate-700">{staff.roleName}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Store</span><span className="font-medium text-slate-700">{staff.storeName}</span></div>
        {staff.storeCode && <div className="flex justify-between"><span className="text-slate-400">Code</span><span className="font-mono text-slate-700">{staff.storeCode}</span></div>}
      </div>
      {staff.isSuperAdmin && onSwitch && (
        <button onClick={onSwitch} className="w-full h-12 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-semibold flex items-center justify-center gap-2"><Store className="h-5 w-5" /> Switch Store</button>
      )}
      <button onClick={onLogout} className="w-full h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-semibold flex items-center justify-center gap-2"><LogOut className="h-5 w-5" /> Sign Out</button>
    </div>
  )
}

function StorePicker({ sa, onPick, onLogout }: { sa: SuperAdmin; onPick: (b: SuperAdmin["businesses"][number], s: { id: string; storeName: string; storeCode: string | null }) => void; onLogout: () => void }) {
  const [q, setQ] = useState("")
  const rows = sa.businesses.flatMap((b) => b.stores.map((s) => ({ b, s })))
  const filtered = rows.filter(({ b, s }) => !q.trim() || `${b.businessName} ${s.storeName} ${s.storeCode || ""}`.toLowerCase().includes(q.trim().toLowerCase()))
  // Only a platform administrator ever reaches this screen, and only they may
  // span tenants. When their list holds a single business, name it and drop the
  // business count entirely — "1 businesses" reads like a leak even when it is
  // not one.
  const single = sa.businesses.length === 1 ? sa.businesses[0] : null
  const storeCount = `${rows.length} ${rows.length === 1 ? "Store" : "Stores"}`
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-blue-600 text-white px-4 pt-5 pb-5 flex items-center justify-between">
        <div>
          <p className="text-[15px] font-bold">{single ? single.businessName : "Super Admin"}</p>
          <p className="text-[12px] text-blue-100">
            {single ? `Choose a store — ${storeCount}` : `Choose a store to manage — ${storeCount} across ${sa.businesses.length} businesses`}
          </p>
        </div>
        <button onClick={onLogout} className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center"><LogOut className="h-4 w-4" /></button>
      </header>
      <div className="p-3">
        <div className="relative mb-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={single ? "Search store" : "Search business or store"} className="w-full h-11 pl-9 rounded-xl border border-slate-200 bg-white text-[15px]" /></div>
        {filtered.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">No stores.</p> : (
          <div className="space-y-1.5">{filtered.map(({ b, s }) => (
            <button key={`${b.businessId}-${s.id}`} onClick={() => onPick(b, s)} className="w-full text-left bg-white rounded-xl border border-slate-200 p-3 active:scale-[0.99] transition-transform">
              <p className="font-medium text-[14px] text-slate-800">{s.storeName}</p>
              <p className="text-[12px] text-slate-500">{single ? (s.storeCode || "") : `${b.businessName}${s.storeCode ? ` · ${s.storeCode}` : ""}`}</p>
            </button>
          ))}</div>
        )}
      </div>
    </div>
  )
}
