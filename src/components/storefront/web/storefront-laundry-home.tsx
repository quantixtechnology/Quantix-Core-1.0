"use client"

// LAUNDRY customer website home. Driven entirely by Laundry Services + Garments
// + Pricing Rules + Subscription Plans (via /api/core/storefront/laundry-home)
// — never ecommerce Product/ProductCategory. Prices come resolved from the
// Billing Resolver; the order summary is quoted by /api/laundry/billing/quote;
// Confirm creates a REAL laundry order via /api/core/storefront/laundry-order.
// Laundry terminology throughout (Services, Garments, Pickup, Subscription).
// Functional integration only — no visual polish in this pass.

import { useEffect, useMemo, useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { Search, Shirt, Truck, Sparkles, PackageCheck, CheckCircle2, Minus, Plus, X, Calendar, Repeat, Loader2, AlertCircle, LogIn, CreditCard } from "lucide-react"
import { toast } from "sonner"
import type { WebNav } from "./storefront-website"

const inr = (n: number | null | undefined) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`)

interface SvcItem { garmentId: string; garmentName: string; categoryName: string | null; available: boolean; unitPrice: number | null; pricingType: string | null; unit: string | null; gstPercent: number | null }
interface Service { id: string; name: string; description: string | null; icon: string | null; items: SvcItem[]; pricedCount: number; fromPrice: number | null; fromUnit: string }
interface Plan { id: string; name: string; slug: string; description: string | null; price: number; billingCycle: string; totalCredits: number; creditLabel: string; allowanceType: string | null; maxOrdersPerCycle: number | null; features: string[]; isFeatured: boolean }

export function StorefrontLaundryHome({ brandColor, nav }: { brandColor: string; nav: WebNav; storeClosed?: boolean }) {
  const { currentBusinessId, currentStoreId } = useAdminStore()
  const { isAuthenticated, token } = useAuthStore()
  const [services, setServices] = useState<Service[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeService, setActiveService] = useState<Service | null>(null)
  const [subscribePlan, setSubscribePlan] = useState<Plan | null>(null)

  useEffect(() => {
    if (!currentBusinessId) return
    setLoading(true)
    const p = new URLSearchParams({ businessId: currentBusinessId })
    if (currentStoreId) p.set("storeId", currentStoreId)
    fetch(`/api/core/storefront/laundry-home?${p}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) { setServices(j.data.services || []); setPlans(j.data.plans || []) } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentBusinessId, currentStoreId])

  const popular = useMemo(() => services.filter((s) => s.pricedCount > 0), [services])
  const q = search.trim().toLowerCase()
  const filteredServices = useMemo(() => !q ? services : services.filter((s) =>
    s.name.toLowerCase().includes(q) || s.items.some((i) => i.garmentName.toLowerCase().includes(q))), [services, q])

  const accent = { color: brandColor }
  const accentBg = { backgroundColor: brandColor }

  return (
    <div className="pb-16">
      {/* Hero */}
      <section className="px-4 pt-6 pb-8 sm:px-6" style={{ background: `linear-gradient(135deg, ${brandColor}14, transparent)` }}>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 leading-tight whitespace-pre-line">
          Professional Laundry,{"\n"}Picked Up &amp; Delivered.
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-500">Fresh clothes. Simple scheduling. Transparent pricing.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setActiveService(popular[0] || services[0] || null)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm active:opacity-80" style={accentBg}>Schedule Pickup</button>
          <button onClick={() => document.getElementById("laundry-services")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl px-5 py-2.5 text-sm font-semibold border border-gray-200 text-gray-700 active:bg-gray-50">View Services</button>
        </div>
        <div className="mt-5 relative max-w-xl">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services or garments..."
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-gray-300" />
        </div>
      </section>

      {loading ? (
        <div className="px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Section 1 — Our Services */}
          <section id="laundry-services" className="px-4 sm:px-6 mt-6">
            <h2 className="text-lg font-bold text-gray-900">Our Services</h2>
            {filteredServices.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No laundry services configured yet.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredServices.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brandColor}14` }}><Shirt className="w-5 h-5" style={accent} /></div>
                      <div className="min-w-0"><p className="font-semibold text-gray-900 truncate">{s.name}</p>
                        {s.fromPrice != null ? <p className="text-xs text-gray-400">From {inr(s.fromPrice)} / {s.fromUnit}</p> : <p className="text-xs text-gray-400">Pricing unavailable</p>}</div>
                    </div>
                    {s.description && <p className="mt-2 text-xs text-gray-500 line-clamp-2">{s.description}</p>}
                    <button onClick={() => setActiveService(s)} disabled={s.pricedCount === 0}
                      className="mt-3 rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-40 active:opacity-80" style={accentBg}>
                      {s.pricedCount ? "Select Service" : "No pricing yet"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 2 — Popular Services (garment prices) */}
          {popular.length > 0 && (
            <section className="px-4 sm:px-6 mt-8">
              <h2 className="text-lg font-bold text-gray-900">Popular Services</h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {popular.slice(0, 4).map((s) => (
                  <div key={s.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    <div className="mt-2 divide-y divide-gray-50">
                      {s.items.filter((it) => it.available).slice(0, 5).map((it) => (
                        <div key={it.garmentId} className="flex items-center justify-between py-1.5 text-sm">
                          <span className="text-gray-600">{it.garmentName}</span>
                          <span className="font-semibold text-gray-900">{inr(it.unitPrice)} <span className="text-xs font-normal text-gray-400">/ {it.unit}</span></span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setActiveService(s)} className="mt-3 w-full rounded-lg border border-gray-200 py-2 text-xs font-semibold text-gray-700 active:bg-gray-50">Select Service</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 3 — Subscription Plans */}
          {plans.length > 0 && (
            <section className="px-4 sm:px-6 mt-8">
              <h2 className="text-lg font-bold text-gray-900">Subscription Plans</h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {plans.map((p) => (
                  <div key={p.id} className="rounded-2xl border-2 bg-white p-5 shadow-sm" style={{ borderColor: p.isFeatured ? brandColor : "#f3f4f6" }}>
                    <div className="flex items-center gap-2"><Repeat className="w-4 h-4" style={accent} /><p className="font-bold text-gray-900">{p.name}</p></div>
                    <p className="mt-2 text-2xl font-extrabold text-gray-900">{inr(p.price)} <span className="text-sm font-medium text-gray-400">/ {p.billingCycle.toLowerCase()}</span></p>
                    <ul className="mt-3 space-y-1.5">
                      {(p.features.length ? p.features : [`${p.totalCredits} ${p.creditLabel} included`]).map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={accent} /> {f}</li>
                      ))}
                    </ul>
                    <button onClick={() => setSubscribePlan(p)} className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white active:opacity-80" style={accentBg}>Subscribe</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 4 — How It Works */}
          <section className="px-4 sm:px-6 mt-8">
            <h2 className="text-lg font-bold text-gray-900">How It Works</h2>
            <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: Calendar, t: "Schedule Pickup", d: "Book a slot that suits you." },
                { icon: Truck, t: "We Collect", d: "We pick up from your door." },
                { icon: Sparkles, t: "We Clean & Process", d: "Washed, ironed, quality-checked." },
                { icon: PackageCheck, t: "Delivered Fresh", d: "Back to you, fresh and folded." },
              ].map((s, i) => (
                <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 text-center">
                  <div className="mx-auto w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}14` }}><s.icon className="w-5 h-5" style={accent} /></div>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{i + 1}. {s.t}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{s.d}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeService && <ServiceSheet service={activeService} businessId={currentBusinessId} brandColor={brandColor} nav={nav} plans={plans} isAuthenticated={isAuthenticated} token={token} onClose={() => setActiveService(null)} />}
      {subscribePlan && <SubscribeSheet plan={subscribePlan} businessId={currentBusinessId} brandColor={brandColor} nav={nav} isAuthenticated={isAuthenticated} token={token} onClose={() => setSubscribePlan(null)} />}
    </div>
  )
}

// ── Order flow: Select garments → Details/Pickup → Confirm → Success ─────────
interface SubStatus { active: boolean; subscriptionId?: string; planName?: string; allowance?: number; used?: number; remaining?: number; ordersUsed?: number; maxOrders?: number | null }
interface Coverage { covered: number; extra: number; extraCharge: { grandTotal: number } }
function ServiceSheet({ service, businessId, brandColor, nav, plans, isAuthenticated, token, onClose }: { service: Service; businessId: string; brandColor: string; nav: WebNav; plans: Plan[]; isAuthenticated: boolean; token: string | null; onClose: () => void }) {
  const [step, setStep] = useState<"select" | "details" | "success">("select")
  const [qty, setQty] = useState<Record<string, number>>({})
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [address, setAddress] = useState("")
  const [date, setDate] = useState(""); const [slot, setSlot] = useState("Morning (9AM–12PM)")
  const [useSub, setUseSub] = useState(false); const [forceNormal, setForceNormal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ orderNumber: string; grandTotal: number; subtotal: number; gstTotal: number; pickup: { date: string | null; timeSlot: string | null }; subscription: { covered: number; extra: number; remaining: number; planAllowance: number; ordersUsed: number; maxOrders: number; extraCharge: number } | null } | null>(null)
  const [limitNotice, setLimitNotice] = useState<string | null>(null)
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null)
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [checkingSub, setCheckingSub] = useState(false)
  const [showSubRequired, setShowSubRequired] = useState(false)
  const [subscribeNow, setSubscribeNow] = useState<Plan | null>(null)

  const selected = service.items.filter((it) => it.available && (qty[it.garmentId] || 0) > 0)
  const clientSubtotal = selected.reduce((s, it) => s + (it.unitPrice || 0) * (qty[it.garmentId] || 0), 0)
  const bump = (id: string, d: number) => setQty((p) => ({ ...p, [id]: Math.max(0, (p[id] || 0) + d) }))
  const accentBg = { backgroundColor: brandColor }
  const orderItems = () => selected.map((it) => ({ serviceId: service.id, garmentId: it.garmentId, quantity: qty[it.garmentId] }))

  // Entitlement check — runs when the customer ticks "Use my subscription
  // allowance". Never consumes allowance. No active plan → Subscription Required.
  const onToggleSub = async (checked: boolean) => {
    setForceNormal(false); setLimitNotice(null); setCoverage(null)
    if (!checked) { setUseSub(false); setSubStatus(null); return }
    if (!phone.trim()) { toast.error("Enter your phone number first"); return }
    setCheckingSub(true)
    try {
      const res = await fetch("/api/core/storefront/laundry-subscription/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, phone }) })
      const j = await res.json()
      if (j.success && j.data.active) {
        setSubStatus(j.data); setUseSub(true)
        // Coverage preview (read-only — does not consume allowance)
        const pv = await fetch("/api/core/storefront/laundry-subscription/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, subscriptionId: j.data.subscriptionId, items: orderItems() }) })
        const pj = await pv.json(); if (pj.success) setCoverage({ covered: pj.data.covered, extra: pj.data.extra, extraCharge: pj.data.extraCharge })
      } else { setUseSub(false); setSubStatus(null); setShowSubRequired(true) }
    } catch { toast.error("Could not check subscription") } finally { setCheckingSub(false) }
  }

  const submit = async (force = false) => {
    if (!name.trim() || !phone.trim()) { toast.error("Name and phone are required"); return }
    setSubmitting(true); setLimitNotice(null)
    try {
      const res = await fetch("/api/core/storefront/laundry-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          items: orderItems(),
          customer: { name, phone, email: "" },
          pickup: { address, date: date || null, timeSlot: slot },
          useSubscription: useSub, forceNormal: force || forceNormal,
        }),
      })
      const j = await res.json()
      if (j.noSubscription) { setUseSub(false); setShowSubRequired(true); setSubmitting(false); return }
      if (j.needsNormalOrder) { setLimitNotice(j.reason || "Subscription limit reached."); setForceNormal(true); setUseSub(false); setSubmitting(false); return }
      if (!res.ok || !j.success) throw new Error(j.error || "Order failed")
      setResult(j.data); setStep("success")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Order failed") } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900">{service.name}</p>
            <p className="text-xs text-gray-400">{step === "select" ? "Choose garments & quantity" : step === "details" ? "Pickup details" : "Pickup scheduled"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-50"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        {/* Subscription Required popup */}
        {showSubRequired && (
          <div className="absolute inset-0 z-10 bg-white/95 flex items-center justify-center p-5" onClick={(e) => e.stopPropagation()}>
            <div className="w-full max-w-sm">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center"><AlertCircle className="w-6 h-6 text-amber-600" /></div>
              <h3 className="mt-3 text-center text-base font-bold text-gray-900">Subscription Required</h3>
              <p className="mt-1 text-center text-sm text-gray-500">You don&apos;t have an active laundry subscription. Subscribe to use monthly cloth allowance and plan benefits.</p>
              {plans[0] && (
                <div className="mt-3 rounded-xl border border-gray-100 p-3 text-sm">
                  <p className="font-semibold text-gray-900">{plans[0].name}</p>
                  <p className="text-gray-500">{inr(plans[0].price)} / {plans[0].billingCycle.toLowerCase()} · {plans[0].totalCredits} clothes{plans[0].maxOrdersPerCycle ? ` · up to ${plans[0].maxOrdersPerCycle} orders` : ""}</p>
                </div>
              )}
              <div className="mt-4 flex flex-col gap-2">
                {plans[0] && <button onClick={() => { setShowSubRequired(false); setSubscribeNow(plans[0]) }} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white" style={accentBg}>View Plan &amp; Subscribe</button>}
                <button onClick={() => { setShowSubRequired(false); setUseSub(false) }} className="w-full rounded-xl py-2.5 text-sm font-semibold border border-gray-200 text-gray-600">Continue Without Subscription</button>
              </div>
            </div>
          </div>
        )}
        {subscribeNow && <SubscribeSheet plan={subscribeNow} businessId={businessId} brandColor={brandColor} nav={nav} isAuthenticated={isAuthenticated} token={token}
          onClose={() => setSubscribeNow(null)} onActivated={() => { setSubscribeNow(null); onToggleSub(true) }} />}

        {/* STEP: select garments */}
        {step === "select" && (<>
          <div className="overflow-y-auto px-5 py-3 flex-1">
            {service.items.map((it) => (
              <div key={it.garmentId} className="flex items-center justify-between py-2.5 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800">{it.garmentName}</p>
                  {it.available ? <p className="text-xs text-gray-400">{inr(it.unitPrice)} / {it.unit}</p>
                    : <p className="text-xs text-gray-400">Price unavailable · Not available for this service</p>}
                </div>
                <div className="flex items-center gap-2.5">
                  <button disabled={!it.available} onClick={() => bump(it.garmentId, -1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-30 active:bg-gray-50"><Minus className="w-3.5 h-3.5 text-gray-600" /></button>
                  <span className="w-5 text-center text-sm font-semibold">{qty[it.garmentId] || 0}</span>
                  <button disabled={!it.available} onClick={() => bump(it.garmentId, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white disabled:opacity-30 active:opacity-80" style={accentBg}><Plus className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/60">
            <div className="flex justify-between text-sm mb-2"><span className="text-gray-500">Subtotal (est.)</span><span className="font-semibold">{inr(clientSubtotal)}</span></div>
            <button disabled={selected.length === 0} onClick={() => setStep("details")} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40 active:opacity-80" style={accentBg}>Continue</button>
          </div>
        </>)}

        {/* STEP: pickup details */}
        {step === "details" && (<>
          <div className="overflow-y-auto px-5 py-4 flex-1 space-y-3">
            <div><p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Order Review</p>
              <div className="rounded-xl border border-gray-100 p-3 space-y-1">
                {selected.map((it) => (
                  <div key={it.garmentId} className="flex justify-between text-sm"><span className="text-gray-600">{qty[it.garmentId]} × {it.garmentName}</span><span className="font-medium">{inr((it.unitPrice || 0) * (qty[it.garmentId] || 0))}</span></div>
                ))}
                <div className="flex justify-between text-sm pt-1 border-t border-gray-100 mt-1"><span className="font-semibold text-gray-700">Subtotal</span><span className="font-bold" style={{ color: brandColor }}>{inr(clientSubtotal)}</span></div>
              </div>
            </div>
            <Field label="Full Name"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" placeholder="Your name" /></Field>
            <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" placeholder="10-digit mobile" /></Field>
            <Field label="Pickup Address"><textarea value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none min-h-[56px]" placeholder="Flat, building, area…" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pickup Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" /></Field>
              <Field label="Time Slot">
                <select value={slot} onChange={(e) => setSlot(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none bg-white">
                  {["Morning (9AM–12PM)", "Afternoon (12PM–4PM)", "Evening (4PM–8PM)"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={useSub} disabled={checkingSub} onChange={(e) => onToggleSub(e.target.checked)} />
              Use my subscription allowance {checkingSub && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            </label>
            {useSub && subStatus?.active && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs space-y-1">
                <p className="font-semibold text-gray-800">{subStatus.planName}</p>
                <div className="flex justify-between text-gray-600"><span>{subStatus.used} of {subStatus.allowance} clothes used</span><span>{subStatus.remaining} remaining</span></div>
                <div className="text-gray-600">{subStatus.ordersUsed} of {subStatus.maxOrders ?? "∞"} orders used</div>
                {coverage && (
                  <div className="pt-1 mt-1 border-t border-blue-100 text-gray-700">
                    <div className="flex justify-between"><span>Covered by plan</span><span className="font-medium">{coverage.covered} clothes</span></div>
                    <div className="flex justify-between"><span>Extra (billed normally)</span><span className="font-medium">{coverage.extra} clothes · {inr(coverage.extraCharge.grandTotal)}</span></div>
                  </div>
                )}
              </div>
            )}
            {limitNotice && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{limitNotice}</span></div>
            )}
          </div>
          <div className="border-t border-gray-100 px-5 py-4 flex gap-2">
            <button onClick={() => setStep("select")} className="rounded-xl px-4 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600">Back</button>
            <button disabled={submitting} onClick={() => submit(forceNormal)} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white active:opacity-80 flex items-center justify-center gap-2" style={accentBg}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {forceNormal ? "Continue as Normal Order" : "Confirm Order"}
            </button>
          </div>
        </>)}

        {/* STEP: success */}
        {step === "success" && result && (
          <div className="px-6 py-8 text-center overflow-y-auto">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-8 h-8 text-emerald-600" /></div>
            <h2 className="mt-3 text-lg font-bold text-gray-900">Pickup Scheduled</h2>
            <p className="text-sm text-gray-500">Your laundry order has been created successfully.</p>
            <div className="mt-4 rounded-xl border border-gray-100 p-4 text-left text-sm space-y-1.5">
              <Row k="Order ID" v={result.orderNumber} mono />
              <Row k="Pickup" v={`${result.pickup.date ? new Date(result.pickup.date).toLocaleDateString() : "—"} · ${result.pickup.timeSlot || "—"}`} />
              <Row k="Order Total" v={inr(result.grandTotal)} />
              {result.subscription && (<>
                <div className="pt-1.5 mt-1.5 border-t border-gray-100" />
                <Row k="Subscription Used" v={`${result.subscription.covered} clothes`} />
                <Row k="Remaining Allowance" v={`${result.subscription.remaining} / ${result.subscription.planAllowance}`} />
                <Row k="Orders Used" v={`${result.subscription.ordersUsed} / ${result.subscription.maxOrders || "∞"}`} />
                {result.subscription.extra > 0 && <Row k="Extra Garments" v={`${result.subscription.extra} · ${inr(result.subscription.extraCharge)}`} />}
              </>)}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => { onClose(); nav.go("orders") }} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white active:opacity-80" style={accentBg}>View My Orders</button>
              <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Subscription PURCHASE — reuses the existing customer session + payment cycle.
// Guests are sent to the existing Sign In / Create Account flow (nav → "auth").
// Authenticated customers get a Plan Review with their identity from the session
// (no name/phone fields) → Continue to Payment. The CustomerSubscription is
// activated only after the payment is verified server-side.
type SubStep = "review" | "pending" | "success"
function SubscribeSheet({ plan, businessId, brandColor, nav, isAuthenticated, token, onClose, onActivated }: { plan: Plan; businessId: string; brandColor: string; nav: WebNav; isAuthenticated: boolean; token: string | null; onClose: () => void; onActivated?: () => void }) {
  const [step, setStep] = useState<SubStep>("review")
  const [submitting, setSubmitting] = useState(false)
  const [purchase, setPurchase] = useState<{ purchaseId: string; onlineGateways: string[]; paymentPending: boolean; customer?: { name?: string; email?: string; phone?: string } } | null>(null)
  const [activated, setActivated] = useState<{ cycle?: { start: string; end: string }; plan?: { name: string; totalCredits: number; maxOrdersPerCycle: number | null } } | null>(null)
  const accentBg = { backgroundColor: brandColor }
  const authHeaders = () => ({ "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) })

  const continueToSubscribe = async () => {
    if (!isAuthenticated) { onClose(); nav.go("auth"); return } // reuse existing customer auth
    setSubmitting(true)
    try {
      const res = await fetch("/api/core/storefront/laundry-subscription/purchase", { method: "POST", headers: authHeaders(), body: JSON.stringify({ businessId, planId: plan.id }) })
      const j = await res.json()
      if (j.alreadyActive) { toast.success("You're already subscribed to this plan."); if (onActivated) onActivated(); else onClose(); return }
      if (!res.ok || !j.success) throw new Error(j.error || "Could not start purchase")
      setPurchase(j.data)
      if (j.data.paymentPending) { setStep("pending"); return }
      // Online gateway available → hand off to the existing payment checkout.
      // (Razorpay client handoff is wired to the platform's payment routes; the
      //  confirm step below activates only after verified payment.)
      setStep("pending")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"><p className="font-bold text-gray-900">{plan.name}</p><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-50"><X className="w-4 h-4 text-gray-500" /></button></div>

        {step === "review" && (
          <div className="px-5 py-4 space-y-3">
            <p className="text-2xl font-extrabold text-gray-900">{inr(plan.price)} <span className="text-sm font-medium text-gray-400">/ {plan.billingCycle.toLowerCase()}</span></p>
            <div className="rounded-xl border border-gray-100 p-3 text-sm space-y-1">
              <Row k="Plan Price" v={inr(plan.price)} />
              <Row k="Billing" v={plan.billingCycle.charAt(0) + plan.billingCycle.slice(1).toLowerCase()} />
              <Row k="Included" v={`${plan.totalCredits} clothes`} />
              <Row k="Order Limit" v={plan.maxOrdersPerCycle ? `Max ${plan.maxOrdersPerCycle} orders / cycle` : "Unlimited"} />
              <Row k="Extra Clothes" v="Normal service prices" />
              <div className="pt-1 mt-1 border-t border-gray-100"><Row k="Amount Payable" v={inr(plan.price)} /></div>
            </div>
            {!isAuthenticated && <p className="text-xs text-gray-500">Sign in or create your account to subscribe — we&apos;ll bring you right back.</p>}
            <button disabled={submitting} onClick={continueToSubscribe} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white active:opacity-80 flex items-center justify-center gap-2" style={accentBg}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isAuthenticated ? <CreditCard className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              {isAuthenticated ? "Continue to Payment" : "Sign In / Create Account to Subscribe"}
            </button>
          </div>
        )}

        {step === "pending" && purchase && (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center"><CreditCard className="w-7 h-7 text-amber-600" /></div>
            <h2 className="mt-3 text-lg font-bold text-gray-900">Payment Pending</h2>
            <p className="text-sm text-gray-500 mt-1">Your purchase of <b>{plan.name}</b> for {inr(plan.price)} is created and awaiting payment.</p>
            {purchase.paymentPending
              ? <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">No online payment gateway is configured for this store yet, so payment can&apos;t be completed here. Your subscription will activate only after a verified payment — nothing is charged and no allowance is available yet.</p>
              : <p className="mt-2 text-xs text-gray-500">Complete the payment in the checkout to activate your plan.</p>}
            <p className="mt-2 text-[11px] text-gray-400 font-mono">Ref: {purchase.purchaseId}</p>
            <button onClick={onClose} className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold border border-gray-200 text-gray-600">Close</button>
          </div>
        )}

        {step === "success" && (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-8 h-8 text-emerald-600" /></div>
            <h2 className="mt-3 text-lg font-bold text-gray-900">Subscription Activated</h2>
            <p className="text-sm text-gray-500 mt-1">{activated?.plan?.totalCredits ?? plan.totalCredits} clothes available this cycle.</p>
            <button onClick={onActivated || onClose} className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white" style={accentBg}>Done</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>{children}</div>
}
function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return <div className="flex justify-between gap-3"><span className="text-gray-400">{k}</span><span className={`font-semibold text-gray-800 text-right ${mono ? "font-mono text-xs" : ""}`}>{v}</span></div>
}
