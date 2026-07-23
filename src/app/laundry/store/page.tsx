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
  CheckCircle2, PlusCircle, Search, ScanLine, LayoutGrid, ChevronLeft, User, Phone, RefreshCw, X, MapPin,
} from "lucide-react"
import { getTransitions, statusLabel } from "@/lib/laundry-workflow"

const TOKEN_KEY = "qx_store_token"

interface Staff { name: string | null; businessId: string; roleName: string; storeId: string; storeName: string | null; storeCode: string | null }
interface Counts { todaysOrders: number; todaysPickup: number; todaysDelivery: number; pendingAudit: number; pendingPayment: number; readyProcessing: number; readyDelivery: number; completedToday: number }
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

  useEffect(() => {
    const tk = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null
    if (!tk) { setBooting(false); return }
    api("/api/laundry/store-admin/me", {}, tk).then((j) => {
      if (j.success) { setToken(tk); setStaff(j.data) } else localStorage.removeItem(TOKEN_KEY)
    }).catch(() => {}).finally(() => setBooting(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async () => {
    setError(null); setLoggingIn(true)
    try {
      const res = await fetch("/api/laundry/store-admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Login failed")
      localStorage.setItem(TOKEN_KEY, j.data.token); setToken(j.data.token); setStaff(j.data.staff); setPassword("")
    } catch (e) { setError(e instanceof Error ? e.message : "Login failed") } finally { setLoggingIn(false) }
  }
  const logout = async () => {
    try { await api("/api/laundry/store-admin/auth/logout", { method: "POST" }) } catch { /* noop */ }
    localStorage.removeItem(TOKEN_KEY); setToken(null); setStaff(null)
  }
  const goOrders = (status: string) => { setOrdersStatus(status); setTab("orders") }

  if (booting) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>

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
          {tab === "scan" && <ScanScreen staff={staff} api={api} />}
          {tab === "profile" && <Profile staff={staff} onLogout={logout} />}
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

function Header({ staff }: { staff: Staff }) {
  return (
    <header className="bg-blue-600 text-white px-4 pt-5 pb-6 rounded-b-2xl">
      <div className="flex items-center gap-2.5">
        <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Store className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold truncate">{staff.storeName || "Your Store"}</p>
          <p className="text-[11px] text-blue-100 truncate">{staff.name} · {staff.roleName}</p>
        </div>
      </div>
    </header>
  )
}

function Dashboard({ staff, api, onCounter, onTab }: { staff: Staff; api: Api; onCounter: (s: string) => void; onTab: (t: Tab) => void }) {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => { setLoading(true); api("/api/laundry/store-admin/dashboard").then((j) => { if (j.success) setCounts(j.data) }).finally(() => setLoading(false)) }, [api])
  useEffect(() => { load() }, [load])

  const tiles: { key: keyof Counts; label: string; icon: React.ComponentType<{ className?: string }>; color: string; go: () => void }[] = [
    { key: "todaysOrders", label: "Today's Orders", icon: ClipboardList, color: "text-slate-700 bg-slate-50 border-slate-200", go: () => onCounter("") },
    { key: "todaysPickup", label: "Today's Pickup", icon: Truck, color: "text-amber-700 bg-amber-50 border-amber-200", go: () => onTab("dispatch") },
    { key: "todaysDelivery", label: "Today's Delivery", icon: PackageCheck, color: "text-violet-700 bg-violet-50 border-violet-200", go: () => onTab("dispatch") },
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
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-[13px] font-semibold text-slate-700">Today at a glance</h2>
            <button onClick={load} className="text-slate-400"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button>
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
  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams({ businessId: staff.businessId, storeId: staff.storeId, limit: "50" })
    if (status) p.set("status", status)
    if (q.trim()) p.set("search", q.trim())
    api(`/api/laundry/orders?${p}`).then((j) => { if (j.success) setOrders(j.data) }).finally(() => setLoading(false))
  }, [api, staff, status, q])
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [load, q])

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
  const load = useCallback(() => { setLoading(true); api(`/api/laundry/orders/${id}`).then((j) => { if (j.success) setOrder(j.data) }).finally(() => setLoading(false)) }, [api, id])
  useEffect(() => { load() }, [load])

  const primary = useMemo(() => order ? getTransitions(order.status).find((t) => t.primary) : null, [order])

  const advance = async () => {
    if (!order || !primary) return
    if (primary.action === "COLLECT_PAYMENT") { setPay(true); return }
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

  if (loading || !order) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white border-b border-slate-200 px-3 py-3 flex items-center gap-2 sticky top-0 z-20">
        <button onClick={onBack} className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center"><ChevronLeft className="h-5 w-5" /></button>
        <div className="min-w-0"><p className="font-mono font-bold text-[14px] text-slate-800 truncate">{order.orderNumber}</p><p className="text-[11px] text-slate-400">{statusLabel(order.status)}</p></div>
      </header>
      <div className="p-3 space-y-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-[13px]"><User className="h-4 w-4 text-slate-400" />{order.customer?.name || "—"}</div>
          {order.customer?.phone && <div className="flex items-center gap-2 text-[13px] text-slate-500"><Phone className="h-4 w-4 text-slate-400" />{order.customer.phone}</div>}
          <div className="flex items-center justify-between pt-1 text-[13px]">
            <span className="text-slate-500">Total {inr(order.grandTotal)}</span>
            <span className={order.balanceDue > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-semibold"}>{order.balanceDue > 0 ? `${inr(order.balanceDue)} due` : "Paid"}</span>
          </div>
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
        <div className="fixed bottom-0 inset-x-0 p-3 bg-white border-t border-slate-200">
          <button onClick={advance} disabled={busy} className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : primary.label}
          </button>
        </div>
      )}
      {pay && <PaymentSheet order={order} staff={staff} api={api} onClose={() => setPay(false)} onDone={() => { setPay(false); load() }} />}
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
      api(`/api/laundry/delivery-executives?businessId=${staff.businessId}`),
    ]).then(([s, e]) => { if (s.success) setJobs(s.data); if (e.success) setExecs(e.data) }).finally(() => setLoading(false))
  }, [api, staff, mode])
  useEffect(() => { setSel(new Set()); load() }, [load])

  const assign = async (orderId: string, executiveId: string | null) => {
    const j = await api("/api/laundry/pickup-scheduler", { method: "POST", body: JSON.stringify({ businessId: staff.businessId, orderId, type: mode, executiveId }) })
    if (!j.success && j.error) alert(j.error); load()
  }
  const bulk = async (executiveId: string | null) => {
    const ids = [...sel]; if (!ids.length) return
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
            <select defaultValue="" onChange={(e) => { if (e.target.value) { bulk(e.target.value); e.currentTarget.value = "" } }} className="h-9 text-[12px] rounded-lg border border-blue-200 px-2 bg-white flex-1">
              <option value="" disabled>Assign to…</option>{execs.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
            <button onClick={() => bulk(null)} className="h-9 px-3 rounded-lg border border-blue-200 text-blue-700 text-[12px]">Unassign</button>
          </div>
        )}
        {loading ? <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-blue-600" /></div>
          : jobs.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">No {mode === "pickup" ? "pickups" : "deliveries"} today.</p>
          : <div className="space-y-2">{jobs.map((j) => (
              <div key={j.id} className={`bg-white rounded-xl border p-3 ${sel.has(j.id) ? "border-blue-300" : "border-slate-200"}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={sel.has(j.id)} onChange={() => toggle(j.id)} className="h-4 w-4" />
                  <button onClick={() => onOpen(j.id)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center justify-between"><span className="font-mono font-bold text-[13px]">{j.orderNumber}</span><span className="text-[10px] text-slate-400">{fmtDay(j.scheduledDate)} {j.timeSlot || ""}</span></div>
                    <div className="text-[12px] text-slate-500 truncate">{j.customerName}{mode === "pickup" && j.address ? ` · ${j.address}` : ""}{mode === "delivery" ? ` · ${j.amountDue > 0 ? inr(j.amountDue) + " due" : "Paid"}` : ""}</div>
                  </button>
                </div>
                <select value={j.executiveId || ""} onChange={(e) => assign(j.id, e.target.value || null)} className="mt-2 w-full h-9 rounded-lg border border-slate-200 px-2 text-[12px] bg-white">
                  <option value="">— Unassigned —</option>{execs.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
              </div>
            ))}</div>}
      </div>
    </div>
  )
}

function ScanScreen({ staff, api }: { staff: Staff; api: Api }) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const lookup = async (c: string) => {
    if (!c.trim()) return
    setBusy(true); setMsg(null)
    try {
      const j = await api(`/api/laundry/scan?barcode=${encodeURIComponent(c.trim())}`)
      if (!j.success) { setMsg({ ok: false, text: j.error || "Garment not found" }); setResult(null) }
      else setResult(j.data)
    } finally { setBusy(false); setCode("") }
  }
  const process = async () => {
    if (!result?.item) return
    const item = result.item
    const action = item.processingStatus === "WAITING" ? "START" : item.processingStatus === "IN_PROGRESS" ? (item.processingStage === "QC" ? "QC_PASS" : "COMPLETE") : null
    if (!action) { setMsg({ ok: false, text: `Garment is ${item.processingStatus}` }); return }
    setBusy(true)
    try {
      const j = await api(`/api/laundry/items/${item.id}/process`, { method: "POST", body: JSON.stringify({ action, actorName: staff.name, expectedStage: item.processingStage }) })
      if (!j.success) setMsg({ ok: false, text: j.error || "Action failed" })
      else { setMsg({ ok: true, text: `${action === "START" ? "Started" : "Completed"} ${item.garmentName}` }); setResult(null) }
    } finally { setBusy(false) }
  }
  return (
    <div className="px-4 pt-6 space-y-4">
      <h2 className="text-lg font-bold text-slate-800">Scan Garment</h2>
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <input autoFocus value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup(code)} placeholder="Scan or type barcode" className="w-full h-14 rounded-xl border-2 border-blue-200 px-4 text-center text-[16px] font-mono" />
        <button onClick={() => lookup(code)} disabled={busy || !code.trim()} className="w-full h-14 rounded-xl bg-blue-600 text-white font-semibold text-[16px] flex items-center justify-center gap-2 disabled:opacity-50"><ScanLine className="h-6 w-6" /> Look Up</button>
      </div>
      {msg && <div className={`rounded-xl px-4 py-3 text-[14px] ${msg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>{msg.text}</div>}
      {result?.item && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <p className="font-semibold text-slate-800">{result.item.garmentName}</p>
          <p className="text-[13px] text-slate-500">{result.item.serviceName} · {result.order?.orderNumber}</p>
          <p className="text-[12px] text-slate-400">Stage: {statusLabel(result.item.processingStage)} · {result.item.processingStatus}</p>
          <button onClick={process} disabled={busy} className="w-full h-12 mt-1 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Process at this Workstation"}</button>
        </div>
      )}
    </div>
  )
}

function CreateSheet({ staff, api, onClose, onCreated }: { staff: Staff; api: Api; onClose: () => void; onCreated: () => void }) {
  const [kind, setKind] = useState<"pickup" | "walkin">("pickup")
  const [name, setName] = useState(""); const [mobile, setMobile] = useState("")
  const [address, setAddress] = useState(""); const [date, setDate] = useState(""); const [slot, setSlot] = useState(""); const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)

  const submitPickup = async () => {
    setErr(null); setBusy(true)
    try {
      const j = await api("/api/laundry/dispatch/pickup", { method: "POST", body: JSON.stringify({
        businessId: staff.businessId, customerData: { name, phone: mobile || null },
        pickupAddress: address || null, pickupDate: date || null, pickupTimeSlot: slot || null, notes: notes || null,
      }) })
      if (!j.success) throw new Error(j.error || "Failed")
      onCreated()
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end" onClick={onClose}>
      <div className="w-full bg-white rounded-t-2xl p-4 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-800">New Order</h3><button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button></div>
        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 rounded-xl p-1">
          <button onClick={() => setKind("pickup")} className={`h-9 rounded-lg text-[13px] font-medium ${kind === "pickup" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Home Pickup</button>
          <button onClick={() => setKind("walkin")} className={`h-9 rounded-lg text-[13px] font-medium ${kind === "walkin" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Walk-in</button>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" className="w-full h-12 rounded-xl border border-slate-200 px-4 text-[15px]" />
        <input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" placeholder="Mobile" className="w-full h-12 rounded-xl border border-slate-200 px-4 text-[15px]" />
        {kind === "pickup" ? (
          <>
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400 shrink-0" /><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Pickup address" className="w-full h-12 rounded-xl border border-slate-200 px-4 text-[15px]" /></div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl border border-slate-200 px-3 text-[14px]" />
              <input value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="Time slot" className="h-12 rounded-xl border border-slate-200 px-3 text-[14px]" />
            </div>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instructions (optional)" className="w-full h-12 rounded-xl border border-slate-200 px-4 text-[15px]" />
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <button onClick={submitPickup} disabled={busy || !name.trim()} className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Pickup — appears in Dispatch"}</button>
          </>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-800">Walk-in garment intake with services &amp; pricing is best completed at the counter station; this quick form creates the customer + a pickup-free order. Full mobile garment/pricing selection lands in the next update.</div>
        )}
      </div>
    </div>
  )
}

function Profile({ staff, onLogout }: { staff: Staff; onLogout: () => void }) {
  return (
    <div className="px-4 pt-6 space-y-4">
      <Header staff={staff} />
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-[13px]">
        <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="font-medium text-slate-700">{staff.name}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Role</span><span className="font-medium text-slate-700">{staff.roleName}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Store</span><span className="font-medium text-slate-700">{staff.storeName}</span></div>
        {staff.storeCode && <div className="flex justify-between"><span className="text-slate-400">Code</span><span className="font-mono text-slate-700">{staff.storeCode}</span></div>}
      </div>
      <button onClick={onLogout} className="w-full h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-semibold flex items-center justify-center gap-2"><LogOut className="h-5 w-5" /> Sign Out</button>
    </div>
  )
}
