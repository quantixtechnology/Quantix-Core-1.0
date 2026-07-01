"use client"

// New Order — the store counter intake. ONE job: create the order with its
// garments. Fast flow: Customer (mobile → load/create) → Service → Garments
// (tap +) → Order Type → Create (PENDING_STORE_AUDIT). No payment collection,
// no manual delivery date, no CRM. Garments are recorded here so Store Audit
// only inspects them.

import { useState, useEffect, useMemo, useRef } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search, User, Phone, Loader2, Plus, Minus, Send, Clock, Check,
  Shirt, WashingMachine, CreditCard, X,
} from "lucide-react"
import type { BillingQuote } from "@/lib/laundry-billing"

const ORDER_TYPES = [
  { value: "WALK_IN", label: "Walk-In", customerType: "WALK_IN" },
  { value: "CORPORATE", label: "Corporate", customerType: "CORPORATE" },
  { value: "SUBSCRIPTION", label: "Subscription", customerType: "SUBSCRIPTION" },
]
const PAYMENT_PREFS = [
  { value: "COD", label: "COD" },
  { value: "PAY_LATER", label: "Paid Later" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "CASH", label: "Cash" },
]

interface CustomerResult { id: string; name: string; phone: string | null; customerCode: string | null }
interface ServiceMaster { id: string; name: string; categoryId: string | null; defaultTurnaroundHours: number; availableInStore: boolean; isActive: boolean }
interface GarmentMaster { id: string; name: string; categoryId: string | null; defaultUnit: string; isActive: boolean }

const inr = (n: number) => `₹${n.toFixed(2)}`
const fmtReady = (d: Date) => `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`

export default function LaundryNewOrder() {
  const { currentBusinessId, user } = useAuthStore()
  const { setLaundryPage } = useAdminStore()
  const { toast } = useToast()

  // Customer
  const [mobile, setMobile] = useState("")
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [matches, setMatches] = useState<CustomerResult[]>([])
  const [customer, setCustomer] = useState<CustomerResult | null>(null)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)

  // Order
  const [orderType, setOrderType] = useState("WALK_IN")
  const [paymentPref, setPaymentPref] = useState("COD")
  const [services, setServices] = useState<ServiceMaster[]>([])
  const [garments, setGarments] = useState<GarmentMaster[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState("")
  const [garmentSearch, setGarmentSearch] = useState("")
  const [qty, setQty] = useState<Record<string, number>>({})
  const [weight, setWeight] = useState<Record<string, number>>({})

  const [stores, setStores] = useState<{ id: string; storeName: string }[]>([])
  const [storeId, setStoreId] = useState("")
  const [quote, setQuote] = useState<BillingQuote | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const customerType = useMemo(() => ORDER_TYPES.find((o) => o.value === orderType)?.customerType || "WALK_IN", [orderType])

  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/businesses/${currentBusinessId}`).then((r) => r.json()).then((biz) => {
      if (biz.stores?.length) { setStores(biz.stores); setStoreId((p) => p || biz.stores[0].id) }
    }).catch(() => {})
    fetch(`/api/laundry/services?businessId=${currentBusinessId}`).then((r) => r.json())
      .then((j) => { if (j.success) { const list = (j.data as ServiceMaster[]).filter((s) => s.isActive && s.availableInStore); setServices(list); setSelectedServiceId((p) => p || list[0]?.id || "") } }).catch(() => {})
    fetch(`/api/laundry/garments?businessId=${currentBusinessId}`).then((r) => r.json())
      .then((j) => { if (j.success) setGarments((j.data as GarmentMaster[]).filter((g) => g.isActive)) }).catch(() => {})
  }, [currentBusinessId])

  const selectedService = services.find((s) => s.id === selectedServiceId)

  // Garments applicable to the chosen service (by category), fallback to all so
  // the operator never sees an empty list. Drives the order lines + totals.
  const serviceGarments = useMemo(() => {
    if (selectedService?.categoryId) {
      const inCat = garments.filter((g) => g.categoryId === selectedService.categoryId)
      if (inCat.length) return inCat
    }
    return garments
  }, [garments, selectedService])

  // Text search filters the DISPLAY only (not the counted lines).
  const displayGarments = useMemo(() => {
    const q = garmentSearch.trim().toLowerCase()
    return q ? serviceGarments.filter((g) => g.name.toLowerCase().includes(q)) : serviceGarments
  }, [serviceGarments, garmentSearch])

  const lines = useMemo(() => {
    if (!selectedServiceId) return []
    return serviceGarments.map((g) => {
      const byWeight = g.defaultUnit === "KG"
      const q = byWeight ? 0 : (qty[g.id] || 0)
      const w = byWeight ? (weight[g.id] || 0) : 0
      return { garment: g, serviceId: selectedServiceId, garmentId: g.id, quantity: q, weightKg: w }
    }).filter((l) => l.quantity > 0 || l.weightKg > 0)
  }, [serviceGarments, selectedServiceId, qty, weight])

  const totalPieces = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines])

  // Auto delivery date = now + selected service TAT (operator does not decide).
  const expectedDelivery = useMemo(() => {
    const tat = selectedService?.defaultTurnaroundHours || 0
    if (!tat) return null
    const d = new Date(); d.setHours(d.getHours() + tat); return d
  }, [selectedService])

  // Live estimate from the Pricing Engine (final amount confirmed at audit).
  const quoteKey = JSON.stringify({ lines: lines.map((l) => [l.garmentId, l.quantity, l.weightKg]), selectedServiceId, storeId, customerType })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!currentBusinessId || lines.length === 0) { setQuote(null); return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const items = lines.map((l) => ({ serviceId: l.serviceId, garmentId: l.garmentId, categoryId: l.garment.categoryId, quantity: l.quantity, weightKg: l.weightKg }))
        const res = await fetch("/api/laundry/billing/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, storeId, customerType, items }) })
        const json = await res.json(); setQuote(json.success ? json.data : null)
      } catch { setQuote(null) }
    }, 300)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, currentBusinessId])

  // ── Customer: mobile → search → load or create ───────────────────────
  const handleSearch = async () => {
    if (!mobile.trim() || !currentBusinessId) return
    setSearching(true); setSearched(false); setCustomer(null)
    try {
      const res = await fetch(`/api/laundry/customers/search?businessId=${currentBusinessId}&q=${encodeURIComponent(mobile)}`)
      const json = await res.json()
      const list: CustomerResult[] = json.success ? json.data : []
      setMatches(list)
      if (list.length === 1) setCustomer(list[0])
      setNewName("")
    } catch { setMatches([]) } finally { setSearching(false); setSearched(true) }
  }
  const handleCreate = async () => {
    if (!newName.trim() || !mobile.trim()) { toast({ title: "Enter name", description: "Name and mobile are required", variant: "destructive" }); return }
    setCreating(true)
    try {
      const res = await fetch("/api/laundry/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, name: newName, mobile }) })
      const json = await res.json()
      if ((res.status === 409 || json.success) && json.data) setCustomer({ id: json.data.id, name: json.data.name, phone: json.data.phone, customerCode: json.data.customerCode })
      else { toast({ title: "Error", description: json.error || "Could not create customer", variant: "destructive" }); return }
    } catch { toast({ title: "Error", description: "Could not create customer", variant: "destructive" }) } finally { setCreating(false) }
  }
  const resetCustomer = () => { setCustomer(null); setMatches([]); setSearched(false); setNewName("") }

  const bump = (id: string, d: number) => setQty((p) => ({ ...p, [id]: Math.max(0, (p[id] || 0) + d) }))
  const setQtyVal = (id: string, v: number) => setQty((p) => ({ ...p, [id]: Math.max(0, v) }))
  const setWtVal = (id: string, v: number) => setWeight((p) => ({ ...p, [id]: Math.max(0, v) }))

  const canCreate = !!customer && !!selectedServiceId && lines.length > 0 && !!storeId

  const handleCreateOrder = async () => {
    if (!canCreate) return
    setSubmitting(true)
    try {
      const payload = {
        businessId: currentBusinessId, storeId, customerId: customer!.id, orderType,
        services: selectedService ? [{ serviceId: selectedService.id, serviceName: selectedService.name, turnaroundHours: selectedService.defaultTurnaroundHours }] : [],
        items: lines.map((l) => ({ serviceId: l.serviceId, garmentId: l.garmentId, quantity: l.quantity, weightKg: l.weightKg })),
        paymentPreference: paymentPref,
        expectedDeliveryDate: expectedDelivery ? expectedDelivery.toISOString().split("T")[0] : null,
        createdBy: user?.name || "counter",
      }
      const res = await fetch("/api/laundry/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!json.success) { toast({ title: "Error", description: json.error || "Failed to create order", variant: "destructive" }); return }
      toast({ title: "Order Created", description: `${json.data.orderNumber} → Pending Store Audit` })
      setLaundryPage("audit-queue")
    } catch { toast({ title: "Error", description: "Failed to create order", variant: "destructive" }) } finally { setSubmitting(false) }
  }

  const stepNum = (n: number) => <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white text-[11px]">{n}</span>

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Badge variant="outline" className="border-sky-300 text-sky-700 bg-sky-50 rounded-md px-1.5">Counter</Badge> New Order</h1>
        {stores.length > 1 ? (
          <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="text-sm border rounded-md px-2 py-1">
            {stores.map((s) => <option key={s.id} value={s.id}>{s.storeName}</option>)}
          </select>
        ) : stores[0] ? <span className="text-sm text-muted-foreground">{stores[0].storeName}</span> : null}
      </div>

      {/* Step 1 — Customer */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{stepNum(1)} Customer</CardTitle></CardHeader>
        <CardContent>
          {customer ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <div className="flex items-center gap-2"><User className="h-4 w-4 text-emerald-600" /><div><p className="font-semibold text-sm">{customer.name}</p><p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone || mobile}{customer.customerCode ? ` · ${customer.customerCode}` : ""}</p></div></div>
              <Button variant="ghost" size="sm" onClick={resetCustomer}><X className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input inputMode="numeric" placeholder="Mobile number" className="pl-9" value={mobile} onChange={(e) => { setMobile(e.target.value); setSearched(false) }} onKeyDown={(e) => e.key === "Enter" && handleSearch()} /></div>
                <Button onClick={handleSearch} disabled={searching || !mobile.trim()} className="gap-1 bg-sky-600 hover:bg-sky-700 text-white">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search</Button>
              </div>
              {matches.length > 1 && (
                <div className="rounded-lg border divide-y">
                  {matches.map((m) => <button key={m.id} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50" onClick={() => setCustomer(m)}><span className="text-sm font-medium">{m.name}</span><span className="text-xs text-muted-foreground">{m.phone}</span></button>)}
                </div>
              )}
              {searched && matches.length === 0 && (
                <div className="flex gap-2">
                  <Input placeholder="Customer name (new)" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
                  <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="gap-1">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2 — Service */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{stepNum(2)} Service</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {services.length === 0 ? <p className="text-sm text-muted-foreground">No services configured.</p> : services.map((s) => (
              <button key={s.id} onClick={() => setSelectedServiceId(s.id)} className={`rounded-lg border px-3 py-2 text-sm transition-colors ${selectedServiceId === s.id ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/50"}`}>
                <WashingMachine className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />{s.name}
                <span className="block text-[11px] text-muted-foreground">{s.defaultTurnaroundHours}h</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 3 — Garments */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center justify-between"><span className="flex items-center gap-2">{stepNum(3)} Garments</span><span className="text-xs font-normal text-muted-foreground">{totalPieces} pc{totalPieces === 1 ? "" : "s"} · {lines.length} type{lines.length === 1 ? "" : "s"}</span></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {garments.length > 8 && (
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search garment…" className="pl-9 h-9" value={garmentSearch} onChange={(e) => setGarmentSearch(e.target.value)} /></div>
          )}
          {garments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No garments configured.</p>
          ) : displayGarments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No garments match “{garmentSearch}”.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {displayGarments.map((g) => {
                const byWeight = g.defaultUnit === "KG"
                const q = qty[g.id] || 0, w = weight[g.id] || 0
                const active = byWeight ? w > 0 : q > 0
                return (
                  <div key={g.id} className={`flex items-center justify-between rounded-lg border p-2 ${active ? "border-primary/40 bg-primary/5" : ""}`}>
                    <span className="flex items-center gap-2 text-sm min-w-0"><Shirt className="h-4 w-4 text-muted-foreground shrink-0" /><span className="truncate">{g.name}</span></span>
                    {byWeight ? (
                      <Input type="number" min={0} step={0.5} value={w || ""} onChange={(e) => setWtVal(g.id, parseFloat(e.target.value) || 0)} placeholder="kg" className="h-8 w-24" />
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => bump(g.id, -1)} disabled={q === 0}><Minus className="h-3.5 w-3.5" /></Button>
                        <Input type="number" min={0} value={q || ""} onChange={(e) => setQtyVal(g.id, parseInt(e.target.value) || 0)} className="h-8 w-14 text-center" />
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => bump(g.id, 1)}><Plus className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 4 — Order Type + Payment Preference (pricing only; after garments) */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{stepNum(4)} Order Type</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {ORDER_TYPES.map((o) => (
              <button key={o.value} onClick={() => setOrderType(o.value)} className={`rounded-full border px-3 py-1.5 text-sm ${orderType === o.value ? "border-primary bg-primary/5 font-medium" : "text-muted-foreground hover:bg-muted/50"}`}>{o.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> Payment:</span>
            {PAYMENT_PREFS.map((p) => (
              <button key={p.value} onClick={() => setPaymentPref(p.value)} className={`rounded-full border px-2.5 py-1 text-xs ${paymentPref === p.value ? "border-primary bg-primary/5 font-medium" : "text-muted-foreground hover:bg-muted/50"}`}>{p.label}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Ready By <span className="font-semibold text-foreground">{expectedDelivery ? fmtReady(expectedDelivery) : "—"}</span></div>
            {quote && <div className="text-xs text-muted-foreground">Est. <span className="font-semibold text-foreground">{inr(quote.grandTotal)}</span> · confirmed at audit</div>}
          </div>
          <Button size="lg" onClick={handleCreateOrder} disabled={!canCreate || submitting} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Create Order
          </Button>
        </div>
      </div>
    </div>
  )
}
