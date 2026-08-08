"use client"

// CRM Settings — tenant configuration for the optional CRM module:
// Lead Fields (dynamic field builder), Lead Statuses, Lead Sources,
// Sales Stages, Lost Reasons, Activity Types. Everything is per-tenant.

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Loader2, Plus, Settings, ChevronUp, ChevronDown, Pencil, ListChecks,
  Tags, Waypoints, XCircle, ClipboardList, FormInput, MessagesSquare, Trash2, Flag, CheckSquare,
  Circle, Phone, Mail, User, Target, TrendingUp, CheckCircle2, XSquare, Clock, Star, Hourglass,
} from "lucide-react"
import { toast } from "sonner"
import { CrmCommunicationSettings } from "./crm-communication-settings"
import {
  type CrmField, type CrmFieldOption, type CrmPriority, type CrmTaskType, useCrmMeta, parseOptions,
} from "./crm-shared"

const FIELD_TYPES: { value: string; label: string; hasOptions?: boolean }[] = [
  { value: "TEXT", label: "Text" },
  { value: "TEXTAREA", label: "Paragraph / Text Area" },
  { value: "PHONE", label: "Phone" },
  { value: "EMAIL", label: "Email" },
  { value: "NUMBER", label: "Number" },
  { value: "DECIMAL", label: "Decimal" },
  { value: "CURRENCY", label: "Currency" },
  { value: "DATE", label: "Date" },
  { value: "DATETIME", label: "Date & Time" },
  { value: "SELECT", label: "Dropdown / Select", hasOptions: true },
  { value: "MULTISELECT", label: "Multi Select", hasOptions: true },
  { value: "RADIO", label: "Radio Button", hasOptions: true },
  { value: "CHECKBOX", label: "Checkbox" },
  { value: "TOGGLE", label: "Toggle / Yes-No" },
  { value: "URL", label: "URL" },
  { value: "ADDRESS", label: "Address / Long Text" },
]
const typeLabel = (t: string) => FIELD_TYPES.find((f) => f.value === t)?.label || t
const hasOptions = (t: string) => !!FIELD_TYPES.find((f) => f.value === t)?.hasOptions

export function CrmSettings({ businessId }: { businessId: string }) {
  const meta = useCrmMeta(businessId, { includeInactive: true })

  if (meta.loading) return <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading CRM settings…</div>

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><Settings className="h-5 w-5 text-blue-600" /> CRM Settings</h2>
        <p className="text-sm text-muted-foreground">Configure lead fields, statuses, sources, sales stages, lost reasons and activity types for your business.</p>
      </div>

      <Tabs defaultValue="fields">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="fields" className="gap-1.5"><FormInput className="h-3.5 w-3.5" /> Lead Fields</TabsTrigger>
          <TabsTrigger value="statuses" className="gap-1.5"><ListChecks className="h-3.5 w-3.5" /> Lead Statuses</TabsTrigger>
          <TabsTrigger value="sources" className="gap-1.5"><Tags className="h-3.5 w-3.5" /> Lead Sources</TabsTrigger>
          <TabsTrigger value="stages" className="gap-1.5"><Waypoints className="h-3.5 w-3.5" /> Sales Stages</TabsTrigger>
          <TabsTrigger value="lost-reasons" className="gap-1.5"><XCircle className="h-3.5 w-3.5" /> Lost Reasons</TabsTrigger>
          <TabsTrigger value="activity-types" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Activity Types</TabsTrigger>
          <TabsTrigger value="priorities" className="gap-1.5"><Flag className="h-3.5 w-3.5" /> Priorities</TabsTrigger>
          <TabsTrigger value="task-types" className="gap-1.5"><CheckSquare className="h-3.5 w-3.5" /> Task Types</TabsTrigger>
          <TabsTrigger value="communication" className="gap-1.5"><MessagesSquare className="h-3.5 w-3.5" /> Communication</TabsTrigger>
        </TabsList>

        <TabsContent value="fields"><LeadFieldBuilder businessId={businessId} fields={meta.fields} reload={meta.reload} /></TabsContent>
        <TabsContent value="statuses"><StatusConfig businessId={businessId} rows={meta.statuses} reload={meta.reload} /></TabsContent>
        <TabsContent value="sources">
          <SimpleConfig businessId={businessId} rows={meta.sources} reload={meta.reload} endpoint="lead-sources"
            title="Lead Sources" description="Where leads come from (Walk-in, Website, Referral…). Historical leads keep inactive sources." hasColor />
        </TabsContent>
        <TabsContent value="stages"><StageConfig businessId={businessId} rows={meta.stages} reload={meta.reload} /></TabsContent>
        <TabsContent value="lost-reasons">
          <SimpleConfig businessId={businessId} rows={meta.lostReasons} reload={meta.reload} endpoint="lost-reasons"
            title="Lost Reasons" description="Required when an opportunity is marked lost. Deactivate instead of deleting — history stays intact." />
        </TabsContent>
        <TabsContent value="activity-types">
          <SimpleConfig businessId={businessId} rows={meta.activityTypes} reload={meta.reload} endpoint="activity-types"
            title="Activity Types" description="Types available when logging CRM activities (Call, Meeting, WhatsApp…)." />
        </TabsContent>
        <TabsContent value="task-types">
          <SimpleConfig businessId={businessId} rows={meta.taskTypes} reload={meta.reload} endpoint="task-types"
            title="Task Types" description="Categories for CRM tasks (Follow-up, Call, Meeting…). System types are protected." hasColor
            onDelete safetyNote="Tasks using this type are moved to the target type." />
        </TabsContent>
        <TabsContent value="priorities">
          <SimpleConfig businessId={businessId} rows={meta.priorities} reload={meta.reload} endpoint="priorities"
            title="Priorities" description="Lead & opportunity priority levels (Low / Medium / High…). The default applies to new records." hasColor
            onDelete safetyNote="Leads & opportunities using this priority are moved to the target." defaultable />
        </TabsContent>
        <TabsContent value="communication"><CrmCommunicationSettings businessId={businessId} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── shared helpers ──────────────────────────────────────────────────────────

async function putJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const j = await res.json().catch(() => ({}))
  return { ok: res.ok && j.success !== false, error: j.error }
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const j = await res.json().catch(() => ({}))
  return { ok: res.ok && j.success !== false, error: j.error }
}

// Reorder helper: swap displayOrder with the neighbour.
function useReorder(businessId: string, endpoint: string, reload: () => void) {
  return async (rows: { id: string; displayOrder: number }[], index: number, dir: -1 | 1) => {
    const other = index + dir
    if (other < 0 || other >= rows.length) return
    const a = rows[index]; const b = rows[other]
    await Promise.all([
      putJson(`/api/laundry/crm/settings/${endpoint}/${a.id}`, { businessId, displayOrder: b.displayOrder }),
      putJson(`/api/laundry/crm/settings/${endpoint}/${b.id}`, { businessId, displayOrder: a.displayOrder }),
    ])
    reload()
  }
}

function RowShell({ children, inactive }: { children: React.ReactNode; inactive?: boolean }) {
  return <div className={`flex items-center gap-3 rounded-lg border p-3 ${inactive ? "opacity-50 bg-slate-50" : "bg-white"}`}>{children}</div>
}

function OrderButtons({ onUp, onDown, upDisabled, downDisabled }: { onUp: () => void; onDown: () => void; upDisabled: boolean; downDisabled: boolean }) {
  return (
    <div className="flex flex-col shrink-0">
      <button onClick={onUp} disabled={upDisabled} className="text-slate-400 hover:text-blue-600 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
      <button onClick={onDown} disabled={downDisabled} className="text-slate-400 hover:text-blue-600 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
    </div>
  )
}

// ─── Simple config lists (sources / lost reasons / activity types) ──────────

interface SimpleRow { id: string; name: string; color?: string; displayOrder: number; active: boolean }

interface SimpleRow { id: string; name: string; color?: string; displayOrder: number; active: boolean; isDefault?: boolean; isSystem?: boolean }

function SimpleConfig({ businessId, rows, reload, endpoint, title, description, hasColor, onDelete, safetyNote, defaultable }: {
  businessId: string; rows: SimpleRow[]; reload: () => void
  endpoint: string; title: string; description: string; hasColor?: boolean
  onDelete?: boolean; safetyNote?: string; defaultable?: boolean
}) {
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState(false)
  const [delTarget, setDelTarget] = useState<SimpleRow | null>(null)
  const [delReassign, setDelReassign] = useState("")
  const [deleting, setDeleting] = useState(false)
  const reorder = useReorder(businessId, endpoint, reload)

  const add = async () => {
    if (!newName.trim()) return
    setBusy(true)
    const r = await postJson(`/api/laundry/crm/settings/${endpoint}`, { businessId, name: newName.trim() })
    setBusy(false)
    if (!r.ok) return toast.error(r.error || "Create failed")
    setNewName(""); toast.success(`${title.slice(0, -1)} added`); reload()
  }
  const update = async (id: string, patch: Record<string, unknown>) => {
    const r = await putJson(`/api/laundry/crm/settings/${endpoint}/${id}`, { businessId, ...patch })
    if (!r.ok) return toast.error(r.error || "Update failed")
    reload()
  }

  const otherRows = delTarget ? rows.filter((r) => r.id !== delTarget.id) : []
  const reassignKey = endpoint === "priorities" ? "reassignPriorityId" : endpoint === "task-types" ? "reassignTaskTypeId" : "reassignId"

  const doDelete = async () => {
    if (!delTarget) return
    setDeleting(true)
    const r = await fetch(`/api/laundry/crm/settings/${endpoint}/${delTarget.id}?businessId=${encodeURIComponent(businessId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [reassignKey]: delReassign || null }),
    }).then((res) => res.json().catch(() => ({})))
    setDeleting(false)
    if (r.success !== true) return toast.error(r.error || "Delete failed")
    setDelTarget(null); setDelReassign(""); toast.success(`${title.slice(0, -1)} deleted`); reload()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row, i) => (
          <RowShell key={row.id} inactive={!row.active}>
            <OrderButtons onUp={() => reorder(rows, i, -1)} onDown={() => reorder(rows, i, 1)} upDisabled={i === 0} downDisabled={i === rows.length - 1} />
            {hasColor && (
              <input type="color" value={row.color || "#64748B"} onChange={(e) => update(row.id, { color: e.target.value })}
                className="h-6 w-6 rounded border border-slate-200 cursor-pointer shrink-0" />
            )}
            <InlineRename name={row.name} onSave={(name) => update(row.id, { name })} />
            {row.isDefault && <Badge className="bg-blue-100 text-blue-700 text-[10px] shrink-0">Default</Badge>}
            {row.isSystem && <Badge variant="outline" className="text-[10px] text-slate-400 shrink-0">System</Badge>}
            <div className="ml-auto flex items-center gap-2">
              {!row.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
              {defaultable && !row.isDefault && row.active && !row.isSystem && (
                <button className="text-[11px] text-slate-400 hover:text-blue-600 shrink-0" onClick={() => update(row.id, { isDefault: true })}>Set default</button>
              )}
              <Switch checked={row.active} onCheckedChange={(v) => update(row.id, { active: v })} className="data-[state=checked]:bg-blue-600" />
              {onDelete && !row.isSystem && (
                <Button variant="ghost" size="sm" className="h-8 w-8 px-0 text-slate-400 hover:text-red-600" disabled={row.isDefault && defaultable} onClick={() => setDelTarget(row)} title="Delete">  <Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
          </RowShell>
        ))}
        <div className="flex gap-2 pt-1">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={`New ${title.slice(0, -1).toLowerCase()} name…`} className="h-9 max-w-xs" />
          <Button onClick={add} disabled={busy || !newName.trim()} className="h-9 gap-1 bg-blue-600 hover:bg-blue-700 text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add</Button>
        </div>
      </CardContent>

      {delTarget && (
        <Dialog open onOpenChange={(o) => !o && setDelTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete “{delTarget.name}”</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">{safetyNote || "Move existing records first or choose a target."}</DialogDescription>
            </DialogHeader>
            {otherRows.length > 0 ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Move existing records to…</Label>
                <Select value={delReassign} onValueChange={setDelReassign}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select a target…" /></SelectTrigger>
                  <SelectContent>
                    {otherRows.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No other {title.slice(0, -1).toLowerCase()}s exist to move records to.</p>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDelTarget(null)}>Cancel</Button>
              <Button disabled={deleting || otherRows.length === 0 || !delReassign} onClick={doDelete} className="gap-1 bg-red-600 hover:bg-red-700 text-white">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}

const iconMap: Record<string, typeof Circle> = { Circle, Phone, Mail, User, Target, TrendingUp, CheckCircle2, XSquare, Clock, Star, Hourglass, Flag }
function IconChip({ icon }: { icon: string | null }) {
  const Icon = icon ? iconMap[icon] : null
  return <span className="shrink-0 text-slate-400">{Icon ? <Icon className="h-4 w-4" /> : <Circle className="h-4 w-4 text-slate-200" />}</span>
}

function InlineRename({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(name)
  useEffect(() => setVal(name), [name])
  if (!editing) {
    return (
      <button className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-blue-700 min-w-0" onClick={() => setEditing(true)}>
        <span className="truncate">{name}</span><Pencil className="h-3 w-3 opacity-40 shrink-0" />
      </button>
    )
  }
  const commit = () => { setEditing(false); if (val.trim() && val.trim() !== name) onSave(val.trim()) }
  return <Input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(name); setEditing(false) } }} className="h-8 max-w-[220px]" />
}

// ─── Lead Statuses ───────────────────────────────────────────────────────────

const STATUS_KINDS = [
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
  { value: "CONVERTED", label: "Converted" },
  { value: "LOST", label: "Lost" },
]

interface StatusRow { id: string; name: string; color: string; icon: string | null; displayOrder: number; active: boolean; isDefault: boolean; kind: string; allowConversion: boolean; isSystem: boolean }

function StatusConfig({ businessId, rows, reload }: { businessId: string; rows: StatusRow[]; reload: () => void }) {
  const [newName, setNewName] = useState("")
  const [newKind, setNewKind] = useState("OPEN")
  const [busy, setBusy] = useState(false)
  const reorder = useReorder(businessId, "lead-statuses", reload)

  const update = async (id: string, patch: Record<string, unknown>) => {
    const r = await putJson(`/api/laundry/crm/settings/lead-statuses/${id}`, { businessId, ...patch })
    if (!r.ok) return toast.error(r.error || "Update failed")
    reload()
  }
  const add = async () => {
    if (!newName.trim()) return
    setBusy(true)
    const r = await postJson(`/api/laundry/crm/settings/lead-statuses`, { businessId, name: newName.trim(), kind: newKind })
    setBusy(false)
    if (!r.ok) return toast.error(r.error || "Create failed")
    setNewName(""); toast.success("Status added"); reload()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Lead Statuses</CardTitle>
        <CardDescription className="text-xs">
          Behaviour comes from the <b>kind</b> (Open / Closed / Converted / Lost), not the display name — rename freely.
          The default status is applied to new leads. Statuses with conversion off can&apos;t be converted to opportunities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row, i) => (
          <RowShell key={row.id} inactive={!row.active}>
            <OrderButtons onUp={() => reorder(rows, i, -1)} onDown={() => reorder(rows, i, 1)} upDisabled={i === 0} downDisabled={i === rows.length - 1} />
            <input type="color" value={row.color} onChange={(e) => update(row.id, { color: e.target.value })} className="h-6 w-6 rounded border border-slate-200 cursor-pointer shrink-0" />
            <IconChip icon={row.icon} />
            <InlineRename name={row.name} onSave={(name) => update(row.id, { name })} />
            <Badge variant="outline" className="text-[10px] shrink-0">{STATUS_KINDS.find((k) => k.value === row.kind)?.label || row.kind}</Badge>
            {row.isDefault && <Badge className="bg-blue-100 text-blue-700 text-[10px] shrink-0">Default</Badge>}
            {row.isSystem && <Badge variant="outline" className="text-[10px] text-slate-400 shrink-0">System</Badge>}
            <div className="ml-auto flex items-center gap-3 shrink-0">
              {!row.isDefault && row.active && (
                <button className="text-[11px] text-slate-400 hover:text-blue-600" onClick={() => update(row.id, { isDefault: true })}>Set default</button>
              )}
              <label className="flex items-center gap-1 text-[11px] text-slate-500">
                <Switch checked={row.allowConversion} onCheckedChange={(v) => update(row.id, { allowConversion: v })} className="scale-75 data-[state=checked]:bg-green-600" /> Convert
              </label>
              <Switch checked={row.active} onCheckedChange={(v) => update(row.id, { active: v })} disabled={row.isSystem} className="data-[state=checked]:bg-blue-600" />
            </div>
          </RowShell>
        ))}
        <div className="flex gap-2 pt-1 flex-wrap">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="New status name…" className="h-9 max-w-xs" />
          <Select value={newKind} onValueChange={setNewKind}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={add} disabled={busy || !newName.trim()} className="h-9 gap-1 bg-blue-600 hover:bg-blue-700 text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Sales Stages ────────────────────────────────────────────────────────────

const STAGE_TYPES = [
  { value: "OPEN", label: "Open", cls: "bg-blue-100 text-blue-700" },
  { value: "WON", label: "Won", cls: "bg-green-100 text-green-700" },
  { value: "LOST", label: "Lost", cls: "bg-red-100 text-red-700" },
]

interface StageRow { id: string; name: string; color: string; icon: string | null; displayOrder: number; active: boolean; probability: number; stageType: string; isInitial: boolean; locked: boolean }

function StageConfig({ businessId, rows, reload }: { businessId: string; rows: StageRow[]; reload: () => void }) {
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState("OPEN")
  const [busy, setBusy] = useState(false)
  const reorder = useReorder(businessId, "sales-stages", reload)

  const update = async (id: string, patch: Record<string, unknown>) => {
    const r = await putJson(`/api/laundry/crm/settings/sales-stages/${id}`, { businessId, ...patch })
    if (!r.ok) return toast.error(r.error || "Update failed")
    reload()
  }
  const add = async () => {
    if (!newName.trim()) return
    setBusy(true)
    const r = await postJson(`/api/laundry/crm/settings/sales-stages`, { businessId, name: newName.trim(), stageType: newType })
    setBusy(false)
    if (!r.ok) return toast.error(r.error || "Create failed")
    setNewName(""); toast.success("Stage added"); reload()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Sales Stages</CardTitle>
        <CardDescription className="text-xs">
          Open stages become pipeline columns. Behaviour comes from the <b>stage type</b> (Open / Won / Lost), never the name —
          rename &quot;Won&quot; to &quot;Deal Closed&quot; and it still behaves as won. At least one active stage of each type must remain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row, i) => {
          const t = STAGE_TYPES.find((x) => x.value === row.stageType)
          return (
            <RowShell key={row.id} inactive={!row.active}>
              <OrderButtons onUp={() => reorder(rows, i, -1)} onDown={() => reorder(rows, i, 1)} upDisabled={i === 0} downDisabled={i === rows.length - 1} />
              <input type="color" value={row.color} onChange={(e) => update(row.id, { color: e.target.value })} className="h-6 w-6 rounded border border-slate-200 cursor-pointer shrink-0" />
              <IconChip icon={row.icon} />
              <InlineRename name={row.name} onSave={(name) => update(row.id, { name })} />
              <Badge className={`text-[10px] shrink-0 ${t?.cls || ""}`}>{t?.label || row.stageType}</Badge>
              {row.isInitial && <Badge className="bg-blue-100 text-blue-700 text-[10px] shrink-0">Initial</Badge>}
              {row.locked && <Badge variant="outline" className="text-[10px] text-amber-600 shrink-0">Locked</Badge>}
              <div className="ml-auto flex items-center gap-3 shrink-0">
                <label className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Input type="number" min={0} max={100} value={row.probability}
                    onChange={(e) => update(row.id, { probability: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                    className="h-7 w-16 text-xs" /> %
                </label>
                {!row.isInitial && row.active && row.stageType === "OPEN" && (
                  <button className="text-[11px] text-slate-400 hover:text-blue-600" onClick={() => update(row.id, { isInitial: true })}>Set initial</button>
                )}
                <Switch checked={row.active} onCheckedChange={(v) => update(row.id, { active: v })} className="data-[state=checked]:bg-blue-600" />
              </div>
            </RowShell>
          )
        })}
        <div className="flex gap-2 pt-1 flex-wrap">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="New stage name…" className="h-9 max-w-xs" />
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>{STAGE_TYPES.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={add} disabled={busy || !newName.trim()} className="h-9 gap-1 bg-blue-600 hover:bg-blue-700 text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Lead Field Builder ──────────────────────────────────────────────────────

function LeadFieldBuilder({ businessId, fields, reload }: { businessId: string; fields: CrmField[]; reload: () => void }) {
  const [editField, setEditField] = useState<CrmField | null>(null)
  const [creating, setCreating] = useState(false)
  const reorder = useReorder(businessId, "lead-fields", reload)

  const update = async (id: string, patch: Record<string, unknown>) => {
    const r = await putJson(`/api/laundry/crm/settings/lead-fields/${id}`, { businessId, ...patch })
    if (!r.ok) return toast.error(r.error || "Update failed")
    reload()
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm">Lead Fields</CardTitle>
          <CardDescription className="text-xs mt-1">
            The Lead form renders from this configuration. System fields are protected; everything else can be renamed,
            reordered, deactivated or extended with new fields.
          </CardDescription>
        </div>
        <Button onClick={() => setCreating(true)} className="h-9 gap-1 bg-blue-600 hover:bg-blue-700 text-white shrink-0"><Plus className="h-4 w-4" /> New Field</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {fields.map((f, i) => (
          <RowShell key={f.id} inactive={!f.active}>
            <OrderButtons onUp={() => reorder(fields, i, -1)} onDown={() => reorder(fields, i, 1)} upDisabled={i === 0} downDisabled={i === fields.length - 1} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <button className="text-sm font-medium text-slate-700 hover:text-blue-700 truncate" onClick={() => setEditField(f)}>{f.label}</button>
                <Badge variant="outline" className="text-[10px] shrink-0">{typeLabel(f.type)}</Badge>
                {f.isSystem && <Badge variant="outline" className="text-[10px] text-slate-400 shrink-0">System</Badge>}
                {f.required && <Badge className="bg-red-50 text-red-600 text-[10px] shrink-0">Required</Badge>}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                key: {f.fieldKey}
                {" · "}{[f.showInList && "List", f.showInCreate && "Create", f.showInEdit && "Edit", f.showInDetail && "Detail"].filter(Boolean).join(" / ") || "Hidden"}
                {f.searchable && " · Searchable"}{f.filterable && " · Filterable"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-500" onClick={() => setEditField(f)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Switch checked={f.active} onCheckedChange={(v) => update(f.id, { active: v })} disabled={f.isSystem} className="data-[state=checked]:bg-blue-600" />
            </div>
          </RowShell>
        ))}
      </CardContent>

      {(creating || editField) && (
        <FieldDialog
          businessId={businessId}
          field={editField}
          onClose={() => { setCreating(false); setEditField(null) }}
          onSaved={() => { setCreating(false); setEditField(null); reload() }}
        />
      )}
    </Card>
  )
}

function FieldDialog({ businessId, field, onClose, onSaved }: {
  businessId: string; field: CrmField | null; onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!field
  const [label, setLabel] = useState(field?.label || "")
  const [fieldKey, setFieldKey] = useState(field?.fieldKey || "")
  const [type, setType] = useState(field?.type || "TEXT")
  const [description, setDescription] = useState(field?.description || "")
  const [placeholder, setPlaceholder] = useState(field?.placeholder || "")
  const [defaultValue, setDefaultValue] = useState(field?.defaultValue || "")
  const [options, setOptions] = useState<CrmFieldOption[]>(field ? parseOptions(field.options) : [])
  const [flags, setFlags] = useState({
    required: field?.required ?? false,
    searchable: field?.searchable ?? false,
    filterable: field?.filterable ?? false,
    showInList: field?.showInList ?? false,
    showInCreate: field?.showInCreate ?? true,
    showInEdit: field?.showInEdit ?? true,
    showInDetail: field?.showInDetail ?? true,
  })
  const [saving, setSaving] = useState(false)
  const keyPreview = useMemo(
    () => fieldKey.trim() || label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
    [fieldKey, label],
  )

  const setOpt = (i: number, patch: Partial<CrmFieldOption>) =>
    setOptions((o) => o.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  const moveOpt = (i: number, dir: -1 | 1) => setOptions((o) => {
    const j = i + dir
    if (j < 0 || j >= o.length) return o
    const copy = [...o]; const tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp
    return copy.map((x, idx) => ({ ...x, order: idx }))
  })

  const save = async () => {
    if (!label.trim()) return toast.error("Label is required")
    if (hasOptions(type) && options.filter((o) => o.active).length === 0) return toast.error("Add at least one active option")
    setSaving(true)
    const payload: Record<string, unknown> = {
      businessId, label: label.trim(), description, placeholder, defaultValue,
      ...flags,
      ...(hasOptions(type) ? { options: options.map((o, i) => ({ ...o, order: i })) } : {}),
    }
    const r = isEdit
      ? await putJson(`/api/laundry/crm/settings/lead-fields/${field!.id}`, payload)
      : await postJson(`/api/laundry/crm/settings/lead-fields`, { ...payload, fieldKey: keyPreview, type })
    setSaving(false)
    if (!r.ok) return toast.error(r.error || "Save failed")
    toast.success(isEdit ? "Field updated" : "Field created")
    onSaved()
  }

  const FlagRow = ({ k, label: l }: { k: keyof typeof flags; label: string }) => (
    <label className="flex items-center justify-between text-xs text-slate-600 rounded-md border px-2.5 py-2">
      {l}
      <Switch checked={flags[k]} onCheckedChange={(v) => setFlags((f) => ({ ...f, [k]: v }))} className="scale-90 data-[state=checked]:bg-blue-600" />
    </label>
  )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Field — ${field!.label}` : "New Lead Field"}</DialogTitle>
          <DialogDescription className="text-xs">
            {isEdit ? "The internal key and type are fixed after creation; everything else is editable." : "Adds a configurable field to the Lead form."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Field Label *</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-9" /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Field Type</Label>
              {isEdit ? <Input value={typeLabel(field!.type)} disabled className="h-9" /> : (
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </div>
          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs">Internal Key</Label>
              <Input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder={keyPreview || "auto-generated from label"} className="h-9 font-mono text-xs" />
              <p className="text-[10px] text-slate-400">Stable identifier for stored values{keyPreview ? ` — will be “${keyPreview}”` : ""}. Cannot change later.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Placeholder</Label><Input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} className="h-9" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Default Value</Label><Input value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} className="h-9" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-sm" /></div>

          {hasOptions(type) && (
            <div className="space-y-1.5">
              <Label className="text-xs">Options</Label>
              <div className="space-y-1.5">
                {options.map((o, i) => (
                  <div key={i} className={`flex items-center gap-2 ${o.active ? "" : "opacity-50"}`}>
                    <OrderButtons onUp={() => moveOpt(i, -1)} onDown={() => moveOpt(i, 1)} upDisabled={i === 0} downDisabled={i === options.length - 1} />
                    <Input value={o.label} onChange={(e) => setOpt(i, { label: e.target.value, ...(isEdit ? {} : { value: e.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, "_") }) })} className="h-8 text-sm" />
                    <Switch checked={o.active} onCheckedChange={(v) => setOpt(i, { active: v })} className="scale-90 data-[state=checked]:bg-blue-600" />
                  </div>
                ))}
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setOptions((o) => [...o, { value: `OPT_${o.length + 1}`, label: "", order: o.length, active: true }])}>
                  <Plus className="h-3.5 w-3.5" /> Add Option
                </Button>
                <p className="text-[10px] text-slate-400">Options already used by leads should be deactivated, not removed — history stays readable.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <FlagRow k="required" label="Required" />
            <FlagRow k="showInList" label="Show in Lead List" />
            <FlagRow k="showInCreate" label="Show in Create Form" />
            <FlagRow k="showInEdit" label="Show in Edit Form" />
            <FlagRow k="showInDetail" label="Show in Lead Detail" />
            <FlagRow k="searchable" label="Searchable" />
            <FlagRow k="filterable" label="Filterable" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />} {isEdit ? "Save Changes" : "Create Field"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
