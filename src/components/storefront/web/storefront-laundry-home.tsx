"use client"

// LAUNDRY customer website home. Driven entirely by Laundry Services + Garments
// + Pricing Rules + Subscription Plans (via /api/core/storefront/laundry-home)
// — never ecommerce Product/ProductCategory. Prices come resolved from the
// Billing Resolver; the order summary is quoted by /api/laundry/billing/quote.
// Laundry terminology throughout (Services, Garments, Pickup, Subscription).

import { useEffect, useMemo, useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { Search, Shirt, Truck, Sparkles, PackageCheck, CheckCircle2, Minus, Plus, X, Calendar, Repeat } from "lucide-react"
import type { WebNav } from "./storefront-website"

const inr = (n: number | null | undefined) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`)

interface SvcItem { garmentId: string; garmentName: string; categoryName: string | null; available: boolean; unitPrice: number | null; pricingType: string | null; unit: string | null; gstPercent: number | null }
interface Service { id: string; name: string; description: string | null; icon: string | null; items: SvcItem[]; fromPrice: number | null; fromUnit: string }
interface Plan { id: string; name: string; slug: string; description: string | null; price: number; billingCycle: string; totalCredits: number; creditLabel: string; allowanceType: string | null; maxOrdersPerCycle: number | null; features: string[]; isFeatured: boolean }
interface QuoteLine { unitPrice: number; baseAmount: number; gstAmount: number; lineTotal: number; quantity?: number }
interface Quote { lines: QuoteLine[]; subtotal: number; gstTotal: number; grandTotal: number }

export function StorefrontLaundryHome({ brandColor, nav }: { brandColor: string; nav: WebNav; storeClosed?: boolean }) {
  const { currentBusinessId, currentStoreId } = useAdminStore()
  const [services, setServices] = useState<Service[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeService, setActiveService] = useState<Service | null>(null)

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

  const popular = useMemo(() => services.filter((s) => s.items.length > 0), [services])
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
                        {s.fromPrice != null ? <p className="text-xs text-gray-400">From {inr(s.fromPrice)} / {s.fromUnit}</p> : <p className="text-xs text-gray-400">Price unavailable</p>}</div>
                    </div>
                    {s.description && <p className="mt-2 text-xs text-gray-500 line-clamp-2">{s.description}</p>}
                    <button onClick={() => setActiveService(s)} disabled={s.items.length === 0}
                      className="mt-3 rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-40 active:opacity-80" style={accentBg}>
                      {s.items.length ? "Select Service" : "No pricing yet"}
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
                      {s.items.slice(0, 5).map((it) => (
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
                    <button onClick={() => nav.go("auth")} className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white active:opacity-80" style={accentBg}>Subscribe</button>
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

      {activeService && <ServiceSheet service={activeService} businessId={currentBusinessId} storeId={currentStoreId} brandColor={brandColor} onClose={() => setActiveService(null)} />}
    </div>
  )
}

// Service selection sheet — quantity per garment + live order summary (quoted
// by the Billing Resolver via /api/laundry/billing/quote).
function ServiceSheet({ service, businessId, storeId, brandColor, onClose }: { service: Service; businessId: string; storeId: string; brandColor: string; onClose: () => void }) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [quote, setQuote] = useState<Quote | null>(null)
  const selected = service.items.filter((it) => (qty[it.garmentId] || 0) > 0)

  useEffect(() => {
    if (selected.length === 0) { setQuote(null); return }
    const items = selected.map((it) => ({ serviceId: service.id, garmentId: it.garmentId, quantity: qty[it.garmentId] }))
    const ctrl = new AbortController()
    fetch(`/api/laundry/billing/quote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, storeId: storeId || null, items }), signal: ctrl.signal })
      .then((r) => r.json()).then((j) => { if (j.success) setQuote(j.data) }).catch(() => {})
    return () => ctrl.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(qty)])

  const bump = (id: string, d: number) => setQty((p) => ({ ...p, [id]: Math.max(0, (p[id] || 0) + d) }))
  const accentBg = { backgroundColor: brandColor }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div><p className="font-bold text-gray-900">{service.name}</p><p className="text-xs text-gray-400">Choose garments &amp; quantity</p></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-50"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-3 flex-1">
          {service.items.map((it) => (
            <div key={it.garmentId} className="flex items-center justify-between py-2.5 border-b border-gray-50">
              <div><p className="text-sm font-medium text-gray-800">{it.garmentName}</p><p className="text-xs text-gray-400">{inr(it.unitPrice)} / {it.unit}</p></div>
              <div className="flex items-center gap-2.5">
                <button onClick={() => bump(it.garmentId, -1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center active:bg-gray-50"><Minus className="w-3.5 h-3.5 text-gray-600" /></button>
                <span className="w-5 text-center text-sm font-semibold">{qty[it.garmentId] || 0}</span>
                <button onClick={() => bump(it.garmentId, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white active:opacity-80" style={accentBg}><Plus className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
        {/* Order summary */}
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/60">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Order Summary</p>
          {selected.length === 0 ? <p className="text-sm text-gray-400">Add garments to see your total.</p> : (
            <>
              <div className="space-y-1">
                {selected.map((it, i) => (
                  <div key={it.garmentId} className="flex justify-between text-sm">
                    <span className="text-gray-600">{qty[it.garmentId]} × {it.garmentName}</span>
                    <span className="font-medium text-gray-800">{inr(quote?.lines[i]?.lineTotal ?? (it.unitPrice || 0) * (qty[it.garmentId] || 0))}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-semibold">{inr(quote?.subtotal ?? null)}</span></div>
              {quote && quote.gstTotal > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">GST</span><span className="font-semibold">{inr(quote.gstTotal)}</span></div>}
              <div className="flex justify-between text-base pt-1.5"><span className="font-bold text-gray-900">Total</span><span className="font-extrabold" style={{ color: brandColor }}>{inr(quote?.grandTotal ?? null)}</span></div>
              <button className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white active:opacity-80" style={accentBg}>Continue</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
