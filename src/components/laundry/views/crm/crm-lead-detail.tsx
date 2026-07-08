"use client"

// Lead Detail — sales working view: header (status/assignee/convert), dynamic
// field info, activity timeline, tasks, activity logging.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2, ChevronLeft, Pencil, ArrowRightCircle, Phone, Mail, User,
  Clock, CheckCircle2, Circle, Plus,
} from "lucide-react"
import { toast } from "sonner"
import {
  type CrmLead, type CrmActivity, type CrmTask, type CrmEventRow,
  useCrmMeta, useCrmActor, parseValues, displayValue, fmtDateTime, fmtDate,
} from "./crm-shared"
import { LeadFormDialog } from "./crm-leads"
import { ConvertLeadDialog } from "./crm-convert-dialog"
import { LogActivityDialog, NewTaskDialog } from "./crm-activity-task-dialogs"

type LeadFull = CrmLead & {
  activities: CrmActivity[]
  tasks: CrmTask[]
  events: CrmEventRow[]
  opportunity?: { id: string; oppCode: string; state: string; name?: string } | null
}

export function CrmLeadDetail({ businessId, leadId, onBack }: { businessId: string; leadId: string; onBack: () => void }) {
  const meta = useCrmMeta(businessId)
  const actor = useCrmActor()
  const [lead, setLead] = useState<LeadFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [converting, setConverting] = useState(false)
  const [loggingActivity, setLoggingActivity] = useState(false)
  const [addingTask, setAddingTask] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/crm/leads/${leadId}?businessId=${encodeURIComponent(businessId)}`).then((r) => r.json())
      setLead(j.success ? j.data : null)
    } catch { setLead(null) } finally { setLoading(false) }
  }, [businessId, leadId])
  useEffect(() => { load() }, [load])

  const detailFields = useMemo(
    () => meta.fields.filter((f) => f.showInDetail).sort((a, b) => a.displayOrder - b.displayOrder),
    [meta.fields],
  )

  const changeStatus = async (statusId: string) => {
    const res = await fetch(`/api/laundry/crm/leads/${leadId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, statusId, ...actor }),
    })
    const j = await res.json()
    if (!res.ok || !j.success) return toast.error(j.error || "Update failed")
    toast.success("Status updated"); load()
  }

  const completeTask = async (task: CrmTask) => {
    await fetch(`/api/laundry/crm/tasks/${task.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, status: task.status === "COMPLETED" ? "OPEN" : "COMPLETED", ...actor }),
    })
    load()
  }

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading lead…</div>
  if (!lead) return (
    <div className="py-16 text-center">
      <p className="text-sm text-slate-500">Lead not found.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Back to Leads</Button>
    </div>
  )

  const values = parseValues(lead.fieldValues)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={onBack}><ChevronLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold tracking-tight">{lead.displayName}</h2>
              {lead.status && <Badge style={{ backgroundColor: `${lead.status.color}18`, color: lead.status.color }} className="border-0">{lead.status.name}</Badge>}
              {lead.converted && <Badge className="bg-green-100 text-green-700 border-0">Converted{lead.opportunity ? ` · ${lead.opportunity.oppCode}` : ""}</Badge>}
              {lead.archived && <Badge variant="outline" className="text-slate-400">Archived</Badge>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {lead.leadCode}
              {lead.source && <> · Source: {lead.source.name}</>}
              {lead.assignedToName && <> · <User className="inline h-3 w-3" /> {lead.assignedToName}</>}
              {" · "}Created {fmtDate(lead.createdAt)}
            </p>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-600">
              {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-blue-600" /> {lead.phone}</span>}
              {lead.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-blue-600" /> {lead.email}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={lead.statusId || ""} onValueChange={changeStatus}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Status…" /></SelectTrigger>
            <SelectContent>{meta.statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 gap-1" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          {!lead.converted && (
            <Button size="sm" className="h-9 gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => setConverting(true)}>
              <ArrowRightCircle className="h-4 w-4" /> Convert to Opportunity
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Left: info + timeline */}
        <div className="space-y-4 min-w-0">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Lead Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                {detailFields.map((f) => (
                  <div key={f.fieldKey} className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">{f.label}</p>
                    <p className="text-sm font-medium text-slate-700 break-words">{displayValue(f, values)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Timeline</CardTitle>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setLoggingActivity(true)}><Plus className="h-3.5 w-3.5" /> Log Activity</Button>
            </CardHeader>
            <CardContent>
              <Timeline events={lead.events} activities={lead.activities} />
            </CardContent>
          </Card>
        </div>

        {/* Right: tasks + activities summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Tasks</CardTitle>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setAddingTask(true)}><Plus className="h-3.5 w-3.5" /> Task</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {lead.tasks.length === 0 && <p className="text-xs text-slate-400">No tasks yet.</p>}
              {lead.tasks.map((t) => (
                <button key={t.id} onClick={() => completeTask(t)} className="w-full flex items-start gap-2 rounded-lg border p-2.5 text-left hover:bg-slate-50">
                  {t.status === "COMPLETED" ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" /> : <Circle className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${t.status === "COMPLETED" ? "line-through text-slate-400" : "text-slate-700"}`}>{t.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {t.priority !== "MEDIUM" && <span className={t.priority === "HIGH" || t.priority === "URGENT" ? "text-red-500" : ""}>{t.priority} · </span>}
                      {t.dueAt ? <>Due {fmtDateTime(t.dueAt)}</> : "No due date"}
                      {t.assignedToName && <> · {t.assignedToName}</>}
                    </p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Activities</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {lead.activities.length === 0 && <p className="text-xs text-slate-400">No activities logged yet.</p>}
              {lead.activities.slice(0, 6).map((a) => (
                <div key={a.id} className="rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                    <span className="text-[11px] text-slate-400 ml-auto">{fmtDateTime(a.activityAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 mt-1">{a.subject}</p>
                  {a.outcome && <p className="text-[11px] text-slate-500">Outcome: {a.outcome}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {editing && (
        <LeadFormDialog
          businessId={businessId} fields={meta.fields} sources={meta.sources}
          lead={lead} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load() }}
        />
      )}
      {converting && (
        <ConvertLeadDialog businessId={businessId} lead={lead} onClose={() => setConverting(false)}
          onConverted={() => { setConverting(false); load() }} />
      )}
      {loggingActivity && (
        <LogActivityDialog businessId={businessId} leadId={lead.id} activityTypes={meta.activityTypes}
          onClose={() => setLoggingActivity(false)} onSaved={() => { setLoggingActivity(false); load() }} />
      )}
      {addingTask && (
        <NewTaskDialog businessId={businessId} leadId={lead.id}
          onClose={() => setAddingTask(false)} onSaved={() => { setAddingTask(false); load() }} />
      )}
    </div>
  )
}

// Merged system events + logged activities, newest first.
export function Timeline({ events, activities }: { events: CrmEventRow[]; activities: CrmActivity[] }) {
  const items = [
    ...events.map((e) => ({ id: `e-${e.id}`, at: e.createdAt, title: e.label, sub: e.actorName, tag: tagFor(e.kind) })),
    ...activities.map((a) => ({ id: `a-${a.id}`, at: a.activityAt, title: `${a.type}: ${a.subject}`, sub: a.outcome ? `Outcome: ${a.outcome}` : a.createdByName, tag: "activity" as const })),
  ].sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())

  if (!items.length) return <p className="text-xs text-slate-400">No timeline entries yet.</p>
  return (
    <div className="relative space-y-0">
      {items.map((it, i) => (
        <div key={it.id} className="relative flex gap-3 pb-4">
          {i < items.length - 1 && <div className="absolute left-[7px] top-5 bottom-0 w-px bg-slate-200" />}
          <div className={`h-[15px] w-[15px] rounded-full border-2 shrink-0 mt-0.5 ${dotCls(it.tag)}`} />
          <div className="min-w-0">
            <p className="text-sm text-slate-700">{it.title}</p>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {fmtDateTime(it.at)}{it.sub ? ` · ${it.sub}` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function tagFor(kind: string): "create" | "won" | "lost" | "convert" | "system" {
  if (kind.includes("CREATED")) return "create"
  if (kind.includes("WON")) return "won"
  if (kind.includes("LOST")) return "lost"
  if (kind.includes("CONVERT")) return "convert"
  return "system"
}

function dotCls(tag: string): string {
  switch (tag) {
    case "create": return "border-blue-500 bg-blue-100"
    case "won": return "border-green-500 bg-green-100"
    case "lost": return "border-red-500 bg-red-100"
    case "convert": return "border-emerald-500 bg-emerald-100"
    case "activity": return "border-amber-400 bg-amber-50"
    default: return "border-slate-300 bg-white"
  }
}
