"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { RefreshCw } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface BillingInvoice {
  id:            string
  invoiceNumber: string
  billingPeriod: string | null
  totalAmount:   number
  paidAmount:    number
  status:        string
}

const PAYMENT_MODES = [
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "UPI",           label: "UPI" },
  { value: "CASH",          label: "Cash" },
  { value: "CHEQUE",        label: "Cheque" },
  { value: "CARD",          label: "Card" },
  { value: "ONLINE",        label: "Online" },
]

interface Props {
  open:             boolean
  onOpenChange:     (v: boolean) => void
  businessId:       string
  invoices:         BillingInvoice[]
  defaultInvoiceId?: string
  onSuccess:        () => void
}

export function RecordPaymentDialog({ open, onOpenChange, businessId, invoices, defaultInvoiceId, onSuccess }: Props) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)

  const unpaidInvoices = invoices.filter(inv => !["PAID", "CANCELLED"].includes(inv.status))

  const [invoiceId,       setInvoiceId]       = useState(defaultInvoiceId ?? "")
  const [amount,          setAmount]          = useState("")
  const [paymentMode,     setPaymentMode]     = useState("BANK_TRANSFER")
  const [transactionId,   setTransactionId]   = useState("")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [bankName,        setBankName]        = useState("")
  const [paidAt,          setPaidAt]          = useState(() => new Date().toISOString().slice(0, 10))
  const [status,          setStatus]          = useState("COMPLETED")
  const [notes,           setNotes]           = useState("")

  // When dialog opens with a defaultInvoiceId, pre-select and auto-fill the outstanding amount
  useEffect(() => {
    if (!open) return
    const id = defaultInvoiceId ?? ""
    setInvoiceId(id)
    if (id) {
      const inv = unpaidInvoices.find(i => i.id === id)
      if (inv) setAmount(String(Math.max(0, inv.totalAmount - inv.paidAmount)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultInvoiceId])

  const selectedInvoice = unpaidInvoices.find(inv => inv.id === invoiceId)
  const outstanding = selectedInvoice
    ? Math.max(0, selectedInvoice.totalAmount - selectedInvoice.paidAmount)
    : 0

  const reset = () => {
    setInvoiceId(""); setAmount(""); setPaymentMode("BANK_TRANSFER"); setTransactionId("")
    setReferenceNumber(""); setBankName(""); setPaidAt(new Date().toISOString().slice(0, 10))
    setStatus("COMPLETED"); setNotes("")
  }

  const handleSubmit = async () => {
    if (!invoiceId)  { toast.error("Select an invoice"); return }
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/account-billing/${businessId}/payments`, {
        method:  "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body:    JSON.stringify({
          invoiceId,
          amount: amt,
          paymentMode:     paymentMode     || undefined,
          transactionId:   transactionId   || undefined,
          referenceNumber: referenceNumber || undefined,
          bankName:        bankName        || undefined,
          paidAt:          paidAt          || undefined,
          status,
          notes:           notes           || undefined,
          recordedById:    user?.id        ?? undefined,
          recordedByName:  user?.name      ?? undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.error ?? "Failed to record payment"); return }
      toast.success(json.message ?? "Payment recorded")
      reset(); onSuccess()
    } catch { toast.error("Failed to record payment") }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Record Payment</DialogTitle>
          <DialogDescription className="text-xs">
            Link this payment to an invoice. The invoice balance updates automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Invoice selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Invoice *</Label>
            {unpaidInvoices.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No outstanding invoices.</p>
            ) : (
              <Select value={invoiceId} onValueChange={v => { setInvoiceId(v); setAmount(String(Math.max(0, unpaidInvoices.find(i => i.id === v)?.totalAmount ?? 0 - (unpaidInvoices.find(i => i.id === v)?.paidAmount ?? 0)))) }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select invoice…" /></SelectTrigger>
                <SelectContent>
                  {unpaidInvoices.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono">{inv.invoiceNumber}</span>
                        {inv.billingPeriod && <span className="text-muted-foreground">— {inv.billingPeriod}</span>}
                        <Badge variant="outline" className="text-[9px] h-4">₹{(inv.totalAmount - inv.paidAmount).toLocaleString("en-IN")} due</Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedInvoice && (
              <p className="text-[11px] text-muted-foreground">
                Outstanding: <span className="font-semibold text-foreground">₹{outstanding.toLocaleString("en-IN")}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (₹) *</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="PENDING_VERIFICATION">Pending Verification</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Transaction ID</Label>
              <Input value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="UTR / TXN…" className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bank Name</Label>
              <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="HDFC, SBI…" className="h-9 text-xs" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs resize-none" placeholder="Remarks…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="text-xs" onClick={() => { reset(); onOpenChange(false) }} disabled={saving}>Cancel</Button>
          <Button className="text-xs gap-1.5" onClick={handleSubmit} disabled={saving || !invoiceId || !amount}>
            {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Recording…" : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
