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
import { Loader2, Plus, Search, Pencil, Trash2, Download } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import { MasterImportDialog } from "./masters/master-import-dialog"

interface Category {
  id: string; name: string; code: string | null; description: string | null; color: string | null
  defaultGstPercent: number | null; displayOnWebsite: boolean; displayInPOS: boolean; displayInApp: boolean
  displayOrder: number; isActive: boolean
}
const EMPTY = {
  name: "", code: "", description: "", color: "#0EA5E9", defaultGstPercent: "",
  displayOnWebsite: true, displayInPOS: true, displayInApp: true, displayOrder: 0, isActive: true,
}
type Form = typeof EMPTY

export function LaundryCategoriesMaster() {
  const { currentBusinessId } = useAuthStore()
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Form, v: string | number | boolean) => setForm((p) => ({ ...p, [k]: v }))

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
  const openEdit = (c: Category) => {
    setEditing(c)
    setForm({
      name: c.name, code: c.code || "", description: c.description || "", color: c.color || "#0EA5E9",
      defaultGstPercent: c.defaultGstPercent?.toString() ?? "", displayOnWebsite: c.displayOnWebsite,
      displayInPOS: c.displayInPOS, displayInApp: c.displayInApp, displayOrder: c.displayOrder, isActive: c.isActive,
    })
    setOpen(true)
  }

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
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setImportOpen(true)}><Download className="h-3.5 w-3.5" /> Import / Templates</Button>
          <Button size="sm" className="gap-1 bg-sky-600 hover:bg-sky-700 text-white" onClick={openNew}><Plus className="h-3.5 w-3.5" /> New Category</Button>
        </div>
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
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>GST</TableHead><TableHead>Channels</TableHead><TableHead>Order</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs font-mono text-muted-foreground">{c.code || "—"}</TableCell>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border" style={{ background: c.color || "transparent" }} />
                      {c.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">{c.defaultGstPercent != null ? `${c.defaultGstPercent}%` : "—"}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{[c.displayOnWebsite && "Web", c.displayInPOS && "POS", c.displayInApp && "App"].filter(Boolean).join(" · ") || "—"}</TableCell>
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
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Dry Clean" /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="DRY" /></div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} className="h-9 w-12 p-1" />
                  <Input value={form.color} onChange={(e) => set("color", e.target.value)} className="h-9" />
                </div>
              </div>
              <div><Label>Default GST %</Label><Input type="number" step="any" value={form.defaultGstPercent} onChange={(e) => set("defaultGstPercent", e.target.value)} /></div>
              <div><Label>Display Order</Label><Input type="number" value={form.displayOrder} onChange={(e) => set("displayOrder", parseInt(e.target.value) || 0)} /></div>
            </div>
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Show in channels</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.displayOnWebsite} onCheckedChange={(v) => set("displayOnWebsite", v)} /> Website</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.displayInPOS} onCheckedChange={(v) => set("displayInPOS", v)} /> POS</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.displayInApp} onCheckedChange={(v) => set("displayInApp", v)} /> Mobile App</label>
              </div>
            </div>
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
