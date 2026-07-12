"use client"

// Masters → Garments. Enterprise garment master (per laundry business) — codes,
// material, care, barcode prefix, weights + bulk import / templates. Pricing
// references garments; each has a category + default unit.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Plus, Search, Pencil, Trash2, Download } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import { MasterImportDialog } from "./masters/master-import-dialog"

interface Cat { id: string; name: string }
interface Garment {
  id: string; name: string; code: string | null; categoryId: string | null; category?: Cat | null
  defaultService: string | null; defaultUnit: string; material: string | null; careInstructions: string | null
  barcodePrefix: string | null; weightFactor: number | null; averageWeight: number | null; image: string | null
  displayOrder: number; isActive: boolean
}
const NONE = "__none__"
const EMPTY = {
  name: "", code: "", categoryId: NONE, defaultService: "", defaultUnit: "PIECE", material: "",
  careInstructions: "", barcodePrefix: "", weightFactor: "", averageWeight: "", image: "",
  displayOrder: 0, isActive: true,
}
type Form = typeof EMPTY

export function LaundryGarmentsMaster() {
  const { currentBusinessId } = useAuthStore()
  const [items, setItems] = useState<Garment[]>([])
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Garment | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Form, v: string | number | boolean) => setForm((p) => ({ ...p, [k]: v }))

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const [g, c] = await Promise.all([
        fetch(`/api/laundry/garments?businessId=${encodeURIComponent(currentBusinessId)}&includeInactive=1`).then(r => r.json()),
        fetch(`/api/laundry/categories?businessId=${encodeURIComponent(currentBusinessId)}`).then(r => r.json()),
      ])
      setItems(g.success ? g.data : [])
      setCats(c.success ? c.data : [])
    } catch { setItems([]) } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true) }
  const openEdit = (g: Garment) => {
    setEditing(g)
    setForm({
      name: g.name, code: g.code || "", categoryId: g.categoryId || NONE, defaultService: g.defaultService || "",
      defaultUnit: g.defaultUnit, material: g.material || "", careInstructions: g.careInstructions || "",
      barcodePrefix: g.barcodePrefix || "", weightFactor: g.weightFactor?.toString() ?? "",
      averageWeight: g.averageWeight?.toString() ?? "", image: g.image || "", displayOrder: g.displayOrder, isActive: g.isActive,
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return }
    setSaving(true)
    try {
      const payload = { ...form, categoryId: form.categoryId === NONE ? null : form.categoryId }
      const url = editing ? `/api/laundry/garments/${editing.id}` : `/api/laundry/garments`
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? payload : { ...payload, businessId: currentBusinessId }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || "Save failed")
      toast.success(editing ? "Garment updated" : "Garment created")
      setOpen(false); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }
  const toggle = async (g: Garment) => { await fetch(`/api/laundry/garments/${g.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !g.isActive }) }); load() }
  const remove = async (g: Garment) => { if (!confirm(`Delete garment "${g.name}"?`)) return; await fetch(`/api/laundry/garments/${g.id}`, { method: "DELETE" }); toast.success("Garment deleted"); load() }

  const filtered = items.filter(g => {
    const q = search.trim().toLowerCase()
    return !q || g.name.toLowerCase().includes(q) || (g.code || "").toLowerCase().includes(q) || (g.material || "").toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Garments</h2>
          <p className="text-sm text-muted-foreground">Manage clothes and items accepted by your laundry. {items.length} item(s).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setImportOpen(true)}><Download className="h-3.5 w-3.5" /> Import / Templates</Button>
          <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={openNew}><Plus className="h-3.5 w-3.5" /> New Garment</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, code, material…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm font-medium">{search ? "No garments match your search" : "No garments yet"}</p>
            <p className="text-xs text-muted-foreground mt-1">{search ? "Try a different term." : "Use Import / Templates to load 40+ common garments instantly."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead>
                <TableHead>Material</TableHead><TableHead>Avg Wt</TableHead><TableHead>Unit</TableHead>
                <TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map(g => (
                  <TableRow key={g.id}>
                    <TableCell className="text-xs text-muted-foreground font-mono">{g.code || "—"}</TableCell>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell>{g.category?.name ? <Badge variant="outline">{g.category.name}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-xs">{g.material || "—"}</TableCell>
                    <TableCell className="text-xs tabular-nums">{g.averageWeight != null ? `${g.averageWeight} kg` : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={g.defaultUnit === "KG" ? "border-violet-300 text-violet-700" : "border-blue-300 text-blue-700"}>{g.defaultUnit === "KG" ? "Per Kg" : "Per Piece"}</Badge></TableCell>
                    <TableCell><Switch checked={g.isActive} onCheckedChange={() => toggle(g)} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(g)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(g)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Garment" : "New Garment"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Shirt" /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="G-SHRT" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.categoryId} onValueChange={(v) => set("categoryId", v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent><SelectItem value={NONE}>None</SelectItem>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default Unit</Label>
                <Select value={form.defaultUnit} onValueChange={(v) => set("defaultUnit", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="PIECE">Per Piece</SelectItem><SelectItem value="KG">Per Kg</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Material</Label><Input value={form.material} onChange={(e) => set("material", e.target.value)} placeholder="Cotton, Silk…" /></div>
              <div><Label>Default Service</Label><Input value={form.defaultService} onChange={(e) => set("defaultService", e.target.value)} placeholder="e.g. Wash & Iron" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Avg Weight (kg)</Label><Input type="number" step="any" value={form.averageWeight} onChange={(e) => set("averageWeight", e.target.value)} /></div>
              <div><Label>Weight Factor</Label><Input type="number" step="any" value={form.weightFactor} onChange={(e) => set("weightFactor", e.target.value)} /></div>
              <div><Label>Display Order</Label><Input type="number" value={form.displayOrder} onChange={(e) => set("displayOrder", parseInt(e.target.value) || 0)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Barcode Prefix</Label><Input value={form.barcodePrefix} onChange={(e) => set("barcodePrefix", e.target.value)} placeholder="e.g. SHRT" /></div>
              <div><Label>Image URL</Label><Input value={form.image} onChange={(e) => set("image", e.target.value)} placeholder="https://…" /></div>
            </div>
            <div><Label>Care Instructions</Label><Textarea value={form.careInstructions} onChange={(e) => set("careInstructions", e.target.value)} placeholder="e.g. Dry clean only, do not bleach" className="min-h-[60px]" /></div>
            <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} /><span className="text-sm">Active</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-1">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {currentBusinessId && (
        <MasterImportDialog open={importOpen} onClose={() => setImportOpen(false)} businessId={currentBusinessId} onImported={load} />
      )}
    </div>
  )
}
