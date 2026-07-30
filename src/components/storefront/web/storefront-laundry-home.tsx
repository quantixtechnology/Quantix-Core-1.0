"use client"

// LAUNDRY customer website home. Driven entirely by Laundry Services + Garments
// + Pricing Rules + Subscription Plans (via /api/core/storefront/laundry-home)
// — never ecommerce Product/ProductCategory. Prices come resolved from the
// Billing Resolver; the order summary is quoted by /api/laundry/billing/quote;
// Confirm creates a REAL laundry order via /api/core/storefront/laundry-order.
// Laundry terminology throughout (Services, Garments, Pickup, Subscription).
// Functional integration only — no visual polish in this pass.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store";
import { INDIAN_STATES } from "@/lib/constants"
import { Search, Shirt, Truck, Sparkles, PackageCheck, CheckCircle2, Minus, Plus, X, Calendar, Repeat, Loader2, AlertCircle, LogIn, CreditCard, Mail, Lock, User, Phone, KeyRound, Eye, EyeOff, MapPin } from "lucide-react"
import { toast } from "sonner"
import { useCartStore } from "@/stores/cart-store"
import { makeGarmentLine, makePerKgLine, makeSubscriptionLine, makeBagLine, subscriptionLine, laundryLines, cartToOrderItems, cartBagServices, laundryPieceSubtotal, cartHasKgPortion, groupLaundryByService } from "@/lib/laundry-cart"
import type { WebNav } from "./storefront-website"

const inr = (n: number | null | undefined) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`)

type AuthCustomer = { name: string; phone: string; email: string } | null
const maskPhone = (p: string) => p && p.length >= 4 ? `••••••${p.slice(-4)}` : p
const maskEmail = (e: string) => { const [u, d] = e.split("@"); return u && d ? `${u.slice(0, 3)}•••@${d}` : e }
interface SvcItem { garmentId: string; garmentName: string; categoryName: string | null; unitPrice: number; pricingType: string | null; unit: string | null; gstPercent: number | null }
interface Service { id: string; name: string; description: string | null; icon: string | null; imageUrl: string | null; orderMode?: string; pricingMode: string; items: SvcItem[]; perKg: { price: number; minWeightKg: number | null; gstPercent: number | null } | null; pricedCount: number; fromPrice: number | null; fromUnit: string }
interface Plan { id: string; name: string; slug: string; description: string | null; imageUrl: string | null; price: number; billingCycle: string; totalCredits: number; creditLabel: string; allowanceType: string | null; maxOrdersPerCycle: number | null; features: string[]; isFeatured: boolean }

// Tenant marketing image with a graceful icon fallback (no distortion, lazy).
function CardImage({ src, brandColor, aspect = "aspect-[16/9]" }: { src: string | null; brandColor: string; aspect?: string }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return <div className={`${aspect} w-full rounded-t-2xl flex items-center justify-center`} style={{ background: `${brandColor}12` }}><Shirt className="w-8 h-8" style={{ color: brandColor }} /></div>
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className={`${aspect} w-full rounded-t-2xl object-cover`} />
}

// ── The ONE product card used for BOTH Services and Subscription Plans ────────
// Identical width, height, 16:9 image, spacing, typography and bottom-aligned
// button — the only differences (icon, price line, meta, featured border, button)
// are passed in as slots. There is deliberately no separate subscription layout.
function ServiceCard({ imageUrl, brandColor, title, icon, priceLine, metaLine, featured, button }: {
  imageUrl: string | null; brandColor: string; title: string; icon?: React.ReactNode
  priceLine: React.ReactNode; metaLine?: React.ReactNode; featured?: boolean; button: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-white shadow-sm flex flex-col overflow-hidden" style={{ border: featured ? `2px solid ${brandColor}` : "1px solid #f3f4f6" }}>
      <CardImage src={imageUrl} brandColor={brandColor} />
      <div className="p-2.5 sm:p-3 flex flex-col flex-1">
        <p className="font-semibold text-gray-900 text-sm sm:text-[15px] leading-tight line-clamp-2 flex items-start gap-1.5">{icon}<span>{title}</span></p>
        {priceLine}
        {metaLine}
        <div className="mt-auto pt-2.5">{button}</div>
      </div>
    </div>
  )
}

export function StorefrontLaundryHome({ brandColor, nav }: { brandColor: string; nav: WebNav; storeClosed?: boolean }) {
  const { currentBusinessId, currentStoreId } = useAdminStore()
  const { isAuthenticated, token, user } = useAuthStore()
  // Authenticated customer identity (reused from the shared Quantix session — no
  // laundry-specific login, no re-entering name/phone).
  const authCustomer = isAuthenticated && user ? { name: user.name, phone: user.phone || "", email: user.email || "" } : null
  const [subSummary, setSubSummary] = useState<{ active: { planName: string; remaining: number; allowance: number; maxOrders: number | null } | null; pending: { planId: string; purchaseId: string; planName: string | null; due: number; createdAt: string } | null } | null>(null)
  const [cancelingPending, setCancelingPending] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeService, setActiveService] = useState<Service | null>(null)
  const [subOnlyCheckout, setSubOnlyCheckout] = useState<Plan | null>(null)
  const [openAtDetails, setOpenAtDetails] = useState(false)

  // ── ONE shared cart (single source of truth). Services + Subscription plans
  //    both live in useCartStore; the badge + Laundry Bag read it directly. ──
  const cartItems = useCartStore((s) => s.items)
  const cartAddItem = useCartStore((s) => s.addItem)
  const clearKind = useCartStore((s) => s.clearKind)
  const laundryCheckoutTick = useCartStore((s) => s.laundryCheckoutTick)
  const cartSubLine = subscriptionLine(cartItems)
  const subscriptionInCart = useMemo(() => (cartSubLine ? plans.find((p) => p.id === cartSubLine.planId) || null : null), [cartSubLine, plans])
  const addSubscription = useCallback((p: Plan) => { clearKind("subscription"); cartAddItem(makeSubscriptionLine({ planId: p.id, name: p.name, price: p.price, billingCycle: p.billingCycle })) }, [clearKind, cartAddItem])
  const clearSubscription = useCallback(() => clearKind("subscription"), [clearKind])

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

  // Resolve THIS customer's subscription (active plan / pending due) from the
  // shared CustomerSubscription — same record used by walk-in + admin.
  const cancelPending = async (purchaseId: string) => {
    if (!currentBusinessId) return
    setCancelingPending(true)
    try {
      const res = await fetch("/api/core/storefront/laundry-subscription/cancel", {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ businessId: currentBusinessId, purchaseId }),
      })
      const j = await res.json()
      if (j.success) { toast.success("Subscription request cancelled"); refreshSummary() } else toast.error(j.error || "Could not cancel")
    } catch { toast.error("Could not cancel") } finally { setCancelingPending(false) }
  }
  const refreshSummary = useCallback(() => {
    // Detect the logged-in customer's subscription via the auth token (works for
    // email-OTP customers with no phone). Phone is only a guest fallback.
    if (!currentBusinessId || !isAuthenticated) { setSubSummary(null); return }
    fetch("/api/core/storefront/laundry-subscription/summary", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ businessId: currentBusinessId, phone: authCustomer?.phone }) })
      .then((r) => r.json()).then((j) => { if (j.success) setSubSummary(j.data) }).catch(() => {})
  }, [currentBusinessId, isAuthenticated, token, authCustomer?.phone])
  useEffect(() => { refreshSummary() }, [refreshSummary])

  // Open the reused laundry checkout for the WHOLE cart: the service sheet at its
  // cart-level details/pickup step (consumes every service + the subscription),
  // or the plan-only checkout when the cart holds a subscription alone.
  const openCartCheckout = useCallback(() => {
    const svcId = laundryLines(cartItems)[0]?.serviceId
    const svc = svcId ? services.find((s) => s.id === svcId) : null
    if (svc) { setActiveService(svc); setOpenAtDetails(true) }
    else if (cartSubLine) { const p = plans.find((x) => x.id === cartSubLine.planId); if (p) setSubOnlyCheckout(p) }
  }, [cartItems, services, plans, cartSubLine])
  // The Laundry Bag "Proceed to Checkout" bumps this tick → open the checkout.
  useEffect(() => {
    if (!laundryCheckoutTick) return
    openCartCheckout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laundryCheckoutTick])

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
          {/* Section 1 — Our Services (uses the shared ServiceCard) */}
          <section id="laundry-services" className="px-4 sm:px-6 mt-6">
            <h2 className="text-lg font-bold text-gray-900">Our Services</h2>
            {filteredServices.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No laundry services configured yet.</p>
            ) : (
              /* Compact catalog: 2-up mobile → 3 tablet → 4 desktop → 5 wide;
                 fixed 16:9 image so cards stay compact and never stretch. */
              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
                {filteredServices.map((s) => (
                  <ServiceCard
                    key={s.id}
                    imageUrl={s.imageUrl}
                    brandColor={brandColor}
                    title={s.name}
                    priceLine={s.fromPrice != null
                      ? <p className="mt-0.5 text-sm font-bold text-gray-900"><span className="text-[11px] font-medium text-gray-400">From </span>{inr(s.fromPrice)} <span className="text-xs font-medium text-gray-400">/ {s.fromUnit === "kg" ? "kg" : s.fromUnit === "fixed" ? "item" : "piece"}</span></p>
                      : <p className="mt-0.5 text-xs text-gray-400">Pricing unavailable</p>}
                    metaLine={s.description ? <p className="mt-1 hidden sm:block text-xs text-gray-500 line-clamp-2">{s.description}</p> : undefined}
                    button={<button onClick={() => setActiveService(s)} className="w-full rounded-lg h-9 text-xs font-semibold text-white active:opacity-80" style={accentBg}>{s.orderMode === "BAG" ? <><span className="sm:hidden">Book</span><span className="hidden sm:inline">Book Pickup</span></> : <><span className="sm:hidden">Select</span><span className="hidden sm:inline">Select Service</span></>}</button>}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Section 2 — Subscription Plans (SAME ServiceCard as Services) */}
          {plans.length > 0 && (
            <section className="px-4 sm:px-6 mt-6">
              <h2 className="text-lg font-bold text-gray-900">Subscription Plans</h2>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
                {plans.map((p) => {
                  const isActivePlan = subSummary?.active && subSummary.active.planName === p.name
                  const pendingForPlan = subSummary?.pending && subSummary.pending.planId === p.id ? subSummary.pending : null
                  const btn = isActivePlan ? (
                    <button onClick={() => nav.go("orders")} className="w-full rounded-lg h-9 text-xs font-semibold border border-emerald-300 text-emerald-700 bg-emerald-50">✓ Active — View Plan</button>
                  ) : pendingForPlan ? (
                    // One pending request per plan — Subscribe is replaced by Pay Now + Cancel.
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-amber-600 text-center leading-tight">Pending Payment · {inr(pendingForPlan.due)} due</p>
                      <button onClick={() => setSubOnlyCheckout(p)} className="w-full rounded-lg h-8 text-xs font-semibold text-white active:opacity-80" style={accentBg}>Pay Now</button>
                      <button onClick={() => cancelPending(pendingForPlan.purchaseId)} disabled={cancelingPending} className="w-full h-6 text-[11px] font-medium text-rose-600 disabled:opacity-50">Cancel Request</button>
                    </div>
                  ) : subscriptionInCart?.id === p.id ? (
                    <button onClick={() => clearSubscription()} className="w-full rounded-lg h-9 text-xs font-semibold border border-emerald-300 text-emerald-700 bg-emerald-50 active:opacity-80">✓ Added — Remove</button>
                  ) : (
                    <button onClick={() => { if (!isAuthenticated) { nav.go("auth"); return } addSubscription(p); toast.success(`${p.name} added to your bag — ₹${p.price} at checkout`) }} className="w-full rounded-lg h-9 text-xs font-semibold text-white active:opacity-80" style={accentBg}>{isAuthenticated ? "Subscribe" : "Sign in"}</button>
                  )
                  return (
                    <ServiceCard
                      key={p.id}
                      imageUrl={p.imageUrl}
                      brandColor={brandColor}
                      featured={p.isFeatured}
                      icon={<Repeat className="w-4 h-4 shrink-0 mt-0.5" style={accent} />}
                      title={p.name}
                      priceLine={<p className="mt-0.5 text-sm font-bold text-gray-900">{inr(p.price)} <span className="text-xs font-medium text-gray-400">/ {p.billingCycle.toLowerCase()}</span></p>}
                      metaLine={<p className="mt-1 text-xs text-gray-600">{p.totalCredits} {p.creditLabel} included</p>}
                      button={btn}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {/* Section 3 — Popular Services — compact price cards below Plans.
              Denser grid, minimal padding, essential garment + price only, whole
              card tappable with a small inline CTA (no full-width button). */}
          {popular.length > 0 && (
            <section className="px-4 sm:px-6 mt-6">
              <h2 className="text-base font-bold text-gray-900">Popular Services</h2>
              <div className="mt-2 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {popular.slice(0, 8).map((s) => (
                  <button key={s.id} onClick={() => setActiveService(s)} className="text-left rounded-lg border border-gray-100 bg-white p-2.5 shadow-sm active:bg-gray-50 flex flex-col">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{s.name}</p>
                    <div className="mt-1 space-y-0.5">
                      {s.perKg ? (
                        <div className="flex items-center justify-between text-xs"><span className="text-gray-500 truncate mr-1">By weight</span><span className="font-semibold text-gray-900 whitespace-nowrap">{inr(s.perKg.price)}<span className="text-[10px] font-normal text-gray-400">/kg</span></span></div>
                      ) : s.items.slice(0, 2).map((it) => (
                        <div key={it.garmentId} className="flex items-center justify-between text-xs"><span className="text-gray-500 truncate mr-1">{it.garmentName}</span><span className="font-semibold text-gray-900 whitespace-nowrap">{inr(it.unitPrice)}<span className="text-[10px] font-normal text-gray-400">/{it.unit === "kg" ? "kg" : it.unit === "fixed" ? "item" : "pc"}</span></span></div>
                      ))}
                    </div>
                    <span className="mt-1.5 text-[11px] font-semibold" style={accent}>Select →</span>
                  </button>
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

      {/* Subscription-in-cart bar — one checkout for the whole bag (plan +
          any garments together); the cart-level checkout decides allocation. */}
      {subscriptionInCart && !activeService && !subOnlyCheckout && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-100 bg-white px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.05)] flex items-center justify-between">
          <div className="text-sm"><b className="text-gray-900">{subscriptionInCart.name}</b><span className="text-gray-400"> · {inr(subscriptionInCart.price)} in bag</span><p className="text-[11px] text-gray-400">Add garments from a service to pay together, or check out now.</p></div>
          <button onClick={openCartCheckout} className="rounded-xl px-4 py-2 text-sm font-semibold text-white active:opacity-80 shrink-0" style={{ backgroundColor: brandColor }}>Checkout</button>
        </div>
      )}

      {activeService && <ServiceSheet service={activeService} businessId={currentBusinessId} brandColor={brandColor} nav={nav} plans={plans} isAuthenticated={isAuthenticated} token={token} authCustomer={authCustomer} subscriptionInCart={subscriptionInCart} addSubscription={addSubscription} initialDetails={openAtDetails} onClose={() => { setActiveService(null); setOpenAtDetails(false) }} />}
      {subOnlyCheckout && <SubscriptionCheckoutSheet plan={subOnlyCheckout} businessId={currentBusinessId} brandColor={brandColor} token={token} authCustomer={authCustomer} onDone={() => { setSubOnlyCheckout(null); clearSubscription(); refreshSummary() }} onClose={() => setSubOnlyCheckout(null)} />}
    </div>
  )
}

// ── Order flow: Select garments → Details/Pickup → Confirm → Success ─────────
interface CustomerInfo { id: string; name: string | null; phone: string | null; email: string | null; customerCode: string | null }
interface SubStatus { active: boolean; subscriptionId?: string; planName?: string; allowance?: number; used?: number; remaining?: number; ordersUsed?: number; maxOrders?: number | null }
interface Coverage { covered: number; extra: number; extraCharge: { grandTotal: number } }
interface Addr { id: string; label?: string | null; addressLine1: string; addressLine2?: string | null; area?: string | null; landmark?: string | null; city: string; state?: string | null; pincode: string; country?: string | null; isDefault?: boolean; isPickupDefault?: boolean }
const fmtAddr = (a: Addr) => [a.addressLine1, a.area, a.landmark, [a.city, a.state].filter(Boolean).join(", ") + (a.pincode ? ` - ${a.pincode}` : "")].filter((x) => x && String(x).trim()).join(", ")
function ServiceSheet({ service, businessId, brandColor, nav, plans, isAuthenticated, token, authCustomer, subscriptionInCart, addSubscription, initialDetails, onClose }: { service: Service; businessId: string; brandColor: string; nav: WebNav; plans: Plan[]; isAuthenticated: boolean; token: string | null; authCustomer: AuthCustomer; subscriptionInCart: Plan | null; addSubscription: (p: Plan) => void; initialDetails?: boolean; onClose: () => void }) {
  // Shared cart — the single source of truth this checkout consumes.
  const cartItems = useCartStore((s) => s.items)
  const clearCart = useCartStore((s) => s.clearCart)
  const replaceItems = useCartStore((s) => s.replaceItems)
  const { setSession } = useAuthStore()
  // Prefill the garment steppers from this service's existing cart lines so
  // re-opening a service EDITS its lines rather than duplicating them.
  const cartForService = useMemo(() => laundryLines(cartItems).filter((l) => l.serviceId === service.id), [service.id])// eslint-disable-line react-hooks/exhaustive-deps
  // Cart-level values for the CHECKOUT step (consumes EVERY service in the cart).
  const cartGroups = useMemo(() => groupLaundryByService(cartItems), [cartItems])
  const cartSubtotalPieces = laundryPieceSubtotal(cartItems)
  const cartKgPortion = cartHasKgPortion(cartItems)

  // ── Auth gate (pre-checkout for unauthenticated users) ─────────────────────
  type PreAuthStep = "email" | "login" | "register" | "otp" | "forgot" | "profile" | "address" | null
  const [preAuth, setPreAuth] = useState<PreAuthStep>(initialDetails && !isAuthenticated ? "email" : null)
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState("")
  const [regName, setRegName] = useState(authCustomer?.name || "")
  const [regPhone, setRegPhone] = useState(authCustomer?.phone || "")
  const [regPassword, setRegPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState("")
  const otpRef = useRef<{ email: string; name: string; phone: string; password: string } | null>(null)

  // After auth: resolve customer, check profile, handle addresses
  const [gateCustomer, setGateCustomer] = useState<CustomerInfo | null>(null)
  const [gateAddresses, setGateAddresses] = useState<Addr[]>([])
  const [gateAddrId, setGateAddrId] = useState<string | null>(null)
  const [gateAddrForm, setGateAddrForm] = useState({ label: "Home", addressLine1: "", area: "", landmark: "", city: "", state: "", pincode: "", isDefault: false })
  const [gateSaving, setGateSaving] = useState(false)
  const [gateProfileName, setGateProfileName] = useState("")
  const [gateProfilePhone, setGateProfilePhone] = useState("")

  // Once the auth gate is fully passed, show the real checkout step
  const [gatePassed, setGatePassed] = useState(initialDetails && isAuthenticated)

  const [step, setStep] = useState<"select" | "details" | "success">(
    initialDetails && isAuthenticated ? "details" : "select"
  )
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const q: Record<string, number> = {}
    for (const l of cartForService) if (l.garmentId) q[l.garmentId] = l.quantity
    return q
  })
  const [name, setName] = useState(authCustomer?.name || ""); const [phone, setPhone] = useState(authCustomer?.phone || "")
  const [date, setDate] = useState(""); const [slot, setSlot] = useState("Morning (9AM–12PM)")
  const [useSub, setUseSub] = useState(false); const [forceNormal, setForceNormal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ orderNumber: string; grandTotal: number; subtotal: number; gstTotal: number; pickup: { date: string | null; timeSlot: string | null }; subscription: { covered: number; extra: number; remaining: number; planAllowance: number; ordersUsed: number; maxOrders: number; extraCharge: number } | null } | null>(null)
  const [limitNotice, setLimitNotice] = useState<string | null>(null)
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null)
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [checkingSub, setCheckingSub] = useState(false)
  const [showSubRequired, setShowSubRequired] = useState(false)
  const [combined, setCombined] = useState<{ orderNumber: string; laundryCharges: number; subscriptionDue: number; totalDue: number; planName: string } | null>(null)
  const [gSearch, setGSearch] = useState("")
  // Marketing coupon (Phase 1) — validated read-only at checkout; recorded on
  // successful order. Laundry shows "Discount Pending" (applied after audit).
  const [couponCode, setCouponCode] = useState("")
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string; code: string; pending: boolean } | null>(null)
  const [couponBusy, setCouponBusy] = useState(false)
  const [weightKg, setWeightKg] = useState(() => { const kg = cartForService.find((l) => !l.garmentId)?.weightKg; return kg ? String(kg) : "" })
  const isPerKg = service.pricingMode === "PER_KG"
  const isBag = service.orderMode === "BAG" // Pickup-First: book the service only, no garments

  // ── Auth gate handlers ────────────────────────────────────────────────────────
  const ge = (e: string) => e.trim().toLowerCase()
  const gp = (p: string) => { const d = p.replace(/\D/g, ""); if (d.length === 10) return `+91${d}`; if (d.startsWith("91") && d.length === 12) return `+${d}`; return p.startsWith("+") ? p : `+${d}` }

  const handlePreCheckEmail = async () => {
    const e = ge(authEmail)
    if (!e) { setAuthError("Please enter your email"); return }
    setAuthLoading(true); setAuthError("")
    try {
      const res = await fetch("/api/core/storefront/auth/check-customer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, businessId }) })
      const d = await res.json()
      if (d.success && d.exists) setPreAuth("login")
      else { setRegName(""); setRegPhone(""); setRegPassword(""); setPreAuth("register") }
    } catch { setAuthError("Network error") } finally { setAuthLoading(false) }
  }

  const handlePreLogin = async () => {
    if (!authPassword) { setAuthError("Enter your password"); return }
    setAuthLoading(true); setAuthError("")
    try {
      const res = await fetch("/api/core/storefront/auth/login-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ge(authEmail), password: authPassword, businessId }) })
      const d = await res.json()
      if (d.success) { setSession({ token: d.data.accessToken, refreshToken: d.data.refreshToken, user: d.data.user, businesses: d.data.businesses }) }
      else { setAuthError(d.error || "Invalid email or password") }
    } catch { setAuthError("Network error") } finally { setAuthLoading(false) }
  }

  const handlePreRegister = async () => {
    if (!regName || !regPhone) { setAuthError("Name and mobile number are required"); return }
    if (regPassword.length < 8) { setAuthError("Password must be at least 8 characters"); return }
    setAuthLoading(true); setAuthError("")
    try {
      const ph = gp(regPhone)
      const r = await fetch("/api/core/storefront/auth/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ge(authEmail), name: regName, phone: ph, businessId }) })
      const j = await r.json()
      if (j.success) { otpRef.current = { email: ge(authEmail), name: regName, phone: ph, password: regPassword }; setPreAuth("otp") }
      else { setAuthError(j.error || "Registration failed") }
    } catch { setAuthError("Network error") } finally { setAuthLoading(false) }
  }

  const handlePreVerifyOtp = async () => {
    if (!otp || otp.length < 4) { setAuthError("Enter the verification code"); return }
    const det = otpRef.current
    if (!det) { setAuthError("Session expired, please restart"); return }
    setAuthLoading(true); setAuthError("")
    try {
      const v = await fetch("/api/core/storefront/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: det.email, code: otp, name: det.name, phone: det.phone, businessId }) })
      const vd = await v.json()
      if (vd.success) {
        const sp = await fetch("/api/core/storefront/auth/set-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: det.email, password: det.password, token: vd.data?.token || vd.data?.accessToken, businessId }) })
        const sd = await sp.json()
        if (sd.success || sd.data?.accessToken) {
          setSession({ token: sd.data.accessToken || vd.data.accessToken, refreshToken: sd.data?.refreshToken, user: sd.data.user || vd.data.user, businesses: sd.data?.businesses })
        } else { setAuthError(sd.error || "Failed to set password") }
      } else { setAuthError(vd.error || "Invalid verification code") }
    } catch { setAuthError("Network error") } finally { setAuthLoading(false) }
  }

  const handlePreForgot = async () => {
    setAuthLoading(true); setAuthError("")
    try {
      const r = await fetch("/api/core/storefront/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ge(authEmail), businessId }) })
      const d = await r.json()
      if (d.success) { setPreAuth("login"); setAuthError("Check your email for reset instructions") }
      else { setAuthError(d.error || "Failed to send reset email") }
    } catch { setAuthError("Network error") } finally { setAuthLoading(false) }
  }

  // After auth: resolve gate customer → check profile → handle address
  const resolveGateCustomer = useCallback(async () => {
    const t = useAuthStore.getState().token
    if (!t || !businessId) return
    try {
      const r = await fetch("/api/core/storefront/laundry-customer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ businessId }) })
      const d = await r.json()
      if (d.success) {
        const c = d.data as CustomerInfo
        setGateCustomer(c)
        if (c.name && c.phone) { setPreAuth("address"); fetchGateAddresses() }
        else { setGateProfileName(c.name || ""); setGateProfilePhone(c.phone || ""); setPreAuth("profile") }
      } else { setAuthError(d.error || "Could not resolve customer") }
    } catch { setAuthError("Network error") }
  }, [token, businessId])

  const fetchGateAddresses = useCallback(async () => {
    const t = useAuthStore.getState().token
    if (!t) return
    try {
      const r = await fetch("/api/laundry/app/addresses", { headers: { Authorization: `Bearer ${t}` } })
      const d = await r.json()
      if (d.success && Array.isArray(d.data)) {
        setGateAddresses(d.data)
        const def = d.data.find((a: Addr) => a.isPickupDefault || a.isDefault)
        if (def) setGateAddrId(def.id)
        else if (d.data.length > 0) setGateAddrId(d.data[0].id)
        if (d.data.length > 0) { setPreAuth(null); setGatePassed(true); setStep("details") }
      }
    } catch {}
  }, [token])

  const handleGateSaveProfile = async () => {
    const n = gateProfileName.trim(); const p = gateProfilePhone.replace(/\D/g, "")
    if (!n || !p) { setAuthError("Name and mobile number are required"); return }
    const t = useAuthStore.getState().token
    if (!t || !gateCustomer) return
    setGateSaving(true); setAuthError("")
    try {
      const r = await fetch("/api/core/storefront/laundry-customer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ businessId, name: n, phone: gp(p) }) })
      const d = await r.json()
      if (d.success) { setGateCustomer({ ...gateCustomer, name: n, phone: p }); setPreAuth("address"); fetchGateAddresses() }
      else { setAuthError(d.error || "Failed to save profile") }
    } catch { setAuthError("Network error") } finally { setGateSaving(false) }
  }

  const handleGateSaveAddress = async () => {
    if (!gateAddrForm.addressLine1.trim() || !gateAddrForm.city.trim() || !gateAddrForm.pincode.trim()) { setAuthError("Street, city and pincode are required"); return }
    const t = useAuthStore.getState().token
    if (!t) return
    setGateSaving(true); setAuthError("")
    try {
      const r = await fetch("/api/laundry/app/addresses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ label: gateAddrForm.label, addressLine1: gateAddrForm.addressLine1, area: gateAddrForm.area || undefined, landmark: gateAddrForm.landmark || undefined, city: gateAddrForm.city, state: gateAddrForm.state, pincode: gateAddrForm.pincode, isPickupDefault: gateAddrForm.isDefault, isDeliveryDefault: gateAddrForm.isDefault }) })
      const d = await r.json()
      if (d.success) { setPreAuth(null); setGatePassed(true); setStep("details") }
      else { setAuthError(d.error || "Failed to save address") }
    } catch { setAuthError("Network error") } finally { setGateSaving(false) }
  }

  const gateResolvedRef = useRef(false)

  useEffect(() => {
    if (isAuthenticated && preAuth !== null && !gateResolvedRef.current) {
      gateResolvedRef.current = true
      resolveGateCustomer()
    }
    if (preAuth === null) { gateResolvedRef.current = false }
  }, [isAuthenticated, preAuth, resolveGateCustomer])

  // Bridge auth gate state into the details step's own state
  useEffect(() => {
    if (gatePassed && gateCustomer) {
      setCustId(gateCustomer.id)
      if (gateCustomer.name) setName(gateCustomer.name)
      if (gateCustomer.phone) setPhone(gateCustomer.phone)
      setEmail(gateCustomer.email || "")
      if (gateAddresses.length > 0) {
        setAddresses(gateAddresses)
        if (gateAddrId) setSelAddr(gateAddrId)
      }
    }
  }, [gatePassed, gateCustomer, gateAddresses, gateAddrId])

  // ── Customer identity + structured address (reuse shared /profile + /addresses) ──
  const [email, setEmail] = useState(authCustomer?.email || "")
  const [custId, setCustId] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<Addr[]>([])
  const [selAddr, setSelAddr] = useState<string | null>(null)
  const [showAddAddr, setShowAddAddr] = useState(false)
  const [addrForm, setAddrForm] = useState({ label: "Home", addressLine1: "", area: "", landmark: "", city: "", state: "", pincode: "", isDefault: false })
  const [savingAddr, setSavingAddr] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const authHeaders = useMemo(() => ({ "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}`, "x-business-id": businessId } : {}) }), [token, businessId])

  useEffect(() => {
    if (!isAuthenticated || !token) return
    fetch("/api/core/storefront/profile", { headers: authHeaders }).then((r) => r.json()).then((j) => {
      if (j.success && j.data) { setCustId(j.data.id || null); if (j.data.name) setName(j.data.name); setPhone(j.data.phone || ""); setEmail(j.data.email || "") }
    }).catch(() => {})
    fetch("/api/core/storefront/addresses", { headers: authHeaders }).then((r) => r.json()).then((j) => {
      if (j.success) { const list: Addr[] = j.data || []; setAddresses(list); const def = list.find((a) => a.isDefault) || list[0]; if (def) setSelAddr(def.id) }
    }).catch(() => {})
  }, [isAuthenticated, token, authHeaders])

  const missingPhone = !phone.trim()
  // A logged-in customer is NEVER asked for email at checkout — email is optional
  // and edited from My Profile. Profile completion only appears when the phone is
  // genuinely missing (needed operationally for pickup contact).
  const profileIncomplete = isAuthenticated && missingPhone

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch("/api/core/storefront/profile", { method: "PUT", headers: authHeaders, body: JSON.stringify({ phone, email }) })
      const j = await res.json(); if (!res.ok || !j.success) throw new Error(j.error || "Could not save profile")
      toast.success("Profile updated")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSavingProfile(false) }
  }
  const saveAddress = async () => {
    if (!addrForm.addressLine1.trim() || !addrForm.city.trim() || !addrForm.pincode.trim()) { toast.error("Address line, city and PIN code are required"); return }
    setSavingAddr(true)
    try {
      const res = await fetch("/api/core/storefront/addresses", { method: "POST", headers: authHeaders, body: JSON.stringify(addrForm) })
      const j = await res.json(); if (!res.ok || !j.success) throw new Error(j.error || "Could not save address")
      const a: Addr = j.data; setAddresses((p) => [a, ...p]); setSelAddr(a.id); setShowAddAddr(false); toast.success("Address saved")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSavingAddr(false) }
  }

  const gq = gSearch.trim().toLowerCase()
  const visibleItems = gq ? service.items.filter((it) => it.garmentName.toLowerCase().includes(gq)) : service.items
  const selected = service.items.filter((it) => (qty[it.garmentId] || 0) > 0)
  // Only PER_PIECE / FIXED garment lines have a final price at booking. PER_KG
  // lines (unit "kg") are priced ONCE by the total order weight measured at Store
  // Audit — they carry a quantity for inventory but no subtotal here.
  const pieceSelected = selected.filter((it) => it.unit !== "kg")
  const kgSelected = selected.filter((it) => it.unit === "kg")
  // A PER_KG element is present when the whole service is weight-based OR any
  // selected garment is priced per kg → show "measured at Store Audit", no total.
  const hasKgPortion = isPerKg || kgSelected.length > 0
  // Booking subtotal = per-piece lines only. It NEVER includes a PER_KG amount.
  const clientSubtotal = pieceSelected.reduce((s, it) => s + (it.unitPrice || 0) * (qty[it.garmentId] || 0), 0)
  const canContinue = isBag ? true : isPerKg ? (Number(weightKg) || 0) > 0 : selected.length > 0
  const bump = (id: string, d: number) => setQty((p) => ({ ...p, [id]: Math.max(0, (p[id] || 0) + d) }))
  const accentBg = { backgroundColor: brandColor }
  // The order ALWAYS reflects the whole cart (every service), so one checkout
  // places one multi-service order — the cart is the single source of truth.
  const orderItems = () => cartToOrderItems(cartItems)

  // Add THIS service's selection to the shared cart, ACCUMULATING alongside any
  // other services already in the bag (re-adding a service edits its own lines).
  // The subscription line and other workspaces' lines are never touched.
  const addToCart = () => {
    const others = cartItems.filter((l) => !(l.kind === "laundry" && l.serviceId === service.id))
    const mine = isBag
      ? [makeBagLine({ serviceId: service.id, serviceName: service.name })]
      : isPerKg
        ? [makePerKgLine({ serviceId: service.id, serviceName: service.name, weightKg: Number(weightKg) || 0, unitPrice: service.perKg?.price ?? null, gstPercent: service.perKg?.gstPercent ?? null })]
        : selected.map((it) => makeGarmentLine({ serviceId: service.id, serviceName: service.name, garmentId: it.garmentId, garmentName: it.garmentName, unitPrice: it.unitPrice, unit: it.unit, pricingType: it.pricingType, gstPercent: it.gstPercent, quantity: qty[it.garmentId] || 0 }))
    replaceItems([...others, ...mine])
    toast.success(isBag ? "Pickup bag added" : "Added to your bag")
    onClose()
  }

  // Validate a coupon (read-only) via the Marketing evaluate API. Laundry → the
  // discount is "pending" (applied after Store Audit).
  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponBusy(true)
    try {
      const res = await fetch("/api/core/marketing/evaluate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, workspaceType: "LAUNDRY", customerId: custId || undefined, code: couponCode.trim(), orderValue: cartSubtotalPieces, applyTo: "ORDER" }),
      })
      const j = await res.json()
      if (!j.success) { setCouponMsg({ ok: false, text: j.error || "Invalid coupon code.", code: "", pending: false }); return }
      setCouponMsg({ ok: true, text: j.data.message, code: couponCode.trim().toUpperCase(), pending: !!j.data.pending })
    } catch { setCouponMsg({ ok: false, text: "Could not apply coupon. Try again.", code: "", pending: false }) } finally { setCouponBusy(false) }
  }
  const removeCoupon = () => { setCouponMsg(null); setCouponCode("") }
  // Record the redemption after a successful order (best-effort; never blocks).
  const recordCoupon = (orderId: string | null) => {
    if (!couponMsg?.ok) return
    fetch("/api/core/marketing/apply", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, workspaceType: "LAUNDRY", customerId: custId || undefined, code: couponMsg.code, orderValue: cartSubtotalPieces, applyTo: "ORDER", orderId }),
    }).catch(() => {})
  }

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
    // Email is NEVER required (optional; edited from My Profile). Only name +
    // mobile (identity) and a pickup address/date are needed to place an order.
    if (!selAddr && !addrForm.addressLine1.trim()) { toast.error("Add a pickup address"); return }
    if (!date) { toast.error("Select a pickup date"); return }
    const customerPayload = { id: custId || undefined, name, phone, email }
    const structured = { fullName: name, phone, label: addrForm.label, addressLine1: addrForm.addressLine1, addressLine2: null as string | null, area: addrForm.area, landmark: addrForm.landmark, city: addrForm.city, state: addrForm.state, pincode: addrForm.pincode }
    setSubmitting(true); setLimitNotice(null)
    try {
      // ── Feature 1: persist first-order profile + address ONCE for an
      // authenticated customer, reusing the EXISTING profile/address APIs (no new
      // endpoints, no engine change). After this, mobile + address auto-populate
      // and the customer is never asked again on later orders.
      let pickupAddressId = selAddr || undefined
      if (isAuthenticated) {
        if (profileIncomplete && phone.trim()) {
          await fetch("/api/core/storefront/profile", { method: "PUT", headers: authHeaders, body: JSON.stringify({ phone, email }) }).catch(() => null)
        }
        if (!pickupAddressId && addrForm.addressLine1.trim()) {
          try {
            const ares = await fetch("/api/core/storefront/addresses", { method: "POST", headers: authHeaders, body: JSON.stringify(addrForm) })
            const aj = await ares.json()
            if (ares.ok && aj.success && aj.data?.id) { pickupAddressId = aj.data.id; setAddresses((p) => [aj.data, ...p]); setSelAddr(aj.data.id) }
          } catch { /* fall back to the inline order snapshot below */ }
        }
      }
      const pickupPayload = { addressId: pickupAddressId, structured: (!pickupAddressId && addrForm.addressLine1.trim()) ? structured : undefined, date: date || null, timeSlot: slot }
      // Buying a subscription plan in this cart → combined checkout: garments make
      // a real order (normal prices), the plan becomes a pending customer due.
      // The new plan does NOT cover this order (first-order rule).
      if (subscriptionInCart) {
        const res = await fetch("/api/core/storefront/laundry-checkout", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ businessId, items: orderItems(), subscriptionPlanId: subscriptionInCart.id, customer: customerPayload, pickup: pickupPayload, paymentMethod: "COD" }),
        })
        const j = await res.json()
        if (!res.ok || !j.success) throw new Error(j.error || "Checkout failed")
        setCombined({ orderNumber: j.data.order?.orderNumber || "—", laundryCharges: j.data.allocation.laundryCharges, subscriptionDue: j.data.allocation.subscriptionDue, totalDue: j.data.allocation.totalDue, planName: j.data.subscription?.planName || subscriptionInCart.name })
        recordCoupon(j.data.order?.id || null); clearCart(); setStep("success")
        return
      }
      const res = await fetch("/api/core/storefront/laundry-order", {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({
          businessId,
          items: orderItems(),
          services: cartBagServices(cartItems), // Pickup-First (Bag) services — no items; counted at audit
          customer: customerPayload,
          pickup: pickupPayload,
          useSubscription: useSub, forceNormal: force || forceNormal,
        }),
      })
      const j = await res.json()
      if (j.noSubscription) { setUseSub(false); setShowSubRequired(true); setSubmitting(false); return }
      if (j.needsNormalOrder) { setLimitNotice(j.reason || "Subscription limit reached."); setForceNormal(true); setUseSub(false); setSubmitting(false); return }
      if (!res.ok || !j.success) throw new Error(j.error || "Order failed")
      setResult(j.data); recordCoupon(j.data?.id || null); clearCart(); setStep("success")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Order failed") } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900">
              {preAuth ? "Sign In" : step === "select" ? service.name : "Checkout"}
            </p>
            <p className="text-xs text-gray-400">
              {preAuth ? "Complete your account" : step === "select" ? "Choose garments & quantity" : step === "details" ? "Pickup details" : "Pickup scheduled"}
            </p>
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
                {plans[0] && <button onClick={() => { addSubscription(plans[0]); setShowSubRequired(false); setUseSub(false); toast.success(`${plans[0].name} added to cart — pay at checkout`) }} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white" style={accentBg}>Add Subscription to Cart</button>}
                <button onClick={() => { setShowSubRequired(false); setUseSub(false) }} className="w-full rounded-xl py-2.5 text-sm font-semibold border border-gray-200 text-gray-600">Continue Without Subscription</button>
              </div>
              <p className="mt-2 text-center text-[11px] text-gray-400">A plan added now applies from your next order (this order is billed normally).</p>
            </div>
          </div>
        )}

        {/* ── Pre-checkout Auth Gate (unauthenticated users) ── */}
        {preAuth && !isAuthenticated && (<>
          <div className="overflow-y-auto px-5 py-4 flex-1">
            {preAuth === "email" && (
              <div className="space-y-4 max-w-xs mx-auto pt-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3"><Mail className="w-5 h-5 text-gray-500" /></div>
                  <h2 className="text-base font-bold text-gray-900">Sign in to continue</h2>
                  <p className="text-xs text-gray-500 mt-1">Enter your email to get started</p>
                </div>
                <input type="email" placeholder="Email Address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handlePreCheckEmail()} className="w-full h-11 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" autoFocus />
                {authError && <p className="text-xs text-red-500">{authError}</p>}
                <button onClick={handlePreCheckEmail} disabled={authLoading || !authEmail} className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50" style={accentBg}>
                  {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
                </button>
              </div>
            )}
            {preAuth === "login" && (
              <div className="space-y-4 max-w-xs mx-auto pt-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3"><Lock className="w-5 h-5 text-blue-500" /></div>
                  <h2 className="text-base font-bold text-gray-900">Welcome back</h2>
                  <p className="text-xs text-gray-500 mt-1">{authEmail}</p>
                  <button onClick={() => { setAuthEmail(""); setPreAuth("email"); setAuthError("") }} className="text-xs text-gray-400 hover:text-gray-600 underline mt-1">Not you?</button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showPassword ? "text" : "password"} placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handlePreLogin()} className="w-full h-11 pl-10 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" autoFocus />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">{showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}</button>
                </div>
                <button onClick={() => setPreAuth("forgot")} className="text-xs text-gray-500 hover:text-gray-700 underline">Forgot password?</button>
                {authError && <p className="text-xs text-red-500">{authError}</p>}
                <button onClick={handlePreLogin} disabled={authLoading || !authPassword} className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50" style={accentBg}>
                  {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Login"}
                </button>
              </div>
            )}
            {preAuth === "register" && (
              <div className="space-y-4 max-w-xs mx-auto pt-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3"><User className="w-5 h-5 text-green-500" /></div>
                  <h2 className="text-base font-bold text-gray-900">Create Account</h2>
                  <p className="text-xs text-gray-500 mt-1">{authEmail}</p>
                  <button onClick={() => { setAuthEmail(""); setPreAuth("email"); setAuthError("") }} className="text-xs text-gray-400 hover:text-gray-600 underline mt-1">Use different email</button>
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Full Name *" value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="tel" placeholder="Mobile Number *" value={regPhone} onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showPassword ? "text" : "password"} placeholder="Password (min 8 chars) *" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="w-full h-11 pl-10 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">{showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}</button>
                </div>
                {authError && <p className="text-xs text-red-500">{authError}</p>}
                <button onClick={handlePreRegister} disabled={authLoading || !regName || !regPhone || !regPassword} className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50" style={accentBg}>
                  {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
                </button>
                <p className="text-xs text-center text-gray-400">We'll send a verification code to your email</p>
              </div>
            )}
            {preAuth === "otp" && (
              <div className="space-y-4 max-w-xs mx-auto pt-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-3"><Mail className="w-5 h-5 text-purple-500" /></div>
                  <h2 className="text-base font-bold text-gray-900">Verify Email</h2>
                  <p className="text-xs text-gray-500 mt-1">Enter the code sent to {authEmail}</p>
                </div>
                <input type="text" placeholder="Verification code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && handlePreVerifyOtp()} className="w-full h-11 text-center text-lg tracking-widest border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" autoFocus />
                {authError && <p className="text-xs text-red-500">{authError}</p>}
                <button onClick={handlePreVerifyOtp} disabled={authLoading || otp.length < 4} className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50" style={accentBg}>
                  {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Continue"}
                </button>
              </div>
            )}
            {preAuth === "forgot" && (
              <div className="space-y-4 max-w-xs mx-auto pt-4">
                <div className="text-center">
                  <h2 className="text-base font-bold text-gray-900">Reset Password</h2>
                  <p className="text-xs text-gray-500 mt-1">We'll send reset instructions to {authEmail}</p>
                </div>
                {authError && <p className="text-xs text-red-500">{authError}</p>}
                <button onClick={handlePreForgot} disabled={authLoading} className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50" style={accentBg}>
                  {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
                </button>
                <button onClick={() => setPreAuth("login")} className="w-full text-sm text-gray-500 hover:text-gray-700">Back to login</button>
              </div>
            )}
            {preAuth === "profile" && (
              <div className="space-y-4 max-w-xs mx-auto pt-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-3"><User className="w-5 h-5 text-orange-500" /></div>
                  <h2 className="text-base font-bold text-gray-900">Complete Your Profile</h2>
                  <p className="text-xs text-gray-500 mt-1">We need your name and mobile number</p>
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Full Name *" value={gateProfileName} onChange={(e) => setGateProfileName(e.target.value)} className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" autoFocus />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="tel" placeholder="Mobile Number *" value={gateProfilePhone} onChange={(e) => setGateProfilePhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
                </div>
                {authError && <p className="text-xs text-red-500">{authError}</p>}
                <button onClick={handleGateSaveProfile} disabled={gateSaving || !gateProfileName || !gateProfilePhone} className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50" style={accentBg}>
                  {gateSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Continue"}
                </button>
              </div>
            )}
            {preAuth === "address" && (
              <div className="space-y-4 max-w-xs mx-auto pt-2">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3"><MapPin className="w-5 h-5 text-gray-500" /></div>
                  <h2 className="text-base font-bold text-gray-900">Pickup Address</h2>
                  <p className="text-xs text-gray-500 mt-1">Where should we pick up from?</p>
                </div>
                {gateAddresses.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {gateAddresses.map((a) => (
                      <button key={a.id} onClick={() => { setGateAddrId(a.id); setPreAuth(null); setGatePassed(true); setStep("details") }}
                        className={`w-full text-left rounded-lg border p-3 text-sm ${gateAddrId === a.id ? "border-2" : "border-gray-200"}`}
                        style={gateAddrId === a.id ? { borderColor: brandColor } : {}}>
                        <span className="text-[10px] font-bold uppercase text-gray-400">{a.label || "Address"}</span>
                        <p className="text-gray-700 text-xs mt-0.5">{a.addressLine1}, {a.city} - {a.pincode}</p>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs font-semibold text-gray-600">Add a new address</p>
                <div className="flex gap-1.5">{[{ k: "Home", v: "HOME" }, { k: "Office", v: "OFFICE" }, { k: "Other", v: "OTHER" }].map((t) => (
                  <button key={t.k} onClick={() => setGateAddrForm((f) => ({ ...f, label: t.k }))} className={`rounded-lg px-2.5 py-1 text-xs border ${gateAddrForm.label === t.k ? "text-white border-transparent" : "border-gray-200 text-gray-600"}`} style={gateAddrForm.label === t.k ? accentBg : {}}>{t.k}</button>
                ))}</div>
                <input value={gateAddrForm.addressLine1} onChange={(e) => setGateAddrForm((f) => ({ ...f, addressLine1: e.target.value }))} placeholder="Flat / Building / Street *" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" />
                <input value={gateAddrForm.area} onChange={(e) => setGateAddrForm((f) => ({ ...f, area: e.target.value }))} placeholder="Area / Locality" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" />
                <input value={gateAddrForm.landmark} onChange={(e) => setGateAddrForm((f) => ({ ...f, landmark: e.target.value }))} placeholder="Landmark (optional)" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={gateAddrForm.city} onChange={(e) => setGateAddrForm((f) => ({ ...f, city: e.target.value }))} placeholder="City *" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" />
                  <input value={gateAddrForm.pincode} onChange={(e) => setGateAddrForm((f) => ({ ...f, pincode: e.target.value }))} placeholder="Pincode *" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" />
                </div>
                <select value={gateAddrForm.state} onChange={(e) => setGateAddrForm((f) => ({ ...f, state: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none bg-white text-gray-700">
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
                {authError && <p className="text-xs text-red-500">{authError}</p>}
                <button onClick={handleGateSaveAddress} disabled={gateSaving || !gateAddrForm.addressLine1 || !gateAddrForm.city || !gateAddrForm.pincode} className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50" style={accentBg}>
                  {gateSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Continue to Checkout"}
                </button>
              </div>
            )}
          </div>
        </>)}
        {preAuth && !isAuthenticated && (
          <div className="border-t border-gray-100 px-5 py-3">
            <button onClick={onClose} className="w-full rounded-xl py-2.5 text-sm font-semibold border border-gray-200 text-gray-600">Cancel</button>
          </div>
        )}

        {/* STEP: select garments (or weight for PER_KG services) */}
        {step === "select" && !preAuth && (<>
          {isBag ? (
            <div className="overflow-y-auto px-5 py-6 flex-1 space-y-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-white flex items-center justify-center" style={{ color: brandColor }}><PackageCheck className="w-6 h-6" /></div>
                <p className="mt-2 text-sm font-semibold text-gray-900">Pickup-First Service</p>
                <p className="mt-1 text-xs text-gray-500">No need to count garments. We collect your clothes for <b>{service.name}</b> in a dedicated bag and count them at Store Audit — you only book the pickup.</p>
              </div>
              <ul className="text-xs text-gray-500 space-y-1.5">
                <li>• One bag for this service</li>
                <li>• Garments counted &amp; priced after Store Audit</li>
                <li>• Schedule pickup at the next step</li>
              </ul>
            </div>
          ) : isPerKg ? (
            <div className="overflow-y-auto px-5 py-4 flex-1 space-y-3">
              <p className="text-sm text-gray-600">This service is priced by weight at <b>{inr(service.perKg?.price)} / kg</b>{service.perKg?.minWeightKg ? ` (min ${service.perKg.minWeightKg} kg)` : ""}.</p>
              <Field label="Estimated Weight (kg)"><input type="number" min={0} step="0.5" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" placeholder="e.g. 3" /></Field>
              <p className="text-[11px] text-gray-400">This is only an estimate. Final weight will be measured during Store Audit, and your invoice is generated after the audit.</p>
            </div>
          ) : (
            <div className="overflow-y-auto px-5 py-3 flex-1">
              {service.items.length > 8 && (
                <div className="relative mb-2 sticky top-0 bg-white pt-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={gSearch} onChange={(e) => setGSearch(e.target.value)} placeholder="Search garments…" className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none" /></div>
              )}
              {visibleItems.map((it) => (
                <div key={it.garmentId} className="flex items-center justify-between py-2.5 border-b border-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{it.garmentName}</p>
                    <p className="text-xs text-gray-500">{inr(it.unitPrice)} / {it.unit}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => bump(it.garmentId, -1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center active:bg-gray-50"><Minus className="w-3.5 h-3.5 text-gray-600" /></button>
                    <span className="w-5 text-center text-sm font-semibold">{qty[it.garmentId] || 0}</span>
                    <button onClick={() => bump(it.garmentId, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white active:opacity-80" style={accentBg}><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
              {visibleItems.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">No garments match “{gSearch}”.</p>}
            </div>
          )}
          <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/60">
            {!isBag && !isPerKg && selected.length > 0 && <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{selected.reduce((s, it) => s + (qty[it.garmentId] || 0), 0)} item(s) selected</span></div>}
            {isBag ? null : hasKgPortion ? (
              <div className="mb-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold text-amber-800">Estimated booking</p>
                <p className="text-[11px] text-amber-700">Final weight will be measured during Store Audit. Your invoice is generated after the audit.</p>
                {pieceSelected.length > 0 && <div className="mt-1.5 flex justify-between text-xs text-amber-900"><span>Per-piece items</span><span className="font-semibold">{inr(clientSubtotal)}</span></div>}
              </div>
            ) : (
              <div className="flex justify-between text-sm mb-2"><span className="text-gray-500">Subtotal</span><span className="font-semibold">{inr(clientSubtotal)}</span></div>
            )}
            <button disabled={!canContinue} onClick={addToCart} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40 active:opacity-80 flex items-center justify-center gap-1.5" style={accentBg}><Plus className="w-4 h-4" /> {isBag ? "Add Pickup Bag" : "Add to Cart"}</button>
            <p className="mt-1.5 text-center text-[11px] text-gray-400">Keep shopping and add more services — pickup details are entered at checkout.</p>
          </div>
        </>)}

        {/* STEP: pickup details (only accessible after auth gate passes) */}
        {step === "details" && gatePassed && (<>
          <div className="overflow-y-auto px-5 py-4 flex-1 space-y-3">
            <div><p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Order Review</p>
              <div className="rounded-xl border border-gray-100 p-3 space-y-2">
                {/* Grouped by service — every service in the cart, never a flat list. */}
                {cartGroups.map((g) => (
                  <div key={g.serviceId} className="space-y-0.5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{g.serviceName}</p>
                    {g.lines.map((l) => (
                      <div key={`${l.productId}-${l.variantId}`} className="flex justify-between text-sm pl-1">
                        <span className="text-gray-600">{l.bagMode ? "Pickup bag" : l.garmentId ? `${l.quantity} × ${l.name}` : `~${l.weightKg || "?"} kg (est.)`}</span>
                        {l.billedAfterAudit ? <span className="text-xs font-medium text-amber-700">Cloth count would be post service</span> : <span className="font-medium">{inr(l.price * l.quantity)}</span>}
                      </div>
                    ))}
                  </div>
                ))}
                {cartSubtotalPieces > 0 && <div className="flex justify-between text-sm pt-1 border-t border-gray-50"><span className="text-gray-500">Laundry Services</span><span className="font-medium">{inr(cartSubtotalPieces)}</span></div>}
                {cartKgPortion && <p className="text-[11px] text-amber-700">Weight-based items are measured during Store Audit; those charges are invoiced after the audit.</p>}
                {subscriptionInCart && (
                  <div className="flex justify-between text-sm items-start">
                    <span className="text-gray-500">Subscription · {subscriptionInCart.name}<br /><span className="text-[10px] text-gray-400">Pay now, applies from next order</span></span>
                    <span className="font-medium">{inr(subscriptionInCart.price)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-1 border-t border-gray-100 mt-1"><span className="font-semibold text-gray-700">Total Due{cartKgPortion ? " (now)" : ""}</span><span className="font-bold" style={{ color: brandColor }}>{inr(cartSubtotalPieces + (subscriptionInCart?.price || 0))}</span></div>
              </div>
            </div>

            {/* Coupon (Marketing Engine) */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Coupon</p>
              {couponMsg?.ok ? (
                <div className="flex items-start justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-700">{couponMsg.code} applied{couponMsg.pending ? " · Discount Pending" : ""}</p>
                    <p className="text-[11px] text-emerald-600">{couponMsg.text}</p>
                  </div>
                  <button onClick={removeCoupon} className="text-[11px] font-semibold text-gray-500 shrink-0 ml-2">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Enter coupon code" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none uppercase" />
                  <button onClick={applyCoupon} disabled={couponBusy || !couponCode.trim()} className="rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-40" style={accentBg}>{couponBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}</button>
                </div>
              )}
              {couponMsg && !couponMsg.ok && <p className="mt-1 text-[11px] text-rose-600">{couponMsg.text}</p>}
            </div>

            {/* Customer identity — always authenticated at this step */}
            <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 text-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Ordering As</p>
              <p className="font-semibold text-gray-800">{name || authCustomer?.name}</p>
              {phone && <p className="text-xs text-gray-500">{maskPhone(phone)}</p>}
            </div>

            {/* Structured pickup address (shared Address model) */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Pickup Address <span className="normal-case font-normal text-gray-400">· we return your order here</span></p>
              {isAuthenticated && addresses.length > 0 && !showAddAddr ? (
                <div className="space-y-2">
                  {addresses.map((a) => (
                    <button key={a.id} onClick={() => setSelAddr(a.id)} className={`w-full text-left rounded-lg border p-2.5 text-sm ${selAddr === a.id ? "border-2" : "border-gray-200"}`} style={selAddr === a.id ? { borderColor: brandColor } : {}}>
                      <span className="text-[10px] font-bold uppercase text-gray-400">{a.label || "Home"}{a.isDefault ? " · Default" : ""}{selAddr === a.id ? " · Selected" : ""}</span>
                      <p className="text-gray-700">{fmtAddr(a)}</p>
                    </button>
                  ))}
                  <button onClick={() => setShowAddAddr(true)} className="text-xs font-semibold" style={{ color: brandColor }}>+ Add New Address</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-1.5">{["Home", "Office", "Other"].map((t) => <button key={t} onClick={() => setAddrForm((f) => ({ ...f, label: t }))} className={`rounded-lg px-2.5 py-1 text-xs border ${addrForm.label === t ? "text-white border-transparent" : "border-gray-200 text-gray-600"}`} style={addrForm.label === t ? accentBg : {}}>{t}</button>)}</div>
                  <input value={addrForm.addressLine1} onChange={(e) => setAddrForm((f) => ({ ...f, addressLine1: e.target.value }))} placeholder="Flat / House / Building *" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" />
                  <input value={addrForm.area} onChange={(e) => setAddrForm((f) => ({ ...f, area: e.target.value }))} placeholder="Street / Area / Locality" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" />
                  <input value={addrForm.landmark} onChange={(e) => setAddrForm((f) => ({ ...f, landmark: e.target.value }))} placeholder="Landmark (optional)" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={addrForm.pincode} onChange={(e) => setAddrForm((f) => ({ ...f, pincode: e.target.value }))} placeholder="PIN Code *" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" />
                    <input value={addrForm.city} onChange={(e) => setAddrForm((f) => ({ ...f, city: e.target.value }))} placeholder="City *" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" />
                  </div>
                  <select value={addrForm.state} onChange={(e) => setAddrForm((f) => ({ ...f, state: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none bg-white text-gray-700">
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                  {isAuthenticated && (
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={addrForm.isDefault} onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))} /> Make default</label>
                      <div className="flex gap-2">
                        {addresses.length > 0 && <button onClick={() => setShowAddAddr(false)} className="text-xs text-gray-500 px-2">Cancel</button>}
                        <button onClick={saveAddress} disabled={savingAddr} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white inline-flex items-center gap-1" style={accentBg}>{savingAddr && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Address</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pickup Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" /></Field>
              <Field label="Time Slot">
                <select value={slot} onChange={(e) => setSlot(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none bg-white">
                  {["Morning (9AM–12PM)", "Afternoon (12PM–4PM)", "Evening (4PM–8PM)"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            {!subscriptionInCart && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={useSub} disabled={checkingSub} onChange={(e) => onToggleSub(e.target.checked)} />
                Use my subscription allowance {checkingSub && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
              </label>
            )}
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
            <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600">Back</button>
            <button disabled={submitting} onClick={() => submit(forceNormal)} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white active:opacity-80 flex items-center justify-center gap-2" style={accentBg}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {subscriptionInCart ? "Place Order · Pay at Pickup" : forceNormal ? "Continue as Normal Order" : "Confirm Order"}
            </button>
          </div>
        </>)}

        {/* STEP: success — combined (garments + subscription bought together) */}
        {step === "success" && combined && (
          <div className="px-6 py-8 text-center overflow-y-auto">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-8 h-8 text-emerald-600" /></div>
            <h2 className="mt-3 text-lg font-bold text-gray-900">Order Placed</h2>
            <p className="text-sm text-gray-500">Pay at pickup / collection. Your subscription activates once its due is paid.</p>
            <div className="mt-4 rounded-xl border border-gray-100 p-4 text-left text-sm space-y-1.5">
              <Row k="Order ID" v={combined.orderNumber} mono />
              <Row k="Laundry Charges" v={inr(combined.laundryCharges)} />
              <Row k={`Subscription · ${combined.planName}`} v={inr(combined.subscriptionDue)} />
              <div className="pt-1.5 mt-1.5 border-t border-gray-100" />
              <Row k="Total Due" v={inr(combined.totalDue)} />
              <Row k="Subscription Status" v="Payment Pending · allowance not active" />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => { onClose(); nav.go("orders") }} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white active:opacity-80" style={accentBg}>View My Orders</button>
              <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600">Close</button>
            </div>
          </div>
        )}

        {/* STEP: success — plain order */}
        {step === "success" && result && !combined && (
          <div className="px-6 py-8 text-center overflow-y-auto">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-8 h-8 text-emerald-600" /></div>
            <h2 className="mt-3 text-lg font-bold text-gray-900">Pickup Scheduled</h2>
            <p className="text-sm text-gray-500">Your laundry order has been created successfully.</p>
            <div className="mt-4 rounded-xl border border-gray-100 p-4 text-left text-sm space-y-1.5">
              <Row k="Order ID" v={result.orderNumber} mono />
              <Row k="Pickup" v={`${result.pickup.date ? new Date(result.pickup.date).toLocaleDateString() : "—"} · ${result.pickup.timeSlot || "—"}`} />
              {hasKgPortion ? (<>
                <Row k="Estimated Total" v={inr(result.grandTotal)} />
                <p className="text-[11px] text-amber-700">Final weight is measured during Store Audit; your invoice is generated after the audit.</p>
              </>) : (
                <Row k="Order Total" v={inr(result.grandTotal)} />
              )}
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

// Subscription-only checkout (Case B) — plan added to cart, no garments. Places
// a COD/pay-later purchase (pending customer due); allowance activates only when
// the subscription is paid at collection. Reuses the shared checkout endpoint.
function SubscriptionCheckoutSheet({ plan, businessId, brandColor, token, authCustomer, onDone, onClose }: { plan: Plan; businessId: string; brandColor: string; token: string | null; authCustomer: AuthCustomer; onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState(authCustomer?.name || ""); const [phone, setPhone] = useState(authCustomer?.phone || "")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ due: number } | null>(null)
  const accentBg = { backgroundColor: brandColor }
  const place = async () => {
    // A logged-in customer is identified server-side from the auth token — their
    // name/phone/email + customerId are authoritative and never re-asked here.
    // Only guests must provide name + phone.
    if (!authCustomer && (!name.trim() || !phone.trim())) { toast.error("Name and phone are required"); return }
    setSubmitting(true)
    try {
      const res = await fetch("/api/core/storefront/laundry-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ businessId, subscriptionPlanId: plan.id, ...(authCustomer ? {} : { customer: { name, phone } }), paymentMethod: "COD" }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error === "PROFILE_INCOMPLETE" ? "Please add your name and phone to your profile before subscribing." : (j.error || "Checkout failed"))
      setDone({ due: j.data.allocation.totalDue })
    } catch (e) { toast.error(e instanceof Error ? e.message : "Checkout failed") } finally { setSubmitting(false) }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"><p className="font-bold text-gray-900">{plan.name}</p><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-50"><X className="w-4 h-4 text-gray-500" /></button></div>
        {done ? (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center"><CreditCard className="w-7 h-7 text-amber-600" /></div>
            <h2 className="mt-3 text-lg font-bold text-gray-900">Subscription Requested</h2>
            <p className="text-sm text-gray-500 mt-1">Amount due <b>{inr(done.due)}</b>. Your plan activates once the payment is collected. No allowance is available yet.</p>
            <button onClick={onDone} className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white" style={accentBg}>Done</button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            <div className="rounded-xl border border-gray-100 p-3 text-sm space-y-1">
              <Row k="Plan Price" v={inr(plan.price)} />
              <Row k="Billing" v={plan.billingCycle.charAt(0) + plan.billingCycle.slice(1).toLowerCase()} />
              <Row k="Included" v={`${plan.totalCredits} clothes`} />
              <Row k="Order Limit" v={plan.maxOrdersPerCycle ? `Max ${plan.maxOrdersPerCycle} orders / cycle` : "Unlimited"} />
              <div className="pt-1 mt-1 border-t border-gray-100"><Row k="Amount Due" v={inr(plan.price)} /></div>
            </div>
            {authCustomer ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 text-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Subscribing As</p><p className="font-semibold text-gray-800">{authCustomer.name}</p><p className="text-xs text-gray-500">{authCustomer.email && maskEmail(authCustomer.email)}{authCustomer.email && authCustomer.phone ? " · " : ""}{maskPhone(authCustomer.phone)}</p></div>
            ) : (<>
              <Field label="Full Name"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" placeholder="Your name" /></Field>
              <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" placeholder="10-digit mobile" /></Field>
            </>)}
            <button disabled={submitting} onClick={place} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white active:opacity-80 flex items-center justify-center gap-2" style={accentBg}>{submitting && <Loader2 className="w-4 h-4 animate-spin" />} Place Subscription · Pay Later</button>
            <p className="text-[10px] text-gray-400 text-center">Online payment gateway isn\'t exercised here; the plan activates only after a verified/collected payment.</p>
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
