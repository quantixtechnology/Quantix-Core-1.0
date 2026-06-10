"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Zap } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

const CHARGE_TYPES = [
  { value: "ONE_TIME",       label: "One-Time"       },
  { value: "RECURRING",      label: "Recurring"      },
  { value: "IMPLEMENTATION", label: "Implementation" },
  { value: "CREDIT",         label: "Credit"         },
  { value: "ADJUSTMENT",     label: "Adjustment"     },
]

interface ServiceOption {
  id: string
  name: string
  amount: number
  type: string
}

interface Props {
  open:          boolean
  onOpenChange:  (open: boolean) => void
  businessId:    string
  services?:     ServiceOption[]  // pre-load from subscription + addons for quick selection
  onSuccess:     (data: { charge: Record<string,unknown>; proforma: Record<string,unknown> }) => void
}

export function AddChargeDrawer({ open, onOpenChange, businessId, services = [], onSuccess }: Props) {
  const { user } = useAuthStore()

  const [selectedServiceId, setSelectedServiceId] = useState<string>("_manual")
  const [serviceName,  setServiceName]  = useState("")
  const [description,  setDescription]  = useState("")
  const [amount,       setAmount]       = useState("")
  const [chargeType,   setChargeType]   = useState("ONE_TIME")
  const [dueDate,      setDueDate]      = useState("")
  const [periodStart,  setPeriodStart]  = useState("")
  const [periodEnd,    setPeriodEnd]    = useState("")
  const [notes,        setNotes]        = useState("")
  const [validDays,    setValidDays]    = useState("7")
  const [saving,       setSaving]       = useState(false)

  // Pre-fill fields when a service is selected
  const handleServiceSelect = (val: string) => {
    setSelectedServiceId(val)
    if (val === "_manual") { setServiceName(""); setAmount(""); return }
    const svc = services.find(s => s.id === val)
    if (svc) { setServiceName(svc.name); setAmount(String(svc.amount)) }
  }

  const resetForm = () => {
    setSelectedServiceId("_manual"); setServiceName(""); setDescription("")
    setAmount(""); setChargeType("ONE_TIME"); setDueDate("")
    setPeriodStart(""); setPeriodEnd(""); setNotes(""); setValidDays("7")
  }

  const handleSubmit = async () => {
    if (!serviceName.trim()) { toast.error("Service name is required"); return }
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/account-billing/${businessId}/charges`, {
        method: "POST",
        headers: getAuthHeaders() as Record<string, string>,
        body: JSON.stringify({
          serviceName:   serviceName.trim(),
          description:   description.trim() || null,
          amount:        amt,
          chargeType,
          serviceId:     selectedServiceId !== "_manual" ? selectedServiceId : null,
          dueDate:       dueDate      || null,
          periodStart:   periodStart  || null,
          periodEnd:     periodEnd    || null,
          notes:         notes.trim() || null,
          validDays:     parseInt(validDays) || 7,
          createdById:   user?.id   ?? undefined,
          createdByName: user?.name ?? undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.error ?? "Failed to create charge"); return }

      toast.success(json.message ?? "Charge created")
      resetForm()
      onSuccess(json.data)
    } catch { toast.error("Failed to create charge") }
    finally { setSaving(false) }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
      <SheetContent className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <SheetTitle className="text-base">Add Charge</SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            Creates a charge and auto-generates a Proforma invoice in Draft status.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Service selection */}
          {services.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Quick-Select Service</Label>
              <Select value={selectedServiceId} onValueChange={handleServiceSelect}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select a service…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_manual">Manual / Custom</SelectItem>
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — ₹{s.amount.toLocaleString("en-IN")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Service name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Service / Item Name *</Label>
            <Input
              value={serviceName}
              onChange={e => setServiceName(e.target.value)}
              placeholder="e.g. Platform Subscription — July 2025"
              className="h-9 text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional line-item detail"
              className="h-9 text-xs"
            />
          </div>

          {/* Amount + Charge Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (₹) *</Label>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Charge Type</Label>
              <Select value={chargeType} onValueChange={setChargeType}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHARGE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due date + Proforma validity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Proforma Valid (days)</Label>
              <Input
                type="number"
                value={validDays}
                onChange={e => setValidDays(e.target.value)}
                min={1}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Period (RECURRING only) */}
          {chargeType === "RECURRING" && (
            <>
              <Separator />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Billing Period</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Period Start</Label>
                  <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Period End</Label>
                  <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="h-9 text-xs" />
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Internal Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes visible to admins only"
              className="text-xs resize-none"
              rows={2}
            />
          </div>

          {/* Flow reminder */}
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-[11px] text-amber-800 space-y-1">
            <p className="font-semibold">Charge → Proforma workflow</p>
            <p>After saving: Proforma is created in Draft. Send it to the client, then track payment through Verification to auto-generate the Tax Invoice and Receipt.</p>
          </div>
        </div>

        <SheetFooter className="px-6 pb-6 pt-2 border-t flex gap-2">
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={saving || !serviceName.trim() || !amount}
          >
            {saving ? "Creating…" : "Create Charge & Proforma"}
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
