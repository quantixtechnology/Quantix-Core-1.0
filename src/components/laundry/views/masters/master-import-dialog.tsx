"use client"

// Bulk Import / Load Templates — lets an owner load hundreds of garments,
// categories and services in one click (industry template) or paste their own
// garment list (CSV). Calls /api/laundry/masters/bulk-import which dedupes by
// name, so importing is always safe to repeat.

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Download, Sparkles, FileSpreadsheet, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { LAUNDRY_TEMPLATES } from "@/lib/laundry-templates"

interface ImportResult { categoriesCreated: number; servicesCreated: number; garmentsCreated: number; skipped: number }

// CSV: name,category,unit(PIECE|KG),avgWeight  — one garment per line.
function parseGarmentCsv(text: string) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const [name, category, unit, avg] = line.split(",").map((s) => s?.trim())
    return { name, category: category || undefined, defaultUnit: (unit || "PIECE").toUpperCase() === "KG" ? "KG" : "PIECE", averageWeight: avg ? Number(avg) : undefined, code: "", displayOrder: 0 }
  }).filter((g) => g.name)
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
  const template = LAUNDRY_TEMPLATES[0]

  const run = async (body: Record<string, unknown>) => {
    setBusy(true); setResult(null)
    try {
      const res = await fetch("/api/laundry/masters/bulk-import", {
        method: "POST", headers: { "Content-Type": "application/json" },
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Download className="h-4 w-4" /> Bulk Import Master Data</DialogTitle>
          <DialogDescription>Load a ready-made industry template or import your own garment list. Existing items are skipped automatically.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="template">
          <TabsList className="w-full">
            <TabsTrigger value="template" className="flex-1 gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Templates</TabsTrigger>
            <TabsTrigger value="csv" className="flex-1 gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" /> CSV / Excel</TabsTrigger>
          </TabsList>

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
          </TabsContent>

          <TabsContent value="csv" className="space-y-3 pt-3">
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
