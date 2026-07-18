"use client"

// Masters → Garments. Enterprise garment master (per laundry business) — codes,
// material, care, barcode prefix, weights + bulk import / templates. Pricing
// references garments; each has a category + default unit.

import { useCallback, useEffect, useState } from "react"
import * as XLSX from "xlsx"
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
import { Loader2, Plus, Search, Pencil, Trash2, Download, Upload, FileSpreadsheet, Archive, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import { MasterImportDialog } from "./masters/master-import-dialog"

const GARMENT_HEADERS = ["Garment Code", "Garment Name", "Category", "Material", "Avg Weight", "Subscription", "Image URL", "Status"]

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
  const [xlsxOpen, setXlsxOpen] = useState(false)
  const [editing, setEditing] = useState<Garment | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
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
      setSelected(new Set())
    } catch { setItems([]) } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  const downloadTemplate = () => {
    const sample = ["MEN-SHIRT", "Shirt", cats[0]?.name || "Men", "Cotton", 0.3, "Yes", "", "Active"]
    const ws = XLSX.utils.aoa_to_sheet([GARMENT_HEADERS, sample])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Garments")
    XLSX.writeFile(wb, "garment-template.xlsx")
  }

  const exportGarments = async () => {
    if (!currentBusinessId) return
    try {
      const j = await fetch(`/api/laundry/garments/export?businessId=${encodeURIComponent(currentBusinessId)}`).then(r => r.json())
      if (!j.success) throw new Error(j.error || "Export failed")
      const headers = ["Garment Code", "Garment Name", "Category", "Material", "Avg Weight", "Subscription", "Status", "Created", "Updated", "Used in Pricing", "Used in Orders"]
      const rows = (j.rows as Record<string, unknown>[]).map(r => [r.code, r.name, r.category, r.material, r.averageWeight, r.subscription, r.status, r.createdAt, r.updatedAt, r.usedInPricing, r.usedInOrders])
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Garments")
      XLSX.writeFile(wb, "garment-master.xlsx")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Export failed") }
  }

  const bulkAction = async (action: "archive" | "delete") => {
    if (!selected.size) return
    if (action === "delete" && !confirm(`Delete ${selected.size} garment(s)? Any used in pricing, orders or subscriptions will be archived instead (never destroyed).`)) return
    setBulkBusy(true)
    try {
      const res = await fetch("/api/laundry/garments/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, ids: [...selected], action }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Action failed")
      toast.success(action === "archive" ? `${j.archived} archived` : `${j.deleted} deleted, ${j.archived} archived (in use)`)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Action failed") } finally { setBulkBusy(false) }
  }

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
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allVisibleSelected = filtered.length > 0 && filtered.every((g) => selected.has(g.id))
  const toggleAll = () => setSelected((s) => { const n = new Set(s); if (allVisibleSelected) filtered.forEach((g) => n.delete(g.id)); else filtered.forEach((g) => n.add(g.id)); return n })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Garments</h2>
          <p className="text-sm text-muted-foreground">Immutable Garment Codes are the source of truth. Pricing lives on the Pricing Matrix. {items.length} item(s).</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1" onClick={downloadTemplate}><FileSpreadsheet className="h-3.5 w-3.5" /> Template</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setXlsxOpen(true)}><Upload className="h-3.5 w-3.5" /> Import</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={exportGarments}><Download className="h-3.5 w-3.5" /> Export</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setImportOpen(true)}><Sparkles className="h-3.5 w-3.5" /> Samples</Button>
          <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={openNew}><Plus className="h-3.5 w-3.5" /> New Garment</Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, code, material…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Button size="sm" variant="outline" className="gap-1" disabled={bulkBusy} onClick={() => bulkAction("archive")}><Archive className="h-3.5 w-3.5" /> Archive</Button>
            <Button size="sm" variant="outline" className="gap-1 text-rose-600 border-rose-200 hover:bg-rose-50" disabled={bulkBusy} onClick={() => bulkAction("delete")}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
          </div>
        )}
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
                <TableHead className="w-8"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} /></TableHead>
                <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead>
                <TableHead>Material</TableHead><TableHead>Avg Wt</TableHead><TableHead>Unit</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map(g => (
                  <TableRow key={g.id} className={selected.has(g.id) ? "bg-blue-50/40" : ""}>
                    <TableCell><input type="checkbox" checked={selected.has(g.id)} onChange={() => toggleSel(g.id)} /></TableCell>
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
              <div><Label>Code{editing ? "" : " (optional)"}</Label>
                {editing
                  ? <Input value={form.code} disabled className="font-mono text-sm bg-slate-50 text-slate-500" />
                  : <Input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="Auto (GAR00001)" className="font-mono text-sm" />}
              </div>
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
      {xlsxOpen && currentBusinessId && (
        <GarmentImportDialog businessId={currentBusinessId} onTemplate={downloadTemplate} onClose={() => setXlsxOpen(false)} onImported={() => { setXlsxOpen(false); load() }} />
      )}
    </div>
  )
}

// ── Garment catalogue import (Excel/CSV) — preview → validation → commit. Rows
//    are matched by immutable Garment Code; nothing writes unless all rows pass. ──
type ImportRow = { code: string; name: string; category: string; material: string; avgWeight: unknown; subscription: string; image: string; status: string }
function GarmentImportDialog({ businessId, onTemplate, onClose, onImported }: { businessId: string; onTemplate: () => void; onClose: () => void; onImported: () => void }) {
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [strategy, setStrategy] = useState<"update" | "skip">("update")
  const [summary, setSummary] = useState<{ toCreate: number; toUpdate: number; toSkip: number } | null>(null)
  const [warnings, setWarnings] = useState<{ row: number; message: string }[]>([])
  const [errors, setErrors] = useState<{ row: number; code: string; message: string }[]>([])

  const analyze = async (parsed: ImportRow[], strat: "update" | "skip") => {
    setBusy(true); setErrors([]); setWarnings([]); setSummary(null)
    try {
      const res = await fetch("/api/laundry/garments/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, rows: parsed, duplicateStrategy: strat, commit: false }) })
      const j = await res.json()
      setSummary(j.summary || null); setWarnings(j.warnings || []); setErrors(j.errors || [])
      if (j.errors?.length) toast.error(`${j.errors.length} row error(s) — fix before importing`)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to read file") } finally { setBusy(false) }
  }

  const onFile = async (file: File) => {
    setBusy(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" })
      const parsed: ImportRow[] = json.map((o) => ({
        code: String(o["Garment Code"] ?? ""), name: String(o["Garment Name"] ?? ""), category: String(o["Category"] ?? ""),
        material: String(o["Material"] ?? ""), avgWeight: o["Avg Weight"], subscription: String(o["Subscription"] ?? ""),
        image: String(o["Image URL"] ?? ""), status: String(o["Status"] ?? ""),
      }))
      if (!parsed.length) { toast.error("No rows found"); return }
      setRows(parsed)
      await analyze(parsed, strategy)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to read file") } finally { setBusy(false) }
  }

  const changeStrategy = (s: "update" | "skip") => { setStrategy(s); if (rows) analyze(rows, s) }

  const commit = async () => {
    if (!rows || errors.length) return
    setBusy(true)
    try {
      const res = await fetch("/api/laundry/garments/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, rows, duplicateStrategy: strategy, commit: true }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Import failed")
      toast.success(`${j.created} created, ${j.updated} updated${j.skipped ? `, ${j.skipped} skipped` : ""}`); onImported()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Import failed") } finally { setBusy(false) }
  }

  const downloadErrors = () => {
    const ws = XLSX.utils.aoa_to_sheet([["Row", "Garment Code", "Error"], ...errors.map((e) => [e.row, e.code, e.message])])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Errors")
    XLSX.writeFile(wb, "garment-import-errors.xlsx")
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Import Garments</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Upload your garment catalogue (.xlsx/.csv). Rows are matched by <b>Garment Code</b>; every row is validated before anything is written.</p>
        <Button variant="outline" className="gap-1 w-full" onClick={onTemplate}><FileSpreadsheet className="h-4 w-4" /> Download Template</Button>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">On duplicate code:</span>
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={strategy === "update"} onChange={() => changeStrategy("update")} /> Update</label>
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={strategy === "skip"} onChange={() => changeStrategy("skip")} /> Skip</label>
        </div>
        <label className={`block rounded-lg border-2 border-dashed p-6 text-center text-sm cursor-pointer ${busy ? "opacity-50" : "border-slate-200 hover:border-blue-300"}`}>
          {busy ? <span className="text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /> Working…</span> : <span className="text-slate-500"><Upload className="h-5 w-5 inline mb-1" /><br />Click to choose .xlsx / .csv</span>}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
        </label>
        {summary && (
          <div className="flex gap-2 text-xs">
            <Badge variant="outline" className="border-emerald-300 text-emerald-700">{summary.toCreate} new</Badge>
            <Badge variant="outline" className="border-blue-300 text-blue-700">{summary.toUpdate} update</Badge>
            {summary.toSkip > 0 && <Badge variant="outline" className="border-slate-300 text-slate-500">{summary.toSkip} skip</Badge>}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="max-h-28 overflow-y-auto rounded-lg border border-amber-100 bg-amber-50/50 p-2 text-xs space-y-1">
            {warnings.map((w, i) => <p key={i} className="text-amber-700">Row {w.row}: {w.message}</p>)}
          </div>
        )}
        {errors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-rose-700">{errors.length} error(s)</p><button className="text-xs text-blue-600 hover:underline" onClick={downloadErrors}>Download error report</button></div>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-rose-100 bg-rose-50/50 p-2 text-xs space-y-1">
              {errors.map((er, i) => <p key={i} className="text-rose-700">Row {er.row}{er.code ? ` (${er.code})` : ""}: {er.message}</p>)}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={commit} disabled={busy || !rows || errors.length > 0 || !summary} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Import{summary ? ` (${summary.toCreate + summary.toUpdate})` : ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
