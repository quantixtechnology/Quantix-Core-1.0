"use client"

// Admin invoice panel on the Order screen. Fetches the single invoice payload,
// shows status + number, and offers Preview / Print / Download PDF / Mark as
// Paid. It reuses the existing invoice service (GET /invoice) and the existing
// Payment Engine (POST /payment) — no new invoice or payment logic.
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Eye, Printer, FileDown, CheckCircle2, Loader2, X } from "lucide-react"
import { LaundryInvoiceDocument, type InvoiceView } from "./laundry-invoice-document"
import { LaundryThermalReceipt } from "./laundry-thermal-receipt"
import { DEFAULT_PRINTER_SETTINGS, normalizePrinterSettings, isRoll, pageCss, type PrinterSettings } from "@/lib/laundry-printer"

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UNPAID: "bg-amber-50 text-amber-700 border-amber-200",
  DRAFT: "bg-slate-50 text-slate-600 border-slate-200",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
}

const inr = (n: number | null | undefined) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—")

export function LaundryInvoicePanel({ orderId, businessId }: { orderId: string; businessId: string }) {
  const [data, setData] = useState<InvoiceView | null>(null)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(false)
  const [marking, setMarking] = useState(false)
  // Printer configuration decides the PRESENTATION only. If it fails to load,
  // the defaults apply and printing carries on exactly as before.
  const [printer, setPrinter] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS)

  const load = useCallback(() => {
    if (!orderId || !businessId) return
    setLoading(true)
    fetch(`/api/laundry/orders/${orderId}/invoice?businessId=${encodeURIComponent(businessId)}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orderId, businessId])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!businessId) return
    fetch(`/api/laundry/printer-settings?businessId=${encodeURIComponent(businessId)}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setPrinter(normalizePrinterSettings(j.data)) })
      .catch(() => {})
  }, [businessId])

  const status = data?.invoice?.status || "DRAFT"
  const number = data?.invoice?.number
  const balanceDue = data?.totals.balanceDue || 0

  const markPaid = async () => {
    if (!data) return
    setMarking(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/payment?businessId=${encodeURIComponent(businessId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, method: "CASH", amount: balanceDue }),
      })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not record payment")
      toast.success("Payment recorded — invoice marked Paid")
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setMarking(false) }
  }

  // Print / Save-as-PDF via a DEDICATED window that renders the EXACT same
  // invoice markup (#laundry-invoice-print) with the tenant stylesheets. This
  // fixes the blank print (the node was inside the modal's display:none wrapper)
  // and sets the window title to the invoice number so the browser's print
  // header shows the invoice — not the app URL (no Quantix branding).
  const printInvoice = () => {
    // Whichever rendering is on screen is the one that prints — the roll
    // receipt on thermal paper, the full invoice otherwise. Same payload, same
    // numbers; only the arrangement differs.
    const roll = isRoll(printer)
    const node = document.getElementById(roll ? "laundry-thermal-print" : "laundry-invoice-print")
    if (!node) return
    const w = window.open("", "_blank", "width=820,height=1040")
    if (!w) { toast.error("Allow pop-ups to print or save the invoice as PDF."); return }
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((l) => `<link rel="stylesheet" href="${(l as HTMLLinkElement).href}">`).join("")
    const styles = Array.from(document.querySelectorAll("style")).map((s) => s.outerHTML).join("")
    const title = data?.invoice?.number || "Invoice"
    // Copies are separate pages so a roll tears cleanly between them.
    const copies = Array.from({ length: printer.copies }, (_, i) =>
      `<div${i < printer.copies - 1 ? ' style="page-break-after:always"' : ""}>${node.outerHTML}</div>`).join("")
    w.document.open()
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${links}${styles}<style>${pageCss(printer)} body{margin:0}</style></head><body>${copies}</body></html>`)
    w.document.close()
    const go = () => { try { w.focus(); w.print() } catch { /* noop */ } }
    if (w.document.readyState === "complete") setTimeout(go, 400)
    else w.onload = () => setTimeout(go, 250)
  }
  // Ensure the invoice node is mounted (preview open) before printing.
  const openAndPrint = () => { setPreview(true); setTimeout(printInvoice, 400) }

  if (loading && !data) return <div className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-400">Loading invoice…</div>

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Invoice</p>
          <p className="mt-0.5 font-mono text-sm text-slate-800">{number || "Draft — available after Store Audit"}</p>
          {data?.invoice?.issuedAt && <p className="text-[11px] text-slate-400">Generated {fmtDate(data.invoice.issuedAt)}</p>}
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] || STATUS_STYLE.DRAFT}`}>{status}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => setPreview(true)} disabled={!data} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Eye className="h-3.5 w-3.5" /> Preview</button>
        <button onClick={openAndPrint} disabled={!number} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Printer className="h-3.5 w-3.5" /> Print</button>
        <button onClick={openAndPrint} disabled={!number} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><FileDown className="h-3.5 w-3.5" /> Download PDF</button>
        {status === "UNPAID" && (
          <button onClick={markPaid} disabled={marking} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Mark as Paid</button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Download PDF uses your browser&apos;s print dialog — choose &quot;Save as PDF&quot;.</p>

      {/* Payment history — reuses the existing LaundryPayment records (never duplicated). */}
      {data && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Payment History</p>
            {data.totals.balanceDue > 0 && <span className="text-[11px] font-semibold text-amber-700">Balance {inr(data.totals.balanceDue)}</span>}
          </div>
          {data.payments.length > 0 ? (
            <div className="mt-1 space-y-0.5">
              {data.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs text-slate-600">
                  <span>{p.method} · {fmtDate(p.at)}</span>
                  <span className="font-medium text-slate-800">{inr(p.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-400">No payments recorded yet.</p>
          )}
        </div>
      )}

      {preview && data && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 no-print" onClick={() => setPreview(false)}>
          <div className="relative my-6 w-full max-w-3xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="no-print flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-slate-700">Invoice Preview</p>
              <div className="flex gap-2">
                <button onClick={printInvoice} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"><Printer className="h-3.5 w-3.5" /> Print / Save PDF</button>
                <button onClick={() => setPreview(false)} className="rounded-lg p-1.5 hover:bg-slate-50"><X className="h-4 w-4 text-slate-500" /></button>
              </div>
            </div>
            {isRoll(printer)
              ? <div className="flex justify-center bg-slate-100 py-4"><div className="bg-white p-2 shadow-sm"><LaundryThermalReceipt data={data} settings={printer} /></div></div>
              : <LaundryInvoiceDocument data={data} />}
          </div>
        </div>
      )}
    </div>
  )
}
