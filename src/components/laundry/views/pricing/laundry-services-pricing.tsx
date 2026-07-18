"use client"

// Services tab — the PRIMARY laundry price-menu admin. Service → Garments →
// Price, with one Save. No wizard, no customer scope, no priority. It reads/
// writes the simple per-service price API (/api/laundry/services/[id]/prices)
// which upserts the exact LaundryPricingRule records the resolver already uses.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Plus, Pencil, IndianRupee, Tag, ArrowLeft, Trash2, Search, WashingMachine, Power, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { inr } from "./pricing-shared"
import { LaundryImageUpload } from "./laundry-image-upload"

interface Service { id: string; name: string; description: string | null; image: string | null; displayOrder: number; isActive: boolean; displayOnWebsite: boolean; orderMode?: string; processFlow: string | null; compatibleCategoryIds?: string[] }
interface Category { id: string; name: string }

// Configurable working stages a route can be composed from. Quality Check →
// Packing are mandatory terminals appended by the backend (shown locked below).
// Steam is retired and intentionally NOT offered.
const ROUTE_OPTIONS: { code: string; label: string }[] = [
  { code: "WASH", label: "Wash" }, { code: "DRYCLEAN", label: "Dry Clean" },
  { code: "DRY", label: "Dry" },
  { code: "IRON", label: "Iron" }, { code: "FOLD", label: "Folding" }, { code: "CLEAN", label: "Cleaning" },
]
function parseRoute(raw: string | null): string[] {
  if (!raw) return []
  try { return (JSON.parse(raw) as string[]).filter((s) => ROUTE_OPTIONS.some((o) => o.code === s)) } catch { return [] }
}
interface Garment { id: string; name: string; category?: { id: string; name: string | null } | null }
interface PriceRow { garmentId: string; garmentName: string; category: string | null; price: number }

const SVC_EMPTY = { name: "", description: "", image: "", displayOrder: "0", isActive: true, displayOnWebsite: true, orderMode: "GARMENT" }

export function LaundryServicesPricing({ businessId }: { businessId: string }) {
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!businessId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/laundry/services?businessId=${businessId}&includeInactive=1`).then((r) => r.json()),
      fetch(`/api/laundry/categories?businessId=${businessId}`).then((r) => r.json()),
    ]).then(([s, c]) => { if (s.success) setServices(s.data || []); if (c.success) setCategories((c.data || []).map((x: Category) => ({ id: x.id, name: x.name }))) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [businessId])
  useEffect(() => { load() }, [load])

  // Services master only — no pricing here. Garment pricing lives on the
  // Pricing Matrix (single garment×service pricing source).
  return <ServicesList services={services} categories={categories} businessId={businessId} loading={loading} onChanged={load} />
}

function ServicesList({ services, categories, businessId, loading, onChanged }: { services: Service[]; categories: Category[]; businessId: string; loading: boolean; onChanged: () => void }) {
  const [edit, setEdit] = useState<Service | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...SVC_EMPTY })
  const [route, setRoute] = useState<string[]>([])
  const [compatCats, setCompatCats] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }))

  const openNew = () => { setEdit(null); setForm({ ...SVC_EMPTY }); setRoute([]); setCompatCats([]); setOpen(true) }
  const openEdit = (s: Service) => { setEdit(s); setForm({ name: s.name, description: s.description || "", image: s.image || "", displayOrder: String(s.displayOrder), isActive: s.isActive, displayOnWebsite: s.displayOnWebsite, orderMode: s.orderMode || "GARMENT" }); setRoute(parseRoute(s.processFlow)); setCompatCats(s.compatibleCategoryIds || []); setOpen(true) }
  const toggleStage = (code: string) => setRoute((r) => r.includes(code) ? r.filter((c) => c !== code) : [...r, code])
  const moveStage = (i: number, dir: -1 | 1) => setRoute((r) => { const j = i + dir; if (j < 0 || j >= r.length) return r; const c = [...r]; [c[i], c[j]] = [c[j], c[i]]; return c })
  const toggleCat = (id: string) => setCompatCats((c) => c.includes(id) ? c.filter((x) => x !== id) : [...c, id])
  const save = async () => {
    if (!form.name.trim()) { toast.error("Service name is required"); return }
    setSaving(true)
    try {
      const payload = { businessId, name: form.name, description: form.description, image: form.image || null, displayOrder: Number(form.displayOrder) || 0, isActive: form.isActive, displayOnWebsite: form.displayOnWebsite, orderMode: form.orderMode, processFlow: route.length ? route : null, ...(edit ? { compatibleCategoryIds: compatCats } : {}) }
      const res = await fetch(edit ? `/api/laundry/services/${edit.id}` : `/api/laundry/services`, { method: edit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const j = await res.json()
      if (!res.ok || j.error) throw new Error(j.error || "Save failed")
      toast.success(edit ? "Service updated" : "Service created"); setOpen(false); onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  // Activate / deactivate in place — the SAME record (never duplicated). Editing
  // the name later updates this record everywhere; existing orders keep their
  // historical service-name snapshot.
  const toggleActive = async (s: Service) => {
    try {
      const res = await fetch(`/api/laundry/services/${s.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, isActive: !s.isActive }) })
      const j = await res.json()
      if (!res.ok || j.error) throw new Error(j.error || "Failed")
      toast.success(s.isActive ? "Service deactivated" : "Service activated"); onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage your laundry services — details, workflow, visibility and status. Garment pricing lives on the Pricing Matrix.</p>
        <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white h-9 shrink-0" onClick={openNew}><Plus className="h-3.5 w-3.5" /> Add Service</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : services.length === 0 ? (
        <Card><CardContent className="text-center py-16"><WashingMachine className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium">No services yet</p><p className="text-xs text-muted-foreground mt-1">Add a service like “Wash & Iron”, then set prices on the Pricing Matrix.</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map((s) => {
            const stages = parseRoute(s.processFlow)
            return (
            <Card key={s.id} className={s.isActive ? "" : "opacity-60"}><CardContent className="p-4">
              <div className="flex items-start gap-3">
                {s.image
                  ? <img src={s.image} alt={s.name} className="h-12 w-12 rounded-lg object-cover border border-slate-100 shrink-0" />
                  : <div className="h-12 w-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0"><WashingMachine className="h-5 w-5 text-slate-300" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-800 truncate">{s.name}</p>
                    {!s.isActive && <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">Inactive</span>}
                  </div>
                  {s.description && <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{s.description}</p>}
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {s.orderMode === "BAG" && <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-700 bg-indigo-50">Pickup First</Badge>}
                <Badge variant="outline" className={`text-[10px] ${s.displayOnWebsite ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-400"}`}>{s.displayOnWebsite ? "Website" : "Hidden"}</Badge>
                {stages.length > 0 && <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500">{stages.map((c) => ROUTE_OPTIONS.find((o) => o.code === c)?.label || c).join(" → ")}</Badge>}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1 flex-1" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                {s.isActive
                  ? <Button size="sm" variant="outline" className="h-8 gap-1 flex-1 text-slate-500" onClick={() => toggleActive(s)}><Power className="h-3.5 w-3.5" /> Deactivate</Button>
                  : <Button size="sm" className="h-8 gap-1 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => toggleActive(s)}><Power className="h-3.5 w-3.5" /> Activate</Button>}
              </div>
            </CardContent></Card>
          )})}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[760px] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 shrink-0">
            <DialogTitle className="text-[18px] font-bold text-slate-800">{edit ? "Edit Service" : "Add Service"}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* ── Basic Information ── */}
            <FormSection title="Basic Information" subtitle="Name, description and marketing photo">
              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5">
                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-600">Service Photo</Label>
                  <LaundryImageUpload value={form.image || null} businessId={businessId} folder="laundry-services" onChange={(url) => set("image", url || "")} />
                  <p className="text-[12px] text-slate-400 leading-tight">Shown on your laundry website and customer app.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5"><Label className="text-sm text-slate-600">Service Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Wash & Iron" className="h-11 text-[15px]" /></div>
                  <div className="space-y-1.5"><Label className="text-sm text-slate-600">Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Professional washing and steam ironing for everyday clothes." className="min-h-[84px] text-[15px] leading-relaxed" /></div>
                </div>
              </div>
            </FormSection>

            {/* ── Order Configuration ── */}
            <FormSection title="Order Configuration" subtitle="Visibility, status and booking method">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5"><Label className="text-sm text-slate-600">Display Order</Label><Input type="number" value={form.displayOrder} onChange={(e) => set("displayOrder", e.target.value)} className="h-11 text-[15px]" /></div>
                <div className="space-y-1.5"><Label className="text-sm text-slate-600">Website</Label><div className="flex items-center gap-2.5 h-11"><Switch checked={form.displayOnWebsite} onCheckedChange={(v) => set("displayOnWebsite", v)} /><span className="text-[15px] text-slate-600">{form.displayOnWebsite ? "Visible" : "Hidden"}</span></div></div>
                <div className="space-y-1.5"><Label className="text-sm text-slate-600">Status</Label><div className="flex items-center gap-2.5 h-11"><Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} className="data-[state=checked]:bg-emerald-600" /><span className="text-[15px] font-medium text-slate-700">{form.isActive ? "Active" : "Inactive"}</span></div></div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-600">Order Mode</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([["GARMENT", "Garment Based", "Customer counts garments at booking"], ["BAG", "Pickup First (Bag)", "Book service only · counted at audit"]] as const).map(([v, label, desc]) => (
                    <button type="button" key={v} onClick={() => set("orderMode", v)} className={`rounded-xl border p-4 text-left transition-colors ${form.orderMode === v ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                      <p className={`text-[15px] font-semibold ${form.orderMode === v ? "text-blue-700" : "text-slate-700"}`}>{label}</p>
                      <p className="text-[13px] text-slate-400 leading-snug mt-1">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </FormSection>

            {/* ── Processing Route ── */}
            <FormSection title="Processing Route" subtitle="Departments a garment goes through, in order">
              <p className="text-[13px] text-slate-400 -mt-1">Leave empty to auto-detect from the service name. Quality Check → Packing are added automatically.</p>
              <div className="flex flex-wrap gap-2">
                {ROUTE_OPTIONS.map((o) => (
                  <button key={o.code} type="button" onClick={() => toggleStage(o.code)}
                    className={`rounded-lg border px-3.5 h-10 text-[14px] font-medium transition-colors ${route.includes(o.code) ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              {route.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
                  {route.map((code, i) => (
                    <div key={code} className="flex items-center gap-2.5 text-[14px]">
                      <span className="text-slate-400 w-5">{i + 1}.</span>
                      <span className="font-medium text-slate-700 flex-1">{ROUTE_OPTIONS.find((o) => o.code === code)?.label || code}</span>
                      <button type="button" onClick={() => moveStage(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-blue-600 disabled:opacity-30 px-1.5 text-base">↑</button>
                      <button type="button" onClick={() => moveStage(i, 1)} disabled={i === route.length - 1} className="text-slate-400 hover:text-blue-600 disabled:opacity-30 px-1.5 text-base">↓</button>
                      <button type="button" onClick={() => toggleStage(code)} className="text-slate-400 hover:text-rose-600 px-1.5 text-base">✕</button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2.5 text-[14px] pt-1.5 border-t border-slate-200 mt-1">
                    <span className="text-slate-400 w-5">{route.length + 1}.</span>
                    <span className="font-medium text-slate-500 flex-1">Quality Check</span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Required</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[14px]">
                    <span className="text-slate-400 w-5">{route.length + 2}.</span>
                    <span className="font-medium text-slate-500 flex-1">Packing</span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Required</span>
                  </div>
                  <p className="text-[12px] text-slate-400 pt-1.5">Route: {route.map((c) => ROUTE_OPTIONS.find((o) => o.code === c)?.label).join(" → ")} → Quality Check → Packing</p>
                </div>
              )}
            </FormSection>

            {/* ── Compatible Categories (edit only) ── */}
            {edit && (
              <FormSection title="Compatible Categories" subtitle="Garment categories shown by default when adding garments">
                <p className="text-[13px] text-slate-400 -mt-1">Leave empty to show all garments. Existing prices are never affected.</p>
                {categories.length === 0 ? (
                  <p className="text-[14px] text-slate-400">No categories configured for this business.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <button key={c.id} type="button" onClick={() => toggleCat(c.id)}
                        className={`rounded-lg border px-3.5 h-10 text-[14px] font-medium transition-colors ${compatCats.includes(c.id) ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </FormSection>
            )}
          </div>

          {/* Sticky footer — always visible */}
          <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4 flex justify-end gap-3">
            <Button variant="outline" className="h-11 px-5 text-[15px]" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={save} className="h-11 px-6 text-[15px] gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Service</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Collapsible form section (UI only) — larger heading, chevron toggle, open by
// default. Used to organise the Service editor into scannable groups.
function FormSection({ title, subtitle, defaultOpen = true, children }: { title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-xl border border-slate-200 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-slate-50/70 hover:bg-slate-100/70 transition-colors">
        <span className="text-left">
          <span className="block text-[16px] font-semibold text-slate-800">{title}</span>
          {subtitle && <span className="block text-[13px] text-slate-400 mt-0.5">{subtitle}</span>}
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="px-5 py-5 space-y-5">{children}</div>}
    </section>
  )
}

// A garment price row now carries its OWN billing type (Per KG | Per Piece) —
// a single service may mix both. There is no service-global pricing mode.
type EditRow = { garmentId: string; garmentName: string; price: string; pricingType: "PER_KG" | "PER_PIECE"; minWeightKg: string }

function ManagePrices({ service, garments, categories, businessId, onBack, onGarmentsChanged }: { service: Service; garments: Garment[]; categories: Category[]; businessId: string; onBack: () => void; onGarmentsChanged: () => void }) {
  const [rows, setRows] = useState<EditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/laundry/services/${service.id}/prices?businessId=${businessId}`).then((r) => r.json()).then((j) => {
      if (j.success) setRows((j.data.rows as (PriceRow & { pricingType?: string; minWeightKg?: number | null })[]).map((r) => ({
        garmentId: r.garmentId, garmentName: r.garmentName, price: String(r.price),
        pricingType: String(r.pricingType || "").toUpperCase() === "PER_KG" ? "PER_KG" : "PER_PIECE",
        minWeightKg: r.minWeightKg == null ? "" : String(r.minWeightKg),
      })))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [service.id, businessId])
  useEffect(() => { load() }, [load])

  const existingIds = new Set(rows.map((r) => r.garmentId))
  const setPrice = (id: string, v: string) => setRows((p) => p.map((r) => r.garmentId === id ? { ...r, price: v } : r))
  const setBilling = (id: string, v: "PER_KG" | "PER_PIECE") => setRows((p) => p.map((r) => r.garmentId === id ? { ...r, pricingType: v } : r))
  const setMinW = (id: string, v: string) => setRows((p) => p.map((r) => r.garmentId === id ? { ...r, minWeightKg: v } : r))
  const removeRow = (id: string) => setRows((p) => p.filter((r) => r.garmentId !== id))
  // New rows default to Per Piece; the operator sets the billing type inline.
  const addGarments = (ids: string[]) => setRows((p) => [...p, ...ids.filter((id) => !existingIds.has(id)).map((id) => ({ garmentId: id, garmentName: garments.find((g) => g.id === id)?.name || "Garment", price: "0", pricingType: "PER_PIECE" as const, minWeightKg: "" }))])

  const save = async () => {
    setSaving(true)
    try {
      const body = { businessId, rows: rows.map((r) => ({ garmentId: r.garmentId, price: Number(r.price) || 0, pricingType: r.pricingType, minWeightKg: r.pricingType === "PER_KG" && r.minWeightKg !== "" ? Number(r.minWeightKg) : null })) }
      const res = await fetch(`/api/laundry/services/${service.id}/prices`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
      toast.success("Prices saved")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1 h-8" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Services</Button>
      </div>
      <div><h3 className="text-base font-semibold text-slate-800">{service.name} Pricing</h3><p className="text-sm text-muted-foreground">Set each garment&apos;s billing type and price. A service may mix Per KG and Per Piece garments.</p></div>

      {loading ? <div className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div> : (
        <Card><CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-[1fr_130px_170px_40px] gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400"><span>Garment</span><span>Billing Type</span><span>Price</span><span /></div>
            {rows.length === 0 && <p className="px-4 py-6 text-sm text-slate-400 text-center">No garments yet — add garments to set their prices.</p>}
            {rows.map((r) => (
              <div key={r.garmentId} className="grid grid-cols-[1fr_130px_170px_40px] gap-2 px-4 py-2 items-center">
                <span className="text-sm text-slate-700">{r.garmentName}</span>
                <select value={r.pricingType} onChange={(e) => setBilling(r.garmentId, e.target.value as "PER_KG" | "PER_PIECE")} className="h-9 rounded-md border border-slate-200 bg-white text-sm px-2 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="PER_PIECE">Per Piece</option>
                  <option value="PER_KG">Per KG</option>
                </select>
                <div className="flex items-center gap-1.5">
                  <Input type="number" value={r.price} onChange={(e) => setPrice(r.garmentId, e.target.value)} className="h-9" />
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{r.pricingType === "PER_KG" ? "₹ / KG" : "₹ / Piece"}</span>
                </div>
                <button onClick={() => removeRow(r.garmentId)} className="text-rose-500 hover:text-rose-700 flex justify-center"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 px-4 py-3 border-t border-slate-100">
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Garment</Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1 text-blue-600" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" /> Create New Garment</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="flex justify-end"><Button disabled={saving} onClick={save} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Prices</Button></div>

      {addOpen && <AddGarmentsDialog garments={garments.filter((g) => !existingIds.has(g.id))} categories={categories} compatibleCategoryIds={service.compatibleCategoryIds || []} onAdd={(ids) => { addGarments(ids); setAddOpen(false) }} onClose={() => setAddOpen(false)} />}
      {createOpen && <CreateGarmentDialog businessId={businessId} onCreated={(g) => { onGarmentsChanged(); addGarments([g.id]); setCreateOpen(false) }} onClose={() => setCreateOpen(false)} />}
    </div>
  )
}

function AddGarmentsDialog({ garments, categories, compatibleCategoryIds, onAdd, onClose }: { garments: Garment[]; categories: Category[]; compatibleCategoryIds: string[]; onAdd: (ids: string[]) => void; onClose: () => void }) {
  const [q, setQ] = useState("")
  const [sel, setSel] = useState<Set<string>>(new Set())
  // Backward-compatible: a service with no compatible categories has no scope
  // to narrow to, so it always shows all garments.
  const hasCompat = compatibleCategoryIds.length > 0
  const [showAll, setShowAll] = useState(!hasCompat)
  const compatSet = useMemo(() => new Set(compatibleCategoryIds), [compatibleCategoryIds])
  const isCompatible = (g: Garment) => !!g.category?.id && compatSet.has(g.category.id)

  // Scope = compatible garments (default) or all garments (Show all ON).
  const scoped = useMemo(() => (showAll ? garments : garments.filter(isCompatible)), [garments, showAll, compatSet])
  // Search within the current scope by garment name OR category name.
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return scoped
    return scoped.filter((g) => g.name.toLowerCase().includes(s) || (g.category?.name || "").toLowerCase().includes(s))
  }, [scoped, q])

  // Group the visible garments by category for a readable list.
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: Garment[] }>()
    for (const g of filtered) {
      const key = g.category?.id || "_none"
      const name = g.category?.name || "Uncategorised"
      if (!map.has(key)) map.set(key, { name, items: [] })
      map.get(key)!.items.push(g)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [filtered])

  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const compatNames = categories.filter((c) => compatSet.has(c.id)).map((c) => c.name).join(", ")

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="sm:max-w-[440px]">
      <DialogHeader><DialogTitle>Add Garments</DialogTitle></DialogHeader>
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search garments or category…" className="pl-9" /></div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{showAll ? "All garments" : hasCompat ? `Compatible garments${compatNames ? ` · ${compatNames}` : ""}` : "All garments"}</p>
        {hasCompat && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            Show all garments <Switch checked={showAll} onCheckedChange={setShowAll} className="scale-90 data-[state=checked]:bg-blue-600" />
          </label>
        )}
      </div>
      {!hasCompat && <p className="text-[10px] text-slate-400 -mt-1">No garment compatibility configured — showing all garments. Set compatible categories in the service to narrow this list.</p>}

      <div className="max-h-[320px] overflow-y-auto -mx-1 px-1 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">{showAll ? "No garments" : "No compatible garments — enable “Show all garments” to add others."}</p>
        ) : grouped.map((grp) => (
          <div key={grp.name}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 px-2 mt-1">{grp.name}</p>
            {grp.items.map((g) => {
              const outside = showAll && hasCompat && !isCompatible(g)
              return (
                <label key={g.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={sel.has(g.id)} onChange={() => toggle(g.id)} />
                  <span className="text-sm">{g.name}</span>
                  {outside && <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">outside compatible categories</span>}
                </label>
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={sel.size === 0} onClick={() => onAdd([...sel])} className="bg-blue-600 hover:bg-blue-700 text-white">Add Selected ({sel.size})</Button></div>
    </DialogContent></Dialog>
  )
}

function CreateGarmentDialog({ businessId, onCreated, onClose }: { businessId: string; onCreated: (g: Garment) => void; onClose: () => void }) {
  const [name, setName] = useState(""); const [image, setImage] = useState(""); const [saving, setSaving] = useState(false)
  const create = async () => {
    if (!name.trim()) { toast.error("Garment name is required"); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/laundry/garments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, name, image: image || null }) })
      const j = await res.json()
      if (!res.ok || (j.error && !j.success)) throw new Error(j.error || "Create failed")
      toast.success("Garment created"); onCreated(j.data || j)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Create failed") } finally { setSaving(false) }
  }
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="sm:max-w-[400px]">
      <DialogHeader><DialogTitle>Create New Garment</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label className="text-xs">Garment Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sherwani" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Garment Photo (optional)</Label><LaundryImageUpload value={image || null} businessId={businessId} folder="laundry-garments" onChange={(url) => setImage(url || "")} /></div>
      </div>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={create} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Create Garment</Button></div>
    </DialogContent></Dialog>
  )
}
