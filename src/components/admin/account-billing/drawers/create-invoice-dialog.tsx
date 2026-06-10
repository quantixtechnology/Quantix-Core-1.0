"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, IndianRupee } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface BillingService {
  id:          string
  name:        string
  billingType: string
  unitPrice:   number
  quantity:    number
  status:      string
  billingCycle?: string | null
}

const TAX_OPTIONS = [
  { value: "0",  label: "No Tax (0%)" },
  { value: "5",  label: "5% GST" },
  { value: "12", label: "12% GST" },
  { value: "18", label: "18% GST" },
  { value: "28", label: "28% GST" },
]

function currentMonthLabel(): string {
  return new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })
}

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  open:         boolean
  onOpenChange: (v: boolean) => void
  businessId:   string
  services:     BillingService[]
  onSuccess:    () => void
}

export function CreateInvoiceDialog({ open, onOpenChange, businessId, services, onSuccess }: Props) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)

  const activeServices = services.filter(s => s.status === "ACTIVE")

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [billingPeriod, setBillingPeriod] = useState(currentMonthLabel)
  const [periodStart,   setPeriodStart]   = useState("")
  const [periodEnd,     setPeriodEnd]     = useState("")
  const [dueDate,       setDueDate]       = useState("")
  const [taxRate,       setTaxRate]       = useState("18")
  const [notes,         setNotes]         = useState("")

  // Pre-select all active services when dialog opens
  useEffect(() => {
    if (open) setSelectedIds(new Set(activeServices.map(s => s.id)))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const lineItems = useMemo(() =>
    activeServices
      .filter(s => selectedIds.has(s.id))
      .map(s => ({
        serviceId: s.id,
        name:      s.name,
        quantity:  s.quantity,
        unitPrice: s.unitPrice,
        amount:    s.unitPrice * s.quantity,
      })),
    [activeServices, selectedIds]
  )

  const subtotal   = lineItems.reduce((s, li) => s + li.amount, 0)
  const rate       = Number(taxRate)
  const cgstRate   = rate / 2
  const sgstRate   = rate / 2
  const cgstAmount = Math.round(subtotal * cgstRate / 100 * 100) / 100
  const sgstAmount = Math.round(subtotal * sgstRate / 100 * 100) / 100
  const taxAmount  = cgstAmount + sgstAmount
  const total      = Math.round((subtotal + taxAmount) * 100) / 100

  const toggle = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const reset = () => {
    setSelectedIds(new Set()); setBillingPeriod(currentMonthLabel())
    setPeriodStart(""); setPeriodEnd(""); setDueDate("")
    setTaxRate("18"); setNotes("")
  }

  const handleSubmit = async () => {
    if (lineItems.length === 0) { toast.error("Select at least one service"); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/account-billing/${businessId}/invoices`, {
        method:  "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body:    JSON.stringify({
          billingPeriod: billingPeriod.trim() || undefined,
          periodStart:   periodStart || undefined,
          periodEnd:     periodEnd   || undefined,
          dueDate:       dueDate     || undefined,
          taxRate:       rate,
          cgstRate, sgstRate, igstRate: 0,
          lineItems,
          notes: notes.trim() || undefined,
          createdById:   user?.id   ?? undefined,
          createdByName: user?.name ?? undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.error ?? "Failed to create invoice"); return }
      toast.success(json.message ?? "Invoice created")
      reset(); onSuccess()
    } catch { toast.error("Failed to create invoice") }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-violet-600" /> Create Invoice
          </DialogTitle>
          <DialogDescription className="text-xs">
            Select services to include. One invoice is generated for the billing period.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Services selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Services *</Label>
            {activeServices.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No active services. Add services first.</p>
            ) : (
              <div className="rounded-lg border divide-y max-h-44 overflow-y-auto">
                {activeServices.map(s => (
                  <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30">
                    <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.billingType === "RECURRING" ? s.billingCycle : "One-Time"} · {s.quantity} × ₹{s.unitPrice.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-right shrink-0">
                      ₹{(s.unitPrice * s.quantity).toLocaleString("en-IN")}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Period + due date */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 space-y-1.5">
              <Label className="text-xs">Billing Period Label</Label>
              <Input value={billingPeriod} onChange={e => setBillingPeriod(e.target.value)} placeholder="e.g. June 2026" className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Period Start</Label>
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Period End</Label>
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          {/* Tax */}
          <div className="space-y-1.5">
            <Label className="text-xs">GST Rate</Label>
            <Select value={taxRate} onValueChange={setTaxRate}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{TAX_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Totals */}
          {lineItems.length > 0 && (
            <div className="rounded-lg bg-muted/30 border p-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">{formatINR(subtotal)}</span></div>
              {rate > 0 && (
                <>
                  <div className="flex justify-between text-muted-foreground"><span>CGST ({cgstRate}%)</span><span className="font-mono">{formatINR(cgstAmount)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>SGST ({sgstRate}%)</span><span className="font-mono">{formatINR(sgstAmount)}</span></div>
                </>
              )}
              <div className="flex justify-between font-semibold pt-1 border-t">
                <span>Total</span><span className="font-mono text-violet-700">{formatINR(total)}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs resize-none" placeholder="Internal notes for this invoice…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="text-xs" onClick={() => { reset(); onOpenChange(false) }} disabled={saving}>Cancel</Button>
          <Button className="text-xs gap-1.5" onClick={handleSubmit} disabled={saving || lineItems.length === 0}>
            {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Creating…" : `Create Invoice${total > 0 ? " · " + formatINR(total) : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
