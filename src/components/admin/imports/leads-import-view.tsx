"use client"

import { useState, useRef, useCallback } from "react"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import {
  Upload, FileText, Download, CheckCircle2, XCircle, AlertCircle,
  Plug, Plus, Trash2, Eye, EyeOff, RefreshCw, ChevronDown, ChevronRight,
  Users, Loader2, FileDown, Lock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { useAuthStore } from "@/stores/auth-store"

// ── Types ─────────────────────────────────────────────────────────────────────

type ImportRow = Record<string, string>

type ImportResult = {
  row: number
  status: "imported" | "updated" | "duplicate" | "error"
  leadId?: string
  reason?: string
  data: ImportRow
}

type ImportSummary = {
  total: number
  imported: number
  updated: number
  duplicates: number
  errors: number
}

type CrmIntegration = {
  id: string
  name: string
  description?: string
  apiUrl: string
  authType: "api_key" | "bearer_token" | "basic_auth" | "oauth2"
  authValue: string
  authSecret?: string
  fieldMapping: Record<string, string>
  syncDirection: "inbound" | "outbound" | "both"
  isActive: boolean
  lastSyncAt?: string
  lastSyncStatus?: "success" | "error" | "never"
  createdAt: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const IMPORT_FIELD_HEADERS = [
  "leadId", "businessName", "contactName", "contactEmail", "contactPhone",
  "city", "state", "pincode", "businessType", "source", "stage",
  "estimatedValue", "notes", "followUpDate", "tags", "salesRepName",
]

const BUSINESS_TYPE_OPTIONS = [
  "GROCERY", "FOOD_DELIVERY", "LAUNDRY", "CAR_WASH", "PHARMACY",
  "HOME_SERVICES", "ECOMMERCE", "COSMETICS", "MEAT_DELIVERY", "FURNITURE", "DIRECTORY",
]

const SOURCE_OPTIONS = [
  "META_ADS", "GOOGLE_ADS", "DIRECT_REFERRAL", "WEBSITE_INQUIRY",
  "COLD_OUTREACH", "WHATSAPP_INQUIRY", "PHONE_CALL", "OTHER",
]

const STAGE_OPTIONS = [
  "LEAD", "FOLLOW_UP", "INTERESTED", "HOT_LEAD",
  "DEMO_PLANNED", "DEMO_DONE", "NEGOTIATION",
  "PAYMENT_PENDING", "PAYMENT_RECEIVED", "CLOSED_WON",
  "NOT_INTERESTED", "WRONG_NUMBER", "RNR", "LOST", "DUPLICATE",
]

const STAGE_LABELS: Record<string, string> = {
  LEAD: "Lead", FOLLOW_UP: "Follow Up", INTERESTED: "Interested", HOT_LEAD: "Hot Lead",
  DEMO_PLANNED: "Demo Planned", DEMO_DONE: "Demo Done", NEGOTIATION: "Negotiation",
  PAYMENT_PENDING: "Payment Pending", PAYMENT_RECEIVED: "Payment Received",
  CLOSED_WON: "Closed Won", NOT_INTERESTED: "Not Interested", WRONG_NUMBER: "Wrong Number",
  RNR: "RNR", LOST: "Lost", DUPLICATE: "Duplicate",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function downloadTemplate() {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Leads data entry ──────────────────────────────────────────────
  const templateRows = [
    // Row 1 — column headers (* = required; leadId = optional upsert key)
    [
      "leadId", "businessName *", "contactName *", "contactEmail *", "contactPhone *",
      "city", "state", "pincode", "businessType", "source", "stage",
      "estimatedValue", "notes", "followUpDate", "tags", "salesRepName",
    ],
    // Row 2 — field description / hint
    [
      "Leave blank for new leads; fill LED-YYYYMM-XXXX to update existing",
      "Business name", "Contact person name", "Email address", "10-digit mobile",
      "City", "State", "Pincode", "See Valid Values sheet", "See Valid Values sheet", "See Valid Values sheet",
      "Yearly value (INR)", "Any notes or remarks", "YYYY-MM-DD format", "comma-separated", "Salesperson full name",
    ],
    // Rows 3-6 — example data (delete before uploading)
    [
      "", "FreshMart Grocery", "Rahul Sharma", "rahul@freshmart.in", "9812345678",
      "Mumbai", "Maharashtra", "400001", "GROCERY", "WEBSITE_INQUIRY", "LEAD",
      "59988", "Interested in Standard plan", "2026-06-01", "grocery,fresh", "Arun Kumar",
    ],
    [
      "", "TastyBites Food", "Priya Patel", "priya@tastybites.in", "9823456789",
      "Bengaluru", "Karnataka", "560001", "FOOD_DELIVERY", "META_ADS", "HOT_LEAD",
      "119988", "Very interested, scheduled demo", "2026-06-10", "restaurant", "Sanjay Mehta",
    ],
    [
      "", "AutoGlow Car Wash", "Vikram Singh", "vikram@autoglow.in", "9834567890",
      "Hyderabad", "Telangana", "500001", "CAR_WASH", "DIRECT_REFERRAL", "NEGOTIATION",
      "59988", "Negotiating pricing", "2026-06-15", "carwash", "",
    ],
    [
      "LED-202605-0012", "SparkleClean Laundry", "Neha Gupta", "neha@sparkleclean.in", "9845678901",
      "Delhi", "Delhi", "110001", "LAUNDRY", "COLD_OUTREACH", "PAYMENT_PENDING",
      "59988", "Payment link sent", "", "laundry", "",
    ],
  ]

  const ws1 = XLSX.utils.aoa_to_sheet(templateRows)
  ws1["!cols"] = [
    { wch: 20 }, { wch: 24 }, { wch: 20 }, { wch: 28 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 22 }, { wch: 18 },
    { wch: 16 }, { wch: 32 }, { wch: 14 }, { wch: 20 }, { wch: 22 },
  ]
  XLSX.utils.book_append_sheet(wb, ws1, "Leads")

  // ── Sheet 2: Valid Values reference ────────────────────────────────────────
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
    ["source", "META_ADS", "Facebook / Instagram ads"],
    ["", "GOOGLE_ADS", "Google ads"],
    ["", "DIRECT_REFERRAL", "Referral from existing client"],
    ["", "WEBSITE_INQUIRY", "Inquiry from website form"],
    ["", "COLD_OUTREACH", "Sales team outreach"],
    ["", "WHATSAPP_INQUIRY", "WhatsApp inquiry"],
    ["", "PHONE_CALL", "Direct phone call"],
    ["", "OTHER", "Any other source"],
    ["", "", ""],
    ["stage", "LEAD", "Initial lead (default)"],
    ["", "FOLLOW_UP", "Scheduled for follow-up call"],
    ["", "INTERESTED", "Lead has shown interest"],
    ["", "HOT_LEAD", "High intent — close to converting"],
    ["", "DEMO_PLANNED", "Demo session scheduled"],
    ["", "DEMO_DONE", "Demo completed with prospect"],
    ["", "NEGOTIATION", "Price negotiation ongoing"],
    ["", "PAYMENT_PENDING", "Awaiting payment"],
    ["", "PAYMENT_RECEIVED", "Payment received and verified"],
    ["", "CLOSED_WON", "Deal closed — business created manually"],
    ["", "NOT_INTERESTED", "Lead not interested — exit stage"],
    ["", "WRONG_NUMBER", "Incorrect contact number — exit stage"],
    ["", "RNR", "Ringing no response — exit stage"],
    ["", "LOST", "Deal lost — exit stage"],
    ["", "DUPLICATE", "Duplicate lead entry — exit stage"],
    ["", "", ""],
    ["leadId", "LED-202605-0012", "Leave blank for new leads. Fill to update an existing lead."],
    ["salesRepName", "Arun Kumar", "Must exactly match the salesperson's name in the system"],
    ["followUpDate", "2026-06-15", "Use YYYY-MM-DD format"],
    ["estimatedValue", "59988", "Annual contract value in INR (numbers only)"],
    ["tags", "grocery,mumbai", "Comma-separated, no spaces around commas"],
    ["pincode", "400001", "6-digit pincode"],
  ]

  const ws2 = XLSX.utils.aoa_to_sheet(refRows)
  ws2["!cols"] = [{ wch: 16 }, { wch: 22 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, ws2, "Valid Values")

  XLSX.writeFile(wb, "quantix_leads_import_template.xlsx")
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
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsArrayBuffer(file)
    } else {
      reject(new Error("Unsupported file format. Use .csv, .xlsx, or .xls"))
    }
  })
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// ── Main Component ────────────────────────────────────────────────────────────

export function LeadsImportView() {
  const { user } = useAuthStore()
  const canExport = user?.permissions?.includes("export:leads") ?? false

  // File upload state
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResult[] | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [filterStatus, setFilterStatus] = useState<"all" | "imported" | "updated" | "duplicate" | "error">("all")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Export state
  const [exportFromDate, setExportFromDate] = useState("")
  const [exportToDate, setExportToDate] = useState("")
  const [exportStage, setExportStage] = useState("ALL")
  const [exportSource, setExportSource] = useState("ALL")
  const [exporting, setExporting] = useState(false)

  // API integration state
  const [integrations, setIntegrations] = useState<CrmIntegration[]>([])
  const [integrationsLoaded, setIntegrationsLoaded] = useState(false)
  const [savingIntegrations, setSavingIntegrations] = useState(false)
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({})
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null)
  const [newMapping, setNewMapping] = useState<{ integrationId: string; from: string; to: string } | null>(null)

  // ── File handling ──────────────────────────────────────────────────────────

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

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (parsedRows.length === 0) return
    setImporting(true)
    try {
      const res = await fetch("/api/admin/import/leads", {
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

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (exportFromDate) params.set("fromDate", exportFromDate)
      if (exportToDate)   params.set("toDate", exportToDate)
      if (exportStage  && exportStage  !== "ALL") params.set("stage",  exportStage)
      if (exportSource && exportSource !== "ALL") params.set("source", exportSource)

      const res = await fetch(`/api/admin/export/leads?${params.toString()}`, {
        headers: getAuthHeaders(),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Export failed")
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const today = new Date().toISOString().split("T")[0]
      a.href = url
      a.download = `quantix_leads_export_${today}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Export downloaded successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  // ── Integrations ───────────────────────────────────────────────────────────

  const loadIntegrations = async () => {
    try {
      const res = await fetch("/api/admin/import/api-integrations", { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) { setIntegrations(json.data); setIntegrationsLoaded(true) }
    } catch { toast.error("Failed to load integrations") }
  }

  const saveIntegrations = async (updated: CrmIntegration[]) => {
    setSavingIntegrations(true)
    try {
      const res = await fetch("/api/admin/import/api-integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ integrations: updated }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setIntegrations(updated)
      toast.success("Integrations saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSavingIntegrations(false)
    }
  }

  const addIntegration = () => {
    const newInt: CrmIntegration = {
      id: uid(),
      name: "New Integration",
      apiUrl: "",
      authType: "api_key",
      authValue: "",
      fieldMapping: {},
      syncDirection: "inbound",
      isActive: false,
      lastSyncStatus: "never",
      createdAt: new Date().toISOString(),
    }
    const updated = [...integrations, newInt]
    setIntegrations(updated)
    setExpandedIntegration(newInt.id)
  }

  const updateIntegration = (id: string, patch: Partial<CrmIntegration>) => {
    setIntegrations((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  const removeIntegration = (id: string) => {
    const updated = integrations.filter((i) => i.id !== id)
    saveIntegrations(updated)
  }

  const addFieldMapping = (integrationId: string) => {
    if (!newMapping || !newMapping.from || !newMapping.to) return
    const int = integrations.find((i) => i.id === integrationId)
    if (!int) return
    const updated = integrations.map((i) =>
      i.id === integrationId
        ? { ...i, fieldMapping: { ...i.fieldMapping, [newMapping.from]: newMapping.to } }
        : i
    )
    setIntegrations(updated)
    setNewMapping(null)
  }

  const removeFieldMapping = (integrationId: string, fromKey: string) => {
    setIntegrations((prev) =>
      prev.map((i) => {
        if (i.id !== integrationId) return i
        const fm = { ...i.fieldMapping }
        delete fm[fromKey]
        return { ...i, fieldMapping: fm }
      })
    )
  }

  // ── Filtered results ────────────────────────────────────────────────────────

  const filteredResults = results
    ? filterStatus === "all" ? results : results.filter((r) => r.status === filterStatus)
    : []

  const statusIcon = (s: ImportResult["status"]) => {
    if (s === "imported") return <CheckCircle2 className="size-3.5 text-green-600" />
    if (s === "updated")  return <RefreshCw className="size-3.5 text-blue-500" />
    if (s === "duplicate") return <AlertCircle className="size-3.5 text-amber-500" />
    return <XCircle className="size-3.5 text-red-500" />
  }

  const statusBadge = (s: ImportResult["status"]) => {
    if (s === "imported") return <Badge className="bg-green-100 text-green-700 text-[10px] h-5">Imported</Badge>
    if (s === "updated")  return <Badge className="bg-blue-100 text-blue-700 text-[10px] h-5">Updated</Badge>
    if (s === "duplicate") return <Badge className="bg-amber-100 text-amber-700 text-[10px] h-5">Duplicate</Badge>
    return <Badge className="bg-red-100 text-red-700 text-[10px] h-5">Error</Badge>
  }

  const rowBgClass = (s: ImportResult["status"]) => {
    if (s === "imported")  return "bg-green-50/50"
    if (s === "updated")   return "bg-blue-50/50"
    if (s === "duplicate") return "bg-amber-50/50"
    return "bg-red-50/50"
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users className="size-5 text-primary" />
          <h1 className="text-xl font-bold">Lead & Sales Import</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Bulk-import leads from CSV or Excel files, or connect an external CRM via API.
        </p>
      </div>

      <Tabs defaultValue="upload">
        <TabsList className="mb-4">
          <TabsTrigger value="upload" className="gap-1.5"><Upload className="size-3.5" /> File Upload</TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5"><FileDown className="size-3.5" /> Export</TabsTrigger>
          <TabsTrigger value="api" className="gap-1.5" onClick={() => { if (!integrationsLoaded) loadIntegrations() }}>
            <Plug className="size-3.5" /> API Integrations
          </TabsTrigger>
        </TabsList>

        {/* ── File Upload Tab ─────────────────────────────────────────────── */}
        <TabsContent value="upload" className="space-y-5">
          {/* Template download */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Step 1 — Download Template</CardTitle>
              <CardDescription className="text-xs">
                Use our CSV template for correct column names. Supported: .csv, .xlsx, .xls
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadTemplate}>
                <Download className="size-3.5" /> Download Excel Template (.xlsx)
              </Button>
              <div className="text-xs text-muted-foreground">
                Required columns: <span className="font-mono">businessName, contactName, contactEmail, contactPhone</span>
              </div>
            </CardContent>
          </Card>

          {/* Drop zone */}
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
                    <p className="text-xs text-muted-foreground">CSV, XLSX, or XLS — up to 2,000 rows</p>
                  </div>
                )}
              </div>

              {file && parsedRows.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPreviewOpen(!previewOpen)}>
                    {previewOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    Preview ({Math.min(5, parsedRows.length)} of {parsedRows.length} rows)
                  </Button>
                  <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={resetUpload}>
                    Clear
                  </Button>
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

          {/* Import button */}
          {parsedRows.length > 0 && !results && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Step 3 — Run Import</CardTitle>
                <CardDescription className="text-xs">
                  Duplicate check runs on email and phone. Existing records won&apos;t be overwritten.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleImport} disabled={importing} className="gap-2">
                  {importing ? <><Loader2 className="size-4 animate-spin" /> Importing…</> : <><Upload className="size-4" /> Import {parsedRows.length} Leads</>}
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
                {/* Summary cards */}
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: "Total", value: summary.total, color: "text-foreground" },
                    { label: "Imported", value: summary.imported, color: "text-green-600" },
                    { label: "Updated", value: summary.updated ?? 0, color: "text-blue-600" },
                    { label: "Duplicates", value: summary.duplicates, color: "text-amber-600" },
                    { label: "Errors", value: summary.errors, color: "text-red-600" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border p-3 text-center">
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[11px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Filter */}
                <div className="flex gap-2 flex-wrap">
                  {(["all", "imported", "updated", "duplicate", "error"] as const).map((f) => (
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
                        <TableHead className="text-[11px] w-10">#</TableHead>
                        <TableHead className="text-[11px]">Status</TableHead>
                        <TableHead className="text-[11px]">Lead ID</TableHead>
                        <TableHead className="text-[11px]">Business Name</TableHead>
                        <TableHead className="text-[11px]">Contact</TableHead>
                        <TableHead className="text-[11px]">Email / Phone</TableHead>
                        <TableHead className="text-[11px]">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.map((r) => (
                        <TableRow key={r.row} className={rowBgClass(r.status)}>
                          <TableCell className="text-xs text-muted-foreground">{r.row}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {statusIcon(r.status)}
                              {statusBadge(r.status)}
                            </div>
                          </TableCell>
                          <TableCell className="text-[11px] font-mono text-muted-foreground">{r.leadId || "—"}</TableCell>
                          <TableCell className="text-xs font-medium max-w-[140px] truncate">{r.data.businessName as string}</TableCell>
                          <TableCell className="text-xs max-w-[120px] truncate">{r.data.contactName as string}</TableCell>
                          <TableCell className="text-xs max-w-[160px]">
                            <div className="truncate">{r.data.contactEmail as string}</div>
                            <div className="text-muted-foreground">{r.data.contactPhone as string}</div>
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground max-w-[180px] truncate">{r.reason || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Export Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="export" className="space-y-5">
          {!canExport ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-14 gap-3">
                <Lock className="size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Access Restricted</p>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Exporting lead data requires the <span className="font-mono">export:leads</span> permission.
                  Contact your Super Admin to request access.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Export Lead Data</CardTitle>
                  <CardDescription className="text-xs">
                    Download leads as an Excel file. Use filters to narrow the export by date range, stage, or source.
                    Exported file includes Lead ID, salesperson name, and all lead fields.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Date range */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">From Date</Label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={exportFromDate}
                        onChange={(e) => setExportFromDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">To Date</Label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={exportToDate}
                        onChange={(e) => setExportToDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Stage + Source filters */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Stage (optional)</Label>
                      <Select value={exportStage} onValueChange={setExportStage}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All stages" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All stages</SelectItem>
                          {STAGE_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">{STAGE_LABELS[s] ?? s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Source (optional)</Label>
                      <Select value={exportSource} onValueChange={setExportSource}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All sources" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All sources</SelectItem>
                          {SOURCE_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={handleExport} disabled={exporting} className="gap-2">
                    {exporting
                      ? <><Loader2 className="size-4 animate-spin" /> Generating…</>
                      : <><FileDown className="size-4" /> Download Export (.xlsx)</>
                    }
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Exported Fields</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      "Lead ID", "Business Name", "Contact Name", "Mobile", "Email",
                      "City", "State", "Pincode", "Business Type", "Source", "Stage",
                      "Assigned Salesperson", "Estimated Value (INR)", "Tags", "Notes",
                      "Follow-up Date", "Last Follow-up Date", "Created Date",
                    ].map((f) => (
                      <code key={f} className="text-[11px] bg-muted rounded px-2 py-0.5">{f}</code>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── API Integrations Tab ────────────────────────────────────────── */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">CRM API Connectors</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Connect external CRMs to automatically sync lead data. Outbound push and inbound pull supported.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addIntegration}>
                    <Plus className="size-3" /> Add Connector
                  </Button>
                  {integrations.length > 0 && (
                    <Button size="sm" className="h-7 text-xs" onClick={() => saveIntegrations(integrations)} disabled={savingIntegrations}>
                      {savingIntegrations ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                      Save All
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {integrations.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <Plug className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm font-medium">No connectors configured</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add a CRM connector to sync leads automatically via API.
                  </p>
                  <Button size="sm" className="mt-3 gap-1.5" onClick={addIntegration}>
                    <Plus className="size-3.5" /> Add First Connector
                  </Button>
                </div>
              ) : (
                integrations.map((int) => (
                  <div key={int.id} className="rounded-lg border">
                    {/* Header row */}
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 rounded-lg"
                      onClick={() => setExpandedIntegration(expandedIntegration === int.id ? null : int.id)}
                    >
                      <div className={`size-2 rounded-full ${int.isActive ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{int.name}</p>
                        <p className="text-[11px] text-muted-foreground">{int.apiUrl || "No URL configured"}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{int.syncDirection}</Badge>
                      <Badge variant="outline" className="text-[10px]">{int.authType.replace("_", " ")}</Badge>
                      {int.lastSyncStatus && int.lastSyncStatus !== "never" && (
                        <Badge className={`text-[10px] ${int.lastSyncStatus === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {int.lastSyncStatus}
                        </Badge>
                      )}
                      <button
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeIntegration(int.id) }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                      <ChevronDown className={`size-4 text-muted-foreground transition-transform ${expandedIntegration === int.id ? "rotate-180" : ""}`} />
                    </div>

                    {expandedIntegration === int.id && (
                      <div className="px-4 pb-4 space-y-4 border-t pt-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Connector Name</Label>
                            <Input className="h-8 text-xs" value={int.name} onChange={(e) => updateIntegration(int.id, { name: e.target.value })} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Sync Direction</Label>
                            <Select value={int.syncDirection} onValueChange={(v) => updateIntegration(int.id, { syncDirection: v as CrmIntegration["syncDirection"] })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="inbound">Inbound (pull from CRM)</SelectItem>
                                <SelectItem value="outbound">Outbound (push to CRM)</SelectItem>
                                <SelectItem value="both">Both ways</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs">API Endpoint URL</Label>
                            <Input className="h-8 text-xs font-mono" placeholder="https://api.yourcrm.com/v1/leads" value={int.apiUrl} onChange={(e) => updateIntegration(int.id, { apiUrl: e.target.value })} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Auth Type</Label>
                            <Select value={int.authType} onValueChange={(v) => updateIntegration(int.id, { authType: v as CrmIntegration["authType"] })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="api_key">API Key</SelectItem>
                                <SelectItem value="bearer_token">Bearer Token</SelectItem>
                                <SelectItem value="basic_auth">Basic Auth (user:pass)</SelectItem>
                                <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">
                              {int.authType === "oauth2" ? "Client ID" : int.authType === "api_key" ? "API Key" : int.authType === "basic_auth" ? "user:password" : "Token"}
                            </Label>
                            <div className="relative">
                              <Input
                                className="h-8 text-xs font-mono pr-8"
                                type={showSecret[int.id] ? "text" : "password"}
                                value={int.authValue}
                                onChange={(e) => updateIntegration(int.id, { authValue: e.target.value })}
                              />
                              <button
                                className="absolute right-2 top-1.5 text-muted-foreground"
                                onClick={() => setShowSecret((p) => ({ ...p, [int.id]: !p[int.id] }))}
                              >
                                {showSecret[int.id] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                              </button>
                            </div>
                          </div>
                          {int.authType === "oauth2" && (
                            <div className="col-span-2 space-y-1.5">
                              <Label className="text-xs">Client Secret</Label>
                              <Input className="h-8 text-xs font-mono" type="password" value={int.authSecret || ""} onChange={(e) => updateIntegration(int.id, { authSecret: e.target.value })} />
                            </div>
                          )}
                          <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs">Description (optional)</Label>
                            <Input className="h-8 text-xs" value={int.description || ""} onChange={(e) => updateIntegration(int.id, { description: e.target.value })} />
                          </div>
                        </div>

                        <Separator />

                        {/* Field mapping */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs font-semibold">Field Mapping</Label>
                            <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1" onClick={() => setNewMapping({ integrationId: int.id, from: "", to: "" })}>
                              <Plus className="size-3" /> Add Mapping
                            </Button>
                          </div>
                          <div className="space-y-1.5">
                            <div className="grid grid-cols-5 gap-2 text-[10px] text-muted-foreground font-medium px-1">
                              <span className="col-span-2">CRM field</span>
                              <span className="col-span-2">Quantix field</span>
                              <span />
                            </div>
                            {Object.entries(int.fieldMapping).map(([from, to]) => (
                              <div key={from} className="grid grid-cols-5 gap-2 items-center">
                                <span className="col-span-2 font-mono text-xs bg-muted rounded px-2 py-1 truncate">{from}</span>
                                <span className="col-span-2 font-mono text-xs bg-muted rounded px-2 py-1 truncate">{to}</span>
                                <button className="text-muted-foreground hover:text-destructive justify-self-center" onClick={() => removeFieldMapping(int.id, from)}>
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            ))}
                            {newMapping?.integrationId === int.id && (
                              <div className="grid grid-cols-5 gap-2 items-center">
                                <Input className="col-span-2 h-7 text-xs font-mono" placeholder="crm_field" value={newMapping.from} onChange={(e) => setNewMapping((p) => p ? { ...p, from: e.target.value } : p)} />
                                <Select value={newMapping.to} onValueChange={(v) => setNewMapping((p) => p ? { ...p, to: v } : p)}>
                                  <SelectTrigger className="col-span-2 h-7 text-xs"><SelectValue placeholder="Quantix field" /></SelectTrigger>
                                  <SelectContent>
                                    {IMPORT_FIELD_HEADERS.map((h) => <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <Button size="sm" className="h-7 text-xs px-2" onClick={() => addFieldMapping(int.id)}>Add</Button>
                              </div>
                            )}
                            {Object.keys(int.fieldMapping).length === 0 && !newMapping && (
                              <p className="text-[11px] text-muted-foreground px-1">No field mappings yet. Add one to map CRM fields to Quantix lead fields.</p>
                            )}
                          </div>
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={int.isActive}
                                onChange={(e) => updateIntegration(int.id, { isActive: e.target.checked })}
                              />
                              <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                            </label>
                            <span className="text-xs text-muted-foreground">{int.isActive ? "Active" : "Inactive"}</span>
                          </div>
                          {int.lastSyncAt && (
                            <p className="text-[11px] text-muted-foreground">Last sync: {new Date(int.lastSyncAt).toLocaleString("en-IN")}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Field reference */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Supported Quantix Lead Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-1">
                {IMPORT_FIELD_HEADERS.map((h) => (
                  <code key={h} className="text-[11px] bg-muted rounded px-2 py-0.5">{h}</code>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                <strong>businessType</strong> values: {BUSINESS_TYPE_OPTIONS.join(", ")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                <strong>source</strong> values: {SOURCE_OPTIONS.join(", ")}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
