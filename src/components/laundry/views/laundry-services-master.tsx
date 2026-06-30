"use client"

// Masters → Services. Permanent CRUD master (per laundry business).
// Consumed by the Pricing Engine, New Order, Website and Customer App.

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
import { Loader2, Plus, Search, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface Cat { id: string; name: string }
interface Service {
  id: string; name: string; categoryId: string | null; category?: Cat | null
  defaultTurnaroundHours: number; displayOnWebsite: boolean; availableInStore: boolean
  availableForPickup: boolean; subscriptionEligible: boolean; displayOrder: number; isActive: boolean
}
const NONE = "__none__"
const EMPTY = { name: "", categoryId: NONE, defaultTurnaroundHours: 24, displayOnWebsite: true, availableInStore: true, availableForPickup: true, subscriptionEligible: false, displayOrder: 0, isActive: true }

export function LaundryServicesMaster() {
  const { currentBusinessId } = useAuthStore()
  const [items, setItems] = useState<Service[]>([])
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const [s, c] = await Promise.all([
        fetch(`/api/laundry/services?businessId=${encodeURIComponent(currentBusinessId)}`).then(r => r.json()),
        fetch(`/api/laundry/categories?businessId=${encodeURIComponent(currentBusinessId)}`).then(r => r.json()),
      ])
      setItems(s.success ? s.data : [])
      setCats(c.success ? c.data : [])
    } catch { setItems([]) } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true) }
  const openEdit = (s: Service) => { setEditing(s); setForm({ name: s.name, categoryId: s.categoryId || NONE, defaultTurnaroundHours: s.defaultTurnaroundHours, displayOnWebsite: s.displayOnWebsite, availableInStore: s.availableInStore, availableForPickup: s.availableForPickup, subscriptionEligible: s.subscriptionEligible, displayOrder: s.displayOrder, isActive: s.isActive }); setOpen(true) }

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return }
    setSaving(true)
    try {
      const payload = { ...form, categoryId: form.categoryId === NONE ? null : form.categoryId }
      const url = editing ? `/api/laundry/services/${editing.id}` : `/api/laundry/services`
      const res = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? payload : { ...payload, businessId: currentBusinessId }) })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || "Save failed")
      toast.success(editing ? "Service updated" : "Service created"); setOpen(false); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }
  const toggle = async (s: Service) => { await fetch(`/api/laundry/services/${s.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !s.isActive }) }); load() }
  const remove = async (s: Service) => { if (!confirm(`Delete service "${s.name}"?`)) return; await fetch(`/api/laundry/services/${s.id}`, { method: "DELETE" }); toast.success("Service deleted"); load() }

  const filtered = items.filter(s => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()))
  const Tog = ({ label, k }: { label: string; k: keyof typeof form }) => (
    <div className="flex items-center justify-between rounded-md border px-3 py-2"><span className="text-sm">{label}</span><Switch checked={!!form[k]} onCheckedChange={(v) => setForm(p => ({ ...p, [k]: v }))} /></div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-semibold tracking-tight">Services</h2><p className="text-sm text-muted-foreground">Service catalog consumed by pricing, orders and the website.</p></div>
        <Button size="sm" className="gap-1 bg-sky-600 hover:bg-sky-700 text-white" onClick={openNew}><Plus className="h-3.5 w-3.5" /> New Service</Button>
      </div>
      <div className="relative max-w-sm"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search services…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <Card><CardContent className="p-0">
        {loading ? <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        : filtered.length === 0 ? <div className="text-center py-16 text-sm text-muted-foreground">No services yet.</div>
        : <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>TAT</TableHead><TableHead>Channels</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.category?.name ? <Badge variant="outline">{s.category.name}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{s.defaultTurnaroundHours}h</TableCell>
                <TableCell className="text-[11px] text-muted-foreground">{[s.availableInStore && "Store", s.availableForPickup && "Pickup", s.displayOnWebsite && "Web", s.subscriptionEligible && "Sub"].filter(Boolean).join(" · ") || "—"}</TableCell>
                <TableCell><Switch checked={s.isActive} onCheckedChange={() => toggle(s)} /></TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-red-500" /></Button></TableCell>
              </TableRow>))}</TableBody>
          </Table>}
      </CardContent></Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Service" : "New Service"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Wash & Iron" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm(p => ({ ...p, categoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent><SelectItem value={NONE}>None</SelectItem>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Turnaround (hours)</Label><Input type="number" value={form.defaultTurnaroundHours} onChange={(e) => setForm(p => ({ ...p, defaultTurnaroundHours: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Tog label="Available in Store" k="availableInStore" />
              <Tog label="Available for Pickup" k="availableForPickup" />
              <Tog label="Display on Website" k="displayOnWebsite" />
              <Tog label="Subscription Eligible" k="subscriptionEligible" />
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={(v) => setForm(p => ({ ...p, isActive: v }))} /><span className="text-sm">Active</span></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving} className="gap-1">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
