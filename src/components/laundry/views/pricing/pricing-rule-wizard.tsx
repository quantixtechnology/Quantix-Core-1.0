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
  Loader2, AlertTriangle, Save, Check, ChevronLeft, ChevronRight, Trophy, X,
  User, Truck, Building2, Hotel, Cross, Repeat, Crown, Users2,
  Coins, Package, Scale, Percent, Tag, Calculator, Store as StoreIcon, WashingMachine, Shirt, Info,
} from "lucide-react"
import { toast } from "sonner"
import { SearchableSelect, type Option } from "./searchable-select"
import { NONE, typeLabel, inr, type Ref, type Rule } from "./pricing-shared"

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
    setStep(0); setConflicts(null); setOverrideConflicts(false)
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
      onSaved(); onClose()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  const Field = ({ f }: { f: FieldSpec }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{f.label}</Label>
      {f.text
        ? <Input value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder="e.g. base * 1.2 + 10" className="h-10" />
        : <Input type="number" step={f.int ? 1 : "any"} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} className="h-10" />}
    </div>
  )
  const Heading = ({ title, sub }: { title: string; sub?: string }) => (
    <div className="mb-4"><h3 className="text-lg font-semibold text-slate-800">{title}</h3>{sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}</div>
  )
  const SelectCards = ({ options, value, onPick }: { options: { value: string; title: string; desc: string; icon: typeof User; adv?: boolean }[]; value: string; onPick: (v: string) => void }) => (
    <div className="grid grid-cols-2 gap-2.5">
      {options.map((o) => {
        const active = value === o.value
        return (
          <button key={o.value} type="button" onClick={() => onPick(o.value)}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${active ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}><o.icon className="h-4.5 w-4.5" /></div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">{o.title}{o.adv && <Badge variant="outline" className="text-[9px] border-violet-300 text-violet-600 bg-violet-50 px-1">Beta</Badge>}</p>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{o.desc}</p>
            </div>
            {active && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[840px] max-h-[94vh] p-0 overflow-hidden gap-0">
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
              <SelectCards options={[{ value: NONE, title: "All Stores", desc: "Every location", icon: StoreIcon }, ...masters.stores.map((s) => ({ value: s.id, title: (s.storeName || s.name || s.id), desc: "Store", icon: StoreIcon }))]} value={form.storeId} onPick={(v) => set("storeId", v)} />
            </>)}

            {step === 2 && (<>
              <Heading title="Which service?" sub="The laundry service this price is for." />
              <div className="flex items-center gap-2 mb-2 text-slate-500"><WashingMachine className="h-4 w-4" /><span className="text-sm">Service</span></div>
              <SearchableSelect value={form.serviceId} onChange={(v) => set("serviceId", v)} options={refOpts(masters.services)} placeholder="All services" />
            </>)}

            {step === 3 && (<>
              <Heading title="Which garment?" sub="Target a specific garment and/or category." />
              <div className="space-y-4">
                <div><div className="flex items-center gap-2 mb-1.5 text-slate-500"><Shirt className="h-4 w-4" /><span className="text-sm">Garment</span></div><SearchableSelect value={form.garmentId} onChange={(v) => set("garmentId", v)} options={refOpts(masters.garments)} placeholder="All garments" /></div>
                <div><div className="flex items-center gap-2 mb-1.5 text-slate-500"><Package className="h-4 w-4" /><span className="text-sm">Category (optional)</span></div><SearchableSelect value={form.categoryId} onChange={(v) => set("categoryId", v)} options={refOpts(masters.cats)} placeholder="All categories" /></div>
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
              <Heading title="Conditions & business rules" sub="Optional charges and limits." />
              <div className="grid grid-cols-2 gap-3">
                <Field f={{ key: "minCharge", label: "Minimum Charge (₹)" }} />
                <Field f={{ key: "maxCharge", label: "Maximum Charge (₹)" }} />
                <Field f={{ key: "weekendPrice", label: "Weekend Price (₹)" }} />
                <Field f={{ key: "expressCharge", label: "Express Charge (₹)" }} />
                <Field f={{ key: "pickupCharge", label: "Pickup Charge (₹)" }} />
                <Field f={{ key: "deliveryCharge", label: "Delivery Charge (₹)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-600">Effective From (holiday/season)</Label><Input type="date" value={form.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} className="h-10" /></div>
                <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-600">Effective To</Label><Input type="date" value={form.effectiveTo} onChange={(e) => set("effectiveTo", e.target.value)} className="h-10" /></div>
              </div>
            </>)}

            {step === 6 && (<>
              <Heading title="Priority & notes" sub="Higher priority wins when rules overlap." />
              <div className="space-y-4">
                <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-600">Priority</Label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={0} max={100} value={Number(form.priority) || 0} onChange={(e) => set("priority", e.target.value)} className="flex-1 accent-blue-600" />
                    <Input type="number" value={form.priority} onChange={(e) => set("priority", e.target.value)} className="h-10 w-20" />
                  </div>
                </div>
                <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-600">Rule Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-[70px]" placeholder="Internal notes about this rule…" /></div>
              </div>
            </>)}

            {step === 7 && (<>
              <Heading title="Review & create" sub="Confirm everything before saving." />
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
                {[["Rule Name", form.name || "—"], ["Status", form.isActiveStatus === "ACTIVE" ? "Active" : typeLabel(form.isActiveStatus)],
                  ["Scope", scope.join(" · ")], ["Pricing", `${method?.title} · ${inr(Number(form.price) || 0)}`],
                  ["GST", `${form.gstPercent || 0}%`], ["Conditions", [form.weekendPrice && "Weekend", form.expressCharge && "Express", form.pickupCharge && "Pickup", form.deliveryCharge && "Delivery", form.minCharge && "Min", form.maxCharge && "Max"].filter(Boolean).join(", ") || "None"],
                  ["Priority", form.priority || "0"], ["Effective", form.effectiveFrom || form.effectiveTo ? `${form.effectiveFrom || "…"} → ${form.effectiveTo || "…"}` : "Always"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><span className="text-slate-500">{k}</span><span className="font-medium text-slate-800 text-right">{v}</span></div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-emerald-700 text-sm font-medium"><Trophy className="h-4 w-4" /> Rule ready to save</div>
              {conflicts && conflicts.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 mb-2 text-amber-800"><AlertTriangle className="h-4 w-4" /><span className="text-xs font-semibold">Overlaps with {conflicts.length} active rule(s)</span></div>
                  <ul className="space-y-1 text-xs text-amber-900">{conflicts.map((c) => <li key={c.id} className="flex justify-between gap-3 rounded bg-white/70 px-2 py-1"><span>{c.name || typeLabel(c.pricingType)}</span><span className="font-medium">Priority {c.priority}</span></li>)}</ul>
                  <label className="mt-2 flex items-center gap-2 text-xs text-amber-900"><input type="checkbox" checked={overrideConflicts} onChange={(e) => setOverrideConflicts(e.target.checked)} /> Save anyway (I understand the overlap)</label>
                </div>
              )}
            </>)}
          </div>

          {/* Live summary panel */}
          <div className="hidden md:block border-l border-slate-100 bg-slate-50/60 px-5 py-5 overflow-y-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Live Summary</p>
            <p className="text-sm font-semibold text-slate-800">{form.name || "Untitled rule"}</p>
            <Badge variant="outline" className={`mt-1 text-[10px] ${form.isActiveStatus === "ACTIVE" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-300 text-slate-500 bg-white"}`}>{form.isActiveStatus === "ACTIVE" ? "Active" : typeLabel(form.isActiveStatus)}</Badge>
            <div className="mt-4 space-y-1.5">
              {[["Customer", scope[0]], ["Store", scope[1]], ["Service", scope[2]], ["Category", scope[3]], ["Garment", scope[4]]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 text-xs"><span className="text-slate-400">{k}</span><span className="font-medium text-slate-700 text-right truncate">{v}</span></div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200">
              <p className="text-[11px] text-slate-400">{method?.title}</p>
              <p className="text-2xl font-bold text-blue-700">{inr(Number(form.price) || 0)}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="outline" className="bg-white text-[10px]">GST {form.gstPercent || 0}%</Badge>
                <Badge variant="outline" className="bg-white text-[10px]">Priority {form.priority || 0}</Badge>
                {form.weekendPrice && <Badge variant="outline" className="bg-white text-[10px]">Weekend</Badge>}
                {form.expressCharge && <Badge variant="outline" className="bg-white text-[10px]">Express</Badge>}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <Button variant="ghost" onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))} className="gap-1"><ChevronLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}</Button>
          {step < last
            ? <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white px-6">Next <ChevronRight className="h-4 w-4" /></Button>
            : <Button onClick={doSave} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white px-6">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {conflicts && conflicts.length > 0 && overrideConflicts ? "Save Anyway" : "Create Rule"}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
