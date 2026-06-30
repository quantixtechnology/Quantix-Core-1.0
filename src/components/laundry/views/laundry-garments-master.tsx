"use client"

// Masters → Garments. Permanent CRUD master (per laundry business).
// Pricing references garments; each garment has a category + default unit.

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
interface Garment { id: string; name: string; categoryId: string | null; category?: Cat | null; defaultService: string | null; defaultUnit: string; displayOrder: number; isActive: boolean }
const NONE = "__none__"
const EMPTY = { name: "", categoryId: NONE, defaultService: "", defaultUnit: "PIECE", displayOrder: 0, isActive: true }

export function LaundryGarmentsMaster() {
  const { currentBusinessId } = useAuthStore()
  const [items, setItems] = useState<Garment[]>([])
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Garment | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const [g, c] = await Promise.all([
        fetch(`/api/laundry/garments?businessId=${encodeURIComponent(currentBusinessId)}`).then(r => r.json()),
        fetch(`/api/laundry/categories?businessId=${encodeURIComponent(currentBusinessId)}`).then(r => r.json()),
      ])
      setItems(g.success ? g.data : [])
      setCats(c.success ? c.data : [])
    } catch { setItems([]) } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true) }
  const openEdit = (g: Garment) => { setEditing(g); setForm({ name: g.name, categoryId: g.categoryId || NONE, defaultService: g.defaultService || "", defaultUnit: g.defaultUnit, displayOrder: g.displayOrder, isActive: g.isActive }); setOpen(true) }

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

  const filtered = items.filter(g => !search.trim() || g.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Garments</h2>
          <p className="text-sm text-muted-foreground">Garment master used by the pricing engine.</p>
        </div>
        <Button size="sm" className="gap-1 bg-sky-600 hover:bg-sky-700 text-white" onClick={openNew}><Plus className="h-3.5 w-3.5" /> New Garment</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search garments…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">No garments yet. Create one to get started.</div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Default Unit</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map(g => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell>{g.category?.name ? <Badge variant="outline">{g.category.name}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
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
        )}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Garment" : "New Garment"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Shirt" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm(p => ({ ...p, categoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default Unit</Label>
                <Select value={form.defaultUnit} onValueChange={(v) => setForm(p => ({ ...p, defaultUnit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="PIECE">Per Piece</SelectItem><SelectItem value="KG">Per Kg</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Default Service</Label><Input value={form.defaultService} onChange={(e) => setForm(p => ({ ...p, defaultService: e.target.value }))} placeholder="e.g. Wash & Iron" /></div>
              <div><Label>Display Order</Label><Input type="number" value={form.displayOrder} onChange={(e) => setForm(p => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={(v) => setForm(p => ({ ...p, isActive: v }))} /><span className="text-sm">Active</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-1">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
