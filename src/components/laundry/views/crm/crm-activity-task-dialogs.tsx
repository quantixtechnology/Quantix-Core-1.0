"use client"

// Shared dialogs: log a CRM activity / create a CRM task — usable from a
// lead, an opportunity, or the standalone Activities/Tasks screens.

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { type CrmActivityType, useCrmActor } from "./crm-shared"

// datetime-local expects LOCAL wall-clock time — toISOString() would shift to UTC.
const localDatetimeValue = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function LogActivityDialog({ businessId, leadId, opportunityId, activityTypes, onClose, onSaved }: {
  businessId: string
  leadId?: string
  opportunityId?: string
  activityTypes: CrmActivityType[]
  onClose: () => void
  onSaved: () => void
}) {
  const actor = useCrmActor()
  const [type, setType] = useState(activityTypes[0]?.name || "General")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [outcome, setOutcome] = useState("")
  const [activityAt, setActivityAt] = useState(localDatetimeValue)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!subject.trim()) return toast.error("Subject is required")
    setSaving(true)
    try {
      const res = await fetch("/api/laundry/crm/activities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId, leadId, opportunityId, type, subject: subject.trim(),
          description: description || null, outcome: outcome || null,
          activityAt: activityAt ? new Date(activityAt).toISOString() : null, ...actor,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
      toast.success("Activity logged")
      onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
          <DialogDescription className="text-xs">Record a call, meeting, WhatsApp or other interaction.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Activity Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{activityTypes.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Date &amp; Time</Label><Input type="datetime-local" value={activityAt} onChange={(e) => setActivityAt(e.target.value)} className="h-9" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Subject *</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9" placeholder="e.g. Discussed pricing on call" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-sm" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Outcome</Label><Input value={outcome} onChange={(e) => setOutcome(e.target.value)} className="h-9" placeholder="e.g. Interested, follow up Friday" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Log Activity</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function NewTaskDialog({ businessId, leadId, opportunityId, onClose, onSaved }: {
  businessId: string
  leadId?: string
  opportunityId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const actor = useCrmActor()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("MEDIUM")
  const [dueAt, setDueAt] = useState("")
  const [assignedToName, setAssignedToName] = useState(actor.actorName || "")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title.trim()) return toast.error("Title is required")
    setSaving(true)
    try {
      const res = await fetch("/api/laundry/crm/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId, leadId, opportunityId, title: title.trim(),
          description: description || null, priority,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          assignedToId: assignedToName || null, assignedToName: assignedToName || null, ...actor,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
      toast.success("Task created")
      onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription className="text-xs">Follow-ups and to-dos for this record.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label className="text-xs">Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" placeholder="e.g. Call back about proposal" /></div>
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
          <div className="space-y-1.5"><Label className="text-xs">Assigned Employee</Label><Input value={assignedToName} onChange={(e) => setAssignedToName(e.target.value)} className="h-9" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-sm" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
