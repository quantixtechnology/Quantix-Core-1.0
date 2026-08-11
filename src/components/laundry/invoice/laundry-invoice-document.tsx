"use client"

// The ONE laundry invoice template. Rendered identically for Admin and Customer
// from the single resolveInvoiceView() payload (src/lib/laundry-invoice.ts).
// Never create a second invoice template. Prints via a dedicated window (see the
// panel) using this exact markup — so Preview, Print and PDF are identical.
// Shows ONLY tenant/business identity (from the Business Invoice Template) — no
// platform (Quantix) branding.

import { billToBlock, formatPhone } from "@/lib/laundry-bill-to"

export interface InvoiceView {
  invoice: { number: string | null; status: string; issuedAt: string | null; notes: string | null } | null
  order: { orderNumber: string; pickupAddress: string | null; createdAt: string; pickupDate: string | null }
  totals: {
    subtotal: number; gstTotal: number; pickupCharge: number; deliveryCharge: number; expressCharge: number
    discount: number; grandTotal: number; amountPaid: number; balanceDue: number; paymentStatus: string
  }
  gst: { enabled: boolean; amount: number; gstNumber: string | null }
  items: { id: string; serviceName: string; garmentName: string; pricingType: string | null; quantity: number; weightKg: number | null; unitPrice: number; total: number }[]
  payments: { id: string; method: string; amount: number; at: string }[]
  customer: { name: string; phone: string | null; email: string | null } | null
  store: { name: string; address: string | null; city: string | null; state: string | null } | null
  settings: {
    currency: string; businessLogo: string | null; businessName: string | null; businessAddress: string | null
    businessPhone: string | null; businessEmail: string | null; businessWebsite: string | null; primaryColor: string | null
    invoiceFooter: string | null; invoiceTerms: string | null; declaration: string | null; authorizedSignatory: string | null
    signatureUrl: string | null; bankDetails: string | null; upiQr: string | null; gstNumber: string | null
  }
}

const inr = (n: number | null | undefined) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—")

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UNPAID: "bg-amber-50 text-amber-700 border-amber-200",
  DRAFT: "bg-slate-50 text-slate-600 border-slate-200",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
}

export function LaundryInvoiceDocument({ data }: { data: InvoiceView }) {
  const { invoice, order, totals, gst, items, payments, customer, store, settings } = data
  const status = invoice?.status || "DRAFT"
  const charges = (totals.pickupCharge || 0) + (totals.deliveryCharge || 0) + (totals.expressCharge || 0)
  const accent = settings.primaryColor || "#0f172a"
  const businessName = settings.businessName || store?.name || "Laundry"
  const contact = [settings.businessPhone, settings.businessEmail, settings.businessWebsite].filter(Boolean).join(" · ")
  const billTo = billToBlock(customer, order.pickupAddress)

  return (
    <div id="laundry-invoice-print" className="bg-white text-slate-800 mx-auto max-w-[720px] p-6 text-sm">
      {/* Header — tenant identity only (no platform branding). */}
      <div className="flex items-start justify-between border-b-2 pb-3" style={{ borderColor: accent }}>
        {/* Business first, branch second — the hierarchy a chain actually has.
            The logo box is landscape and fits by contain, so a wide logo shows
            edge to edge and a square one is centred, neither one stretched. */}
        <div className="flex items-start gap-3 min-w-0">
          {settings.businessLogo ? (
            <span className="h-14 aspect-[10/3] inline-flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={settings.businessLogo} alt={businessName} className="max-h-full max-w-full object-contain" />
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="text-lg font-bold" style={{ color: accent }}>{businessName}</p>
            {settings.businessAddress && <p className="text-xs text-slate-500 whitespace-pre-line">{settings.businessAddress}</p>}
            {contact && <p className="text-xs text-slate-500">{contact}</p>}
            {gst.enabled && (gst.gstNumber || settings.gstNumber) && <p className="text-xs text-slate-500">GSTIN: {gst.gstNumber || settings.gstNumber}</p>}
            {/* The branch that served this order, beneath the business it
                belongs to — never in its place. */}
            {store?.name && store.name !== businessName && (
              <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-xs text-slate-600">
                <span className="font-semibold">{store.name}</span>
                {[store.address, store.city, store.state].filter(Boolean).length > 0 && (
                  <span className="text-slate-500"> · {[store.address, store.city, store.state].filter(Boolean).join(", ")}</span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-bold" style={{ color: accent }}>INVOICE</p>
          <p className="font-mono text-sm text-slate-700">{invoice?.number || "Draft"}</p>
          <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] || STATUS_STYLE.DRAFT}`}>{status}</span>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-3 grid grid-cols-2 gap-4">
        {/* ONE identity block. billToBlock() removes the snapshot's leading
            "Name · Phone" line and any address line the block has already
            stated — see src/lib/laundry-bill-to.ts. The stored snapshot is
            untouched; only this presentation of it changes. */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Bill To</p>
          <p className="font-semibold text-slate-900">{billTo.name}</p>
          {billTo.phone && <p className="text-xs text-slate-600">{formatPhone(billTo.phone)}</p>}
          {billTo.email && <p className="text-xs text-slate-600">{billTo.email}</p>}
          {billTo.addressLines.length > 0 && (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {billTo.addressLines.map((l, i) => <span key={i} className="block">{l}</span>)}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-600">Invoice Date: <span className="font-medium text-slate-800">{fmtDate(invoice?.issuedAt || order.createdAt)}</span></p>
          <p className="text-xs text-slate-600">Order #: <span className="font-mono text-slate-800">{order.orderNumber}</span></p>
          {order.pickupDate && <p className="text-xs text-slate-600">Pickup: <span className="text-slate-800">{fmtDate(order.pickupDate)}</span></p>}
        </div>
      </div>

      {/* Items */}
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="py-2">Service / Garment</th>
            <th className="py-2 text-center">Qty</th>
            <th className="py-2 text-right">Rate</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-slate-100">
              <td className="py-2"><span className="font-medium text-slate-800">{it.garmentName}</span><span className="text-slate-400"> · {it.serviceName}</span>{it.pricingType === "PER_KG" && <span className="text-[11px] text-amber-600"> (per kg)</span>}</td>
              <td className="py-2 text-center">{it.pricingType === "PER_KG" ? (it.weightKg ? `${it.weightKg} kg` : "—") : it.quantity}</td>
              <td className="py-2 text-right">{inr(it.unitPrice)}</td>
              <td className="py-2 text-right">{inr(it.total)}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-slate-400">No items</td></tr>}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-4 flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          <Row k="Subtotal" v={inr(totals.subtotal)} />
          {charges > 0 && <Row k="Charges" v={inr(charges)} />}
          {totals.discount > 0 && <Row k="Discount" v={`- ${inr(totals.discount)}`} />}
          {gst.enabled && <Row k="GST" v={inr(gst.amount)} />}
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold text-slate-900"><span>Grand Total</span><span>{inr(totals.grandTotal)}</span></div>
          {totals.amountPaid > 0 && <Row k="Paid" v={inr(totals.amountPaid)} />}
          {totals.balanceDue > 0 && <div className="flex justify-between font-semibold text-amber-700"><span>Balance Due</span><span>{inr(totals.balanceDue)}</span></div>}
        </div>
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Payment History</p>
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between text-xs text-slate-600"><span>{p.method} · {fmtDate(p.at)}</span><span>{inr(p.amount)}</span></div>
          ))}
        </div>
      )}

      {/* Bank / UPI (optional) + Authorized signatory */}
      {(settings.bankDetails || settings.upiQr || settings.authorizedSignatory || settings.signatureUrl) && (
        <div className="mt-5 flex items-end justify-between gap-4 border-t border-slate-100 pt-3">
          <div className="text-[11px] text-slate-600">
            {(settings.bankDetails || settings.upiQr) && <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Payment</p>}
            {settings.bankDetails && <p className="mt-1 whitespace-pre-line">{settings.bankDetails}</p>}
            {settings.upiQr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.upiQr} alt="UPI" className="mt-2 h-24 w-24 object-contain" />
            )}
          </div>
          {(settings.authorizedSignatory || settings.signatureUrl) && (
            <div className="text-center text-[11px] text-slate-600">
              {settings.signatureUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.signatureUrl} alt="" className="mx-auto h-12 object-contain" />
              )}
              <div className="mt-1 border-t border-slate-300 pt-1">{settings.authorizedSignatory || "Authorized Signatory"}</div>
            </div>
          )}
        </div>
      )}

      {/* Declaration / Terms / footer */}
      {(settings.declaration || settings.invoiceTerms || settings.invoiceFooter) && (
        <div className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          {settings.declaration && <p className="whitespace-pre-line"><span className="font-semibold text-slate-600">Declaration: </span>{settings.declaration}</p>}
          {settings.invoiceTerms && <p className="mt-1 whitespace-pre-line">{settings.invoiceTerms}</p>}
          {settings.invoiceFooter && <p className="mt-2 text-center">{settings.invoiceFooter}</p>}
        </div>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-slate-600"><span>{k}</span><span className="text-slate-800">{v}</span></div>
}
