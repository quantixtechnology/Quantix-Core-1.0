"use client"

// Masters → Pricing Engine. Every billable rule, connected to Service / Garment
// / Category / Store + Customer Type + Pricing Type. The order billing engine
// will resolve a customer's bill from these rules (highest priority match wins).

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface Ref { id: string; name?: string; storeName?: string }
interface Rule {
  id: string; pricingType: string; price: number; gstPercent: number; priority: number; isActive: boolean
  customerType: string | null
  service?: Ref | null; garment?: Ref | null; category?: Ref | null; store?: Ref | null
  minCharge: number | null; maxWeightKg: number | null; extraWeightCharge: number | null
  weekendPrice: number | null; expressCharge: number | null; pickupCharge: number | null; deliveryCharge: number | null
}
const NONE = "__none__"
const PRICING_TYPES = ["PER_PIECE", "PER_KG", "FIXED", "SUBSCRIPTION", "CORPORATE"]
const CUSTOMER_TYPES = ["WALK_IN", "PICKUP", "CORPORATE", "HOTEL", "HOSPITAL", "SUBSCRIPTION", "VIP"]
const typeLabel = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())

type Form = {
  serviceId: string; garmentId: string; categoryId: string; storeId: string; customerType: string
  pricingType: string; price: string; gstPercent: string; minCharge: string; maxWeightKg: string
  extraWeightCharge: string; weekendPrice: string; expressCharge: string; pickupCharge: string
  deliveryCharge: string; priority: string; isActive: boolean
}
const EMPTY: Form = {
  serviceId: NONE, garmentId: NONE, categoryId: NONE, storeId: NONE, customerType: NONE,
  pricingType: "PER_PIECE", price: "0", gstPercent: "0", minCharge: "", maxWeightKg: "",
  extraWeightCharge: "", weekendPrice: "", expressCharge: "", pickupCharge: "", deliveryCharge: "",
  priority: "0", isActive: true,
}

export function LaundryPricingEngine() {
  const { currentBusinessId } = useAuthStore()
  const [rules, setRules] = useState<Rule[]>([])
  const [services, setServices] = useState<Ref[]>([])
  const [garments, setGarments] = useState<Ref[]>([])
  const [cats, setCats] = useState<Ref[]>([])
  const [stores, setStores] = useState<Ref[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Rule | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Form, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    const q = `businessId=${encodeURIComponent(currentBusinessId)}`
    try {
      const [p, s, g, c, st] = await Promise.all([
        fetch(`/api/laundry/pricing?${q}`).then(r => r.json()),
        fetch(`/api/laundry/services?${q}`).then(r => r.json()),
        fetch(`/api/laundry/garments?${q}`).then(r => r.json()),
        fetch(`/api/laundry/categories?${q}`).then(r => r.json()),
        fetch(`/api/laundry/businesses/${currentBusinessId}/stores`).then(r => r.json()),
      ])
      setRules(p.success ? p.data : [])
      setServices(s.success ? s.data : [])
      setGarments(g.success ? g.data : [])
      setCats(c.success ? c.data : [])
      setStores(Array.isArray(st) ? st.map((x: { id: string; storeName: string }) => ({ id: x.id, name: x.storeName })) : [])
    } catch { setRules([]) } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true) }
  const openEdit = (r: Rule) => {
    setEditing(r)
    setForm({
      serviceId: r.service?.id || NONE, garmentId: r.garment?.id || NONE, categoryId: r.category?.id || NONE,
      storeId: r.store?.id || NONE, customerType: r.customerType || NONE, pricingType: r.pricingType,
      price: String(r.price), gstPercent: String(r.gstPercent), minCharge: r.minCharge?.toString() ?? "",
      maxWeightKg: r.maxWeightKg?.toString() ?? "", extraWeightCharge: r.extraWeightCharge?.toString() ?? "",
      weekendPrice: r.weekendPrice?.toString() ?? "", expressCharge: r.expressCharge?.toString() ?? "",
      pickupCharge: r.pickupCharge?.toString() ?? "", deliveryCharge: r.deliveryCharge?.toString() ?? "",
      priority: String(r.priority), isActive: r.isActive,
    })
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        serviceId: form.serviceId === NONE ? null : form.serviceId,
        garmentId: form.garmentId === NONE ? null : form.garmentId,
        categoryId: form.categoryId === NONE ? null : form.categoryId,
        storeId: form.storeId === NONE ? null : form.storeId,
        customerType: form.customerType === NONE ? null : form.customerType,
      }
      const url = editing ? `/api/laundry/pricing/${editing.id}` : `/api/laundry/pricing`
      const res = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? payload : { ...payload, businessId: currentBusinessId }) })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || "Save failed")
      toast.success(editing ? "Pricing rule updated" : "Pricing rule created"); setOpen(false); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }
  const remove = async (r: Rule) => { if (!confirm("Delete this pricing rule?")) return; await fetch(`/api/laundry/pricing/${r.id}`, { method: "DELETE" }); toast.success("Rule deleted"); load() }

  const RefSelect = ({ label, value, k, options, labelKey = "name" }: { label: string; value: string; k: keyof Form; options: Ref[]; labelKey?: "name" | "storeName" }) => (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => set(k, v)}>
        <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
        <SelectContent><SelectItem value={NONE}>Any</SelectItem>{options.map(o => <SelectItem key={o.id} value={o.id}>{(o[labelKey] as string) || o.name || o.storeName}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  )
  const Num = ({ label, k }: { label: string; k: keyof Form }) => (
    <div><Label>{label}</Label><Input type="number" value={form[k] as string} onChange={(e) => set(k, e.target.value)} /></div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-semibold tracking-tight">Pricing Engine</h2><p className="text-sm text-muted-foreground">Connected pricing rules (Service · Garment · Category · Store · Customer Type). Highest priority active rule wins.</p></div>
        <Button size="sm" className="gap-1 bg-sky-600 hover:bg-sky-700 text-white" onClick={openNew}><Plus className="h-3.5 w-3.5" /> New Rule</Button>
      </div>
      <Card><CardContent className="p-0">
        {loading ? <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        : rules.length === 0 ? <div className="text-center py-16 text-sm text-muted-foreground">No pricing rules yet. Create one to bill orders.</div>
        : <Table>
            <TableHeader><TableRow><TableHead>Scope</TableHead><TableHead>Type</TableHead><TableHead>Price</TableHead><TableHead>GST</TableHead><TableHead>Priority</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{rules.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{[r.service?.name, r.garment?.name, r.category?.name, r.store?.storeName, r.customerType && typeLabel(r.customerType)].filter(Boolean).join(" · ") || "All"}</TableCell>
                <TableCell><Badge variant="outline">{typeLabel(r.pricingType)}</Badge></TableCell>
                <TableCell className="font-medium">₹{r.price}</TableCell>
                <TableCell>{r.gstPercent}%</TableCell>
                <TableCell>{r.priority}</TableCell>
                <TableCell><Badge variant="outline" className={r.isActive ? "border-emerald-300 text-emerald-700" : "border-gray-200 text-gray-400"}>{r.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-red-500" /></Button></TableCell>
              </TableRow>))}</TableBody>
          </Table>}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Pricing Rule" : "New Pricing Rule"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Scope (leave Any to apply broadly)</p>
              <div className="grid grid-cols-2 gap-3">
                <RefSelect label="Service" value={form.serviceId} k="serviceId" options={services} />
                <RefSelect label="Garment" value={form.garmentId} k="garmentId" options={garments} />
                <RefSelect label="Category" value={form.categoryId} k="categoryId" options={cats} />
                <RefSelect label="Store" value={form.storeId} k="storeId" options={stores} />
                <div>
                  <Label>Customer Type</Label>
                  <Select value={form.customerType} onValueChange={(v) => set("customerType", v)}>
                    <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>Any</SelectItem>{CUSTOMER_TYPES.map(t => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pricing Type</Label>
                  <Select value={form.pricingType} onValueChange={(v) => set("pricingType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRICING_TYPES.map(t => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Charges</p>
              <div className="grid grid-cols-3 gap-3">
                <Num label="Price (₹)" k="price" />
                <Num label="GST %" k="gstPercent" />
                <Num label="Min Charge" k="minCharge" />
                <Num label="Max Weight (Kg)" k="maxWeightKg" />
                <Num label="Extra Weight ₹/Kg" k="extraWeightCharge" />
                <Num label="Weekend Price" k="weekendPrice" />
                <Num label="Express Charge" k="expressCharge" />
                <Num label="Pickup Charge" k="pickupCharge" />
                <Num label="Delivery Charge" k="deliveryCharge" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="w-28"><Label>Priority</Label><Input type="number" value={form.priority} onChange={(e) => set("priority", e.target.value)} /></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} /><span className="text-sm">Active</span></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving} className="gap-1">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
