"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Printer, Mail, MessageCircle, Send, CheckCircle, CreditCard,
  XCircle, Eye, AlertCircle, RefreshCw, X,
} from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { DocumentRenderer, type DocumentData, type LineItem, type Letterhead } from "./document-renderer"
import { DocumentTypeBadge, DocumentStatusBadge } from "../shared/document-type-badge"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  documentId: string | null
  letterhead: Letterhead
  clientName: string
  clientGst?: string | null
  clientEmail?: string | null
  onStatusChange?: () => void
}

const STATUS_PRIMARY_ACTION: Record<string, { label: string; icon: React.ElementType; next: string; variant?: "default" | "outline" | "destructive" }> = {
  "Draft":              { label: "Mark Sent",           icon: Send,        next: "Sent"               },
  "Sent":               { label: "Mark Viewed",         icon: Eye,         next: "Viewed"             },
  "Viewed":             { label: "Mark Accepted",       icon: CheckCircle, next: "Accepted"           },
  "Accepted":           { label: "Record Payment",      icon: CreditCard,  next: "__payment_form__"   },
  "Payment Submitted":  { label: "Start Verification",  icon: AlertCircle, next: "Under Verification" },
  "Under Verification": { label: "Verify & Approve",   icon: CheckCircle, next: "Paid"               },
}

const CANCELLABLE = new Set(["Draft","Sent","Viewed","Accepted","Payment Submitted","Under Verification"])

export function DocumentPreviewPanel({
  open, onOpenChange, businessId, documentId,
  letterhead, clientName, clientGst, clientEmail, onStatusChange,
}: Props) {
  const rendererRef = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<DocumentData & { id: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)

  // Payment form state
  const [payAmount, setPayAmount] = useState("")
  const [payMode, setPayMode]     = useState("BANK_TRANSFER")
  const [payDate, setPayDate]     = useState(() => new Date().toISOString().slice(0, 10))
  const [payRef, setPayRef]       = useState("")

  const fetchDoc = useCallback(async () => {
    if (!documentId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/account-billing/${businessId}/documents/${documentId}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) {
        const raw = json.data
        const lineItems: LineItem[] = (() => {
          try { return JSON.parse(raw.lineItems ?? "[]") } catch { return [] }
        })()
        setDoc({ ...raw, lineItems })
      } else {
        toast.error(json.error ?? "Failed to load document")
      }
    } catch {
      toast.error("Failed to load document")
    } finally {
      setLoading(false)
    }
  }, [businessId, documentId])

  useEffect(() => {
    if (open && documentId) {
      setDoc(null)
      setShowPaymentForm(false)
      fetchDoc()
    }
  }, [open, documentId, fetchDoc])

  const transition = useCallback(async (nextStatus: string, notes?: string) => {
    if (!doc) return
    setTransitioning(true)
    try {
      const res = await fetch(`/api/admin/account-billing/${businessId}/documents/${doc.id}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, ...(notes ? { notes } : {}) }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Document ${nextStatus === "Paid" ? "approved — invoice generated" : `marked as ${nextStatus}`}`)
        setShowPaymentForm(false)
        await fetchDoc()
        onStatusChange?.()
      } else {
        toast.error(json.error ?? "Transition failed")
      }
    } catch {
      toast.error("Failed to update document")
    } finally {
      setTransitioning(false)
    }
  }, [doc, businessId, fetchDoc, onStatusChange])

  const handlePrimaryAction = () => {
    if (!doc) return
    const action = STATUS_PRIMARY_ACTION[doc.status]
    if (!action) return
    if (action.next === "__payment_form__") {
      setPayAmount(String(doc.totalWithGst ?? doc.amount))
      setShowPaymentForm(true)
      return
    }
    transition(action.next)
  }

  const handleRecordPayment = async () => {
    const notes = `Payment: ₹${payAmount} via ${payMode.replace(/_/g, " ")} on ${payDate}${payRef ? ` | Ref: ${payRef}` : ""}`
    await transition("Payment Submitted", notes)
  }

  const handlePrint = () => {
    if (!rendererRef.current) return
    const content = rendererRef.current.outerHTML
    const win = window.open("", "_blank", "width=900,height=700")
    if (!win) { toast.error("Popup blocked — allow popups and try again"); return }
    win.document.write(`<!DOCTYPE html><html><head><title>${doc?.documentNumber ?? "Document"}</title><style>body{margin:0;padding:20px;background:white;}@media print{@page{margin:15mm;}}</style></head><body>${content}</body></html>`)
    win.document.close()
    win.addEventListener("load", () => { setTimeout(() => { win.print() }, 200) })
  }

  const handleEmail = () => {
    if (!doc || !clientEmail) { toast.error("No client email available"); return }
    const subject = encodeURIComponent(`${doc.documentNumber} — ${letterhead.name}`)
    const body = encodeURIComponent(`Dear ${clientName},\n\nPlease find attached ${doc.documentNumber}.\n\nAmount: ₹${(doc.totalWithGst ?? doc.amount).toLocaleString("en-IN")}\n\nRegards,\n${letterhead.name}`)
    window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`)
  }

  const handleWhatsApp = () => {
    if (!doc) return
    const text = encodeURIComponent(`Hi ${clientName},\n\nYour ${doc.documentNumber} for ₹${(doc.totalWithGst ?? doc.amount).toLocaleString("en-IN")} is ready.\n\n— ${letterhead.name}`)
    window.open(`https://wa.me/?text=${text}`)
  }

  const primaryAction = doc ? STATUS_PRIMARY_ACTION[doc.status] : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[920px] sm:max-w-[920px] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {loading || !doc
                ? <Skeleton className="h-5 w-48" />
                : (
                  <>
                    <SheetTitle className="font-mono text-base">{doc.documentNumber}</SheetTitle>
                    <DocumentTypeBadge value={doc.documentType} />
                    <DocumentStatusBadge value={doc.status} />
                  </>
                )}
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Action toolbar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b bg-muted/30 shrink-0 flex-wrap">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handlePrint} disabled={loading || !doc}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleEmail} disabled={loading || !doc}>
            <Mail className="h-3.5 w-3.5" /> Email
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleWhatsApp} disabled={loading || !doc}>
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {primaryAction && (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handlePrimaryAction}
              disabled={transitioning || loading}
            >
              {transitioning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <primaryAction.icon className="h-3.5 w-3.5" />}
              {primaryAction.label}
            </Button>
          )}

          {doc && CANCELLABLE.has(doc.status) && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => transition("Cancelled")}
              disabled={transitioning}
            >
              <XCircle className="h-3.5 w-3.5" /> Cancel Doc
            </Button>
          )}
        </div>

        {/* Record Payment inline form */}
        {showPaymentForm && (
          <div className="px-6 py-4 border-b bg-amber-50/60 shrink-0">
            <p className="text-xs font-semibold text-amber-800 mb-3">Record Payment Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Amount (₹)</Label>
                <Input className="h-8 text-xs" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Payment Mode</Label>
                <Select value={payMode} onValueChange={setPayMode}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Date</Label>
                <Input className="h-8 text-xs" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Reference / UTR</Label>
                <Input className="h-8 text-xs" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleRecordPayment} disabled={transitioning || !payAmount}>
                {transitioning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                Submit Payment
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowPaymentForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Document preview area */}
        <div className="flex-1 overflow-y-auto bg-gray-100 px-6 py-8">
          {loading || !doc
            ? (
              <div className="max-w-[760px] mx-auto space-y-3 bg-white rounded-xl p-10 shadow-sm">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )
            : (
              <div className="shadow-lg rounded-lg overflow-hidden">
                <DocumentRenderer
                  ref={rendererRef}
                  document={doc}
                  letterhead={letterhead}
                  clientName={clientName}
                  clientGst={clientGst}
                  clientEmail={clientEmail}
                />
              </div>
            )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
