"use client"

import { useState, useEffect, useCallback } from "react"
import { Input }    from "@/components/ui/input"
import { Button }   from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Search, RefreshCw, Eye, Download, Mail, MessageCircle, CreditCard,
} from "lucide-react"
import { getAuthHeaders }        from "@/lib/admin-fetch"
import { toast }                 from "sonner"
import { InvoicePreviewPanel }   from "../invoice-preview/invoice-preview-panel"
import { RecordPaymentDialog }   from "../drawers/record-payment-dialog"
import { useAuthStore }          from "@/stores/auth-store"

// ── Types ────────────────────────────────────────────────────────────────────

interface InvoiceRow {
  id:            string
  invoiceNumber: string
  businessId:    string
  businessName:  string
  businessSlug:  string
  businessPhone: string | null
  businessEmail: string | null
  status:        string
  billingPeriod: string | null
  totalAmount:   number
  paidAmount:    number
  dueDate:       string | null
  issuedDate:    string | null
  createdAt:     string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) { return "₹" + v.toLocaleString("en-IN") }
function fmtDate(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

type PaymentDisplay = { label: string; cls: string }
function getPaymentDisplay(status: string): PaymentDisplay {
  if (status === "PAID")      return { label: "PAID",         cls: "bg-emerald-100 text-emerald-700" }
  if (status === "CANCELLED") return { label: "CANCELLED",    cls: "bg-slate-100 text-slate-600" }
  if (status === "OVERDUE")   return { label: "PAYMENT DUE",  cls: "bg-red-100 text-red-700" }
  return                             { label: "PAYMENT DUE",  cls: "bg-amber-100 text-amber-700" }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props { onViewAccount: (businessId: string) => void }

// ── Component ─────────────────────────────────────────────────────────────────

export function InvoicesTab({ onViewAccount }: Props) {
  const { user } = useAuthStore()
  const [rows,    setRows]    = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState("")
  const [status,  setStatus]  = useState("ALL")
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const LIMIT = 50

  // Preview panel
  const [previewId,     setPreviewId]     = useState<string | null>(null)
  const [previewBizId,  setPreviewBizId]  = useState<string>("")
  const [previewOpen,   setPreviewOpen]   = useState(false)

  // Record payment (for payment dialog from preview)
  const [payOpen,         setPayOpen]         = useState(false)
  const [payInvoiceId,    setPayInvoiceId]    = useState<string | undefined>(undefined)
  const [payBusinessId,   setPayBusinessId]   = useState<string>("")
  const [payInvoices,     setPayInvoices]     = useState<InvoiceRow[]>([])

  // Email sending state per row
  const [emailingId, setEmailingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (search)           p.set("search", search)
      if (status !== "ALL") p.set("status", status)
      const res  = await fetch(`/api/admin/account-billing/invoices?${p}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) { setRows(json.data); setTotal(json.pagination.total) }
    } catch { toast.error("Failed to load invoices") }
    finally { setLoading(false) }
  }, [page, search, status])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, status])

  // ── Actions ────────────────────────────────────────────────────────────────

  const openPreview = (inv: InvoiceRow) => {
    setPreviewId(inv.id)
    setPreviewBizId(inv.businessId)
    setPreviewOpen(true)
  }

  const downloadPdf = (inv: InvoiceRow) => {
    window.open(`/api/admin/account-billing/${inv.businessId}/invoices/${inv.id}/pdf`, "_blank")
  }

  const sendEmail = async (inv: InvoiceRow) => {
    if (!inv.businessEmail) { toast.error("Business has no contact email"); return }
    setEmailingId(inv.id)
    try {
      const res  = await fetch(`/api/admin/account-billing/${inv.businessId}/invoices/${inv.id}/email`, {
        method:  "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body:    JSON.stringify({}),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.error ?? "Failed to send email"); return }
      toast.success(json.message ?? "Invoice emailed")
    } catch { toast.error("Failed to send email") }
    finally { setEmailingId(null) }
  }

  const sendWhatsApp = (inv: InvoiceRow) => {
    const phone = inv.businessPhone?.replace(/\D/g, "")
    if (!phone) { toast.error("Business has no phone number"); return }
    const pd      = getPaymentDisplay(inv.status)
    const balance = Math.max(0, inv.totalAmount - inv.paidAmount)
    const msg = [
      `Hi ${inv.businessName},`,
      ``,
      pd.label === "PAID"
        ? `Your invoice ${inv.invoiceNumber} has been marked PAID. Thank you!`
        : `Your invoice ${inv.invoiceNumber} for ${fmt(inv.totalAmount)} is pending.`,
      inv.billingPeriod ? `Period: ${inv.billingPeriod}` : null,
      inv.dueDate       ? `Due Date: ${fmtDate(inv.dueDate)}` : null,
      pd.label !== "PAID" ? `Amount Due: ${fmt(balance)}` : null,
      ``,
      `For queries: billing@quantixtechnology.in`,
    ].filter(Boolean).join("\n")
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank")
  }

  const openRecordPayment = (inv: InvoiceRow) => {
    // Collect all unpaid invoices for this business (at least the current one)
    const biz = rows.filter(r => r.businessId === inv.businessId && !["PAID", "CANCELLED"].includes(r.status))
    setPayInvoices(biz.length > 0 ? biz : [inv])
    setPayInvoiceId(inv.id)
    setPayBusinessId(inv.businessId)
    setPayOpen(true)
  }

  const afterPayment = () => {
    setPayOpen(false)
    load()
    // If preview is open for the same invoice, reload it
    if (previewOpen) { setPreviewOpen(false); setTimeout(() => setPreviewOpen(true), 50) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search business…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 text-xs w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Payment Due (Draft)</SelectItem>
              <SelectItem value="SENT">Payment Due (Sent)</SelectItem>
              <SelectItem value="OVERDUE">Payment Due (Overdue)</SelectItem>
              <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">{total} invoice{total !== 1 ? "s" : ""}</div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-[11px]">
                <TableHead>Invoice #</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-sm text-muted-foreground">
                        No invoices found
                      </TableCell>
                    </TableRow>
                  )
                : rows.map(r => {
                    const pd      = getPaymentDisplay(r.status)
                    const balance = Math.max(0, r.totalAmount - r.paidAmount)
                    const canPay  = !["PAID", "CANCELLED"].includes(r.status)
                    return (
                      <TableRow key={r.id} className="text-xs hover:bg-muted/30">
                        <TableCell>
                          <button
                            className="font-mono text-[11px] font-semibold text-violet-700 hover:underline"
                            onClick={() => openPreview(r)}
                          >
                            {r.invoiceNumber}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">{r.businessName}</TableCell>
                        <TableCell>{r.billingPeriod ?? fmtDate(r.issuedDate)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          <div>{fmt(r.totalAmount)}</div>
                          {r.paidAmount > 0 && r.paidAmount < r.totalAmount && (
                            <div className="text-[10px] text-amber-600">{fmt(balance)} due</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pd.cls}`}>
                            {pd.label}
                          </span>
                        </TableCell>
                        <TableCell>{fmtDate(r.dueDate)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {/* Preview */}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Preview invoice" onClick={() => openPreview(r)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {/* Download PDF */}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-violet-600" title="Download PDF" onClick={() => downloadPdf(r)}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            {/* Email */}
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-sky-600"
                              title={r.businessEmail ? "Email invoice" : "No contact email"}
                              disabled={!r.businessEmail || emailingId === r.id}
                              onClick={() => sendEmail(r)}
                            >
                              {emailingId === r.id
                                ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                : <Mail className="h-3.5 w-3.5" />}
                            </Button>
                            {/* WhatsApp */}
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-emerald-600"
                              title={r.businessPhone ? "Send via WhatsApp" : "No phone number"}
                              disabled={!r.businessPhone}
                              onClick={() => sendWhatsApp(r)}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </Button>
                            {/* Record Payment */}
                            {canPay && (
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 w-7 p-0 text-orange-600"
                                title="Record payment"
                                onClick={() => openRecordPayment(r)}
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center gap-2 justify-end text-xs">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <span className="text-muted-foreground">Page {page} of {Math.ceil(total / LIMIT)}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      {/* Invoice Preview Panel */}
      <InvoicePreviewPanel
        open={previewOpen}
        invoiceId={previewId}
        businessId={previewBizId}
        onClose={() => setPreviewOpen(false)}
        onStatusChange={load}
        onRecordPayment={(invId) => {
          setPreviewOpen(false)
          const inv = rows.find(r => r.id === invId)
          if (inv) {
            const biz = rows.filter(r => r.businessId === inv.businessId && !["PAID","CANCELLED"].includes(r.status))
            setPayInvoices(biz.length > 0 ? biz : [inv])
            setPayInvoiceId(invId)
            setPayBusinessId(inv.businessId)
            setPayOpen(true)
          }
        }}
      />

      {/* Record Payment Dialog */}
      {payOpen && (
        <RecordPaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          businessId={payBusinessId}
          invoices={payInvoices}
          defaultInvoiceId={payInvoiceId}
          onSuccess={afterPayment}
        />
      )}
    </>
  )
}
