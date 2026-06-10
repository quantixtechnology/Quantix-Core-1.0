"use client"

import { useState, useEffect, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Send, CheckCircle, XCircle, RefreshCw, Building2 } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface LineItem {
  serviceId?:  string | null
  name:        string
  description?: string | null
  quantity:    number
  unitPrice:   number
  amount:      number
}

interface Invoice {
  id:            string
  invoiceNumber: string
  status:        string
  billingPeriod: string | null
  periodStart:   string | null
  periodEnd:     string | null
  lineItems:     string       // JSON
  subtotal:      number
  taxRate:       number
  cgstRate:      number
  sgstRate:      number
  igstRate:      number
  cgstAmount:    number
  sgstAmount:    number
  igstAmount:    number
  taxAmount:     number
  totalAmount:   number
  paidAmount:    number
  currency:      string
  issuedDate:    string | null
  dueDate:       string | null
  notes:         string | null
  createdByName: string | null
  account: {
    business: {
      name:         string
      contactEmail: string | null
      contactPhone: string | null
      address:      string | null
      city:         string | null
      state:        string | null
      gstNumber:    string | null
      logo:         string | null
    }
  }
  payments: Array<{
    id:            string
    amount:        number
    paidAt:        string
    paymentMode:   string | null
    status:        string
    transactionId: string | null
  }>
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:            "bg-slate-100 text-slate-700",
  SENT:             "bg-sky-100 text-sky-700",
  PAID:             "bg-emerald-100 text-emerald-700",
  PARTIALLY_PAID:   "bg-amber-100 text-amber-700",
  OVERDUE:          "bg-red-100 text-red-700",
  CANCELLED:        "bg-rose-100 text-rose-700",
}

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

interface Props {
  open:         boolean
  invoiceId:    string | null
  businessId:   string
  onClose:      () => void
  onStatusChange?: () => void
}

export function InvoicePreviewPanel({ open, invoiceId, businessId, onClose, onStatusChange }: Props) {
  const { user } = useAuthStore()
  const [invoice, setInvoice]   = useState<Invoice | null>(null)
  const [loading, setLoading]   = useState(false)
  const [acting,  setActing]    = useState(false)

  const load = useCallback(async () => {
    if (!invoiceId) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/admin/account-billing/${businessId}/invoices/${invoiceId}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) setInvoice(json.data)
    } catch { toast.error("Failed to load invoice") }
    finally { setLoading(false) }
  }, [invoiceId, businessId])

  useEffect(() => { if (open && invoiceId) load() }, [open, invoiceId, load])

  const transition = async (status: string) => {
    if (!invoice) return
    setActing(true)
    try {
      const res  = await fetch(`/api/admin/account-billing/${businessId}/invoices/${invoice.id}`, {
        method:  "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body:    JSON.stringify({ status, performedById: user?.id, performedByName: user?.name }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.error ?? "Failed to update invoice"); return }
      toast.success(`Invoice ${status.toLowerCase()}`)
      await load()
      onStatusChange?.()
    } catch { toast.error("Failed to update invoice") }
    finally { setActing(false) }
  }

  const lineItems: LineItem[] = invoice ? (() => { try { return JSON.parse(invoice.lineItems) } catch { return [] } })() : []
  const biz = invoice?.account?.business

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold">
              {loading ? "Loading…" : invoice?.invoiceNumber ?? "Invoice"}
            </SheetTitle>
            {invoice && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[invoice.status] ?? "bg-muted text-muted-foreground"}`}>
                {invoice.status}
              </span>
            )}
          </div>
        </SheetHeader>

        {loading && (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {!loading && invoice && (
          <div className="p-6 space-y-6">
            {/* Business header */}
            <div className="flex justify-between items-start gap-6">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-violet-600" />
                  <span className="font-semibold text-sm">{biz?.name}</span>
                </div>
                {biz?.contactEmail && <p className="text-xs text-muted-foreground">{biz.contactEmail}</p>}
                {biz?.contactPhone && <p className="text-xs text-muted-foreground">{biz.contactPhone}</p>}
                {(biz?.address || biz?.city) && (
                  <p className="text-xs text-muted-foreground">
                    {[biz.address, biz.city, biz.state].filter(Boolean).join(", ")}
                  </p>
                )}
                {biz?.gstNumber && <p className="text-xs text-muted-foreground">GST: {biz.gstNumber}</p>}
              </div>

              <div className="text-right space-y-0.5 text-xs">
                <p className="font-mono font-semibold text-sm">{invoice.invoiceNumber}</p>
                {invoice.billingPeriod && <p className="text-muted-foreground">{invoice.billingPeriod}</p>}
                <p className="text-muted-foreground">Issued: {fmtDate(invoice.issuedDate)}</p>
                {invoice.dueDate && <p className={`font-medium ${invoice.status === "OVERDUE" ? "text-red-600" : ""}`}>Due: {fmtDate(invoice.dueDate)}</p>}
              </div>
            </div>

            <Separator />

            {/* Line items */}
            <div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Service</th>
                    <th className="pb-2 text-right font-medium w-12">Qty</th>
                    <th className="pb-2 text-right font-medium w-24">Unit Price</th>
                    <th className="pb-2 text-right font-medium w-24">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lineItems.map((item, i) => (
                    <tr key={i} className="py-1">
                      <td className="py-2">
                        <p className="font-medium">{item.name}</p>
                        {item.description && <p className="text-muted-foreground text-[10px]">{item.description}</p>}
                      </td>
                      <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                      <td className="py-2 text-right tabular-nums font-mono">{fmt(item.unitPrice)}</td>
                      <td className="py-2 text-right tabular-nums font-mono">{fmt(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1.5 text-xs max-w-xs ml-auto">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">{fmt(invoice.subtotal)}</span></div>
              {invoice.cgstAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>CGST ({invoice.cgstRate}%)</span><span className="font-mono">{fmt(invoice.cgstAmount)}</span></div>}
              {invoice.sgstAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>SGST ({invoice.sgstRate}%)</span><span className="font-mono">{fmt(invoice.sgstAmount)}</span></div>}
              {invoice.igstAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>IGST ({invoice.igstRate}%)</span><span className="font-mono">{fmt(invoice.igstAmount)}</span></div>}
              <div className="flex justify-between font-semibold border-t pt-1.5 text-sm"><span>Total</span><span className="font-mono text-violet-700">{fmt(invoice.totalAmount)}</span></div>
              {invoice.paidAmount > 0 && (
                <>
                  <div className="flex justify-between text-emerald-600"><span>Paid</span><span className="font-mono">{fmt(invoice.paidAmount)}</span></div>
                  <div className="flex justify-between font-semibold text-red-600"><span>Balance Due</span><span className="font-mono">{fmt(Math.max(0, invoice.totalAmount - invoice.paidAmount))}</span></div>
                </>
              )}
            </div>

            {/* Payments received */}
            {invoice.payments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payments</p>
                {invoice.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                    <div>
                      <p className="font-medium">{fmt(p.amount)}</p>
                      <p className="text-muted-foreground">{p.paymentMode ?? "—"}{p.transactionId ? ` · ${p.transactionId}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <p>{fmtDate(p.paidAt)}</p>
                      <Badge variant={p.status === "COMPLETED" ? "default" : "secondary"} className="text-[9px] h-4">{p.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {invoice.notes && (
              <div className="rounded-lg bg-muted/30 border p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Notes:</span> {invoice.notes}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {invoice.status === "DRAFT" && (
                <Button size="sm" className="text-xs h-8 gap-1.5" onClick={() => transition("SENT")} disabled={acting}>
                  {acting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Mark Sent
                </Button>
              )}
              {["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) && (
                <Button size="sm" variant="default" className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => transition("PAID")} disabled={acting}>
                  {acting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} Mark Paid
                </Button>
              )}
              {invoice.status === "SENT" && (
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => transition("OVERDUE")} disabled={acting}>
                  Mark Overdue
                </Button>
              )}
              {!["PAID", "CANCELLED"].includes(invoice.status) && (
                <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => transition("CANCELLED")} disabled={acting}>
                  <XCircle className="h-3 w-3" /> Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
