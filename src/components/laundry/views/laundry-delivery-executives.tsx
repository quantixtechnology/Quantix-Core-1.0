"use client"

// Delivery Executives (Admin) — the dedicated operational master for field
// pickup/delivery staff. Create/edit/activate/reset-password/assign-store. Each
// executive is backed by an existing auth User (login via the platform auth
// system); only these executives can log into the Pickup & Delivery PWA.
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Plus, Pencil, KeyRound, Bike, Search } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import { LaundryImageUpload } from "./pricing/laundry-image-upload"

interface Store { id: string; storeName: string }
interface Exec {
  id: string; employeeCode: string; name: string; mobile: string
  storeId: string | null; storeName: string | null; vehicleType: string | null
  vehicleNumber: string | null; photo: string | null
  isActive: boolean; availability: string; currentStatus: string | null
  todaysPickups: number; todaysDeliveries: number
}
const VEHICLES = ["BIKE", "SCOOTER", "CAR", "VAN", "CYCLE"]
const EMPTY = { name: "", mobile: "", employeeCode: "", storeId: "", vehicleType: "", vehicleNumber: "", photo: "", password: "", isActive: true }

export function LaundryDeliveryExecutives() {
  const { currentBusinessId } = useAuthStore()
  const [items, setItems] = useState<Exec[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Exec | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof EMPTY, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }))

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/delivery-executives?businessId=${currentBusinessId}`).then((r) => r.json())
      if (j.success) { setItems(j.data); setStores(j.stores || []) }
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); setForm({ ...EMPTY }); setOpen(true) }
  const openEdit = (e: Exec) => { setEditing(e); setForm({ name: e.name, mobile: e.mobile, employeeCode: e.employeeCode, storeId: e.storeId || "", vehicleType: e.vehicleType || "", vehicleNumber: e.vehicleNumber || "", photo: e.photo || "", password: "", isActive: e.isActive }); setOpen(true) }

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return }
    if (!form.mobile.trim()) { toast.error("Mobile is required"); return }
    setSaving(true)
    try {
      const url = editing ? `/api/laundry/delivery-executives/${editing.id}` : "/api/laundry/delivery-executives"
      const payload = editing
        ? { businessId: currentBusinessId, name: form.name, mobile: form.mobile, storeId: form.storeId || null, vehicleType: form.vehicleType || null, vehicleNumber: form.vehicleNumber || null, photo: form.photo || null, isActive: form.isActive }
        : { businessId: currentBusinessId, name: form.name, mobile: form.mobile, employeeCode: form.employeeCode || undefined, storeId: form.storeId || null, vehicleType: form.vehicleType || null, vehicleNumber: form.vehicleNumber || null, photo: form.photo || null, password: form.password || undefined, isActive: form.isActive }
      const res = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Save failed")
      if (!editing && j.data?.tempPassword) toast.success(`Executive ${j.data.employeeCode} created · password: ${j.data.tempPassword}`, { duration: 12000 })
      else toast.success("Saved")
      setOpen(false); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  const toggleActive = async (e: Exec) => {
    await fetch(`/api/laundry/delivery-executives/${e.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, isActive: !e.isActive }) })
    load()
  }
  const resetPassword = async (e: Exec) => {
    if (!confirm(`Reset password for ${e.name}?`)) return
    try {
      const res = await fetch(`/api/laundry/delivery-executives/${e.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, action: "reset-password" }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast.success(`New password for ${e.name}: ${j.tempPassword}`, { duration: 12000 })
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed") }
  }

  const filtered = items.filter((e) => { const q = search.trim().toLowerCase(); return !q || e.name.toLowerCase().includes(q) || e.mobile.includes(q) || e.employeeCode.toLowerCase().includes(q) })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><Bike className="h-5 w-5 text-blue-600" /> Delivery Executives</h2>
          <p className="text-sm text-muted-foreground">Field pickup &amp; delivery staff. Only these accounts can log into the Pickup &amp; Delivery PWA. {items.length} executive(s).</p>
        </div>
        <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={openNew}><Plus className="h-3.5 w-3.5" /> New Executive</Button>
      </div>

      <div className="relative max-w-sm"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search name, mobile, code…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      <Card><CardContent className="p-0">
        {loading ? <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        : filtered.length === 0 ? <div className="text-center py-16 text-sm text-muted-foreground">No delivery executives yet. Create one to start assigning pickups.</div>
        : <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Mobile</TableHead><TableHead>Store</TableHead>
              <TableHead>Vehicle</TableHead><TableHead>Today</TableHead><TableHead>Availability</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>{filtered.map((e) => (
              <TableRow key={e.id} className={e.isActive ? "" : "opacity-60"}>
                <TableCell className="font-mono text-xs text-muted-foreground">{e.employeeCode}</TableCell>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell className="text-sm">{e.mobile}</TableCell>
                <TableCell>{e.storeName ? <Badge variant="outline">{e.storeName}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-xs">{e.vehicleType || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{e.todaysPickups}P · {e.todaysDeliveries}D</TableCell>
                <TableCell><Badge variant="outline" className={e.availability === "AVAILABLE" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-amber-300 text-amber-700 bg-amber-50"}>{e.availability}</Badge></TableCell>
                <TableCell><Switch checked={e.isActive} onCheckedChange={() => toggleActive(e)} /></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Reset password" onClick={() => resetPassword(e)}><KeyRound className="h-4 w-4 text-amber-600" /></Button>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Executive" : "New Delivery Executive"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Rahul Kumar" /></div>
              <div><Label>Mobile *</Label><Input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="9876543210" /></div>
              <div><Label>Employee Code</Label><Input value={form.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} placeholder="Auto (EXE001)" disabled={!!editing} className={editing ? "bg-slate-50 font-mono text-sm" : ""} /></div>
              <div><Label>Assigned Store</Label>
                <select value={form.storeId} onChange={(e) => set("storeId", e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-2 text-sm bg-white"><option value="">—</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.storeName}</option>)}</select>
              </div>
              <div><Label>Vehicle Type</Label>
                <select value={form.vehicleType} onChange={(e) => set("vehicleType", e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-2 text-sm bg-white"><option value="">—</option>{VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}</select>
              </div>
              <div><Label>Vehicle Number</Label><Input value={form.vehicleNumber} onChange={(e) => set("vehicleNumber", e.target.value)} placeholder="KA01AB1234" /></div>
              <div className="col-span-2 space-y-1"><Label>Profile Photo (optional)</Label>
                {currentBusinessId && <LaundryImageUpload value={form.photo || null} businessId={currentBusinessId} folder="laundry-executives" onChange={(url) => set("photo", url || "")} />}
              </div>
              {!editing && <div className="col-span-2"><Label>Login Password</Label><Input value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Leave blank to auto-generate" /></div>}
            </div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} /> Active</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
