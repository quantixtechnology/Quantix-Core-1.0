"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FileText, ChevronRight } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import { DocumentTypeBadge, DocumentStatusBadge } from "../shared/document-type-badge"

const DOC_TYPES = ["PROFORMA", "TAX_INVOICE", "CREDIT_NOTE", "DEBIT_NOTE", "PAYMENT_RECEIPT", "ADJUSTMENT_NOTE"]

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  Draft:           ["Sent", "Cancelled"],
  Sent:            ["Accepted", "Expired", "Cancelled"],
  Accepted:        ["Paid", "Partially Paid", "Cancelled"],
  "Partially Paid":["Paid", "Cancelled"],
  Expired:         ["Cancelled"],
  Cancelled:       [],
  Paid:            [],
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  existingDoc: Record<string, unknown> | null
  onSuccess: () => void
}

export function BillingDocumentDrawer({ open, onOpenChange, businessId, existingDoc, onSuccess }: Props) {
  const { user } = useAuthStore()
  const isNew = !existingDoc

  const [documentType, setDocType] = useState("PROFORMA")
  const [amount, setAmount]         = useState("")
  const [notes, setNotes]           = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [newStatus, setNewStatus]   = useState("")
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    if (existingDoc) {
      setDocType(String(existingDoc.documentType ?? "PROFORMA"))
      setAmount(String(existingDoc.amount ?? ""))
      setNotes(String(existingDoc.notes ?? ""))
      setValidUntil(existingDoc.validUntil ? String(existingDoc.validUntil).slice(0, 10) : "")
      setNewStatus("")
    } else {
      setDocType("PROFORMA"); setAmount(""); setNotes(""); setValidUntil(""); setNewStatus("")
    }
  }, [existingDoc, open])

  const handleCreate = async () => {
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/account-billing/${businessId}/documents`, {
        method: "POST",
        headers: getAuthHeaders() as Record<string, string>,
        body: JSON.stringify({
          documentType,
          amount: amt,
          notes: notes.trim() || null,
          validUntil: validUntil || null,
          createdById:   user?.id ?? undefined,
          createdByName: user?.name ?? undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`${documentType.replace(/_/g, " ")} created — ${json.data.documentNumber}`)
        onSuccess()
      } else {
        toast.error(json.error ?? "Failed to create")
      }
    } catch { toast.error("Failed to create") }
    finally { setSaving(false) }
  }

  const handleTransition = async () => {
    if (!newStatus || !existingDoc) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/account-billing/${businessId}/documents/${existingDoc.id}`, {
        method: "PATCH",
        headers: getAuthHeaders() as Record<string, string>,
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Status updated to ${newStatus}`)
        onSuccess()
      } else {
        toast.error(json.error ?? "Failed to update")
      }
    } catch { toast.error("Failed to update") }
    finally { setSaving(false) }
  }

  const currentStatus = existingDoc ? String(existingDoc.status) : null
  const allowedNext = currentStatus ? (ALLOWED_TRANSITIONS[currentStatus] ?? []) : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[460px] sm:max-w-[460px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-sky-600" />
            <SheetTitle className="text-base">{isNew ? "New Billing Document" : "Billing Document"}</SheetTitle>
          </div>
          {!isNew && existingDoc && (
            <SheetDescription className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs">{String(existingDoc.documentNumber)}</span>
              <DocumentTypeBadge value={String(existingDoc.documentType)} />
              <DocumentStatusBadge value={String(existingDoc.status)} />
            </SheetDescription>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {isNew ? (
              <>
                {/* Document Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Document Type *</Label>
                  <Select value={documentType} onValueChange={setDocType}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount (₹) *</Label>
                  <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="h-9 text-xs" />
                </div>

                {/* Valid Until */}
                {(documentType === "PROFORMA") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valid Until</Label>
                    <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-9 text-xs" />
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Textarea placeholder="Optional notes for this document…" value={notes} onChange={e => setNotes(e.target.value)} className="text-xs resize-none" rows={3} />
                </div>
              </>
            ) : (
              <>
                {/* View existing */}
                {existingDoc && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><p className="text-[10px] text-muted-foreground">Amount</p><p className="font-medium text-base">₹{Number(existingDoc.amount).toLocaleString("en-IN")}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Issued</p><p className="font-medium">{existingDoc.issuedDate ? new Date(String(existingDoc.issuedDate)).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}) : "—"}</p></div>
                      {Boolean(existingDoc.validUntil) && <div><p className="text-[10px] text-muted-foreground">Valid Until</p><p className="font-medium">{new Date(String(existingDoc.validUntil)).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</p></div>}
                      {Boolean(existingDoc.totalWithGst) && <div><p className="text-[10px] text-muted-foreground">Total w/ GST</p><p className="font-medium">₹{Number(existingDoc.totalWithGst).toLocaleString("en-IN")}</p></div>}
                    </div>
                    {Boolean(existingDoc.notes) && (
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">{String(existingDoc.notes)}</p>
                      </div>
                    )}

                    {allowedNext.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <p className="text-xs font-medium">Transition Status</p>
                          <div className="flex flex-wrap gap-1.5">
                            {allowedNext.map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setNewStatus(s)}
                                className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${newStatus === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                              >
                                <ChevronRight className="h-3 w-3" /> {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="px-6 pb-6 flex gap-2">
          {isNew ? (
            <>
              <Button className="flex-1" onClick={handleCreate} disabled={saving || !amount}>
                {saving ? "Creating…" : "Create Document"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            </>
          ) : (
            <>
              {allowedNext.length > 0 && (
                <Button className="flex-1" onClick={handleTransition} disabled={saving || !newStatus}>
                  {saving ? "Updating…" : newStatus ? `Mark as ${newStatus}` : "Select Status"}
                </Button>
              )}
              <Button variant="outline" className={allowedNext.length > 0 ? "flex-1" : "w-full"} onClick={() => onOpenChange(false)}>
                {allowedNext.length === 0 ? "Close" : "Cancel"}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
