'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Upload, Package, AlertTriangle, TrendingUp, FileSpreadsheet,
  Eye, CheckCircle2, XCircle, Clock, Download,
} from 'lucide-react'

const stats = [
  { label: 'Imports', value: '24', icon: Upload, color: 'text-slate-600 bg-slate-50' },
  { label: 'Products', value: '4,520', icon: Package, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Failed Rows', value: '87', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  { label: 'Rate', value: '98.1%', icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
]

const importHistory = [
  { id: 'IMP-024', business: 'FreshMart', method: 'CSV', rows: 450, success: 448, failed: 2, status: 'completed', date: 'Jan 15' },
  { id: 'IMP-023', business: 'SpiceGarden', method: 'Excel', rows: 280, success: 272, failed: 8, status: 'completed', date: 'Jan 14' },
  { id: 'IMP-022', business: 'CleanHome', method: 'API', rows: 120, success: 120, failed: 0, status: 'completed', date: 'Jan 13' },
  { id: 'IMP-021', business: 'TechHub', method: 'CSV', rows: 890, success: 856, failed: 34, status: 'completed', date: 'Jan 12' },
  { id: 'IMP-020', business: 'FreshMart', method: 'Excel', rows: 320, success: 310, failed: 10, status: 'failed', date: 'Jan 11' },
]

const previewData = [
  { sku: 'FM-001', name: 'Basmati Rice 5kg', price: '₹450', stock: '120', category: 'Grocery', valid: true },
  { sku: 'FM-002', name: 'Olive Oil 1L', price: '₹680', stock: '45', category: 'Grocery', valid: true },
  { sku: 'FM-003', name: 'Organic Honey', price: '₹350', stock: '—', category: 'Organic', valid: false },
  { sku: 'FM-004', name: 'Green Tea 50 bags', price: '₹220', stock: '89', category: 'Beverages', valid: true },
  { sku: 'FM-005', name: 'Almond Butter', price: 'ABC', stock: '34', category: 'Organic', valid: false },
]

const importMethods = [
  { method: 'CSV Upload', icon: FileSpreadsheet, desc: 'Standard CSV with headers' },
  { method: 'Excel Upload', icon: FileSpreadsheet, desc: '.xlsx or .xls files' },
  { method: 'API Import', icon: Upload, desc: 'REST API bulk endpoint' },
  { method: 'Manual Entry', icon: Package, desc: 'One product at a time' },
]

export function ProductImportView() {
  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Import Method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {importMethods.map(m => (
              <button key={m.method} className="p-3 rounded-lg border hover:border-emerald-300 hover:bg-emerald-50/50 text-left transition-colors">
                <m.icon className="size-5 text-emerald-600 mb-2" />
                <p className="text-sm font-medium">{m.method}</p>
                <p className="text-[10px] text-muted-foreground">{m.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Upload Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Drop CSV or Excel file here</p>
            <p className="text-xs text-muted-foreground mt-1">Max 10 MB, .csv .xlsx .xls</p>
            <Button variant="outline" size="sm" className="text-xs h-7 mt-3"><Upload className="size-3 mr-1" />Browse</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Preview (5 rows)</CardTitle>
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
                  {previewData.map(p => (
                    <tr key={p.sku} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono">{p.sku}</td>
                      <td className="p-2">{p.name}</td>
                      <td className="p-2">{p.price}</td>
                      <td className="p-2">{p.stock}</td>
                      <td className="p-2"><Badge variant="outline" className="text-[10px]">{p.category}</Badge></td>
                      <td className="p-2">{p.valid ? <CheckCircle2 className="size-3 text-emerald-500" /> : <XCircle className="size-3 text-red-500" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Validation Report</CardTitle>
              <Badge className="text-[10px] bg-amber-100 text-amber-700">2 issues</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="p-2 rounded-lg border border-red-200 bg-red-50">
                <div className="flex items-center gap-2 text-xs">
                  <XCircle className="size-3 text-red-500" />
                  <span className="font-medium text-red-700">Row 3: Missing stock value</span>
                </div>
                <p className="text-[10px] text-red-600 mt-1">Field "stock" is required for product import</p>
              </div>
              <div className="p-2 rounded-lg border border-red-200 bg-red-50">
                <div className="flex items-center gap-2 text-xs">
                  <XCircle className="size-3 text-red-500" />
                  <span className="font-medium text-red-700">Row 5: Invalid price format</span>
                </div>
                <p className="text-[10px] text-red-600 mt-1">"ABC" is not a valid number for price field</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" className="text-xs h-7 flex-1"><Download className="size-3 mr-1" />Export Errors</Button>
              <Button size="sm" className="text-xs h-7 flex-1"><CheckCircle2 className="size-3 mr-1" />Import Valid (3 rows)</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Import History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Business</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Method</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Rows</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Success</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Failed</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map(h => (
                  <tr key={h.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono">{h.id}</td>
                    <td className="p-2">{h.business}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{h.method}</Badge></td>
                    <td className="p-2">{h.rows}</td>
                    <td className="p-2 text-emerald-600">{h.success}</td>
                    <td className="p-2 text-red-600">{h.failed}</td>
                    <td className="p-2"><Badge className={`text-[10px] ${h.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{h.status}</Badge></td>
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
