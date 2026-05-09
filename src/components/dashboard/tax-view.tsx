'use client'

import { useState } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Receipt, IndianRupee, CheckCircle2, AlertTriangle,
  Shield, Download,
} from 'lucide-react'

const stats = [
  { label: 'GST Configured', value: '3 rates', icon: Receipt, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Tax Collected', value: '₹45,200', icon: IndianRupee, color: 'text-blue-600 bg-blue-50' },
  { label: 'Monthly Filing', value: 'Filed', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Compliance', value: '100%', icon: Shield, color: 'text-purple-600 bg-purple-50' },
]

const gstRates = [
  { rate: '5%', categories: ['Essential Groceries', 'Packaged Food', 'Dairy Products'], products: 42, color: 'bg-emerald-100 text-emerald-700' },
  { rate: '12%', categories: ['Processed Food', 'Beverages', 'Frozen Items'], products: 28, color: 'bg-blue-100 text-blue-700' },
  { rate: '18%', categories: ['Personal Care', 'Household Items', 'Snacks'], products: 35, color: 'bg-amber-100 text-amber-700' },
  { rate: '28%', categories: ['Premium Items', 'Luxury Goods'], products: 8, color: 'bg-red-100 text-red-700' },
]

const monthlySummary = [
  { month: 'Jul 2024', taxable: '₹2,84,500', cgst: '₹25,605', sgst: '₹25,605', igst: '₹0', total: '₹51,210', filed: true },
  { month: 'Jun 2024', taxable: '₹2,56,800', cgst: '₹23,112', sgst: '₹23,112', igst: '₹1,200', total: '₹47,424', filed: true },
  { month: 'May 2024', taxable: '₹2,31,200', cgst: '₹20,808', sgst: '₹20,808', igst: '₹0', total: '₹41,616', filed: true },
  { month: 'Apr 2024', taxable: '₹2,45,600', cgst: '₹22,104', sgst: '₹22,104', igst: '₹800', total: '₹45,008', filed: true },
  { month: 'Mar 2024', taxable: '₹2,67,400', cgst: '₹24,066', sgst: '₹24,066', igst: '₹0', total: '₹48,132', filed: true },
  { month: 'Feb 2024', taxable: '₹2,12,900', cgst: '₹19,161', sgst: '₹19,161', igst: '₹500', total: '₹38,822', filed: true },
]

const recentFilings = [
  { period: 'GSTR-1 Jul 2024', type: 'GSTR-1', dueDate: '11 Aug 2024', filedDate: '9 Aug 2024', status: 'filed' },
  { period: 'GSTR-3B Jul 2024', type: 'GSTR-3B', dueDate: '20 Aug 2024', filedDate: '18 Aug 2024', status: 'filed' },
  { period: 'GSTR-1 Jun 2024', type: 'GSTR-1', dueDate: '11 Jul 2024', filedDate: '10 Jul 2024', status: 'filed' },
  { period: 'GSTR-3B Jun 2024', type: 'GSTR-3B', dueDate: '20 Jul 2024', filedDate: '19 Jul 2024', status: 'filed' },
  { period: 'GSTR-1 Aug 2024', type: 'GSTR-1', dueDate: '11 Sep 2024', filedDate: '—', status: 'pending' },
]

const configToggles = [
  { key: 'gst_enabled', label: 'GST Enabled', desc: 'Apply GST on all invoices', enabled: true },
  { key: 'hsn_sac', label: 'HSN/SAC Codes', desc: 'Show HSN codes on invoices', enabled: true },
  { key: 'inclusive_pricing', label: 'Inclusive Pricing', desc: 'Display prices including tax', enabled: false },
  { key: 'auto_tax', label: 'Auto Tax Calculation', desc: 'Automatically compute tax from product category', enabled: true },
]

export function TaxView() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(configToggles.map(t => [t.key, t.enabled]))
  )

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tax Configuration</h2>
        <Button variant="outline" size="sm" className="text-xs h-7">
          <Download className="size-3 mr-1" />Export GSTR
        </Button>
      </div>

      {/* Stats */}
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

      <div className="grid md:grid-cols-2 gap-4">
        {/* GSTIN Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">GSTIN Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-muted-foreground">GSTIN</span>
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="size-3 mr-1" />Verified
                </Badge>
              </div>
              <p className="text-lg font-mono font-bold tracking-wide">27AABCF1234F1ZP</p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Legal Name</p>
                  <p className="text-xs font-medium">FreshMart Grocers Pvt. Ltd.</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">State</p>
                  <p className="text-xs font-medium">Maharashtra (27)</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Registration Type</p>
                  <p className="text-xs font-medium">Regular</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Date of Registration</p>
                  <p className="text-xs font-medium">15 Mar 2022</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Toggles */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tax Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {configToggles.map(t => (
                <div key={t.key} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToggles(prev => ({ ...prev, [t.key]: !prev[t.key] }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${toggles[t.key] ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`inline-block size-3.5 rounded-full bg-white transition-transform ${toggles[t.key] ? 'translate-x-4.5' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GST Rates */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">GST Rate Slabs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Rate</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Categories</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Products</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">CGST</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">SGST</th>
                </tr>
              </thead>
              <tbody>
                {gstRates.map(g => (
                  <tr key={g.rate} className="border-b hover:bg-muted/50">
                    <td className="p-2">
                      <Badge className={`text-[10px] ${g.color}`}>{g.rate}</Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1 flex-wrap">
                        {g.categories.map(c => (
                          <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-2 font-semibold">{g.products}</td>
                    <td className="p-2 text-muted-foreground">{(parseFloat(g.rate) / 2).toFixed(1)}%</td>
                    <td className="p-2 text-muted-foreground">{(parseFloat(g.rate) / 2).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Tax Summary */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Monthly Tax Summary</CardTitle>
            <Badge variant="outline" className="text-[10px]">Last 6 months</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-56 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Month</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Taxable</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">CGST</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">SGST</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">IGST</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Total</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map(m => (
                  <tr key={m.month} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{m.month}</td>
                    <td className="p-2">{m.taxable}</td>
                    <td className="p-2 text-muted-foreground">{m.cgst}</td>
                    <td className="p-2 text-muted-foreground">{m.sgst}</td>
                    <td className="p-2 text-muted-foreground">{m.igst}</td>
                    <td className="p-2 font-semibold">{m.total}</td>
                    <td className="p-2">
                      <Badge className={`text-[10px] ${m.filed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {m.filed ? 'Filed' : 'Pending'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Filings */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent Tax Filings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentFilings.map(f => (
              <div key={f.period} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-full ${f.status === 'filed' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                    {f.status === 'filed'
                      ? <CheckCircle2 className="size-3 text-emerald-600" />
                      : <AlertTriangle className="size-3 text-amber-600" />
                    }
                  </div>
                  <div>
                    <p className="text-xs font-medium">{f.period}</p>
                    <p className="text-[10px] text-muted-foreground">Due: {f.dueDate}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={`text-[10px] ${f.status === 'filed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {f.status === 'filed' ? 'Filed' : 'Pending'}
                  </Badge>
                  {f.filedDate !== '—' && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{f.filedDate}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
