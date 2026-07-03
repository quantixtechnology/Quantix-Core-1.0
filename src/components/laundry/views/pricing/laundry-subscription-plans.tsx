"use client"

// Laundry Subscription Plans admin — manage Business→Customer plans (the source
// of truth for subscription price + cloth allowance + order limit). A plan is
// NOT a pricing rule. Cloth allowance and max orders are fully configurable per
// plan; nothing (70 / 2 / ₹2000) is hardcoded.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Plus, Pencil, Repeat, Shirt, Package } from "lucide-react"
import { toast } from "sonner"
import { inr } from "./pricing-shared"

interface Plan { id: string; name: string; description: string | null; price: number; billingCycle: string; totalCredits: number; maxOrdersPerCycle: number | null; isActive: boolean; _count?: { subscriptions: number } }
const CYCLES = ["WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"]
const EMPTY = { name: "", description: "", price: "", billingCycle: "MONTHLY", totalCredits: "", maxOrdersPerCycle: "", isActive: true }

export function LaundrySubscriptionPlans({ businessId }: { businessId: string }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }))

  const load = useCallback(() => {
    if (!businessId) return
    setLoading(true)
    fetch(`/api/laundry/plans?businessId=${businessId}`).then((r) => r.json())
      .then((j) => { if (j.success) setPlans(j.data || []) }).catch(() => {}).finally(() => setLoading(false))
  }, [businessId])
  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); setForm({ ...EMPTY }); setOpen(true) }
  const openEdit = (p: Plan) => { setEditing(p); setForm({ name: p.name, description: p.description || "", price: String(p.price), billingCycle: p.billingCycle, totalCredits: String(p.totalCredits), maxOrdersPerCycle: p.maxOrdersPerCycle == null ? "" : String(p.maxOrdersPerCycle), isActive: p.isActive }); setOpen(true) }

  const save = async () => {
    if (!form.name.trim()) { toast.error("Plan name is required"); return }
    if (!form.totalCredits || Number(form.totalCredits) <= 0) { toast.error("Cloth allowance must be greater than 0"); return }
    setSaving(true)
    try {
      const payload = { businessId, name: form.name, description: form.description, price: form.price, billingCycle: form.billingCycle, totalCredits: form.totalCredits, maxOrdersPerCycle: form.maxOrdersPerCycle, isActive: form.isActive }
      const res = await fetch(editing ? `/api/laundry/plans/${editing.id}` : `/api/laundry/plans`, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
      toast.success(editing ? "Plan updated" : "Plan created")
      setOpen(false); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Subscription plans define the monthly price, cloth allowance and order limit. Extra clothes are always billed at your normal service/garment prices.</p>
        <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white h-9 shrink-0" onClick={openNew}><Plus className="h-3.5 w-3.5" /> New Plan</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : plans.length === 0 ? (
        <Card><CardContent className="text-center py-16">
          <Repeat className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-medium">No subscription plans yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create a plan like “Monthly 70 Clothes Plan”.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map((p) => (
            <Card key={p.id} className={p.isActive ? "" : "opacity-60"}><CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2"><Repeat className="h-4 w-4 text-blue-600" /><p className="font-semibold text-slate-800">{p.name}</p></div>
                <Badge variant="outline" className={p.isActive ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-300 text-slate-500"}>{p.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{inr(p.price)} <span className="text-xs font-normal text-slate-400">/ {p.billingCycle.toLowerCase()}</span></p>
              {p.description && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{p.description}</p>}
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-slate-600"><Shirt className="h-3.5 w-3.5 text-slate-400" /> {p.totalCredits} clothes / cycle</div>
                <div className="flex items-center gap-2 text-slate-600"><Package className="h-3.5 w-3.5 text-slate-400" /> {p.maxOrdersPerCycle == null ? "Unlimited orders" : `Max ${p.maxOrdersPerCycle} orders / cycle`}</div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">{p._count?.subscriptions ?? 0} subscriber(s)</span>
                <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>{editing ? "Edit Plan" : "New Subscription Plan"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Plan Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Monthly 70 Clothes Plan" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="70 clothes included every month with up to 2 laundry orders." className="min-h-[56px]" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Plan Price (₹)</Label><Input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="2000" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Billing Cycle</Label>
                <select value={form.billingCycle} onChange={(e) => set("billingCycle", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background">
                  {CYCLES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase().replace("_", "-")}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Cloth Allowance *</Label><Input type="number" value={form.totalCredits} onChange={(e) => set("totalCredits", e.target.value)} placeholder="70" /><p className="text-[10px] text-slate-400">Garments included per cycle.</p></div>
              <div className="space-y-1.5"><Label className="text-xs">Max Orders / Cycle</Label><Input type="number" value={form.maxOrdersPerCycle} onChange={(e) => set("maxOrdersPerCycle", e.target.value)} placeholder="2" /><p className="text-[10px] text-slate-400">Blank = unlimited.</p></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} className="data-[state=checked]:bg-emerald-600" /><span className="text-sm font-medium">{form.isActive ? "Active" : "Inactive"}</span></div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-xs text-slate-500">Extra clothes beyond the allowance are billed automatically at your normal service/garment prices — no extra-cloth price is set here.</div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={save} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Save" : "Create Plan"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
