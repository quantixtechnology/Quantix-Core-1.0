"use client"

// ── Commerce Store Admin PWA (Phase 2: operational modules) ───────────────────
// A mobile operational interface for the EXISTING Commerce Admin Portal. It owns
// NO business logic — every screen calls the SAME /api/core/* services with the
// commerce access token (+ x-business-id); store scope + pricing + the state
// machine are all enforced server-side. No duplicate models, APIs or workflows.

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Store, LogOut, Loader2, ClipboardList, Clock, ChefHat, PackageCheck, Truck, CheckCircle2,
  Wallet, Users, LayoutGrid, User, Search, ChevronLeft, Phone, PlusCircle, X, RefreshCw, XCircle,
} from "lucide-react"

const TOKEN_KEY = "qx_commerce_store_token"
const USER_KEY = "qx_commerce_store_user"

interface Tenant { platformBusinessId: string; name: string; logo: string | null; primaryColor: string }
interface SessionUser { name: string; role: string; businessId: string; businessName?: string; storeId?: string | null }
type Tab = "home" | "orders" | "packing" | "dispatch" | "profile"

const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() }
const inr = (n: number) => `₹${(n || 0).toFixed(0)}`
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending", CONFIRMED: "Confirmed", PREPARING: "Preparing", READY_FOR_PICKUP: "Ready for Pickup",
  READY_FOR_DELIVERY: "Ready for Delivery", OUT_FOR_DELIVERY: "Out for Delivery", DELIVERED: "Delivered",
  CANCELLED: "Cancelled", REFUNDED: "Refunded", PICKED_UP: "Picked Up", PROCESSING: "Processing", SCHEDULED: "Scheduled",
}

export function CommerceStoreApp({ tenant }: { tenant: Tenant }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [booting, setBooting] = useState(true)
  const [tab, setTab] = useState<Tab>("home")
  const [online, setOnline] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [ordersStatus, setOrdersStatus] = useState<string>("")
  const [showCreate, setShowCreate] = useState(false)

  const [email, setEmail] = useState(""); const [password, setPassword] = useState("")
  const [loggingIn, setLoggingIn] = useState(false); const [error, setError] = useState<string | null>(null)

  const api = useCallback(async (path: string, init: RequestInit = {}, tk?: string, biz?: string) => {
    const res = await fetch(path, { ...init, headers: { ...(init.headers || {}), "Content-Type": "application/json", Authorization: `Bearer ${tk ?? token}`, "x-business-id": biz ?? user?.businessId ?? tenant.platformBusinessId } })
    return res.json().catch(() => ({}))
  }, [token, user, tenant.platformBusinessId])

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
  const logout = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); setToken(null); setUser(null) }
  const goOrders = (status: string) => { setOrdersStatus(status); setTab("orders") }

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

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {openId ? (
        <OrderDetail id={openId} tenant={tenant} api={api} onBack={() => setOpenId(null)} />
      ) : (
        <>
          {tab === "home" && <Dashboard tenant={tenant} user={user} api={api} online={online} onCounter={goOrders} />}
          {tab === "orders" && <Orders tenant={tenant} api={api} status={ordersStatus} setStatus={setOrdersStatus} onOpen={setOpenId} />}
          {(tab === "packing" || tab === "dispatch") && (
            <div className="py-24 text-center text-slate-400"><p className="text-sm capitalize">{tab}</p><p className="text-[12px] mt-1">Arrives in the next slice — reusing the packing / delivery-dispatch engines.</p></div>
          )}
          {tab === "profile" && (
            <div className="px-4 pt-6 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-[13px]">
                <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="font-medium text-slate-700">{user.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Role</span><span className="font-medium text-slate-700">{user.role}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Business</span><span className="font-medium text-slate-700">{user.businessName || tenant.name}</span></div>
              </div>
              <button onClick={logout} className="w-full h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-semibold flex items-center justify-center gap-2"><LogOut className="h-5 w-5" /> Sign Out</button>
            </div>
          )}
        </>
      )}

      {showCreate && <CreateSheet tenant={tenant} user={user} api={api} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setTab("orders"); setOrdersStatus("") }} />}

      {!openId && (
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 grid grid-cols-5 z-30">
          {([["home", "Home", LayoutGrid], ["orders", "Orders", ClipboardList], ["packing", "Packing", PackageCheck], ["dispatch", "Dispatch", Truck], ["profile", "Profile", User]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className="flex flex-col items-center gap-0.5 py-2" style={{ color: tab === k ? tenant.primaryColor : "#94a3b8" }}>
              <Icon className="h-5 w-5" /><span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </nav>
      )}
      {!openId && (tab === "home" || tab === "orders") && (
        <button onClick={() => setShowCreate(true)} className="fixed bottom-20 right-4 h-14 w-14 rounded-full text-white shadow-lg flex items-center justify-center z-30" style={{ backgroundColor: tenant.primaryColor }}><PlusCircle className="h-7 w-7" /></button>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = (path: string, init?: RequestInit, tk?: string, biz?: string) => Promise<any>

function Dashboard({ tenant, user, api, online, onCounter }: { tenant: Tenant; user: SessionUser; api: Api; online: boolean; onCounter: (s: string) => void }) {
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
    // Revenue: sum today's order totals (store-scoped list; a page is enough for a day's volume).
    const rev = await api(`/api/core/orders?businessId=${biz}&limit=200&${today}`)
    setRevenue(Array.isArray(rev?.data) ? rev.data.reduce((s: number, o: { totalAmount?: number }) => s + (o.totalAmount || 0), 0) : 0)
    setLoading(false)
  }, [api, biz])
  useEffect(() => { load() }, [load])

  const tiles: { label: string; key: string; icon: React.ComponentType<{ className?: string }>; status: string }[] = [
    { label: "Today's Orders", key: "todays", icon: ClipboardList, status: "" },
    { label: "Pending", key: "pending", icon: Clock, status: "PENDING" },
    { label: "Preparing", key: "preparing", icon: ChefHat, status: "CONFIRMED,PREPARING" },
    { label: "Ready for Pickup", key: "readyPickup", icon: PackageCheck, status: "READY_FOR_PICKUP" },
    { label: "Ready for Delivery", key: "readyDelivery", icon: PackageCheck, status: "READY_FOR_DELIVERY" },
    { label: "Out for Delivery", key: "ofd", icon: Truck, status: "OUT_FOR_DELIVERY" },
    { label: "Delivered Today", key: "delivered", icon: CheckCircle2, status: "DELIVERED" },
    { label: "Cancelled", key: "cancelled", icon: XCircle, status: "CANCELLED" },
  ]
  return (
    <>
      <header className="text-white px-4 pt-5 pb-6 rounded-b-2xl" style={{ backgroundColor: tenant.primaryColor }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden">{tenant.logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={tenant.logo} alt="" className="h-full w-full object-contain" /> : <Store className="h-5 w-5" style={{ color: tenant.primaryColor }} />}</div>
            <div className="min-w-0"><p className="text-[15px] font-bold truncate leading-tight">{tenant.name}</p><p className="text-[12px] text-white/80 truncate">{user.businessName || "Store"} · {user.role}</p></div>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${online ? "bg-white/20" : "bg-amber-400/30"}`}><span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-300" : "bg-amber-300"}`} />{online ? "Online" : "Offline"}</span>
        </div>
        <div className="mt-3 bg-white/15 rounded-xl px-3 py-2 flex items-center justify-between">
          <span className="text-[12px] text-white/80">Revenue Today</span><span className="text-lg font-bold">{inr(revenue)}</span>
        </div>
      </header>
      <main className="px-4 -mt-3 space-y-4">
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
          <div className="flex items-center justify-between mb-2 px-1"><h2 className="text-[13px] font-semibold text-slate-700">Today at a glance</h2><button onClick={load} className="text-slate-400"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button></div>
          <div className="grid grid-cols-2 gap-2">
            {tiles.map((t) => { const Icon = t.icon; return (
              <button key={t.key} onClick={() => onCounter(t.status)} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between"><Icon className="h-4 w-4 text-slate-400" /><span className="text-xl font-bold tabular-nums text-slate-800">{loading ? "—" : (counts[t.key] ?? 0)}</span></div>
                <p className="text-[11px] mt-1 font-medium text-slate-600 leading-tight">{t.label}</p>
              </button>
            )})}
          </div>
        </section>
      </main>
    </>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Orders({ tenant, api, status, setStatus, onOpen }: { tenant: Tenant; api: Api; status: string; setStatus: (s: string) => void; onOpen: (id: string) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orders, setOrders] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [q, setQ] = useState("")
  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams({ limit: "50" }); if (status) p.set("status", status); if (q.trim()) p.set("search", q.trim())
    api(`/api/core/orders?${p}`).then((j) => { if (j.success) setOrders(j.data || []) }).finally(() => setLoading(false))
  }, [api, status, q])
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [load, q])
  const chips = [["", "All"], ["PENDING", "Pending"], ["CONFIRMED,PREPARING", "Preparing"], ["READY_FOR_PICKUP", "Ready Pickup"], ["OUT_FOR_DELIVERY", "Out for Delivery"], ["DELIVERED", "Delivered"], ["CANCELLED", "Cancelled"]] as const
  return (
    <div className="px-3 pt-3 space-y-3">
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order # / customer / phone" className="w-full h-11 pl-9 rounded-xl border border-slate-200 bg-white text-[15px]" /></div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">{chips.map(([v, l]) => (<button key={v} onClick={() => setStatus(v)} className={`shrink-0 px-3 h-8 rounded-full text-[12px] font-medium border ${status === v ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200"}`} style={status === v ? { backgroundColor: tenant.primaryColor } : undefined}>{l}</button>))}</div>
      {loading ? <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin inline" style={{ color: tenant.primaryColor }} /></div>
        : orders.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">No orders.</p>
        : <div className="space-y-2">{orders.map((o) => (
            <button key={o.id} onClick={() => onOpen(o.id)} className="w-full text-left bg-white rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between"><span className="font-mono font-bold text-[13px] text-slate-800">{o.orderNumber}</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{STATUS_LABEL[o.status] || o.status}</span></div>
              <div className="flex items-center justify-between mt-1 text-[12px] text-slate-500"><span className="truncate">{o.customerName || o.customer?.name || "—"}</span><span className="font-semibold text-slate-700">{inr(o.totalAmount)}</span></div>
            </button>
          ))}</div>}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OrderDetail({ id, tenant, api, onBack }: { id: string; tenant: Tenant; api: Api; onBack: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [order, setOrder] = useState<any>(null); const [loading, setLoading] = useState(true)
  useEffect(() => { api(`/api/core/orders/${id}`).then((j) => { if (j.success) setOrder(j.data) }).finally(() => setLoading(false)) }, [api, id])
  if (loading || !order) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: tenant.primaryColor }} /></div>
  const phone = order.customerPhone || order.customer?.phone
  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-white border-b border-slate-200 px-3 py-3 flex items-center gap-2 sticky top-0 z-20">
        <button onClick={onBack} className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center"><ChevronLeft className="h-5 w-5" /></button>
        <div className="min-w-0"><p className="font-mono font-bold text-[14px] text-slate-800 truncate">{order.orderNumber}</p><p className="text-[11px] text-slate-400">{STATUS_LABEL[order.status] || order.status}</p></div>
      </header>
      <div className="p-3 space-y-3">
        <div className="rounded-xl p-3 text-white" style={{ backgroundColor: tenant.primaryColor }}><p className="text-[10px] uppercase text-white/70">Current Status</p><p className="text-[17px] font-bold">{STATUS_LABEL[order.status] || order.status}</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
          <div className="flex items-center gap-2 text-[14px] font-medium"><User className="h-4 w-4 text-slate-400" />{order.customerName || order.customer?.name || "—"}</div>
          {phone && <div className="flex items-center gap-2"><span className="flex-1 flex items-center gap-2 text-[13px] text-slate-500"><Phone className="h-4 w-4 text-slate-400" />{phone}</span>
            <a href={`tel:${phone}`} className="h-9 px-3 rounded-lg bg-slate-50 text-slate-700 text-[12px] font-medium flex items-center gap-1"><Phone className="h-3.5 w-3.5" />Call</a>
            <a href={`https://wa.me/${String(phone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-[12px] font-medium">WhatsApp</a></div>}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[13px]"><span className="text-slate-500">{order.orderType} · {order.paymentStatus || order.payment?.status || "—"}</span><span className="font-bold text-slate-800">{inr(order.totalAmount)}</span></div>
        </div>
        {Array.isArray(order.items) && order.items.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-3"><p className="text-[12px] font-semibold text-slate-600 mb-2">Items ({order.items.length})</p>
            <div className="space-y-1">{order.items.map((it: { id: string; itemName: string; quantity: number; unitPrice: number }) => (<div key={it.id} className="flex items-center justify-between text-[12px]"><span className="text-slate-700">{it.quantity} × {it.itemName}</span><span className="text-slate-500">{inr(it.unitPrice * it.quantity)}</span></div>))}</div>
          </div>
        )}
        {order.deliveryAddress && <div className="bg-white rounded-xl border border-slate-200 p-3 text-[12px] text-slate-600"><p className="font-semibold text-slate-500 mb-1">Delivery Address</p>{typeof order.deliveryAddress === "string" ? order.deliveryAddress : order.deliveryAddress?.addressLine1}</div>}
      </div>
    </div>
  )
}

function CreateSheet({ tenant, user, api, onClose, onCreated }: { tenant: Tenant; user: SessionUser; api: Api; onClose: () => void; onCreated: () => void }) {
  const [orderType, setOrderType] = useState("STORE_PICKUP")
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
        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 rounded-xl p-1">{["STORE_PICKUP", "DELIVERY"].map((t) => (<button key={t} onClick={() => setOrderType(t)} className={`h-9 rounded-lg text-[13px] font-medium ${orderType === t ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>{t === "STORE_PICKUP" ? "Store Pickup" : "Home Delivery"}</button>))}</div>
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
