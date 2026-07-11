"use client"

// Laundry Customer App — a self-contained mobile PWA-style client that consumes
// the /api/laundry/app/* endpoints. Mobile OTP auth, profile, addresses,
// subscription, place order, live tracking, invoice and history. It builds no
// business logic — every number comes from the frozen engines via the API.

import { useCallback, useEffect, useState } from "react"
import { Loader2, Home, ShoppingBag, Repeat, User, Package, LogOut, ChevronRight, MapPin, Plus, Minus, CheckCircle2, Clock } from "lucide-react"

const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`
type View = "home" | "order" | "subscription" | "orders" | "orderDetail" | "profile"
interface Me { id: string; name: string; phone: string; email: string | null; customerCode: string; walletBalance: number; company?: string | null; comm?: Record<string, boolean>; addresses: Addr[]; stats: Stats; subscription: { id: string; planName: string; status: string; remainingKg: number; remainingPieces: number; expiry: string } | null }
interface Stats { totalOrders: number; completed: number; cancelled: number; grossValue: number; outstanding: number; avgOrderValue: number }
interface Addr { id: string; addressType?: string; addressLine1: string; addressLine2: string | null; area: string | null; landmark: string | null; city: string; state: string; pincode: string; isDefault?: boolean; isPickupDefault?: boolean; isDeliveryDefault?: boolean }
interface Garment { garmentId: string; name: string; price: number; pricingType: string }
interface Service { id: string; name: string; description: string | null; garments: Garment[] }
interface OrderRow { id: string; orderNumber: string; status: string; grandTotal: number; balanceDue: number; subscriptionCoveredAmount: number; paymentStatus: string; itemCount: number; createdAt: string }

export function LaundryCustomerApp() {
  const [token, setToken] = useState<string | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState("Laundry")
  const [booting, setBooting] = useState(true)
  const [view, setView] = useState<View>("home")
  const [me, setMe] = useState<Me | null>(null)
  const [selected, setSelected] = useState<string>("")

  const api = useCallback(async (path: string, opts: RequestInit = {}) => {
    const res = await fetch(`/api/laundry/app${path}`, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) } })
    return res.json().catch(() => ({}))
  }, [token])

  // Bootstrap: tenant config + stored token.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("laundryAppToken") : null
    fetch(`/api/laundry/app/config`).then((r) => r.json()).then((j) => { if (j.data) { setBusinessId(j.data.businessId); setTenantName(j.data.name) } }).finally(() => { setToken(stored); setBooting(false) })
  }, [])

  const loadMe = useCallback(async () => { const j = await api("/me"); if (j.success) setMe(j.data); else { setToken(null); localStorage.removeItem("laundryAppToken") } }, [api])
  useEffect(() => { if (token) loadMe() }, [token, loadMe])

  const onLogin = (t: string) => { localStorage.setItem("laundryAppToken", t); setToken(t); setView("home") }
  const logout = async () => { await api("/auth/sessions", { method: "DELETE" }); localStorage.removeItem("laundryAppToken"); setToken(null); setMe(null) }

  if (booting) return <Center><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></Center>
  if (!token) return <LoginScreen businessId={businessId} tenantName={tenantName} onLogin={onLogin} />
  if (!me) return <Center><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></Center>

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto flex flex-col">
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div><p className="text-[11px] opacity-80">{tenantName}</p><p className="font-semibold leading-tight">Hi, {me.name.split(" ")[0]}</p></div>
        <button onClick={logout} className="text-white/80 hover:text-white"><LogOut className="h-5 w-5" /></button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {view === "home" && <HomeView me={me} go={setView} />}
        {view === "order" && <OrderView api={api} onPlaced={() => { loadMe(); setView("orders") }} />}
        {view === "subscription" && <SubscriptionView api={api} />}
        {view === "orders" && <OrdersView api={api} open={(id) => { setSelected(id); setView("orderDetail") }} />}
        {view === "orderDetail" && selected && <OrderDetailView api={api} id={selected} back={() => setView("orders")} />}
        {view === "profile" && <ProfileView me={me} api={api} reload={loadMe} logout={logout} />}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t flex justify-around py-1.5">
        {([["home", Home, "Home"], ["order", Plus, "Order"], ["subscription", Repeat, "Plan"], ["orders", Package, "Orders"], ["profile", User, "Profile"]] as const).map(([v, Icon, label]) => (
          <button key={v} onClick={() => setView(v)} className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] ${view === v ? "text-blue-600" : "text-slate-400"}`}><Icon className="h-5 w-5" /> {label}</button>
        ))}
      </nav>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) { return <div className="min-h-screen flex items-center justify-center bg-slate-50">{children}</div> }

function LoginScreen({ businessId, tenantName, onLogin }: { businessId: string | null; tenantName: string; onLogin: (t: string) => void }) {
  const [mobile, setMobile] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"mobile" | "otp">("mobile")
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const send = async () => {
    if (mobile.replace(/\D/g, "").length !== 10) { setErr("Enter a 10-digit mobile number"); return }
    setBusy(true); setErr("")
    const j = await fetch("/api/laundry/app/auth/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, mobile }) }).then((r) => r.json())
    setBusy(false)
    if (j.error) { setErr(j.error); return }
    setDevCode(j.data?.devCode || null); setStep("otp")
  }
  const verify = async () => {
    setBusy(true); setErr("")
    const j = await fetch("/api/laundry/app/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, mobile, code, device: navigator.userAgent.slice(0, 60) }) }).then((r) => r.json())
    setBusy(false)
    if (j.error) { setErr(j.error); return }
    onLogin(j.data.token)
  }

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto flex flex-col justify-center px-6">
      <div className="text-center mb-8"><div className="h-14 w-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-3"><ShoppingBag className="h-7 w-7" /></div><h1 className="text-xl font-bold text-slate-800">{tenantName}</h1><p className="text-sm text-slate-400">Sign in with your mobile number</p></div>
      {step === "mobile" ? (
        <div className="space-y-3">
          <input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="Mobile number" className="w-full h-12 rounded-xl border border-slate-200 px-4 text-lg tracking-wide" />
          <button onClick={send} disabled={busy || !businessId} className="w-full h-12 rounded-xl bg-blue-600 text-white font-medium flex items-center justify-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Send OTP</button>
        </div>
      ) : (
        <div className="space-y-3">
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit OTP" className="w-full h-12 rounded-xl border border-slate-200 px-4 text-lg tracking-[0.3em] text-center" />
          {devCode && <p className="text-center text-xs text-amber-600">Dev OTP: <span className="font-mono font-bold">{devCode}</span> (SMS not configured)</p>}
          <button onClick={verify} disabled={busy || code.length !== 6} className="w-full h-12 rounded-xl bg-blue-600 text-white font-medium flex items-center justify-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify &amp; Continue</button>
          <button onClick={() => { setStep("mobile"); setCode("") }} className="w-full text-sm text-slate-400">Change number</button>
        </div>
      )}
      {err && <p className="text-center text-sm text-rose-600 mt-3">{err}</p>}
    </div>
  )
}

function HomeView({ me, go }: { me: Me; go: (v: View) => void }) {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[{ l: "Orders", v: me.stats.totalOrders }, { l: "Completed", v: me.stats.completed }, { l: "Outstanding", v: inr(me.stats.outstanding) }].map((s) => (
          <div key={s.l} className="rounded-xl bg-white border border-slate-100 p-3"><p className="text-[10px] uppercase text-slate-400">{s.l}</p><p className="text-lg font-bold text-slate-800">{s.v}</p></div>
        ))}
      </div>
      {me.subscription ? (
        <button onClick={() => go("subscription")} className="w-full text-left rounded-xl bg-blue-600 text-white p-4">
          <div className="flex items-center justify-between"><p className="font-semibold flex items-center gap-1.5"><Repeat className="h-4 w-4" /> {me.subscription.planName}</p><ChevronRight className="h-4 w-4 opacity-70" /></div>
          <div className="mt-2 flex gap-3 text-sm opacity-90">{me.subscription.remainingKg > 0 && <span>{me.subscription.remainingKg} KG left</span>}{me.subscription.remainingPieces > 0 && <span>{me.subscription.remainingPieces} pieces left</span>}</div>
        </button>
      ) : (
        <div className="rounded-xl bg-white border border-slate-100 p-4 text-center text-sm text-slate-400">No active subscription</div>
      )}
      <button onClick={() => go("order")} className="w-full h-14 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2"><Plus className="h-5 w-5" /> Place New Order</button>
      <button onClick={() => go("orders")} className="w-full h-12 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium flex items-center justify-center gap-2"><Package className="h-5 w-5" /> Track My Orders</button>
    </div>
  )
}

function OrderView({ api, onPlaced }: { api: (p: string, o?: RequestInit) => Promise<{ success?: boolean; data?: { services: Service[] } | unknown; error?: string; subscription?: { coveredAmount: number } }>; onPlaced: () => void }) {
  const [services, setServices] = useState<Service[]>([])
  const [cart, setCart] = useState<Record<string, { serviceId: string; garmentId: string; name: string; price: number; qty: number }>>({})
  const [quote, setQuote] = useState<{ grandTotal: number; coveredAmount: number; extraAmount: number } | null>(null)
  const [pickupDate, setPickupDate] = useState("")
  const [instructions, setInstructions] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")

  useEffect(() => { api("/catalog").then((j) => { if (j.success) setServices((j.data as { services: Service[] }).services) }) }, [api])
  const items = Object.values(cart).filter((c) => c.qty > 0)
  useEffect(() => {
    if (items.length === 0) { setQuote(null); return }
    const t = setTimeout(async () => { const j = await api("/quote", { method: "POST", body: JSON.stringify({ items: items.map((i) => ({ serviceId: i.serviceId, garmentId: i.garmentId, quantity: i.qty })) }) }); if (j.success) setQuote(j.data as { grandTotal: number; coveredAmount: number; extraAmount: number }) }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items)])

  const bump = (s: Service, g: Garment, d: number) => setCart((c) => { const key = `${s.id}:${g.garmentId}`; const cur = c[key]?.qty || 0; const qty = Math.max(0, cur + d); return { ...c, [key]: { serviceId: s.id, garmentId: g.garmentId, name: g.name, price: g.price, qty } } })
  const place = async () => {
    setBusy(true); setMsg("")
    const j = await api("/orders", { method: "POST", body: JSON.stringify({ orderType: "HOME_PICKUP", items: items.map((i) => ({ serviceId: i.serviceId, garmentId: i.garmentId, quantity: i.qty })), pickupDate: pickupDate || null, specialInstructions: instructions || null }) })
    setBusy(false)
    if (j.error) { setMsg(j.error); return }
    onPlaced()
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-slate-800">Place an Order</h2>
      {services.map((s) => (
        <div key={s.id} className="rounded-xl bg-white border border-slate-100 p-3">
          <p className="font-medium text-slate-700 text-sm mb-2">{s.name}</p>
          <div className="space-y-1.5">
            {s.garments.map((g) => { const qty = cart[`${s.id}:${g.garmentId}`]?.qty || 0; return (
              <div key={g.garmentId} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{g.name} <span className="text-slate-400 text-xs">{inr(g.price)}{g.pricingType === "PER_KG" ? "/kg" : ""}</span></span>
                <div className="flex items-center gap-2">
                  <button onClick={() => bump(s, g, -1)} className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="w-5 text-center text-sm font-medium">{qty}</span>
                  <button onClick={() => bump(s, g, 1)} className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center"><Plus className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ) })}
          </div>
        </div>
      ))}
      {items.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-100 p-3 space-y-2">
          <div className="space-y-1"><label className="text-xs text-slate-400">Pickup date</label><input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /></div>
          <div className="space-y-1"><label className="text-xs text-slate-400">Instructions</label><input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Separate whites" className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /></div>
          {quote && <div className="border-t pt-2 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Estimated</span><span className="font-medium">{inr(quote.grandTotal)}</span></div>
            {quote.coveredAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Covered by subscription</span><span>− {inr(quote.coveredAmount)}</span></div>}
            <div className="flex justify-between font-bold text-slate-800"><span>You pay</span><span>{inr(quote.extraAmount)}</span></div>
          </div>}
          <button onClick={place} disabled={busy} className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit Order</button>
          {msg && <p className="text-xs text-rose-600 text-center">{msg}</p>}
        </div>
      )}
    </div>
  )
}

function SubscriptionView({ api }: { api: (p: string, o?: RequestInit) => Promise<{ success?: boolean; data?: unknown }> }) {
  const [data, setData] = useState<{ active: { planName: string; status: string; remainingKg: number; allowanceKg: number; remainingPieces: number; allowancePieces: number; expiry: string; renewalDate: string; autoRenew: boolean; eligibleServices: string[] } | null; ledger?: { at: string; type: string; unit: string; delta: number; balanceAfter: number; note: string | null }[] } | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { api("/subscription").then((j) => setData(j.data as never)).finally(() => setLoading(false)) }, [api])
  if (loading) return <Center><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></Center>
  const a = data?.active
  if (!a) return <div className="p-6 text-center text-slate-400">No active subscription.</div>
  return (
    <div className="p-4 space-y-4">
      <div className="rounded-xl bg-blue-600 text-white p-4">
        <div className="flex items-center justify-between"><p className="font-semibold">{a.planName}</p><span className="text-[11px] bg-white/20 rounded px-2 py-0.5">{a.status === "GRACE" ? "In Grace" : "Active"}</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {a.allowanceKg > 0 && <div className="bg-white/10 rounded-lg p-2"><p className="text-xs opacity-80">Weight</p><p className="font-bold">{a.remainingKg} / {a.allowanceKg} KG</p></div>}
          {a.allowancePieces > 0 && <div className="bg-white/10 rounded-lg p-2"><p className="text-xs opacity-80">Pieces</p><p className="font-bold">{a.remainingPieces} / {a.allowancePieces}</p></div>}
        </div>
        <p className="mt-3 text-xs opacity-80">Expires {new Date(a.expiry).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · {a.autoRenew ? "Auto-renews" : "Manual renewal"}</p>
      </div>
      {a.eligibleServices.length > 0 && <div className="rounded-xl bg-white border border-slate-100 p-3"><p className="text-xs text-slate-400 mb-1">Eligible services</p><div className="flex flex-wrap gap-1">{a.eligibleServices.map((s) => <span key={s} className="text-xs bg-slate-100 rounded px-2 py-0.5 text-slate-600">{s}</span>)}</div></div>}
      <div className="rounded-xl bg-white border border-slate-100 p-3">
        <p className="text-sm font-medium text-slate-700 mb-2">Consumption History</p>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {(data?.ledger || []).map((l, i) => (
            <div key={i} className="flex items-center justify-between text-xs border-b border-slate-50 pb-1">
              <div><p className="text-slate-600 capitalize">{l.type.toLowerCase()} · {l.unit}</p><p className="text-[10px] text-slate-400">{new Date(l.at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{l.note ? ` · ${l.note}` : ""}</p></div>
              <span className={l.delta < 0 ? "text-rose-600" : "text-emerald-600"}>{l.delta > 0 ? "+" : ""}{l.delta} → {l.balanceAfter}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function OrdersView({ api, open }: { api: (p: string, o?: RequestInit) => Promise<{ success?: boolean; data?: unknown }>; open: (id: string) => void }) {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api("/orders").then((j) => setOrders((j.data as OrderRow[]) || [])).finally(() => setLoading(false)) }, [api])
  if (loading) return <Center><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></Center>
  if (orders.length === 0) return <div className="p-6 text-center text-slate-400">No orders yet.</div>
  return (
    <div className="p-4 space-y-2">
      {orders.map((o) => (
        <button key={o.id} onClick={() => open(o.id)} className="w-full text-left rounded-xl bg-white border border-slate-100 p-3 flex items-center justify-between">
          <div><p className="font-medium text-slate-800 text-sm font-mono">{o.orderNumber}</p><p className="text-[11px] text-slate-400">{o.itemCount} items · {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p><span className="inline-block mt-1 text-[10px] rounded px-2 py-0.5 bg-blue-50 text-blue-700">{o.status.replace(/_/g, " ")}</span></div>
          <div className="text-right"><p className="font-bold text-slate-800">{inr(o.grandTotal)}</p>{o.balanceDue > 0 ? <p className="text-[11px] text-rose-600">{inr(o.balanceDue)} due</p> : <p className="text-[11px] text-emerald-600">Settled</p>}</div>
        </button>
      ))}
    </div>
  )
}

function OrderDetailView({ api, id, back }: { api: (p: string, o?: RequestInit) => Promise<{ success?: boolean; data?: unknown }>; id: string; back: () => void }) {
  const [d, setD] = useState<{ order: { orderNumber: string; status: string }; items: { garmentName: string; serviceName: string; quantity: number }[]; tracking: { label: string; done: boolean; current: boolean }[]; cancelled: boolean; invoice: { total: number; subscriptionCovered: number; paid: number; balance: number; paymentStatus: string; payments: { method: string; amount: number }[] } } | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { api(`/orders/${id}`).then((j) => setD(j.data as never)).finally(() => setLoading(false)) }, [api, id])
  if (loading) return <Center><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></Center>
  if (!d) return <div className="p-6 text-center text-slate-400">Order not found.</div>
  return (
    <div className="p-4 space-y-4">
      <button onClick={back} className="text-sm text-blue-600">← Back to orders</button>
      <div><p className="font-mono font-semibold text-slate-800">{d.order.orderNumber}</p></div>
      {/* Live tracking */}
      <div className="rounded-xl bg-white border border-slate-100 p-3">
        <p className="text-sm font-medium text-slate-700 mb-3">Tracking</p>
        {d.cancelled ? <p className="text-rose-600 text-sm">Order cancelled</p> : (
          <div className="space-y-0">
            {d.tracking.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  {t.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : t.current ? <Clock className="h-5 w-5 text-blue-600" /> : <div className="h-5 w-5 rounded-full border-2 border-slate-200" />}
                  {i < d.tracking.length - 1 && <div className={`w-0.5 h-5 ${t.done ? "bg-emerald-300" : "bg-slate-100"}`} />}
                </div>
                <span className={`text-sm ${t.current ? "font-semibold text-blue-700" : t.done ? "text-slate-700" : "text-slate-400"}`}>{t.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Items */}
      <div className="rounded-xl bg-white border border-slate-100 p-3"><p className="text-sm font-medium text-slate-700 mb-2">Garments</p>{d.items.map((it, i) => <div key={i} className="flex justify-between text-sm text-slate-600 py-0.5"><span>{it.garmentName} · {it.serviceName}</span><span>×{it.quantity}</span></div>)}</div>
      {/* Invoice (Phase 7) */}
      <div className="rounded-xl bg-white border border-slate-100 p-3 text-sm space-y-1">
        <p className="text-sm font-medium text-slate-700 mb-1">Invoice</p>
        <div className="flex justify-between"><span className="text-slate-500">Total</span><span>{inr(d.invoice.total)}</span></div>
        {d.invoice.subscriptionCovered > 0 && <div className="flex justify-between text-emerald-600"><span>Subscription covered</span><span>− {inr(d.invoice.subscriptionCovered)}</span></div>}
        <div className="flex justify-between"><span className="text-slate-500">Paid</span><span>{inr(d.invoice.paid)}</span></div>
        <div className="flex justify-between font-bold text-slate-800 border-t pt-1"><span>Balance</span><span className={d.invoice.balance > 0 ? "text-rose-600" : "text-emerald-600"}>{inr(d.invoice.balance)}</span></div>
        <p className="text-[11px] text-slate-400 pt-1">Status: {d.invoice.paymentStatus}</p>
      </div>
    </div>
  )
}

function ProfileView({ me, api, reload, logout }: { me: Me; api: (p: string, o?: RequestInit) => Promise<{ success?: boolean; data?: unknown }>; reload: () => void; logout: () => void }) {
  const [name, setName] = useState(me.name)
  const [email, setEmail] = useState(me.email || "")
  const [company, setCompany] = useState(me.company || "")
  const [comm, setComm] = useState<Record<string, boolean>>(me.comm || {})
  const [saving, setSaving] = useState(false)
  const [addrOpen, setAddrOpen] = useState(false)
  const [addr, setAddr] = useState({ addressType: "HOME", addressLine1: "", city: "", state: "", pincode: "", landmark: "" })

  const save = async () => { setSaving(true); await api("/me", { method: "PUT", body: JSON.stringify({ name, email, company, comm }) }); setSaving(false); reload() }
  const addAddress = async () => { await api("/addresses", { method: "POST", body: JSON.stringify(addr) }); setAddrOpen(false); setAddr({ addressType: "HOME", addressLine1: "", city: "", state: "", pincode: "", landmark: "" }); reload() }
  const delAddress = async (id: string) => { await api(`/addresses/${id}`, { method: "DELETE" }); reload() }

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-xl bg-white border border-slate-100 p-3 space-y-2">
        <p className="text-sm font-medium text-slate-700">Profile</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" />
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" />
        <div><p className="text-xs text-slate-400 mb-1">Notifications</p><div className="flex flex-wrap gap-1.5">{["sms", "whatsapp", "email", "push", "marketing"].map((k) => <button key={k} onClick={() => setComm((c) => ({ ...c, [k]: !c[k] }))} className={`text-xs capitalize rounded-full px-2.5 py-1 border ${comm[k] ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400"}`}>{k}</button>)}</div></div>
        <button onClick={save} disabled={saving} className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Profile</button>
        <p className="text-[11px] text-slate-400 text-center">Notification preferences apply when order updates, pickup reminders, delivery updates and renewal alerts are sent.</p>
      </div>

      <div className="rounded-xl bg-white border border-slate-100 p-3 space-y-2">
        <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-700">Saved Addresses</p><button onClick={() => setAddrOpen((o) => !o)} className="text-xs text-blue-600">{addrOpen ? "Cancel" : "+ Add"}</button></div>
        {me.addresses.map((a) => (
          <div key={a.id} className="rounded-lg border border-slate-100 p-2 flex items-start justify-between">
            <div className="text-xs"><div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-400" /><span className="font-medium text-slate-700">{a.addressType || "HOME"}</span>{a.isDefault && <span className="text-[9px] text-emerald-600">Default</span>}{a.isPickupDefault && <span className="text-[9px] text-blue-600">Pickup</span>}{a.isDeliveryDefault && <span className="text-[9px] text-violet-600">Delivery</span>}</div><p className="text-slate-500 mt-0.5">{a.addressLine1}, {a.city} {a.pincode}</p></div>
            <button onClick={() => delAddress(a.id)} className="text-rose-400 text-xs">Delete</button>
          </div>
        ))}
        {addrOpen && (
          <div className="space-y-2 border-t pt-2">
            <select value={addr.addressType} onChange={(e) => setAddr((a) => ({ ...a, addressType: e.target.value }))} className="w-full h-9 rounded-lg border border-slate-200 px-2 text-sm">{["HOME", "OFFICE", "OTHER"].map((t) => <option key={t}>{t}</option>)}</select>
            <input value={addr.addressLine1} onChange={(e) => setAddr((a) => ({ ...a, addressLine1: e.target.value }))} placeholder="Address" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm" />
            <div className="grid grid-cols-2 gap-2"><input value={addr.city} onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))} placeholder="City" className="h-9 rounded-lg border border-slate-200 px-3 text-sm" /><input value={addr.pincode} onChange={(e) => setAddr((a) => ({ ...a, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="PIN" className="h-9 rounded-lg border border-slate-200 px-3 text-sm" /></div>
            <input value={addr.state} onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value }))} placeholder="State" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm" />
            <button onClick={addAddress} className="w-full h-9 rounded-lg bg-blue-600 text-white text-sm">Save Address</button>
          </div>
        )}
      </div>

      <button onClick={logout} className="w-full h-11 rounded-xl border border-slate-200 text-slate-600 text-sm flex items-center justify-center gap-2"><LogOut className="h-4 w-4" /> Log Out</button>
    </div>
  )
}
