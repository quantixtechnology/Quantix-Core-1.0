"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

const CATEGORIES = [
  { value: "PLATFORM",       label: "Platform" },
  { value: "MOBILE_APP",     label: "Mobile App" },
  { value: "IMPLEMENTATION", label: "Implementation" },
  { value: "SUPPORT",        label: "Support" },
  { value: "CUSTOM",         label: "Custom" },
]

const CYCLES = [
  { value: "MONTHLY",     label: "Monthly" },
  { value: "QUARTERLY",   label: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half-Yearly" },
  { value: "YEARLY",      label: "Yearly" },
]

const PRESETS = [
  "Quantix Standard",
  "Additional Store",
  "iOS App",
  "Android App",
  "Payment Gateway Setup",
  "Implementation Fee",
  "Annual Support",
  "Custom Development",
]

function nextDueFromStart(start: string, cycle: string): string {
  if (!start) return ""
  const d = new Date(start)
  const months: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 }
  d.setMonth(d.getMonth() + (months[cycle] ?? 1))
  return d.toISOString().slice(0, 10)
}

interface Props {
  open:         boolean
  onOpenChange: (v: boolean) => void
  businessId:   string
  onSuccess:    () => void
}

export function AddServiceDialog({ open, onOpenChange, businessId, onSuccess }: Props) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)

  const [name,            setName]            = useState("")
  const [description,     setDescription]     = useState("")
  const [category,        setCategory]        = useState("PLATFORM")
  const [billingType,     setBillingType]     = useState<"RECURRING" | "ONE_TIME">("RECURRING")
  const [billingCycle,    setBillingCycle]    = useState("MONTHLY")
  const [unitPrice,       setUnitPrice]       = useState("")
  const [quantity,        setQuantity]        = useState("1")
  const [startDate,       setStartDate]       = useState(() => new Date().toISOString().slice(0, 10))
  const [nextBillingDate, setNextBillingDate] = useState("")

  useEffect(() => {
    if (billingType === "RECURRING" && billingCycle && startDate) {
      setNextBillingDate(nextDueFromStart(startDate, billingCycle))
    }
  }, [startDate, billingCycle, billingType])

  const reset = () => {
    setName(""); setDescription(""); setCategory("PLATFORM"); setBillingType("RECURRING")
    setBillingCycle("MONTHLY"); setUnitPrice(""); setQuantity("1")
    setStartDate(new Date().toISOString().slice(0, 10)); setNextBillingDate("")
  }

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Service name required"); return }
    const price = parseFloat(unitPrice)
    if (!unitPrice || isNaN(price) || price <= 0) { toast.error("Enter a valid unit price"); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/account-billing/${businessId}/services`, {
        method:  "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body:    JSON.stringify({
          name: name.trim(), description: description.trim() || undefined,
          category, billingType,
          billingCycle: billingType === "RECURRING" ? billingCycle : undefined,
          unitPrice: price, quantity: parseInt(quantity) || 1,
          startDate: startDate || undefined,
          nextBillingDate: billingType === "RECURRING" ? (nextBillingDate || undefined) : undefined,
          createdById:   user?.id   ?? undefined,
          createdByName: user?.name ?? undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.error ?? "Failed to add service"); return }
      toast.success(json.message ?? "Service added")
      reset(); onSuccess()
    } catch { toast.error("Failed to add service") }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Add Service</DialogTitle>
          <DialogDescription className="text-xs">
            Every billable item is a Service. Invoices are generated from services.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Preset quick-fill */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button key={p} type="button" onClick={() => setName(p)}
                className="rounded-full border px-2.5 py-0.5 text-[11px] hover:bg-muted transition-colors">
                {p}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Service Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Quantix Standard" className="h-9 text-xs" />
          </div>

          {/* Billing type */}
          <div className="grid grid-cols-2 gap-2">
            {(["RECURRING", "ONE_TIME"] as const).map(t => (
              <button key={t} type="button" onClick={() => setBillingType(t)}
                className={`rounded-lg border p-2.5 text-center text-xs transition-colors ${billingType === t ? "border-violet-400 bg-violet-50 text-violet-800 font-medium" : "border-muted hover:bg-muted/50"}`}>
                {t === "RECURRING" ? "Recurring" : "One-Time"}
              </button>
            ))}
          </div>

          <div className={`grid gap-3 ${billingType === "RECURRING" ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="space-y-1.5">
              <Label className="text-xs">Unit Price (₹) *</Label>
              <Input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" className="h-9 text-xs" />
            </div>
            {billingType === "RECURRING" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Billing Cycle</Label>
                <Select value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{CYCLES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity</Label>
              <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-xs" />
            </div>
            {billingType === "RECURRING" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Next Billing <span className="text-muted-foreground">(auto)</span></Label>
                <Input type="date" value={nextBillingDate} onChange={e => setNextBillingDate(e.target.value)} className="h-9 text-xs" />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="text-xs resize-none" placeholder="Internal notes…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="text-xs" onClick={() => { reset(); onOpenChange(false) }} disabled={saving}>Cancel</Button>
          <Button className="text-xs gap-1.5" onClick={handleSubmit} disabled={saving || !name.trim() || !unitPrice}>
            {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Adding…" : "Add Service"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
