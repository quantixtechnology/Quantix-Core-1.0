"use client"

// Opportunities — Kanban pipeline (active OPEN stages as columns, HTML5
// drag & drop with server-validated transitions) + list tab + Won/Lost lanes
// + opportunity detail with timeline & stage history.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Loader2, Target, Search, ChevronLeft, Trophy, XCircle, KanbanSquare,
  List, User, CalendarDays, Plus, Pencil,
} from "lucide-react"
import { toast } from "sonner"
import {
  type CrmOpportunity, type CrmStage, type CrmActivity, type CrmTask, type CrmEventRow,
  useCrmMeta, useCrmActor, inr, fmtDate, fmtDateTime,
} from "./crm-shared"
import { Timeline } from "./crm-lead-detail"
import { LogActivityDialog, NewTaskDialog } from "./crm-activity-task-dialogs"

export function CrmOpportunities({ businessId }: { businessId: string }) {
  const meta = useCrmMeta(businessId)
  const actor = useCrmActor()
  const [rows, setRows] = useState<CrmOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  // Terminal-stage confirmation (Won capture / Lost reason)
  const [terminal, setTerminal] = useState<{ opp: CrmOpportunity; stage: CrmStage } | null>(null)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId, pageSize: "200" })
      if (q) params.set("q", q)
      const j = await fetch(`/api/laundry/crm/opportunities?${params}`).then((r) => r.json())
      setRows(j.success ? j.data : [])
    } catch { setRows([]) } finally { setLoading(false) }
  }, [businessId, q])
  useEffect(() => { load() }, [load])

  const openStages = useMemo(() => meta.stages.filter((s) => s.active && s.stageType === "OPEN"), [meta.stages])
  const wonStage = useMemo(() => meta.stages.find((s) => s.active && s.stageType === "WON"), [meta.stages])
  const lostStage = useMemo(() => meta.stages.find((s) => s.active && s.stageType === "LOST"), [meta.stages])

  const moveStage = async (opp: CrmOpportunity, stage: CrmStage, extra: Record<string, unknown> = {}) => {
    const res = await fetch(`/api/laundry/crm/opportunities/${opp.id}/stage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, stageId: stage.id, ...extra, ...actor }),
    })
    const j = await res.json()
    if (!res.ok || !j.success) { toast.error(j.error || "Stage change failed"); return false }
    toast.success(`Moved to ${stage.name}`)
    load()
    return true
  }

  const requestMove = (opp: CrmOpportunity, stage: CrmStage) => {
    if (stage.id === opp.stageId) return
    if (stage.stageType === "WON" || stage.stageType === "LOST") setTerminal({ opp, stage })
    else moveStage(opp, stage)
  }

  if (detailId) {
    return <OpportunityDetail businessId={businessId} oppId={detailId} onBack={() => { setDetailId(null); load() }} />
  }

  const daysIn = (o: CrmOpportunity) => Math.max(0, Math.floor((Date.now() - new Date(o.stageEnteredAt).getTime()) / 86400000))

  const OppCard = ({ o }: { o: CrmOpportunity }) => (
    <button
      draggable={o.state === "OPEN"}
      onDragStart={() => setDragging(o.id)}
      onDragEnd={() => setDragging(null)}
      onClick={() => setDetailId(o.id)}
      className={`w-full text-left rounded-lg border bg-white p-2.5 shadow-sm hover:shadow transition-shadow ${dragging === o.id ? "opacity-50" : ""}`}
    >
      <p className="text-[13px] font-semibold text-slate-800 leading-snug">{o.name}</p>
      <p className="text-[11px] text-slate-400">{o.lead?.displayName}{o.lead?.leadCode ? ` · ${o.lead.leadCode}` : ""}</p>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-sm font-bold text-blue-700">{inr(o.value)}</span>
        {o.probability != null && <Badge variant="outline" className="text-[10px] h-4 px-1">{o.probability}%</Badge>}
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
        {o.assignedToName && <span className="flex items-center gap-0.5"><User className="h-2.5 w-2.5" /> {o.assignedToName}</span>}
        {o.expectedCloseDate && <span className="flex items-center gap-0.5"><CalendarDays className="h-2.5 w-2.5" /> {fmtDate(o.expectedCloseDate)}</span>}
        <span className="ml-auto">{daysIn(o)}d in stage</span>
      </div>
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><Target className="h-5 w-5 text-blue-600" /> Opportunities</h2>
          <p className="text-sm text-muted-foreground">Move deals through your pipeline to Won. Drag cards between stages.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search opportunities…" className="pl-8 h-9 w-[240px]" />
        </div>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline" className="gap-1.5"><KanbanSquare className="h-3.5 w-3.5" /> Pipeline</TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5"><List className="h-3.5 w-3.5" /> All Opportunities</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          {loading ? (
            <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading pipeline…</div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-3 min-w-max">
                  {openStages.map((stage) => {
                    const cards = rows.filter((o) => o.stageId === stage.id && o.state === "OPEN")
                    const stageValue = cards.reduce((s, o) => s + o.value, 0)
                    return (
                      <div key={stage.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          const o = rows.find((r) => r.id === dragging)
                          setDragging(null)
                          if (o) requestMove(o, stage)
                        }}
                        className="w-[250px] shrink-0 rounded-xl border bg-slate-50/70 flex flex-col max-h-[65vh]">
                        <div className="px-3 py-2.5 border-b bg-white rounded-t-xl">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                            <p className="text-xs font-bold text-slate-700 truncate">{stage.name}</p>
                            <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1">{cards.length}</Badge>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{inr(stageValue)} · {stage.probability}%</p>
                        </div>
                        <div className="p-2 space-y-2 overflow-y-auto">
                          {cards.map((o) => <OppCard key={o.id} o={o} />)}
                          {cards.length === 0 && <p className="text-[11px] text-slate-300 text-center py-6">Drop deals here</p>}
                        </div>
                      </div>
                    )
                  })}

                  {/* Terminal lanes */}
                  <div className="w-[230px] shrink-0 space-y-3">
                    {[{ stage: wonStage, icon: Trophy, cls: "border-green-200 bg-green-50/60", head: "text-green-700" },
                      { stage: lostStage, icon: XCircle, cls: "border-red-200 bg-red-50/60", head: "text-red-600" }].map(({ stage, icon: Icon, cls, head }) => stage && (
                      <div key={stage.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          const o = rows.find((r) => r.id === dragging)
                          setDragging(null)
                          if (o) requestMove(o, stage)
                        }}
                        className={`rounded-xl border ${cls} p-3 min-h-[120px]`}>
                        <div className={`flex items-center gap-1.5 text-xs font-bold ${head}`}>
                          <Icon className="h-3.5 w-3.5" /> {stage.name}
                          <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1">{rows.filter((o) => o.state === stage.stageType).length}</Badge>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {inr(rows.filter((o) => o.state === stage.stageType).reduce((s, o) => s + (o.state === "WON" ? (o.wonValue ?? o.value) : o.value), 0))}
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {rows.filter((o) => o.state === stage.stageType).slice(0, 4).map((o) => (
                            <button key={o.id} onClick={() => setDetailId(o.id)} className="w-full text-left rounded-lg border bg-white px-2 py-1.5">
                              <p className="text-[11px] font-medium text-slate-700 truncate">{o.name}</p>
                              <p className="text-[10px] text-slate-400">{inr(o.state === "WON" ? (o.wonValue ?? o.value) : o.value)}</p>
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-slate-400 mt-2">Drag a deal here to mark {stage.stageType === "WON" ? "won" : "lost"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {rows.length === 0 && (
                <div className="py-10 text-center">
                  <Target className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-600">No Opportunities Yet</p>
                  <p className="text-xs text-slate-400">Convert a lead to create your first opportunity.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opportunity</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Probability</TableHead>
                      <TableHead>Expected Close</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((o) => (
                      <TableRow key={o.id} className="cursor-pointer" onClick={() => setDetailId(o.id)}>
                        <TableCell>
                          <p className="font-medium text-slate-800">{o.name}</p>
                          <p className="text-[11px] text-slate-400">{o.oppCode}</p>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{o.lead?.displayName || "—"}</TableCell>
                        <TableCell>{o.stage ? <Badge style={{ backgroundColor: `${o.stage.color}18`, color: o.stage.color }} className="text-[11px] border-0">{o.stage.name}</Badge> : "—"}</TableCell>
                        <TableCell className="font-semibold text-slate-700">{inr(o.value)}</TableCell>
                        <TableCell className="text-sm text-slate-600">{o.probability != null ? `${o.probability}%` : "—"}</TableCell>
                        <TableCell className="text-sm text-slate-600">{fmtDate(o.expectedCloseDate)}</TableCell>
                        <TableCell className="text-sm text-slate-600">{o.assignedToName || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`text-[11px] border-0 ${o.state === "WON" ? "bg-green-100 text-green-700" : o.state === "LOST" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"}`}>{o.state}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && !loading && (
                      <TableRow><TableCell colSpan={8} className="text-center text-sm text-slate-400 py-10">No opportunities yet — convert a lead to get started.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {terminal && (
        <TerminalStageDialog
          businessId={businessId}
          opp={terminal.opp}
          stage={terminal.stage}
          onClose={() => setTerminal(null)}
          onConfirm={async (extra) => {
            const ok = await moveStage(terminal.opp, terminal.stage, extra)
            if (ok) setTerminal(null)
          }}
        />
      )}
    </div>
  )
}

// Won capture (final value + notes) / Lost capture (reason required + notes).
function TerminalStageDialog({ businessId, opp, stage, onClose, onConfirm }: {
  businessId: string
  opp: CrmOpportunity
  stage: CrmStage
  onClose: () => void
  onConfirm: (extra: Record<string, unknown>) => Promise<void>
}) {
  const { lostReasons } = useCrmMeta(businessId)
  const isWon = stage.stageType === "WON"
  const [finalValue, setFinalValue] = useState(String(opp.value || ""))
  const [lostReasonId, setLostReasonId] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const confirm = async () => {
    if (!isWon && !lostReasonId) return toast.error("Please select a lost reason")
    setSaving(true)
    await onConfirm(isWon
      ? { finalValue: Number(finalValue) || opp.value, notes: notes || undefined }
      : { lostReasonId, lostNotes: notes || undefined })
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isWon ? <><Trophy className="h-5 w-5 text-green-600" /> Mark as Won</> : <><XCircle className="h-5 w-5 text-red-500" /> Mark as Lost</>}
          </DialogTitle>
          <DialogDescription className="text-xs">{opp.oppCode} · {opp.name} → {stage.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {isWon ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Final Deal Value</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
                <Input type="number" min={0} value={finalValue} onChange={(e) => setFinalValue(e.target.value)} className="h-9 pl-6" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Lost Reason *</Label>
              <Select value={lostReasonId} onValueChange={setLostReasonId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select reason…" /></SelectTrigger>
                <SelectContent>{lostReasons.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5"><Label className="text-xs">Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={confirm} disabled={saving} className={`gap-1 text-white ${isWon ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirm {isWon ? "Won" : "Lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Opportunity Detail ──────────────────────────────────────────────────────

type OppFull = CrmOpportunity & {
  activities: CrmActivity[]
  tasks: CrmTask[]
  events: CrmEventRow[]
  stageHistory: { id: string; fromStageName: string | null; toStageName: string; durationMs: number | null; changedByName: string | null; createdAt: string }[]
}

function OpportunityDetail({ businessId, oppId, onBack }: { businessId: string; oppId: string; onBack: () => void }) {
  const meta = useCrmMeta(businessId)
  const actor = useCrmActor()
  const [opp, setOpp] = useState<OppFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [loggingActivity, setLoggingActivity] = useState(false)
  const [addingTask, setAddingTask] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/crm/opportunities/${oppId}?businessId=${encodeURIComponent(businessId)}`).then((r) => r.json())
      setOpp(j.success ? j.data : null)
    } catch { setOpp(null) } finally { setLoading(false) }
  }, [businessId, oppId])
  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading opportunity…</div>
  if (!opp) return (
    <div className="py-16 text-center">
      <p className="text-sm text-slate-500">Opportunity not found.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Back</Button>
    </div>
  )

  const fmtDur = (ms: number | null) => ms == null ? "" : ms < 3600000 ? `${Math.round(ms / 60000)}m` : ms < 86400000 ? `${Math.round(ms / 3600000)}h` : `${Math.round(ms / 86400000)}d`

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={onBack}><ChevronLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold tracking-tight">{opp.name}</h2>
              {opp.stage && <Badge style={{ backgroundColor: `${opp.stage.color}18`, color: opp.stage.color }} className="border-0">{opp.stage.name}</Badge>}
              <Badge className={`border-0 ${opp.state === "WON" ? "bg-green-100 text-green-700" : opp.state === "LOST" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"}`}>{opp.state}</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {opp.oppCode} · From lead {opp.lead?.leadCode} ({opp.lead?.displayName})
              {opp.assignedToName && <> · <User className="inline h-3 w-3" /> {opp.assignedToName}</>}
            </p>
            <div className="flex items-center gap-4 mt-1 text-sm">
              <span className="font-bold text-blue-700 text-base">{inr(opp.state === "WON" ? (opp.wonValue ?? opp.value) : opp.value)}</span>
              {opp.probability != null && <span className="text-slate-500">{opp.probability}% probability</span>}
              {opp.expectedCloseDate && <span className="text-slate-500">Expected: {fmtDate(opp.expectedCloseDate)}</span>}
              {opp.wonAt && <span className="text-green-600 font-medium">Won {fmtDate(opp.wonAt)}</span>}
              {opp.lostAt && <span className="text-red-500 font-medium">Lost {fmtDate(opp.lostAt)}{opp.lostReason ? ` — ${opp.lostReason.name}` : ""}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          <Button variant="outline" size="sm" className="h-9 gap-1" onClick={() => setLoggingActivity(true)}><Plus className="h-3.5 w-3.5" /> Activity</Button>
          <Button variant="outline" size="sm" className="h-9 gap-1" onClick={() => setAddingTask(true)}><Plus className="h-3.5 w-3.5" /> Task</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4 min-w-0">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
            <CardContent><Timeline events={opp.events} activities={opp.activities} /></CardContent>
          </Card>
          {opp.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-600 whitespace-pre-wrap">{opp.notes}</p></CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Stage History</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {opp.stageHistory.map((h) => (
                <div key={h.id} className="rounded-lg border p-2.5">
                  <p className="text-sm text-slate-700">{h.fromStageName ? `${h.fromStageName} → ` : "Entered "}{h.toStageName}</p>
                  <p className="text-[11px] text-slate-400">
                    {fmtDateTime(h.createdAt)}
                    {h.durationMs != null && h.fromStageName && <> · {fmtDur(h.durationMs)} in {h.fromStageName}</>}
                    {h.changedByName && <> · {h.changedByName}</>}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Tasks</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {opp.tasks.length === 0 && <p className="text-xs text-slate-400">No tasks yet.</p>}
              {opp.tasks.map((t) => (
                <div key={t.id} className="rounded-lg border p-2.5">
                  <p className={`text-sm font-medium ${t.status === "COMPLETED" ? "line-through text-slate-400" : "text-slate-700"}`}>{t.title}</p>
                  <p className="text-[11px] text-slate-400">{t.dueAt ? `Due ${fmtDateTime(t.dueAt)}` : "No due date"}{t.assignedToName && ` · ${t.assignedToName}`}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {editing && <EditOpportunityDialog businessId={businessId} opp={opp} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />}
      {loggingActivity && (
        <LogActivityDialog businessId={businessId} opportunityId={opp.id} activityTypes={meta.activityTypes}
          onClose={() => setLoggingActivity(false)} onSaved={() => { setLoggingActivity(false); load() }} />
      )}
      {addingTask && (
        <NewTaskDialog businessId={businessId} opportunityId={opp.id}
          onClose={() => setAddingTask(false)} onSaved={() => { setAddingTask(false); load() }} />
      )}
    </div>
  )

  function EditOpportunityDialog({ businessId, opp, onClose, onSaved }: {
    businessId: string; opp: OppFull; onClose: () => void; onSaved: () => void
  }) {
    const [name, setName] = useState(opp.name)
    const [value, setValue] = useState(String(opp.value))
    const [probability, setProbability] = useState(opp.probability != null ? String(opp.probability) : "")
    const [expectedCloseDate, setExpectedCloseDate] = useState(opp.expectedCloseDate ? opp.expectedCloseDate.slice(0, 10) : "")
    const [assignedToName, setAssignedToName] = useState(opp.assignedToName || "")
    const [notes, setNotes] = useState(opp.notes || "")
    const [saving, setSaving] = useState(false)

    const save = async () => {
      setSaving(true)
      try {
        const res = await fetch(`/api/laundry/crm/opportunities/${opp.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId, name, value: Number(value) || 0,
            probability: probability === "" ? null : Number(probability),
            expectedCloseDate: expectedCloseDate || null,
            assignedToId: assignedToName || null, assignedToName: assignedToName || null,
            notes: notes || null, ...actor,
          }),
        })
        const j = await res.json()
        if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
        toast.success("Opportunity updated")
        onSaved()
      } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
    }

    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Opportunity — {opp.oppCode}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Deal Value</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
                  <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="h-9 pl-6" />
                </div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Probability %</Label><Input type="number" min={0} max={100} value={probability} onChange={(e) => setProbability(e.target.value)} className="h-9" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Expected Close</Label><Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} className="h-9" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Assigned Employee</Label><Input value={assignedToName} onChange={(e) => setAssignedToName(e.target.value)} className="h-9" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
}
