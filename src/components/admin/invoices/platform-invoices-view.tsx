"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { PageHeader } from "../shared/page-header"
import { StatCard } from "../shared/stat-card"
import { EmptyState } from "../shared/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  FileText, Search, X, IndianRupee, AlertTriangle, CheckCircle2,
  RefreshCw, Download, Mail, TrendingUp, Store, MessageSquare, Eye, ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { useAdminStore } from "@/stores/admin-store"

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlatformInvoice {
  id: string
  invoiceNumber: string | null
  businessId: string
  businessName: string
  businessSlug: string
  businessGst: string | null
  businessAddress: string
  businessEmail: string | null
  businessPhone: string | null
  planName: string
  planTier: string
  amount: number
  currency: string
  status: string
  paymentMode: string | null
  paidBy: string | null
  receiptReference: string | null
  periodLabel: string | null
  periodYear: number | null
  description: string | null
  dueDate: string
  paidDate: string | null
  remarks: string | null
  gstRate: number | null
  cgstAmount: number | null
  sgstAmount: number | null
  igstAmount: number | null
  totalWithGst: number | null
  extraStores: number | null
  extraStoreAmount: number | null
  acknowledgeStatus: string | null
  amountReceived: number | null
  transactionNumber: string | null
  bankName: string | null
  proofUrl: string | null
  recordedByName: string | null
  createdAt: string
}

const ACK_BADGE: Record<string, { label: string; cls: string }> = {
  RECEIVED:             { label: "Received",             cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PARTIALLY_RECEIVED:   { label: "Partial",              cls: "bg-amber-50 text-amber-700 border-amber-200" },
  PENDING_VERIFICATION: { label: "Pending Verification", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  REJECTED:             { label: "Rejected",             cls: "bg-red-50 text-red-700 border-red-200" },
  WAIVED:               { label: "Waived",               cls: "bg-purple-50 text-purple-700 border-purple-200" },
}

interface InvoiceStats {
  totalInvoices: number
  totalCollected: number
  paidCount: number
  collectedThisMonth: number
}

interface InvoicePagination {
  page: number
  limit: number
  total: number
  pages: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—"
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  try { return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) } catch { return dateStr }
}

function grandTotal(inv: PlatformInvoice): number {
  return inv.totalWithGst ?? (inv.amount + (inv.extraStoreAmount ?? 0) + (inv.cgstAmount ?? 0) + (inv.sgstAmount ?? 0) + (inv.igstAmount ?? 0))
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PlatformInvoicesView() {
  const { searchQuery } = useAdminStore()

  const [invoices, setInvoices] = useState<PlatformInvoice[]>([])
  const [stats, setStats] = useState<InvoiceStats | null>(null)
  const [pagination, setPagination] = useState<InvoicePagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState("all")
  const [emailingSending, setEmailingSending] = useState<string | null>(null)
  const [drawerInvoice, setDrawerInvoice] = useState<PlatformInvoice | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleWhatsApp = (inv: PlatformInvoice) => {
    const phone = inv.businessPhone?.replace(/\D/g, "") ?? ""
    const total = inv.totalWithGst ?? (inv.amount + (inv.extraStoreAmount ?? 0) + (inv.cgstAmount ?? 0) + (inv.sgstAmount ?? 0))
    const lines = [
      `📄 *Invoice: ${inv.invoiceNumber ?? "—"}*`,
      `Business: ${inv.businessName}`,
      `Plan: ${inv.planName} (${inv.planTier})`,
      `Period: ${inv.periodLabel ?? "—"}`,
      `Amount: ₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      `Status: ${inv.acknowledgeStatus ? (ACK_BADGE[inv.acknowledgeStatus]?.label ?? inv.acknowledgeStatus) : inv.status.toUpperCase()}`,
      inv.invoiceNumber ? `\nPlease contact us for payment details.` : "",
    ].filter(Boolean).join("\n")
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`
      : `https://wa.me/?text=${encodeURIComponent(lines)}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const fetchInvoices = useCallback(async (page = 1) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" })
      if (searchQuery) params.set("search", searchQuery)
      const ACK_STATUSES = ["RECEIVED", "PARTIALLY_RECEIVED", "PENDING_VERIFICATION", "REJECTED", "WAIVED"]
      if (statusFilter !== "all") {
        if (ACK_STATUSES.includes(statusFilter)) params.set("ackStatus", statusFilter)
        else params.set("status", statusFilter)
      }
      const res = await fetch(`/api/admin/billing/invoices?${params}`, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error("Failed to fetch invoices")
      const json = await res.json()
      if (json.success) {
        setInvoices(json.data)
        setStats(json.stats)
        setPagination(json.pagination)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices")
    } finally { setLoading(false) }
  }, [searchQuery, statusFilter])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const filteredInvoices = useMemo(() => {
    if (!searchQuery) return invoices
    const q = searchQuery.toLowerCase()
    return invoices.filter(inv =>
      inv.businessName.toLowerCase().includes(q) ||
      (inv.invoiceNumber ?? "").toLowerCase().includes(q) ||
      (inv.periodLabel ?? "").toLowerCase().includes(q)
    )
  }, [invoices, searchQuery])

  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const handleDownload = async (inv: PlatformInvoice) => {
    setDownloadingId(inv.id)
    try {
      const res = await fetch(`/api/admin/billing/invoices/${inv.id}/download`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        toast.error(err.error ?? "Failed to generate invoice")
        return
      }
      const html = await res.text()
      const blob = new Blob([html], { type: "text/html" })
      const url = URL.createObjectURL(blob)
      const win = window.open(url, "_blank")
      if (!win) toast.error("Pop-up blocked — allow pop-ups for this site")
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      toast.error("Failed to generate invoice")
    } finally {
      setDownloadingId(null)
    }
  }

  const handleEmail = async (inv: PlatformInvoice) => {
    if (!inv.businessEmail) {
      toast.error("No email address configured for this business")
      return
    }
    setEmailingSending(inv.id)
    try {
      const res = await fetch(`/api/admin/billing/invoices/${inv.id}/email`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify({}),
      })
      const json = await res.json()
      if (json.success) toast.success(`Invoice emailed to ${inv.businessEmail}`)
      else toast.error(json.error || "Failed to send invoice")
    } catch { toast.error("Failed to send invoice") }
    finally { setEmailingSending(null) }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Invoices"
        description="GST invoices for platform subscriptions billed to businesses"
        icon={FileText}
      />

      {/* Stats */}
      {stats ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Invoices"
            value={pagination?.total ?? 0}
            change={`${stats.paidCount} paid`}
            changeType="neutral"
            icon={FileText}
            iconColor="text-sky-600"
            iconBg="bg-sky-50"
          />
          <StatCard
            title="Total Collected"
            value={formatCurrency(stats.totalCollected)}
            change="all time"
            changeType="positive"
            icon={IndianRupee}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
          />
          <StatCard
            title="This Month"
            value={formatCurrency(stats.collectedThisMonth)}
            change="collections"
            changeType="positive"
            icon={TrendingUp}
            iconColor="text-violet-600"
            iconBg="bg-violet-50"
          />
          <StatCard
            title="Pending"
            value={(pagination?.total ?? 0) - stats.paidCount}
            change="awaiting payment"
            changeType={(pagination?.total ?? 0) - stats.paidCount > 0 ? "negative" : "neutral"}
            icon={AlertTriangle}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
        </div>
      ) : loading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-12 w-full" /></CardContent></Card>)}
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoices…" className="pl-8 h-9" value={searchQuery} readOnly />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[190px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="RECEIVED">Received</SelectItem>
            <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
            <SelectItem value="PENDING_VERIFICATION">Pending Verification</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="WAIVED">Waived</SelectItem>
          </SelectContent>
        </Select>
        {statusFilter !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter("all")}><X className="h-3 w-3 mr-1" /> Clear</Button>
        )}
        <Button variant="outline" size="sm" className="ml-auto gap-1.5 h-9" onClick={() => fetchInvoices()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card><CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchInvoices()} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
        </CardContent></Card>
      )}

      {/* Table */}
      {loading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-[400px] w-full" /></CardContent></Card>
      ) : filteredInvoices.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices found" description="Invoices are created when payments are recorded in Subscription Management" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead className="min-w-[140px]">Invoice No.</TableHead>
                    <TableHead className="min-w-[160px]">Business</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid On</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right min-w-[108px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => (
                    <TableRow key={inv.id} className="text-xs">
                      <TableCell>
                        <div className="font-mono font-semibold text-[11px]">{inv.invoiceNumber ?? "—"}</div>
                        <div className="text-[9px] text-muted-foreground">{formatDate(inv.createdAt)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{inv.businessName}</div>
                        {inv.businessGst && <div className="text-[9px] text-muted-foreground font-mono">{inv.businessGst}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{inv.planName}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-[10px]">{inv.periodLabel ?? "—"}</div>
                        {(inv.extraStores ?? 0) > 0 && (
                          <div className="flex items-center gap-0.5 text-[9px] text-amber-600 mt-0.5">
                            <Store className="h-2.5 w-2.5" />+{inv.extraStores}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-[10px]">{formatCurrency(inv.amount)}</TableCell>
                      <TableCell className="text-right text-[10px] text-muted-foreground">{formatCurrency(inv.cgstAmount)}</TableCell>
                      <TableCell className="text-right text-[10px] text-muted-foreground">{formatCurrency(inv.sgstAmount)}</TableCell>
                      <TableCell className="text-right text-[10px] text-muted-foreground">{formatCurrency(inv.igstAmount)}</TableCell>
                      <TableCell className="text-right font-semibold text-[11px]">{formatCurrency(grandTotal(inv))}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {inv.acknowledgeStatus ? (
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${ACK_BADGE[inv.acknowledgeStatus]?.cls ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                              {inv.acknowledgeStatus === "RECEIVED" || inv.acknowledgeStatus === "WAIVED" ? <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> : null}
                              {ACK_BADGE[inv.acknowledgeStatus]?.label ?? inv.acknowledgeStatus}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                              inv.status === "paid"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {inv.status === "paid" ? <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> : null}
                              {inv.status.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{formatDate(inv.paidDate)}</TableCell>
                      <TableCell className="text-[10px]">{inv.paymentMode?.replace(/_/g, " ") ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:bg-muted/60"
                            title="View invoice details"
                            onClick={() => { setDrawerInvoice(inv); setDrawerOpen(true) }}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-sky-700 hover:bg-sky-50"
                            title="Download / Print Invoice"
                            disabled={downloadingId === inv.id}
                            onClick={() => handleDownload(inv)}
                          >
                            {downloadingId === inv.id
                              ? <RefreshCw className="h-3 w-3 animate-spin" />
                              : <Download className="h-3 w-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-violet-700 hover:bg-violet-50"
                            title={inv.businessEmail ? `Email to ${inv.businessEmail}` : "No email configured"}
                            disabled={!inv.businessEmail || emailingSending === inv.id}
                            onClick={() => handleEmail(inv)}
                          >
                            <Mail className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-emerald-700 hover:bg-emerald-50"
                            title="Share via WhatsApp"
                            onClick={() => handleWhatsApp(inv)}
                          >
                            <MessageSquare className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {filteredInvoices.length} of {pagination.total} invoices</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={pagination.page <= 1}
              onClick={() => fetchInvoices(pagination.page - 1)}
            >Previous</Button>
            <span className="flex items-center px-2">Page {pagination.page} of {pagination.pages}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={pagination.page >= pagination.pages}
              onClick={() => fetchInvoices(pagination.page + 1)}
            >Next</Button>
          </div>
        </div>
      )}

      {/* ── Invoice Drawer ───────────────────────────────────────────────── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col p-0">
          {drawerInvoice && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <SheetTitle className="text-sm font-mono">{drawerInvoice.invoiceNumber ?? "—"}</SheetTitle>
                    <SheetDescription className="text-xs mt-0.5">{drawerInvoice.businessName}</SheetDescription>
                  </div>
                  {drawerInvoice.acknowledgeStatus ? (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0 ${ACK_BADGE[drawerInvoice.acknowledgeStatus]?.cls ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {ACK_BADGE[drawerInvoice.acknowledgeStatus]?.label ?? drawerInvoice.acknowledgeStatus}
                    </span>
                  ) : (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0 ${drawerInvoice.status === "paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {drawerInvoice.status.toUpperCase()}
                    </span>
                  )}
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1 min-h-0">
                <div className="px-6 py-5 space-y-5">

                  {/* Invoice summary */}
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div><span className="text-muted-foreground">Business: </span><span className="font-medium">{drawerInvoice.businessName}</span></div>
                    <div><span className="text-muted-foreground">Plan: </span><span className="font-medium">{drawerInvoice.planName}</span></div>
                    <div><span className="text-muted-foreground">Period: </span><span className="font-medium">{drawerInvoice.periodLabel ?? "—"}</span></div>
                    <div><span className="text-muted-foreground">Due: </span><span className="font-medium">{formatDate(drawerInvoice.dueDate)}</span></div>
                    {drawerInvoice.paidDate && (
                      <div><span className="text-muted-foreground">Paid: </span><span className="font-medium">{formatDate(drawerInvoice.paidDate)}</span></div>
                    )}
                    {drawerInvoice.paymentMode && (
                      <div><span className="text-muted-foreground">Mode: </span><span className="font-medium">{drawerInvoice.paymentMode.replace(/_/g, " ")}</span></div>
                    )}
                    {drawerInvoice.transactionNumber && (
                      <div className="col-span-2"><span className="text-muted-foreground">TXN: </span><span className="font-medium font-mono">{drawerInvoice.transactionNumber}</span></div>
                    )}
                    {drawerInvoice.receiptReference && (
                      <div className="col-span-2"><span className="text-muted-foreground">Ref: </span><span className="font-medium">{drawerInvoice.receiptReference}</span></div>
                    )}
                    {drawerInvoice.bankName && (
                      <div><span className="text-muted-foreground">Bank: </span><span className="font-medium">{drawerInvoice.bankName}</span></div>
                    )}
                    {drawerInvoice.paidBy && (
                      <div><span className="text-muted-foreground">Paid by: </span><span className="font-medium">{drawerInvoice.paidBy}</span></div>
                    )}
                    {drawerInvoice.recordedByName && (
                      <div className="col-span-2"><span className="text-muted-foreground">Recorded by: </span><span className="font-medium">{drawerInvoice.recordedByName}</span></div>
                    )}
                  </div>

                  <Separator />

                  {/* Amount breakdown */}
                  <div className="space-y-1.5 text-xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount Breakdown</p>
                    <div className="flex justify-between"><span className="text-muted-foreground">Base (Subscription)</span><span className="font-medium">{formatCurrency(drawerInvoice.amount)}</span></div>
                    {(drawerInvoice.extraStoreAmount ?? 0) > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Extra Stores ×{drawerInvoice.extraStores}</span><span>{formatCurrency(drawerInvoice.extraStoreAmount)}</span></div>
                    )}
                    {(drawerInvoice.cgstAmount ?? 0) > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>{formatCurrency(drawerInvoice.cgstAmount)}</span></div>
                    )}
                    {(drawerInvoice.sgstAmount ?? 0) > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>{formatCurrency(drawerInvoice.sgstAmount)}</span></div>
                    )}
                    {(drawerInvoice.igstAmount ?? 0) > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>{formatCurrency(drawerInvoice.igstAmount)}</span></div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Grand Total</span>
                      <span className="text-base">{formatCurrency(grandTotal(drawerInvoice))}</span>
                    </div>
                    {drawerInvoice.amountReceived != null && drawerInvoice.amountReceived !== grandTotal(drawerInvoice) && (
                      <div className="flex justify-between text-amber-600">
                        <span>Amount Received</span>
                        <span>{formatCurrency(drawerInvoice.amountReceived)}</span>
                      </div>
                    )}
                  </div>

                  {drawerInvoice.proofUrl && (
                    <>
                      <Separator />
                      <a href={drawerInvoice.proofUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-800 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> View Payment Proof
                      </a>
                    </>
                  )}

                  {drawerInvoice.remarks && (
                    <>
                      <Separator />
                      <p className="text-xs text-muted-foreground italic">{drawerInvoice.remarks}</p>
                    </>
                  )}

                  {/* Action buttons */}
                  <Separator />
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                      disabled={downloadingId === drawerInvoice.id}
                      onClick={() => handleDownload(drawerInvoice)}>
                      {downloadingId === drawerInvoice.id
                        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        : <Download className="h-3.5 w-3.5" />}
                      Download
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                      disabled={!drawerInvoice.businessEmail || emailingSending === drawerInvoice.id}
                      title={drawerInvoice.businessEmail ? `Email to ${drawerInvoice.businessEmail}` : "No email configured"}
                      onClick={() => handleEmail(drawerInvoice)}>
                      <Mail className="h-3.5 w-3.5" /> Email
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
                      onClick={() => handleWhatsApp(drawerInvoice)}>
                      <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                    </Button>
                  </div>
                </div>
              </ScrollArea>

              <SheetFooter className="px-6 py-4 border-t bg-background">
                <Button variant="outline" className="w-full" onClick={() => setDrawerOpen(false)}>Close</Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
