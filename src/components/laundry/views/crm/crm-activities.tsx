"use client"

// CRM Activities — tenant-wide activity log across all leads/opportunities.

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Search, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react"
import { type CrmActivity, useCrmMeta, fmtDateTime } from "./crm-shared"

const PAGE_SIZE = 25

export function CrmActivities({ businessId }: { businessId: string }) {
  const meta = useCrmMeta(businessId)
  const [rows, setRows] = useState<CrmActivity[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [type, setType] = useState("ALL")
  const [q, setQ] = useState("")
  const [qInput, setQInput] = useState("")
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId, page: String(page), pageSize: String(PAGE_SIZE) })
      if (type !== "ALL") params.set("type", type)
      if (q) params.set("q", q)
      const j = await fetch(`/api/laundry/crm/activities?${params}`).then((r) => r.json())
      setRows(j.success ? j.data : [])
      setTotal(j.total || 0)
    } catch { setRows([]) } finally { setLoading(false) }
  }, [businessId, page, type, q])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (qTimer.current) clearTimeout(qTimer.current)
    qTimer.current = setTimeout(() => { setPage(1); setQ(qInput) }, 300)
    return () => { if (qTimer.current) clearTimeout(qTimer.current) }
  }, [qInput])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><ClipboardList className="h-5 w-5 text-blue-600" /> Activities</h2>
          <p className="text-sm text-muted-foreground">Every logged interaction across leads and opportunities.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search activities…" className="pl-8 h-9 w-[220px]" />
          </div>
          <Select value={type} onValueChange={(v) => { setPage(1); setType(v) }}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {meta.activityTypes.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading activities…</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center">
              <ClipboardList className="h-8 w-8 mx-auto text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">No Activities Yet</p>
              <p className="text-xs text-slate-400">Log calls, meetings and follow-ups from a lead or opportunity.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Related To</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">{fmtDateTime(a.activityAt)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[11px]">{a.type}</Badge></TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-slate-700">{a.subject}</p>
                        {a.description && <p className="text-[11px] text-slate-400 max-w-[280px] truncate">{a.description}</p>}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {a.lead ? <>Lead · {a.lead.displayName}</> : a.opportunity ? <>Opp · {a.opportunity.name}</> : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[200px] truncate">{a.outcome || "—"}</TableCell>
                      <TableCell className="text-sm text-slate-500">{a.createdByName || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{total} activities · page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  )
}
