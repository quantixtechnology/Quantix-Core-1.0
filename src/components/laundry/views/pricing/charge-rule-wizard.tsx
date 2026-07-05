"use client"

// Charge Rule wizard — Charges & Rules configures SURCHARGES only. It never
// touches base garment/service prices (Services) or subscription pricing
// (Subscription Plans). Steps: Rule Type → Scope → Charge Configuration →
// Conditions → Priority → Review. Saves via /api/laundry/pricing with price = 0
// (the API rejects any base price), one charge field per rule type.

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react"
import { toast } from "sonner"
import { SearchableSelect } from "./searchable-select"
import { NONE, inr, type Ref, type Rule } from "./pricing-shared"

interface Masters { services: Ref[]; garments: Ref[]; cats: Ref[]; stores: Ref[] }
type Mode = "create" | "edit" | "duplicate"

// Each rule type maps to exactly one model field. FREE_DELIVERY is a threshold.
const CHARGE_TYPES = [
  { value: "MIN_ORDER", label: "Minimum Order Charge", field: "minCharge", threshold: false, desc: "Top up the order to a minimum amount." },
  { value: "PICKUP", label: "Pickup Charge", field: "pickupCharge", threshold: false, desc: "Charged when the order is picked up." },
  { value: "DELIVERY", label: "Delivery Charge", field: "deliveryCharge", threshold: false, desc: "Charged when the order is delivered." },
  { value: "EXPRESS", label: "Express Charge", field: "expressCharge", threshold: false, desc: "Charged for express turnaround." },
  { value: "WEEKEND", label: "Weekend Surcharge", field: "weekendPrice", threshold: false, desc: "Applied on weekend orders." },
  { value: "FREE_DELIVERY", label: "Free Delivery Threshold", field: "freeDeliveryThreshold", threshold: true, desc: "Waive delivery when the order is at or above this amount." },
  { value: "URGENT", label: "Urgent Delivery Charge", field: "urgentDeliveryCharge", threshold: false, desc: "Charged for urgent / same-day delivery." },
] as const

const STEPS = ["Rule Type", "Scope", "Charge Configuration", "Conditions", "Priority", "Review"]

function typeFromRule(r: Rule): typeof CHARGE_TYPES[number]["value"] {
  const rr = r as unknown as Record<string, number | null>
  for (const t of CHARGE_TYPES) if (rr[t.field] != null && Number(rr[t.field]) > 0) return t.value
  return "MIN_ORDER"
}

export function ChargeRuleWizard({ open, mode, rule, businessId, masters, actor, onClose, onSaved }: {
  open: boolean; mode: Mode; rule: Rule | null; businessId: string; masters: Masters
  actor?: { id?: string; name?: string }; onClose: () => void; onSaved: () => void
}) {
  const isEdit = mode === "edit"
  const init = () => {
    if (rule) {
      const t = typeFromRule(rule)
      const cfg = CHARGE_TYPES.find((c) => c.value === t)!
      const amt = (rule as unknown as Record<string, number | null>)[cfg.field]
      return {
        type: t, name: rule.name || "", storeId: rule.storeId || NONE, serviceId: rule.serviceId || NONE,
        amount: amt != null ? String(amt) : "", effectiveFrom: rule.effectiveFrom?.slice(0, 10) || "", effectiveTo: rule.effectiveTo?.slice(0, 10) || "",
        priority: String(rule.priority ?? 0), active: rule.isActive,
      }
    }
    return { type: "MIN_ORDER" as typeof CHARGE_TYPES[number]["value"], name: "", storeId: NONE, serviceId: NONE, amount: "", effectiveFrom: "", effectiveTo: "", priority: "0", active: true }
  }
  const [form, setForm] = useState(init)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))
  const cfg = useMemo(() => CHARGE_TYPES.find((c) => c.value === form.type)!, [form.type])
  const storeLabel = form.storeId === NONE ? "All Stores" : (masters.stores.find((s) => s.id === form.storeId)?.storeName || masters.stores.find((s) => s.id === form.storeId)?.name || form.storeId)
  const serviceLabel = form.serviceId === NONE ? "All Services" : (masters.services.find((s) => s.id === form.serviceId)?.name || form.serviceId)

  const canNext = step === 0 ? !!form.type : step === 2 ? Number(form.amount) > 0 : true

  const save = async () => {
    if (!(Number(form.amount) > 0)) { toast.error("Enter a charge amount"); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        businessId, name: form.name.trim() || `${cfg.label}${form.storeId !== NONE ? ` · ${storeLabel}` : ""}`,
        pricingType: "FIXED", price: 0,
        storeId: form.storeId === NONE ? null : form.storeId,
        serviceId: form.serviceId === NONE ? null : form.serviceId,
        // reset all charge fields, then set the one for this rule type
        minCharge: null, pickupCharge: null, deliveryCharge: null, expressCharge: null, weekendPrice: null, freeDeliveryThreshold: null, urgentDeliveryCharge: null,
        [cfg.field]: Number(form.amount),
        effectiveFrom: form.effectiveFrom || null, effectiveTo: form.effectiveTo || null,
        priority: Number(form.priority) || 0, isActive: form.active,
        actorId: actor?.id, actorName: actor?.name,
      }
      const url = isEdit ? `/api/laundry/pricing/${rule!.id}` : `/api/laundry/pricing`
      const res = await fetch(url, { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || "Save failed")
      toast.success(isEdit ? "Charge rule updated" : "Charge rule created"); onSaved(); onClose()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  const amountLabel = cfg.threshold ? "Order Amount Threshold (₹)" : "Charge Amount (₹)"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Charge Rule" : "Create Charge Rule"}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1 text-[10px] text-slate-400 flex-wrap">
          {STEPS.map((s, i) => <span key={s} className={i === step ? "font-bold text-blue-600" : ""}>{i > 0 && "› "}{s}</span>)}
        </div>

        <div className="min-h-[190px] py-1">
          {step === 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Rule Type</Label>
              <div className="grid grid-cols-1 gap-1.5 max-h-[240px] overflow-y-auto">
                {CHARGE_TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => set("type", t.value)} className={`text-left rounded-lg border px-3 py-2 ${form.type === t.value ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                    <p className="text-sm font-medium text-slate-800">{t.label}</p><p className="text-[11px] text-slate-500">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Store Scope</Label><SearchableSelect value={form.storeId} onChange={(v) => set("storeId", v)} options={[{ value: NONE, label: "All Stores" }, ...masters.stores.map((s) => ({ value: s.id, label: s.storeName || s.name || s.id }))]} /></div>
              <div className="space-y-1"><Label className="text-xs">Service (optional)</Label><SearchableSelect value={form.serviceId} onChange={(v) => set("serviceId", v)} options={[{ value: NONE, label: "All Services" }, ...masters.services.map((s) => ({ value: s.id, label: s.name || s.id }))]} /><p className="text-[10px] text-slate-400">Leave as “All Services” unless this charge is service-specific.</p></div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">{cfg.label} — {cfg.desc}</p>
              <div className="space-y-1"><Label className="text-xs">{amountLabel} *</Label><Input type="number" min={0} value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" /></div>
              <div className="space-y-1"><Label className="text-xs">Rule Name (optional)</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={`${cfg.label}`} /></div>
            </div>
          )}
          {step === 3 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Effective From</Label><Input type="date" value={form.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Effective To</Label><Input type="date" value={form.effectiveTo} onChange={(e) => set("effectiveTo", e.target.value)} /></div>
              <p className="col-span-2 text-[10px] text-slate-400">Leave blank for an always-on rule.</p>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Priority (higher wins when multiple charges overlap)</Label><Input type="number" value={form.priority} onChange={(e) => set("priority", e.target.value)} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => set("active", v)} className="data-[state=checked]:bg-emerald-600" /><span className="text-sm">{form.active ? "Active" : "Inactive"}</span></div>
            </div>
          )}
          {step === 5 && (
            <div className="rounded-lg border border-slate-100 divide-y divide-slate-100 text-sm">
              {[
                ["Rule Type", cfg.label],
                ["Scope", `${storeLabel} · ${serviceLabel}`],
                [cfg.threshold ? "Order Threshold" : "Charge Amount", inr(Number(form.amount) || 0)],
                ["Conditions", form.effectiveFrom || form.effectiveTo ? `${form.effectiveFrom || "—"} → ${form.effectiveTo || "—"}` : "Always on"],
                ["Priority", form.priority],
                ["Effective Period", form.effectiveFrom || form.effectiveTo ? `${form.effectiveFrom || "start"} to ${form.effectiveTo || "no end"}` : "No limit"],
                ["Status", form.active ? "Active" : "Inactive"],
              ].map(([k, v]) => <div key={k as string} className="flex justify-between px-3 py-1.5"><span className="text-slate-400">{k}</span><span className="font-medium text-slate-700 text-right">{v}</span></div>)}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-1">
          <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="gap-1"><ArrowLeft className="h-4 w-4" /> Back</Button>
          {step < STEPS.length - 1
            ? <Button size="sm" disabled={!canNext} onClick={() => setStep((s) => s + 1)} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">Next <ArrowRight className="h-4 w-4" /></Button>
            : <Button size="sm" disabled={saving} onClick={save} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {isEdit ? "Save Charge Rule" : "Create Charge Rule"}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
