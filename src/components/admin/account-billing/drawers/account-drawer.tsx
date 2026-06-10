"use client"

import { useState, useEffect, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  RefreshCw, ExternalLink, Calendar, Edit, IndianRupee, FileText, Receipt,
  Clock, CheckCircle, XCircle, AlertCircle, User, ChevronRight
} from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { AccountHealthBadge } from "../shared/account-health-badge"
import { AckStatusBadge } from "../shared/ack-status-badge"
import { ServiceTypeBadge, BillingTypeBadge } from "../shared/service-type-badge"
import { DocumentTypeBadge, DocumentStatusBadge } from "../shared/document-type-badge"
import { RecurringDateDrawer } from "./recurring-date-drawer"
import { BillingDocumentDrawer } from "./billing-document-drawer"

function formatCurrency(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`
  return `₹${v.toLocaleString("en-IN")}`
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

const CYCLES: Record<string, string> = {
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", HALF_YEARLY: "Half-Yearly", YEARLY: "Yearly",
}

interface AccountDetail {
  businessId: string
  businessName: string
  businessSlug: string
  businessStatus: string
  contactEmail: string | null
  contactPhone: string | null
  subscription: {
    id: string; status: string; planName: string; planTier: string
    billingCycle: string; baseAmount: number; finalAmount: number | null
    discountAmount: number | null; currentPeriodStart: string; nextBillingDate: string
    lastPaymentDate: string | null; lastPaymentAmount: number | null
  } | null
  addons: Array<{ id: string; name: string; amount: number; billingType: string; cycle: string | null; status: string; startDate: string }>
  activeAddonCount: number
  lastRecord: { id: string; amount: number; status: string; acknowledgeStatus: string | null; paidDate: string | null; invoiceNumber: string | null } | null
  outstanding: number
  daysOverdue: number
  pendingVerification: number
  lifetimeRevenue: number
  health: string
  healthReason: string
  recentDocuments: Array<{ id: string; documentNumber: string; documentType: string; status: string; amount: number; createdAt: string }>
}

interface Props {
  businessId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefreshSummary?: () => void
}

export function AccountDrawer({ businessId, open, onOpenChange, onRefreshSummary }: Props) {
  const [detail, setDetail] = useState<AccountDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  // Tab data (lazy-loaded)
  const [services, setServices] = useState<Array<Record<string,unknown>> | null>(null)
  const [invoices, setInvoices] = useState<Array<Record<string,unknown>> | null>(null)
  const [payments, setPayments] = useState<Array<Record<string,unknown>> | null>(null)
  const [ledger,   setLedger]   = useState<Array<Record<string,unknown>> | null>(null)
  const [audit,    setAudit]    = useState<Array<Record<string,unknown>> | null>(null)

  // Sub-drawer state
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [docDrawerOpen, setDocDrawerOpen] = useState(false)
  const [selectedDoc, setSelectedDoc]     = useState<Record<string,unknown> | null>(null)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/admin/account-billing/${businessId}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) setDetail(json.data)
      else toast.error(json.error ?? "Failed to load account")
    } catch { toast.error("Failed to load account") }
    finally { setLoading(false) }
  }, [businessId])

  useEffect(() => {
    if (open) { setActiveTab("overview"); fetchDetail() }
  }, [open, fetchDetail])

  const fetchTab = useCallback(async (tab: string) => {
    try {
      if (tab === "services" && !services) {
        const r = await fetch(`/api/admin/account-billing/${businessId}/services`, { headers: getAuthHeaders() })
        const j = await r.json(); if (j.success) setServices(j.data)
      }
      if (tab === "invoices" && !invoices) {
        const r = await fetch(`/api/admin/account-billing/${businessId}/documents?limit=50`, { headers: getAuthHeaders() })
        const j = await r.json(); if (j.success) setInvoices(j.data)
      }
      if (tab === "payments" && !payments) {
        const r = await fetch(`/api/admin/account-billing/${businessId}/payments?limit=50`, { headers: getAuthHeaders() })
        const j = await r.json(); if (j.success) setPayments(j.data)
      }
      if (tab === "ledger" && !ledger) {
        const r = await fetch(`/api/admin/account-billing/${businessId}/ledger`, { headers: getAuthHeaders() })
        const j = await r.json(); if (j.success) setLedger(j.data)
      }
      if (tab === "audit" && !audit) {
        const r = await fetch(`/api/admin/account-billing/${businessId}/audit-trail?limit=50`, { headers: getAuthHeaders() })
        const j = await r.json(); if (j.success) setAudit(j.data)
      }
    } catch { toast.error(`Failed to load ${tab}`) }
  }, [businessId, services, invoices, payments, ledger, audit])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    fetchTab(tab)
  }

  const sub = detail?.subscription

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[720px] sm:max-w-[720px] p-0 flex flex-col">
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            {loading || !detail
              ? <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></div>
              : (
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SheetTitle className="text-lg">{detail.businessName}</SheetTitle>
                      <AccountHealthBadge score={detail.health as never} reason={detail.healthReason} />
                      {detail.outstanding > 0 && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-red-200 text-red-600">
                          <IndianRupee className="h-3 w-3 mr-0.5" />{formatCurrency(detail.outstanding)} outstanding
                        </Badge>
                      )}
                    </div>
                    <SheetDescription className="flex items-center gap-3 flex-wrap">
                      {sub && <span className="font-medium text-foreground">{sub.planName} · {CYCLES[sub.billingCycle] ?? sub.billingCycle}</span>}
                      {detail.contactEmail && <span className="text-[11px]">{detail.contactEmail}</span>}
                      {sub && <span className="text-[11px] text-muted-foreground">Next due: {fmtDate(sub.nextBillingDate)}</span>}
                    </SheetDescription>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs shrink-0" onClick={fetchDetail} disabled={loading}>
                    <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              )}
          </SheetHeader>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-3 mb-0 h-8 justify-start shrink-0">
              <TabsTrigger value="overview"   className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="services"   className="text-xs">Services</TabsTrigger>
              <TabsTrigger value="invoices"   className="text-xs">Invoices</TabsTrigger>
              <TabsTrigger value="payments"   className="text-xs">Payments</TabsTrigger>
              <TabsTrigger value="ledger"     className="text-xs">Ledger</TabsTrigger>
              <TabsTrigger value="audit"      className="text-xs">Audit Trail</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-3">
              {/* OVERVIEW */}
              <TabsContent value="overview" className="px-6 pb-6 mt-0 space-y-4">
                {loading || !detail
                  ? <div className="space-y-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-16 w-full"/>)}</div>
                  : (
                    <>
                      {/* KPI row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Card className="shadow-none">
                          <CardContent className="p-3 text-center">
                            <IndianRupee className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                            <p className="text-lg font-bold">{formatCurrency(detail.lifetimeRevenue)}</p>
                            <p className="text-[10px] text-muted-foreground">Lifetime Revenue</p>
                          </CardContent>
                        </Card>
                        <Card className="shadow-none">
                          <CardContent className="p-3 text-center">
                            <AlertCircle className={`h-4 w-4 mx-auto mb-1 ${detail.outstanding > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                            <p className={`text-lg font-bold ${detail.outstanding > 0 ? "text-red-600" : ""}`}>{detail.outstanding > 0 ? formatCurrency(detail.outstanding) : "₹0"}</p>
                            <p className="text-[10px] text-muted-foreground">Outstanding</p>
                          </CardContent>
                        </Card>
                        <Card className="shadow-none">
                          <CardContent className="p-3 text-center">
                            <FileText className="h-4 w-4 text-sky-600 mx-auto mb-1" />
                            <p className="text-lg font-bold">{detail.activeAddonCount}</p>
                            <p className="text-[10px] text-muted-foreground">Add-Ons</p>
                          </CardContent>
                        </Card>
                        <Card className="shadow-none">
                          <CardContent className="p-3 text-center">
                            <Clock className={`h-4 w-4 mx-auto mb-1 ${detail.pendingVerification > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                            <p className={`text-lg font-bold ${detail.pendingVerification > 0 ? "text-amber-600" : ""}`}>{detail.pendingVerification}</p>
                            <p className="text-[10px] text-muted-foreground">Pending Verification</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Subscription */}
                      {sub && (
                        <div className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Plan</h4>
                            <Button size="sm" variant="ghost" className="h-6 gap-1 text-[10px] px-2" onClick={() => setRecurringOpen(true)}>
                              <Edit className="h-3 w-3" /> Edit Due Date
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div><p className="text-[10px] text-muted-foreground">Plan</p><p className="font-medium">{sub.planName}</p></div>
                            <div><p className="text-[10px] text-muted-foreground">Billing</p><p className="font-medium">{CYCLES[sub.billingCycle] ?? sub.billingCycle}</p></div>
                            <div><p className="text-[10px] text-muted-foreground">Amount</p><p className="font-medium">₹{(sub.finalAmount ?? sub.baseAmount).toLocaleString("en-IN")}</p>{sub.discountAmount ? <p className="text-[10px] text-orange-600">-₹{sub.discountAmount.toLocaleString("en-IN")} discount</p> : null}</div>
                            <div><p className="text-[10px] text-muted-foreground">Status</p><Badge variant="outline" className="text-[10px] h-5 px-1.5 mt-0.5">{sub.status}</Badge></div>
                            <div><p className="text-[10px] text-muted-foreground">Period Start</p><p className="font-medium">{fmtDate(sub.currentPeriodStart)}</p></div>
                            <div><p className="text-[10px] text-muted-foreground">Next Due</p><p className={`font-medium ${detail.daysOverdue > 0 ? "text-red-600" : ""}`}>{fmtDate(sub.nextBillingDate)}{detail.daysOverdue > 0 && <span className="text-[10px] ml-1 text-red-400">({detail.daysOverdue}d overdue)</span>}</p></div>
                            <div><p className="text-[10px] text-muted-foreground">Last Payment</p><p className="font-medium">{fmtDate(sub.lastPaymentDate)}</p></div>
                            <div><p className="text-[10px] text-muted-foreground">Last Amount</p><p className="font-medium">{sub.lastPaymentAmount ? `₹${sub.lastPaymentAmount.toLocaleString("en-IN")}` : "—"}</p></div>
                          </div>
                        </div>
                      )}

                      {/* Last payment ack status */}
                      {detail.lastRecord && (
                        <div className="rounded-lg border p-3 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Last Transaction</p>
                            <p className="text-sm font-medium">₹{detail.lastRecord.amount.toLocaleString("en-IN")}</p>
                            {detail.lastRecord.invoiceNumber && <p className="text-[10px] font-mono text-muted-foreground">{detail.lastRecord.invoiceNumber}</p>}
                          </div>
                          <AckStatusBadge status={detail.lastRecord.acknowledgeStatus} />
                        </div>
                      )}

                      {/* Recent documents */}
                      {detail.recentDocuments.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Documents</h4>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1" onClick={() => handleTabChange("invoices")}>
                                View all <ChevronRight className="h-3 w-3" />
                              </Button>
                            </div>
                            {detail.recentDocuments.map(d => (
                              <div key={d.id} className="flex items-center justify-between text-xs rounded-lg border p-2.5">
                                <div className="flex items-center gap-2">
                                  <DocumentTypeBadge value={d.documentType} />
                                  <span className="font-mono text-[11px]">{d.documentNumber}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">{fmtDate(d.createdAt)}</span>
                                  <DocumentStatusBadge value={d.status} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
              </TabsContent>

              {/* SERVICES */}
              <TabsContent value="services" className="px-6 pb-6 mt-0">
                {!services
                  ? <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
                  : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead>Service</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Billing</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Started</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {services.map((s) => (
                            <TableRow key={String(s.id)} className="text-xs hover:bg-muted/30">
                              <TableCell>
                                <p className="font-medium">{String(s.name)}</p>
                                {Boolean(s.description) && <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{String(s.description)}</p>}
                              </TableCell>
                              <TableCell><ServiceTypeBadge type={String(s.serviceType)} /></TableCell>
                              <TableCell><BillingTypeBadge type={String(s.billingType)} /></TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(Number(s.amount))}</TableCell>
                              <TableCell><Badge variant="outline" className="text-[10px] h-5 px-1.5">{String(s.status)}</Badge></TableCell>
                              <TableCell>{fmtDate(String(s.startDate))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
              </TabsContent>

              {/* INVOICES */}
              <TabsContent value="invoices" className="px-6 pb-6 mt-0 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">{invoices?.length ?? 0} documents</p>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setSelectedDoc(null); setDocDrawerOpen(true) }}>
                    <FileText className="h-3 w-3" /> New Document
                  </Button>
                </div>
                {!invoices
                  ? <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
                  : invoices.length === 0
                  ? <div className="py-10 text-center text-sm text-muted-foreground">No documents yet</div>
                  : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead>Number</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoices.map((d) => (
                            <TableRow key={String(d.id)} className="text-xs hover:bg-muted/30 cursor-pointer" onClick={() => { setSelectedDoc(d); setDocDrawerOpen(true) }}>
                              <TableCell className="font-mono text-[11px]">{String(d.documentNumber)}</TableCell>
                              <TableCell><DocumentTypeBadge value={String(d.documentType)} /></TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(Number(d.amount))}</TableCell>
                              <TableCell><DocumentStatusBadge value={String(d.status)} /></TableCell>
                              <TableCell>{fmtDate(String(d.createdAt))}</TableCell>
                              <TableCell><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
              </TabsContent>

              {/* PAYMENTS */}
              <TabsContent value="payments" className="px-6 pb-6 mt-0">
                {!payments
                  ? <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
                  : payments.length === 0
                  ? <div className="py-10 text-center text-sm text-muted-foreground">No payment records</div>
                  : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Proof</TableHead>
                            <TableHead>Recorded By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((p) => (
                            <TableRow key={String(p.id)} className="text-xs hover:bg-muted/30">
                              <TableCell>{fmtDate(p.paidDate ? String(p.paidDate) : String(p.createdAt))}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(Number(p.amountReceived ?? p.amount))}</TableCell>
                              <TableCell>{p.paymentMode ? String(p.paymentMode) : "—"}</TableCell>
                              <TableCell className="font-mono text-[10px]">{p.transactionNumber ? String(p.transactionNumber) : p.receiptReference ? String(p.receiptReference) : "—"}</TableCell>
                              <TableCell><AckStatusBadge status={p.acknowledgeStatus ? String(p.acknowledgeStatus) : null} /></TableCell>
                              <TableCell>
                                {p.proofUrl
                                  ? <a href={String(p.proofUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-600 hover:underline text-[10px]">View <ExternalLink className="h-3 w-3" /></a>
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-[10px]">{p.recordedByName ? String(p.recordedByName) : "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
              </TabsContent>

              {/* LEDGER */}
              <TabsContent value="ledger" className="px-6 pb-6 mt-0 space-y-3">
                <p className="text-xs text-muted-foreground">Chronological ledger with running balance</p>
                {!ledger
                  ? <div className="space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
                  : ledger.length === 0
                  ? <div className="py-10 text-center text-sm text-muted-foreground">No ledger entries</div>
                  : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ledger.map((e) => (
                            <TableRow key={String(e.id)} className="text-xs hover:bg-muted/30">
                              <TableCell>{fmtDate(String(e.date))}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{String(e.description)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5">{String(e.entryType)}</Badge>
                              </TableCell>
                              <TableCell className="text-right">{Number(e.debit) > 0 ? <span className="text-red-600 font-medium">{formatCurrency(Number(e.debit))}</span> : "—"}</TableCell>
                              <TableCell className="text-right">{Number(e.credit) > 0 ? <span className="text-emerald-600 font-medium">{formatCurrency(Number(e.credit))}</span> : "—"}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(Number(e.balance))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
              </TabsContent>

              {/* AUDIT TRAIL */}
              <TabsContent value="audit" className="px-6 pb-6 mt-0 space-y-3">
                {!audit
                  ? <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
                  : audit.length === 0
                  ? <div className="py-10 text-center text-sm text-muted-foreground">No audit entries</div>
                  : (
                    <div className="space-y-2">
                      {audit.map((a) => (
                        <div key={String(a.id)} className="rounded-lg border p-3 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {String(a.action).includes("PAYMENT") ? <Receipt className="h-3.5 w-3.5 text-sky-500 shrink-0" /> : <Calendar className="h-3.5 w-3.5 text-violet-500 shrink-0" />}
                              <span className="text-xs font-medium">{String(a.action).replace(/_/g, " ")}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(String(a.createdAt))}</span>
                          </div>
                          {Boolean(a.user) && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <User className="h-3 w-3" /> {String(a.user)}
                            </div>
                          )}
                          {Boolean(a.oldValue || a.newValue) && (
                            <div className="flex items-center gap-2 text-[10px]">
                              {Boolean(a.oldValue) && <span className="text-muted-foreground line-through">{String(a.oldValue).length > 30 ? String(a.oldValue).slice(0,30)+"…" : String(a.oldValue)}</span>}
                              {Boolean(a.oldValue) && Boolean(a.newValue) && <span className="text-muted-foreground">→</span>}
                              {Boolean(a.newValue) && <span className="font-medium">{String(a.newValue).length > 30 ? String(a.newValue).slice(0,30)+"…" : String(a.newValue)}</span>}
                            </div>
                          )}
                          {Boolean(a.notes) && <p className="text-[10px] text-muted-foreground">{String(a.notes)}</p>}
                        </div>
                      ))}
                    </div>
                  )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Sub-drawers */}
      {detail?.subscription && (
        <RecurringDateDrawer
          open={recurringOpen}
          onOpenChange={setRecurringOpen}
          businessId={businessId}
          currentDueDate={detail.subscription.nextBillingDate}
          onSuccess={() => { fetchDetail(); setRecurringOpen(false); onRefreshSummary?.() }}
        />
      )}

      <BillingDocumentDrawer
        open={docDrawerOpen}
        onOpenChange={setDocDrawerOpen}
        businessId={businessId}
        existingDoc={selectedDoc}
        onSuccess={() => { setInvoices(null); fetchTab("invoices"); setDocDrawerOpen(false) }}
      />
    </>
  )
}
