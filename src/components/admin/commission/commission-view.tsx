"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "../shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Calculator, BarChart3, Clock, Save, Download,
  FileSpreadsheet, Printer, Trash2, RefreshCw,
  ChevronLeft, ChevronRight, Eye, TrendingUp,
  IndianRupee, Users, Percent, Smartphone, Copy,
} from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/admin-fetch"
import { useAuthStore } from "@/stores/auth-store"

// ── Commission constants ───────────────────────────────────────────────────────

type PlanType = "monthly" | "quarterly" | "halfYearly" | "yearly"

const PLANS: PlanType[] = ["monthly", "quarterly", "halfYearly", "yearly"]

const PLAN_LABELS: Record<PlanType, string> = {
  monthly:    "Monthly",
  quarterly:  "Quarterly",
  halfYearly: "Half Yearly",
  yearly:     "Yearly",
}

// Commission % keyed by [planType][slab]
const MATRIX: Record<PlanType, Record<25 | 35 | 45, number>> = {
  monthly:    { 25: 25, 35: 35, 45: 45 },
  quarterly:  { 25: 12, 35: 16, 45: 20 },
  halfYearly: { 25: 14, 35: 18, 45: 22 },
  yearly:     { 25: 16, 35: 20, 45: 25 },
}

const SLAB_TIERS = [
  { slab: 25 as 25 | 35 | 45, tier: "Tier 1", label: "1–5",  min: 1,  max: 5        },
  { slab: 35 as 25 | 35 | 45, tier: "Tier 2", label: "6–10", min: 6,  max: 10       },
  { slab: 45 as 25 | 35 | 45, tier: "Tier 3", label: "11+",  min: 11, max: Infinity  },
]

// UI display name for each internal slab value (25/35/45 remain unchanged in MATRIX)
function slabToTier(slab: 25 | 35 | 45): string {
  if (slab === 25) return "Tier 1"
  if (slab === 35) return "Tier 2"
  return "Tier 3"
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

// ── Pure calculation helpers ───────────────────────────────────────────────────

function getSlab(qty: number): 25 | 35 | 45 {
  if (qty <= 5)  return 25
  if (qty <= 10) return 35
  return 45
}

function commPct(type: PlanType, slab: 25 | 35 | 45): number {
  return MATRIX[type][slab]
}

interface RowResult {
  type:              PlanType
  qty:               number
  totalValue:        number
  slab:              25 | 35 | 45
  pct:               number
  commPct?:          number  // alias stored in DB lineItems JSON
  avgValue:          number
  perSaleCommission: number
  totalCommission:   number
}

function calcRow(type: PlanType, qty: number, value: number, slab: 25 | 35 | 45): RowResult {
  const pct = commPct(type, slab)
  if (qty === 0 || value === 0) {
    return { type, qty, totalValue: value, slab, pct, avgValue: 0, perSaleCommission: 0, totalCommission: 0 }
  }
  const avgValue          = value / qty
  const perSaleCommission = (avgValue * pct) / 100
  const totalCommission   = (value   * pct) / 100
  return { type, qty, totalValue: value, slab, pct, avgValue, perSaleCommission, totalCommission }
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(n: number) {
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}%`
}

function slabColor(slab: 25 | 35 | 45) {
  if (slab === 25) return { badge: "bg-amber-50  text-amber-700  border-amber-200",  bar: "bg-amber-400"  }
  if (slab === 35) return { badge: "bg-blue-50   text-blue-700   border-blue-200",   bar: "bg-blue-400"   }
  return              { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-emerald-400" }
}

// ── Types for saved history ────────────────────────────────────────────────────

interface SavedCalc {
  id:                string
  salesPersonName:   string
  month:             number
  year:              number
  notes:             string | null
  lineItems:         string
  totalQty:          number
  totalValue:        number
  qualifiedSlab:     number
  totalCommission:   number
  calcType:          string | null
  eligibilityStatus: string | null
  createdAt:         string
}

// ── PDF print helper ───────────────────────────────────────────────────────────

function buildPrintHtml(opts: {
  name: string; month: number; year: number
  rows: RowResult[]; totalQty: number; totalValue: number
  slab: 25 | 35 | 45; totalCommission: number; notes?: string
}): string {
  const tableRows = opts.rows
    .filter(r => r.qty > 0)
    .map(r => `<tr>
      <td>${PLAN_LABELS[r.type]}</td>
      <td class="num">${r.qty}</td>
      <td class="num">${fmt(r.totalValue)}</td>
      <td class="num">${fmtPct(r.pct)}</td>
      <td class="num">${fmt(r.avgValue)}</td>
      <td class="num">${fmt(r.perSaleCommission)}</td>
      <td class="num">${fmt(r.totalCommission)}</td>
    </tr>`).join("")

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><title>Commission Report — ${MONTH_NAMES[opts.month - 1]} ${opts.year}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#111827;background:#fff}
  .page{max-width:900px;margin:0 auto;padding:32px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #10B981;padding-bottom:16px;margin-bottom:20px}
  .brand img{height:48px;display:block}
  .brand h1{font-size:18px;font-weight:800;color:#111827;margin-top:8px}
  .brand p{font-size:11px;color:#6b7280;margin-top:2px}
  .meta{text-align:right}
  .meta .title{font-size:14px;font-weight:700;color:#10B981;text-transform:uppercase;letter-spacing:.08em}
  .meta p{font-size:11px;color:#6b7280;margin-top:3px}
  .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
  .kpi-card{border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px}
  .kpi-card .label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:4px}
  .kpi-card .value{font-size:16px;font-weight:800;color:#111827}
  .kpi-card .slab{font-size:16px;font-weight:800;color:#10B981}
  table.items{width:100%;border-collapse:collapse;margin-bottom:20px}
  table.items th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;border-bottom:2px solid #e5e7eb;padding:7px 6px;text-align:left}
  table.items th.num,table.items td.num{text-align:right}
  table.items td{padding:8px 6px;border-bottom:1px solid #f3f4f6;font-size:11px}
  .grand{background:#f0fdf4;border-top:2px solid #10B981}
  .grand td{font-weight:700;font-size:12px;padding:10px 6px}
  .footer{border-top:1px solid #e5e7eb;padding-top:12px;font-size:9px;color:#9ca3af;text-align:center}
  @media print{.no-print{display:none!important}.page{padding:16px}}
</style></head><body>
<div class="page">
  <div class="header">
    <div class="brand">
      <img src="https://app.quantixtechnology.in/api/assets/logo" alt="Quantix Technology"/>
      <h1>Quantix Technology</h1>
      <p>Internal Commission Report</p>
    </div>
    <div class="meta">
      <div class="title">Commission Calculation</div>
      <p>Sales Person: <strong>${opts.name}</strong></p>
      <p>Period: <strong>${MONTH_NAMES[opts.month - 1]} ${opts.year}</strong></p>
      ${opts.notes ? `<p>Notes: ${opts.notes}</p>` : ""}
    </div>
  </div>
  <div class="kpi">
    <div class="kpi-card"><div class="label">Total Signups</div><div class="value">${opts.totalQty}</div></div>
    <div class="kpi-card"><div class="label">Performance Tier</div><div class="slab">${slabToTier(opts.slab)}</div></div>
    <div class="kpi-card"><div class="label">Business Generated</div><div class="value" style="font-size:13px">${fmt(opts.totalValue)}</div></div>
    <div class="kpi-card"><div class="label">Total Commission</div><div class="value" style="font-size:13px;color:#10B981">${fmt(opts.totalCommission)}</div></div>
  </div>
  <table class="items">
    <thead><tr>
      <th>Subscription</th><th class="num">Qty</th><th class="num">Sale Value</th>
      <th class="num">Comm %</th><th class="num">Avg/Sale</th>
      <th class="num">Per Sale Commission</th><th class="num">Total Commission</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
    <tfoot><tr class="grand">
      <td>Grand Total</td><td class="num">${opts.totalQty}</td><td class="num">${fmt(opts.totalValue)}</td>
      <td class="num">—</td><td class="num">—</td><td class="num">—</td>
      <td class="num">${fmt(opts.totalCommission)}</td>
    </tr></tfoot>
  </table>
  <div class="footer">
    <p>This is an internal commission report generated by Quantix Technology platform.</p>
    <p>Confidential — Not for external distribution.</p>
  </div>
</div>
<div class="no-print" style="position:fixed;top:12px;right:12px">
  <button onclick="window.print()" style="background:#10B981;color:#fff;border:none;padding:8px 18px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600">Print / Save PDF</button>
</div>
</body></html>`
}

function printCalc(opts: Parameters<typeof buildPrintHtml>[0]) {
  const html = buildPrintHtml(opts)
  const win  = window.open("", "_blank")
  if (!win) { toast.error("Allow popups to export PDF"); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 350)
}

function exportCSV(rows: RowResult[], name: string, month: number, year: number) {
  const header = ["Subscription", "Qty", "Total Sale Value", "Commission %", "Avg/Sale", "Per Sale Commission", "Total Commission"]
  const data = rows.filter(r => r.qty > 0).map(r => [
    PLAN_LABELS[r.type], String(r.qty),
    r.totalValue.toFixed(2), fmtPct(r.pct),
    r.avgValue.toFixed(2), r.perSaleCommission.toFixed(2), r.totalCommission.toFixed(2),
  ])
  const totalComm = rows.reduce((s, r) => s + r.totalCommission, 0)
  data.push(["Grand Total", String(rows.reduce((s, r) => s + r.qty, 0)),
    rows.reduce((s, r) => s + r.totalValue, 0).toFixed(2), "", "", "", totalComm.toFixed(2)])

  const csv = [header, ...data].map(r => r.map(c => `"${c}"`).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = `commission-${name.replace(/\s+/g, "-")}-${MONTH_NAMES[month - 1]}-${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Save Modal ─────────────────────────────────────────────────────────────────

function SaveModal({
  onClose, onSaved, user, rows, totalQty, totalValue, slab, totalCommission,
}: {
  onClose:        () => void
  onSaved:        () => void
  user:           { id: string; name: string } | null
  rows:           RowResult[]
  totalQty:       number
  totalValue:     number
  slab:           25 | 35 | 45
  totalCommission: number
}) {
  const now   = new Date()
  const [month, setMonth]   = useState(now.getMonth() + 1)
  const [year,  setYear]    = useState(now.getFullYear())
  const [notes, setNotes]   = useState("")
  const [saving, setSaving] = useState(false)

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i)

  const handleSave = async () => {
    if (!user?.id) { toast.error("User not identified"); return }
    setSaving(true)
    try {
      const lineItems = JSON.stringify(rows.map(r => ({
        type: r.type, qty: r.qty, totalValue: r.totalValue,
        commPct: r.pct, perSaleCommission: r.perSaleCommission, totalCommission: r.totalCommission,
      })))
      const res  = await authFetch("/api/admin/commission", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          salesPersonId:   user.id,
          salesPersonName: user.name,
          month, year, lineItems,
          totalQty, totalValue,
          qualifiedSlab:   slab,
          totalCommission,
          notes: notes.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? "Save failed")
      toast.success("Calculation saved")
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h2 className="text-base font-bold mb-4">Save Calculation</h2>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Sales Person</Label>
            <Input value={user?.name ?? ""} disabled className="h-8 text-sm mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Month</Label>
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Year</Label>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Q2 push, campaign week..."
              className="h-8 text-sm mt-1"
            />
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-muted/30 border p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Signups</span><strong>{totalQty}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Performance Tier</span><strong>{slabToTier(slab)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Business Generated</span><strong>{fmt(totalValue)}</strong></div>
            <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">Commission Earned</span><strong className="text-emerald-600">{fmt(totalCommission)}</strong></div>
          </div>
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || totalQty === 0} className="gap-1.5">
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Reference tables ───────────────────────────────────────────────────────────

function ReferenceSection({ activeSlab }: { activeSlab: 25 | 35 | 45 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
      {/* Performance Tier Qualification */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Performance Tier Qualification</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Signups</th>
              <th className="text-right pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Performance Tier</th>
            </tr>
          </thead>
          <tbody>
            {SLAB_TIERS.map(t => {
              const active = t.slab === activeSlab
              const col    = slabColor(t.slab)
              return (
                <tr key={t.slab} className={`border-b last:border-0 ${active ? "bg-emerald-50/50" : ""}`}>
                  <td className="py-2 font-medium">{t.label} signups</td>
                  <td className="py-2 text-right">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${col.badge} ${active ? "ring-2 ring-offset-1 ring-emerald-400" : ""}`}>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                      {t.tier}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Commission Matrix */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Commission Matrix</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Plan</th>
              <th className="text-right pb-2 text-[10px] font-bold text-amber-600">Tier 1</th>
              <th className="text-right pb-2 text-[10px] font-bold text-blue-600">Tier 2</th>
              <th className="text-right pb-2 text-[10px] font-bold text-emerald-600">Tier 3</th>
            </tr>
          </thead>
          <tbody>
            {PLANS.map(p => (
              <tr key={p} className="border-b last:border-0">
                <td className="py-2 font-medium">{PLAN_LABELS[p]}</td>
                {([25, 35, 45] as (25 | 35 | 45)[]).map(s => (
                  <td key={s} className={`py-2 text-right text-xs font-mono ${s === activeSlab ? "font-bold text-emerald-700" : "text-muted-foreground"}`}>
                    {fmtPct(MATRIX[p][s])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── New Signup Calculator tab ──────────────────────────────────────────────────

function NewSignupCalculator({
  user, canEdit,
}: {
  user:    { id: string; name: string } | null
  canEdit: boolean
}) {
  type Inputs = Record<PlanType, { qty: string; value: string }>

  const [inputs, setInputs] = useState<Inputs>({
    monthly:    { qty: "", value: "" },
    quarterly:  { qty: "", value: "" },
    halfYearly: { qty: "", value: "" },
    yearly:     { qty: "", value: "" },
  })
  const [showSave,    setShowSave]    = useState(false)
  const [historyKey,  setHistoryKey]  = useState(0)

  const setField = (plan: PlanType, field: "qty" | "value", val: string) => {
    if (val !== "" && !/^\d*\.?\d*$/.test(val)) return
    setInputs(prev => ({ ...prev, [plan]: { ...prev[plan], [field]: val } }))
  }

  // Derived
  const parsed = PLANS.reduce((acc, p) => {
    acc[p] = { qty: parseInt(inputs[p].qty) || 0, value: parseFloat(inputs[p].value) || 0 }
    return acc
  }, {} as Record<PlanType, { qty: number; value: number }>)

  const totalQty    = PLANS.reduce((s, p) => s + parsed[p].qty,   0)
  const totalValue  = PLANS.reduce((s, p) => s + parsed[p].value, 0)
  const slab        = getSlab(totalQty)
  const rows        = PLANS.map(p => calcRow(p, parsed[p].qty, parsed[p].value, slab))
  const totalComm   = rows.reduce((s, r) => s + r.totalCommission, 0)
  const col         = slabColor(slab)
  const hasInputs   = totalQty > 0

  const handlePrint = () => printCalc({
    name: user?.name ?? "Unknown", month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    rows, totalQty, totalValue, slab, totalCommission: totalComm,
  })

  const handleCSV = () => exportCSV(rows, user?.name ?? "user", new Date().getMonth() + 1, new Date().getFullYear())

  const handleReset = () => setInputs({
    monthly:    { qty: "", value: "" },
    quarterly:  { qty: "", value: "" },
    halfYearly: { qty: "", value: "" },
    yearly:     { qty: "", value: "" },
  })

  return (
    <div className="space-y-6">
      {/* Two-panel grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* ── LEFT: Input Panel ── */}
        <div className="xl:col-span-2 space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Enter Sales Data</p>

            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left pb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Subscription</th>
                  <th className="text-right pb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground pr-1">Qty</th>
                  <th className="text-right pb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sale Value (₹)</th>
                </tr>
              </thead>
              <tbody>
                {PLANS.map(plan => (
                  <tr key={plan} className="border-t">
                    <td className="py-2.5 text-sm font-semibold w-28">{PLAN_LABELS[plan]}</td>
                    <td className="py-2.5 px-1 w-20">
                      <Input
                        value={inputs[plan].qty}
                        onChange={e => setField(plan, "qty", e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm text-right font-mono"
                      />
                    </td>
                    <td className="py-2.5 pl-1">
                      <Input
                        value={inputs[plan].value}
                        onChange={e => setField(plan, "value", e.target.value)}
                        placeholder="0.00"
                        className="h-8 text-sm text-right font-mono"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals row */}
            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{totalQty}</span> total signups
              </div>
              <div className="text-xs text-muted-foreground text-right">
                <span className="font-bold text-foreground">{fmt(totalValue)}</span> total value
              </div>
            </div>
          </div>

          {/* Performance Tier */}
          {hasInputs && (
            <div className={`rounded-xl border-2 p-4 flex items-center justify-between ${col.badge}`}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Performance Tier</p>
                <p className="text-3xl font-black mt-0.5">{slabToTier(slab)}</p>
                <p className="text-xs font-medium opacity-80 mt-0.5">
                  {slab === 25 ? "1–5 signups" : slab === 35 ? "6–10 signups" : "11+ signups"}
                </p>
              </div>
              <div className={`h-14 w-14 rounded-full flex items-center justify-center ${col.bar} text-white`}>
                <Percent className="h-7 w-7" />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button
                size="sm" className="gap-1.5 text-xs flex-1"
                onClick={() => setShowSave(true)}
                disabled={!hasInputs}
              >
                <Save className="h-3.5 w-3.5" /> Save Calculation
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handlePrint} disabled={!hasInputs}>
              <Printer className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCSV} disabled={!hasInputs}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={handleReset}>
              <RefreshCw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </div>

        {/* ── RIGHT: Results Panel ── */}
        <div className="xl:col-span-3 space-y-4">

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-3">
            {[
              { icon: Users,        label: "Total Signups",       value: totalQty.toString(),       color: "text-blue-600",    bg: "bg-blue-50"    },
              { icon: Percent,      label: "Performance Tier",    value: slabToTier(slab),          color: col.badge.split(" ")[1], bg: col.badge.split(" ")[0] },
              { icon: IndianRupee,  label: "Business Generated",  value: fmt(totalValue),           color: "text-purple-600",  bg: "bg-purple-50"  },
              { icon: TrendingUp,   label: "Total Commission",    value: fmt(totalComm),            color: "text-emerald-600", bg: "bg-emerald-50" },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className="rounded-xl border bg-card p-4 flex items-start gap-3">
                <div className={`rounded-lg p-2 ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">{label}</p>
                  <p className={`text-base font-extrabold leading-none truncate ${hasInputs ? color : "text-muted-foreground"}`}>{hasInputs ? value : "—"}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Results table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Commission Breakdown</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {["Subscription", "Qty", "Sale Value", "Comm %", "Per Sale", "Total Commission"].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${h === "Subscription" ? "text-left" : "text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.type} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-4 py-2.5 font-semibold">{PLAN_LABELS[r.type]}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{r.qty || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{r.totalValue > 0 ? fmt(r.totalValue) : "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.qty > 0 ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${col.badge}`}>{fmtPct(r.pct)}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{r.qty > 0 ? fmt(r.perSaleCommission) : "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">{r.qty > 0 ? fmt(r.totalCommission) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                {hasInputs && (
                  <tfoot>
                    <tr className="bg-emerald-50/60 border-t-2 border-emerald-200">
                      <td className="px-4 py-3 font-bold text-emerald-800">Grand Total</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-emerald-800">{totalQty}</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-emerald-800">{fmt(totalValue)}</td>
                      <td className="px-4 py-3 text-right text-emerald-800">—</td>
                      <td className="px-4 py-3 text-right text-emerald-800">—</td>
                      <td className="px-4 py-3 text-right font-extrabold font-mono text-emerald-700">{fmt(totalComm)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {!hasInputs && (
              <div className="px-4 py-12 text-center">
                <Calculator className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Enter sales quantities and values to see your commission breakdown</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reference tables */}
      <div className="pt-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Reference — Commission Policy</p>
        <ReferenceSection activeSlab={slab} />
      </div>

      {/* Save modal */}
      {showSave && (
        <SaveModal
          onClose={() => setShowSave(false)}
          onSaved={() => setHistoryKey(k => k + 1)}
          user={user}
          rows={rows}
          totalQty={totalQty}
          totalValue={totalValue}
          slab={slab}
          totalCommission={totalComm}
        />
      )}
      {/* keep historyKey in scope to trigger re-fetch without prop-drilling */}
      <span className="hidden" data-key={historyKey} />
    </div>
  )
}

// ── History tab ────────────────────────────────────────────────────────────────

function CommissionHistory({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useAuthStore()

  const [rows,       setRows]       = useState<SavedCalc[]>([])
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total,      setTotal]      = useState(0)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [viewId,     setViewId]     = useState<string | null>(null)

  const viewRecord = rows.find(r => r.id === viewId)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      // Sales team only sees their own records; admins see all
      // calcType=signup separates new-signup history from renewal history
      const qs = isAdmin
        ? `page=${page}&limit=15&calcType=signup`
        : `page=${page}&limit=15&calcType=signup&salesPersonId=${user?.id ?? ""}`
      const res  = await authFetch(`/api/admin/commission?${qs}`)
      const json = await res.json()
      if (json.success) {
        setRows(json.data)
        setTotalPages(json.pagination.pages ?? 1)
        setTotal(json.pagination.total ?? 0)
      }
    } catch {
      toast.error("Failed to load history")
    } finally {
      setLoading(false)
    }
  }, [page, isAdmin, user?.id])

  useEffect(() => { fetch() }, [fetch])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      const res  = await authFetch(`/api/admin/commission/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? "Delete failed")
      toast.success("Calculation deleted")
      fetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(null)
    }
  }

  const handleExportRow = (row: SavedCalc) => {
    const lineItems: RowResult[] = JSON.parse(row.lineItems ?? "[]")
    printCalc({
      name: row.salesPersonName, month: row.month, year: row.year,
      rows: lineItems as unknown as RowResult[], totalQty: row.totalQty,
      totalValue: row.totalValue, slab: row.qualifiedSlab as 25 | 35 | 45,
      totalCommission: row.totalCommission, notes: row.notes ?? undefined,
    })
  }

  const handleCSVRow = (row: SavedCalc) => {
    const lineItems: RowResult[] = JSON.parse(row.lineItems ?? "[]")
    exportCSV(lineItems as unknown as RowResult[], row.salesPersonName, row.month, row.year)
  }

  return (
    <div className="space-y-4">

      {/* View detail modal */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">
                {viewRecord.salesPersonName} — {MONTH_NAMES[viewRecord.month - 1]} {viewRecord.year}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setViewId(null)}>Close</Button>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: "Signups",    val: viewRecord.totalQty.toString()               },
                { label: "Tier",       val: slabToTier(viewRecord.qualifiedSlab as 25 | 35 | 45) },
                { label: "Business",   val: fmt(viewRecord.totalValue)                   },
                { label: "Commission", val: fmt(viewRecord.totalCommission)              },
              ].map(k => (
                <div key={k.label} className="rounded-lg border bg-muted/20 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{k.label}</p>
                  <p className="text-sm font-extrabold mt-0.5">{k.val}</p>
                </div>
              ))}
            </div>
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-muted/30">
                <tr>
                  {["Plan", "Qty", "Sale Value", "Comm %", "Per Sale", "Total Commission"].map(h => (
                    <th key={h} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${h === "Plan" ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(JSON.parse(viewRecord.lineItems) as RowResult[]).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-medium">{PLAN_LABELS[r.type]}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.qty}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.totalValue)}</td>
                    <td className="px-3 py-2 text-right">{fmtPct(r.pct ?? r.commPct ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.perSaleCommission)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{fmt(r.totalCommission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {viewRecord.notes && (
              <p className="mt-3 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                <span className="font-semibold">Notes:</span> {viewRecord.notes}
              </p>
            )}
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleExportRow(viewRecord)}>
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleCSVRow(viewRecord)}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{total} saved calculation{total !== 1 ? "s" : ""}</p>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={fetch} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {["Date", "Sales Person", "Period", "Signups", "Business Value", "Performance Tier", "Commission", "Actions"].map(h => (
                  <th key={h} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap ${h === "Actions" || h === "Date" || h === "Sales Person" || h === "Period" ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3.5 bg-muted rounded animate-pulse" style={{ width: `${50 + (j * 11) % 40}%` }} /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Calculator className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-muted-foreground">No saved calculations yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Use the calculator tab and click Save Calculation</p>
                  </td>
                </tr>
              ) : rows.map(row => {
                const col = slabColor(row.qualifiedSlab as 25 | 35 | 45)
                return (
                  <tr key={row.id} className="border-b hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 font-medium text-xs">{row.salesPersonName}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{MONTH_NAMES[row.month - 1]} {row.year}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{row.totalQty}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{fmt(row.totalValue)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${col.badge}`}>{slabToTier(row.qualifiedSlab as 25 | 35 | 45)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-extrabold text-emerald-700">{fmt(row.totalCommission)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="View" onClick={() => setViewId(row.id)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="PDF" onClick={() => handleExportRow(row)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Excel" onClick={() => handleCSVRow(row)}>
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete" onClick={() => handleDelete(row.id)}
                            disabled={deleting === row.id}
                          >
                            {deleting === row.id
                              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// RENEWAL COMMISSION — Phase 2
// Fixed rates per plan, no slab qualification required.
// ════════════════════════════════════════════════════════════════════════════════

// ── Renewal constants ─────────────────────────────────────────────────────────

const RENEWAL_RATES: Record<PlanType, number> = {
  monthly:    10,
  quarterly:  10,
  halfYearly: 11,
  yearly:     12,
}

interface RenewalRowResult {
  type:              PlanType
  qty:               number
  totalValue:        number
  pct:               number
  avgValue:          number
  perSaleCommission: number
  totalCommission:   number
}

function calcRenewalRow(type: PlanType, qty: number, value: number): RenewalRowResult {
  const pct = RENEWAL_RATES[type]
  if (qty === 0 || value === 0) {
    return { type, qty, totalValue: value, pct, avgValue: 0, perSaleCommission: 0, totalCommission: 0 }
  }
  const avgValue          = value / qty
  const perSaleCommission = (avgValue * pct) / 100
  const totalCommission   = (value   * pct) / 100
  return { type, qty, totalValue: value, pct, avgValue, perSaleCommission, totalCommission }
}

function getEligibilityStatus(newSignups: number): "RELEASE" | "HOLD" {
  return newSignups >= 5 ? "RELEASE" : "HOLD"
}

// ── Renewal PDF print helper ──────────────────────────────────────────────────

function buildRenewalPrintHtml(opts: {
  name: string; month: number; year: number
  rows: RenewalRowResult[]; totalQty: number; totalValue: number
  totalCommission: number; eligibilityStatus: "RELEASE" | "HOLD"; notes?: string
}): string {
  const tableRows = opts.rows
    .filter(r => r.qty > 0)
    .map(r => `<tr>
      <td>${PLAN_LABELS[r.type]}</td>
      <td class="num">${r.qty}</td>
      <td class="num">${fmt(r.totalValue)}</td>
      <td class="num">${fmtPct(r.pct)}</td>
      <td class="num">${fmt(r.avgValue)}</td>
      <td class="num">${fmt(r.perSaleCommission)}</td>
      <td class="num">${fmt(r.totalCommission)}</td>
    </tr>`).join("")

  const statusColor = opts.eligibilityStatus === "RELEASE" ? "#10B981" : "#f59e0b"

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><title>Renewal Commission — ${MONTH_NAMES[opts.month - 1]} ${opts.year}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#111827;background:#fff}
  .page{max-width:900px;margin:0 auto;padding:32px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #10B981;padding-bottom:16px;margin-bottom:20px}
  .brand img{height:48px;display:block}
  .brand h1{font-size:18px;font-weight:800;color:#111827;margin-top:8px}
  .brand p{font-size:11px;color:#6b7280;margin-top:2px}
  .meta{text-align:right}
  .meta .title{font-size:14px;font-weight:700;color:#10B981;text-transform:uppercase;letter-spacing:.08em}
  .meta p{font-size:11px;color:#6b7280;margin-top:3px}
  .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
  .kpi-card{border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px}
  .kpi-card .label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:4px}
  .kpi-card .value{font-size:15px;font-weight:800;color:#111827}
  .kpi-card .status{font-size:15px;font-weight:800;color:${statusColor}}
  table.items{width:100%;border-collapse:collapse;margin-bottom:20px}
  table.items th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;border-bottom:2px solid #e5e7eb;padding:7px 6px;text-align:left}
  table.items th.num,table.items td.num{text-align:right}
  table.items td{padding:8px 6px;border-bottom:1px solid #f3f4f6;font-size:11px}
  .grand{background:#f0fdf4;border-top:2px solid #10B981}
  .grand td{font-weight:700;font-size:12px;padding:10px 6px}
  .policy{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px;margin-bottom:16px;font-size:10px;color:#92400e}
  .footer{border-top:1px solid #e5e7eb;padding-top:12px;font-size:9px;color:#9ca3af;text-align:center}
  @media print{.no-print{display:none!important}.page{padding:16px}}
</style></head><body>
<div class="page">
  <div class="header">
    <div class="brand">
      <img src="https://app.quantixtechnology.in/api/assets/logo" alt="Quantix Technology"/>
      <h1>Quantix Technology</h1>
      <p>Internal Renewal Commission Report</p>
    </div>
    <div class="meta">
      <div class="title">Renewal Commission</div>
      <p>Sales Person: <strong>${opts.name}</strong></p>
      <p>Period: <strong>${MONTH_NAMES[opts.month - 1]} ${opts.year}</strong></p>
      ${opts.notes ? `<p>Notes: ${opts.notes}</p>` : ""}
    </div>
  </div>
  <div class="kpi">
    <div class="kpi-card"><div class="label">Total Renewals</div><div class="value">${opts.totalQty}</div></div>
    <div class="kpi-card"><div class="label">Renewal Status</div><div class="status">${opts.eligibilityStatus}</div></div>
    <div class="kpi-card"><div class="label">Renewal Business</div><div class="value" style="font-size:13px">${fmt(opts.totalValue)}</div></div>
    <div class="kpi-card"><div class="label">Total Commission</div><div class="value" style="font-size:13px;color:#10B981">${fmt(opts.totalCommission)}</div></div>
  </div>
  <div class="policy">
    <strong>Renewal Eligibility:</strong> Commission is released when the sales team member achieves ≥5 new signups in the current month.
    If held, one additional month is granted to achieve eligibility. Non-achievement for two consecutive months may result in lapse of held payout.
  </div>
  <table class="items">
    <thead><tr>
      <th>Plan</th><th class="num">Qty</th><th class="num">Renewal Value</th>
      <th class="num">Rate %</th><th class="num">Avg/Renewal</th>
      <th class="num">Per Sale Commission</th><th class="num">Total Commission</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
    <tfoot><tr class="grand">
      <td>Grand Total</td><td class="num">${opts.totalQty}</td><td class="num">${fmt(opts.totalValue)}</td>
      <td class="num">—</td><td class="num">—</td><td class="num">—</td>
      <td class="num">${fmt(opts.totalCommission)}</td>
    </tr></tfoot>
  </table>
  <div class="footer">
    <p>This is an internal renewal commission report generated by Quantix Technology platform.</p>
    <p>Confidential — Not for external distribution.</p>
  </div>
</div>
<div class="no-print" style="position:fixed;top:12px;right:12px">
  <button onclick="window.print()" style="background:#10B981;color:#fff;border:none;padding:8px 18px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600">Print / Save PDF</button>
</div>
</body></html>`
}

function printRenewalCalc(opts: Parameters<typeof buildRenewalPrintHtml>[0]) {
  const html = buildRenewalPrintHtml(opts)
  const win  = window.open("", "_blank")
  if (!win) { toast.error("Allow popups to export PDF"); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 350)
}

function exportRenewalCSV(rows: RenewalRowResult[], name: string, month: number, year: number) {
  const header = ["Plan", "Qty Renewed", "Total Renewal Value", "Renewal %", "Avg/Renewal", "Per Sale Commission", "Total Commission"]
  const data = rows.filter(r => r.qty > 0).map(r => [
    PLAN_LABELS[r.type], String(r.qty),
    r.totalValue.toFixed(2), fmtPct(r.pct),
    r.avgValue.toFixed(2), r.perSaleCommission.toFixed(2), r.totalCommission.toFixed(2),
  ])
  const totalComm = rows.reduce((s, r) => s + r.totalCommission, 0)
  data.push(["Grand Total", String(rows.reduce((s, r) => s + r.qty, 0)),
    rows.reduce((s, r) => s + r.totalValue, 0).toFixed(2), "", "", "", totalComm.toFixed(2)])

  const csv = [header, ...data].map(r => r.map(c => `"${c}"`).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = `renewal-commission-${name.replace(/\s+/g, "-")}-${MONTH_NAMES[month - 1]}-${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Renewal Save Modal ────────────────────────────────────────────────────────

function RenewalSaveModal({
  onClose, onSaved, user, rows, totalQty, totalValue, totalCommission,
}: {
  onClose:         () => void
  onSaved:         () => void
  user:            { id: string; name: string } | null
  rows:            RenewalRowResult[]
  totalQty:        number
  totalValue:      number
  totalCommission: number
}) {
  const now = new Date()
  const [month,      setMonth]      = useState(now.getMonth() + 1)
  const [year,       setYear]       = useState(now.getFullYear())
  const [newSignups, setNewSignups] = useState("")
  const [notes,      setNotes]      = useState("")
  const [saving,     setSaving]     = useState(false)

  const years       = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i)
  const parsedSigns = parseInt(newSignups) || 0
  const eligibility = getEligibilityStatus(parsedSigns)
  const isRelease   = eligibility === "RELEASE"

  const handleSave = async () => {
    if (!user?.id) { toast.error("User not identified"); return }
    setSaving(true)
    try {
      const lineItems = JSON.stringify(rows.map(r => ({
        type: r.type, qty: r.qty, totalValue: r.totalValue,
        commPct: r.pct, perSaleCommission: r.perSaleCommission, totalCommission: r.totalCommission,
      })))
      const res  = await authFetch("/api/admin/commission", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          salesPersonId:     user.id,
          salesPersonName:   user.name,
          month, year, lineItems,
          totalQty,
          totalValue,
          qualifiedSlab:     0,          // no slab for renewals
          totalCommission,
          calcType:          "renewal",
          eligibilityStatus: eligibility,
          notes:             notes.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? "Save failed")
      toast.success("Renewal calculation saved")
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h2 className="text-base font-bold mb-4">Save Renewal Calculation</h2>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Sales Person</Label>
            <Input value={user?.name ?? ""} disabled className="h-8 text-sm mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Month</Label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-sm">
                {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Year</Label>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-sm">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Eligibility check */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">New Signups This Month (for eligibility)</Label>
            <Input
              type="number" min="0"
              value={newSignups}
              onChange={e => setNewSignups(e.target.value)}
              placeholder="Enter new signups achieved..."
              className="h-8 text-sm"
            />
            {newSignups !== "" && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                isRelease
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}>
                <div className={`w-2 h-2 rounded-full ${isRelease ? "bg-emerald-500" : "bg-amber-500"}`} />
                Renewal Status: <strong>{eligibility}</strong>
                <span className="font-normal opacity-70">
                  {isRelease ? "(≥5 signups — eligible)" : "(<5 signups — commission on hold)"}
                </span>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold">Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. November renewal cycle..."
              className="h-8 text-sm mt-1" />
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-muted/30 border p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Renewals</span><strong>{totalQty}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Renewal Business</span><strong>{fmt(totalValue)}</strong></div>
            <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">Renewal Commission</span><strong className="text-emerald-600">{fmt(totalCommission)}</strong></div>
          </div>
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || totalQty === 0} className="gap-1.5">
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Renewal Reference Section ─────────────────────────────────────────────────

function RenewalReferenceSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">

      {/* Fixed renewal rates */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Renewal Commission Rates</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Plan</th>
              <th className="text-right pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Commission</th>
            </tr>
          </thead>
          <tbody>
            {PLANS.map(p => (
              <tr key={p} className="border-b last:border-0">
                <td className="py-2 font-medium">{PLAN_LABELS[p]}</td>
                <td className="py-2 text-right">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border bg-blue-50 text-blue-700 border-blue-200 font-mono">
                    {fmtPct(RENEWAL_RATES[p])}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          Renewal rates are fixed and do not depend on tier qualification.
        </p>
      </div>

      {/* Eligibility policy */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Renewal Eligibility Policy</p>
        <table className="w-full text-sm mb-3">
          <thead>
            <tr className="border-b">
              <th className="text-left pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">New Signups (Current Month)</th>
              <th className="text-right pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 text-sm">Less than 5 signups</td>
              <td className="py-2 text-right">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border bg-amber-50 text-amber-700 border-amber-200">HOLD</span>
              </td>
            </tr>
            <tr>
              <td className="py-2 text-sm">5 or more signups</td>
              <td className="py-2 text-right">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">RELEASE</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="text-[11px] text-muted-foreground bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2 space-y-1">
          <p><strong>Recovery Rule:</strong> If renewal is held, one additional month is granted to achieve eligibility.</p>
          <p>Non-achievement for two consecutive months may result in lapse of held renewal payout.</p>
        </div>
      </div>
    </div>
  )
}

// ── Renewal Calculator tab ────────────────────────────────────────────────────

function RenewalCalculator({
  user, canEdit,
}: {
  user:    { id: string; name: string } | null
  canEdit: boolean
}) {
  type RInputs = Record<PlanType, { qty: string; value: string }>

  const [inputs,   setInputs]   = useState<RInputs>({
    monthly:    { qty: "", value: "" },
    quarterly:  { qty: "", value: "" },
    halfYearly: { qty: "", value: "" },
    yearly:     { qty: "", value: "" },
  })
  const [newSignups, setNewSignups] = useState("")
  const [showSave,   setShowSave]   = useState(false)
  const [historyKey, setHistoryKey] = useState(0)

  const setField = (plan: PlanType, field: "qty" | "value", val: string) => {
    if (val !== "" && !/^\d*\.?\d*$/.test(val)) return
    setInputs(prev => ({ ...prev, [plan]: { ...prev[plan], [field]: val } }))
  }

  const parsed = PLANS.reduce((acc, p) => {
    acc[p] = { qty: parseInt(inputs[p].qty) || 0, value: parseFloat(inputs[p].value) || 0 }
    return acc
  }, {} as Record<PlanType, { qty: number; value: number }>)

  const totalQty   = PLANS.reduce((s, p) => s + parsed[p].qty,   0)
  const totalValue = PLANS.reduce((s, p) => s + parsed[p].value, 0)
  const rows       = PLANS.map(p => calcRenewalRow(p, parsed[p].qty, parsed[p].value))
  const totalComm  = rows.reduce((s, r) => s + r.totalCommission, 0)
  const hasInputs  = totalQty > 0

  const parsedSigns  = parseInt(newSignups) || 0
  const eligibility  = getEligibilityStatus(parsedSigns)
  const isRelease    = eligibility === "RELEASE"
  const eligibilityEntered = newSignups.trim() !== ""

  const handlePrint = () => printRenewalCalc({
    name: user?.name ?? "Unknown",
    month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    rows, totalQty, totalValue, totalCommission: totalComm,
    eligibilityStatus: eligibility,
  })

  const handleCSV = () => exportRenewalCSV(rows, user?.name ?? "user", new Date().getMonth() + 1, new Date().getFullYear())

  const handleReset = () => {
    setInputs({ monthly: { qty: "", value: "" }, quarterly: { qty: "", value: "" }, halfYearly: { qty: "", value: "" }, yearly: { qty: "", value: "" } })
    setNewSignups("")
  }

  return (
    <div className="space-y-6">
      {/* Two-panel grid — identical layout to NewSignupCalculator */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* ── LEFT: Input Panel ── */}
        <div className="xl:col-span-2 space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Enter Renewal Data</p>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left pb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Plan</th>
                  <th className="text-right pb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground pr-1">Qty Renewed</th>
                  <th className="text-right pb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Renewal Value (₹)</th>
                </tr>
              </thead>
              <tbody>
                {PLANS.map(plan => (
                  <tr key={plan} className="border-t">
                    <td className="py-2.5 text-sm font-semibold w-28">{PLAN_LABELS[plan]}</td>
                    <td className="py-2.5 px-1 w-20">
                      <Input
                        value={inputs[plan].qty}
                        onChange={e => setField(plan, "qty", e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm text-right font-mono"
                      />
                    </td>
                    <td className="py-2.5 pl-1">
                      <Input
                        value={inputs[plan].value}
                        onChange={e => setField(plan, "value", e.target.value)}
                        placeholder="0.00"
                        className="h-8 text-sm text-right font-mono"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{totalQty}</span> total renewals
              </div>
              <div className="text-xs text-muted-foreground text-right">
                <span className="font-bold text-foreground">{fmt(totalValue)}</span> total value
              </div>
            </div>
          </div>

          {/* Eligibility checker */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Eligibility Check</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">New Signups This Month</Label>
              <Input
                type="number" min="0"
                value={newSignups}
                onChange={e => setNewSignups(e.target.value)}
                placeholder="Enter new signups count..."
                className="h-8 text-sm"
              />
            </div>
            {eligibilityEntered && (
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold border ${
                isRelease
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${isRelease ? "bg-emerald-500" : "bg-amber-500"}`} />
                {eligibility}
                <span className="text-xs font-normal opacity-80 ml-auto">
                  {isRelease ? "Commission eligible" : "Commission on hold"}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button size="sm" className="gap-1.5 text-xs flex-1"
                onClick={() => setShowSave(true)} disabled={!hasInputs}>
                <Save className="h-3.5 w-3.5" /> Save Calculation
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handlePrint} disabled={!hasInputs}>
              <Printer className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCSV} disabled={!hasInputs}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={handleReset}>
              <RefreshCw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </div>

        {/* ── RIGHT: Results Panel ── */}
        <div className="xl:col-span-3 space-y-4">

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-3">
            {[
              { icon: Users,       label: "Total Renewals",    value: totalQty.toString(), color: "text-blue-600",   bg: "bg-blue-50"   },
              {
                icon: TrendingUp,
                label: "Renewal Status",
                value: eligibilityEntered ? eligibility : "—",
                color: isRelease ? "text-emerald-600" : "text-amber-600",
                bg:    isRelease ? "bg-emerald-50"    : "bg-amber-50",
              },
              { icon: IndianRupee, label: "Renewal Business",  value: fmt(totalValue),     color: "text-purple-600", bg: "bg-purple-50" },
              { icon: Percent,     label: "Total Commission",  value: fmt(totalComm),      color: "text-emerald-600", bg: "bg-emerald-50" },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className="rounded-xl border bg-card p-4 flex items-start gap-3">
                <div className={`rounded-lg p-2 ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">{label}</p>
                  <p className={`text-base font-extrabold leading-none truncate ${hasInputs || eligibilityEntered ? color : "text-muted-foreground"}`}>
                    {label === "Renewal Status" ? (eligibilityEntered ? value : "—") : (hasInputs ? value : "—")}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Results table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Renewal Commission Breakdown</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {["Plan", "Qty", "Renewal Value", "Rate %", "Per Renewal", "Total Commission"].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${h === "Plan" ? "text-left" : "text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.type} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-4 py-2.5 font-semibold">{PLAN_LABELS[r.type]}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{r.qty || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{r.totalValue > 0 ? fmt(r.totalValue) : "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.qty > 0
                          ? <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">{fmtPct(r.pct)}</span>
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{r.qty > 0 ? fmt(r.perSaleCommission) : "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">{r.qty > 0 ? fmt(r.totalCommission) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                {hasInputs && (
                  <tfoot>
                    <tr className="bg-emerald-50/60 border-t-2 border-emerald-200">
                      <td className="px-4 py-3 font-bold text-emerald-800">Grand Total</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-emerald-800">{totalQty}</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-emerald-800">{fmt(totalValue)}</td>
                      <td className="px-4 py-3 text-right text-emerald-800">—</td>
                      <td className="px-4 py-3 text-right text-emerald-800">—</td>
                      <td className="px-4 py-3 text-right font-extrabold font-mono text-emerald-700">{fmt(totalComm)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {!hasInputs && (
              <div className="px-4 py-12 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Enter renewal quantities and values to see your commission breakdown</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reference section */}
      <div className="pt-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Reference — Renewal Commission Policy</p>
        <RenewalReferenceSection />
      </div>

      {/* Save modal */}
      {showSave && (
        <RenewalSaveModal
          onClose={() => setShowSave(false)}
          onSaved={() => setHistoryKey(k => k + 1)}
          user={user}
          rows={rows}
          totalQty={totalQty}
          totalValue={totalValue}
          totalCommission={totalComm}
        />
      )}
      <span className="hidden" data-key={historyKey} />
    </div>
  )
}

// ── Renewal History tab ───────────────────────────────────────────────────────

function RenewalHistory({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useAuthStore()

  const [rows,       setRows]       = useState<SavedCalc[]>([])
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total,      setTotal]      = useState(0)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [viewId,     setViewId]     = useState<string | null>(null)

  const viewRecord = rows.find(r => r.id === viewId)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const qs = isAdmin
        ? `page=${page}&limit=15&calcType=renewal`
        : `page=${page}&limit=15&calcType=renewal&salesPersonId=${user?.id ?? ""}`
      const res  = await authFetch(`/api/admin/commission?${qs}`)
      const json = await res.json()
      if (json.success) {
        setRows(json.data)
        setTotalPages(json.pagination.pages ?? 1)
        setTotal(json.pagination.total ?? 0)
      }
    } catch {
      toast.error("Failed to load renewal history")
    } finally {
      setLoading(false)
    }
  }, [page, isAdmin, user?.id])

  useEffect(() => { fetch() }, [fetch])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      const res  = await authFetch(`/api/admin/commission/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? "Delete failed")
      toast.success("Record deleted")
      fetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(null)
    }
  }

  const handleExportRow = (row: SavedCalc) => {
    const lineItems = JSON.parse(row.lineItems ?? "[]") as RenewalRowResult[]
    printRenewalCalc({
      name: row.salesPersonName, month: row.month, year: row.year,
      rows: lineItems, totalQty: row.totalQty, totalValue: row.totalValue,
      totalCommission: row.totalCommission,
      eligibilityStatus: (row.eligibilityStatus as "RELEASE" | "HOLD") ?? "HOLD",
      notes: row.notes ?? undefined,
    })
  }

  const handleCSVRow = (row: SavedCalc) => {
    const lineItems = JSON.parse(row.lineItems ?? "[]") as RenewalRowResult[]
    exportRenewalCSV(lineItems, row.salesPersonName, row.month, row.year)
  }

  return (
    <div className="space-y-4">

      {/* View detail modal */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">
                {viewRecord.salesPersonName} — {MONTH_NAMES[viewRecord.month - 1]} {viewRecord.year}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setViewId(null)}>Close</Button>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: "Renewals",   val: viewRecord.totalQty.toString()           },
                { label: "Status",     val: viewRecord.eligibilityStatus ?? "—"      },
                { label: "Business",   val: fmt(viewRecord.totalValue)               },
                { label: "Commission", val: fmt(viewRecord.totalCommission)          },
              ].map(k => (
                <div key={k.label} className="rounded-lg border bg-muted/20 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{k.label}</p>
                  <p className={`text-sm font-extrabold mt-0.5 ${
                    k.label === "Status"
                      ? k.val === "RELEASE" ? "text-emerald-600" : "text-amber-600"
                      : ""
                  }`}>{k.val}</p>
                </div>
              ))}
            </div>
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-muted/30">
                <tr>
                  {["Plan", "Qty", "Renewal Value", "Rate %", "Per Renewal", "Total Commission"].map(h => (
                    <th key={h} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${h === "Plan" ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(JSON.parse(viewRecord.lineItems) as RenewalRowResult[]).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-medium">{PLAN_LABELS[r.type]}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.qty}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.totalValue)}</td>
                    <td className="px-3 py-2 text-right">{fmtPct(r.pct ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.perSaleCommission)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{fmt(r.totalCommission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {viewRecord.notes && (
              <p className="mt-3 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                <span className="font-semibold">Notes:</span> {viewRecord.notes}
              </p>
            )}
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleExportRow(viewRecord)}>
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleCSVRow(viewRecord)}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{total} saved renewal calculation{total !== 1 ? "s" : ""}</p>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={fetch} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {["Date", "Sales Person", "Period", "Renewals", "Business Value", "Status", "Commission", "Actions"].map(h => (
                  <th key={h} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap ${h === "Actions" || h === "Date" || h === "Sales Person" || h === "Period" ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3.5 bg-muted rounded animate-pulse" style={{ width: `${50 + (j * 11) % 40}%` }} /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-muted-foreground">No saved renewal calculations yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Use the Renewal Commission tab and click Save Calculation</p>
                  </td>
                </tr>
              ) : rows.map(row => {
                const status    = row.eligibilityStatus ?? "—"
                const isRelease = status === "RELEASE"
                return (
                  <tr key={row.id} className="border-b hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 font-medium text-xs">{row.salesPersonName}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{MONTH_NAMES[row.month - 1]} {row.year}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{row.totalQty}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{fmt(row.totalValue)}</td>
                    <td className="px-4 py-3 text-right">
                      {status !== "—" ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${
                          isRelease
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>{status}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-extrabold text-emerald-700">{fmt(row.totalCommission)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="View" onClick={() => setViewId(row.id)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="PDF" onClick={() => handleExportRow(row)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Excel" onClick={() => handleCSVRow(row)}>
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete" onClick={() => handleDelete(row.id)}
                            disabled={deleting === row.id}>
                            {deleting === row.id
                              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export function CommissionView() {
  const { user, permissions } = useAuthStore()
  const canEdit = (permissions as string[]).includes("commission:edit")
  const isAdmin = (permissions as string[]).includes("settings:edit")

  const safeUser = user ? { id: user.id, name: user.name ?? "Unknown" } : null

  const mobileUrl = typeof window !== "undefined"
    ? `${window.location.origin}/mobile/commission`
    : "/mobile/commission"

  const handleOpenMobile = () => window.open("/mobile/commission", "_blank")
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(mobileUrl)
      toast.success("Mobile URL copied to clipboard")
    } catch {
      toast.error("Could not copy URL")
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Commission Calculator"
        description="Calculate and track sales commissions for new customer signups based on performance tiers"
        icon={Calculator}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyUrl} className="gap-1.5 text-xs">
              <Copy className="h-3.5 w-3.5" /> Copy Mobile URL
            </Button>
            <Button size="sm" onClick={handleOpenMobile} className="gap-1.5 text-xs">
              <Smartphone className="h-3.5 w-3.5" /> Open Mobile Version
            </Button>
          </div>
        }
      />

      <div className="mt-4 flex-1 min-h-0">
        <Tabs defaultValue="calculator" className="flex flex-col h-full gap-4">
          <TabsList className="h-auto p-1 bg-muted/50 w-auto inline-flex shrink-0 flex-wrap gap-1">
            <TabsTrigger value="calculator" className="gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-3.5 w-3.5" /> New Signup
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
              <Clock className="h-3.5 w-3.5" /> Signup History
            </TabsTrigger>
            <TabsTrigger value="renewal" className="gap-1.5 text-xs sm:text-sm">
              <TrendingUp className="h-3.5 w-3.5" /> Renewal Commission
            </TabsTrigger>
            <TabsTrigger value="renewal-history" className="gap-1.5 text-xs sm:text-sm">
              <Clock className="h-3.5 w-3.5" /> Renewal History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calculator" className="mt-0 flex-1 overflow-auto pb-6">
            <NewSignupCalculator user={safeUser} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="history" className="mt-0 flex-1 overflow-auto pb-6">
            <CommissionHistory isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="renewal" className="mt-0 flex-1 overflow-auto pb-6">
            <RenewalCalculator user={safeUser} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="renewal-history" className="mt-0 flex-1 overflow-auto pb-6">
            <RenewalHistory isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
