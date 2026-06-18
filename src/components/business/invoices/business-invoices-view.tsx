"use client"

import { useState, useEffect, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useBusinessContext } from "@/hooks/use-business-context"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { PageHeader } from "@/components/admin/shared/page-header"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { showSuccess, showError } from "@/lib/toast-utils"
import {
  Receipt, Search, RefreshCw, CreditCard, FileText,
  Download, User, Hash, Calendar, QrCode, Smartphone, Banknote,
} from "lucide-react"
import { buildUpiUri } from "@/lib/upi-qr"
import { QrCode as QrCodeDisplay } from "@/components/ui/qr-code"

interface InvoiceRow {
  id: string
  invoiceNumber: string
  totalAmount: number
  paidAmount: number
  status: string
  paidAt: string | null
  dueDate: string | null
  notes: string | null
  metadata: string
  createdAt: string
  order: { id: string; orderNumber: string; deliveredAt: string | null } | null
  customer: { id: string; name: string; phone: string | null; accountType: string } | null
}

interface Pagination {
  page: number; limit: number; total: number; pages: number
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PAYMENT_DUE: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
}

function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export function BusinessInvoicesView() {
  const { businessId } = useBusinessContext()
  const { user } = useAuthStore()

  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)

  // Record payment dialog
  const [paymentDialog, setPaymentDialog] = useState<InvoiceRow | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payNotes, setPayNotes] = useState("")
  const [paying, setPaying] = useState(false)

  // Invoice detail dialog (audit trail)
  const [detailDialog, setDetailDialog] = useState<InvoiceRow | null>(null)

  // UPI payment config (from business settings)
  const [upiConfig, setUpiConfig] = useState<{ upiId: string; merchantName: string; qrEnabled: boolean } | null>(null)

  const fetchInvoices = useCallback(async (p = 1, q = search, st = statusFilter) => {
    if (!businessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: "25" })
      if (q) params.set("search", q)
      if (st) params.set("status", st)
      const res = await fetch(
        `/api/core/businesses/${businessId}/invoices?${params}`,
        { headers: getAuthHeaders() }
      )
      const json = await res.json()
      if (json.success) {
        setInvoices(json.data || [])
        setPagination(json.pagination)
      } else {
        showError(json.error || "Failed to load invoices")
      }
    } catch {
      showError("Failed to load invoices")
    } finally {
      setLoading(false)
    }
  }, [businessId, search, statusFilter])

  useEffect(() => { fetchInvoices(page) }, [page])
  useEffect(() => { setPage(1); fetchInvoices(1, search, statusFilter) }, [search, statusFilter])

  // Load UPI config from business settings
  useEffect(() => {
    if (!businessId) return
    fetch(`/api/core/businesses/${businessId}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data?.settings) {
          try {
            const s = typeof j.data.settings === 'string' ? JSON.parse(j.data.settings) : j.data.settings
            if (s.upiId) setUpiConfig({ upiId: s.upiId, merchantName: s.merchantName || '', qrEnabled: s.qrEnabled === true })
          } catch { /* ignore */ }
        }
      })
      .catch(() => {})
  }, [businessId])

  const handleRecordPayment = async () => {
    if (!paymentDialog || !payAmount || Number(payAmount) <= 0) return
    setPaying(true)
    try {
      const orderId = paymentDialog.order?.id
      if (!orderId) { showError("No order linked to this invoice"); return }
      const newPaid = paymentDialog.paidAmount + Number(payAmount)
      const res = await fetch(`/api/core/orders/${orderId}/invoice`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ paidAmount: newPaid, notes: payNotes || undefined, adminName: user?.name }),
      })
      const json = await res.json()
      if (json.success) {
        showSuccess("Payment recorded")
        setPaymentDialog(null)
        fetchInvoices(page)
      } else {
        showError(json.error || "Failed to record payment")
      }
    } finally {
      setPaying(false)
    }
  }

  const downloadInvoicePdf = async (inv: InvoiceRow) => {
    const url = `/api/core/businesses/${businessId}/invoices/${inv.id}/pdf`
    try {
      const res = await fetch(url, { headers: getAuthHeaders() })
      if (!res.ok) {
        const body = await res.text()
        let msg = `PDF failed (${res.status})`
        try { msg = JSON.parse(body).error || msg } catch { /* not JSON */ }
        showError(msg)
        return
      }
      // Open HTML blob in new tab — auto-print script triggers print dialog
      const blob   = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, "_blank")
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch {
      showError("Failed to download invoice PDF")
    }
  }

  const statusTabs = ["", "DRAFT", "PAYMENT_DUE", "PAID"]
  const statusLabels: Record<string, string> = { "": "All", DRAFT: "Draft", PAYMENT_DUE: "Payment Due", PAID: "Paid" }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="All order invoices — search, track payments, download PDFs"
        icon={Receipt}
        action={
          <Button size="sm" variant="outline" onClick={() => fetchInvoices(page)} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by invoice #, order #, customer name, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {statusTabs.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {statusLabels[st]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="text-sm text-muted-foreground">
        {loading ? "Loading…" : `${pagination.total} invoice${pagination.total !== 1 ? "s" : ""}`}
        {pagination.total > 0 && ` · Page ${pagination.page}/${pagination.pages}`}
      </div>

      {/* Invoices list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <Card className="shadow-none border-dashed">
          <CardContent className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Receipt className="h-8 w-8 opacity-30" />
            <p className="text-sm">No invoices found</p>
            {search && <p className="text-xs">Try clearing the search filter</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Card key={inv.id} className="shadow-none hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Row 1: Invoice # + Status */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold font-mono text-foreground">{inv.invoiceNumber}</span>
                      <Badge className={`text-[10px] border-0 ${STATUS_COLORS[inv.status] || "bg-gray-100 text-gray-600"}`}>
                        {inv.status === "PAYMENT_DUE" ? "PAYMENT DUE" : inv.status}
                      </Badge>
                    </div>

                    {/* Row 2: Order + Customer */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {inv.order && (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />{inv.order.orderNumber}
                        </span>
                      )}
                      {inv.customer && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />{inv.customer.name}
                          {inv.customer.phone && ` · ${inv.customer.phone}`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />{formatDate(inv.createdAt)}
                      </span>
                    </div>

                    {/* Due / Paid date */}
                    {inv.status === "PAYMENT_DUE" && inv.dueDate && (
                      <p className="text-[11px] text-amber-600 mt-1">Due: {formatDate(inv.dueDate)}</p>
                    )}
                    {inv.status === "PAID" && inv.paidAt && (
                      <p className="text-[11px] text-emerald-600 mt-1">Paid: {formatDate(inv.paidAt)}</p>
                    )}
                  </div>

                  {/* Amount + Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="text-base font-bold text-foreground">{formatINR(inv.totalAmount)}</p>
                    {inv.status === "PAYMENT_DUE" && inv.paidAmount < inv.totalAmount && (
                      <p className="text-xs text-amber-600">Balance: {formatINR(inv.totalAmount - inv.paidAmount)}</p>
                    )}
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="View details"
                        onClick={() => setDetailDialog(inv)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="Download PDF"
                        onClick={() => downloadInvoicePdf(inv)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {inv.status === "PAYMENT_DUE" && (
                        <>
                          {upiConfig?.qrEnabled && upiConfig?.upiId && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-sky-700 border-sky-200 hover:bg-sky-50"
                              onClick={() => {
                                setPayAmount(String(inv.totalAmount - inv.paidAmount))
                                setPayNotes("")
                                setPaymentDialog(inv)
                              }}
                            >
                              <QrCode className="h-3 w-3" />QR
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => {
                              setPayAmount(String(inv.totalAmount - inv.paidAmount))
                              setPayNotes("")
                              setPaymentDialog(inv)
                            }}
                          >
                            <CreditCard className="h-3 w-3" />Pay
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* Record Payment Dialog — with UPI QR for Laundry */}
      <Dialog open={!!paymentDialog} onOpenChange={(v) => !v && setPaymentDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {paymentDialog && (
                <>Invoice {paymentDialog.invoiceNumber} — Balance: {formatINR(paymentDialog.totalAmount - paymentDialog.paidAmount)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>

            {/* UPI QR Code */}
            {paymentDialog && upiConfig?.qrEnabled && upiConfig?.upiId && Number(payAmount) > 0 && (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <QrCode className="h-4 w-4" /> Pay with UPI
                </div>
                <div className="flex items-center justify-center">
                  <QrCodeDisplay
                    data={buildUpiUri({
                      pa: upiConfig.upiId,
                      pn: upiConfig.merchantName || undefined,
                      am: Number(payAmount),
                      tn: paymentDialog.invoiceNumber,
                    })}
                    size={200}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  Scan with any UPI app to pay ₹{Number(payAmount).toLocaleString("en-IN")}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                rows={2}
                placeholder="Cash, UPI, reference ID…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPaymentDialog(null)} disabled={paying}>Cancel</Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={paying || !payAmount || Number(payAmount) <= 0}
              onClick={async () => {
                setPayNotes(prev => prev ? `${prev} | Cash collected` : 'Cash collected')
                await handleRecordPayment()
              }}
            >
              <Banknote className="h-3.5 w-3.5" />
              Cash Received
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
              disabled={paying || !payAmount || Number(payAmount) <= 0}
              onClick={handleRecordPayment}
            >
              {paying ? "Recording…" : <><Smartphone className="h-3.5 w-3.5" /> Mark Paid</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail / Audit Trail Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={(v) => !v && setDetailDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">{detailDialog?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Invoice details and audit trail
            </DialogDescription>
          </DialogHeader>
          {detailDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Status</p>
                  <Badge className={`text-[10px] border-0 mt-0.5 ${STATUS_COLORS[detailDialog.status] || ""}`}>
                    {detailDialog.status === "PAYMENT_DUE" ? "PAYMENT DUE" : detailDialog.status}
                  </Badge>
                </div>
                <div><p className="text-muted-foreground text-xs">Amount</p>
                  <p className="font-semibold">{formatINR(detailDialog.totalAmount)}</p></div>
                <div><p className="text-muted-foreground text-xs">Paid</p>
                  <p className="font-semibold">{formatINR(detailDialog.paidAmount)}</p></div>
                <div><p className="text-muted-foreground text-xs">Created</p>
                  <p className="font-semibold">{formatDate(detailDialog.createdAt)}</p></div>
                {detailDialog.order && (
                  <div className="col-span-2"><p className="text-muted-foreground text-xs">Reference</p>
                    <p className="font-mono text-sm">Order {detailDialog.order.orderNumber}</p></div>
                )}
                {detailDialog.customer && (
                  <div className="col-span-2"><p className="text-muted-foreground text-xs">Customer</p>
                    <p className="font-semibold">{detailDialog.customer.name}{detailDialog.customer.phone && ` · ${detailDialog.customer.phone}`}</p></div>
                )}
                {detailDialog.notes && (
                  <div className="col-span-2"><p className="text-muted-foreground text-xs">Notes</p>
                    <p className="text-sm">{detailDialog.notes}</p></div>
                )}
              </div>

              {/* Audit trail */}
              {(() => {
                try {
                  const parsed = detailDialog.metadata ? JSON.parse(detailDialog.metadata) : {}
                  const log: Array<{event: string; ts: string; by?: string}> = parsed.auditLog || []
                  if (log.length === 0) return null
                  return (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Audit Trail</p>
                      <div className="space-y-1.5">
                        {log.map((entry, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            <span className="font-medium">{entry.event}</span>
                            <span className="text-muted-foreground">{new Date(entry.ts).toLocaleString("en-IN")}</span>
                            {entry.by && <span className="text-muted-foreground">· by {entry.by}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                } catch { return null }
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
