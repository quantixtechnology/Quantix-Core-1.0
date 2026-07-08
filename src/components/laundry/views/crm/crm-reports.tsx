"use client"

// CRM Reports — report picker + date/employee filters + CSV export.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, BarChart3, Download } from "lucide-react"
import { inr, fmtDate } from "./crm-shared"

const REPORTS = [
  { value: "leads", label: "Lead Report" },
  { value: "lead-sources", label: "Lead Source Report" },
  { value: "lead-statuses", label: "Lead Status Report" },
  { value: "conversion", label: "Lead Conversion Report" },
  { value: "pipeline", label: "Opportunity Pipeline Report" },
  { value: "won", label: "Won Opportunity Report" },
  { value: "lost", label: "Lost Opportunity Report" },
  { value: "lost-reasons", label: "Lost Reason Analysis" },
  { value: "employees", label: "Employee Performance Report" },
  { value: "stage-ageing", label: "Sales Stage Ageing Report" },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>

export function CrmReports({ businessId }: { businessId: string }) {
  const [type, setType] = useState("leads")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [data, setData] = useState<AnyRow[] | AnyRow | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId, type })
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      const j = await fetch(`/api/laundry/crm/reports?${params}`).then((r) => r.json())
      setData(j.success ? j.data : null)
    } catch { setData(null) } finally { setLoading(false) }
  }, [businessId, type, from, to])
  useEffect(() => { load() }, [load])

  const rows: AnyRow[] = Array.isArray(data) ? data : []

  const exportCsv = () => {
    if (!rows.length) return
    const cols = columnsFor(type)
    const header = cols.map((c) => `"${c.label}"`).join(",")
    const lines = rows.map((r) => cols.map((c) => `"${String(c.get(r)).replace(/"/g, '""')}"`).join(","))
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `crm-${type}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-600" /> CRM Reports</h2>
        <p className="text-sm text-muted-foreground">Lead, pipeline and performance reporting with export.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9 w-[240px]"><SelectValue /></SelectTrigger>
          <SelectContent>{REPORTS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
        <span className="text-xs text-slate-400">to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
        <Button variant="outline" size="sm" className="h-9 gap-1 text-xs ml-auto" onClick={exportCsv} disabled={!rows.length}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading report…</div>
          ) : type === "conversion" && data && !Array.isArray(data) ? (
            <ConversionSummary d={data} />
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No data for this report and range.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>{columnsFor(type).map((c) => <TableHead key={c.label} className="whitespace-nowrap">{c.label}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={r.id || i}>
                      {columnsFor(type).map((c) => <TableCell key={c.label} className="text-sm text-slate-600 whitespace-nowrap">{c.render ? c.render(r) : String(c.get(r))}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ConversionSummary({ d }: { d: AnyRow }) {
  const items = [
    { label: "Total Leads", value: d.totalLeads },
    { label: "Converted Leads", value: d.convertedLeads },
    { label: "Won Opportunities", value: d.wonOpportunities },
    { label: "Lead → Opportunity", value: `${d.leadToOpportunity}%` },
    { label: "Lead → Won", value: `${d.leadToWon}%` },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardHeader className="pb-1 pt-3"><CardTitle className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{it.label}</CardTitle></CardHeader>
          <CardContent className="pb-3"><p className="text-xl font-bold text-slate-800">{it.value}</p></CardContent>
        </Card>
      ))}
    </div>
  )
}

function columnsFor(type: string): { label: string; get: (r: AnyRow) => unknown; render?: (r: AnyRow) => React.ReactNode }[] {
  const stateBadge = (r: AnyRow) => (
    <Badge className={`text-[11px] border-0 ${r.state === "WON" ? "bg-green-100 text-green-700" : r.state === "LOST" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"}`}>{r.state}</Badge>
  )
  switch (type) {
    case "leads":
      return [
        { label: "Lead ID", get: (r) => r.leadCode },
        { label: "Name", get: (r) => r.displayName },
        { label: "Phone", get: (r) => r.phone || "—" },
        { label: "Status", get: (r) => r.status?.name || "—" },
        { label: "Source", get: (r) => r.source?.name || "—" },
        { label: "Assigned", get: (r) => r.assignedToName || "—" },
        { label: "Converted", get: (r) => (r.converted ? "Yes" : "No") },
        { label: "Opportunity", get: (r) => r.opportunity?.oppCode || "—" },
        { label: "Created", get: (r) => fmtDate(r.createdAt) },
      ]
    case "lead-sources":
      return [
        { label: "Source", get: (r) => r.name },
        { label: "Leads", get: (r) => r.leads },
        { label: "Converted", get: (r) => r.converted },
        { label: "Conversion %", get: (r) => (r.leads ? `${Math.round((r.converted / r.leads) * 1000) / 10}%` : "0%") },
      ]
    case "lead-statuses":
      return [
        { label: "Status", get: (r) => r.name },
        { label: "Behaviour", get: (r) => r.kind },
        { label: "Leads", get: (r) => r.leads },
      ]
    case "pipeline":
      return [
        { label: "Opportunity", get: (r) => `${r.name} (${r.oppCode})` },
        { label: "Lead", get: (r) => r.lead?.displayName || "—" },
        { label: "Stage", get: (r) => r.stage?.name || "—" },
        { label: "Value", get: (r) => r.value, render: (r) => inr(r.value) },
        { label: "Probability", get: (r) => (r.probability != null ? `${r.probability}%` : "—") },
        { label: "Expected Close", get: (r) => fmtDate(r.expectedCloseDate) },
        { label: "Assigned", get: (r) => r.assignedToName || "—" },
      ]
    case "won":
      return [
        { label: "Opportunity", get: (r) => `${r.name} (${r.oppCode})` },
        { label: "Lead", get: (r) => r.lead?.displayName || "—" },
        { label: "Final Value", get: (r) => r.wonValue ?? r.value, render: (r) => inr(r.wonValue ?? r.value) },
        { label: "Won Date", get: (r) => fmtDate(r.wonAt) },
        { label: "Assigned", get: (r) => r.assignedToName || "—" },
      ]
    case "lost":
      return [
        { label: "Opportunity", get: (r) => `${r.name} (${r.oppCode})` },
        { label: "Lead", get: (r) => r.lead?.displayName || "—" },
        { label: "Value", get: (r) => r.value, render: (r) => inr(r.value) },
        { label: "Lost Date", get: (r) => fmtDate(r.lostAt) },
        { label: "Reason", get: (r) => r.lostReason?.name || "—" },
        { label: "Notes", get: (r) => r.lostNotes || "—" },
      ]
    case "lost-reasons":
      return [
        { label: "Reason", get: (r) => r.name },
        { label: "Lost Deals", get: (r) => r.count },
        { label: "Lost Value", get: (r) => r.lostValue, render: (r) => inr(r.lostValue) },
      ]
    case "employees":
      return [
        { label: "Employee", get: (r) => r.name },
        { label: "Leads", get: (r) => r.leads },
        { label: "Converted", get: (r) => r.converted },
        { label: "Won", get: (r) => r.won },
        { label: "Won Value", get: (r) => r.wonValue, render: (r) => inr(r.wonValue) },
      ]
    case "stage-ageing":
      return [
        { label: "Stage", get: (r) => r.name },
        { label: "Avg Days in Stage", get: (r) => r.avgDays },
        { label: "Transitions", get: (r) => r.transitions },
      ]
    default:
      return [
        { label: "Opportunity", get: (r) => r.name },
        { label: "State", get: (r) => r.state, render: stateBadge },
      ]
  }
}
