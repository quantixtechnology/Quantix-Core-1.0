"use client"

import { useEffect, useState, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store";
import { formatINR } from "@/lib/currency"
import { ChevronRight, Printer, Loader2, AlertCircle } from "lucide-react"

interface InvoiceItem {
  id: string
  itemName: string
  variantName: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  gstRate: number
  gstAmount: number
}

interface InvoiceDetail {
  id: string
  invoiceNumber: string
  invoiceType: string
  subtotal: number
  totalTax: number
  totalDiscount: number
  totalAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  paidAmount: number
  notes: string | null
  status: string
  paidAt: string | null
  dueDate: string | null
  createdAt: string
  order: {
    orderNumber: string
    deliveredAt: string | null
    customerName: string | null
    customerPhone: string | null
    deliveryAddress: string | null
    items: InvoiceItem[]
  } | null
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-1.5 ${bold ? "font-semibold text-gray-900" : "text-gray-600"}`}>
      <span className="text-sm">{label}</span>
      <span className={`text-sm ${bold ? "text-base font-bold" : ""}`}>{value}</span>
    </div>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export function CustomerInvoiceDetail() {
  const { currentBusinessPrimaryColor, popCustomerPage, selectedInvoiceId } = useAdminStore()
  const { token } = useAuthStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInvoice = useCallback(async () => {
    if (!token || !selectedInvoiceId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/core/storefront/customer/invoices/${selectedInvoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) setInvoice(json.data)
      else setError(json.error || "Failed to load invoice")
    } catch {
      setError("Failed to load invoice")
    } finally {
      setLoading(false)
    }
  }, [token, selectedInvoiceId])

  useEffect(() => { fetchInvoice() }, [fetchInvoice])

  const handlePrint = () => {
    if (!invoice) return
    const items = invoice.order?.items ?? []
    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<title>Invoice ${invoice.invoiceNumber}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; max-width: 600px; margin: 0 auto; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 12px; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 6px 4px; font-size: 11px; color: #666; border-bottom: 1px solid #e5e7eb; }
  td { padding: 6px 4px; font-size: 12px; border-bottom: 1px solid #f3f4f6; }
  .right { text-align: right; }
  .total-row td { font-weight: bold; font-size: 14px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; }
  .paid { background: #d1fae5; color: #065f46; }
  .pending { background: #fef3c7; color: #92400e; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<h1>Tax Invoice</h1>
<p class="sub">Invoice No: <strong>${invoice.invoiceNumber}</strong></p>
<p class="sub">Date: ${formatDate(invoice.createdAt)}</p>
${invoice.order ? `<p class="sub">Order: #${invoice.order.orderNumber}</p>` : ""}
<p class="sub">Status: <span class="badge ${invoice.status === "paid" ? "paid" : "pending"}">${invoice.status.toUpperCase()}</span></p>
<hr class="divider"/>
<table>
  <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
  <tbody>
    ${items.map((item) => `
    <tr>
      <td>${item.itemName}${item.variantName ? ` (${item.variantName})` : ""}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">${formatINR(item.unitPrice)}</td>
      <td class="right">${formatINR(item.totalPrice)}</td>
    </tr>`).join("")}
  </tbody>
</table>
<hr class="divider"/>
<table>
  <tr><td>Subtotal</td><td class="right">${formatINR(invoice.subtotal)}</td></tr>
  ${invoice.totalDiscount > 0 ? `<tr><td>Discount</td><td class="right">-${formatINR(invoice.totalDiscount)}</td></tr>` : ""}
  ${invoice.cgstAmount > 0 ? `<tr><td>CGST</td><td class="right">${formatINR(invoice.cgstAmount)}</td></tr>` : ""}
  ${invoice.sgstAmount > 0 ? `<tr><td>SGST</td><td class="right">${formatINR(invoice.sgstAmount)}</td></tr>` : ""}
  ${invoice.igstAmount > 0 ? `<tr><td>IGST</td><td class="right">${formatINR(invoice.igstAmount)}</td></tr>` : ""}
  <tr class="total-row"><td>Total</td><td class="right">${formatINR(invoice.totalAmount)}</td></tr>
  ${invoice.paidAmount > 0 ? `<tr><td>Paid</td><td class="right">${formatINR(invoice.paidAmount)}</td></tr>` : ""}
  ${invoice.status === "pending" ? `<tr><td><strong>Balance Due</strong></td><td class="right"><strong>${formatINR(invoice.totalAmount - invoice.paidAmount)}</strong></td></tr>` : ""}
</table>
${invoice.notes ? `<hr class="divider"/><p class="sub">Notes: ${invoice.notes}</p>` : ""}
</body></html>`

    const win = window.open("", "_blank")
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      win.print()
    }
  }

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => popCustomerPage()} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 -ml-1">
            <ChevronRight className="w-5 h-5 text-gray-500 rotate-180" />
          </button>
          <div>
            <h1 className="text-[17px] font-bold text-gray-900 leading-none">Invoice Detail</h1>
            {invoice && <p className="text-[11px] text-gray-400 mt-0.5">{invoice.invoiceNumber}</p>}
          </div>
        </div>
        {invoice && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 active:opacity-70"
          >
            <Printer className="w-4 h-4 text-gray-500" />
            Print
          </button>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: brandColor }} />
          <p className="text-sm text-gray-400">Loading invoice...</p>
        </div>
      )}

      {!loading && error && (
        <div className="mx-4 mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && invoice && (
        <div className="px-4 space-y-3">
          {/* Status banner */}
          <div className={`rounded-2xl p-4 ${invoice.status === "paid" ? "bg-emerald-50 border border-emerald-100" : "bg-amber-50 border border-amber-100"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide ${invoice.status === "paid" ? "text-emerald-600" : "text-amber-600"}`}>
                  {invoice.status === "paid" ? "Invoice Paid" : "Payment Pending"}
                </p>
                <p className="text-2xl font-extrabold mt-1 text-gray-900">{formatINR(invoice.totalAmount)}</p>
              </div>
              <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${invoice.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {invoice.status.toUpperCase()}
              </span>
            </div>
            {invoice.status === "paid" && invoice.paidAt && (
              <p className="text-[11px] text-emerald-600 mt-1.5">Paid on {formatDate(invoice.paidAt)}</p>
            )}
            {invoice.status === "pending" && invoice.dueDate && (
              <p className="text-[11px] text-amber-600 mt-1.5">Due by {formatDate(invoice.dueDate)}</p>
            )}
          </div>

          {/* Invoice meta */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-0.5">
            <Row label="Invoice Number" value={invoice.invoiceNumber} />
            <Row label="Invoice Date" value={formatDate(invoice.createdAt)} />
            {invoice.order && <Row label="Order Number" value={`#${invoice.order.orderNumber}`} />}
            {invoice.order?.deliveredAt && <Row label="Delivered On" value={formatDate(invoice.order.deliveredAt)} />}
          </div>

          {/* Items */}
          {invoice.order?.items && invoice.order.items.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-800">Items</p>
              </div>
              {invoice.order.items.map((item, idx) => (
                <div key={item.id} className={`px-4 py-3 flex items-center justify-between ${idx > 0 ? "border-t border-gray-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {item.itemName}
                      {item.variantName && <span className="text-gray-400 font-normal"> · {item.variantName}</span>}
                    </p>
                    <p className="text-[11px] text-gray-400">{formatINR(item.unitPrice)} × {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 shrink-0 ml-3">{formatINR(item.totalPrice)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Amounts */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <Row label="Subtotal" value={formatINR(invoice.subtotal)} />
            {invoice.totalDiscount > 0 && <Row label="Discount" value={`-${formatINR(invoice.totalDiscount)}`} />}
            {invoice.cgstAmount > 0 && <Row label="CGST" value={formatINR(invoice.cgstAmount)} />}
            {invoice.sgstAmount > 0 && <Row label="SGST" value={formatINR(invoice.sgstAmount)} />}
            {invoice.igstAmount > 0 && <Row label="IGST" value={formatINR(invoice.igstAmount)} />}
            <div className="border-t border-gray-100 mt-2 pt-2">
              <Row label="Total Amount" value={formatINR(invoice.totalAmount)} bold />
            </div>
            {invoice.paidAmount > 0 && <Row label="Amount Paid" value={formatINR(invoice.paidAmount)} />}
            {invoice.status === "pending" && invoice.totalAmount > invoice.paidAmount && (
              <Row label="Balance Due" value={formatINR(invoice.totalAmount - invoice.paidAmount)} bold />
            )}
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-700">{invoice.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
