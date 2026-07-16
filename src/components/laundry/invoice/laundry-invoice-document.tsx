"use client"

// The ONE laundry invoice template. Rendered identically for Admin and Customer
// from the single resolveInvoiceView() payload (src/lib/laundry-invoice.ts).
// Never create a second invoice template. Print/PDF work via the embedded
// print CSS: window.print() shows only #laundry-invoice-print.

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
  settings: { currency: string; businessLogo: string | null; businessAddress: string | null; invoiceFooter: string | null; invoiceTerms: string | null; gstNumber: string | null }
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

  return (
    <div id="laundry-invoice-print" className="bg-white text-slate-800 mx-auto max-w-[720px] p-6 text-sm">
      {/* Print isolation: only the invoice prints. */}
      <style>{`@media print { body { visibility: hidden !important; } #laundry-invoice-print, #laundry-invoice-print * { visibility: visible !important; } #laundry-invoice-print { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; } .no-print { display: none !important; } }`}</style>

      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          {settings.businessLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.businessLogo} alt="" className="h-12 w-12 rounded object-contain" />
          ) : null}
          <div>
            <p className="text-lg font-bold text-slate-900">{store?.name || "Laundry"}</p>
            {settings.businessAddress && <p className="text-xs text-slate-500 whitespace-pre-line">{settings.businessAddress}</p>}
            {gst.enabled && (gst.gstNumber || settings.gstNumber) && <p className="text-xs text-slate-500">GSTIN: {gst.gstNumber || settings.gstNumber}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-slate-900">INVOICE</p>
          <p className="font-mono text-sm text-slate-700">{invoice?.number || "Draft"}</p>
          <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] || STATUS_STYLE.DRAFT}`}>{status}</span>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Bill To</p>
          <p className="font-semibold text-slate-900">{customer?.name || "Walk-in Customer"}</p>
          {customer?.phone && <p className="text-xs text-slate-600">{customer.phone}</p>}
          {customer?.email && <p className="text-xs text-slate-600">{customer.email}</p>}
          {order.pickupAddress && <p className="mt-1 text-xs text-slate-600 whitespace-pre-line">{order.pickupAddress}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-600">Invoice Date: <span className="font-medium text-slate-800">{fmtDate(invoice?.issuedAt || order.createdAt)}</span></p>
          <p className="text-xs text-slate-600">Order #: <span className="font-mono text-slate-800">{order.orderNumber}</span></p>
          {order.pickupDate && <p className="text-xs text-slate-600">Pickup: <span className="text-slate-800">{fmtDate(order.pickupDate)}</span></p>}
        </div>
      </div>

      {/* Items */}
      <table className="mt-5 w-full border-collapse text-sm">
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

      {/* Terms / footer */}
      {(settings.invoiceTerms || settings.invoiceFooter) && (
        <div className="mt-5 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          {settings.invoiceTerms && <p className="whitespace-pre-line">{settings.invoiceTerms}</p>}
          {settings.invoiceFooter && <p className="mt-1 text-center">{settings.invoiceFooter}</p>}
        </div>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-slate-600"><span>{k}</span><span className="text-slate-800">{v}</span></div>
}
