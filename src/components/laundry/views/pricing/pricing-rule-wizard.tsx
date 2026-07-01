"use client"

// Enterprise Pricing Wizard — a stepped, business-oriented rule builder that
// replaces the long developer form. Reuses the existing pricing API + conflict
// detection. Does NOT touch the Billing Resolver.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertTriangle, Save, Check, ChevronLeft, ChevronRight, ArrowDown, Trophy } from "lucide-react"
import { toast } from "sonner"
import { SearchableSelect, type Option } from "./searchable-select"
import {
  NONE, PRICING_TYPES, CUSTOMER_TYPES, STATUSES, typeLabel, priceFieldsFor, inr,
  type Ref, type Rule,
} from "./pricing-shared"

type Mode = "create" | "edit" | "duplicate"
interface Masters { services: Ref[]; garments: Ref[]; cats: Ref[]; stores: Ref[] }
type Form = Record<string, string> & { isActiveStatus: string }

const EMPTY: Form = {
  name: "", description: "", notes: "", serviceId: NONE, garmentId: NONE, categoryId: NONE, storeId: NONE,
  customerType: NONE, pricingType: "PER_PIECE", price: "0", gstPercent: "0", minCharge: "", maxCharge: "",
  minWeightKg: "", maxWeightKg: "", extraWeightCharge: "", includedPieces: "", discountPercent: "",
  weekendPrice: "", expressCharge: "", pickupCharge: "", deliveryCharge: "", hsnCode: "", priority: "0",
  effectiveFrom: "", effectiveTo: "", isActiveStatus: "ACTIVE",
}

const STEPS = ["Customer", "Store", "Service", "Category", "Garment", "Pricing Type", "Charges", "Preview"]
const draftKey = (b: string) => `qx-pricing-draft-${b}`
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

  const priceFields = useMemo(() => priceFieldsFor(form.pricingType), [form.pricingType])

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
      includedPieces: num(form.includedPieces), discountPercent: num(form.discountPercent),
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

  const NumField = ({ k, label, int }: { k: string; label: string; int?: boolean }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={int ? 1 : "any"} value={form[k]} onChange={(e) => set(k, e.target.value)} className="h-9" />
    </div>
  )
  const Question = ({ children }: { children: React.ReactNode }) => <p className="text-sm font-semibold mb-3">{children}</p>

  const title = mode === "edit" ? "Edit Pricing Rule" : mode === "duplicate" ? "Duplicate Pricing Rule" : "New Pricing Rule"
  const last = STEPS.length - 1
  const canNext = step === 0 ? form.name.trim().length > 0 : true

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Step {step + 1} of {STEPS.length} — {STEPS[step]}</DialogDescription>
        </DialogHeader>

        {/* Stepper rail */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => i <= step && setStep(i)} disabled={i > step}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] whitespace-nowrap transition-colors ${
                i === step ? "bg-blue-600 text-white" : i < step ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[9px]">{i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}</span>
              {s}
            </button>
          ))}
        </div>

        <div className="min-h-[260px] py-3">
          {/* Step 1 — Customer Type + rule identity */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1"><Label className="text-xs">Rule Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. VIP Dry Clean — Blazer" className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">Status</Label>
                  <Select value={form.isActiveStatus} onValueChange={(v) => set("isActiveStatus", v)}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{typeLabel(s)}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <Question>Who is this price for?</Question>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[{ value: NONE, label: "All Customers" }, ...CUSTOMER_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))].map((o) => (
                  <button key={o.value} onClick={() => set("customerType", o.value)}
                    className={`rounded-lg border px-3 py-2.5 text-sm text-left transition-colors ${form.customerType === o.value ? "border-blue-500 bg-blue-50 font-medium" : "hover:bg-muted/50"}`}>{o.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Store */}
          {step === 1 && (
            <div className="space-y-3">
              <Question>Which store does this apply to?</Question>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {refOpts(masters.stores, "storeName").map((o) => (
                  <button key={o.value} onClick={() => set("storeId", o.value)}
                    className={`rounded-lg border px-3 py-2.5 text-sm text-left transition-colors ${form.storeId === o.value ? "border-blue-500 bg-blue-50 font-medium" : "hover:bg-muted/50"}`}>{o.value === NONE ? "All Stores" : o.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Service */}
          {step === 2 && (
            <div className="space-y-3">
              <Question>Which service?</Question>
              <SearchableSelect value={form.serviceId} onChange={(v) => set("serviceId", v)} options={refOpts(masters.services)} placeholder="All services" />
            </div>
          )}

          {/* Step 4 — Category */}
          {step === 3 && (
            <div className="space-y-3">
              <Question>Which category?</Question>
              <SearchableSelect value={form.categoryId} onChange={(v) => set("categoryId", v)} options={refOpts(masters.cats)} placeholder="All categories" />
            </div>
          )}

          {/* Step 5 — Garment */}
          {step === 4 && (
            <div className="space-y-3">
              <Question>Which garment?</Question>
              <SearchableSelect value={form.garmentId} onChange={(v) => set("garmentId", v)} options={refOpts(masters.garments)} placeholder="All garments" />
            </div>
          )}

          {/* Step 6 — Pricing Type + conditional fields */}
          {step === 5 && (
            <div className="space-y-4">
              <Question>How should pricing work?</Question>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PRICING_TYPES.map((t) => (
                  <button key={t} onClick={() => set("pricingType", t)}
                    className={`rounded-lg border px-3 py-2.5 text-sm transition-colors ${form.pricingType === t ? "border-blue-500 bg-blue-50 font-medium" : "hover:bg-muted/50"}`}>{typeLabel(t)}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                {priceFields.map((f) => <NumField key={f.key} k={f.key} label={f.label} int={f.int} />)}
              </div>
            </div>
          )}

          {/* Step 7 — Charges, tax, priority, validity */}
          {step === 6 && (
            <div className="space-y-4">
              <Question>Charges, tax &amp; validity</Question>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <NumField k="gstPercent" label="GST %" />
                <NumField k="minCharge" label="Minimum" />
                <NumField k="maxCharge" label="Maximum" />
                <NumField k="weekendPrice" label="Weekend Price" />
                <NumField k="expressCharge" label="Express" />
                <NumField k="pickupCharge" label="Pickup" />
                <NumField k="deliveryCharge" label="Delivery" />
                <NumField k="priority" label="Priority" int />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">Effective From</Label><Input type="date" value={form.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">Effective To</Label><Input type="date" value={form.effectiveTo} onChange={(e) => set("effectiveTo", e.target.value)} className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">HSN (future)</Label><Input value={form.hsnCode} onChange={(e) => set("hsnCode", e.target.value)} className="h-9" /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Rule Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-[50px]" /></div>
            </div>
          )}

          {/* Step 8 — Live preview */}
          {step === 7 && (
            <div className="space-y-3">
              <Question>Review &amp; save</Question>
              <div className="rounded-lg border bg-blue-50/50 p-4">
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  {[form.customerType === NONE ? "All Customers" : typeLabel(form.customerType),
                    nameOf(masters.stores, form.storeId, "storeName"),
                    nameOf(masters.services, form.serviceId),
                    nameOf(masters.cats, form.categoryId),
                    nameOf(masters.garments, form.garmentId)].map((v, i, arr) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <Badge variant="outline" className="bg-white">{v}</Badge>
                      {i < arr.length - 1 && <ArrowDown className="h-3 w-3 text-blue-400 rotate-[-90deg]" />}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-2xl font-bold text-blue-800">{inr(Number(form.price) || 0)} <span className="text-sm font-normal text-muted-foreground">/ {typeLabel(form.pricingType)}</span></div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="bg-white">Priority {form.priority || 0}</Badge>
                  <Badge variant="outline" className="bg-white">GST {form.gstPercent || 0}%</Badge>
                  <Badge variant="outline" className="bg-white">Weekend {form.weekendPrice ? `₹${form.weekendPrice}` : "No"}</Badge>
                  <Badge variant="outline" className="bg-white">Express {form.expressCharge ? `₹${form.expressCharge}` : "No"}</Badge>
                  <Badge variant="outline" className="bg-white">{typeLabel(form.isActiveStatus)}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-emerald-700 text-sm font-medium"><Trophy className="h-4 w-4" /> Rule ready to save</div>
              </div>

              {conflicts && conflicts.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 mb-2 text-amber-800"><AlertTriangle className="h-4 w-4" /><span className="text-xs font-semibold">Overlaps with {conflicts.length} active rule(s)</span></div>
                  <ul className="space-y-1 text-xs text-amber-900">
                    {conflicts.map((c) => <li key={c.id} className="flex justify-between gap-3 rounded bg-white/70 px-2 py-1"><span>{c.name || typeLabel(c.pricingType)}</span><span className="font-medium">Priority {c.priority}</span></li>)}
                  </ul>
                  <label className="mt-2 flex items-center gap-2 text-xs text-amber-900"><input type="checkbox" checked={overrideConflicts} onChange={(e) => setOverrideConflicts(e.target.checked)} /> Save anyway (I understand the overlap)</label>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button variant="ghost" onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < last ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">Next <ChevronRight className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={doSave} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {conflicts && conflicts.length > 0 && overrideConflicts ? "Save Anyway" : "Save Rule"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
