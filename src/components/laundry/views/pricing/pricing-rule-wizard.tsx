"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertTriangle, Info, Save } from "lucide-react"
import { toast } from "sonner"
import { SearchableSelect, type Option } from "./searchable-select"
import {
  NONE, PRICING_TYPES, CUSTOMER_TYPES, STATUSES, typeLabel, priceFieldsFor,
  type Ref, type Rule,
} from "./pricing-shared"

type Mode = "create" | "edit" | "duplicate"

interface Masters { services: Ref[]; garments: Ref[]; cats: Ref[]; stores: Ref[] }

type Form = Record<string, string> & { isActiveStatus: string }

const FIELD_KEYS = [
  "name", "description", "notes", "serviceId", "garmentId", "categoryId", "storeId", "customerType",
  "pricingType", "price", "gstPercent", "minCharge", "maxCharge", "minWeightKg", "maxWeightKg",
  "extraWeightCharge", "includedPieces", "discountPercent", "weekendPrice", "expressCharge",
  "pickupCharge", "deliveryCharge", "hsnCode", "priority", "effectiveFrom", "effectiveTo",
] as const

const EMPTY: Form = {
  name: "", description: "", notes: "", serviceId: NONE, garmentId: NONE, categoryId: NONE, storeId: NONE,
  customerType: NONE, pricingType: "PER_PIECE", price: "0", gstPercent: "0", minCharge: "", maxCharge: "",
  minWeightKg: "", maxWeightKg: "", extraWeightCharge: "", includedPieces: "", discountPercent: "",
  weekendPrice: "", expressCharge: "", pickupCharge: "", deliveryCharge: "", hsnCode: "", priority: "0",
  effectiveFrom: "", effectiveTo: "", isActiveStatus: "ACTIVE",
}

const draftKey = (businessId: string) => `qx-pricing-draft-${businessId}`
const refOpts = (refs: Ref[], labelKey: "name" | "storeName" = "name"): Option[] =>
  [{ value: NONE, label: "All" }, ...refs.map((r) => ({ value: r.id, label: (r[labelKey] as string) || r.name || r.storeName || r.id }))]

export function PricingRuleWizard({
  open, mode, rule, businessId, masters, actor, onClose, onSaved,
}: {
  open: boolean
  mode: Mode
  rule: Rule | null
  businessId: string
  masters: Masters
  actor?: { id?: string; name?: string }
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [conflicts, setConflicts] = useState<Rule[] | null>(null)
  const [overrideConflicts, setOverrideConflicts] = useState(false)
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Seed the form when opened. New rules restore an autosaved draft if present.
  useEffect(() => {
    if (!open) return
    setConflicts(null); setOverrideConflicts(false)
    if (rule) { setForm(fromRule(rule, mode === "duplicate")); return }
    try {
      const saved = localStorage.getItem(draftKey(businessId))
      setForm(saved ? { ...EMPTY, ...JSON.parse(saved) } : EMPTY)
    } catch { setForm(EMPTY) }
  }, [open, rule, mode, businessId, fromRule])

  // Autosave draft (new rules only).
  useEffect(() => {
    if (!open || rule) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      try { localStorage.setItem(draftKey(businessId), JSON.stringify(form)) } catch {}
    }, 600)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
  }, [form, open, rule, businessId])

  const priceFields = useMemo(() => priceFieldsFor(form.pricingType), [form.pricingType])

  const scopeChips = useMemo(() => {
    const name = (refs: Ref[], id: string, key: "name" | "storeName" = "name") =>
      id === NONE ? "All" : (refs.find((r) => r.id === id)?.[key] as string) || id
    return [
      { label: "Store", value: name(masters.stores, form.storeId, "storeName") },
      { label: "Customer", value: form.customerType === NONE ? "All" : typeLabel(form.customerType) },
      { label: "Category", value: name(masters.cats, form.categoryId) },
      { label: "Garment", value: name(masters.garments, form.garmentId) },
      { label: "Service", value: name(masters.services, form.serviceId) },
    ]
  }, [form, masters])

  const buildPayload = () => {
    const num = (v: string) => (v === "" ? "" : v)
    const p: Record<string, unknown> = {
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
      status: form.isActiveStatus,
      actorId: actor?.id || null, actorName: actor?.name || null,
    }
    return p
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
      const json = await res.json()
      return (json.conflicts || []) as Rule[]
    } catch { return [] }
  }, [businessId, rule, mode, form])

  const doSave = async () => {
    if (!form.name.trim()) { toast.error("Rule Name is required"); return }
    setSaving(true)
    try {
      const isEdit = mode === "edit" && rule
      // Conflict gate (only for ACTIVE rules; archived/draft never match billing).
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally { setSaving(false) }
  }

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[11px] font-bold uppercase tracking-widest text-sky-700 mb-2">{children}</p>
  )
  const NumField = ({ k, label, int }: { k: string; label: string; int?: boolean }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={int ? 1 : "any"} value={form[k]} onChange={(e) => set(k, e.target.value)} className="h-9" />
    </div>
  )

  const title = mode === "edit" ? "Edit Pricing Rule" : mode === "duplicate" ? "Duplicate Pricing Rule" : "New Pricing Rule"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Configure how this rule prices an order. Leave scope fields “All” to apply broadly.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* A — Rule Information */}
          <section>
            <SectionLabel>A · Rule Information</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Rule Name *</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. VIP Dry Clean — Blazer" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.isActiveStatus} onValueChange={(v) => set("isActiveStatus", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{typeLabel(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional summary" className="h-9" />
              </div>
            </div>
          </section>

          {/* B — Pricing Scope */}
          <section>
            <SectionLabel>B · Pricing Scope</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Store</Label><SearchableSelect value={form.storeId} onChange={(v) => set("storeId", v)} options={refOpts(masters.stores, "storeName")} /></div>
              <div className="space-y-1"><Label className="text-xs">Service</Label><SearchableSelect value={form.serviceId} onChange={(v) => set("serviceId", v)} options={refOpts(masters.services)} /></div>
              <div className="space-y-1"><Label className="text-xs">Category</Label><SearchableSelect value={form.categoryId} onChange={(v) => set("categoryId", v)} options={refOpts(masters.cats)} /></div>
              <div className="space-y-1"><Label className="text-xs">Garment</Label><SearchableSelect value={form.garmentId} onChange={(v) => set("garmentId", v)} options={refOpts(masters.garments)} /></div>
              <div className="space-y-1"><Label className="text-xs">Customer Type</Label><SearchableSelect value={form.customerType} onChange={(v) => set("customerType", v)} options={[{ value: NONE, label: "All" }, ...CUSTOMER_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))]} /></div>
            </div>
          </section>

          {/* C — Pricing Type */}
          <section>
            <SectionLabel>C · Pricing Type</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Pricing Type</Label>
                <Select value={form.pricingType} onValueChange={(v) => set("pricingType", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRICING_TYPES.map((t) => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {priceFields.map((f) => <NumField key={f.key} k={f.key} label={f.label} int={f.int} />)}
            </div>
          </section>

          {/* D — Additional Charges */}
          <section>
            <SectionLabel>D · Additional Charges &amp; Tax</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <NumField k="pickupCharge" label="Pickup Charge" />
              <NumField k="deliveryCharge" label="Delivery Charge" />
              <NumField k="expressCharge" label="Express Charge" />
              <NumField k="weekendPrice" label="Weekend Price" />
              <NumField k="minCharge" label="Minimum Charge" />
              <NumField k="maxCharge" label="Maximum Charge" />
              <NumField k="gstPercent" label="GST %" />
              <div className="space-y-1">
                <Label className="text-xs">HSN (future)</Label>
                <Input value={form.hsnCode} onChange={(e) => set("hsnCode", e.target.value)} placeholder="HSN code" className="h-9" />
              </div>
            </div>
          </section>

          {/* E — Priority & Validity */}
          <section>
            <SectionLabel>E · Priority &amp; Validity</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <NumField k="priority" label="Priority (higher wins on tie)" int />
              <div className="space-y-1"><Label className="text-xs">Effective From</Label><Input type="date" value={form.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">Effective To</Label><Input type="date" value={form.effectiveTo} onChange={(e) => set("effectiveTo", e.target.value)} className="h-9" /></div>
              <div className="sm:col-span-3 space-y-1"><Label className="text-xs">Rule Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Internal notes" className="min-h-[60px]" /></div>
            </div>
          </section>

          <Separator />

          {/* Matching Preview */}
          <section className="rounded-lg border bg-sky-50/50 p-3">
            <div className="flex items-center gap-2 mb-2 text-sky-800"><Info className="h-4 w-4" /><span className="text-xs font-semibold">Matching Preview — when this rule applies</span></div>
            <div className="flex flex-wrap gap-2">
              {scopeChips.map((c) => (
                <Badge key={c.label} variant="outline" className="bg-white text-xs font-normal">
                  <span className="text-muted-foreground mr-1">{c.label}:</span>{c.value}
                </Badge>
              ))}
              <Badge variant="outline" className="bg-white text-xs font-normal"><span className="text-muted-foreground mr-1">Type:</span>{typeLabel(form.pricingType)}</Badge>
              <Badge variant="outline" className="bg-white text-xs font-normal"><span className="text-muted-foreground mr-1">Priority:</span>{form.priority || 0}</Badge>
              <Badge variant="outline" className="bg-white text-xs font-normal"><span className="text-muted-foreground mr-1">Valid:</span>{form.effectiveFrom || "always"} → {form.effectiveTo || "open"}</Badge>
            </div>
          </section>

          {/* Conflict warning */}
          {conflicts && conflicts.length > 0 && (
            <section className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-2 mb-2 text-amber-800"><AlertTriangle className="h-4 w-4" /><span className="text-xs font-semibold">This rule overlaps with {conflicts.length} active pricing rule(s)</span></div>
              <ul className="space-y-1 text-xs text-amber-900">
                {conflicts.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3 rounded bg-white/70 px-2 py-1">
                    <span>{c.name || typeLabel(c.pricingType)} — {[c.service?.name, c.garment?.name, c.category?.name, c.store?.storeName, c.customerType && typeLabel(c.customerType)].filter(Boolean).join(" · ") || "All"}</span>
                    <span className="font-medium">Priority {c.priority}</span>
                  </li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2 text-xs text-amber-900">
                <Switch checked={overrideConflicts} onCheckedChange={setOverrideConflicts} />
                Save anyway (I understand the overlap)
              </label>
            </section>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={doSave} disabled={saving} className="gap-1 bg-sky-600 hover:bg-sky-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {conflicts && conflicts.length > 0 && overrideConflicts ? "Save Anyway" : "Save Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
