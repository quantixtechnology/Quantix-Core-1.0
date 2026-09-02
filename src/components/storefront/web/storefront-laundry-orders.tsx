"use client"

// Customer LAUNDRY order portal — My Orders + Order Details + Track + Payment
// History + Invoice. Consumes the existing laundry customer APIs and the shared
// invoice renderer; it never duplicates orders, workflow, payments or invoices.
//   list    → GET /api/core/storefront/laundry-orders
//   detail  → GET /api/core/storefront/laundry-orders/[orderId]
//   invoice → GET /api/core/storefront/orders/[orderId]/laundry-invoice
import { useCallback, useEffect, useMemo, useState } from "react"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { Loader2, ChevronLeft, Package, Truck, CreditCard, FileText, Eye, Printer, X, CheckCircle2, Clock, Star, Send } from "lucide-react"
import { LaundryInvoiceDocument, type InvoiceView } from "@/components/laundry/invoice/laundry-invoice-document"
import type { WebNav } from "./storefront-website"

const inr = (n: number | null | undefined) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
const inr2 = (n: number | null | undefined) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—")

interface ListItem { id: string; orderNumber: string; status: string; statusLabel: string; paymentStatus: string; grandTotal: number; amountPaid: number; balanceDue: number; pickupDate: string | null; createdAt: string; storeName: string | null; totalGarments: number }
interface DetailItem { id: string; itemNumber: string | null; barcode: string | null; garmentScanCode?: string | null; serviceName: string; garmentName: string; quantity: number; stage: string | null; stageLabel: string | null }
interface Detail {
  order: { id: string; orderNumber: string; status: string; statusLabel: string; cancelled: boolean; paymentStatus: string; pickupDate: string | null; pickupTimeSlot: string | null; pickupAddress: string | null; expectedDeliveryDate: string | null; createdAt: string; recipientName: string | null }
  verification?: {
    pickup: { method: string; otp: string | null; message: string }
    delivery: { method: string; otp: string | null; message: string }
  }
  store: { name: string } | null
  totals: { subtotal: number; gstTotal: number; discount: number; grandTotal: number; amountPaid: number; balanceDue: number }
  items: DetailItem[]
  payments: { id: string; method: string; amount: number; reference: string | null; note: string | null; at: string }[]
  timeline: { status: string; label: string; done: boolean; current: boolean }[]
  feedback?: { rating: number; comment: string | null; submittedAt: string } | null
  canRate?: boolean
}

const payStyle = (s: string) => s === "PAID" || s === "SUBSCRIPTION" ? "text-emerald-600" : s === "PARTIAL" ? "text-amber-600" : "text-rose-600"

export function StorefrontLaundryOrders({ brandColor, nav }: { brandColor: string; nav: WebNav }) {
  const { isAuthenticated, token } = useAuthStore()
  const { currentBusinessId } = useAdminStore()
  const [list, setList] = useState<ListItem[]>([])
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [invoice, setInvoice] = useState<InvoiceView | null>(null)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [printedAt, setPrintedAt] = useState(() => Date.now())
  const [rate, setRate] = useState(0)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState("")
  const accent = { color: brandColor }

  const headers = useMemo(() => {
    const h: Record<string, string> = {}
    if (token) h["Authorization"] = `Bearer ${token}`
    if (currentBusinessId) h["x-business-id"] = currentBusinessId
    return h
  }, [token, currentBusinessId])

  const loadList = useCallback(() => {
    if (!isAuthenticated || !token) { setLoadingList(false); return }
    setLoadingList(true)
    fetch("/api/core/storefront/laundry-orders", { headers }).then((r) => r.json())
      .then((j) => { if (j.success) setList(j.data || []) }).catch(() => {}).finally(() => setLoadingList(false))
  }, [isAuthenticated, token, headers])

  const openDetail = useCallback((id: string) => {
    setLoadingDetail(true); setDetail(null)
    fetch(`/api/core/storefront/laundry-orders/${id}`, { headers }).then((r) => r.json())
      .then((j) => { if (j.success) setDetail(j.data) }).catch(() => {}).finally(() => setLoadingDetail(false))
  }, [headers])

  // Deep-link: open a specific order if the nav carries one (Track from home).
  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { if (nav.orderId) openDetail(nav.orderId) }, [nav.orderId, openDetail])

  const viewInvoice = async (id: string) => {
    setInvoiceOpen(true); setInvoice(null)
    try {
      const r = await fetch(`/api/core/storefront/orders/${id}/laundry-invoice`, { headers })
      const j = await r.json(); if (j.success) setInvoice(j.data)
    } catch { /* noop */ }
  }

  const submitFeedback = async () => {
    if (!detail) return
    if (!rate) { setSubmitErr("Please select a rating."); return }
    setSubmitErr(""); setSubmitting(true)
    try {
      const r = await fetch(`/api/core/storefront/laundry-orders/${detail.order.id}/feedback`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ rating: rate, comment }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) { setSubmitErr(j.error || "Could not submit feedback."); return }
      setDetail((p) => (p ? { ...p, feedback: j.data, canRate: false } : p))
      setRate(0); setComment("")
    } catch { setSubmitErr("Could not submit feedback.") } finally { setSubmitting(false) }
  }
  // Same rule as the admin panel: the customer's copy carries the time THIS
  // copy was printed, re-stamped on every click.
  const printNow = () => {
    setPrintedAt(Date.now())
    requestAnimationFrame(() => requestAnimationFrame(printInvoice))
  }
  const printInvoice = () => {
    const node = document.getElementById("laundry-invoice-print")
    if (!node) return
    const w = window.open("", "_blank", "width=820,height=1040")
    if (!w) return
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => `<link rel="stylesheet" href="${(l as HTMLLinkElement).href}">`).join("")
    const styles = Array.from(document.querySelectorAll("style")).map((s) => s.outerHTML).join("")
    w.document.open()
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${invoice?.invoice?.number || "Invoice"}</title>${links}${styles}<style>@page{margin:16mm}body{margin:0}</style></head><body>${node.outerHTML}</body></html>`)
    w.document.close()
    const go = () => { try { w.focus(); w.print() } catch { /* noop */ } }
    if (w.document.readyState === "complete") setTimeout(go, 400); else w.onload = () => setTimeout(go, 250)
  }

  if (!isAuthenticated) return (
    <div className="px-4 py-16 text-center">
      <p className="text-sm text-gray-500">Sign in to view your orders.</p>
      <button onClick={() => nav.go("auth")} className="mt-3 rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: brandColor }}>Sign in</button>
    </div>
  )

  // ── Detail view ────────────────────────────────────────────────────────────
  if (nav.orderId || detail || loadingDetail) {
    return (
      <div className="px-4 sm:px-6 py-4 pb-20 max-w-2xl mx-auto">
        <button onClick={() => { setDetail(null); nav.go("orders") }} className="inline-flex items-center gap-1 text-sm text-gray-500"><ChevronLeft className="w-4 h-4" /> My Orders</button>
        {loadingDetail || !detail ? (
          <div className="flex items-center justify-center gap-2 py-20 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading order…</div>
        ) : (
          <>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="font-mono text-base font-bold text-gray-900">{detail.order.orderNumber}</p>
                <p className="text-xs text-gray-400">{fmtDate(detail.order.createdAt)}{detail.store ? ` · ${detail.store.name}` : ""}</p>
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${brandColor}14`, color: brandColor }}>{detail.order.statusLabel}</span>
            </div>

            {/* Track — reuses the admin workflow definition (STATUS_META) */}
            <Section icon={Truck} title="Track Order" brandColor={brandColor}>
              {detail.order.cancelled ? (
                <p className="text-sm font-semibold text-rose-600">Order cancelled</p>
              ) : (
                <ol className="relative ml-1">
                  {detail.timeline.map((t, i) => (
                    <li key={t.status} className="flex gap-3 pb-3 last:pb-0">
                      <div className="flex flex-col items-center">
                        {t.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Clock className="w-4 h-4" style={t.current ? accent : { color: "#cbd5e1" }} />}
                        {i < detail.timeline.length - 1 && <div className="w-px flex-1 mt-0.5" style={{ backgroundColor: t.done ? "#10b981" : "#e2e8f0" }} />}
                      </div>
                      <span className={`text-sm ${t.current ? "font-semibold text-gray-900" : t.done ? "text-gray-600" : "text-gray-400"}`}>{t.label}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            {/* Garments — individual */}
            <Section icon={Package} title={`Garments (${detail.items.length})`} brandColor={brandColor}>
              <div className="divide-y divide-gray-50">
                {detail.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{it.garmentName} <span className="text-xs font-normal text-gray-400">· {it.serviceName}</span></p>
                      <p className="text-[11px] font-mono text-gray-400">{it.garmentScanCode || it.barcode || it.itemNumber || "—"}</p>
                    </div>
                    <span className="text-xs text-gray-500">{it.stageLabel || "Booked"}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Pickup / Delivery */}
            <Section icon={Truck} title="Pickup & Delivery" brandColor={brandColor}>
              <Row k="Pickup" v={`${fmtDate(detail.order.pickupDate)}${detail.order.pickupTimeSlot ? ` · ${detail.order.pickupTimeSlot}` : ""}`} />
              {detail.order.pickupAddress && <Row k="Address" v={detail.order.pickupAddress} />}
              <Row k="Expected Delivery" v={fmtDate(detail.order.expectedDeliveryDate)} />
            </Section>

            {/* Verification OTP — the single currently-relevant code. OTP-method
                orders only; the code is cleared server-side once verified. */}
            {(() => {
              const v = detail.verification
              if (!v) return null
              const rel = v.delivery.otp ? { kind: "Delivery", otp: v.delivery.otp, message: v.delivery.message } : v.pickup.otp ? { kind: "Pickup", otp: v.pickup.otp, message: v.pickup.message } : null
              if (!rel) return null
              return (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-600">{rel.kind} OTP</p>
                  <p className="mt-1 font-mono text-3xl font-bold tracking-[0.4em] text-slate-900">{rel.otp}</p>
                  <p className="mt-2 text-sm text-slate-600">{rel.message}</p>
                </div>
              )
            })()}

            {/* Customer feedback — one rating per delivered order, comment optional. */}
            {detail.feedback ? (
              <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Your Feedback</p>
                <div className="flex items-center gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`w-5 h-5 ${i <= detail.feedback!.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />)}
                  <span className="text-xs text-gray-400 ml-1">Submitted {fmtDate(detail.feedback!.submittedAt)}</span>
                </div>
                {detail.feedback.comment ? <p className="text-sm text-gray-600">“{detail.feedback.comment}”</p> : <p className="text-xs text-gray-400">No comment added.</p>}
              </div>
            ) : detail.canRate ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                <p className="text-sm font-semibold text-gray-800">Rate your experience</p>
                <p className="text-xs text-gray-500 mb-2">Your order has been delivered. We&apos;d love to hear about your experience.</p>
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button key={i} type="button" onClick={() => setRate(i)} aria-label={`${i} star`}><Star className={`w-8 h-8 transition-colors ${i <= rate ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} /></button>
                  ))}
                </div>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment (optional)…" rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none" />
                {submitErr && <p className="text-xs text-rose-600 mt-1">{submitErr}</p>}
                <button onClick={submitFeedback} disabled={submitting} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: brandColor }}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit Feedback
                </button>
              </div>
            ) : null}

            {/* Payment history — reuses LaundryPayment */}
            <Section icon={CreditCard} title="Payment" brandColor={brandColor}>
              <Row k="Total" v={inr2(detail.totals.grandTotal)} />
              <Row k="Paid" v={inr2(detail.totals.amountPaid)} />
              <div className="flex justify-between text-sm"><span className="text-gray-500">Balance</span><span className={`font-semibold ${detail.totals.balanceDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>{inr2(detail.totals.balanceDue)}</span></div>
              {detail.payments.length > 0 && (
                <div className="mt-2 border-t border-gray-50 pt-2 space-y-1">
                  {detail.payments.map((p) => (
                    <div key={p.id} className="flex justify-between text-xs text-gray-500"><span>{p.method} · {fmtDate(p.at)}{p.reference ? ` · ${p.reference}` : ""}</span><span className="font-medium text-gray-700">{inr2(p.amount)}</span></div>
                  ))}
                </div>
              )}
            </Section>

            <button onClick={() => viewInvoice(detail.order.id)} className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: brandColor }}><FileText className="w-4 h-4" /> View Invoice</button>
          </>
        )}
        {invoiceOpen && <InvoiceModal data={invoice} onClose={() => setInvoiceOpen(false)} onPrint={printNow} printedAt={printedAt} />}
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="px-4 sm:px-6 py-4 pb-20 max-w-2xl mx-auto">
      <h1 className="text-lg font-bold text-gray-900">My Orders</h1>
      {loadingList ? (
        <div className="flex items-center justify-center gap-2 py-20 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : list.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">You have no laundry orders yet.</p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {list.map((o) => (
            <div key={o.id} className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-bold text-gray-900">{o.orderNumber}</p>
                  <p className="text-xs text-gray-400">{fmtDate(o.createdAt)}{o.storeName ? ` · ${o.storeName}` : ""} · {o.totalGarments} garment(s)</p>
                </div>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${brandColor}14`, color: brandColor }}>{o.statusLabel}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-500">{inr(o.grandTotal)} · <span className={payStyle(o.paymentStatus)}>{o.balanceDue > 0 ? `${inr(o.balanceDue)} due` : "Paid"}</span></span>
                <div className="flex gap-2">
                  <button onClick={() => openDetail(o.id)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700"><Eye className="w-3.5 h-3.5" /> Details</button>
                  <button onClick={() => viewInvoice(o.id)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700"><FileText className="w-3.5 h-3.5" /> Invoice</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {invoiceOpen && <InvoiceModal data={invoice} onClose={() => setInvoiceOpen(false)} onPrint={printNow} printedAt={printedAt} />}
    </div>
  )
}

function Section({ icon: Icon, title, brandColor, children }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; title: string; brandColor: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400"><Icon className="w-3.5 h-3.5" style={{ color: brandColor }} /> {title}</p>
      {children}
    </div>
  )
}
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-3 text-sm"><span className="text-gray-500 shrink-0">{k}</span><span className="text-right text-gray-800">{v}</span></div>

function InvoiceModal({ data, onClose, onPrint, printedAt }: { data: InvoiceView | null; onClose: () => void; onPrint: () => void; printedAt?: number }) {
  return (
    // z-60 for the same reason as the checkout dialog: the installed-PWA
    // bottom navigation is a fixed z-50 element rendered later in the DOM,
    // so at z-50 it painted over the last ~130px of the invoice.
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 no-print" onClick={onClose}>
      <div className="relative my-6 w-full max-w-3xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="no-print flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <p className="text-sm font-semibold text-slate-700">Invoice</p>
          <div className="flex gap-2">
            {data?.invoice?.number && <button onClick={onPrint} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"><Printer className="h-3.5 w-3.5" /> Print / Save PDF</button>}
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-50"><X className="h-4 w-4 text-slate-500" /></button>
          </div>
        </div>
        {data ? <LaundryInvoiceDocument data={data} printedAt={printedAt} /> : <div className="flex items-center justify-center gap-2 py-20 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading invoice…</div>}
      </div>
    </div>
  )
}
