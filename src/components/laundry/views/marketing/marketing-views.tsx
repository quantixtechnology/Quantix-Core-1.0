"use client"

// Marketing module — Phase 1 admin screens (Dashboard, Coupons/Vouchers,
// Discounts, Reports) + placeholders for later phases. Uses /api/core/marketing
// with the admin token (getAuthHeaders).
//
// That was originally a workaround: LaundryAuthBridge only covered
// "/api/laundry", so these routes went out unauthenticated. The bridge now
// covers every same-origin /api/ path, and it skips requests that already carry
// an Authorization header — so these explicit headers still win and nothing
// here changes. Kept as-is rather than churned.
import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Megaphone, Ticket, BadgePercent, BarChart3, Loader2, Plus, Trash2, Pencil, Lock } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { useMarketingEnabled, parseApplyTo, APPLY_TO_OPTIONS, STATUS_OPTIONS, type Promotion } from "./marketing-shared"

const inr = (n: number | null | undefined) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN")}`)
const STATUS_TONE: Record<string, string> = {
  ACTIVE: "border-emerald-300 text-emerald-700 bg-emerald-50",
  DRAFT: "border-slate-300 text-slate-600 bg-slate-50",
  SCHEDULED: "border-blue-300 text-blue-700 bg-blue-50",
  PAUSED: "border-amber-300 text-amber-700 bg-amber-50",
  EXPIRED: "border-slate-300 text-slate-400 bg-slate-50",
  CANCELLED: "border-rose-300 text-rose-600 bg-rose-50",
}

// ── Gate — shows a friendly notice when the tenant's Marketing feature is off ──
export function MarketingGate({ children }: { children: React.ReactNode }) {
  const enabled = useMarketingEnabled()
  if (enabled === null) return <div className="px-6 py-16 text-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
  if (!enabled) return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center"><Lock className="h-6 w-6 text-slate-400" /></div>
      <h2 className="mt-3 text-lg font-bold text-slate-800">Marketing is not enabled</h2>
      <p className="mt-1 text-sm text-slate-500">Ask your Quantix administrator to enable the Marketing module for this business.</p>
    </div>
  )
  return <>{children}</>
}

function PageHead({ icon: Icon, title, subtitle, right }: { icon: typeof Ticket; title: string; subtitle: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Icon className="h-5 w-5 text-blue-600" /> {title}</h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {right}
    </div>
  )
}

// ── Dashboard (placeholder + live counts) ─────────────────────────────────────
export function MarketingDashboard({ businessId }: { businessId: string }) {
  const [counts, setCounts] = useState<{ total: number; active: number; expired: number; redeemed: number } | null>(null)
  useEffect(() => {
    if (!businessId) return
    fetch(`/api/core/marketing/reports?businessId=${businessId}`, { headers: getAuthHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setCounts(j.data) }).catch(() => {})
  }, [businessId])
  const cards = [
    { label: "Total Coupons", value: counts?.total },
    { label: "Active", value: counts?.active },
    { label: "Redeemed", value: counts?.redeemed },
    { label: "Expired", value: counts?.expired },
  ]
  return (
    <div className="px-4 lg:px-6 py-6">
      <PageHead icon={Megaphone} title="Marketing" subtitle="Discounts, coupons & vouchers for this business. More modules arrive in later phases." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="rounded-xl border-slate-200"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-slate-400">{c.label}</p><p className="text-2xl font-bold text-slate-800 mt-0.5">{c.value ?? "—"}</p></CardContent></Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-400">Loyalty, Membership, Gift Cards, Referrals, Promotional Credits, Cart Recovery and Campaigns are planned for later phases.</p>
    </div>
  )
}

// ── Reports (Phase 1 counts) ──────────────────────────────────────────────────
export function MarketingReports({ businessId }: { businessId: string }) {
  const [counts, setCounts] = useState<{ total: number; active: number; expired: number; redeemed: number } | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!businessId) return
    fetch(`/api/core/marketing/reports?businessId=${businessId}`, { headers: getAuthHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setCounts(j.data) }).finally(() => setLoading(false))
  }, [businessId])
  return (
    <div className="px-4 lg:px-6 py-6">
      <PageHead icon={BarChart3} title="Marketing Reports" subtitle="Coupon performance (Phase 1)." />
      {loading ? <div className="py-10 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[["Total Coupons", counts?.total], ["Active Coupons", counts?.active], ["Expired Coupons", counts?.expired], ["Redeemed Coupons", counts?.redeemed]].map(([l, v]) => (
            <Card key={l as string} className="rounded-xl border-slate-200"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-slate-400">{l}</p><p className="text-2xl font-bold text-slate-800 mt-0.5">{(v as number) ?? 0}</p></CardContent></Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Coupons / Vouchers (list + create/edit) ───────────────────────────────────
const EMPTY = {
  title: "", description: "", code: "", discountType: "PERCENT", discountValue: "10",
  maxDiscount: "", minOrderValue: "", status: "ACTIVE",
  startAt: "", endAt: "", maxUses: "", maxUsesPerCustomer: "", applyTo: ["ORDER"] as string[], enabled: true,
}
type Form = typeof EMPTY

export function MarketingCoupons({ businessId }: { businessId: string }) {
  const [rows, setRows] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const load = useCallback(() => {
    if (!businessId) return
    setLoading(true)
    fetch(`/api/core/marketing/promotions?businessId=${businessId}`, { headers: getAuthHeaders() }).then((r) => r.json())
      .then((j) => setRows(j.success ? j.data : [])).catch(() => setRows([])).finally(() => setLoading(false))
  }, [businessId])
  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true) }
  const openEdit = (p: Promotion) => {
    setEditing(p)
    setForm({
      title: p.title, description: p.description || "", code: p.code || "",
      discountType: p.discountType, discountValue: String(p.discountValue),
      maxDiscount: p.maxDiscount != null ? String(p.maxDiscount) : "", minOrderValue: p.minOrderValue != null ? String(p.minOrderValue) : "",
      status: p.status,
      startAt: p.startAt ? p.startAt.slice(0, 10) : "", endAt: p.endAt ? p.endAt.slice(0, 10) : "",
      maxUses: p.maxUses != null ? String(p.maxUses) : "", maxUsesPerCustomer: p.maxUsesPerCustomer != null ? String(p.maxUsesPerCustomer) : "",
      applyTo: parseApplyTo(p.applyTo), enabled: p.enabled,
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return }
    setSaving(true)
    const payload = {
      businessId,
      title: form.title, description: form.description || null, code: form.code || null,
      discountType: form.discountType, discountValue: Number(form.discountValue) || 0,
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
      minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : null,
      status: form.status, enabled: form.enabled,
      startAt: form.startAt || null, endAt: form.endAt || null,
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      maxUsesPerCustomer: form.maxUsesPerCustomer ? Number(form.maxUsesPerCustomer) : null,
      applyTo: form.applyTo.length ? form.applyTo : ["ORDER"],
    }
    try {
      const url = editing ? `/api/core/marketing/promotions/${editing.id}` : `/api/core/marketing/promotions`
      const res = await fetch(url, { method: editing ? "PATCH" : "POST", headers: getAuthHeaders(), body: JSON.stringify(payload) })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not save")
      toast.success(editing ? "Coupon updated" : "Coupon created")
      setOpen(false); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  const remove = async (p: Promotion) => {
    if (!confirm(`Cancel coupon "${p.title}"? It stops applying but stays in reports.`)) return
    try {
      const res = await fetch(`/api/core/marketing/promotions/${p.id}?businessId=${businessId}`, { method: "DELETE", headers: getAuthHeaders() })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Failed")
      toast.success("Coupon cancelled"); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
  }

  const discountLabel = (p: Promotion) => p.discountType === "FIXED" ? inr(p.discountValue) + " off" : `${p.discountValue}% off${p.maxDiscount ? ` (max ${inr(p.maxDiscount)})` : ""}`

  return (
    <div className="px-4 lg:px-6 py-6">
      <PageHead icon={Ticket} title="Coupons / Vouchers" subtitle="Create fixed or percentage vouchers. Laundry coupons apply after Store Audit; commerce applies immediately."
        right={<Button onClick={openCreate} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"><Plus className="h-4 w-4" /> New Coupon</Button>} />
      <Card className="rounded-xl border-slate-200">
        <CardContent className="p-0">
          {loading ? <div className="py-12 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No coupons yet. Create your first voucher.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {rows.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.code && <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">{p.code}</span>}
                      <span className="text-sm font-semibold text-slate-800 truncate">{p.title}</span>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[p.status] || ""}`}>{p.status}</Badge>
                      {!p.enabled && <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-400">Off</Badge>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{discountLabel(p)} · {p.usedCount} used{p.minOrderValue ? ` · min ${inr(p.minOrderValue)}` : ""}{p.endAt ? ` · ends ${new Date(p.endAt).toLocaleDateString("en-IN")}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Coupon" : "New Coupon"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <L label="Title *"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Welcome offer" /></L>
              <L label="Coupon Code"><Input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="WELCOME100" /></L>
            </div>
            <L label="Description"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Shown to customers" /></L>
            <div className="grid grid-cols-3 gap-3">
              <L label="Type">
                <select value={form.discountType} onChange={(e) => set("discountType", e.target.value)} className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm bg-white">
                  <option value="PERCENT">Percentage</option><option value="FIXED">Fixed ₹</option>
                </select>
              </L>
              <L label={form.discountType === "PERCENT" ? "Percent %" : "Amount ₹"}><Input type="number" value={form.discountValue} onChange={(e) => set("discountValue", e.target.value)} /></L>
              <L label="Max Discount ₹"><Input type="number" value={form.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} placeholder="—" disabled={form.discountType === "FIXED"} /></L>
            </div>
            {/* No Workspace field. This IS the Laundry workspace — the tenant's
                own URL says so — and the server infers it on save, so the
                choice was a platform concept leaking into a business owner's
                screen where the only valid answer was already known. */}
            <div className="grid grid-cols-2 gap-3">
              <L label="Min Order ₹"><Input type="number" value={form.minOrderValue} onChange={(e) => set("minOrderValue", e.target.value)} placeholder="0" /></L>
              <L label="Status">
                <select value={form.status} onChange={(e) => set("status", e.target.value)} className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm bg-white">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </L>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <L label="Start Date"><Input type="date" value={form.startAt} onChange={(e) => set("startAt", e.target.value)} /></L>
              <L label="End Date"><Input type="date" value={form.endAt} onChange={(e) => set("endAt", e.target.value)} /></L>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <L label="Max Uses (total)"><Input type="number" value={form.maxUses} onChange={(e) => set("maxUses", e.target.value)} placeholder="Unlimited" /></L>
              <L label="Max Uses / Customer"><Input type="number" value={form.maxUsesPerCustomer} onChange={(e) => set("maxUsesPerCustomer", e.target.value)} placeholder="Unlimited" /></L>
            </div>
            <L label="Applicable To">
              <div className="flex flex-wrap gap-2">
                {APPLY_TO_OPTIONS.map((o) => {
                  const on = form.applyTo.includes(o.value)
                  return <button key={o.value} type="button" onClick={() => set("applyTo", on ? form.applyTo.filter((x) => x !== o.value) : [...form.applyTo, o.value])} className={`rounded-lg border px-2.5 py-1 text-xs ${on ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>{o.label}</button>
                })}
              </div>
            </L>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Enabled (feature flag)</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Discounts (Phase 1 — shares the same engine; points to Coupons) ───────────
export function MarketingDiscounts() {
  return (
    <div className="px-4 lg:px-6 py-6">
      <PageHead icon={BadgePercent} title="Discounts" subtitle="Fixed & percentage discounts run on the same voucher engine." />
      <Card className="rounded-xl border-slate-200"><CardContent className="p-6 text-sm text-slate-500">
        In Phase 1, discounts are created as <b>Coupons / Vouchers</b> (fixed or percentage). Advanced discount types (Free Delivery/Pickup/Service, Buy&nbsp;X&nbsp;Get&nbsp;Y, Cashback, Promotional Credit) arrive in later phases on the same engine.
      </CardContent></Card>
    </div>
  )
}

// ── Generic placeholder for later-phase modules ──────────────────────────────
export function MarketingPlaceholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="px-4 lg:px-6 py-6">
      <PageHead icon={Megaphone} title={title} subtitle={`Planned for ${phase}.`} />
      <Card className="rounded-xl border-slate-200"><CardContent className="p-10 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center"><Lock className="h-5 w-5 text-slate-400" /></div>
        <p className="mt-3 text-sm text-slate-500">{title} is not part of Phase 1. It will be delivered in {phase} on the same shared Marketing Engine.</p>
      </CardContent></Card>
    </div>
  )
}

const L = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1"><Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</Label>{children}</div>
)
