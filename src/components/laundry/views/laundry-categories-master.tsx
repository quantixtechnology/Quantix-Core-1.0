"use client"

// Masters → Categories. Permanent CRUD master (per laundry business).
// Garments and Pricing reference these categories.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Plus, Search, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface Category { id: string; name: string; description: string | null; displayOrder: number; isActive: boolean }
const EMPTY = { name: "", description: "", displayOrder: 0, isActive: true }

export function LaundryCategoriesMaster() {
  const { currentBusinessId } = useAuthStore()
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/categories?businessId=${encodeURIComponent(currentBusinessId)}`)
      const json = await res.json()
      setItems(json.success ? json.data : [])
    } catch { setItems([]) } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true) }
  const openEdit = (c: Category) => { setEditing(c); setForm({ name: c.name, description: c.description || "", displayOrder: c.displayOrder, isActive: c.isActive }); setOpen(true) }

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return }
    setSaving(true)
    try {
      const url = editing ? `/api/laundry/categories/${editing.id}` : `/api/laundry/categories`
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? form : { ...form, businessId: currentBusinessId }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || "Save failed")
      toast.success(editing ? "Category updated" : "Category created")
      setOpen(false); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  const toggle = async (c: Category) => {
    await fetch(`/api/laundry/categories/${c.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !c.isActive }) })
    load()
  }
  const remove = async (c: Category) => {
    if (!confirm(`Delete category "${c.name}"?`)) return
    await fetch(`/api/laundry/categories/${c.id}`, { method: "DELETE" })
    toast.success("Category deleted"); load()
  }

  const filtered = items.filter(c => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Categories</h2>
          <p className="text-sm text-muted-foreground">Operational categories for garments and pricing.</p>
        </div>
        <Button size="sm" className="gap-1 bg-sky-600 hover:bg-sky-700 text-white" onClick={openNew}><Plus className="h-3.5 w-3.5" /> New Category</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search categories…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">No categories yet. Create one to get started.</div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Order</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.description || "—"}</TableCell>
                  <TableCell>{c.displayOrder}</TableCell>
                  <TableCell><Switch checked={c.isActive} onCheckedChange={() => toggle(c)} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Dry Clean" /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="flex items-center gap-4">
              <div className="w-28"><Label>Display Order</Label><Input type="number" value={form.displayOrder} onChange={(e) => setForm(p => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))} /></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={form.isActive} onCheckedChange={(v) => setForm(p => ({ ...p, isActive: v }))} /><span className="text-sm">Active</span></div>
            </div>
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
