'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Receipt, IndianRupee, CheckCircle2, AlertTriangle,
  Shield, Download, Loader2, Building2,
} from 'lucide-react'
import { useBusinessContext } from '@/hooks/use-business-context'
import { getAuthHeaders } from '@/lib/admin-fetch'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaxSettings {
  gstEnabled: boolean
  hsnEnabled: boolean
  inclusivePricing: boolean
  autoTaxCalculation: boolean
  categoryTaxMap: Record<string, { gstRate: number; hsnCode: string }>
}

interface TaxConfigSlab {
  id: string
  name: string
  rate: number
  description?: string | null
}

interface MonthlyRow {
  month: string
  orderCount: number
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  totalTax: number
}

interface CurrentSummary {
  orderCount: number
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  cess: number
  totalTax: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDec(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function slabColor(rate: number) {
  if (rate <= 5)  return 'bg-emerald-100 text-emerald-700'
  if (rate <= 12) return 'bg-blue-100 text-blue-700'
  if (rate <= 18) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

// GSTR filing due dates: GSTR-1 on 11th, GSTR-3B on 20th
function computeFilings(): { period: string; type: string; dueDate: string; filed: boolean }[] {
  const now   = new Date()
  const month = now.getMonth()
  const year  = now.getFullYear()
  const filings: { period: string; type: string; dueDate: string; filed: boolean }[] = []

  for (let i = 2; i >= 0; i--) {
    const d       = new Date(year, month - i, 1)
    const mLabel  = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
    const due1    = new Date(year, month - i + 1, 11)
    const due3b   = new Date(year, month - i + 1, 20)
    const fmt1    = due1.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const fmt3b   = due3b.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const filed1  = now > due1
    const filed3b = now > due3b

    filings.push({ period: `GSTR-1 ${mLabel}`,  type: 'GSTR-1',  dueDate: fmt1,  filed: filed1 })
    filings.push({ period: `GSTR-3B ${mLabel}`, type: 'GSTR-3B', dueDate: fmt3b, filed: filed3b })
  }

  return filings.reverse().slice(0, 6)
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TOGGLE_DEFS = [
  { key: 'gstEnabled'        as const, label: 'GST Enabled',          desc: 'Apply GST on all invoices' },
  { key: 'hsnEnabled'        as const, label: 'HSN/SAC Codes',         desc: 'Show HSN codes on invoices' },
  { key: 'inclusivePricing'  as const, label: 'Inclusive Pricing',     desc: 'Display prices including tax' },
  { key: 'autoTaxCalculation'as const, label: 'Auto Tax Calculation',  desc: 'Automatically compute tax from product category' },
]

export function TaxView() {
  const { businessId } = useBusinessContext()
  const queryClient    = useQueryClient()
  const [savingToggle, setSavingToggle] = useState<string | null>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: taxSettingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['tax-settings', businessId],
    queryFn: async () => {
      const res  = await fetch(`/api/core/businesses/${businessId}/tax-settings`, { headers: getAuthHeaders() })
      const json = await res.json()
      return json.data as {
        businessName: string
        gstNumber: string | null
        state: string | null
        taxSettings: TaxSettings
      }
    },
    enabled: !!businessId,
  })

  const { data: taxSlabs = [], isLoading: loadingSlabs } = useQuery<TaxConfigSlab[]>({
    queryKey: ['tax-config', businessId],
    queryFn: async () => {
      const res  = await fetch(`/api/core/businesses/${businessId}/tax-config`, { headers: getAuthHeaders() })
      const json = await res.json()
      return (json.data ?? []) as TaxConfigSlab[]
    },
    enabled: !!businessId,
  })

  const { data: monthlyData = [], isLoading: loadingMonthly } = useQuery<MonthlyRow[]>({
    queryKey: ['tax-report-monthly', businessId],
    queryFn: async () => {
      const res  = await fetch(`/api/core/businesses/${businessId}/reports/tax?groupByMonth=true`, { headers: getAuthHeaders() })
      const json = await res.json()
      return (json.data?.monthly ?? []) as MonthlyRow[]
    },
    enabled: !!businessId,
  })

  const { data: currentSummary, isLoading: loadingSummary } = useQuery<CurrentSummary>({
    queryKey: ['tax-report-current', businessId],
    queryFn: async () => {
      const now   = new Date()
      const from  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const res   = await fetch(`/api/core/businesses/${businessId}/reports/tax?from=${from}`, { headers: getAuthHeaders() })
      const json  = await res.json()
      return json.data?.summary as CurrentSummary
    },
    enabled: !!businessId,
  })

  // ── Toggle mutation ────────────────────────────────────────────────────────

  const toggleMutation = useMutation({
    mutationFn: async ({ key, value }: { key: keyof TaxSettings; value: boolean }) => {
      const res = await fetch(`/api/core/businesses/${businessId}/tax-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ [key]: value }),
      })
      if (!res.ok) throw new Error('Failed to save')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-settings', businessId] })
      setSavingToggle(null)
    },
    onError: () => setSavingToggle(null),
  })

  const handleToggle = useCallback((key: keyof TaxSettings, current: boolean) => {
    setSavingToggle(key)
    toggleMutation.mutate({ key, value: !current })
  }, [toggleMutation])

  // ── Computed stats ─────────────────────────────────────────────────────────

  const taxSettings  = taxSettingsData?.taxSettings
  const filings      = computeFilings()
  const pendingCount = filings.filter(f => !f.filed).length
  const totalMonthTax = currentSummary?.totalTax ?? 0

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loadingSettings && loadingSlabs) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

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
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-emerald-600 bg-emerald-50"><Receipt className="size-4" /></div>
            <div>
              <p className="text-xs text-muted-foreground">GST Slabs</p>
              <p className="text-xl font-bold">
                {loadingSlabs ? '—' : `${taxSlabs.length} rate${taxSlabs.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-blue-600 bg-blue-50"><IndianRupee className="size-4" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Tax This Month</p>
              <p className="text-xl font-bold">
                {loadingSummary ? '—' : fmt(totalMonthTax)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${pendingCount > 0 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'}`}>
              {pendingCount > 0 ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monthly Filing</p>
              <p className="text-xl font-bold">{pendingCount > 0 ? 'Pending' : 'Filed'}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-purple-600 bg-purple-50"><Shield className="size-4" /></div>
            <div>
              <p className="text-xs text-muted-foreground">GST Status</p>
              <p className="text-xl font-bold">{taxSettings?.gstEnabled ? 'Active' : 'Off'}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* GSTIN Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">GSTIN Details</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSettings ? (
              <div className="flex items-center justify-center h-24"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
            ) : taxSettingsData?.gstNumber ? (
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">GSTIN</span>
                  <Badge className="text-[10px] bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="size-3 mr-1" />Registered
                  </Badge>
                </div>
                <p className="text-lg font-mono font-bold tracking-wide">{taxSettingsData.gstNumber}</p>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Legal Name</p>
                    <p className="text-xs font-medium">{taxSettingsData.businessName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">State</p>
                    <p className="text-xs font-medium">{taxSettingsData.state ?? '—'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border bg-muted/30 flex items-center gap-3">
                <Building2 className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{taxSettingsData?.businessName ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground">No GSTIN configured — update in Business Settings</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration Toggles */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tax Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {TOGGLE_DEFS.map(t => {
                const isOn   = taxSettings?.[t.key] ?? false
                const saving = savingToggle === t.key
                return (
                  <div key={t.key} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                    </div>
                    <button
                      type="button"
                      disabled={saving || loadingSettings}
                      onClick={() => handleToggle(t.key, isOn)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${isOn ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      {saving
                        ? <Loader2 className="size-3 animate-spin mx-auto text-white" />
                        : <span className={`inline-block size-3.5 rounded-full bg-white transition-transform ${isOn ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      }
                    </button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GST Rate Slabs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">GST Rate Slabs</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSlabs ? (
            <div className="flex items-center justify-center h-16"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
          ) : taxSlabs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No tax slabs configured — add them in Tax Config</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-muted-foreground">Rate</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">CGST</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">SGST</th>
                  </tr>
                </thead>
                <tbody>
                  {taxSlabs.map(slab => (
                    <tr key={slab.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <Badge className={`text-[10px] ${slabColor(slab.rate)}`}>{slab.rate}%</Badge>
                      </td>
                      <td className="p-2 font-medium">{slab.name}</td>
                      <td className="p-2 text-muted-foreground">{(slab.rate / 2).toFixed(1)}%</td>
                      <td className="p-2 text-muted-foreground">{(slab.rate / 2).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
          {loadingMonthly ? (
            <div className="flex items-center justify-center h-16"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-muted-foreground">Month</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Taxable</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">CGST</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">SGST</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">IGST</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Total Tax</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map(m => (
                    <tr key={m.month} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{m.month}</td>
                      <td className="p-2">{fmtDec(m.taxableAmount)}</td>
                      <td className="p-2 text-muted-foreground">{fmtDec(m.cgst)}</td>
                      <td className="p-2 text-muted-foreground">{fmtDec(m.sgst)}</td>
                      <td className="p-2 text-muted-foreground">{fmtDec(m.igst)}</td>
                      <td className="p-2 font-semibold">{fmtDec(m.totalTax)}</td>
                      <td className="p-2 text-muted-foreground">{m.orderCount}</td>
                    </tr>
                  ))}
                  {monthlyData.length === 0 && (
                    <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No tax data yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filing Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">GST Filing Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filings.map(f => (
              <div key={f.period} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-full ${f.filed ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                    {f.filed
                      ? <CheckCircle2 className="size-3 text-emerald-600" />
                      : <AlertTriangle className="size-3 text-amber-600" />
                    }
                  </div>
                  <div>
                    <p className="text-xs font-medium">{f.period}</p>
                    <p className="text-[10px] text-muted-foreground">Due: {f.dueDate}</p>
                  </div>
                </div>
                <Badge className={`text-[10px] ${f.filed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {f.filed ? 'Filed' : 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
