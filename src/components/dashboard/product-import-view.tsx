'use client'

import { useState, useRef, useCallback, useMemo } from "react"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Upload, Package, AlertTriangle, TrendingUp, FileSpreadsheet,
  CheckCircle2, XCircle, Download, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react'
import { useBusinessContext } from "@/hooks/use-business-context"
import { useAuthStore } from "@/stores/auth-store"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { showSuccess, showError } from "@/lib/toast-utils"

// ── Types ──────────────────────────────────────────────────────────────────────

type Stage = 'idle' | 'mapping' | 'preview' | 'importing' | 'done'
type ImportMethod = 'CSV Upload' | 'Excel Upload' | 'API Import' | 'Manual Entry'

interface ValidatedRow {
  rowIndex: number
  name: string
  sku: string
  category: string
  variant: string
  mrp: number
  price: number
  stock: number
  unit: string
  description: string
  veg: string
  featured: string
  imageUrl: string
  tax: string
  barcode: string
  brand: string
  hsn: string
  status: string
  rowStatus: 'valid' | 'warning' | 'error'
  warnings: string[]
  error?: string
}

interface ImportResult {
  row: number
  status: 'created' | 'skipped' | 'error'
  name?: string
  reason?: string
}

interface HistoryEntry {
  id: string
  method: string
  file: string
  rows: number
  success: number
  failed: number
  status: 'completed' | 'partial' | 'failed'
  date: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STANDARD_FIELDS = [
  { key: 'name',        label: 'Product Name' },
  { key: 'sku',         label: 'SKU' },
  { key: 'category',    label: 'Category' },
  { key: 'variant',     label: 'Variant' },
  { key: 'mrp',         label: 'MRP' },
  { key: 'price',       label: 'Selling Price' },
  { key: 'stock',       label: 'Stock' },
  { key: 'weight',      label: 'Weight' },
  { key: 'unit',        label: 'Unit' },
  { key: 'description', label: 'Description' },
  { key: 'veg',         label: 'Veg' },
  { key: 'featured',    label: 'Featured' },
  { key: 'imageUrl',    label: 'Image URL' },
  { key: 'tax',         label: 'Tax' },
  { key: 'barcode',     label: 'Barcode' },
  { key: 'brand',       label: 'Brand' },
  { key: 'hsn',         label: 'HSN' },
  { key: 'status',      label: 'Status' },
  { key: '__skip__',    label: '— Skip column —' },
]

// Fuzzy mapping from common header names to standard field keys
const HEADER_ALIASES: Record<string, string> = {
  'sku': 'sku',
  'product name': 'name', 'name': 'name', 'item name': 'name',
  'item': 'name', 'product': 'name', 'product title': 'name', 'title': 'name',
  'category': 'category', 'cat': 'category', 'category name': 'category',
  'variant': 'variant', 'variant name': 'variant', 'size': 'variant',
  'mrp': 'mrp', 'maximum retail price': 'mrp',
  'selling price': 'price', 'price': 'price', 'sale price': 'price',
  'sp': 'price', 'offer price': 'price',
  'stock': 'stock', 'qty': 'stock', 'quantity': 'stock', 'inventory': 'stock',
  'weight': 'weight', 'wt': 'weight',
  'unit': 'unit', 'uom': 'unit',
  'description': 'description', 'desc': 'description', 'details': 'description',
  'veg': 'veg', 'is veg': 'veg', 'vegetarian': 'veg', 'veg/non-veg': 'veg',
  'featured': 'featured', 'is featured': 'featured',
  'image url': 'imageUrl', 'image': 'imageUrl', 'img': 'imageUrl',
  'photo': 'imageUrl', 'image link': 'imageUrl',
  'tax': 'tax', 'tax %': 'tax', 'gst': 'tax', 'tax rate': 'tax',
  'barcode': 'barcode', 'ean': 'barcode', 'upc': 'barcode',
  'brand': 'brand', 'brand name': 'brand',
  'hsn': 'hsn', 'hsn code': 'hsn',
  'status': 'status', 'product status': 'status',
}

function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const h of headers) {
    const matched = HEADER_ALIASES[h.toLowerCase().trim()] ?? '__skip__'
    map[h] = matched
  }
  return map
}

function needsMapping(map: Record<string, string>): boolean {
  return Object.values(map).includes('__skip__') && !Object.values(map).includes('name')
}

function applyMapToRaw(
  raw: Record<string, string>[],
  headerMap: Record<string, string>,
): ValidatedRow[] {
  return raw.map((row, idx) => {
    const mapped: Record<string, string> = {}
    for (const [fileHeader, stdKey] of Object.entries(headerMap)) {
      if (stdKey !== '__skip__' && row[fileHeader] !== undefined) {
        mapped[stdKey] = row[fileHeader]
      }
    }

    const name = (mapped.name ?? '').trim()
    const warnings: string[] = []
    let rowStatus: ValidatedRow['rowStatus'] = 'valid'

    if (!name) {
      return {
        rowIndex: idx + 1, name, sku: mapped.sku ?? '',
        category: '', variant: '', mrp: 0, price: 0, stock: 0,
        unit: '', description: '', veg: '', featured: '',
        imageUrl: '', tax: '', barcode: '', brand: '', hsn: '', status: '',
        rowStatus: 'error', warnings: [], error: 'Missing product name — row will be skipped',
      } satisfies ValidatedRow
    }

    if (!mapped.stock) warnings.push('No stock — will default to 0')
    if (!mapped.category) warnings.push('No category — will be uncategorized')
    if (!mapped.price && !mapped.mrp) warnings.push('No price — will default to ₹0')
    if (warnings.length) rowStatus = 'warning'

    return {
      rowIndex: idx + 1,
      name,
      sku:         mapped.sku         ?? '',
      category:    mapped.category    ?? '',
      variant:     mapped.variant     ?? '',
      mrp:         Number(mapped.mrp)   || 0,
      price:       Number(mapped.price) || 0,
      stock:       Number(mapped.stock) || 0,
      unit:        mapped.unit        ?? '',
      description: mapped.description ?? '',
      veg:         mapped.veg         ?? '',
      featured:    mapped.featured    ?? '',
      imageUrl:    mapped.imageUrl    ?? '',
      tax:         mapped.tax         ?? '',
      barcode:     mapped.barcode     ?? '',
      brand:       mapped.brand       ?? '',
      hsn:         mapped.hsn         ?? '',
      status:      mapped.status      ?? '',
      rowStatus,
      warnings,
    }
  })
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const headers = [
    'SKU', 'Product Name', 'Category', 'Variant', 'MRP', 'Selling Price',
    'Stock', 'Weight', 'Unit', 'Description', 'Veg', 'Featured',
    'Image URL', 'Tax', 'Barcode', 'Brand', 'HSN', 'Status',
  ]
  const example = [
    'CHK001', 'Chicken Curry Cut', 'Chicken', '500g', '220', '199', '50',
    '500', 'g', 'Fresh cut chicken', 'No', 'Yes',
    'https://example.com/img.jpg', '5', '123456', 'FreshFarm', '0207', 'Active',
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  ws['!cols'] = headers.map((h, i) => ({ wch: i === 1 || i === 9 ? 28 : 14 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Products')
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Field', 'Notes'],
      ['SKU', 'Optional unique identifier'],
      ['Product Name', 'Required if you want the row imported'],
      ['Category', 'Auto-created if not found'],
      ['Variant', 'e.g. 500g, 1kg — leave blank for single variant'],
      ['MRP', 'Maximum retail price (number)'],
      ['Selling Price', 'Actual selling price (number)'],
      ['Stock', 'Quantity — defaults to 0 if blank'],
      ['Veg', 'Yes / No'],
      ['Featured', 'Yes / No'],
      ['Status', 'Active / Inactive — defaults to Active'],
    ]),
    'Notes',
  )
  XLSX.writeFile(wb, 'Product_Template.xlsx')
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ProductImportView() {
  const { businessId } = useBusinessContext()
  const { businesses, currentBusinessId } = useAuthStore()
  const authStoreId = businesses.find(b => b.businessId === currentBusinessId)?.storeId ?? null

  const [stage, setStage]         = useState<Stage>('idle')
  const [method, setMethod]       = useState<ImportMethod>('CSV Upload')
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileName, setFileName]   = useState('')
  const [fileHeaders, setFileHeaders] = useState<string[]>([])
  const [rawRows, setRawRows]     = useState<Record<string, string>[]>([])
  const [headerMap, setHeaderMap] = useState<Record<string, string>>({})
  const [previewRows, setPreviewRows] = useState<ValidatedRow[]>([])
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [importSummary, setImportSummary] = useState<{ total: number; created: number; skipped: number; errors: number } | null>(null)
  const [importHistory, setImportHistory] = useState<HistoryEntry[]>([])
  const [manualName, setManualName] = useState('')
  const [manualCategory, setManualCategory] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [manualAdding, setManualAdding] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Computed stats from session history ───────────────────────────────────────
  const sessionStats = useMemo(() => {
    const total   = importHistory.reduce((s, h) => s + h.rows, 0)
    const created = importHistory.reduce((s, h) => s + h.success, 0)
    const failed  = importHistory.reduce((s, h) => s + h.failed, 0)
    const rate    = total > 0 ? ((created / total) * 100).toFixed(1) + '%' : '—'
    return { imports: importHistory.length, products: created, failed, rate }
  }, [importHistory])

  // ── File parsing ──────────────────────────────────────────────────────────────
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
            parsedRows = results.data as Record<string, string>[]
            resolve()
          },
        })
      })
    } else {
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf, { type: 'array' })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      parsedHeaders = json.length > 0 ? Object.keys(json[0]) : []
      parsedRows = json.map(r =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))
      )
    }

    if (!parsedHeaders.length || !parsedRows.length) {
      showError('File appears empty or could not be parsed.')
      return
    }

    const map = autoMap(parsedHeaders)
    setFileHeaders(parsedHeaders)
    setRawRows(parsedRows)
    setHeaderMap(map)

    // Skip mapping UI if every column already resolved or name field found
    const hasName = Object.values(map).includes('name')
    if (hasName) {
      const validated = applyMapToRaw(parsedRows, map)
      setPreviewRows(validated)
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

  // ── Confirm mapping ───────────────────────────────────────────────────────────
  function confirmMapping() {
    const validated = applyMapToRaw(rawRows, headerMap)
    setPreviewRows(validated)
    setStage('preview')
  }

  // ── Import ────────────────────────────────────────────────────────────────────
  async function runImport() {
    if (!businessId) { showError('No business context'); return }
    const importableRows = previewRows.filter(r => r.rowStatus !== 'error')
    if (!importableRows.length) { showError('No valid rows to import'); return }

    setStage('importing')

    const payload = importableRows.map(r => ({
      name:        r.name        || undefined,
      sku:         r.sku         || undefined,
      category:    r.category    || undefined,
      variant:     r.variant     || undefined,
      mrp:         r.mrp         || undefined,
      price:       r.price       || undefined,
      stock:       r.stock       ?? 0,
      unit:        r.unit        || undefined,
      description: r.description || undefined,
      veg:         r.veg         || undefined,
      featured:    r.featured    || undefined,
      imageUrl:    r.imageUrl    || undefined,
      tax:         r.tax         || undefined,
      barcode:     r.barcode     || undefined,
      brand:       r.brand       || undefined,
      hsn:         r.hsn         || undefined,
      status:      r.status      || undefined,
    }))

    try {
      const res = await fetch(
        `/api/core/businesses/${encodeURIComponent(businessId)}/products/import`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ rows: payload, storeId: authStoreId ?? undefined }),
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
        method,
        file:    fileName,
        rows:    summary.total,
        success: summary.created,
        failed:  summary.errors + summary.skipped,
        status:  summary.errors > 0 ? 'partial' : 'completed',
        date:    new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      }, ...h])
      setStage('done')
      showSuccess(`Import complete — ${summary.created} product${summary.created !== 1 ? 's' : ''} created`)
    } catch (err) {
      setStage('preview')
      showError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  async function exportProducts(format: 'csv' | 'xlsx') {
    if (!businessId) { showError('No business context'); return }
    try {
      const res = await fetch(
        `/api/core/businesses/${encodeURIComponent(businessId)}/products/export?format=${format}`,
        { headers: getAuthHeaders() },
      )
      if (!res.ok) { showError('Export failed'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `products-export.${format}`
      a.click()
      URL.revokeObjectURL(url)
      showSuccess(`Products exported as ${format.toUpperCase()}`)
    } catch {
      showError('Export failed')
    }
  }

  // ── Manual add ────────────────────────────────────────────────────────────────
  async function addManualProduct() {
    if (!businessId || !manualName.trim()) return
    setManualAdding(true)
    try {
      const res = await fetch(
        `/api/core/businesses/${encodeURIComponent(businessId)}/products/import`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            rows: [{
              name:     manualName.trim(),
              category: manualCategory.trim() || undefined,
              price:    manualPrice ? Number(manualPrice) : undefined,
            }],
            storeId: authStoreId ?? undefined,
          }),
        },
      )
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setManualName(''); setManualCategory(''); setManualPrice('')
      setImportHistory(h => [{
        id:      `IMP-${String(h.length + 1).padStart(3, '0')}`,
        method:  'Manual Entry',
        file:    'Manual',
        rows:    1,
        success: data.summary.created,
        failed:  data.summary.errors,
        status:  'completed',
        date:    new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      }, ...h])
      showSuccess(`"${manualName.trim()}" added`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to add product')
    } finally {
      setManualAdding(false)
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

  // ── Validation summary for preview ────────────────────────────────────────────
  const validCount   = previewRows.filter(r => r.rowStatus === 'valid').length
  const warnCount    = previewRows.filter(r => r.rowStatus === 'warning').length
  const errorCount   = previewRows.filter(r => r.rowStatus === 'error').length
  const importCount  = validCount + warnCount

  // Rows to show in preview table (first 50 to keep UI snappy)
  const tableRows    = previewRows.slice(0, 50)

  // ── Import method cards ───────────────────────────────────────────────────────
  const importMethods: { method: ImportMethod; icon: typeof FileSpreadsheet; desc: string }[] = [
    { method: 'CSV Upload',   icon: FileSpreadsheet, desc: 'Standard CSV with headers' },
    { method: 'Excel Upload', icon: FileSpreadsheet, desc: '.xlsx or .xls files' },
    { method: 'API Import',   icon: Upload,          desc: 'REST API bulk endpoint' },
    { method: 'Manual Entry', icon: Package,         desc: 'One product at a time' },
  ]

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-300 space-y-6">

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Imports',     value: sessionStats.imports,  icon: Upload,        color: 'text-slate-600 bg-slate-50' },
          { label: 'Products',    value: sessionStats.products, icon: Package,       color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Failed Rows', value: sessionStats.failed,   icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
          { label: 'Rate',        value: sessionStats.rate,     icon: TrendingUp,    color: 'text-blue-600 bg-blue-50' },
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

      {/* ── Import Method ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Import Method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {importMethods.map(m => (
              <button
                key={m.method}
                onClick={() => { setMethod(m.method); if (stage !== 'idle') resetToIdle() }}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  method === m.method
                    ? 'border-emerald-400 bg-emerald-50/70 ring-1 ring-emerald-300'
                    : 'hover:border-emerald-300 hover:bg-emerald-50/50'
                }`}
              >
                <m.icon className="size-5 text-emerald-600 mb-2" />
                <p className="text-sm font-medium">{m.method}</p>
                <p className="text-[10px] text-muted-foreground">{m.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Upload Zone ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Upload Zone</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={downloadTemplate}>
              <Download className="size-3" />Download Sample Sheet
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Max 10 MB · {method === 'CSV Upload' ? '.csv .txt' : '.xlsx .xls .csv'}
                    </p>
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
                    <Button
                      variant="ghost" size="sm" className="text-xs h-7 ml-auto"
                      onClick={(e) => { e.stopPropagation(); resetToIdle() }}
                    >
                      <RefreshCw className="size-3 mr-1" />Change File
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {method === 'API Import' && (
            <div className="space-y-3 p-2">
              <p className="text-xs text-muted-foreground">
                Send a POST request to the endpoint below with an array of product rows.
              </p>
              <div className="rounded-lg bg-muted/50 p-3 font-mono text-[11px] text-muted-foreground space-y-1">
                <p><span className="text-emerald-700 font-semibold">POST</span>{' '}
                  /api/core/businesses/<span className="text-blue-700">{'{businessId}'}</span>/products/import</p>
                <p className="mt-1">Authorization: Bearer {'<token>'}</p>
                <p>Content-Type: application/json</p>
              </div>
              <pre className="rounded-lg bg-muted/50 p-3 text-[10px] overflow-x-auto">{`{
  "rows": [
    { "name": "Chicken", "category": "Poultry", "price": 199, "stock": 50 }
  ],
  "storeId": "optional-store-id"
}`}</pre>
            </div>
          )}

          {method === 'Manual Entry' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Product Name *</label>
                  <input
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="e.g. Chicken"
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Category</label>
                  <input
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="e.g. Poultry"
                    value={manualCategory}
                    onChange={e => setManualCategory(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Selling Price</label>
                  <input
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="e.g. 199"
                    type="number"
                    value={manualPrice}
                    onChange={e => setManualPrice(e.target.value)}
                  />
                </div>
              </div>
              <Button
                size="sm" className="text-xs h-7 gap-1.5"
                disabled={!manualName.trim() || manualAdding}
                onClick={addManualProduct}
              >
                {manualAdding ? <Loader2 className="size-3 animate-spin" /> : <Package className="size-3" />}
                {manualAdding ? 'Adding…' : 'Add Product'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Header Mapping ────────────────────────────────────────────────────── */}
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
              Match your file's column headers to the standard Quantix fields.
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
              <Button
                size="sm" className="text-xs h-7 flex-1"
                disabled={!Object.values(headerMap).includes('name')}
                onClick={confirmMapping}
              >
                <CheckCircle2 className="size-3 mr-1" />Confirm Mapping — Preview {rawRows.length} rows
              </Button>
            </div>
            {!Object.values(headerMap).includes('name') && (
              <p className="text-[10px] text-amber-600 mt-2">
                Map at least one column to "Product Name" to continue.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Preview + Validation ──────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Preview {previewRows.length > 0 ? `(${Math.min(previewRows.length, 50)} of ${previewRows.length} rows)` : '(5 rows)'}
              </CardTitle>
              {stage === 'done' && importSummary && (
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700">{importSummary.created} created</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-muted-foreground">SKU</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Price</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Stock</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Valid</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.length === 0 ? (
                    // Static placeholder rows before any file is loaded
                    [
                      { sku: 'FM-001', name: 'Basmati Rice 5kg', price: '₹450', stock: '120', category: 'Grocery', valid: true },
                      { sku: 'FM-002', name: 'Olive Oil 1L',     price: '₹680', stock: '45',  category: 'Grocery', valid: true },
                      { sku: 'FM-003', name: 'Organic Honey',    price: '₹350', stock: '—',   category: 'Organic', valid: false },
                    ].map(p => (
                      <tr key={p.sku} className="border-b hover:bg-muted/50 opacity-40">
                        <td className="p-2 font-mono">{p.sku}</td>
                        <td className="p-2">{p.name}</td>
                        <td className="p-2">{p.price}</td>
                        <td className="p-2">{p.stock}</td>
                        <td className="p-2"><Badge variant="outline" className="text-[10px]">{p.category}</Badge></td>
                        <td className="p-2">{p.valid ? <CheckCircle2 className="size-3 text-emerald-500" /> : <XCircle className="size-3 text-red-500" />}</td>
                      </tr>
                    ))
                  ) : tableRows.map((r, i) => {
                    const result = importResults.find(x => x.row === r.rowIndex)
                    return (
                      <tr key={i} className={`border-b hover:bg-muted/50 ${r.rowStatus === 'error' ? 'opacity-50' : ''}`}>
                        <td className="p-2 font-mono">{r.sku || '—'}</td>
                        <td className="p-2 font-medium truncate max-w-[120px]">{r.name || '—'}</td>
                        <td className="p-2">₹{r.price || 0}</td>
                        <td className="p-2">{r.stock}</td>
                        <td className="p-2">
                          {r.category
                            ? <Badge variant="outline" className="text-[10px]">{r.category}</Badge>
                            : <span className="text-[10px] text-muted-foreground">—</span>
                          }
                        </td>
                        <td className="p-2">
                          {result ? (
                            result.status === 'created'
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
                  { label: `${importSummary.created} products created`, icon: CheckCircle2, color: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
                  ...(importSummary.skipped > 0 ? [{ label: `${importSummary.skipped} rows skipped (no name)`, icon: AlertCircle, color: 'border-amber-200 bg-amber-50 text-amber-700' }] : []),
                  ...(importSummary.errors > 0 ? [{ label: `${importSummary.errors} rows failed`, icon: XCircle, color: 'border-red-200 bg-red-50 text-red-700' }] : []),
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
                <div className="p-2 rounded-lg border border-red-200 bg-red-50">
                  <div className="flex items-center gap-2 text-xs">
                    <XCircle className="size-3 text-red-500" />
                    <span className="font-medium text-red-700">Row 3: Missing stock value</span>
                  </div>
                  <p className="text-[10px] text-red-600 mt-1">Missing stock will default to 0</p>
                </div>
                <div className="p-2 rounded-lg border border-red-200 bg-red-50">
                  <div className="flex items-center gap-2 text-xs">
                    <XCircle className="size-3 text-red-500" />
                    <span className="font-medium text-red-700">Row 5: Invalid price format</span>
                  </div>
                  <p className="text-[10px] text-red-600 mt-1">"ABC" is not a valid number for price field</p>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="text-xs h-7 flex-1"><Download className="size-3 mr-1" />Export Errors</Button>
                  <Button size="sm" className="text-xs h-7 flex-1" onClick={() => fileInputRef.current?.click()}>
                    <CheckCircle2 className="size-3 mr-1" />Import Valid (3 rows)
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {errorCount > 0 && (
                  <div className="p-2 rounded-lg border border-red-200 bg-red-50">
                    <div className="flex items-center gap-2 text-xs">
                      <XCircle className="size-3 text-red-500" />
                      <span className="font-medium text-red-700">{errorCount} row{errorCount !== 1 ? 's' : ''} missing Product Name — will be skipped</span>
                    </div>
                  </div>
                )}
                {warnCount > 0 && (
                  <div className="p-2 rounded-lg border border-amber-200 bg-amber-50 max-h-32 overflow-y-auto">
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
                  <Button variant="outline" size="sm" className="text-xs h-7 flex-1" onClick={resetToIdle}>
                    Cancel
                  </Button>
                  <Button
                    size="sm" className="text-xs h-7 flex-1"
                    disabled={stage === 'importing' || importCount === 0}
                    onClick={runImport}
                  >
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

      {/* ── Import History ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Import History</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={() => exportProducts('csv')}>
                <Download className="size-3" />Export CSV
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={() => exportProducts('xlsx')}>
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
                  <th className="text-left p-2 font-medium text-muted-foreground">Success</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Failed</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.length === 0 ? (
                  [
                    { id: 'IMP-024', business: 'FreshMart',   method: 'CSV',   rows: 450, success: 448, failed: 2,  status: 'completed', date: 'Jan 15' },
                    { id: 'IMP-023', business: 'SpiceGarden', method: 'Excel', rows: 280, success: 272, failed: 8,  status: 'completed', date: 'Jan 14' },
                    { id: 'IMP-022', business: 'CleanHome',   method: 'API',   rows: 120, success: 120, failed: 0,  status: 'completed', date: 'Jan 13' },
                    { id: 'IMP-021', business: 'TechHub',     method: 'CSV',   rows: 890, success: 856, failed: 34, status: 'completed', date: 'Jan 12' },
                    { id: 'IMP-020', business: 'FreshMart',   method: 'Excel', rows: 320, success: 310, failed: 10, status: 'failed',    date: 'Jan 11' },
                  ].map(h => (
                    <tr key={h.id} className="border-b hover:bg-muted/50 opacity-40">
                      <td className="p-2 font-mono">{h.id}</td>
                      <td className="p-2 max-w-[120px] truncate">{h.business}</td>
                      <td className="p-2"><Badge variant="outline" className="text-[10px]">{h.method}</Badge></td>
                      <td className="p-2">{h.rows}</td>
                      <td className="p-2 text-emerald-600">{h.success}</td>
                      <td className="p-2 text-red-600">{h.failed}</td>
                      <td className="p-2"><Badge className={`text-[10px] ${h.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{h.status}</Badge></td>
                      <td className="p-2 text-muted-foreground">{h.date}</td>
                    </tr>
                  ))
                ) : importHistory.map(h => (
                  <tr key={h.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono">{h.id}</td>
                    <td className="p-2 max-w-[120px] truncate">{h.file}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{h.method}</Badge></td>
                    <td className="p-2">{h.rows}</td>
                    <td className="p-2 text-emerald-600">{h.success}</td>
                    <td className="p-2 text-red-600">{h.failed}</td>
                    <td className="p-2"><Badge className={`text-[10px] ${h.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : h.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{h.status}</Badge></td>
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
