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
import {
  FileText, Search, X, IndianRupee, AlertTriangle, CheckCircle2,
  RefreshCw, Download, Mail, TrendingUp, Store,
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
  createdAt: string
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

  const fetchInvoices = useCallback(async (page = 1) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" })
      if (searchQuery) params.set("search", searchQuery)
      if (statusFilter !== "all") params.set("status", statusFilter)
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

  const handleDownload = (inv: PlatformInvoice) => {
    window.open(`/api/admin/billing/invoices/${inv.id}/download`, "_blank")
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
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
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
                    <TableHead className="text-right min-w-[80px]">Actions</TableHead>
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
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          inv.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {inv.status === "paid" ? <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> : null}
                          {inv.status.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{formatDate(inv.paidDate)}</TableCell>
                      <TableCell className="text-[10px]">{inv.paymentMode?.replace(/_/g, " ") ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-sky-700 hover:bg-sky-50"
                            title="Download / Print Invoice"
                            onClick={() => handleDownload(inv)}
                          >
                            <Download className="h-3 w-3" />
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
    </div>
  )
}
