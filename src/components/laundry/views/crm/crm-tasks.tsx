"use client"

// CRM Tasks — Today / Overdue / Upcoming / All, complete inline.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, CheckSquare, CheckCircle2, Circle, Plus, Pencil } from "lucide-react"
import { toast } from "sonner"
import { type CrmTask, type CrmTaskType, useCrmActor, useCrmMeta, fmtDateTime } from "./crm-shared"
import { NewTaskDialog } from "./crm-activity-task-dialogs"

const PRIORITY_CLS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-500",
  MEDIUM: "bg-blue-50 text-blue-600",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-600",
}

export function CrmTasks({ businessId }: { businessId: string }) {
  const actor = useCrmActor()
  const meta = useCrmMeta(businessId)
  const [rows, setRows] = useState<CrmTask[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("today")
  const [taskTypeId, setTaskTypeId] = useState("ALL")
  const [adding, setAdding] = useState(false)
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId, pageSize: "100" })
      if (tab === "today" || tab === "overdue" || tab === "upcoming") params.set("due", tab)
      if (tab !== "all") params.set("status", "OPEN")
      if (taskTypeId !== "ALL") params.set("taskTypeId", taskTypeId)
      const j = await fetch(`/api/laundry/crm/tasks?${params}`).then((r) => r.json())
      setRows(j.success ? j.data : [])
    } catch { setRows([]) } finally { setLoading(false) }
  }, [businessId, tab, taskTypeId])
  useEffect(() => { load() }, [load])

  const toggle = async (t: CrmTask) => {
    const res = await fetch(`/api/laundry/crm/tasks/${t.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, status: t.status === "COMPLETED" ? "OPEN" : "COMPLETED", ...actor }),
    })
    const j = await res.json()
    if (!res.ok || !j.success) return toast.error(j.error || "Update failed")
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><CheckSquare className="h-5 w-5 text-blue-600" /> Tasks</h2>
          <p className="text-sm text-muted-foreground">Follow-ups and to-dos across your CRM.</p>
        </div>
        <Button onClick={() => setAdding(true)} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"><Plus className="h-4 w-4" /> New Task</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {meta.taskTypes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={taskTypeId} onValueChange={setTaskTypeId}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Task Types</SelectItem>
              {meta.taskTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardContent className="p-3">
          {loading ? (
            <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <CheckSquare className="h-8 w-8 mx-auto text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">Nothing here</p>
              <p className="text-xs text-slate-400">No {tab === "all" ? "" : `${tab} `}tasks right now.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((t) => (
                <div key={t.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <button onClick={() => toggle(t)} className="mt-0.5 shrink-0">
                    {t.status === "COMPLETED" ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-slate-300 hover:text-blue-500" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${t.status === "COMPLETED" ? "line-through text-slate-400" : "text-slate-700"}`}>{t.title}</p>
                      <Badge className={`text-[10px] border-0 ${PRIORITY_CLS[t.priority] || ""}`}>{t.priority}</Badge>
                      {t.taskType && <Badge variant="outline" className="text-[10px]"><span className="inline-block h-1.5 w-1.5 rounded-full mr-1" style={{ backgroundColor: t.taskType.color || "#64748B" }} />{t.taskType.name}</Badge>}
                      {t.dueAt && new Date(t.dueAt) < new Date() && t.status === "OPEN" && <Badge className="bg-red-100 text-red-600 text-[10px] border-0">Overdue</Badge>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t.taskCode}
                      {t.dueAt && <> · Due {fmtDateTime(t.dueAt)}</>}
                      {t.assignedToName && <> · {t.assignedToName}</>}
                      {t.lead && <> · Lead: {t.lead.displayName}</>}
                      {t.opportunity && <> · Opp: {t.opportunity.name}</>}
                    </p>
                    {t.description && <p className="text-xs text-slate-500 mt-1">{t.description}</p>}
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 px-0 text-slate-400 hover:text-blue-600 shrink-0" onClick={() => setEditingTask(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {adding && (
        <NewTaskDialog businessId={businessId} taskTypes={meta.taskTypes} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
      )}
      {editingTask && (
        <TaskEditDialog businessId={businessId} task={editingTask} taskTypes={meta.taskTypes}
          onClose={() => setEditingTask(null)} onSaved={() => { setEditingTask(null); load() }} />
      )}
    </div>
  )
}

// Edit an existing task — same configurable masters as creation.
function TaskEditDialog({ businessId, task, taskTypes, onClose, onSaved }: {
  businessId: string; task: CrmTask; taskTypes: CrmTaskType[]; onClose: () => void; onSaved: () => void
}) {
  const actor = useCrmActor()
  const active = taskTypes.filter((t) => t.active !== false)
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || "")
  const [priority, setPriority] = useState(task.priority)
  const [taskTypeId, setTaskTypeId] = useState(task.taskTypeId || active[0]?.id || "")
  const [dueAt, setDueAt] = useState(task.dueAt ? task.dueAt.slice(0, 16) : "")
  const [assignedToName, setAssignedToName] = useState(task.assignedToName || "")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title.trim()) return toast.error("Title is required")
    setSaving(true)
    try {
      const res = await fetch(`/api/laundry/crm/tasks/${task.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId, title: title.trim(), description: description || null,
          priority, taskTypeId: taskTypeId || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          assignedToId: assignedToName || null, assignedToName: assignedToName || null, ...actor,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
      toast.success("Task updated")
      onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Task — {task.taskCode}</DialogTitle>
          <DialogDescription className="text-xs">{task.lead?.displayName ? `Lead: ${task.lead.displayName}` : task.opportunity?.name ? `Opportunity: ${task.opportunity.name}` : ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label className="text-xs">Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <SelectItem key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Due Date &amp; Time</Label><Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="h-9" /></div>
          </div>
          {active.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Task Type</Label>
              <Select value={taskTypeId} onValueChange={setTaskTypeId}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{active.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5"><Label className="text-xs">Assigned Employee</Label><Input value={assignedToName} onChange={(e) => setAssignedToName(e.target.value)} className="h-9" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-sm" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
