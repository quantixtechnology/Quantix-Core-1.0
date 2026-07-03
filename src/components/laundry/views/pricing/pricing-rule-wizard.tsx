"use client"

// Enterprise Pricing Wizard — a modern two-column, stepped rule builder.
// Reuses the existing pricing API + conflict detection. Does NOT touch the
// Billing Resolver. Steps: Customer → Store → Service → Garment → Pricing →
// Conditions → Priority → Review.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Loader2, AlertTriangle, Save, Check, ChevronLeft, ChevronRight, X, CheckCircle2, Plus,
  User, Truck, Building2, Hotel, Cross, Repeat, Crown, Users2,
  Coins, Package, Scale, Percent, Tag, Calculator, Store as StoreIcon, WashingMachine, Shirt, Info,
  Wind, Flame, Zap, Droplets, ListChecks,
} from "lucide-react"
import { toast } from "sonner"
import { SearchableSelect, type Option } from "./searchable-select"
import { NONE, typeLabel, inr, priorityLabel, type Ref, type Rule } from "./pricing-shared"

type Mode = "create" | "edit" | "duplicate"
interface Masters { services: Ref[]; garments: Ref[]; cats: Ref[]; stores: Ref[] }
type Form = Record<string, string> & { isActiveStatus: string }

const EMPTY: Form = {
  name: "", description: "", notes: "", serviceId: NONE, garmentId: NONE, categoryId: NONE, storeId: NONE,
  customerType: NONE, pricingType: "PER_PIECE", price: "0", gstPercent: "0", minCharge: "", maxCharge: "",
  minWeightKg: "", maxWeightKg: "", extraWeightCharge: "", includedPieces: "", discountPercent: "", discount: "",
  formula: "", weekendPrice: "", expressCharge: "", pickupCharge: "", deliveryCharge: "", hsnCode: "", priority: "0",
  effectiveFrom: "", effectiveTo: "", isActiveStatus: "ACTIVE",
}

const STEPS = ["Customer", "Store", "Service", "Garment", "Pricing", "Conditions", "Priority", "Review"]
const draftKey = (b: string) => `qx-pricing-draft-${b}`

const CUSTOMER_CARDS = [
  { value: NONE, title: "All Customers", desc: "Applies to everyone", icon: Users2 },
  { value: "WALK_IN", title: "Walk-In", desc: "Counter customers", icon: User },
  { value: "PICKUP", title: "Pickup", desc: "Home pickup orders", icon: Truck },
  { value: "CORPORATE", title: "Corporate", desc: "Business accounts", icon: Building2 },
  { value: "HOTEL", title: "Hotel", desc: "Hotel contracts", icon: Hotel },
  { value: "HOSPITAL", title: "Hospital", desc: "Hospital contracts", icon: Cross },
  { value: "SUBSCRIPTION", title: "Subscription", desc: "Plan members", icon: Repeat },
  { value: "VIP", title: "VIP", desc: "Priority customers", icon: Crown },
]
const METHODS = [
  { value: "FIXED", title: "Fixed Price", desc: "One flat price", icon: Coins },
  { value: "PER_PIECE", title: "Per Piece", desc: "Price × quantity", icon: Package },
  { value: "PER_KG", title: "Per KG", desc: "Price × weight", icon: Scale },
  { value: "PERCENTAGE_DISCOUNT", title: "Percentage Discount", desc: "% off the base price", icon: Percent, adv: true },
  { value: "FLAT_DISCOUNT", title: "Flat Discount", desc: "₹ off the base price", icon: Tag, adv: true },
  { value: "DYNAMIC_FORMULA", title: "Dynamic Formula", desc: "Custom pricing formula", icon: Calculator, adv: true },
]
interface FieldSpec { key: string; label: string; int?: boolean; text?: boolean }
function methodFields(m: string): FieldSpec[] {
  switch (m) {
    case "PER_KG": return [{ key: "price", label: "Price per KG (₹)" }, { key: "minWeightKg", label: "Min Weight (KG)" }, { key: "maxWeightKg", label: "Max Weight (KG)" }, { key: "extraWeightCharge", label: "Extra Weight (₹/KG)" }]
    case "FIXED": return [{ key: "price", label: "Fixed Price (₹)" }]
    case "PERCENTAGE_DISCOUNT": return [{ key: "price", label: "Base Price (₹)" }, { key: "discountPercent", label: "Discount %" }]
    case "FLAT_DISCOUNT": return [{ key: "price", label: "Base Price (₹)" }, { key: "discount", label: "Flat Discount (₹)" }]
    case "DYNAMIC_FORMULA": return [{ key: "price", label: "Base Price (₹)" }, { key: "formula", label: "Formula", text: true }]
    case "PER_PIECE": default: return [{ key: "price", label: "Price per Piece (₹)" }]
  }
}
const refOpts = (refs: Ref[], k: "name" | "storeName" = "name"): Option[] =>
  [{ value: NONE, label: "All" }, ...refs.map((r) => ({ value: r.id, label: (r[k] as string) || r.name || r.storeName || r.id }))]

const svcIcon = (name?: string) => {
  const n = (name || "").toLowerCase()
  if (n.includes("dry clean")) return Wind
  if (n.includes("steam")) return Flame
  if (n.includes("iron")) return Shirt
  if (n.includes("express")) return Zap
  if (n.includes("premium") || n.includes("vip")) return Crown
  if (n.includes("wash")) return Droplets
  return WashingMachine
}

// Client-side pricing simulation for the live preview (core methods only).
function simulate(form: Form): { rows: [string, number][]; gstAmt: number; total: number } {
  const p = Number(form.price) || 0, gst = Number(form.gstPercent) || 0
  const rows: [string, number][] = []
  switch (form.pricingType) {
    case "PER_KG": [1, 3, 5].forEach((kg) => rows.push([`${kg} KG`, p * kg])); break
    case "FIXED": rows.push(["Flat", p]); break
    case "PERCENTAGE_DISCOUNT": { const d = Number(form.discountPercent) || 0; rows.push(["Base", p], [`After −${d}%`, p * (1 - d / 100)]); break }
    case "FLAT_DISCOUNT": { const d = Number(form.discount) || 0; rows.push(["Base", p], [`After −₹${d}`, Math.max(0, p - d)]); break }
    default: [1, 2, 5].forEach((q) => rows.push([`${q} pc${q > 1 ? "s" : ""}`, p * q]))
  }
  const sub = rows.length ? rows[rows.length - 1][1] : 0
  const gstAmt = (sub * gst) / 100
  return { rows, gstAmt, total: sub + gstAmt }
}

export function PricingRuleWizard({
  open, mode, rule, businessId, masters, actor, onClose, onSaved,
}: {
  open: boolean; mode: Mode; rule: Rule | null; businessId: string; masters: Masters
  actor?: { id?: string; name?: string }; onClose: () => void; onSaved: () => void
}) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [conflicts, setConflicts] = useState<Rule[] | null>(null)
  const [overrideConflicts, setOverrideConflicts] = useState(false)
  const [saved, setSaved] = useState<{ name: string; method: string; price: number } | null>(null)
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))
  const autosave = useRef<ReturnType<typeof setTimeout> | null>(null)

  const nameOf = (refs: Ref[], id: string, k: "name" | "storeName" = "name") =>
    id === NONE ? "All" : (refs.find((r) => r.id === id)?.[k] as string) || id

  const fromRule = useCallback((r: Rule, dup: boolean): Form => ({
    ...EMPTY,
    name: dup ? `${r.name || typeLabel(r.pricingType)} (Copy)` : (r.name || ""),
    description: r.description || "", notes: r.notes || "",
    serviceId: r.service?.id || r.serviceId || NONE, garmentId: r.garment?.id || r.garmentId || NONE,
    categoryId: r.category?.id || r.categoryId || NONE, storeId: r.store?.id || r.storeId || NONE,
    customerType: r.customerType || NONE, pricingType: r.pricingType,
    price: String(r.price ?? 0), gstPercent: String(r.gstPercent ?? 0),
    minCharge: r.minCharge?.toString() ?? "", maxCharge: r.maxCharge?.toString() ?? "",
    minWeightKg: r.minWeightKg?.toString() ?? "", maxWeightKg: r.maxWeightKg?.toString() ?? "",
    extraWeightCharge: r.extraWeightCharge?.toString() ?? "", includedPieces: r.includedPieces?.toString() ?? "",
    discountPercent: r.discountPercent?.toString() ?? "", weekendPrice: r.weekendPrice?.toString() ?? "",
    expressCharge: r.expressCharge?.toString() ?? "", pickupCharge: r.pickupCharge?.toString() ?? "",
    deliveryCharge: r.deliveryCharge?.toString() ?? "", hsnCode: r.hsnCode || "",
    priority: dup ? String((r.priority ?? 0) + 1) : String(r.priority ?? 0),
    effectiveFrom: dup ? "" : (r.effectiveFrom?.slice(0, 10) || ""),
    effectiveTo: dup ? "" : (r.effectiveTo?.slice(0, 10) || ""),
    isActiveStatus: dup ? "DRAFT" : (r.status || "ACTIVE"),
  }), [])

  useEffect(() => {
    if (!open) return
    setStep(0); setConflicts(null); setOverrideConflicts(false); setSaved(null)
    if (rule) { setForm(fromRule(rule, mode === "duplicate")); return }
    try { const s = localStorage.getItem(draftKey(businessId)); setForm(s ? { ...EMPTY, ...JSON.parse(s) } : EMPTY) } catch { setForm(EMPTY) }
  }, [open, rule, mode, businessId, fromRule])

  useEffect(() => {
    if (!open || rule) return
    if (autosave.current) clearTimeout(autosave.current)
    autosave.current = setTimeout(() => { try { localStorage.setItem(draftKey(businessId), JSON.stringify(form)) } catch {} }, 600)
    return () => { if (autosave.current) clearTimeout(autosave.current) }
  }, [form, open, rule, businessId])

  const fields = useMemo(() => methodFields(form.pricingType), [form.pricingType])

  // Garments belonging to the chosen category (all garments when "All Categories").
  const visibleGarments = useMemo(
    () => (form.categoryId === NONE ? masters.garments : masters.garments.filter((g) => g.categoryId === form.categoryId)),
    [masters.garments, form.categoryId],
  )

  // Category is chosen BEFORE garment. Changing category clears a garment that no
  // longer belongs to it (Women → Bedding must drop "Pant").
  const pickCategory = (v: string) => setForm((p) => {
    if (v === p.categoryId) return p
    const g = v !== NONE && p.garmentId !== NONE ? masters.garments.find((x) => x.id === p.garmentId) : undefined
    const clear = v !== NONE && p.garmentId !== NONE && (!g || g.categoryId !== v)
    return { ...p, categoryId: v, garmentId: clear ? NONE : p.garmentId }
  })

  const buildPayload = () => {
    const num = (v: string) => (v === "" ? "" : v)
    return {
      name: form.name, description: form.description, notes: form.notes,
      serviceId: form.serviceId === NONE ? null : form.serviceId,
      garmentId: form.garmentId === NONE ? null : form.garmentId,
      categoryId: form.categoryId === NONE ? null : form.categoryId,
      storeId: form.storeId === NONE ? null : form.storeId,
      customerType: form.customerType === NONE ? null : form.customerType,
      pricingType: form.pricingType, price: form.price, gstPercent: form.gstPercent,
      minCharge: num(form.minCharge), maxCharge: num(form.maxCharge), minWeightKg: num(form.minWeightKg),
      maxWeightKg: num(form.maxWeightKg), extraWeightCharge: num(form.extraWeightCharge),
      includedPieces: num(form.includedPieces), discountPercent: num(form.discountPercent), discount: num(form.discount),
      weekendPrice: num(form.weekendPrice), expressCharge: num(form.expressCharge),
      pickupCharge: num(form.pickupCharge), deliveryCharge: num(form.deliveryCharge), hsnCode: form.hsnCode,
      priority: form.priority, effectiveFrom: form.effectiveFrom || null, effectiveTo: form.effectiveTo || null,
      status: form.isActiveStatus, actorId: actor?.id || null, actorName: actor?.name || null,
    }
  }

  const checkConflicts = useCallback(async () => {
    try {
      const res = await fetch("/api/laundry/pricing/conflicts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId, excludeId: rule && mode === "edit" ? rule.id : undefined,
          serviceId: form.serviceId === NONE ? null : form.serviceId,
          garmentId: form.garmentId === NONE ? null : form.garmentId,
          categoryId: form.categoryId === NONE ? null : form.categoryId,
          storeId: form.storeId === NONE ? null : form.storeId,
          customerType: form.customerType === NONE ? null : form.customerType,
          effectiveFrom: form.effectiveFrom || null, effectiveTo: form.effectiveTo || null,
        }),
      })
      return ((await res.json()).conflicts || []) as Rule[]
    } catch { return [] }
  }, [businessId, rule, mode, form])

  const doSave = async () => {
    if (!form.name.trim()) { toast.error("Rule Name is required"); setStep(0); return }
    setSaving(true)
    try {
      const isEdit = mode === "edit" && rule
      if (form.isActiveStatus === "ACTIVE" && !overrideConflicts) {
        const found = await checkConflicts()
        if (found.length > 0) { setConflicts(found); setSaving(false); return }
      }
      const url = isEdit ? `/api/laundry/pricing/${rule!.id}` : `/api/laundry/pricing`
      const body = isEdit ? buildPayload() : { ...buildPayload(), businessId, action: mode === "duplicate" ? "DUPLICATE" : "CREATE" }
      const res = await fetch(url, { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || "Save failed")
      if (!isEdit) { try { localStorage.removeItem(draftKey(businessId)) } catch {} }
      toast.success(isEdit ? "Pricing rule updated" : "Pricing rule created")
      onSaved() // refresh the list behind the modal
      if (isEdit) { onClose(); return }
      setSaved({ name: form.name, method: METHODS.find((m) => m.value === form.pricingType)?.title || form.pricingType, price: Number(form.price) || 0 })
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  const createAnother = () => { setForm(EMPTY); setStep(0); setConflicts(null); setOverrideConflicts(false); setSaved(null) }

  const Field = ({ f }: { f: FieldSpec }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{f.label}</Label>
      {f.text
        ? <Input value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder="e.g. base * 1.2 + 10" className="h-10" />
        : <Input type="number" step={f.int ? 1 : "any"} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} className="h-10" />}
    </div>
  )
  const Heading = ({ title, sub }: { title: string; sub?: string }) => (
    <div className="mb-6"><h3 className="text-xl font-semibold text-slate-800">{title}</h3>{sub && <p className="text-sm text-slate-500 mt-1">{sub}</p>}</div>
  )
  const SelectCards = ({ options, value, onPick, cols = 2 }: { options: { value: string; title: string; desc: string; icon: typeof User; adv?: boolean }[]; value: string; onPick: (v: string) => void; cols?: number }) => (
    <div className={`grid ${cols === 3 ? "grid-cols-3" : "grid-cols-2"} gap-3`}>
      {options.map((o) => {
        const active = value === o.value
        return (
          <button key={o.value} type="button" onClick={() => onPick(o.value)}
            className={`relative flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-all ${active ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500 shadow-sm" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}`}>
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}><o.icon className="h-[22px] w-[22px]" /></div>
            <div className="min-w-0 w-full">
              <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">{o.title}{o.adv && <Badge variant="outline" className="text-[9px] border-violet-300 text-violet-600 bg-violet-50 px-1">Beta</Badge>}</p>
              <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{o.desc}</p>
            </div>
            {active && <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600"><Check className="h-3.5 w-3.5" /> Selected</span>}
          </button>
        )
      })}
    </div>
  )

  const title = mode === "edit" ? "Edit Pricing Rule" : mode === "duplicate" ? "Duplicate Pricing Rule" : "New Pricing Rule"
  const last = STEPS.length - 1
  const canNext = step === 0 ? form.name.trim().length > 0 : true
  const method = METHODS.find((m) => m.value === form.pricingType)
  const scope = [
    form.customerType === NONE ? "All Customers" : typeLabel(form.customerType),
    nameOf(masters.stores, form.storeId, "storeName"),
    nameOf(masters.services, form.serviceId),
    nameOf(masters.cats, form.categoryId),
    nameOf(masters.garments, form.garmentId),
  ]
  // Category and Garment are a hierarchy (Category › Garment), NOT part of the
  // customer/store "Applies To" scope. Category is never the garment.
  const catDisplay = form.categoryId === NONE ? "All Categories" : scope[3]
  const grmDisplay = form.garmentId === NONE ? "All Garments" : scope[4]
  const garmentPath = `${catDisplay} › ${grmDisplay}`
  const prio = Number(form.priority) || 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[840px] max-h-[94vh] p-0 overflow-hidden gap-0">
        {saved ? (
          <div className="px-8 py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-9 w-9" /></div>
            <h2 className="mt-4 text-xl font-bold text-slate-800">Pricing Rule Created</h2>
            <p className="mt-1 text-slate-500">{saved.name}</p>
            <p className="mt-3 text-2xl font-bold text-blue-700">{inr(saved.price)} <span className="text-sm font-normal text-slate-400">/ {saved.method}</span></p>
            <p className="mt-6 text-sm font-medium text-slate-600">What would you like to do?</p>
            <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button onClick={createAnother} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"><Plus className="h-4 w-4" /> Create Another</Button>
              <Button variant="outline" onClick={onClose} className="gap-1.5 w-full sm:w-auto"><ListChecks className="h-4 w-4" /> View Rules</Button>
              <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">Close</Button>
            </div>
          </div>
        ) : (<>
        {/* Header + progress + stepper */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div><h2 className="text-lg font-bold text-slate-800">{title}</h2><p className="text-xs text-slate-400">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p></div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
          <div className="mt-3 flex items-center gap-1 overflow-x-auto">
            {STEPS.map((s, i) => (
              <button key={s} type="button" onClick={() => i <= step && setStep(i)} disabled={i > step}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] whitespace-nowrap transition-colors ${i === step ? "bg-blue-600 text-white font-medium" : i < step ? "text-blue-700" : "text-slate-400"}`}>
                <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${i === step ? "bg-white/25" : i < step ? "bg-blue-100 text-blue-700" : "border border-slate-300"}`}>{i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}</span>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Body: form + live summary */}
        <div className="grid md:grid-cols-[1fr_270px] max-h-[62vh] overflow-hidden">
          <div className="overflow-y-auto px-6 py-5">
            {step === 0 && (<>
              <Heading title="Rule identity & customer" sub="Name the rule and choose who it applies to." />
              <div className="space-y-4">
                <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                  <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-600">Rule Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. VIP Dry Clean — Blazer" className="h-10" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-600">Status</Label>
                    <div className="flex items-center gap-2 h-10"><Switch checked={form.isActiveStatus === "ACTIVE"} onCheckedChange={(v) => set("isActiveStatus", v ? "ACTIVE" : "INACTIVE")} className="data-[state=checked]:bg-emerald-600" /><span className="text-sm font-medium text-slate-700">{form.isActiveStatus === "ACTIVE" ? "Active" : "Inactive"}</span></div>
                  </div>
                </div>
                <SelectCards options={CUSTOMER_CARDS} value={form.customerType} onPick={(v) => set("customerType", v)} />
              </div>
            </>)}

            {step === 1 && (<>
              <Heading title="Which store?" sub="Limit this price to one store, or apply to all." />
              <SelectCards value={form.storeId} onPick={(v) => set("storeId", v)}
                options={[{ value: NONE, title: "All Stores", desc: "Apply pricing to every branch", icon: StoreIcon }, ...masters.stores.map((s) => ({ value: s.id, title: (s.storeName || s.name || s.id) as string, desc: "This store only", icon: StoreIcon }))]} />
            </>)}

            {step === 2 && (<>
              <Heading title="Which service?" sub="Pick the laundry service this price is for." />
              <SelectCards value={form.serviceId} onPick={(v) => set("serviceId", v)} cols={masters.services.length > 4 ? 3 : 2}
                options={[{ value: NONE, title: "All Services", desc: "Every service", icon: WashingMachine }, ...masters.services.map((s) => ({ value: s.id, title: (s.name || s.id) as string, desc: "Service", icon: svcIcon(s.name) }))]} />
            </>)}

            {step === 3 && (<>
              <Heading title="Category & garment" sub="Choose the garment group first, then the garment." />
              <div className="space-y-6">
                {/* A. Category — chosen first */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">Which category?</p>
                  <p className="text-xs text-slate-400 mb-3">Choose the garment group first.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => pickCategory(NONE)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${form.categoryId === NONE ? "border-blue-500 bg-blue-50 font-medium text-blue-700" : "border-slate-200 hover:bg-slate-50 text-slate-600"}`}>
                      <Package className="h-3.5 w-3.5 text-slate-400" /> All Categories</button>
                    {masters.cats.map((c) => (
                      <button key={c.id} type="button" onClick={() => pickCategory(c.id)}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${form.categoryId === c.id ? "border-blue-500 bg-blue-50 font-medium text-blue-700" : "border-slate-200 hover:bg-slate-50 text-slate-600"}`}>{c.name}</button>
                    ))}
                  </div>
                  {form.categoryId !== NONE && <p className="mt-2 text-xs text-slate-500">Selected: <b className="text-slate-700">{catDisplay}</b></p>}
                </div>

                {/* B. Garment — filtered by the chosen category */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">Which garment?</p>
                  <p className="text-xs text-slate-400 mb-3">{form.categoryId === NONE ? "Search across all garments, or apply to every garment." : `Garments in ${catDisplay}.`}</p>
                  <SearchableSelect value={form.garmentId} onChange={(v) => set("garmentId", v)} options={refOpts(visibleGarments)} placeholder="Search garment…" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => set("garmentId", NONE)} className={`rounded-lg border px-3 py-2 text-sm ${form.garmentId === NONE ? "border-blue-500 bg-blue-50 font-medium text-blue-700" : "border-slate-200 hover:bg-slate-50 text-slate-600"}`}>All Garments</button>
                    {visibleGarments.slice(0, 10).map((g) => (
                      <button key={g.id} type="button" onClick={() => set("garmentId", g.id)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${form.garmentId === g.id ? "border-blue-500 bg-blue-50 font-medium text-blue-700" : "border-slate-200 hover:bg-slate-50 text-slate-600"}`}><Shirt className="h-3.5 w-3.5 text-slate-400" /> {g.name}</button>
                    ))}
                    {visibleGarments.length === 0 && form.categoryId !== NONE && <p className="text-xs text-slate-400 py-2">No garments in this category yet — “All Garments” will apply the rule to the whole category.</p>}
                  </div>
                </div>
              </div>
            </>)}

            {step === 4 && (<>
              <Heading title="Pricing method" sub="How the price is calculated." />
              <SelectCards options={METHODS} value={form.pricingType} onPick={(v) => set("pricingType", v)} />
              <div className="grid grid-cols-2 gap-3 mt-4">
                {fields.map((f) => <Field key={f.key} f={f} />)}
                <Field f={{ key: "gstPercent", label: "GST %" }} />
              </div>
              {method?.adv && <p className="mt-3 text-[11px] text-violet-600 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">Advanced methods are captured here; the billing engine currently computes Fixed / Per Piece / Per KG. Discount & formula methods need a billing add-on to affect live charges.</p>}
            </>)}

            {step === 5 && (<>
              <Heading title="Conditions & business rules" sub="All optional — leave blank to skip." />
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Charges</p>
                  <div className="grid grid-cols-2 gap-3"><Field f={{ key: "minCharge", label: "Minimum Charge (₹)" }} /><Field f={{ key: "maxCharge", label: "Maximum Charge (₹)" }} /></div>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Delivery</p>
                  <div className="grid grid-cols-2 gap-3"><Field f={{ key: "pickupCharge", label: "Pickup Charge (₹)" }} /><Field f={{ key: "deliveryCharge", label: "Delivery Charge (₹)" }} /></div>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Special Pricing</p>
                  <div className="grid grid-cols-2 gap-3"><Field f={{ key: "weekendPrice", label: "Weekend Premium (₹)" }} /><Field f={{ key: "expressCharge", label: "Express Charge (₹)" }} /></div>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Validity</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-600">Start Date</Label><Input type="date" value={form.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} className="h-10" /></div>
                    <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-600">End Date</Label><Input type="date" value={form.effectiveTo} onChange={(e) => set("effectiveTo", e.target.value)} className="h-10" /></div>
                  </div>
                </div>
              </div>
            </>)}

            {step === 6 && (<>
              <Heading title="Priority & notes" sub="Breaks ties when two equally-specific rules match the same item." />
              <div className="space-y-5">
                <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-600">Priority</Label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={0} max={100} value={prio} onChange={(e) => set("priority", e.target.value)} className="flex-1 accent-blue-600" />
                    <Input type="number" value={form.priority} onChange={(e) => set("priority", e.target.value)} className="h-10 w-20" />
                  </div>
                  <p className="text-xs text-slate-500 pt-0.5">{prio} · <b className="text-slate-700">{priorityLabel(prio)}</b></p>
                </div>

                {/* Priority reference + how the resolver actually decides */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Rule Priority</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    {[["0", "Normal"], ["25", "Preferred"], ["50", "High"], ["75", "Override"], ["100", "Highest"]].map(([n, lbl]) => (
                      <div key={n} className="flex items-center justify-between"><span className="font-mono text-slate-500">{n}</span><span className="font-medium text-slate-700">{lbl}</span></div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600 leading-relaxed">
                    <p className="flex items-start gap-1.5"><Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" /><span>The billing engine picks the <b>most specific</b> matching rule first (a rule that targets Customer + Service + Category + Garment beats a generic one). <b>Priority only breaks ties</b> between rules of equal specificity — the higher number wins.</span></p>
                    <p className="mt-2 pl-5 text-slate-500">e.g. two rules both scoped to <i>VIP · Dry Clean · Blazer</i>: the one with Priority 50 wins over Priority 0.</p>
                  </div>
                </div>

                <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-600">Rule Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-[70px]" placeholder="Internal notes about this rule…" /></div>
              </div>
            </>)}

            {step === 7 && (<>
              <Heading title="Review & create" sub="Confirm everything before saving." />
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 px-5 py-3 border-b border-slate-200">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Pricing Rule</p>
                  <Badge variant="outline" className={form.isActiveStatus === "ACTIVE" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-300 text-slate-500 bg-white"}>{form.isActiveStatus === "ACTIVE" ? "🟢 Active" : typeLabel(form.isActiveStatus)}</Badge>
                </div>
                <div className="divide-y divide-slate-100 text-sm">
                  {[["Rule", form.name || "—"], ["Customer", scope[0]], ["Store", scope[1]], ["Service", scope[2]], ["Category", catDisplay], ["Garment", grmDisplay],
                    ["Pricing", `${inr(Number(form.price) || 0)} / ${method?.title}`], ["GST", `${form.gstPercent || 0}%`],
                    ["Conditions", [form.weekendPrice && "Weekend", form.expressCharge && "Express", form.pickupCharge && "Pickup", form.deliveryCharge && "Delivery", form.minCharge && "Min", form.maxCharge && "Max"].filter(Boolean).join(", ") || "None"],
                    ["Priority", `${prio} · ${priorityLabel(prio)}`], ["Effective", form.effectiveFrom || form.effectiveTo ? `${form.effectiveFrom || "…"} → ${form.effectiveTo || "…"}` : "Always"]].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 px-5 py-3"><span className="text-slate-400">{k}</span><span className="font-semibold text-slate-800 text-right">{v}</span></div>
                  ))}
                  <div className="flex justify-between gap-4 px-5 py-3.5 bg-blue-50/50"><span className="font-semibold text-slate-700">Estimated (2 pcs + GST)</span><span className="font-bold text-blue-700">{inr(simulate(form).total > 0 ? simulate(form).total : Number(form.price) || 0)}</span></div>
                </div>
              </div>
              {conflicts && conflicts.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 mb-2 text-amber-800"><AlertTriangle className="h-4 w-4" /><span className="text-xs font-semibold">Overlaps with {conflicts.length} active rule(s)</span></div>
                  <ul className="space-y-1 text-xs text-amber-900">{conflicts.map((c) => <li key={c.id} className="flex justify-between gap-3 rounded bg-white/70 px-2 py-1"><span>{c.name || typeLabel(c.pricingType)}</span><span className="font-medium">Priority {c.priority}</span></li>)}</ul>
                  <label className="mt-2 flex items-center gap-2 text-xs text-amber-900"><input type="checkbox" checked={overrideConflicts} onChange={(e) => setOverrideConflicts(e.target.checked)} /> Save anyway (I understand the overlap)</label>
                </div>
              )}
            </>)}
          </div>

          {/* Live preview + simulator panel */}
          <div className="hidden md:block border-l border-slate-100 bg-slate-50/60 px-5 py-5 overflow-y-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Live Preview</p>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2.5">
                {(() => { const GI = form.serviceId !== NONE ? svcIcon(masters.services.find((s) => s.id === form.serviceId)?.name) : Shirt; return <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><GI className="h-5 w-5" /></div> })()}
                <div className="min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{scope[4] !== "All" ? scope[4] : (form.name || "New Rule")}</p><p className="text-[11px] text-slate-400">{scope[2] !== "All" ? scope[2] : "All services"}</p></div>
              </div>
              <p className="mt-3 text-2xl font-bold text-blue-700">{inr(Number(form.price) || 0)} <span className="text-xs font-normal text-slate-400">/ {method?.title}</span></p>

              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Applies To</p>
                {[["All Customers", scope[0]], ["All Stores", scope[1]]].map(([def, v]) => (
                  <p key={def} className="flex items-center gap-1.5 text-xs text-slate-600 py-0.5"><Check className="h-3 w-3 text-emerald-500 shrink-0" /> {v === "All" ? def : v}</p>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Garment</p>
                <p className="text-xs font-medium text-slate-700">{garmentPath}</p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Conditions</p>
                <div className="flex flex-wrap gap-1">
                  {[form.weekendPrice && "Weekend", form.expressCharge && "Express", form.pickupCharge && "Pickup", form.deliveryCharge && "Delivery", form.minCharge && "Min", form.maxCharge && "Max"].filter(Boolean).length === 0
                    ? <span className="text-xs text-slate-400">None</span>
                    : [form.weekendPrice && "Weekend", form.expressCharge && "Express", form.pickupCharge && "Pickup", form.deliveryCharge && "Delivery", form.minCharge && "Min", form.maxCharge && "Max"].filter(Boolean).map((c) => <Badge key={c as string} variant="outline" className="bg-white text-[10px]">{c}</Badge>)}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">Priority <b className="text-slate-700">{prio} · {priorityLabel(prio)}</b></span>
                <Badge variant="outline" className={`text-[10px] ${form.isActiveStatus === "ACTIVE" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-300 text-slate-500 bg-white"}`}>{form.isActiveStatus === "ACTIVE" ? "🟢 Active" : typeLabel(form.isActiveStatus)}</Badge>
              </div>
            </div>

            {/* Simulator */}
            {(() => { const sim = simulate(form); return (Number(form.price) > 0) ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><ListChecks className="h-3 w-3" /> Simulation</p>
                <div className="space-y-1">
                  {sim.rows.map(([lbl, amt]) => <div key={lbl} className="flex justify-between text-xs"><span className="text-slate-500">{lbl}</span><span className="font-medium text-slate-700">{inr(amt)}</span></div>)}
                  {Number(form.gstPercent) > 0 && <div className="flex justify-between text-xs"><span className="text-slate-500">GST {form.gstPercent}%</span><span className="font-medium text-slate-700">{inr(sim.gstAmt)}</span></div>}
                  <div className="flex justify-between text-sm pt-1.5 mt-1 border-t border-slate-100"><span className="font-semibold text-slate-700">Total</span><span className="font-bold text-blue-700">{inr(sim.total)}</span></div>
                </div>
              </div>
            ) : null })()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <Button variant="ghost" onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))} className="gap-1"><ChevronLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}</Button>
          {step < last
            ? <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white px-6">Next <ChevronRight className="h-4 w-4" /></Button>
            : <Button onClick={doSave} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white px-6">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {conflicts && conflicts.length > 0 && overrideConflicts ? "Save Anyway" : "Create Rule"}</Button>}
        </div>
        </>)}
      </DialogContent>
    </Dialog>
  )
}
