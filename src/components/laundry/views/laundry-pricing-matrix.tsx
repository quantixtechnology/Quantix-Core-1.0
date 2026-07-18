"use client"

// Pricing Matrix — the single garment×service pricing master. Dynamic service
// columns, per-cell NA / Per Piece / Per KG, bulk Excel import/export + a
// dynamic template. Writes the same LaundryPricingRule rows the engine reads
// (no engine/calculation change). Replaces per-service "Manage Prices".
import { useCallback, useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Search, Plus, Upload, Download, FileSpreadsheet, Tag } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface Svc { id: string; name: string }
interface Cat { id: string; name: string }
type Mode = "NOT_AVAILABLE" | "PER_PIECE" | "PER_KG"
interface Cell { mode: string; price: number; minWeightKg: number | null }
interface GRow { id: string; name: string; categoryId: string | null; categoryName: string | null; averageWeight: number | null; subscriptionIncluded: boolean; cells: Record<string, Cell> }

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
const cellLabel = (c?: Cell) => (!c || c.mode === "NOT_AVAILABLE") ? "NA" : c.mode === "PER_KG" ? `${inr(c.price)} / KG` : `${inr(c.price)} / Pc`

export function LaundryPricingMatrix() {
  const { currentBusinessId } = useAuthStore()
  const [services, setServices] = useState<Svc[]>([])
  const [categories, setCategories] = useState<Cat[]>([])
  const [garments, setGarments] = useState<GRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [edit, setEdit] = useState<GRow | "new" | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/pricing-matrix?businessId=${currentBusinessId}`).then((r) => r.json())
      if (j.success) { setServices(j.data.services); setCategories(j.data.categories); setGarments(j.data.garments) }
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return q ? garments.filter((g) => g.name.toLowerCase().includes(q) || (g.categoryName || "").toLowerCase().includes(q)) : garments }, [garments, search])

  // ── Template / Export headers (dynamic service columns) ──
  const headers = useMemo(() => ["Garment Name", "Category", "Avg Weight", "Subscription", ...services.flatMap((s) => [`${s.name} Price`, `${s.name} Billing`])], [services])

  const downloadTemplate = () => {
    const sample = ["Shirt", categories[0]?.name || "Men", 0.3, "Yes", ...services.flatMap((_, i) => (i === 0 ? [35, "PER_PIECE"] : ["", "NOT_AVAILABLE"]))]
    const ws = XLSX.utils.aoa_to_sheet([headers, sample])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Pricing")
    XLSX.writeFile(wb, "pricing-template.xlsx")
  }

  const exportMatrix = () => {
    const rows = garments.map((g) => [
      g.name, g.categoryName || "", g.averageWeight ?? "", g.subscriptionIncluded ? "Yes" : "No",
      ...services.flatMap((s) => { const c = g.cells[s.id]; return c && c.mode !== "NOT_AVAILABLE" ? [c.price, c.mode] : ["NA", "NOT_AVAILABLE"] }),
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Pricing")
    XLSX.writeFile(wb, "pricing-matrix.xlsx")
  }

  if (loading) return <div className="px-6 py-16 text-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>

  return (
    <div className="px-4 lg:px-6 py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Tag className="h-5 w-5 text-blue-600" /> Pricing Matrix</h1>
          <p className="text-sm text-slate-500">All garment pricing in one place. Every active service is a column; set NA / Per Piece / Per KG per cell.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-1" onClick={downloadTemplate}><FileSpreadsheet className="h-4 w-4" /> Template</Button>
          <Button variant="outline" className="gap-1" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Import</Button>
          <Button variant="outline" className="gap-1" onClick={exportMatrix}><Download className="h-4 w-4" /> Export</Button>
          <Button className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setEdit("new")}><Plus className="h-4 w-4" /> New Garment</Button>
        </div>
      </div>

      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search garment or category…" className="pl-9 h-9" /></div>

      <Card className="rounded-xl border-slate-200 overflow-hidden"><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="text-left font-semibold px-4 py-2.5 sticky left-0 bg-slate-50">Garment</th>
              <th className="text-left font-semibold px-3 py-2.5">Category</th>
              <th className="text-right font-semibold px-3 py-2.5">Avg Wt</th>
              <th className="text-center font-semibold px-3 py-2.5">Sub</th>
              {services.map((s) => <th key={s.id} className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">{s.name}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={4 + services.length} className="py-12 text-center text-slate-400">No garments. Add one or import your pricing sheet.</td></tr>
            ) : filtered.map((g) => (
              <tr key={g.id} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => setEdit(g)}>
                <td className="px-4 py-2.5 font-medium text-slate-800 sticky left-0 bg-white">{g.name}</td>
                <td className="px-3 py-2.5 text-slate-500">{g.categoryName || "—"}</td>
                <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{g.averageWeight != null ? `${g.averageWeight} kg` : "—"}</td>
                <td className="px-3 py-2.5 text-center">{g.subscriptionIncluded ? <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">Yes</Badge> : <span className="text-slate-300">No</span>}</td>
                {services.map((s) => { const c = g.cells[s.id]; const na = !c || c.mode === "NOT_AVAILABLE"; return <td key={s.id} className={`px-3 py-2.5 text-right tabular-nums ${na ? "text-slate-300" : "font-medium text-slate-700"}`}>{cellLabel(c)}</td> })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>

      {edit && <GarmentEditor row={edit === "new" ? null : edit} services={services} categories={categories} businessId={currentBusinessId} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
      {importOpen && <ImportDialog services={services} businessId={currentBusinessId} onTemplate={downloadTemplate} onClose={() => setImportOpen(false)} onImported={() => { setImportOpen(false); load() }} />}
    </div>
  )
}

// ── Garment editor (details + per-service pricing) ──
function GarmentEditor({ row, services, categories, businessId, onClose, onSaved }: { row: GRow | null; services: Svc[]; categories: Cat[]; businessId: string | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(row?.name || "")
  const [categoryId, setCategoryId] = useState(row?.categoryId || "")
  const [avgWeight, setAvgWeight] = useState(row?.averageWeight != null ? String(row.averageWeight) : "")
  const [sub, setSub] = useState(!!row?.subscriptionIncluded)
  const [cells, setCells] = useState<Record<string, { mode: Mode; price: string }>>(() => {
    const m: Record<string, { mode: Mode; price: string }> = {}
    for (const s of services) { const c = row?.cells[s.id]; m[s.id] = { mode: (c?.mode as Mode) || "NOT_AVAILABLE", price: c && c.mode !== "NOT_AVAILABLE" ? String(c.price) : "" } }
    return m
  })
  const [saving, setSaving] = useState(false)
  const setCell = (sid: string, patch: Partial<{ mode: Mode; price: string }>) => setCells((m) => ({ ...m, [sid]: { ...m[sid], ...patch } }))

  const save = async () => {
    if (!name.trim()) { toast.error("Garment name is required"); return }
    for (const s of services) { const c = cells[s.id]; if (c.mode !== "NOT_AVAILABLE" && (c.price === "" || Number(c.price) < 0)) { toast.error(`Enter a valid price for ${s.name}`); return } }
    setSaving(true)
    try {
      let garmentId = row?.id
      if (!garmentId) {
        const j = await fetch("/api/laundry/garments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, name: name.trim(), categoryId: categoryId || null, averageWeight: avgWeight || null, subscriptionIncluded: sub }) }).then((r) => r.json())
        if (!j.success) throw new Error(j.error || "Could not create garment")
        garmentId = j.data.id
      }
      const cellPayload = services.map((s) => ({ serviceId: s.id, mode: cells[s.id].mode, price: cells[s.id].mode === "NOT_AVAILABLE" ? 0 : Number(cells[s.id].price) || 0 }))
      const res = await fetch(`/api/laundry/garments/${garmentId}/pricing`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, categoryId: categoryId || null, averageWeight: avgWeight || null, subscriptionIncluded: sub, cells: cellPayload }) })
      const jj = await res.json()
      if (!res.ok || jj.success === false) throw new Error(jj.error || "Could not save pricing")
      toast.success("Saved"); onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-slate-100"><DialogTitle className="text-[17px]">{row ? "Garment Details" : "New Garment"}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2"><label className="text-sm text-slate-600">Garment Name *</label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-10" placeholder="Shirt" /></div>
            <div className="space-y-1.5"><label className="text-sm text-slate-600">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-2 text-sm bg-white"><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <div className="space-y-1.5"><label className="text-sm text-slate-600">Average Weight (kg)</label><Input type="number" min={0} step="0.05" value={avgWeight} onChange={(e) => setAvgWeight(e.target.value)} className="h-10" placeholder="0.30" /></div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700"><Switch checked={sub} onCheckedChange={setSub} className="data-[state=checked]:bg-emerald-600" /> Subscription Included</label>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Pricing Matrix</p>
            {services.map((s) => {
              const c = cells[s.id]
              return (
                <div key={s.id} className="rounded-lg border border-slate-100 p-3 space-y-2">
                  <p className="text-sm font-medium text-slate-700">{s.name}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    {(["NOT_AVAILABLE", "PER_PIECE", "PER_KG"] as Mode[]).map((m) => (
                      <label key={m} className="flex items-center gap-1.5 text-sm text-slate-600"><input type="radio" checked={c.mode === m} onChange={() => setCell(s.id, { mode: m })} /> {m === "NOT_AVAILABLE" ? "NA" : m === "PER_PIECE" ? "Per Piece" : "Per KG"}</label>
                    ))}
                    {c.mode !== "NOT_AVAILABLE" && <div className="relative w-32 ml-auto"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span><Input type="number" min={0} value={c.price} onChange={(e) => setCell(s.id, { price: e.target.value })} className="h-9 pl-6 text-sm" placeholder={c.mode === "PER_KG" ? "/kg" : "/pc"} /></div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Import dialog (parse + validate + import) ──
function ImportDialog({ services, businessId, onTemplate, onClose, onImported }: { services: Svc[]; businessId: string | null; onTemplate: () => void; onClose: () => void; onImported: () => void }) {
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([])

  const onFile = async (file: File) => {
    setBusy(true); setErrors([])
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
      const rows = json.map((o) => ({
        name: String(o["Garment Name"] ?? ""), category: String(o["Category"] ?? ""), avgWeight: o["Avg Weight"], subscription: String(o["Subscription"] ?? ""),
        cells: services.map((s) => ({ service: s.name, price: o[`${s.name} Price`], billing: String(o[`${s.name} Billing`] ?? "") })),
      }))
      const res = await fetch("/api/laundry/pricing-matrix/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, rows }) })
      const j = await res.json()
      if (res.status === 422 && j.errors) { setErrors(j.errors); toast.error(`${j.errors.length} row error(s) — nothing imported`); return }
      if (!j.success) throw new Error(j.error || "Import failed")
      toast.success(`${j.imported} garment(s) imported`); onImported()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Import failed") } finally { setBusy(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Import Pricing</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-500">Upload an .xlsx or .csv matching the template (dynamic service columns). Every row is validated first — nothing imports unless all rows pass.</p>
        <Button variant="outline" className="gap-1 w-full" onClick={onTemplate}><FileSpreadsheet className="h-4 w-4" /> Download Template</Button>
        <label className={`block rounded-lg border-2 border-dashed p-6 text-center text-sm cursor-pointer ${busy ? "opacity-50" : "border-slate-200 hover:border-blue-300"}`}>
          {busy ? <span className="text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /> Importing…</span> : <span className="text-slate-500"><Upload className="h-5 w-5 inline mb-1" /><br />Click to choose .xlsx / .csv</span>}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
        </label>
        {errors.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-rose-100 bg-rose-50/50 p-2 text-xs space-y-1">
            {errors.map((er, i) => <p key={i} className="text-rose-700">Row {er.row}: {er.message}</p>)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
