"use client"

import { useState, useEffect, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Download, Mail, MessageCircle, CreditCard,
  Send, XCircle, RefreshCw, Clock, CheckCircle2,
  Building2, FileText,
} from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

// ── Types ────────────────────────────────────────────────────────────────────

interface InvoiceSettings {
  // Logo (priority: invoiceLogoUrl → salesLogoUrl → logoUrl)
  invoiceLogoUrl:    string | null
  salesLogoUrl:      string | null
  logoUrl:           string | null
  // Company identity
  companyName:       string
  companyAddress:    string
  companyEmail:      string
  companyPhone:      string | null
  companyGst:        string
  sacCode:           string
  // Invoice overrides
  invoiceLegalName:    string | null
  invoiceBusinessName: string | null
  invoiceAddress:      string | null
  invoiceCity:         string | null
  invoiceState:        string | null
  invoicePincode:      string | null
  invoiceCountry:      string | null
  invoicePhone:        string | null
  invoiceEmail:        string | null
  invoiceWebsite:      string | null
  // Tax & registration
  companyPan:    string | null
  companyMsme:   string | null
  companyShopEst: string | null
  companyIec:    string | null
  companyCin:    string | null
  // Banking
  bankAccountName:   string | null
  bankName:          string | null
  bankAccountNumber: string | null
  bankIfsc:          string | null
  bankUpiId:         string | null
  // Footer
  invoiceFooterNotes:     string | null
  invoiceLegalDisclaimer: string | null
  invoiceDefaultNotes:    string | null
}

interface LineItem {
  serviceId?:   string | null
  name:         string
  description?: string | null
  quantity:     number
  unitPrice:    number
  amount:       number
}

interface Payment {
  id:            string
  amount:        number
  paidAt:        string
  paymentMode:   string | null
  status:        string
  transactionId: string | null
}

interface Invoice {
  id:            string
  invoiceNumber: string
  status:        string
  billingPeriod: string | null
  periodStart:   string | null
  periodEnd:     string | null
  lineItems:     string
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
      pincode:      string | null
      gstNumber:    string | null
      logo:         string | null
    }
  }
  payments: Payment[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

type PaymentDisplay = { label: string; color: string; bg: string; border: string; badgeCls: string }

function getPaymentDisplay(status: string): PaymentDisplay {
  if (status === "PAID")      return { label: "PAID",         color: "#059669", bg: "bg-emerald-50", border: "border-emerald-200", badgeCls: "bg-emerald-100 text-emerald-700" }
  if (status === "CANCELLED") return { label: "CANCELLED",    color: "#6b7280", bg: "bg-slate-50",   border: "border-slate-200",   badgeCls: "bg-slate-100 text-slate-600" }
  if (status === "OVERDUE")   return { label: "PAYMENT DUE",  color: "#dc2626", bg: "bg-red-50",     border: "border-red-200",     badgeCls: "bg-red-100 text-red-700" }
  return                             { label: "PAYMENT DUE",  color: "#d97706", bg: "bg-amber-50",   border: "border-amber-200",   badgeCls: "bg-amber-100 text-amber-700" }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:              boolean
  invoiceId:         string | null
  businessId:        string
  onClose:           () => void
  onStatusChange?:   () => void
  onRecordPayment?:  (invoiceId: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InvoicePreviewPanel({
  open, invoiceId, businessId, onClose, onStatusChange, onRecordPayment,
}: Props) {
  const { user } = useAuthStore()
  const [invoice,   setInvoice]   = useState<Invoice | null>(null)
  const [ps,        setPs]        = useState<InvoiceSettings | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [acting,    setActing]    = useState(false)
  const [emailing,  setEmailing]  = useState(false)

  const load = useCallback(async () => {
    if (!invoiceId) return
    setLoading(true)
    try {
      const [invRes, psRes] = await Promise.all([
        fetch(`/api/admin/account-billing/${businessId}/invoices/${invoiceId}`, { headers: getAuthHeaders() }),
        fetch(`/api/admin/platform-settings`, { headers: getAuthHeaders() }),
      ])
      const [invJson, psJson] = await Promise.all([invRes.json(), psRes.json()])
      if (invJson.success) setInvoice(invJson.data)
      else toast.error("Failed to load invoice")
      if (psJson.success) setPs(psJson.data as InvoiceSettings)
    } catch { toast.error("Failed to load invoice") }
    finally { setLoading(false) }
  }, [invoiceId, businessId])

  useEffect(() => {
    if (open && invoiceId) { setInvoice(null); load() }
  }, [open, invoiceId]) // eslint-disable-line

  // ── Actions ────────────────────────────────────────────────────────────────

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
      toast.success(`Invoice marked ${status.toLowerCase()}`)
      await load()
      onStatusChange?.()
    } catch { toast.error("Failed to update invoice") }
    finally { setActing(false) }
  }

  const [downloading, setDownloading] = useState(false)

  const downloadPdf = async () => {
    if (!invoice) return
    setDownloading(true)
    try {
      const url = `/api/admin/account-billing/${businessId}/invoices/${invoice.id}/pdf`
      const res = await fetch(url, { headers: getAuthHeaders() })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error((json as { error?: string }).error ?? `PDF generation failed (${res.status})`)
        return
      }
      const blob      = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a         = document.createElement("a")
      a.href          = objectUrl
      a.download      = `invoice-${invoice.invoiceNumber.replace(/\//g, "-")}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to download PDF")
    } finally {
      setDownloading(false)
    }
  }

  const sendEmail = async () => {
    if (!invoice) return
    const biz = invoice.account.business
    if (!biz.contactEmail) { toast.error("Business has no contact email"); return }
    setEmailing(true)
    try {
      const res  = await fetch(`/api/admin/account-billing/${businessId}/invoices/${invoice.id}/email`, {
        method:  "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body:    JSON.stringify({}),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.error ?? "Failed to send email"); return }
      toast.success(json.message ?? "Invoice emailed")
      await load(); onStatusChange?.()
    } catch { toast.error("Failed to send email") }
    finally { setEmailing(false) }
  }

  const sendWhatsApp = () => {
    if (!invoice) return
    const biz     = invoice.account.business
    const phone   = biz.contactPhone?.replace(/\D/g, "")
    if (!phone) { toast.error("Business has no phone number for WhatsApp"); return }
    const pd      = getPaymentDisplay(invoice.status)
    const balance = Math.max(0, invoice.totalAmount - invoice.paidAmount)
    const msg = [
      `Hi ${biz.name},`,
      ``,
      pd.label === "PAID"
        ? `Your invoice ${invoice.invoiceNumber} has been marked as PAID. Thank you!`
        : `Your invoice ${invoice.invoiceNumber} for ${fmt(invoice.totalAmount)} is pending.`,
      ``,
      `Invoice: ${invoice.invoiceNumber}`,
      invoice.billingPeriod ? `Period: ${invoice.billingPeriod}` : null,
      invoice.dueDate ? `Due Date: ${fmtDate(invoice.dueDate)}` : null,
      pd.label !== "PAID" ? `Amount Due: ${fmt(balance)}` : `Amount: ${fmt(invoice.totalAmount)} (PAID)`,
      ``,
      `For queries, contact ${coEmail}`,
    ].filter(l => l !== null).join("\n")
    const wa = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    window.open(wa, "_blank")
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const lineItems: LineItem[] = invoice
    ? (() => { try { return JSON.parse(invoice.lineItems) } catch { return [] } })()
    : []
  const biz     = invoice?.account?.business
  const pd      = invoice ? getPaymentDisplay(invoice.status) : null
  const balance = invoice ? Math.max(0, invoice.totalAmount - invoice.paidAmount) : 0
  const isPaid  = invoice?.status === "PAID"
  const canPay  = invoice && !["PAID", "CANCELLED"].includes(invoice.status)

  // Platform settings — derived display values (mirrors PDF route fallback chain)
  const coName    = ps?.invoiceLegalName  || ps?.invoiceBusinessName || ps?.companyName || "Quantix Technology"
  const coEmail   = ps?.invoiceEmail      || ps?.companyEmail         || "billing@quantixtechnology.in"
  const coPhone   = ps?.invoicePhone      || ps?.companyPhone         || null
  const coWebsite = ps?.invoiceWebsite    || null
  const addrLine1 = ps?.invoiceAddress    || ps?.companyAddress       || ""
  const addrLine2 = [ps?.invoiceCity, ps?.invoiceState, ps?.invoicePincode ? `– ${ps.invoicePincode}` : null].filter(Boolean).join(", ")
  const addrFull  = [addrLine1, addrLine2].filter(Boolean).join(", ")
  const gstin     = ps?.companyGst && ps.companyGst !== "APPLIED FOR" ? ps.companyGst : null
  const sacCode   = ps?.sacCode || "998314"
  const logoSrc   = ps?.invoiceLogoUrl || ps?.salesLogoUrl || ps?.logoUrl || null

  const registrations = [
    gstin             ? `GSTIN: ${gstin}`              : null,
    ps?.companyPan    ? `PAN: ${ps.companyPan}`         : null,
    ps?.companyMsme   ? `MSME: ${ps.companyMsme}`       : null,
    ps?.companyShopEst ? `S&E: ${ps.companyShopEst}`   : null,
    ps?.companyIec    ? `IEC: ${ps.companyIec}`         : null,
    ps?.companyCin    ? `CIN: ${ps.companyCin}`         : null,
  ].filter(Boolean) as string[]

  const hasBanking = !isPaid && (ps?.bankAccountNumber || ps?.bankIfsc || ps?.bankUpiId)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden">

        {/* Sheet Header */}
        <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="rounded-lg bg-violet-100 p-1.5 shrink-0">
                <FileText className="h-4 w-4 text-violet-700" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-sm font-semibold truncate">
                  {loading ? "Loading…" : (invoice?.invoiceNumber ?? "Invoice")}
                </SheetTitle>
                {invoice?.billingPeriod && (
                  <p className="text-[11px] text-muted-foreground">{invoice.billingPeriod}</p>
                )}
              </div>
            </div>
            {invoice && pd && (
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 tracking-wide ${pd.badgeCls}`}>
                {pd.label}
              </span>
            )}
          </div>
        </SheetHeader>

        {/* Scrollable invoice body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-6 space-y-4">
              {[0,1,2,3].map(i => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          )}

          {!loading && invoice && biz && pd && (
            <div className="p-6 space-y-5">

              {/* ── Letterhead ── */}
              <div className="rounded-xl border bg-gradient-to-br from-violet-50 to-indigo-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Company */}
                  <div className="space-y-1 min-w-0">
                    {logoSrc ? (
                      <img src={logoSrc} alt={coName} className="h-10 object-contain mb-2 max-w-[180px]" />
                    ) : (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="rounded-lg bg-violet-600 p-1.5 shrink-0">
                          <Building2 className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-base text-violet-900 truncate">{coName}</span>
                      </div>
                    )}
                    {logoSrc && <p className="font-bold text-sm text-violet-900">{coName}</p>}
                    {ps?.invoiceBusinessName && ps.invoiceLegalName && (
                      <p className="text-[11px] text-violet-700/80">{ps.invoiceBusinessName}</p>
                    )}
                    {addrFull && <p className="text-[11px] text-violet-700/80">{addrFull}</p>}
                    <p className="text-[11px] text-violet-700/80">{coEmail}</p>
                    {coPhone   && <p className="text-[11px] text-violet-700/80">{coPhone}</p>}
                    {coWebsite && <p className="text-[11px] text-violet-700/80">{coWebsite}</p>}
                    {registrations.length > 0 && (
                      <p className="text-[10px] text-violet-600/60 font-mono mt-1">
                        {registrations.join(" · ")}
                      </p>
                    )}
                    <p className="text-[10px] text-violet-600/60 font-mono">SAC/HSN: {sacCode}</p>
                  </div>

                  {/* Invoice meta */}
                  <div className="text-right space-y-1 shrink-0">
                    <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Tax Invoice</p>
                    <p className="font-mono font-bold text-sm text-violet-900">{invoice.invoiceNumber}</p>
                    <p className="text-[11px] text-violet-700/80">Issued: {fmtDate(invoice.issuedDate)}</p>
                    {invoice.dueDate && (
                      <p className={`text-[11px] font-semibold ${invoice.status === "OVERDUE" ? "text-red-600" : "text-violet-700/80"}`}>
                        Due: {fmtDate(invoice.dueDate)}
                      </p>
                    )}
                    <div className="mt-2">
                      <span
                        className="inline-block text-[11px] font-black px-3 py-1 rounded border-2 tracking-widest uppercase"
                        style={{
                          color:           pd.color,
                          borderColor:     pd.color,
                          transform:       "rotate(-4deg)",
                          display:         "inline-block",
                          transformOrigin: "center",
                        }}
                      >
                        {pd.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Bill From / Bill To ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border p-4 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Bill From</p>
                  <p className="text-sm font-semibold">{coName}</p>
                  {addrFull && <p className="text-[11px] text-muted-foreground">{addrFull}</p>}
                  <p className="text-[11px] text-muted-foreground">{coEmail}</p>
                  {coPhone && <p className="text-[11px] text-muted-foreground">{coPhone}</p>}
                  {gstin && <p className="text-[11px] text-muted-foreground font-mono">GSTIN: {gstin}</p>}
                </div>
                <div className="rounded-xl border p-4 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Bill To</p>
                  <p className="text-sm font-semibold">{biz.name}</p>
                  {biz.contactEmail  && <p className="text-[11px] text-muted-foreground">{biz.contactEmail}</p>}
                  {biz.contactPhone  && <p className="text-[11px] text-muted-foreground">{biz.contactPhone}</p>}
                  {(biz.address || biz.city) && (
                    <p className="text-[11px] text-muted-foreground">
                      {[biz.address, biz.city, biz.state].filter(Boolean).join(", ")}
                      {biz.pincode ? ` – ${biz.pincode}` : ""}
                    </p>
                  )}
                  {biz.gstNumber && <p className="text-[11px] text-muted-foreground font-mono">GSTIN: {biz.gstNumber}</p>}
                </div>
              </div>

              <Separator />

              {/* ── Line Items ── */}
              <div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2 text-left font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Service / Description</th>
                      <th className="pb-2 w-10 text-center font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Qty</th>
                      <th className="pb-2 w-28 text-right font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Unit Price</th>
                      <th className="pb-2 w-28 text-right font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lineItems.map((item, i) => (
                      <tr key={i}>
                        <td className="py-2.5">
                          <p className="font-semibold text-foreground">{item.name}</p>
                          {item.description && <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>}
                        </td>
                        <td className="py-2.5 text-center tabular-nums">{item.quantity}</td>
                        <td className="py-2.5 text-right tabular-nums font-mono">{fmt(item.unitPrice)}</td>
                        <td className="py-2.5 text-right tabular-nums font-mono font-semibold">{fmt(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Separator />

              {/* ── Totals ── */}
              <div className="flex justify-end">
                <div className="w-60 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono">{fmt(invoice.subtotal)}</span>
                  </div>
                  {invoice.cgstAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>CGST ({invoice.cgstRate}%)</span>
                      <span className="font-mono">{fmt(invoice.cgstAmount)}</span>
                    </div>
                  )}
                  {invoice.sgstAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>SGST ({invoice.sgstRate}%)</span>
                      <span className="font-mono">{fmt(invoice.sgstAmount)}</span>
                    </div>
                  )}
                  {invoice.igstAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>IGST ({invoice.igstRate}%)</span>
                      <span className="font-mono">{fmt(invoice.igstAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-2 text-sm">
                    <span>Total</span>
                    <span className="font-mono text-violet-700">{fmt(invoice.totalAmount)}</span>
                  </div>
                  {invoice.paidAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Paid</span>
                      <span className="font-mono">{fmt(invoice.paidAmount)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Payment Status Box ── */}
              <div className={`rounded-xl border-2 p-4 flex items-center justify-between ${pd.bg} ${pd.border}`}>
                <div>
                  <p className="text-sm font-bold" style={{ color: pd.color }}>
                    {isPaid ? "✓ Payment Received" : "Amount Due"}
                  </p>
                  {isPaid && invoice.payments.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Received on {fmtDate(invoice.payments[0].paidAt)}
                    </p>
                  )}
                  {!isPaid && invoice.dueDate && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Please pay by {fmtDate(invoice.dueDate)}
                    </p>
                  )}
                </div>
                <div className="text-2xl font-black font-mono" style={{ color: pd.color }}>
                  {fmt(isPaid ? 0 : balance)}
                </div>
              </div>

              {/* ── Payment History ── */}
              {invoice.payments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Payment History</p>
                  {invoice.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs">
                      <div className="space-y-0.5">
                        <p className="font-semibold">{fmt(p.amount)}</p>
                        <p className="text-muted-foreground text-[10px]">
                          {[p.paymentMode, p.transactionId].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <p>{fmtDate(p.paidAt)}</p>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${p.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {p.status === "PENDING_VERIFICATION" ? "Pending" : p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Banking Details (unpaid only) ── */}
              {hasBanking && ps && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Bank Transfer Details</p>
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                    {ps.bankAccountName   && <><span className="text-muted-foreground">Account Name</span><span className="font-medium">{ps.bankAccountName}</span></>}
                    {ps.bankName          && <><span className="text-muted-foreground">Bank</span><span className="font-medium">{ps.bankName}</span></>}
                    {ps.bankAccountNumber && <><span className="text-muted-foreground">Account No.</span><span className="font-mono font-medium">{ps.bankAccountNumber}</span></>}
                    {ps.bankIfsc          && <><span className="text-muted-foreground">IFSC</span><span className="font-mono font-medium">{ps.bankIfsc}</span></>}
                    {ps.bankUpiId         && <><span className="text-muted-foreground">UPI ID</span><span className="font-mono font-medium">{ps.bankUpiId}</span></>}
                  </div>
                </div>
              )}

              {/* ── Notes ── */}
              {(invoice.notes || ps?.invoiceDefaultNotes) && (
                <div className="rounded-xl bg-muted/40 border px-4 py-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Notes: </span>
                  {[ps?.invoiceDefaultNotes, invoice.notes].filter(Boolean).join("\n\n")}
                </div>
              )}

              {/* ── Footer Notes ── */}
              {(ps?.invoiceFooterNotes || ps?.invoiceLegalDisclaimer) && (
                <div className="border-t pt-3 space-y-1">
                  {ps?.invoiceFooterNotes && (
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{ps.invoiceFooterNotes}</p>
                  )}
                  {ps?.invoiceLegalDisclaimer && (
                    <p className="text-[10px] text-muted-foreground/60 italic">{ps.invoiceLegalDisclaimer}</p>
                  )}
                </div>
              )}

              {/* ── Status transition actions (admin only) ── */}
              {!["PAID", "CANCELLED"].includes(invoice.status) && (
                <div className="rounded-xl border p-4 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Admin Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {invoice.status === "DRAFT" && (
                      <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={() => transition("SENT")} disabled={acting}>
                        {acting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Mark Sent
                      </Button>
                    )}
                    {["SENT", "OVERDUE"].includes(invoice.status) && (
                      <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={() => transition("OVERDUE")} disabled={acting || invoice.status === "OVERDUE"}>
                        <Clock className="h-3 w-3" /> Mark Overdue
                      </Button>
                    )}
                    {["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) && (
                      <Button size="sm" className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => transition("PAID")} disabled={acting}>
                        {acting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Mark Paid
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => transition("CANCELLED")} disabled={acting}>
                      <XCircle className="h-3 w-3" /> Cancel Invoice
                    </Button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ── Sticky Action Bar ── */}
        {invoice && (
          <div className="border-t bg-background px-6 py-4 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              {/* Download PDF */}
              <Button
                size="sm" variant="default"
                className="text-xs h-8 gap-1.5 bg-violet-600 hover:bg-violet-700"
                onClick={downloadPdf}
                disabled={downloading}
              >
                {downloading
                  ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />}
                {downloading ? "Generating…" : "Download PDF"}
              </Button>

              {/* Email */}
              <Button
                size="sm" variant="outline"
                className="text-xs h-8 gap-1.5"
                onClick={sendEmail}
                disabled={emailing || !biz?.contactEmail}
                title={!biz?.contactEmail ? "No contact email" : undefined}
              >
                {emailing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                {emailing ? "Sending…" : "Email Invoice"}
              </Button>

              {/* WhatsApp */}
              <Button
                size="sm" variant="outline"
                className="text-xs h-8 gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                onClick={sendWhatsApp}
                disabled={!biz?.contactPhone}
                title={!biz?.contactPhone ? "No phone number" : undefined}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </Button>

              {/* Record Payment */}
              {canPay && onRecordPayment && (
                <>
                  <div className="h-5 w-px bg-border mx-1" />
                  <Button
                    size="sm"
                    className="text-xs h-8 gap-1.5"
                    onClick={() => onRecordPayment(invoice.id)}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Record Payment
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
