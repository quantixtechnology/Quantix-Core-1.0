'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  ScrollText, Calendar, AlertTriangle, Users,
  Download, Search, RefreshCw, Eye, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/admin-fetch'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditLog {
  id:             string
  userId:         string | null
  userName:       string | null
  email:          string | null
  role:           string | null
  module:         string
  action:         string
  resourceType:   string | null
  resourceId:     string | null
  description:    string
  severity:       string
  ipAddress:      string | null
  browser:        string | null
  operatingSystem:string | null
  deviceType:     string | null
  createdAt:      string
}

interface AuditLogDetail extends AuditLog {
  page:      string | null
  oldValues: string | null
  newValues: string | null
  sessionId: string | null
}

interface Stats { todayCount: number; criticalCount: number }

const MODULES = [
  'AUTHENTICATION', 'PROPOSALS', 'LEADS', 'CRM', 'HRMS', 'COMMISSION',
  'SUBSCRIPTIONS', 'BRAND_STUDIO', 'USER_MANAGEMENT', 'ROLES_PERMISSIONS',
  'SETTINGS', 'DEPLOYMENT', 'WORKFLOW', 'SYSTEM',
]

const ACTIONS = [
  'LOGIN', 'LOGOUT', 'FAILED_LOGIN', 'PASSWORD_CHANGE', 'SESSION_EXPIRED',
  'PAGE_VIEW', 'CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'DOWNLOAD',
  'PREVIEW', 'EXPORT', 'SEND', 'ENABLE', 'DISABLE', 'ASSIGN', 'REVOKE',
  'GENERATE', 'DEPLOY',
]

// ─── Severity styling ─────────────────────────────────────────────────────────

const SEVERITY_BADGE: Record<string, string> = {
  INFO:     'bg-slate-100 text-slate-600 border-slate-200',
  WARNING:  'bg-amber-100 text-amber-700 border-amber-200',
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
}

const SEVERITY_ROW: Record<string, string> = {
  WARNING:  'bg-amber-50/40',
  CRITICAL: 'bg-red-50/60',
}

// ─── Action badge colours ─────────────────────────────────────────────────────

const ACTION_BADGE: Record<string, string> = {
  LOGIN:         'bg-purple-100 text-purple-700',
  LOGOUT:        'bg-slate-100 text-slate-600',
  FAILED_LOGIN:  'bg-red-100 text-red-700',
  CREATE:        'bg-emerald-100 text-emerald-700',
  UPDATE:        'bg-blue-100 text-blue-700',
  DELETE:        'bg-red-100 text-red-700',
  ARCHIVE:       'bg-amber-100 text-amber-700',
  DOWNLOAD:      'bg-sky-100 text-sky-700',
  PREVIEW:       'bg-indigo-100 text-indigo-700',
  DEPLOY:        'bg-orange-100 text-orange-700',
  EXPORT:        'bg-teal-100 text-teal-700',
  ASSIGN:        'bg-violet-100 text-violet-700',
  DISABLE:       'bg-red-100 text-red-700',
  ENABLE:        'bg-emerald-100 text-emerald-700',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

function tryParseJson(s: string | null): unknown {
  if (!s) return null
  try { return JSON.parse(s) } catch { return s }
}

function PrettyJson({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground text-xs italic">—</span>
  return (
    <pre className="text-[11px] font-mono bg-muted/50 border rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function AuditDetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<AuditLogDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) { setDetail(null); return }
    setLoading(true)
    authFetch(`/api/admin/audit-logs/${id}`)
      .then(r => r.json())
      .then(j => { if (j.success) setDetail(j.data) })
      .catch(() => toast.error('Failed to load detail'))
      .finally(() => setLoading(false))
  }, [id])

  const { date, time } = detail ? formatTimestamp(detail.createdAt) : { date: '', time: '' }

  return (
    <Sheet open={!!id} onOpenChange={open => { if (!open) onClose() }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            Audit Log Detail
          </SheetTitle>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && detail && (
          <div className="space-y-5 text-sm">
            {/* Severity + action row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-[10px] border ${SEVERITY_BADGE[detail.severity] ?? SEVERITY_BADGE.INFO}`}>
                {detail.severity}
              </Badge>
              <Badge className={`text-[10px] ${ACTION_BADGE[detail.action] ?? 'bg-gray-100 text-gray-600'}`}>
                {detail.action}
              </Badge>
              <Badge variant="outline" className="text-[10px]">{detail.module}</Badge>
            </div>

            {/* Description */}
            <p className="font-medium">{detail.description}</p>

            {/* User info */}
            <Section title="User">
              <Row label="Name"  value={detail.userName} />
              <Row label="Email" value={detail.email} />
              <Row label="Role"  value={detail.role} />
              <Row label="ID"    value={detail.userId} mono />
            </Section>

            {/* Action details */}
            <Section title="Action Details">
              <Row label="Module"        value={detail.module} />
              <Row label="Action"        value={detail.action} />
              <Row label="Resource Type" value={detail.resourceType} />
              <Row label="Resource ID"   value={detail.resourceId} mono />
              <Row label="Page"          value={detail.page} />
            </Section>

            {/* Technical */}
            <Section title="Technical Info">
              <Row label="IP Address"  value={detail.ipAddress} mono />
              <Row label="Browser"     value={detail.browser} />
              <Row label="OS"          value={detail.operatingSystem} />
              <Row label="Device"      value={detail.deviceType} />
              <Row label="Session ID"  value={detail.sessionId} mono />
              <Row label="Timestamp"   value={`${date} ${time}`} />
            </Section>

            {/* Before / After */}
            {(detail.oldValues || detail.newValues) && (
              <Section title="Data Changes">
                {detail.oldValues && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Before</p>
                    <PrettyJson value={tryParseJson(detail.oldValues)} />
                  </div>
                )}
                {detail.newValues && (
                  <div className="space-y-1.5 mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">After</p>
                    <PrettyJson value={tryParseJson(detail.newValues)} />
                  </div>
                )}
              </Section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      <span className={`text-xs text-right break-all ${mono ? 'font-mono' : 'font-medium'}`}>
        {value || '—'}
      </span>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function AuditLogsView() {
  const [logs, setLogs]             = useState<AuditLog[]>([])
  const [loading, setLoading]       = useState(true)
  const [stats, setStats]           = useState<Stats>({ todayCount: 0, criticalCount: 0 })
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [detailId, setDetailId]     = useState<string | null>(null)

  // Filters
  const [search,   setSearch]   = useState('')
  const [module,   setModule]   = useState('')
  const [action,   setAction]   = useState('')
  const [severity, setSeverity] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const LIMIT = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      p.set('limit', String(LIMIT))
      p.set('page',  String(page))
      if (search)   p.set('search',   search)
      if (module)   p.set('module',   module)
      if (action)   p.set('action',   action)
      if (severity) p.set('severity', severity)
      if (dateFrom) p.set('dateFrom', dateFrom)
      if (dateTo)   p.set('dateTo',   dateTo)

      const res  = await authFetch(`/api/admin/audit-logs?${p}`)
      const json = await res.json()
      if (json.success) {
        setLogs(json.data)
        setStats(json.stats ?? { todayCount: 0, criticalCount: 0 })
        setTotal(json.pagination.total ?? 0)
        setTotalPages(json.pagination.pages ?? 1)
      } else {
        toast.error(json.error ?? 'Failed to load audit logs')
      }
    } catch {
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [page, search, module, action, severity, dateFrom, dateTo])

  useEffect(() => { fetchLogs() }, [fetchLogs])
  useEffect(() => { setPage(1) }, [search, module, action, severity, dateFrom, dateTo])

  const handleExport = async () => {
    try {
      const p = new URLSearchParams()
      p.set('export', 'csv')
      if (search)   p.set('search',   search)
      if (module)   p.set('module',   module)
      if (action)   p.set('action',   action)
      if (severity) p.set('severity', severity)
      if (dateFrom) p.set('dateFrom', dateFrom)
      if (dateTo)   p.set('dateTo',   dateTo)

      const res = await authFetch(`/api/admin/audit-logs?${p}`)
      if (!res.ok) { toast.error('Export failed'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  const statCards = [
    { label: 'Total Events', value: total.toLocaleString('en-IN'), icon: ScrollText, color: 'text-slate-600 bg-slate-50 border-slate-100' },
    { label: 'Today',        value: stats.todayCount.toString(),     icon: Calendar,    color: 'text-blue-600  bg-blue-50  border-blue-100' },
    { label: 'Critical',     value: stats.criticalCount.toString(),  icon: AlertTriangle, color: 'text-red-600  bg-red-50   border-red-100' },
    { label: 'Showing',      value: logs.length.toString(),          icon: Users,       color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  ]

  return (
    <div className="animate-in fade-in duration-300 space-y-5">

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">{s.label}</p>
                <p className="text-xl font-bold leading-none">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Search user, action, description…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Module */}
            <Select value={module || 'ALL'} onValueChange={v => setModule(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="All Modules" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Modules</SelectItem>
                {MODULES.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Action */}
            <Select value={action || 'ALL'} onValueChange={v => setAction(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All Actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Actions</SelectItem>
                {ACTIONS.map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Severity */}
            <Select value={severity || 'ALL'} onValueChange={v => setSeverity(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="All Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL"      className="text-xs">All Severity</SelectItem>
                <SelectItem value="INFO"     className="text-xs">INFO</SelectItem>
                <SelectItem value="WARNING"  className="text-xs">WARNING</SelectItem>
                <SelectItem value="CRITICAL" className="text-xs">CRITICAL</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range */}
            <input
              type="date"
              className="h-8 text-xs rounded-md border bg-background px-2"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              title="From date"
            />
            <input
              type="date"
              className="h-8 text-xs rounded-md border bg-background px-2"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              title="To date"
            />

            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={fetchLogs} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                {['Time', 'User', 'Module', 'Action', 'Description', 'Severity', 'IP', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 bg-muted animate-pulse rounded" style={{ width: `${40 + (j * 11) % 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : logs.length === 0
                ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                          <ScrollText className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-muted-foreground">No audit logs found</p>
                        <p className="text-xs text-muted-foreground">Actions by Quantix team members will appear here.</p>
                      </div>
                    </td>
                  </tr>
                )
                : logs.map((log, idx) => {
                    const { date, time } = formatTimestamp(log.createdAt)
                    const rowBg = SEVERITY_ROW[log.severity] ?? (idx % 2 !== 0 ? 'bg-muted/5' : '')
                    return (
                      <tr key={log.id} className={`border-b transition-colors hover:bg-muted/20 ${rowBg}`}>
                        {/* Time */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-mono text-muted-foreground">{time}</p>
                          <p className="text-[10px] text-muted-foreground/70">{date}</p>
                        </td>

                        {/* User */}
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{log.userName || '—'}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{log.email || ''}</p>
                        </td>

                        {/* Module */}
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px] font-medium whitespace-nowrap">
                            {log.module}
                          </Badge>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3">
                          <Badge className={`text-[10px] whitespace-nowrap ${ACTION_BADGE[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                            {log.action}
                          </Badge>
                        </td>

                        {/* Description */}
                        <td className="px-4 py-3 max-w-[220px]">
                          <p className="truncate" title={log.description}>{log.description}</p>
                          {log.resourceType && (
                            <p className="text-[10px] text-muted-foreground">{log.resourceType}{log.resourceId ? ` · ${log.resourceId}` : ''}</p>
                          )}
                        </td>

                        {/* Severity */}
                        <td className="px-4 py-3">
                          <Badge className={`text-[10px] border ${SEVERITY_BADGE[log.severity] ?? SEVERITY_BADGE.INFO}`}>
                            {log.severity}
                          </Badge>
                        </td>

                        {/* IP */}
                        <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                          {log.ipAddress || '—'}
                        </td>

                        {/* View */}
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setDetailId(log.id)}
                            title="View details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && logs.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total.toLocaleString('en-IN')} events
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-medium min-w-[60px] text-center">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ─────────────────────────────────────────── */}
      <AuditDetailDrawer id={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
