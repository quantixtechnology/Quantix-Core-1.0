"use client"

// Bulk Import / Export Master Data.
//
// Four ways in and one way out, all of them explicit:
//   Templates   — load the curated industry master in one click
//   Import File — drop a real .xlsx/.csv, see what it contains, then import
//   Paste       — the original quick path, unchanged
//   Export      — this tenant's own master data, as a workbook you can edit
//
// The file half is the point: a user with a spreadsheet should not have to
// retype it into a textarea. Download → edit in Excel → upload → preview →
// import, and Export produces a file this same importer accepts, so the round
// trip closes.
//
// Nothing new is invented server-side: every path posts to the existing
// /api/laundry/masters/bulk-import, which already dedupes by name and is
// already tenant-scoped and permission-guarded. The column contract lives in
// lib/laundry-master-workbook so the template that is written and the file
// that is read cannot disagree.

import { useState, useRef, useCallback } from "react"
import * as XLSX from "xlsx"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Download, Sparkles, FileSpreadsheet, CheckCircle2, Upload, AlertTriangle, FileDown, X } from "lucide-react"
import { toast } from "sonner"
import { LAUNDRY_TEMPLATES } from "@/lib/laundry-templates"
import { getAuthHeaders } from "@/lib/admin-fetch"
import {
  SHEET, COLUMNS, EXAMPLE_ROWS, parseMasterWorkbook, newRecordCount,
  type ParseResult, type ExistingNames,
} from "@/lib/laundry-master-workbook"

interface ImportResult { categoriesCreated: number; servicesCreated: number; garmentsCreated: number; skipped: number }

// CSV: name,category,unit(PIECE|KG),avgWeight — one garment per line.
function parseGarmentCsv(text: string) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const [name, category, unit, avg] = line.split(",").map((s) => s?.trim())
    return { name, category: category || undefined, defaultUnit: (unit || "PIECE").toUpperCase() === "KG" ? "KG" : "PIECE", averageWeight: avg ? Number(avg) : undefined, code: "", displayOrder: 0 }
  }).filter((g) => g.name)
}

/** Write the three sheets as one .xlsx. */
function writeWorkbook(filename: string, rows: { categories: unknown[][]; services: unknown[][]; garments: unknown[][] }) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...COLUMNS.categories], ...rows.categories]), SHEET.categories)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...COLUMNS.services], ...rows.services]), SHEET.services)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...COLUMNS.garments], ...rows.garments]), SHEET.garments)
  XLSX.writeFile(wb, filename)
}

export function MasterImportDialog({
  open, onClose, businessId, onImported,
}: {
  open: boolean
  onClose: () => void
  businessId: string
  onImported: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [csv, setCsv] = useState("")
  const [result, setResult] = useState<ImportResult | null>(null)
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const template = LAUNDRY_TEMPLATES[0]

  const run = async (body: Record<string, unknown>) => {
    setBusy(true); setResult(null)
    try {
      const res = await fetch("/api/laundry/masters/bulk-import", {
        method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ businessId, ...body }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || "Import failed")
      setResult(json)
      const created = json.categoriesCreated + json.servicesCreated + json.garmentsCreated
      toast.success(`Imported ${created} item(s)${json.skipped ? `, ${json.skipped} skipped (already exist)` : ""}`)
      onImported()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed")
    } finally { setBusy(false) }
  }

  const importCsv = () => {
    const garments = parseGarmentCsv(csv)
    if (garments.length === 0) { toast.error("No valid rows found"); return }
    run({ data: { garments } })
  }

  // ── Templates ─────────────────────────────────────────────────────────────
  const downloadBlank = () => {
    writeWorkbook("laundry-master-template.xlsx", { categories: [], services: [], garments: [] })
    toast.success("Blank template downloaded")
  }

  const downloadExample = () => {
    writeWorkbook("laundry-master-example.xlsx", {
      categories: EXAMPLE_ROWS.categories.map((r) => [...r]),
      services: EXAMPLE_ROWS.services.map((r) => [...r]),
      garments: EXAMPLE_ROWS.garments.map((r) => [...r]),
    })
    toast.success("Example template downloaded")
  }

  /** The curated industry master as a workbook, so it can be edited first. */
  const downloadStandard = () => {
    writeWorkbook(`${template.id.toLowerCase()}-master.xlsx`, {
      categories: template.categories.map((c) => [c.name, c.code, c.color, c.defaultGstPercent ?? "", c.displayOrder]),
      services: template.services.map((s) => [s.name, s.code, s.category ?? "", s.defaultPricingType, s.defaultTurnaroundHours, s.expressAvailable ? "Yes" : "No", s.subscriptionEligible ? "Yes" : "No", s.displayOrder]),
      garments: template.garments.map((g) => [g.name, g.code, g.category, g.defaultUnit, g.averageWeight ?? "", g.material ?? "", g.displayOrder]),
    })
    toast.success(`${template.label} downloaded`)
  }

  // ── Export this tenant's own data ─────────────────────────────────────────
  // Scoped by businessId through the same guarded list endpoints the masters
  // screens use — one tenant's export can only ever contain its own rows.
  const exportMasters = async () => {
    setBusy(true)
    try {
      const [cats, svcs, grms] = await Promise.all(
        ["categories", "services", "garments"].map(async (kind) => {
          const res = await fetch(`/api/laundry/${kind}?businessId=${encodeURIComponent(businessId)}`, { headers: getAuthHeaders() })
          const json = await res.json()
          if (!res.ok || json.success === false) throw new Error(json.error || `Could not read ${kind}`)
          return (json.data ?? []) as Record<string, unknown>[]
        }),
      )
      // Business-readable values only — no database ids leave the building.
      writeWorkbook("laundry-master-data.xlsx", {
        categories: cats.map((c) => [c.name ?? "", c.code ?? "", c.color ?? "", c.defaultGstPercent ?? "", c.displayOrder ?? 0]),
        services: svcs.map((s) => [s.name ?? "", s.code ?? "", (s.category as { name?: string } | null)?.name ?? "", s.defaultPricingType ?? "", s.defaultTurnaroundHours ?? "", s.expressAvailable ? "Yes" : "No", s.subscriptionEligible ? "Yes" : "No", s.displayOrder ?? 0]),
        garments: grms.map((g) => [g.name ?? "", g.code ?? "", (g.category as { name?: string } | null)?.name ?? "", g.defaultUnit ?? "PIECE", g.averageWeight ?? "", g.material ?? "", g.displayOrder ?? 0]),
      })
      toast.success(`Exported ${cats.length} categories, ${svcs.length} services, ${grms.length} garments`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    } finally { setBusy(false) }
  }

  // ── File → preview ────────────────────────────────────────────────────────
  const readFile = useCallback(async (file: File) => {
    const ok = /\.(csv|xlsx|xls)$/i.test(file.name)
    if (!ok) { toast.error("Choose a .csv, .xls or .xlsx file"); return }
    setBusy(true); setResult(null); setPreview(null)
    try {
      const wb = XLSX.read(await file.arrayBuffer())
      const sheetRows = (name: string) => {
        const found = wb.SheetNames.find((n) => n.trim().toLowerCase() === name.toLowerCase())
        return found ? XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[found], { defval: "" }) : undefined
      }
      // A CSV has one nameless sheet. Treated as Garments, which is what a
      // single-sheet laundry master almost always is — and what the paste box
      // has always accepted.
      const named = { categories: sheetRows(SHEET.categories), services: sheetRows(SHEET.services), garments: sheetRows(SHEET.garments) }
      const sheets = (named.categories || named.services || named.garments)
        ? named
        : { garments: XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" }) }

      // What the tenant already has, so the preview can say what will be
      // skipped rather than making the user find out afterwards.
      const existing: ExistingNames = { categories: [], services: [], garments: [] }
      await Promise.all((["categories", "services", "garments"] as const).map(async (kind) => {
        try {
          const res = await fetch(`/api/laundry/${kind}?businessId=${encodeURIComponent(businessId)}`, { headers: getAuthHeaders() })
          const json = await res.json()
          existing[kind] = ((json.data ?? []) as { name?: string }[]).map((r) => r.name ?? "").filter(Boolean)
        } catch { /* a failed read just means nothing is reported as existing */ }
      }))

      const parsed = parseMasterWorkbook(sheets, existing)
      setFileName(file.name)
      setPreview(parsed)
      if (newRecordCount(parsed) === 0 && parsed.errors.length === 0) toast.info("Nothing new in this file — every row already exists")
    } catch {
      toast.error("That file could not be read as a spreadsheet")
    } finally { setBusy(false) }
  }, [businessId])

  const importPreview = () => {
    if (!preview) return
    run({ data: { categories: preview.categories, services: preview.services, garments: preview.garments } })
  }

  const clearPreview = () => { setPreview(null); setFileName(""); if (fileInput.current) fileInput.current.value = "" }

  const counts = preview?.counts
  const blocking = preview?.errors.filter((e) => !e.message.includes("will be imported without")) ?? []
  const warnings = preview?.errors.filter((e) => e.message.includes("will be imported without")) ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Download className="h-4 w-4" /> Bulk Import Master Data</DialogTitle>
          <DialogDescription>Load a ready-made industry master, upload your own spreadsheet, or export what this business already has. Existing items are skipped automatically.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="template">
          <TabsList className="w-full">
            <TabsTrigger value="template" className="flex-1 gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Templates</TabsTrigger>
            <TabsTrigger value="file" className="flex-1 gap-1.5"><Upload className="h-3.5 w-3.5" /> Import File</TabsTrigger>
            <TabsTrigger value="paste" className="flex-1 gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" /> Paste</TabsTrigger>
            <TabsTrigger value="export" className="flex-1 gap-1.5"><FileDown className="h-3.5 w-3.5" /> Export</TabsTrigger>
          </TabsList>

          {/* ── Templates ───────────────────────────────────────────────── */}
          <TabsContent value="template" className="space-y-3 pt-3">
            <div className="rounded-lg border p-3">
              <p className="font-medium text-sm">{template.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">{template.categories.length} categories</Badge>
                <Badge variant="outline">{template.services.length} services</Badge>
                <Badge variant="outline">{template.garments.length} garments</Badge>
              </div>
            </div>
            <Button onClick={() => run({ template: template.id })} disabled={busy} className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Load “{template.label}”
            </Button>
            <Button onClick={downloadStandard} variant="outline" className="w-full gap-2">
              <FileDown className="h-4 w-4" /> Download Template
            </Button>
            <p className="text-[11px] text-muted-foreground">Downloads the same master as a workbook — edit it first, then bring it back through Import File.</p>
          </TabsContent>

          {/* ── Import File ─────────────────────────────────────────────── */}
          <TabsContent value="file" className="space-y-3 pt-3">
            {!preview ? (
              <>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) readFile(f) }}
                  onClick={() => fileInput.current?.click()}
                  className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${dragging ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  {busy ? (
                    <p className="text-sm text-slate-500 flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Reading…</p>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mx-auto text-slate-400" />
                      <p className="mt-2 text-sm font-medium text-slate-700">Upload CSV / Excel</p>
                      <p className="text-xs text-slate-500 mt-0.5">Drag &amp; drop your file here, or</p>
                      <span className="mt-2 inline-flex items-center h-9 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium">Choose File</span>
                      <p className="text-[11px] text-slate-400 mt-2">CSV, XLS, XLSX</p>
                    </>
                  )}
                  <input ref={fileInput} type="file" accept=".csv,.xls,.xlsx" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f) }} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={downloadBlank} variant="outline" className="flex-1 gap-2 text-xs"><FileDown className="h-3.5 w-3.5" /> Download Blank Template</Button>
                  <Button onClick={downloadExample} variant="outline" className="flex-1 gap-2 text-xs"><FileDown className="h-3.5 w-3.5" /> Download Example Template</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Three sheets: <b>{SHEET.categories}</b>, <b>{SHEET.services}</b>, <b>{SHEET.garments}</b>. A single-sheet CSV is read as garments.
                </p>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{fileName}</p>
                  <Button variant="ghost" size="sm" onClick={clearPreview} className="gap-1 text-xs"><X className="h-3.5 w-3.5" /> Choose another</Button>
                </div>

                <div className="rounded-lg border">
                  <p className="px-3 py-2 text-xs font-semibold border-b bg-slate-50">Import Preview</p>
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr><th className="text-left px-3 py-1.5 font-medium">Sheet</th><th className="px-3 font-medium">Rows</th><th className="px-3 font-medium">New</th><th className="px-3 font-medium">Already exists</th><th className="px-3 font-medium">Invalid</th></tr>
                    </thead>
                    <tbody>
                      {([["Categories", counts!.categories], ["Services", counts!.services], ["Garments", counts!.garments]] as const).map(([label, c]) => (
                        <tr key={label} className="border-t">
                          <td className="px-3 py-1.5">{label}</td>
                          <td className="px-3 text-center">{c.total}</td>
                          <td className="px-3 text-center font-semibold text-emerald-700">{c.new}</td>
                          <td className="px-3 text-center text-slate-500">{c.existing}</td>
                          <td className={`px-3 text-center ${c.invalid ? "font-semibold text-red-600" : "text-slate-400"}`}>{c.invalid}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {blocking.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 max-h-40 overflow-y-auto">
                    <p className="text-xs font-semibold text-red-800 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> {blocking.length} row(s) cannot be imported</p>
                    <ul className="mt-1.5 space-y-0.5 text-[11px] text-red-700">
                      {blocking.slice(0, 25).map((e, i) => <li key={i}>{e.sheet} row {e.row} · {e.field}: {e.message}</li>)}
                      {blocking.length > 25 && <li className="text-red-500">…and {blocking.length - 25} more</li>}
                    </ul>
                  </div>
                )}

                {warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 max-h-32 overflow-y-auto">
                    <p className="text-xs font-semibold text-amber-800">{warnings.length} warning(s)</p>
                    <ul className="mt-1.5 space-y-0.5 text-[11px] text-amber-700">
                      {warnings.slice(0, 15).map((e, i) => <li key={i}>{e.sheet} row {e.row} · {e.message}</li>)}
                    </ul>
                  </div>
                )}

                <Button onClick={importPreview} disabled={busy || newRecordCount(preview) === 0} className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import {newRecordCount(preview)} Records
                </Button>
                {newRecordCount(preview) === 0 && <p className="text-[11px] text-center text-muted-foreground">Nothing new to import from this file.</p>}
              </div>
            )}
          </TabsContent>

          {/* ── Paste (unchanged) ───────────────────────────────────────── */}
          <TabsContent value="paste" className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label className="text-xs">Paste garments — one per line: <code className="text-[11px]">name, category, unit (PIECE/KG), avg weight</code></Label>
              <Textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder={"Shirt, Laundry, PIECE, 0.2\nBlanket, Household, PIECE, 2\nMixed Wash, Laundry, KG, 1"}
                className="min-h-[140px] font-mono text-xs"
              />
            </div>
            <Button onClick={importCsv} disabled={busy || !csv.trim()} className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Import Pasted Garments
            </Button>
          </TabsContent>

          {/* ── Export ──────────────────────────────────────────────────── */}
          <TabsContent value="export" className="space-y-3 pt-3">
            <div className="rounded-lg border p-3">
              <p className="font-medium text-sm">This business&rsquo;s master data</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Categories, Services and Garments as they are now — three sheets in one workbook, using names and codes rather than internal ids. Edit it and bring it back through Import File.
              </p>
            </div>
            <Button onClick={exportMasters} disabled={busy} className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Export Master Data
            </Button>
          </TabsContent>
        </Tabs>

        {result && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5" />
            <div>
              Imported {result.categoriesCreated} categories, {result.servicesCreated} services, {result.garmentsCreated} garments.
              {result.skipped > 0 && <span className="block text-emerald-700/80">{result.skipped} already existed and were skipped.</span>}
            </div>
          </div>
        )}

        <DialogFooter><Button variant="outline" onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
