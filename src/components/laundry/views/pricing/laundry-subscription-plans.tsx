"use client"

// Laundry Subscription MASTER — the single source of truth for a plan's price,
// billing cycle, KG/Piece allowance, renewal policy, and service+garment
// eligibility (with a per-garment PER_KG / PER_PIECE mode). A plan is NOT a
// pricing rule: extra beyond the allowance is billed by the frozen pricing
// engine at the normal service/garment price. Nothing is hardcoded.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Plus, Pencil, Repeat, Weight, Package, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { inr } from "./pricing-shared"
import { LaundryImageUpload } from "./laundry-image-upload"

type Mode = "PER_PIECE" | "PER_KG"
interface CoverageRule { serviceId: string; garmentId: string | null; allowanceMode: string }
interface Plan {
  id: string; name: string; description: string | null; price: number; billingCycle: string
  totalCredits: number; maxOrdersPerCycle: number | null; isActive: boolean; image?: string | null
  allowanceKg?: number | null; allowancePieces?: number | null; autoRenew?: boolean; graceDays?: number
  coverageRules?: CoverageRule[]; _count?: { subscriptions: number }
}
interface Service { id: string; name: string; isActive: boolean }
interface Garment { id: string; name: string }

const CYCLES = ["WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"]
const cycleLabel = (c: string) => c.charAt(0) + c.slice(1).toLowerCase().replace("_", "-")
const ALL = "__ALL__"
const EMPTY = { name: "", description: "", price: "", billingCycle: "MONTHLY", totalCredits: "", maxOrdersPerCycle: "", allowanceKg: "", allowancePieces: "", autoRenew: false, graceDays: "0", isActive: true, image: "" }

// cover[serviceId][garmentId | "__ALL__"] = "PER_PIECE" | "PER_KG"
type Cover = Record<string, Record<string, Mode>>

export function LaundrySubscriptionPlans({ businessId }: { businessId: string }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [garments, setGarments] = useState<Garment[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [cover, setCover] = useState<Cover>({})
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }))

  const load = useCallback(() => {
    if (!businessId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/laundry/plans?businessId=${businessId}`).then((r) => r.json()),
      fetch(`/api/laundry/services?businessId=${businessId}`).then((r) => r.json()),
      fetch(`/api/laundry/garments?businessId=${businessId}`).then((r) => r.json()),
    ]).then(([p, s, g]) => {
      if (p.success) setPlans(p.data || [])
      if (s.success) setServices((s.data || []).filter((x: Service) => x.isActive))
      if (g.success) setGarments((g.data || []).map((x: Garment) => ({ id: x.id, name: x.name })))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [businessId])
  useEffect(() => { load() }, [load])

  const coverFromRules = (rules: CoverageRule[] | undefined): Cover => {
    const c: Cover = {}
    for (const r of rules || []) {
      const mode: Mode = r.allowanceMode === "PER_KG" ? "PER_KG" : "PER_PIECE"
      c[r.serviceId] = c[r.serviceId] || {}
      c[r.serviceId][r.garmentId || ALL] = mode
    }
    return c
  }
  const openNew = () => { setEditing(null); setForm({ ...EMPTY }); setCover({}); setOpen(true) }
  const openEdit = (p: Plan) => {
    setEditing(p)
    setForm({ name: p.name, description: p.description || "", price: String(p.price), billingCycle: p.billingCycle, totalCredits: String(p.totalCredits), maxOrdersPerCycle: p.maxOrdersPerCycle == null ? "" : String(p.maxOrdersPerCycle), allowanceKg: p.allowanceKg == null ? "" : String(p.allowanceKg), allowancePieces: p.allowancePieces == null ? "" : String(p.allowancePieces), autoRenew: !!p.autoRenew, graceDays: String(p.graceDays ?? 0), isActive: p.isActive, image: p.image || "" })
    setCover(coverFromRules(p.coverageRules))
    setOpen(true)
  }

  // Cycle a garment's coverage: off → Per Piece → Per KG → off.
  const cycleMode = (serviceId: string, key: string) => setCover((c) => {
    const svc = { ...(c[serviceId] || {}) }
    const cur = svc[key]
    if (!cur) svc[key] = "PER_PIECE"
    else if (cur === "PER_PIECE") svc[key] = "PER_KG"
    else delete svc[key]
    const next = { ...c, [serviceId]: svc }
    if (Object.keys(svc).length === 0) delete next[serviceId]
    return next
  })
  const modeBadge = (m?: Mode) => m === "PER_KG" ? "Per KG" : m === "PER_PIECE" ? "Per Piece" : "—"

  const rulesFromCover = (): CoverageRule[] => {
    const out: CoverageRule[] = []
    for (const [serviceId, gm] of Object.entries(cover)) for (const [key, mode] of Object.entries(gm)) out.push({ serviceId, garmentId: key === ALL ? null : key, allowanceMode: mode })
    return out
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error("Plan name is required"); return }
    const kg = Number(form.allowanceKg || 0), pcs = Number(form.allowancePieces || 0), credits = Number(form.totalCredits || 0)
    if (kg <= 0 && pcs <= 0 && credits <= 0) { toast.error("Set a KG allowance, a Piece allowance, or a cloth allowance"); return }
    setSaving(true)
    try {
      const payload = {
        businessId, name: form.name, description: form.description, price: form.price, billingCycle: form.billingCycle,
        totalCredits: form.totalCredits || 0, maxOrdersPerCycle: form.maxOrdersPerCycle,
        allowanceKg: form.allowanceKg === "" ? null : form.allowanceKg, allowancePieces: form.allowancePieces === "" ? null : form.allowancePieces,
        autoRenew: form.autoRenew, graceDays: form.graceDays, isActive: form.isActive, image: form.image || null,
        coverageRules: rulesFromCover(),
      }
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
        <p className="text-sm text-muted-foreground">Subscription plans define the price, KG/Piece allowance, renewal policy and which services &amp; garments are covered. Extra beyond the allowance is billed at your normal prices.</p>
        <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white h-9 shrink-0" onClick={openNew}><Plus className="h-3.5 w-3.5" /> New Plan</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : plans.length === 0 ? (
        <Card><CardContent className="text-center py-16">
          <Repeat className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-medium">No subscription plans yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create a plan like &ldquo;Business Monthly — 20KG + 15 pieces&rdquo;.</p>
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
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {p.allowanceKg ? <span className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-700 px-1.5 py-0.5"><Weight className="h-3 w-3" /> {p.allowanceKg} KG</span> : null}
                {p.allowancePieces ? <span className="inline-flex items-center gap-1 rounded bg-violet-50 text-violet-700 px-1.5 py-0.5"><Package className="h-3 w-3" /> {p.allowancePieces} pieces</span> : null}
                {p.totalCredits ? <span className="inline-flex items-center gap-1 rounded bg-slate-50 text-slate-600 px-1.5 py-0.5">{p.totalCredits} clothes</span> : null}
                {p.autoRenew ? <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5"><RefreshCw className="h-3 w-3" /> Auto-renew</span> : null}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">{p._count?.subscriptions ?? 0} subscriber{(p._count?.subscriptions ?? 0) === 1 ? "" : "s"} · {p.coverageRules?.length ?? 0} eligibility rule{(p.coverageRules?.length ?? 0) === 1 ? "" : "s"}</span>
                <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Plan" : "New Subscription Plan"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Plan Image</Label><LaundryImageUpload value={form.image || null} businessId={businessId} folder="laundry-plans" onChange={(url) => set("image", url || "")} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Subscription Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Business Monthly" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="20 KG + 15 pieces every month across Wash and Dry Clean." className="min-h-[52px]" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Monthly Price (₹)</Label><Input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="1000" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Billing Cycle</Label>
                <select value={form.billingCycle} onChange={(e) => set("billingCycle", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background">
                  {CYCLES.map((c) => <option key={c} value={c}>{cycleLabel(c)}</option>)}
                </select>
              </div>
            </div>

            {/* Allowance — KG and/or Pieces (Part 2) */}
            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs font-semibold">Allowance per cycle</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs flex items-center gap-1"><Weight className="h-3 w-3" /> KG allowance</Label><Input type="number" value={form.allowanceKg} onChange={(e) => set("allowanceKg", e.target.value)} placeholder="20" /></div>
                <div className="space-y-1.5"><Label className="text-xs flex items-center gap-1"><Package className="h-3 w-3" /> Piece allowance</Label><Input type="number" value={form.allowancePieces} onChange={(e) => set("allowancePieces", e.target.value)} placeholder="15" /></div>
              </div>
              <p className="text-[10px] text-slate-400">A plan may include KG, Pieces, or both. Extra beyond the allowance is billed at your normal service/garment prices.</p>
            </div>

            {/* Renewal policy (Part 1/11) */}
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="flex items-center gap-2 h-9"><Switch checked={form.autoRenew} onCheckedChange={(v) => set("autoRenew", v)} className="data-[state=checked]:bg-blue-600" /><span className="text-sm">Auto-renew</span></div>
              <div className="space-y-1.5"><Label className="text-xs">Grace Days</Label><Input type="number" value={form.graceDays} onChange={(e) => set("graceDays", e.target.value)} placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Max Orders / Cycle</Label><Input type="number" value={form.maxOrdersPerCycle} onChange={(e) => set("maxOrdersPerCycle", e.target.value)} placeholder="Blank = unlimited" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Cloth Allowance (legacy)</Label><Input type="number" value={form.totalCredits} onChange={(e) => set("totalCredits", e.target.value)} placeholder="0" /></div>
            </div>

            {/* Service + Garment eligibility with per-garment mode (Parts 3/4/5) */}
            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs font-semibold">Service &amp; Garment Eligibility</Label>
              <p className="text-[10px] text-slate-400 -mt-1">Tap a garment to cycle Off → Per Piece → Per KG. Use “All garments” to cover a whole service.</p>
              {services.length === 0 ? <p className="text-xs text-slate-400 py-2">No services configured yet.</p> : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {services.map((s) => {
                    const svcCover = cover[s.id] || {}
                    const chip = (key: string, label: string) => {
                      const m = svcCover[key]
                      return (
                        <button key={key} type="button" onClick={() => cycleMode(s.id, key)}
                          className={`rounded-md border px-2 h-7 text-xs font-medium transition-colors ${m === "PER_KG" ? "border-blue-500 bg-blue-50 text-blue-700" : m === "PER_PIECE" ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                          {label}{m ? ` · ${modeBadge(m)}` : ""}
                        </button>
                      )
                    }
                    return (
                      <div key={s.id} className="rounded-md bg-slate-50 border border-slate-100 p-2 space-y-1.5">
                        <p className="text-xs font-medium text-slate-700">{s.name}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {chip(ALL, "All garments")}
                          {garments.map((g) => chip(g.id, g.name))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} className="data-[state=checked]:bg-emerald-600" /><span className="text-sm font-medium">{form.isActive ? "Active" : "Inactive"}</span></div>
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
