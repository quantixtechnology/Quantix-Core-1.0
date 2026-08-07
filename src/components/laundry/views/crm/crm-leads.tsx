"use client"

// CRM Leads — list (search / filters / sort / pagination / bulk actions /
// column config from field metadata) + dynamic create/edit dialog + detail.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Loader2, Plus, Search, Users, ChevronLeft, ChevronRight, MoreHorizontal,
  Pencil, Archive, ArrowRightCircle, Columns3, Download, UserPlus,
  Phone, Mail, Mic, MessageCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import {
  type CrmLead, type CrmField, useCrmMeta, useCrmActor, parseValues, parseOptions, displayValue, fmtDate,
} from "./crm-shared"
import { DynamicCrmFieldRenderer } from "./dynamic-crm-field-renderer"
import { CrmLeadDetail } from "./crm-lead-detail"
import { ConvertLeadDialog } from "./crm-convert-dialog"
import { RecordingDialog } from "./crm-communication-center"
import { type CommSettings, useCommSettings, telHref, waHref, mailtoHref, openDeepLink, useCommContext } from "./crm-comms"

const PAGE_SIZE = 20

export function CrmLeads({ businessId }: { businessId: string }) {
  const meta = useCrmMeta(businessId)
  const actor = useCrmActor()
  const { settings: commSettings } = useCommSettings(businessId)

  const [rows, setRows] = useState<CrmLead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [qInput, setQInput] = useState("")
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [statusId, setStatusId] = useState("ALL")
  const [sourceId, setSourceId] = useState("ALL")
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [visibleCols, setVisibleCols] = useState<Set<string> | null>(null)

  const [editorLead, setEditorLead] = useState<CrmLead | null>(null) // edit target
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [convertLead, setConvertLead] = useState<CrmLead | null>(null)
  const [recLead, setRecLead] = useState<CrmLead | null>(null)

  // Table columns from field config (showInList) — displayName/status/source are fixed.
  const listFields = useMemo(() => meta.fields.filter((f) => f.showInList && !["first_name", "last_name"].includes(f.fieldKey)), [meta.fields])
  const cols = visibleCols ?? new Set(listFields.map((f) => f.fieldKey))
  const filterableFields = useMemo(() => meta.fields.filter((f) => f.filterable && ["SELECT", "RADIO"].includes(f.type)), [meta.fields])

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId, q, page: String(page), pageSize: String(PAGE_SIZE) })
      if (statusId !== "ALL") params.set("statusId", statusId)
      if (sourceId !== "ALL") params.set("sourceId", sourceId)
      for (const [k, v] of Object.entries(fieldFilters)) if (v && v !== "ALL") params.set(`f_${k}`, v)
      const j = await fetch(`/api/laundry/crm/leads?${params}`).then((r) => r.json())
      setRows(j.success ? j.data : [])
      setTotal(j.total || 0)
      setSelected(new Set())
    } catch { setRows([]) } finally { setLoading(false) }
  }, [businessId, q, page, statusId, sourceId, fieldFilters])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (qTimer.current) clearTimeout(qTimer.current)
    qTimer.current = setTimeout(() => { setPage(1); setQ(qInput) }, 300)
    return () => { if (qTimer.current) clearTimeout(qTimer.current) }
  }, [qInput])

  const bulkPatch = async (patch: Record<string, unknown>, label: string) => {
    const ids = [...selected]
    if (!ids.length) return
    await Promise.all(ids.map((id) =>
      fetch(`/api/laundry/crm/leads/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, ...patch, ...actor }),
      })
    ))
    toast.success(`${ids.length} lead(s) ${label}`)
    load()
  }

  const exportCsv = () => {
    const fields = listFields.filter((f) => cols.has(f.fieldKey))
    const header = ["Lead ID", "Name", "Status", "Source", ...fields.map((f) => f.label), "Created"]
    const lines = rows.map((l) => {
      const values = parseValues(l.fieldValues)
      return [
        l.leadCode, l.displayName, l.status?.name || "", l.source?.name || "",
        ...fields.map((f) => displayValue(f, values).replace(/—/g, "")),
        fmtDate(l.createdAt),
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
    })
    const blob = new Blob([[header.map((h) => `"${h}"`).join(","), ...lines].join("\n")], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  if (detailId) {
    return <CrmLeadDetail businessId={businessId} leadId={detailId} onBack={() => { setDetailId(null); load() }} />
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /> Leads</h2>
          <p className="text-sm text-muted-foreground">Capture and work every enquiry until it converts.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"><Plus className="h-4 w-4" /> New Lead</Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search name, phone, email, ID…" className="pl-8 h-9 w-[260px]" />
        </div>
        <Select value={statusId} onValueChange={(v) => { setPage(1); setStatusId(v) }}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {meta.statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceId} onValueChange={(v) => { setPage(1); setSourceId(v) }}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Sources</SelectItem>
            {meta.sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {filterableFields.map((f) => (
          <Select key={f.id} value={fieldFilters[f.fieldKey] || "ALL"} onValueChange={(v) => { setPage(1); setFieldFilters((ff) => ({ ...ff, [f.fieldKey]: v })) }}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder={f.label} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All {f.label}</SelectItem>
              {parseOptions(f.options).filter((o) => o.active !== false).map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1 text-xs"><Columns3 className="h-3.5 w-3.5" /> Columns</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">Lead table columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {listFields.map((f) => (
                <DropdownMenuCheckboxItem key={f.fieldKey} checked={cols.has(f.fieldKey)}
                  onCheckedChange={(v) => {
                    const next = new Set(cols)
                    if (v) next.add(f.fieldKey); else next.delete(f.fieldKey)
                    setVisibleCols(next)
                  }} className="text-xs">
                  {f.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-9 gap-1 text-xs" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Export</Button>
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-xs font-medium text-blue-700">{selected.size} selected</span>
          <Select onValueChange={(v) => bulkPatch({ statusId: v }, "updated")}>
            <SelectTrigger className="h-8 w-[160px] bg-white text-xs"><SelectValue placeholder="Change status…" /></SelectTrigger>
            <SelectContent>{meta.statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <BulkAssign onAssign={(name) => bulkPatch({ assignedToId: name, assignedToName: name }, "assigned")} />
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => bulkPatch({ archived: true }, "archived")}><Archive className="h-3.5 w-3.5" /> Archive</Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading leads…</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="h-8 w-8 mx-auto text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">No Leads Yet</p>
              <p className="text-xs text-slate-400">Create your first lead to start managing your sales pipeline.</p>
              <Button onClick={() => setCreating(true)} size="sm" className="mt-3 gap-1 bg-blue-600 hover:bg-blue-700 text-white"><Plus className="h-4 w-4" /> New Lead</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())} /></TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    {listFields.filter((f) => cols.has(f.fieldKey)).map((f) => <TableHead key={f.fieldKey} className="whitespace-nowrap">{f.label}</TableHead>)}
                    <TableHead>Assigned</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((l) => {
                    const values = parseValues(l.fieldValues)
                    return (
                      <TableRow key={l.id} className="cursor-pointer" onClick={() => setDetailId(l.id)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selected.has(l.id)} onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(l.id); else n.delete(l.id); return n })} />
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-slate-800">{l.displayName}</p>
                          <p className="text-[11px] text-slate-400">{l.leadCode}</p>
                        </TableCell>
                        <TableCell>
                          {l.status ? <Badge style={{ backgroundColor: `${l.status.color}18`, color: l.status.color }} className="text-[11px] border-0">{l.status.name}</Badge> : "—"}
                          {l.converted && <Badge className="ml-1 bg-green-100 text-green-700 text-[10px] border-0">Converted</Badge>}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{l.source?.name || "—"}</TableCell>
                        {listFields.filter((f) => cols.has(f.fieldKey)).map((f) => (
                          <TableCell key={f.fieldKey} className="text-sm text-slate-600 whitespace-nowrap max-w-[180px] truncate">{displayValue(f, values)}</TableCell>
                        ))}
                        <TableCell className="text-sm text-slate-600">{l.assignedToName || "—"}</TableCell>
                        <TableCell className="text-sm text-slate-500 whitespace-nowrap">{fmtDate(l.createdAt)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="w-[120px]">
                          <LeadQuickActions lead={l} settings={commSettings} onRecord={() => setRecLead(l)} />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="text-xs gap-2" onClick={() => setDetailId(l.id)}><Search className="h-3.5 w-3.5" /> View</DropdownMenuItem>
                              <DropdownMenuItem className="text-xs gap-2" onClick={() => setEditorLead(l)}><Pencil className="h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                              {!l.converted && (
                                <DropdownMenuItem className="text-xs gap-2 text-green-700" onClick={() => setConvertLead(l)}><ArrowRightCircle className="h-3.5 w-3.5" /> Convert to Opportunity</DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-xs gap-2 text-red-600" onClick={() => bulkOne(l.id)}><Archive className="h-3.5 w-3.5" /> Archive</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{total} leads · page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {(creating || editorLead) && (
        <LeadFormDialog
          businessId={businessId}
          fields={meta.fields}
          sources={meta.sources}
          lead={editorLead}
          onClose={() => { setCreating(false); setEditorLead(null) }}
          onSaved={() => { setCreating(false); setEditorLead(null); load() }}
        />
      )}
      {convertLead && (
        <ConvertLeadDialog
          businessId={businessId}
          lead={convertLead}
          onClose={() => setConvertLead(null)}
          onConverted={() => { setConvertLead(null); load() }}
        />
      )}
      {recLead && (
        <RecordingDialog businessId={businessId} lead={recLead} onClose={() => setRecLead(null)} />
      )}
    </div>
  )

  async function bulkOne(id: string) {
    await fetch(`/api/laundry/crm/leads/${id}?businessId=${encodeURIComponent(businessId)}`, { method: "DELETE" })
    toast.success("Lead archived")
    load()
  }
}

// Quick per-row communication actions (Call / WhatsApp / Email / Recording).
function LeadQuickActions({ lead, settings, onRecord }: { lead: CrmLead; settings: CommSettings; onRecord: () => void }) {
  const comm = useCommContext(lead)
  const phone = comm.ctx.mobile
  const email = comm.ctx.email
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const btn = "p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:pointer-events-none"
  return (
    <span className="inline-flex items-center gap-0.5">
      {settings.enableCalls && phone && (
        <button type="button" title="Call" className={btn} onClick={(e) => { stop(e); openDeepLink(telHref(phone)) }}><Phone className="h-3.5 w-3.5" /></button>
      )}
      {settings.enableWhatsApp && phone && (
        <button type="button" title="WhatsApp" className={btn} onClick={(e) => { stop(e); openDeepLink(waHref(phone, `Hi ${comm.ctx.customerName},`)) }}><MessageCircle className="h-3.5 w-3.5 text-green-600" /></button>
      )}
      {settings.enableEmail && email && (
        <button type="button" title="Email" className={btn} onClick={(e) => { stop(e); openDeepLink(mailtoHref(email, "", "")) }}><Mail className="h-3.5 w-3.5 text-blue-600" /></button>
      )}
      {settings.enableRecordingUpload && (
        <button type="button" title="Add Recording" className={btn} onClick={(e) => { stop(e); onRecord() }}><Mic className="h-3.5 w-3.5 text-rose-500" /></button>
      )}
    </span>
  )
}

function BulkAssign({ onAssign }: { onAssign: (name: string) => void }) {
  const [name, setName] = useState("")
  return (
    <div className="flex items-center gap-1">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Assign to…" className="h-8 w-[140px] bg-white text-xs" />
      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" disabled={!name.trim()} onClick={() => { onAssign(name.trim()); setName("") }}><UserPlus className="h-3.5 w-3.5" /> Assign</Button>
    </div>
  )
}

// ─── Dynamic Lead Create / Edit ──────────────────────────────────────────────

export function LeadFormDialog({ businessId, fields, sources, lead, onClose, onSaved }: {
  businessId: string
  fields: CrmField[]
  sources: { id: string; name: string }[]
  lead: CrmLead | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!lead
  const actor = useCrmActor()
  const { user } = useAuthStore()
  const formFields = fields
    .filter((f) => f.active && (isEdit ? f.showInEdit : f.showInCreate))
    .sort((a, b) => a.displayOrder - b.displayOrder)

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    if (lead) return parseValues(lead.fieldValues)
    const init: Record<string, unknown> = {}
    for (const f of fields) if (f.defaultValue != null && f.defaultValue !== "") init[f.fieldKey] = f.defaultValue
    return init
  })
  const [sourceId, setSourceId] = useState(lead?.sourceId || "")
  const [assignedToName, setAssignedToName] = useState(lead?.assignedToName || user?.name || "")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    for (const f of formFields) {
      const v = values[f.fieldKey]
      if (f.required && (v == null || v === "" || (Array.isArray(v) && !v.length))) {
        return toast.error(`${f.label} is required`)
      }
    }
    setSaving(true)
    try {
      const payload = {
        businessId, values, sourceId: sourceId || null,
        assignedToId: assignedToName || null, assignedToName: assignedToName || null,
        ...actor,
      }
      const res = await fetch(isEdit ? `/api/laundry/crm/leads/${lead!.id}` : "/api/laundry/crm/leads", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
      toast.success(isEdit ? "Lead updated" : `Lead created — ${j.data.leadCode}`)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Lead — ${lead!.leadCode}` : "New Lead"}</DialogTitle>
          <DialogDescription className="text-xs">Fields are configured in CRM Settings → Lead Fields.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Lead Source + assignment are core selectors, not dynamic fields */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Lead Source</label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select source…" /></SelectTrigger>
              <SelectContent>{sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Assigned Employee</label>
            <Input value={assignedToName} onChange={(e) => setAssignedToName(e.target.value)} placeholder="Employee name" className="h-9" />
          </div>
          {formFields.map((f) => (
            <div key={f.fieldKey} className={["TEXTAREA", "ADDRESS"].includes(f.type) ? "sm:col-span-2" : undefined}>
              <DynamicCrmFieldRenderer field={f} value={values[f.fieldKey]} onChange={(v) => setValues((vv) => ({ ...vv, [f.fieldKey]: v }))} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />} {isEdit ? "Save Changes" : "Create Lead"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
