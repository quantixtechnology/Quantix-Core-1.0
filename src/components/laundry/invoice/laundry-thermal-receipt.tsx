"use client"

// The narrow-roll rendering of an invoice, for 58mm / 80mm / custom thermal
// paper. NOT a second invoice: it takes the same InvoiceView payload the A4
// template takes, so the numbers, the line items and the totals are the ones
// resolveInvoiceView() already produced. Only the arrangement differs, because
// a 58mm roll cannot hold a four-column table.
//
// This component is used BOTH by the settings preview and by the real print, so
// what an owner sees while configuring is what comes out of the printer.

import { billToBlock, formatPhone } from "@/lib/laundry-bill-to"
import { printableWidthMm } from "@/lib/laundry-printer"
import { formatPrintedAt, PRINTED_ON_LABEL } from "@/lib/print-timestamp"
import type { PrinterSettings } from "@/lib/laundry-printer"
import type { InvoiceView } from "./laundry-invoice-document"

const inr = (n: number | null | undefined) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—")

function Rule() {
  return <div className="my-1 border-t border-dashed border-black/40" />
}

export function LaundryThermalReceipt({ data, settings, printedAt }: { data: InvoiceView; settings: PrinterSettings; printedAt?: number }) {
  const { invoice, order, totals, gst, items, customer, store, settings: tenant } = data
  const widthMm = printableWidthMm(settings) ?? 72
  const billTo = billToBlock(customer, order.pickupAddress)
  const businessName = tenant.businessName || store?.name || "Laundry"
  // 58mm is genuinely cramped; a step down in type is what makes it legible.
  const base = widthMm < 60 ? "text-[9px]" : "text-[10px]"

  return (
    <div
      id="laundry-thermal-print"
      className={`bg-white font-mono text-black ${base} leading-tight`}
      // Physical width in mm — the same value the @page rule uses, so the
      // preview is a true representation rather than an approximation.
      style={{ width: `${widthMm}mm` }}
    >
      <div className="text-center">
        {settings.headerText.trim() && <div className="whitespace-pre-line font-bold uppercase">{settings.headerText.trim()}</div>}
        <div className="text-[13px] font-bold uppercase leading-tight">{businessName}</div>
        {store?.name && store.name !== businessName && <div className="uppercase">{store.name}</div>}
        {tenant.businessPhone && <div>{formatPhone(tenant.businessPhone)}</div>}
        {gst.enabled && (gst.gstNumber || tenant.gstNumber) && <div>GSTIN: {gst.gstNumber || tenant.gstNumber}</div>}
      </div>

      <Rule />

      {/* The invoice number is the one thing that must never wrap. */}
      <div className="whitespace-nowrap font-bold">{invoice?.number || "Draft"}</div>
      <div>Date: {fmtDate(invoice?.issuedAt || order.createdAt)}</div>
      <div>Order: {order.orderNumber}</div>

      <div className="mt-1">Customer:</div>
      <div className="font-bold">{billTo.name}</div>
      {billTo.phone && <div>{formatPhone(billTo.phone)}</div>}

      <Rule />

      <div className="flex font-bold uppercase">
        <span className="flex-1">Service</span>
        <span className="w-12 text-right">Qty</span>
        <span className="w-16 text-right">Amount</span>
      </div>
      <Rule />

      {items.map((it) => (
        <div key={it.id} className="flex">
          {/* break-all so a long garment name wraps inside its column instead of
              pushing the amount off the roll. */}
          <span className="flex-1 break-all pr-1">{it.garmentName}</span>
          <span className="w-12 shrink-0 text-right">{it.pricingType === "PER_KG" ? (it.weightKg ? `${it.weightKg}kg` : "—") : it.quantity}</span>
          <span className="w-16 shrink-0 text-right">{inr(it.total)}</span>
        </div>
      ))}
      {items.length === 0 && <div className="text-center">No items</div>}

      <Rule />

      <Line k="Subtotal" v={inr(totals.subtotal)} />
      {gst.enabled && totals.gstTotal > 0 && <Line k="GST" v={inr(totals.gstTotal)} />}
      {totals.pickupCharge > 0 && <Line k="Pickup" v={inr(totals.pickupCharge)} />}
      {totals.deliveryCharge > 0 && <Line k="Delivery" v={inr(totals.deliveryCharge)} />}
      {totals.expressCharge > 0 && <Line k="Express" v={inr(totals.expressCharge)} />}
      {totals.discount > 0 && <Line k="Discount" v={`-${inr(totals.discount)}`} />}
      <Rule />
      <Line k="GRAND TOTAL" v={inr(totals.grandTotal)} bold />
      {totals.amountPaid > 0 && <Line k="PAID" v={inr(totals.amountPaid)} />}
      {totals.balanceDue > 0 && <Line k="BALANCE DUE" v={inr(totals.balanceDue)} bold />}

      {settings.includeQr && tenant.upiQr && (
        <div className="mt-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tenant.upiQr} alt="" className="mx-auto" style={{ width: `${Math.min(widthMm * 0.55, 30)}mm` }} />
          <div>Scan to pay</div>
        </div>
      )}

      <Rule />
      <div className="whitespace-pre-line text-center">
        {settings.footerText.trim() || tenant.invoiceFooter || "Thank You"}
      </div>
      {/* On a 58mm roll the label and the value will not share a line, so they
          are stacked rather than allowed to wrap mid-timestamp. */}
      <div className="pb-2 text-center text-[8px] leading-tight">
        <div>{PRINTED_ON_LABEL}:</div>
        <div className="whitespace-nowrap">{formatPrintedAt(printedAt)}</div>
      </div>
    </div>
  )
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{k}</span>
      <span className="whitespace-nowrap">{v}</span>
    </div>
  )
}
