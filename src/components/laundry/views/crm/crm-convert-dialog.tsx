"use client"

// Convert Lead → Opportunity. One primary opportunity per lead; the server
// blocks duplicates and statuses that don't allow conversion.

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, ArrowRightCircle } from "lucide-react"
import { toast } from "sonner"
import { type CrmLead, useCrmMeta, useCrmActor } from "./crm-shared"

export function ConvertLeadDialog({ businessId, lead, priorities, onClose, onConverted }: {
  businessId: string
  lead: Pick<CrmLead, "id" | "leadCode" | "displayName" | "assignedToName" | "priorityId">
  priorities?: { id: string; name: string; color: string; isDefault: boolean; active: boolean }[]
  onClose: () => void
  onConverted: () => void
}) {
  const { stages } = useCrmMeta(businessId)
  const actor = useCrmActor()
  const openStages = stages.filter((s) => s.stageType === "OPEN" && s.active)

  const [name, setName] = useState(`${lead.displayName} — Opportunity`)
  const [value, setValue] = useState("")
  const [expectedCloseDate, setExpectedCloseDate] = useState("")
  const [stageId, setStageId] = useState("")
  const [priorityId, setPriorityId] = useState(() => {
    if (lead.priorityId) return lead.priorityId
    return priorities?.find((p) => p.active && p.isDefault)?.id || priorities?.find((p) => p.active)?.id || ""
  })
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const convert = async () => {
    if (!name.trim()) return toast.error("Opportunity name is required")
    setSaving(true)
    try {
      const res = await fetch(`/api/laundry/crm/leads/${lead.id}/convert`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId, name: name.trim(), value: Number(value) || 0,
          expectedCloseDate: expectedCloseDate || null,
          stageId: stageId || null,
          priorityId: priorityId || null,
          // Owner is NOT sent — the server always inherits the Lead Owner.
          notes: notes || null, ...actor,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Conversion failed")
      toast.success(`Opportunity created — ${j.data.oppCode}`)
      onConverted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Conversion failed")
    } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowRightCircle className="h-5 w-5 text-green-600" /> Convert to Opportunity</DialogTitle>
          <DialogDescription className="text-xs">Lead {lead.leadCode} · {lead.displayName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label className="text-xs">Opportunity Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Deal Value</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
                <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="h-9 pl-6" />
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Expected Closing Date</Label><Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} className="h-9" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
<div className="space-y-1.5">
              <Label className="text-xs">Initial Sales Stage</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Default (initial stage)" /></SelectTrigger>
                <SelectContent>{openStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.probability}%)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(priorities && priorities.filter((p) => p.active).length > 0) && (
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={priorityId} onValueChange={setPriorityId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select priority…" /></SelectTrigger>
                  <SelectContent>{priorities.filter((p) => p.active).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {/* Ownership is inherited, never chosen here — one owner concept. */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500 flex items-center gap-1.5">
                Lead Owner
                <Badge variant="outline" className="text-[9px] h-4 px-1 border-slate-300 text-slate-500 font-normal">Inherited</Badge>
              </Label>
              <div className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 flex items-center text-sm text-slate-600">
                {lead.assignedToName || "Unassigned"}
              </div>
              <p className="text-[10px] text-slate-400">The opportunity is owned by the Lead Owner.</p>
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={convert} disabled={saving} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
