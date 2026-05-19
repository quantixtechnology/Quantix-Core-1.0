'use client'

import { useState, useRef, useCallback, useMemo } from "react"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Upload, Users, AlertTriangle, TrendingUp, FileSpreadsheet,
  CheckCircle2, XCircle, Download, Loader2, AlertCircle, RefreshCw,
} from "lucide-react"
import { useBusinessContext } from "@/hooks/use-business-context"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { showSuccess, showError } from "@/lib/toast-utils"

// ── Types ──────────────────────────────────────────────────────────────────────

type Stage = 'idle' | 'mapping' | 'preview' | 'importing' | 'done'
type DuplicateStrategy = 'skip' | 'update' | 'create'

interface ValidatedRow {
  rowIndex: number
  name: string
  phone: string
  email: string
  address: string
  area: string
  pincode: string
  city: string
  state: string
  loyaltyTier: string
  walletBalance: string
  notes: string
  gst: string
  tags: string
  status: string
  rowStatus: 'valid' | 'warning' | 'duplicate' | 'error'
  warnings: string[]
  error?: string
}

interface ImportResult {
  row: number
  status: 'created' | 'updated' | 'skipped' | 'error'
  name?: string
  reason?: string
}

interface HistoryEntry {
  id: string
  method: string
  file: string
  rows: number
  created: number
  updated: number
  failed: number
  status: 'completed' | 'partial' | 'failed'
  date: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STANDARD_FIELDS = [
  { key: 'name',          label: 'Customer Name' },
  { key: 'phone',         label: 'Phone' },
  { key: 'email',         label: 'Email' },
  { key: 'address',       label: 'Address' },
  { key: 'area',          label: 'Area' },
  { key: 'pincode',       label: 'Pincode' },
  { key: 'city',          label: 'City' },
  { key: 'state',         label: 'State' },
  { key: 'loyaltyTier',   label: 'Loyalty Tier' },
  { key: 'walletBalance', label: 'Wallet Balance' },
  { key: 'notes',         label: 'Notes' },
  { key: 'gst',           label: 'GST' },
  { key: 'tags',          label: 'Tags' },
  { key: 'status',        label: 'Status' },
  { key: '__skip__',      label: '— Skip column —' },
]

const HEADER_ALIASES: Record<string, string> = {
  // Customer Name
  'customer name': 'name', 'name': 'name', 'customer': 'name', 'full name': 'name',
  'client name': 'name', 'client': 'name', 'contact name': 'name', 'contact': 'name',
  // Phone
  'phone': 'phone', 'mobile': 'phone', 'mobile number': 'phone', 'phone number': 'phone',
  'contact number': 'phone', 'mob': 'phone', 'cell': 'phone',
  // Email
  'email': 'email', 'email id': 'email', 'email address': 'email', 'e-mail': 'email',
  // Address
  'address': 'address', 'address line 1': 'address', 'street': 'address', 'street address': 'address',
  // Area
  'area': 'area', 'locality': 'area', 'neighbourhood': 'area', 'neighborhood': 'area', 'location': 'area',
  // Pincode
  'pincode': 'pincode', 'pin': 'pincode', 'postal code': 'pincode', 'zip': 'pincode', 'zip code': 'pincode',
  // City
  'city': 'city', 'town': 'city',
  // State
  'state': 'state', 'province': 'state',
  // Loyalty
  'loyalty tier': 'loyaltyTier', 'tier': 'loyaltyTier', 'loyalty': 'loyaltyTier', 'membership': 'loyaltyTier',
  // Wallet
  'wallet balance': 'walletBalance', 'wallet': 'walletBalance', 'balance': 'walletBalance', 'credits': 'walletBalance',
  // Notes
  'notes': 'notes', 'note': 'notes', 'remarks': 'notes', 'comment': 'notes', 'comments': 'notes',
  // GST
  'gst': 'gst', 'gst number': 'gst', 'gstin': 'gst', 'gst no': 'gst',
  // Tags
  'tags': 'tags', 'tag': 'tags', 'labels': 'tags', 'groups': 'tags',
  // Status
  'status': 'status', 'active': 'status',
}

function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const h of headers) {
    map[h] = HEADER_ALIASES[h.toLowerCase().trim()] ?? '__skip__'
  }
  return map
}

function applyMapToRaw(
  raw: Record<string, string>[],
  headerMap: Record<string, string>,
): ValidatedRow[] {
  return raw.map((row, idx) => {
    const m: Record<string, string> = {}
    for (const [fh, stdKey] of Object.entries(headerMap)) {
      if (stdKey !== '__skip__' && row[fh] !== undefined) m[stdKey] = row[fh]
    }

    const name = (m.name ?? '').trim()
    const warnings: string[] = []

    if (!name) {
      return {
        rowIndex: idx + 1, name, phone: '', email: '',
        address: '', area: '', pincode: '', city: '', state: '',
        loyaltyTier: '', walletBalance: '', notes: '', gst: '', tags: '', status: '',
        rowStatus: 'error', warnings: [], error: 'Missing customer name — will be skipped',
      } satisfies ValidatedRow
    }

    if (!m.phone && !m.email) warnings.push('No phone or email — duplicate detection limited')
    if (!m.phone) warnings.push('Phone missing')
    if (!m.email) warnings.push('Email missing')

    const tierRaw = (m.loyaltyTier ?? '').toUpperCase()
    const validTiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']
    if (m.loyaltyTier && !validTiers.includes(tierRaw)) {
      warnings.push(`Unknown tier "${m.loyaltyTier}" — will default to BRONZE`)
    }

    return {
      rowIndex:     idx + 1,
      name,
      phone:        m.phone        ?? '',
      email:        m.email        ?? '',
      address:      m.address      ?? '',
      area:         m.area         ?? '',
      pincode:      m.pincode      ?? '',
      city:         m.city         ?? '',
      state:        m.state        ?? '',
      loyaltyTier:  m.loyaltyTier  ?? '',
      walletBalance:m.walletBalance ?? '',
      notes:        m.notes        ?? '',
      gst:          m.gst          ?? '',
      tags:         m.tags         ?? '',
      status:       m.status       ?? '',
      rowStatus:    warnings.length ? 'warning' : 'valid',
      warnings,
    }
  })
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const headers = [
    'Customer Name', 'Phone', 'Email', 'Address', 'Area', 'Pincode',
    'City', 'State', 'Loyalty Tier', 'Wallet Balance', 'Notes',
    'GST', 'Tags', 'Status',
  ]
  const example = [
    'Arbaz Khan', '9876543210', 'arbaz@gmail.com', 'Thanisandra',
    'North Bangalore', '560077', 'Bangalore', 'Karnataka',
    'Gold', '100', 'Regular customer', '', 'VIP', 'Active',
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  ws['!cols'] = headers.map((_, i) => ({ wch: [0, 2, 3].includes(i) ? 22 : 14 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Customers')
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Field', 'Notes'],
      ['Customer Name', 'Recommended — used for duplicate detection if phone/email absent'],
      ['Phone', 'Optional — duplicate check priority 1'],
      ['Email', 'Optional — duplicate check priority 2'],
      ['Address', 'Optional — street address'],
      ['Area', 'Optional — locality / neighbourhood'],
      ['Loyalty Tier', 'BRONZE / SILVER / GOLD / PLATINUM (defaults to BRONZE)'],
      ['Wallet Balance', 'Number — initial wallet credits'],
      ['Tags', 'Comma-separated e.g. VIP, Wholesale'],
      ['Status', 'Active / Inactive (defaults to Active)'],
    ]),
    'Notes',
  )
  XLSX.writeFile(wb, 'Customer_Template.xlsx')
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function BulkCustomerUploadView() {
  const { businessId } = useBusinessContext()

  const [stage, setStage]           = useState<Stage>('idle')
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileName, setFileName]     = useState('')
  const [fileHeaders, setFileHeaders] = useState<string[]>([])
  const [rawRows, setRawRows]       = useState<Record<string, string>[]>([])
  const [headerMap, setHeaderMap]   = useState<Record<string, string>>({})
  const [previewRows, setPreviewRows] = useState<ValidatedRow[]>([])
  const [dupStrategy, setDupStrategy] = useState<DuplicateStrategy>('skip')
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [importSummary, setImportSummary] = useState<{
    total: number; created: number; updated: number; skipped: number; errors: number
  } | null>(null)
  const [importHistory, setImportHistory] = useState<HistoryEntry[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Session stats ─────────────────────────────────────────────────────────
  const sessionStats = useMemo(() => {
    const total   = importHistory.reduce((s, h) => s + h.rows, 0)
    const created = importHistory.reduce((s, h) => s + h.created, 0)
    const failed  = importHistory.reduce((s, h) => s + h.failed, 0)
    const rate    = total > 0 ? ((created / total) * 100).toFixed(1) + '%' : '—'
    return { imports: importHistory.length, customers: created, failed, rate }
  }, [importHistory])

  // ── File parsing ──────────────────────────────────────────────────────────
  const parseFile = useCallback(async (file: File) => {
    setFileName(file.name)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

    let parsedHeaders: string[] = []
    let parsedRows: Record<string, string>[] = []

    if (ext === 'csv' || ext === 'txt') {
      await new Promise<void>((resolve) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete(results) {
            parsedHeaders = results.meta.fields ?? []
            parsedRows    = results.data as Record<string, string>[]
            resolve()
          },
        })
      })
    } else {
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      parsedHeaders = json.length > 0 ? Object.keys(json[0]) : []
      parsedRows    = json.map(r =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))
      )
    }

    if (!parsedHeaders.length || !parsedRows.length) {
      showError('File appears empty or could not be parsed.')
      return
    }

    const map     = autoMap(parsedHeaders)
    setFileHeaders(parsedHeaders)
    setRawRows(parsedRows)
    setHeaderMap(map)

    if (Object.values(map).includes('name')) {
      setPreviewRows(applyMapToRaw(parsedRows, map))
      setStage('preview')
    } else {
      setStage('mapping')
    }
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
    e.target.value = ''
  }, [parseFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [parseFile])

  function confirmMapping() {
    setPreviewRows(applyMapToRaw(rawRows, headerMap))
    setStage('preview')
  }

  // ── Import ────────────────────────────────────────────────────────────────
  async function runImport() {
    if (!businessId) { showError('No business context'); return }
    const importable = previewRows.filter(r => r.rowStatus !== 'error')
    if (!importable.length) { showError('No valid rows to import'); return }

    setStage('importing')

    const payload = importable.map(r => ({
      name:          r.name          || undefined,
      phone:         r.phone         || undefined,
      email:         r.email         || undefined,
      address:       r.address       || undefined,
      area:          r.area          || undefined,
      pincode:       r.pincode       || undefined,
      city:          r.city          || undefined,
      state:         r.state         || undefined,
      loyaltyTier:   r.loyaltyTier   || undefined,
      walletBalance: r.walletBalance ? Number(r.walletBalance) : undefined,
      notes:         r.notes         || undefined,
      gst:           r.gst           || undefined,
      tags:          r.tags          || undefined,
      status:        r.status        || undefined,
    }))

    try {
      const res = await fetch(
        `/api/core/businesses/${encodeURIComponent(businessId)}/customers/import`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ rows: payload, duplicateStrategy: dupStrategy }),
        },
      )
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Import failed')

      const results: ImportResult[] = data.results ?? []
      const summary = data.summary

      setImportResults(results)
      setImportSummary(summary)
      setImportHistory(h => [{
        id:      `IMP-${String(h.length + 1).padStart(3, '0')}`,
        method:  'File Upload',
        file:    fileName,
        rows:    summary.total,
        created: summary.created,
        updated: summary.updated,
        failed:  summary.errors,
        status:  summary.errors > 0 ? 'partial' : 'completed',
        date:    new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      }, ...h])
      setStage('done')
      showSuccess(
        `Import complete — ${summary.created} created, ${summary.updated} updated`
      )
    } catch (err) {
      setStage('preview')
      showError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function exportCustomers(format: 'csv' | 'xlsx') {
    if (!businessId) { showError('No business context'); return }
    try {
      const res = await fetch(
        `/api/core/businesses/${encodeURIComponent(businessId)}/customers/export?format=${format}`,
        { headers: getAuthHeaders() },
      )
      if (!res.ok) { showError('Export failed'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `customers-export.${format}`
      a.click()
      URL.revokeObjectURL(url)
      showSuccess(`Customers exported as ${format.toUpperCase()}`)
    } catch {
      showError('Export failed')
    }
  }

  function resetToIdle() {
    setStage('idle')
    setFileName('')
    setFileHeaders([])
    setRawRows([])
    setHeaderMap({})
    setPreviewRows([])
    setImportResults([])
    setImportSummary(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validCount  = previewRows.filter(r => r.rowStatus === 'valid').length
  const warnCount   = previewRows.filter(r => r.rowStatus === 'warning').length
  const errorCount  = previewRows.filter(r => r.rowStatus === 'error').length
  const importCount = validCount + warnCount
  const tableRows   = previewRows.slice(0, 50)

  // ── Import methods (same card style as product import) ────────────────────
  const importMethods = [
    { key: 'CSV Upload',   icon: FileSpreadsheet, desc: 'Standard CSV with headers' },
    { key: 'Excel Upload', icon: FileSpreadsheet, desc: '.xlsx or .xls files' },
    { key: 'API Import',   icon: Upload,          desc: 'REST API bulk endpoint' },
    { key: 'Manual Entry', icon: Users,           desc: 'One customer at a time' },
  ]
  const [method, setMethod] = useState('CSV Upload')
  const [manualName, setManualName]   = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualAdding, setManualAdding] = useState(false)

  async function addManual() {
    if (!businessId || !manualName.trim()) return
    setManualAdding(true)
    try {
      const res = await fetch(
        `/api/core/businesses/${encodeURIComponent(businessId)}/customers/import`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            rows: [{ name: manualName.trim(), phone: manualPhone.trim() || undefined }],
            duplicateStrategy: 'skip',
          }),
        },
      )
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setManualName(''); setManualPhone('')
      setImportHistory(h => [{
        id: `IMP-${String(h.length + 1).padStart(3, '0')}`, method: 'Manual',
        file: 'Manual', rows: 1, created: data.summary.created, updated: 0,
        failed: data.summary.errors,
        status: 'completed',
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      }, ...h])
      showSuccess(`"${manualName.trim()}" added`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setManualAdding(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-300 space-y-6">

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Imports',    value: sessionStats.imports,   icon: Upload,        color: 'text-slate-600 bg-slate-50' },
          { label: 'Customers',  value: sessionStats.customers, icon: Users,         color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Failed',     value: sessionStats.failed,    icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
          { label: 'Rate',       value: sessionStats.rate,      icon: TrendingUp,    color: 'text-blue-600 bg-blue-50' },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="size-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Import Method ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Import Method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {importMethods.map(m => (
              <button
                key={m.key}
                onClick={() => { setMethod(m.key); if (stage !== 'idle') resetToIdle() }}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  method === m.key
                    ? 'border-emerald-400 bg-emerald-50/70 ring-1 ring-emerald-300'
                    : 'hover:border-emerald-300 hover:bg-emerald-50/50'
                }`}
              >
                <m.icon className="size-5 text-emerald-600 mb-2" />
                <p className="text-sm font-medium">{m.key}</p>
                <p className="text-[10px] text-muted-foreground">{m.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Upload Zone ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Upload Zone</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={downloadTemplate}>
              <Download className="size-3" />Download Customer Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(method === 'CSV Upload' || method === 'Excel Upload') && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={method === 'CSV Upload' ? '.csv,.txt' : '.xlsx,.xls,.csv'}
                className="hidden"
                onChange={handleFileInput}
              />
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragOver ? 'border-emerald-400 bg-emerald-50/50' : 'hover:border-muted-foreground/40'
                }`}
              >
                {stage === 'idle' ? (
                  <>
                    <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Drop {method === 'CSV Upload' ? 'CSV' : 'Excel'} file here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">Max 10 MB · {method === 'CSV Upload' ? '.csv .txt' : '.xlsx .xls .csv'}</p>
                    <Button variant="outline" size="sm" className="text-xs h-7 mt-3 pointer-events-none">
                      <Upload className="size-3 mr-1" />Browse
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="size-6 text-emerald-600" />
                    <div className="text-left">
                      <p className="text-sm font-medium">{fileName}</p>
                      <p className="text-xs text-muted-foreground">{previewRows.length} rows detected</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs h-7 ml-auto"
                      onClick={(e) => { e.stopPropagation(); resetToIdle() }}>
                      <RefreshCw className="size-3 mr-1" />Change File
                    </Button>
                  </div>
                )}
              </div>

              {/* Duplicate Strategy */}
              {stage !== 'idle' && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t">
                  <span className="text-xs text-muted-foreground shrink-0">If duplicate found:</span>
                  {(['skip', 'update', 'create'] as DuplicateStrategy[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setDupStrategy(s)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        dupStrategy === s
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-border text-muted-foreground hover:border-emerald-400'
                      }`}
                    >
                      {s === 'skip' ? 'Skip' : s === 'update' ? 'Update Existing' : 'Create New'}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {method === 'API Import' && (
            <div className="space-y-3 p-2">
              <p className="text-xs text-muted-foreground">Send a POST request with an array of customer rows.</p>
              <div className="rounded-lg bg-muted/50 p-3 font-mono text-[11px] text-muted-foreground space-y-1">
                <p><span className="text-emerald-700 font-semibold">POST</span>{' '}
                  /api/core/businesses/<span className="text-blue-700">{'{businessId}'}</span>/customers/import</p>
                <p>Authorization: Bearer {'<token>'}</p>
              </div>
              <pre className="rounded-lg bg-muted/50 p-3 text-[10px] overflow-x-auto">{`{
  "rows": [
    { "name": "Arbaz Khan", "phone": "9876543210", "loyaltyTier": "Gold" }
  ],
  "duplicateStrategy": "skip"   // skip | update | create
}`}</pre>
            </div>
          )}

          {method === 'Manual Entry' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Customer Name *</label>
                  <input
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="e.g. Arbaz Khan"
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Phone</label>
                  <input
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="e.g. 9876543210"
                    value={manualPhone}
                    onChange={e => setManualPhone(e.target.value)}
                  />
                </div>
              </div>
              <Button size="sm" className="text-xs h-7 gap-1.5"
                disabled={!manualName.trim() || manualAdding}
                onClick={addManual}>
                {manualAdding ? <Loader2 className="size-3 animate-spin" /> : <Users className="size-3" />}
                {manualAdding ? 'Adding…' : 'Add Customer'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Header Mapping ─────────────────────────────────────────────────── */}
      {stage === 'mapping' && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Map Columns</CardTitle>
              <Badge className="text-[10px] bg-amber-100 text-amber-700">
                {fileHeaders.length} column{fileHeaders.length !== 1 ? 's' : ''} detected
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Match your file columns to Quantix customer fields.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {fileHeaders.map(fh => (
                <div key={fh} className="flex items-center gap-3">
                  <span className="text-xs w-36 truncate text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">{fh}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <select
                    className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    value={headerMap[fh] ?? '__skip__'}
                    onChange={e => setHeaderMap(m => ({ ...m, [fh]: e.target.value }))}
                  >
                    {STANDARD_FIELDS.map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={resetToIdle}>Cancel</Button>
              <Button size="sm" className="text-xs h-7 flex-1"
                disabled={!Object.values(headerMap).includes('name')}
                onClick={confirmMapping}>
                <CheckCircle2 className="size-3 mr-1" />Confirm Mapping — Preview {rawRows.length} rows
              </Button>
            </div>
            {!Object.values(headerMap).includes('name') && (
              <p className="text-[10px] text-amber-600 mt-2">Map at least one column to "Customer Name" to continue.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Preview + Validation ────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Preview {previewRows.length > 0
                  ? `(${Math.min(previewRows.length, 50)} of ${previewRows.length} rows)`
                  : '(5 rows)'}
              </CardTitle>
              {stage === 'done' && importSummary && (
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700">
                  {importSummary.created} created
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">City</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Tier</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Valid</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.length === 0 ? (
                    [
                      { name: 'Arbaz Khan',   phone: '9876543210', email: 'arbaz@gmail.com',  city: 'Bangalore', tier: 'Gold',   ok: true  },
                      { name: 'Rahul Sharma', phone: '9123456780', email: 'rahul@example.com', city: 'Mumbai',   tier: 'Bronze', ok: true  },
                      { name: 'Priya Patel',  phone: '',           email: '',                  city: 'Pune',     tier: 'Silver', ok: false },
                    ].map((r, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50 opacity-40">
                        <td className="p-2 font-medium">{r.name}</td>
                        <td className="p-2 text-muted-foreground">{r.phone || '—'}</td>
                        <td className="p-2 text-muted-foreground truncate max-w-[100px]">{r.email || '—'}</td>
                        <td className="p-2">{r.city}</td>
                        <td className="p-2"><Badge variant="outline" className="text-[10px]">{r.tier}</Badge></td>
                        <td className="p-2">{r.ok ? <CheckCircle2 className="size-3 text-emerald-500" /> : <AlertCircle className="size-3 text-amber-500" />}</td>
                      </tr>
                    ))
                  ) : tableRows.map((r, i) => {
                    const result = importResults.find(x => x.row === r.rowIndex)
                    return (
                      <tr key={i} className={`border-b hover:bg-muted/50 ${r.rowStatus === 'error' ? 'opacity-50' : ''}`}>
                        <td className="p-2 font-medium truncate max-w-[100px]">{r.name || '—'}</td>
                        <td className="p-2 text-muted-foreground">{r.phone || '—'}</td>
                        <td className="p-2 text-muted-foreground truncate max-w-[100px]">{r.email || '—'}</td>
                        <td className="p-2">{r.city || '—'}</td>
                        <td className="p-2">
                          {r.loyaltyTier
                            ? <Badge variant="outline" className="text-[10px]">{r.loyaltyTier}</Badge>
                            : <span className="text-[10px] text-muted-foreground">BRONZE</span>
                          }
                        </td>
                        <td className="p-2">
                          {result ? (
                            result.status === 'created' || result.status === 'updated'
                              ? <CheckCircle2 className="size-3 text-emerald-500" />
                              : <XCircle className="size-3 text-red-500" />
                          ) : r.rowStatus === 'error'
                            ? <XCircle className="size-3 text-red-500" />
                            : r.rowStatus === 'warning'
                              ? <AlertCircle className="size-3 text-amber-500" />
                              : <CheckCircle2 className="size-3 text-emerald-500" />
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Validation Report</CardTitle>
              {previewRows.length > 0 && (
                <Badge className={`text-[10px] ${warnCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {warnCount > 0 ? `${warnCount} warning${warnCount !== 1 ? 's' : ''}` : 'All clear'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {stage === 'done' && importSummary ? (
              <div className="space-y-2">
                {[
                  ...(importSummary.created > 0 ? [{
                    label: `${importSummary.created} customer${importSummary.created !== 1 ? 's' : ''} created`,
                    icon: CheckCircle2, color: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  }] : []),
                  ...(importSummary.updated > 0 ? [{
                    label: `${importSummary.updated} customer${importSummary.updated !== 1 ? 's' : ''} updated`,
                    icon: CheckCircle2, color: 'border-blue-200 bg-blue-50 text-blue-700',
                  }] : []),
                  ...(importSummary.skipped > 0 ? [{
                    label: `${importSummary.skipped} row${importSummary.skipped !== 1 ? 's' : ''} skipped`,
                    icon: AlertCircle, color: 'border-amber-200 bg-amber-50 text-amber-700',
                  }] : []),
                  ...(importSummary.errors > 0 ? [{
                    label: `${importSummary.errors} row${importSummary.errors !== 1 ? 's' : ''} failed`,
                    icon: XCircle, color: 'border-red-200 bg-red-50 text-red-700',
                  }] : []),
                ].map((item, i) => (
                  <div key={i} className={`p-2 rounded-lg border flex items-center gap-2 text-xs font-medium ${item.color}`}>
                    <item.icon className="size-3 shrink-0" />{item.label}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="text-xs h-7 w-full mt-2" onClick={resetToIdle}>
                  <RefreshCw className="size-3 mr-1" />Import Another File
                </Button>
              </div>
            ) : previewRows.length === 0 ? (
              <div className="space-y-2">
                <div className="p-2 rounded-lg border border-amber-200 bg-amber-50">
                  <div className="flex items-center gap-2 text-xs">
                    <AlertCircle className="size-3 text-amber-500" />
                    <span className="font-medium text-amber-700">Row 3: No phone or email</span>
                  </div>
                  <p className="text-[10px] text-amber-600 mt-1">Duplicate detection will rely on name only</p>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="text-xs h-7 flex-1"><Download className="size-3 mr-1" />Export Errors</Button>
                  <Button size="sm" className="text-xs h-7 flex-1" onClick={() => fileInputRef.current?.click()}>
                    <CheckCircle2 className="size-3 mr-1" />Import Valid (2 rows)
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {errorCount > 0 && (
                  <div className="p-2 rounded-lg border border-red-200 bg-red-50">
                    <div className="flex items-center gap-2 text-xs">
                      <XCircle className="size-3 text-red-500" />
                      <span className="font-medium text-red-700">{errorCount} row{errorCount !== 1 ? 's' : ''} missing Customer Name — will be skipped</span>
                    </div>
                  </div>
                )}
                {warnCount > 0 && (
                  <div className="p-2 rounded-lg border border-amber-200 bg-amber-50 max-h-36 overflow-y-auto">
                    {previewRows.filter(r => r.rowStatus === 'warning').slice(0, 8).map(r => (
                      <div key={r.rowIndex} className="text-[10px] text-amber-700 py-0.5">
                        Row {r.rowIndex} ({r.name}): {r.warnings.join(', ')}
                      </div>
                    ))}
                    {warnCount > 8 && <div className="text-[10px] text-amber-600">+{warnCount - 8} more</div>}
                  </div>
                )}
                {validCount > 0 && (
                  <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50">
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="size-3 text-emerald-500" />
                      <span className="text-emerald-700">{validCount} row{validCount !== 1 ? 's' : ''} fully valid</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="text-xs h-7 flex-1" onClick={resetToIdle}>Cancel</Button>
                  <Button size="sm" className="text-xs h-7 flex-1"
                    disabled={stage === 'importing' || importCount === 0}
                    onClick={runImport}>
                    {stage === 'importing'
                      ? <><Loader2 className="size-3 mr-1 animate-spin" />Importing…</>
                      : <><CheckCircle2 className="size-3 mr-1" />Import Valid ({importCount} rows)</>
                    }
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Import History ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Import History</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={() => exportCustomers('csv')}>
                <Download className="size-3" />Export CSV
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={() => exportCustomers('xlsx')}>
                <Download className="size-3" />Export Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">File</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Method</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Rows</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Created</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Updated</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Failed</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.length === 0 ? (
                  [
                    { id: 'IMP-024', file: 'customers.csv',  method: 'CSV',   rows: 250, created: 248, updated: 0, failed: 2,  status: 'completed', date: 'Jan 15' },
                    { id: 'IMP-023', file: 'bulk.xlsx',      method: 'Excel', rows: 120, created: 115, updated: 5, failed: 0,  status: 'completed', date: 'Jan 14' },
                    { id: 'IMP-022', file: 'Manual',         method: 'Manual', rows: 1, created: 1,  updated: 0, failed: 0,  status: 'completed', date: 'Jan 13' },
                  ].map(h => (
                    <tr key={h.id} className="border-b hover:bg-muted/50 opacity-40">
                      <td className="p-2 font-mono">{h.id}</td>
                      <td className="p-2 max-w-[120px] truncate">{h.file}</td>
                      <td className="p-2"><Badge variant="outline" className="text-[10px]">{h.method}</Badge></td>
                      <td className="p-2">{h.rows}</td>
                      <td className="p-2 text-emerald-600">{h.created}</td>
                      <td className="p-2 text-blue-600">{h.updated}</td>
                      <td className="p-2 text-red-600">{h.failed}</td>
                      <td className="p-2"><Badge className="text-[10px] bg-emerald-100 text-emerald-700">{h.status}</Badge></td>
                      <td className="p-2 text-muted-foreground">{h.date}</td>
                    </tr>
                  ))
                ) : importHistory.map(h => (
                  <tr key={h.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono">{h.id}</td>
                    <td className="p-2 max-w-[120px] truncate">{h.file}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{h.method}</Badge></td>
                    <td className="p-2">{h.rows}</td>
                    <td className="p-2 text-emerald-600">{h.created}</td>
                    <td className="p-2 text-blue-600">{h.updated}</td>
                    <td className="p-2 text-red-600">{h.failed}</td>
                    <td className="p-2">
                      <Badge className={`text-[10px] ${
                        h.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                        : h.status === 'partial'  ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                      }`}>{h.status}</Badge>
                    </td>
                    <td className="p-2 text-muted-foreground">{h.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
