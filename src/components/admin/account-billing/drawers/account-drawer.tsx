"use client"

import { useState, useEffect, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Building2, TrendingUp, AlertCircle, Plus, FileText,
  CreditCard, BookOpen, ClipboardList, Layers, Calendar,
} from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { AddServiceDialog }    from "./add-service-dialog"
import { CreateInvoiceDialog } from "./create-invoice-dialog"
import { RecordPaymentDialog } from "./record-payment-dialog"
import { InvoicePreviewPanel } from "../invoice-preview/invoice-preview-panel"

// ── Types ────────────────────────────────────────────────────────────────────

interface AccountDetail {
  accountId:      string
  businessId:     string
  businessName:   string
  businessStatus: string
  contactEmail:   string | null
  contactPhone:   string | null
  address:        string | null
  gstNumber:      string | null
  currency:       string
  mrr:            number
  outstanding:    number
  activeServices: number
  totalInvoices:  number
  totalPayments:  number
  lastPayment:    { amount: number; paidAt: string; paymentMode: string | null } | null
  services:       BillingService[]
  recentInvoices: BillingInvoice[]
}

interface BillingService {
  id:              string
  name:            string
  category:        string
  billingType:     string
  billingCycle:    string | null
  unitPrice:       number
  quantity:        number
  status:          string
  startDate:       string
  nextBillingDate: string | null
  description:     string | null
}

interface BillingInvoice {
  id:            string
  invoiceNumber: string
  status:        string
  billingPeriod: string | null
  totalAmount:   number
  paidAmount:    number
  dueDate:       string | null
  issuedDate:    string | null
  createdAt:     string
  payments?:     Array<{ amount: number; paidAt: string; paymentMode: string | null; status: string }>
}

interface BillingPayment {
  id:              string
  amount:          number
  paymentMode:     string | null
  transactionId:   string | null
  status:          string
  paidAt:          string
  recordedByName:  string | null
  invoice:         { invoiceNumber: string; billingPeriod: string | null }
}

interface LedgerEntry {
  id:              string
  entryType:       string
  description:     string
  debit:           number
  credit:          number
  balance:         number
  referenceNumber: string | null
  date:            string
}

interface AuditEntry {
  id:              string
  action:          string
  description:     string
  performedByName: string | null
  createdAt:       string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return "₹" + n.toLocaleString("en-IN") }
function fmtDate(s: string | null | undefined) {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

const INVOICE_BADGE: Record<string, string> = {
  DRAFT:          "bg-slate-100 text-slate-700",
  SENT:           "bg-sky-100 text-sky-700",
  PAID:           "bg-emerald-100 text-emerald-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  OVERDUE:        "bg-red-100 text-red-700",
  CANCELLED:      "bg-rose-100 text-rose-700",
}

const CATEGORY_BADGE: Record<string, string> = {
  PLATFORM:       "bg-violet-100 text-violet-700",
  MOBILE_APP:     "bg-sky-100 text-sky-700",
  IMPLEMENTATION: "bg-amber-100 text-amber-700",
  SUPPORT:        "bg-emerald-100 text-emerald-700",
  CUSTOM:         "bg-slate-100 text-slate-700",
}

function KPI({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 flex items-start gap-3">
      <div className={`rounded-lg p-2 ${color}`}><Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-base font-semibold leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open:              boolean
  businessId:        string | null
  onOpenChange:      (v: boolean) => void
  onRefreshSummary?: () => void
}

export function AccountDrawer({ open, businessId, onOpenChange, onRefreshSummary }: Props) {
  const [activeTab, setActiveTab] = useState("services")
  const [detail,    setDetail]    = useState<AccountDetail | null>(null)
  const [dLoading,  setDLoading]  = useState(false)

  const [invoices,      setInvoices]      = useState<BillingInvoice[] | null>(null)
  const [payments,      setPayments]      = useState<BillingPayment[] | null>(null)
  const [ledger,        setLedger]        = useState<LedgerEntry[]    | null>(null)
  const [audit,         setAudit]         = useState<AuditEntry[]     | null>(null)
  const [ledgerBalance, setLedgerBalance] = useState(0)

  const [addServiceOpen,    setAddServiceOpen]    = useState(false)
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [recordPaymentDefaultId, setRecordPaymentDefaultId] = useState<string | undefined>(undefined)

  const [previewId,   setPreviewId]   = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // ── Fetchers ─────────────────────────────────────────────────────────────

  const fetchDetail = useCallback(async () => {
    if (!businessId) return
    setDLoading(true)
    try {
      const res  = await fetch(`/api/admin/account-billing/${businessId}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) setDetail(json.data)
    } catch { toast.error("Failed to load account") }
    finally { setDLoading(false) }
  }, [businessId])

  const fetchInvoices = useCallback(async (force = false) => {
    if (!businessId || (!force && invoices !== null)) return
    try {
      const res  = await fetch(`/api/admin/account-billing/${businessId}/invoices`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) setInvoices(json.data)
    } catch { /* silent */ }
  }, [businessId, invoices])

  const fetchPayments = useCallback(async (force = false) => {
    if (!businessId || (!force && payments !== null)) return
    try {
      const res  = await fetch(`/api/admin/account-billing/${businessId}/payments`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) setPayments(json.data)
    } catch { /* silent */ }
  }, [businessId, payments])

  const fetchLedger = useCallback(async (force = false) => {
    if (!businessId || (!force && ledger !== null)) return
    try {
      const res  = await fetch(`/api/admin/account-billing/${businessId}/ledger`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) { setLedger(json.data); setLedgerBalance(json.currentBalance ?? 0) }
    } catch { /* silent */ }
  }, [businessId, ledger])

  const fetchAudit = useCallback(async (force = false) => {
    if (!businessId || (!force && audit !== null)) return
    try {
      const res  = await fetch(`/api/admin/account-billing/${businessId}/audit-trail`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) setAudit(json.data)
    } catch { /* silent */ }
  }, [businessId, audit])

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open && businessId) {
      setDetail(null); setInvoices(null); setPayments(null)
      setLedger(null); setAudit(null); setActiveTab("services")
      fetchDetail()
    }
  }, [open, businessId]) // eslint-disable-line

  useEffect(() => {
    if (!open || !businessId) return
    if (activeTab === "invoices") fetchInvoices()
    if (activeTab === "payments") fetchPayments()
    if (activeTab === "ledger")   fetchLedger()
    if (activeTab === "audit")    fetchAudit()
  }, [activeTab]) // eslint-disable-line

  // ── Post-action refreshes ─────────────────────────────────────────────────

  const afterService = () => {
    fetchDetail(); onRefreshSummary?.()
  }

  const afterInvoice = () => {
    setInvoices(null); fetchInvoices(true)
    setLedger(null);   fetchLedger(true)
    setAudit(null);    fetchAudit(true)
    fetchDetail(); onRefreshSummary?.()
    setActiveTab("invoices")
  }

  const afterPayment = () => {
    setPayments(null); fetchPayments(true)
    setInvoices(null); fetchInvoices(true)
    setLedger(null);   fetchLedger(true)
    setAudit(null);    fetchAudit(true)
    fetchDetail(); onRefreshSummary?.()
    setActiveTab("payments")
  }

  const afterInvoiceStatus = () => {
    setInvoices(null); fetchInvoices(true)
    setLedger(null);   fetchLedger(true)
    setAudit(null);    fetchAudit(true)
    fetchDetail(); onRefreshSummary?.()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!businessId) return null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 overflow-hidden flex flex-col">

          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-100 p-2">
                <Building2 className="h-5 w-5 text-violet-700" />
              </div>
              <div className="flex-1 min-w-0">
                {dLoading ? (
                  <Skeleton className="h-5 w-48" />
                ) : (
                  <SheetTitle className="text-base font-semibold truncate">
                    {detail?.businessName ?? "Loading…"}
                  </SheetTitle>
                )}
                {detail && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {[detail.contactEmail, detail.contactPhone, detail.gstNumber ? `GST: ${detail.gstNumber}` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              {detail && (
                <Badge variant="outline" className="text-[10px] shrink-0">{detail.businessStatus}</Badge>
              )}
            </div>
          </SheetHeader>

          {/* KPIs */}
          {detail && (
            <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b shrink-0">
              <KPI label="Monthly Value" value={fmt(detail.mrr)} icon={TrendingUp}  color="bg-violet-100 text-violet-700" />
              <KPI label="Outstanding"   value={fmt(detail.outstanding)} icon={AlertCircle} color={detail.outstanding > 0 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"} />
              <KPI label="Services"      value={String(detail.activeServices)} icon={Layers} color="bg-sky-100 text-sky-700"
                sub={`${detail.totalInvoices} invoice${detail.totalInvoices !== 1 ? "s" : ""}`} />
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="px-6 h-10 w-full justify-start rounded-none border-b bg-transparent shrink-0 gap-1">
              {[
                { value: "services", label: "Services",  icon: Layers },
                { value: "invoices", label: "Invoices",  icon: FileText },
                { value: "payments", label: "Payments",  icon: CreditCard },
                { value: "ledger",   label: "Ledger",    icon: BookOpen },
                { value: "audit",    label: "Audit",     icon: ClipboardList },
              ].map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value}
                  className="h-8 rounded-md px-3 text-xs data-[state=active]:bg-muted data-[state=active]:text-foreground">
                  <Icon className="h-3.5 w-3.5 mr-1.5" />{label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 overflow-y-auto">

              {/* Services */}
              <TabsContent value="services" className="p-6 space-y-4 m-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Services</h3>
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setAddServiceOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Add Service
                  </Button>
                </div>

                {dLoading && <div className="space-y-2">{[0,1].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>}

                {!dLoading && !detail?.services.length && (
                  <div className="rounded-xl border border-dashed p-8 text-center">
                    <Layers className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium">No services yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Add a service to start the billing workflow.</p>
                    <Button size="sm" className="mt-4 text-xs gap-1.5" onClick={() => setAddServiceOpen(true)}>
                      <Plus className="h-3.5 w-3.5" /> Add First Service
                    </Button>
                  </div>
                )}

                {detail?.services.map(s => (
                  <div key={s.id} className="rounded-xl border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{s.name}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[s.category] ?? "bg-muted text-muted-foreground"}`}>
                            {s.category}
                          </span>
                        </div>
                        {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{fmt(s.unitPrice * s.quantity)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {s.billingType === "RECURRING" ? s.billingCycle : "One-Time"}
                          {s.quantity > 1 ? ` · ${s.quantity}×` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span>Started {fmtDate(s.startDate)}</span>
                        {s.nextBillingDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Next {fmtDate(s.nextBillingDate)}
                          </span>
                        )}
                      </div>
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${s.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : s.status === "PAUSED" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}

                {detail && (detail.services.length > 0) && (
                  <Button variant="outline" className="w-full text-xs h-9 gap-1.5" onClick={() => setCreateInvoiceOpen(true)}>
                    <FileText className="h-3.5 w-3.5" /> Create Invoice from Services
                  </Button>
                )}
              </TabsContent>

              {/* Invoices */}
              <TabsContent value="invoices" className="p-6 space-y-4 m-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Invoices</h3>
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setCreateInvoiceOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Create Invoice
                  </Button>
                </div>

                {invoices === null && <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>}

                {invoices !== null && invoices.length === 0 && (
                  <div className="rounded-xl border border-dashed p-8 text-center">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium">No invoices yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Create an invoice from the Services tab.</p>
                  </div>
                )}

                {invoices?.map(inv => (
                  <button key={inv.id}
                    className="w-full text-left rounded-xl border p-4 hover:bg-muted/30 transition-colors"
                    onClick={() => { setPreviewId(inv.id); setPreviewOpen(true) }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-mono font-semibold">{inv.invoiceNumber}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${INVOICE_BADGE[inv.status] ?? "bg-muted text-muted-foreground"}`}>
                            {inv.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {inv.billingPeriod ?? fmtDate(inv.createdAt)}
                          {inv.dueDate ? ` · Due ${fmtDate(inv.dueDate)}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{fmt(inv.totalAmount)}</p>
                        {inv.paidAmount > 0 && inv.paidAmount < inv.totalAmount && (
                          <p className="text-[10px] text-emerald-600">{fmt(inv.paidAmount)} paid</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </TabsContent>

              {/* Payments */}
              <TabsContent value="payments" className="p-6 space-y-4 m-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Payments</h3>
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setRecordPaymentOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Record Payment
                  </Button>
                </div>

                {payments === null && <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>}

                {payments !== null && payments.length === 0 && (
                  <div className="rounded-xl border border-dashed p-8 text-center">
                    <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium">No payments recorded</p>
                  </div>
                )}

                {payments?.map(p => (
                  <div key={p.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{fmt(p.amount)}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${p.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : p.status === "PENDING_VERIFICATION" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                            {p.status === "PENDING_VERIFICATION" ? "Pending Verif." : p.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[p.invoice.invoiceNumber, p.invoice.billingPeriod, p.paymentMode, p.transactionId].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="text-right shrink-0 text-xs text-muted-foreground">
                        <p>{fmtDate(p.paidAt)}</p>
                        {p.recordedByName && <p className="text-[10px]">{p.recordedByName}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </TabsContent>

              {/* Ledger */}
              <TabsContent value="ledger" className="p-6 m-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Ledger</h3>
                  {ledger !== null && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ledgerBalance > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {ledgerBalance > 0 ? `${fmt(ledgerBalance)} due` : ledgerBalance < 0 ? `${fmt(Math.abs(ledgerBalance))} credit` : "Settled"}
                    </span>
                  )}
                </div>

                {ledger === null && <div className="space-y-2">{[0,1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>}

                {ledger !== null && ledger.length === 0 && (
                  <div className="rounded-xl border border-dashed p-8 text-center">
                    <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium">No ledger entries</p>
                    <p className="text-xs text-muted-foreground mt-1">Entries appear when invoices and payments are recorded.</p>
                  </div>
                )}

                {ledger !== null && ledger.length > 0 && (
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Debit</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Credit</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {ledger.map(e => (
                          <tr key={e.id} className="hover:bg-muted/20">
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(e.date)}</td>
                            <td className="px-3 py-2">
                              <p className="truncate max-w-[160px]">{e.description}</p>
                              {e.referenceNumber && <p className="text-[10px] text-muted-foreground font-mono">{e.referenceNumber}</p>}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-mono text-red-600">{e.debit > 0 ? fmt(e.debit) : "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-mono text-emerald-600">{e.credit > 0 ? fmt(e.credit) : "—"}</td>
                            <td className={`px-3 py-2 text-right tabular-nums font-mono font-semibold ${e.balance > 0 ? "text-red-600" : e.balance < 0 ? "text-emerald-600" : ""}`}>
                              {fmt(Math.abs(e.balance))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* Audit */}
              <TabsContent value="audit" className="p-6 space-y-3 m-0">
                <h3 className="text-sm font-semibold">Audit Trail</h3>

                {audit === null && <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>}

                {audit !== null && audit.length === 0 && (
                  <div className="rounded-xl border border-dashed p-8 text-center">
                    <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium">No audit entries</p>
                    <p className="text-xs text-muted-foreground mt-1">All billing actions are logged here.</p>
                  </div>
                )}

                {audit?.map(a => (
                  <div key={a.id} className="rounded-xl border p-3 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded">
                        {a.action}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{fmtDate(a.createdAt)}</span>
                    </div>
                    <p className="text-xs">{a.description}</p>
                    {a.performedByName && <p className="text-[10px] text-muted-foreground">by {a.performedByName}</p>}
                  </div>
                ))}
              </TabsContent>

            </div>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Action dialogs + invoice preview */}
      {businessId && (
        <>
          <AddServiceDialog
            open={addServiceOpen} onOpenChange={setAddServiceOpen}
            businessId={businessId} onSuccess={afterService}
          />
          <CreateInvoiceDialog
            open={createInvoiceOpen} onOpenChange={setCreateInvoiceOpen}
            businessId={businessId}
            services={detail?.services ?? []}
            onSuccess={afterInvoice}
          />
          <RecordPaymentDialog
            open={recordPaymentOpen} onOpenChange={(v) => { setRecordPaymentOpen(v); if (!v) setRecordPaymentDefaultId(undefined) }}
            businessId={businessId}
            invoices={invoices ?? detail?.recentInvoices ?? []}
            defaultInvoiceId={recordPaymentDefaultId}
            onSuccess={afterPayment}
          />
          <InvoicePreviewPanel
            open={previewOpen} invoiceId={previewId}
            businessId={businessId}
            onClose={() => setPreviewOpen(false)}
            onStatusChange={afterInvoiceStatus}
            onRecordPayment={(invoiceId) => {
              setPreviewOpen(false)
              setRecordPaymentDefaultId(invoiceId)
              setRecordPaymentOpen(true)
            }}
          />
        </>
      )}
    </>
  )
}
