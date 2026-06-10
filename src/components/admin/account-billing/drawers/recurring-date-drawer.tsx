"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, RotateCcw } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  currentDueDate: string
  onSuccess: () => void
}

export function RecurringDateDrawer({ open, onOpenChange, businessId, currentDueDate, onSuccess }: Props) {
  const { user } = useAuthStore()
  const [newDate, setNewDate]           = useState("")
  const [overrideUntil, setUntil]       = useState<"NEXT_BILLING_ONLY" | "PERMANENT">("NEXT_BILLING_ONLY")
  const [reason, setReason]             = useState("")
  const [saving, setSaving]             = useState(false)

  const handleSave = async () => {
    if (!newDate)         { toast.error("Select a new due date"); return }
    if (!reason.trim())   { toast.error("Reason is required"); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/account-billing/${businessId}/recurring-date`, {
        method: "PATCH",
        headers: getAuthHeaders() as Record<string, string>,
        body: JSON.stringify({
          newDueDate: newDate,
          overrideUntil,
          reason: reason.trim(),
          createdById:   user?.id ?? undefined,
          createdByName: user?.name ?? undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Recurring due date updated")
        setNewDate(""); setReason(""); setUntil("NEXT_BILLING_ONLY")
        onSuccess()
      } else {
        toast.error(json.error ?? "Failed to update")
      }
    } catch { toast.error("Failed to update") }
    finally { setSaving(false) }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-violet-600" />
            <SheetTitle className="text-base">Edit Recurring Due Date</SheetTitle>
          </div>
          <SheetDescription>
            Override the auto-calculated billing due date. Changes are fully audited.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 p-6 space-y-4">
          {/* Current */}
          <div className="rounded-lg bg-muted/40 p-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Current Due Date</p>
            <p className="text-sm font-medium">{fmtDate(currentDueDate)}</p>
          </div>

          {/* New date */}
          <div className="space-y-1.5">
            <Label className="text-xs">New Due Date *</Label>
            <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-9 text-xs" />
          </div>

          {/* Override Until */}
          <div className="space-y-1.5">
            <Label className="text-xs">Override Until</Label>
            <Select value={overrideUntil} onValueChange={v => setUntil(v as "NEXT_BILLING_ONLY" | "PERMANENT")}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NEXT_BILLING_ONLY">Next billing only (auto-reverts after)</SelectItem>
                <SelectItem value="PERMANENT">Permanent (until changed again)</SelectItem>
              </SelectContent>
            </Select>
            {overrideUntil === "NEXT_BILLING_ONLY" && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <RotateCcw className="h-3 w-3" /> After next billing cycle, schedule returns to the original day
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="text-xs">Reason *</Label>
            <Textarea
              placeholder="e.g. Customer requested extension, bank holiday…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="text-xs resize-none"
              rows={3}
            />
          </div>
        </div>

        <SheetFooter className="px-6 pb-6 flex gap-2">
          <Button className="flex-1" onClick={handleSave} disabled={saving || !newDate || !reason.trim()}>
            {saving ? "Saving…" : "Save & Audit"}
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
