"use client"

// Bulk Customer Creation — download a template, upload a filled file, review
// every row, then import. Purely additive: the single-customer form, the list
// and every other customer flow are untouched, and the import calls the same
// creation path they do.
//
// The browser parses the file (the same way Categories, Pricing and the CRM
// lead import already do) and sends rows; the server decides what is importable.
import { useCallback, useRef, useState } from "react"
import * as XLSX from "xlsx"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Download, Upload, CheckCircle2, AlertTriangle, XCircle, Users } from "lucide-react"
import { toast } from "sonner"
import {
  templateHeaders, templateExampleRow, MAX_IMPORT_ROWS,
  type RowVerdict, type ImportSummary,
} from "@/lib/laundry-customer-import"

type Step = "start" | "preview" | "done"

const STATUS_UI: Record<string, { icon: typeof CheckCircle2; cls: string; label: string }> = {
  VALID: { icon: CheckCircle2, cls: "text-emerald-600", label: "Valid" },
  DUPLICATE: { icon: AlertTriangle, cls: "text-amber-600", label: "Already exists" },
  INVALID: { icon: XCircle, cls: "text-rose-600", label: "Invalid" },
}

export function LaundryCustomerImportDialog({
  businessId, open, onClose, onImported,
}: {
  businessId: string
  open: boolean
  onClose: () => void
  onImported: () => void
}) {
  const [step, setStep] = useState<Step>("start")
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [verdicts, setVerdicts] = useState<RowVerdict[]>([])
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [created, setCreated] = useState(0)
  const [progress, setProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep("start"); setRows([]); setVerdicts([]); setSummary(null)
    setCreated(0); setFileName(""); setProgress(0)
    if (fileRef.current) fileRef.current.value = ""
  }, [])

  const close = () => { reset(); onClose() }

  // ── 1. Template ───────────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([templateExampleRow()], { header: templateHeaders() })
    ws["!cols"] = templateHeaders().map((h) => ({ wch: Math.max(16, h.length + 2) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Customers")
    XLSX.writeFile(wb, "customer-import-template.xlsx")
    toast.success("Template downloaded — the example row is ignored on import")
  }

  // ── 2. Upload + validate (creates nothing) ────────────────────────────────
  const onFile = async (file: File) => {
    setBusy(true)
    setFileName(file.name)
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
      if (parsed.length === 0) { toast.error("That file has no rows."); return }
      if (parsed.length > MAX_IMPORT_ROWS) {
        toast.error(`That file has ${parsed.length} rows. Import up to ${MAX_IMPORT_ROWS} at a time.`)
        return
      }
      setRows(parsed)
      const j = await post("validate", parsed)
      if (!j) return
      setVerdicts(j.rows); setSummary(j.summary); setStep("preview")
    } catch {
      toast.error("Could not read that file. Use the downloaded template.")
    } finally { setBusy(false) }
  }

  const post = async (mode: "validate" | "commit", payload: Record<string, unknown>[]) => {
    const res = await fetch("/api/laundry/customers/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, mode, rows: payload }),
    })
    const j = await res.json()
    if (!res.ok || !j.success) { toast.error(j.error || "Import failed"); return null }
    return j as { rows: RowVerdict[]; summary: ImportSummary; created?: number }
  }

  // ── 3. Import (explicit) ──────────────────────────────────────────────────
  const runImport = async () => {
    setBusy(true); setProgress(0)
    // The server commits in one call; this reflects that it is working rather
    // than pretending to know a per-row position it cannot see.
    const tick = setInterval(() => setProgress((p) => Math.min(p + 7, 95)), 200)
    try {
      const j = await post("commit", rows)
      if (!j) return
      setProgress(100)
      setVerdicts(j.rows); setSummary(j.summary); setCreated(j.created ?? 0)
      setStep("done")
      onImported()
    } finally { clearInterval(tick); setBusy(false) }
  }

  // ── 4. Error report ───────────────────────────────────────────────────────
  const downloadErrors = () => {
    const rejected = verdicts.filter((v) => v.status !== "VALID")
    const ws = XLSX.utils.json_to_sheet(rejected.map((v) => ({
      Row: v.row, "Customer Name": v.name, Mobile: v.mobile, Email: v.email,
      Status: STATUS_UI[v.status]?.label || v.status, Reason: v.reason || "",
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Rejected")
    XLSX.writeFile(wb, "customer-import-errors.xlsx")
  }

  const validCount = summary?.valid ?? 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" /> Bulk Customer Creation
          </DialogTitle>
        </DialogHeader>

        {step === "start" && (
          <div className="space-y-4 py-2">
            <ol className="text-sm text-slate-600 space-y-1.5 list-decimal list-inside">
              <li>Download the template and fill in your customers.</li>
              <li>Upload it — every row is checked before anything is created.</li>
              <li>Review the preview, then import.</li>
            </ol>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={downloadTemplate} className="gap-1.5 flex-1">
                <Download className="h-4 w-4" /> Download Template
              </Button>
              <Button onClick={() => fileRef.current?.click()} disabled={busy} className="gap-1.5 flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Customer File
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f) }} />
            </div>
            <p className="text-[11px] text-slate-400">
              .xlsx or .csv · up to {MAX_IMPORT_ROWS} customers per file · Customer Name and Mobile are required ·
              a customer whose mobile already exists is skipped, never overwritten.
            </p>
          </div>
        )}

        {step === "preview" && summary && (
          <div className="space-y-3 py-1">
            <p className="text-xs text-slate-500 font-mono">{fileName}</p>
            <SummaryRow summary={summary} />
            <VerdictTable verdicts={verdicts} />
            {busy && (
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Importing customers… {progress}%</p>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
              <Button onClick={runImport} disabled={busy || validCount === 0} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Import {validCount} Valid Customer{validCount === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && summary && (
          <div className="space-y-3 py-1">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-sm font-semibold text-emerald-800">Import complete</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Created: {created} · Skipped duplicates: {summary.duplicates} · Failed validation: {summary.invalid}
              </p>
            </div>
            <VerdictTable verdicts={verdicts} />
            <div className="flex justify-end gap-2 pt-1">
              {summary.duplicates + summary.invalid > 0 && (
                <Button variant="outline" onClick={downloadErrors} className="gap-1.5">
                  <Download className="h-4 w-4" /> Download Error Report
                </Button>
              )}
              <Button onClick={close} className="bg-blue-600 hover:bg-blue-700 text-white">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SummaryRow({ summary }: { summary: ImportSummary }) {
  const cells = [
    { label: "Total Rows", value: summary.total, cls: "text-slate-700" },
    { label: "Valid", value: summary.valid, cls: "text-emerald-600" },
    { label: "Duplicates", value: summary.duplicates, cls: "text-amber-600" },
    { label: "Invalid", value: summary.invalid, cls: "text-rose-600" },
  ]
  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map((c) => (
        <div key={c.label} className="rounded-lg border border-slate-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">{c.label}</p>
          <p className={`text-lg font-bold ${c.cls}`}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}

function VerdictTable({ verdicts }: { verdicts: RowVerdict[] }) {
  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">Row</th>
            <th className="px-2 py-1.5 text-left font-medium">Name</th>
            <th className="px-2 py-1.5 text-left font-medium">Mobile</th>
            <th className="px-2 py-1.5 text-left font-medium">Email</th>
            <th className="px-2 py-1.5 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {verdicts.map((v) => {
            const ui = STATUS_UI[v.status] || STATUS_UI.INVALID
            const Icon = ui.icon
            return (
              <tr key={v.row}>
                <td className="px-2 py-1.5 text-slate-400 font-mono">{v.row}</td>
                <td className="px-2 py-1.5 text-slate-700">{v.name || "—"}</td>
                <td className="px-2 py-1.5 font-mono text-slate-600">{v.mobile || "—"}</td>
                <td className="px-2 py-1.5 text-slate-500">{v.email || "—"}</td>
                <td className="px-2 py-1.5">
                  <span className={`inline-flex items-center gap-1 font-medium ${ui.cls}`}>
                    <Icon className="h-3.5 w-3.5 shrink-0" /> {ui.label}
                  </span>
                  {v.reason && <p className="text-[10px] text-slate-400 mt-0.5">{v.reason}</p>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {verdicts.length === 0 && <p className="py-6 text-center text-xs text-slate-400">No rows.</p>}
    </div>
  )
}

