"use client"

import { useState, useRef, useCallback } from "react"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import {
  Upload, FileText, Download, CheckCircle2, XCircle, AlertCircle,
  Building2, RefreshCw, ChevronDown, ChevronRight, Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getAuthHeaders } from "@/lib/admin-fetch"

// ── Types ─────────────────────────────────────────────────────────────────────

type ImportRow = Record<string, string>

type ImportResult = {
  row: number
  status: "imported" | "duplicate" | "error"
  reason?: string
  data: ImportRow
}

type ImportSummary = {
  total: number
  imported: number
  duplicates: number
  errors: number
}

// ── Template ──────────────────────────────────────────────────────────────────

function downloadTemplate() {
  const wb = XLSX.utils.book_new()

  const templateRows = [
    ["name *", "slug", "businessType", "contactEmail", "contactPhone",
     "city", "state", "pincode", "address", "gstNumber", "description"],
    ["Business display name", "URL-safe slug (auto-generated if blank)", "See Valid Values sheet",
     "Owner email address", "10-digit mobile number",
     "City name", "State name", "6-digit pincode",
     "Full street address", "GST number (15 chars)", "Short business description"],
    ["FreshMart Grocery", "freshmart-grocery", "GROCERY",
     "owner@freshmart.in", "9876543210",
     "Mumbai", "Maharashtra", "400001",
     "123 Market Street, Fort", "27AADCF1234A1Z5",
     "Fresh grocery and daily essentials"],
    ["TastyBites Food", "tastybites-food", "FOOD_DELIVERY",
     "priya@tastybites.in", "9823456789",
     "Bengaluru", "Karnataka", "560001",
     "45 MG Road, Brigade", "29AABCT1234B1Z3",
     "Cloud kitchen delivering fresh meals"],
    ["AutoGlow Car Wash", "autoglow-carwash", "CAR_WASH",
     "vikram@autoglow.in", "9834567890",
     "Hyderabad", "Telangana", "500001",
     "12 Jubilee Hills Road", "",
     "Premium car & bike wash services"],
    ["SparkleClean Laundry", "sparkleclean-laundry", "LAUNDRY",
     "neha@sparkleclean.in", "9845678901",
     "Delhi", "Delhi", "110001",
     "78 Connaught Place", "",
     "Express laundry & dry cleaning"],
  ]

  const ws1 = XLSX.utils.aoa_to_sheet(templateRows)
  ws1["!cols"] = [
    { wch: 24 }, { wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 16 },
    { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 28 }, { wch: 18 }, { wch: 36 },
  ]
  XLSX.utils.book_append_sheet(wb, ws1, "Businesses")

  const refRows = [
    ["FIELD", "VALID VALUES", "DESCRIPTION"],
    ["businessType", "GROCERY", "Fresh grocery & daily essentials"],
    ["", "FOOD_DELIVERY", "Restaurant & cloud kitchen"],
    ["", "LAUNDRY", "Laundry & dry cleaning"],
    ["", "CAR_WASH", "Car & bike wash services"],
    ["", "PHARMACY", "Medical & pharmacy"],
    ["", "HOME_SERVICES", "Repair & maintenance"],
    ["", "ECOMMERCE", "Online retail store"],
    ["", "COSMETICS", "Beauty & personal care"],
    ["", "MEAT_DELIVERY", "Fresh meat & seafood delivery"],
    ["", "FURNITURE", "Furniture & home decor"],
    ["", "DIRECTORY", "Local business directory"],
    ["", "", ""],
    ["slug", "(auto-generated)", "Leave blank to auto-generate from name. Example: 'Fresh Mart' → 'fresh-mart'"],
    ["gstNumber", "27AADCF1234A1Z5", "15-character GST number (optional)"],
    ["pincode", "400001", "6-digit Indian pincode (optional)"],
    ["contactPhone", "9876543210", "10-digit mobile number without country code (optional)"],
  ]

  const ws2 = XLSX.utils.aoa_to_sheet(refRows)
  ws2["!cols"] = [{ wch: 16 }, { wch: 22 }, { wch: 52 }]
  XLSX.utils.book_append_sheet(wb, ws2, "Valid Values")

  XLSX.writeFile(wb, "quantix_business_import_template.xlsx")
}

function parseFile(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext === "csv") {
      Papa.parse<ImportRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data),
        error: (err) => reject(err),
      })
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array" })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: "" })
          resolve(data)
        } catch (err) { reject(err) }
      }
      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsArrayBuffer(file)
    } else {
      reject(new Error("Unsupported file format. Use .csv, .xlsx, or .xls"))
    }
  })
}

// ── Main Component ────────────────────────────────────────────────────────────

export function BusinessImportView() {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResult[] | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [filterStatus, setFilterStatus] = useState<"all" | "imported" | "duplicate" | "error">("all")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    setResults(null)
    setSummary(null)
    try {
      const rows = await parseFile(f)
      setParsedRows(rows)
      toast.success(`Parsed ${rows.length} rows from ${f.name}`)
      setPreviewOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file")
      setParsedRows([])
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleImport = async () => {
    if (parsedRows.length === 0) return
    setImporting(true)
    try {
      const res = await fetch("/api/admin/import/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ rows: parsedRows }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Import failed")
      setSummary(json.summary)
      setResults(json.results)
      toast.success(`Import complete: ${json.summary.imported} imported, ${json.summary.duplicates} duplicates, ${json.summary.errors} errors`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  const resetUpload = () => {
    setFile(null)
    setParsedRows([])
    setResults(null)
    setSummary(null)
    setPreviewOpen(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const filteredResults = results
    ? filterStatus === "all" ? results : results.filter((r) => r.status === filterStatus)
    : []

  const statusIcon = (s: ImportResult["status"]) => {
    if (s === "imported") return <CheckCircle2 className="size-3.5 text-green-600" />
    if (s === "duplicate") return <AlertCircle className="size-3.5 text-amber-500" />
    return <XCircle className="size-3.5 text-red-500" />
  }

  const statusBadge = (s: ImportResult["status"]) => {
    if (s === "imported") return <Badge className="bg-green-100 text-green-700 text-[10px] h-5">Imported</Badge>
    if (s === "duplicate") return <Badge className="bg-amber-100 text-amber-700 text-[10px] h-5">Duplicate</Badge>
    return <Badge className="bg-red-100 text-red-700 text-[10px] h-5">Error</Badge>
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="size-5 text-primary" />
          <h1 className="text-xl font-bold">Business Data Upload</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Bulk-create business profiles from CSV or Excel. Each row is checked for duplicates before inserting.
        </p>
      </div>

      {/* Step 1 — Template */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Step 1 — Download Template</CardTitle>
          <CardDescription className="text-xs">
            Download the Excel template — it includes a header row, field hints, example rows, and a Valid Values reference sheet. Supported upload formats: .csv, .xlsx, .xls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadTemplate}>
            <Download className="size-3.5" /> Download Excel Template (.xlsx)
          </Button>
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs font-medium">Required columns</p>
            <p className="text-[11px] text-muted-foreground font-mono">name</p>
            <p className="text-xs font-medium mt-2">Optional columns</p>
            <p className="text-[11px] text-muted-foreground font-mono">
              slug, businessType, contactEmail, contactPhone, city, state, pincode, address, gstNumber, description
            </p>
            <p className="text-xs font-medium mt-2">businessType values</p>
            <p className="text-[11px] text-muted-foreground">
              GROCERY, FOOD_DELIVERY, LAUNDRY, CAR_WASH, PHARMACY, HOME_SERVICES, ECOMMERCE, COSMETICS, MEAT_DELIVERY, FURNITURE, DIRECTORY
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] text-amber-800 font-medium">Duplicate detection</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Rows are skipped if a business with the same <strong>slug</strong> or <strong>contactEmail</strong> already exists.
              If no slug is provided, one is auto-generated from the name.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Step 2 — Upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Step 2 — Upload File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <FileText className="size-8 mx-auto mb-2 text-muted-foreground" />
            {file ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{parsedRows.length} rows parsed</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium">Drop your file here or click to browse</p>
                <p className="text-xs text-muted-foreground">CSV, XLSX, or XLS — up to 500 businesses per import</p>
              </div>
            )}
          </div>

          {file && parsedRows.length > 0 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPreviewOpen(!previewOpen)}>
                {previewOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                Preview ({Math.min(5, parsedRows.length)} of {parsedRows.length} rows)
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={resetUpload}>Clear</Button>
            </div>
          )}

          {previewOpen && parsedRows.length > 0 && (
            <ScrollArea className="h-40 rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(parsedRows[0]).slice(0, 6).map((h) => (
                      <TableHead key={h} className="text-[11px] whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {Object.values(row).slice(0, 6).map((v, j) => (
                        <TableCell key={j} className="text-xs max-w-[120px] truncate">{String(v)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Step 3 — Import */}
      {parsedRows.length > 0 && !results && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Step 3 — Run Import</CardTitle>
            <CardDescription className="text-xs">
              New businesses are created with status <strong>ONBOARDING</strong>. Existing businesses (matched by slug or email) are skipped.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleImport} disabled={importing} className="gap-2">
              {importing
                ? <><Loader2 className="size-4 animate-spin" /> Importing…</>
                : <><Upload className="size-4" /> Import {parsedRows.length} Businesses</>
              }
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {summary && results && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Import Results</CardTitle>
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={resetUpload}>
                <RefreshCw className="size-3" /> New Import
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total", value: summary.total, color: "text-foreground" },
                { label: "Imported", value: summary.imported, color: "text-green-600" },
                { label: "Duplicates", value: summary.duplicates, color: "text-amber-600" },
                { label: "Errors", value: summary.errors, color: "text-red-600" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border p-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Filter pills */}
            <div className="flex gap-2">
              {(["all", "imported", "duplicate", "error"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filterStatus === f ? "default" : "outline"}
                  className="h-7 text-xs capitalize"
                  onClick={() => setFilterStatus(f)}
                >
                  {f === "all" ? `All (${results.length})` : `${f} (${results.filter((r) => r.status === f).length})`}
                </Button>
              ))}
            </div>

            {/* Results table */}
            <ScrollArea className="h-72 rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] w-12">#</TableHead>
                    <TableHead className="text-[11px]">Status</TableHead>
                    <TableHead className="text-[11px]">Business Name</TableHead>
                    <TableHead className="text-[11px]">Type</TableHead>
                    <TableHead className="text-[11px]">Email</TableHead>
                    <TableHead className="text-[11px]">City</TableHead>
                    <TableHead className="text-[11px]">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((r) => (
                    <TableRow key={r.row} className={
                      r.status === "imported" ? "bg-green-50/50"
                      : r.status === "duplicate" ? "bg-amber-50/50"
                      : "bg-red-50/50"
                    }>
                      <TableCell className="text-xs text-muted-foreground">{r.row}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {statusIcon(r.status)}
                          {statusBadge(r.status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium max-w-[140px] truncate">{r.data.name as string}</TableCell>
                      <TableCell className="text-xs">{r.data.businessType as string || "—"}</TableCell>
                      <TableCell className="text-xs max-w-[160px] truncate">{r.data.contactEmail as string || "—"}</TableCell>
                      <TableCell className="text-xs">{r.data.city as string || "—"}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground max-w-[200px] truncate">{r.reason || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
