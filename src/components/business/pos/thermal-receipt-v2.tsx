"use client";

// ============================================================================
// Quantix Core — Enhanced Thermal Receipt V2
// Optimized for 58mm, 80mm, and A4 paper sizes
// GST invoice format with CGST/SGST split, HSN codes, QR code placeholder
// Bluetooth printer compatible: monochrome, no images, pure CSS
// Browser print optimization: @media print rules, page break handling
// ============================================================================

import { useMemo } from "react";
import { generateThermalReceipt, numberToWords } from "@/lib/core/pos";
import type { ThermalReceipt } from "@/lib/core/pos";
import { formatCurrency } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface ReceiptOrder {
  orderNumber: string;
  date: string;
  time: string;
  cashier?: string;
  items: Array<{
    name: string;
    qty: number;
    rate: number;
    amount: number;
    gstRate?: number;
    hsnCode?: string;
    discount?: number;
    isVeg?: boolean;
    sku?: string;
  }>;
  subtotal: number;
  discount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalTax: number;
  deliveryFee?: number;
  packagingFee?: number;
  convenienceFee?: number;
  totalAmount: number;
  roundOff?: number;
  paymentMethod?: string;
  amountInWords?: string;
  taxBreakdown?: Array<{
    rate: number;
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
  }>;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGst?: string;
}

export interface ReceiptBusiness {
  name: string;
  address?: string;
  gstNumber?: string;
  phone?: string;
  email?: string;
  fssaiLicense?: string;
  supportPhone?: string;
  tagline?: string;
  website?: string;
}

export interface ReceiptStore {
  name?: string;
  address?: string;
  phone?: string;
  code?: string;
}

export interface ThermalReceiptV2Props {
  order: ReceiptOrder;
  business: ReceiptBusiness;
  store?: ReceiptStore;
  paperSize: "58mm" | "80mm" | "A4";
  showQR?: boolean;
  className?: string;
}

// ============================================================================
// Paper size configuration
// ============================================================================

const PAPER_CONFIG = {
  "58mm": {
    widthClass: "max-w-[232px]",
    fontSize: "text-[8px]",
    headingSize: "text-[10px]",
    titleSize: "text-[9px]",
    totalSize: "text-[11px]",
    smallSize: "text-[6px]",
    padding: "p-2",
    charsPerLine: 32,
    itemPadding: "py-px",
    nameMaxWidth: 14,
  },
  "80mm": {
    widthClass: "max-w-[320px]",
    fontSize: "text-[9px]",
    headingSize: "text-[11px]",
    titleSize: "text-[10px]",
    totalSize: "text-[12px]",
    smallSize: "text-[7px]",
    padding: "p-3",
    charsPerLine: 48,
    itemPadding: "py-0.5",
    nameMaxWidth: 22,
  },
  A4: {
    widthClass: "max-w-[595px]",
    fontSize: "text-[10px]",
    headingSize: "text-sm",
    titleSize: "text-xs",
    totalSize: "text-base",
    smallSize: "text-[8px]",
    padding: "p-6",
    charsPerLine: 80,
    itemPadding: "py-1",
    nameMaxWidth: 36,
  },
} as const;

// ============================================================================
// Component
// ============================================================================

export function ThermalReceiptV2({
  order,
  business,
  store,
  paperSize,
  showQR = false,
  className = "",
}: ThermalReceiptV2Props) {
  const config = PAPER_CONFIG[paperSize];

  // Generate receipt data for text export
  const receipt = useMemo<ThermalReceipt>(() => {
    return generateThermalReceipt({
      orderNumber: order.orderNumber,
      date: `${order.date} ${order.time}`,
      items: order.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        price: item.rate,
        total: item.amount,
        gstRate: item.gstRate,
        hsnCode: item.hsnCode,
      })),
      subtotal: order.subtotal,
      totalTax: order.totalTax,
      totalAmount: order.totalAmount,
      cgst: order.cgst,
      sgst: order.sgst,
      igst: order.igst,
      discount: order.discount,
      deliveryFee: order.deliveryFee,
      packagingFee: order.packagingFee,
      convenienceFee: order.convenienceFee,
      roundOff: order.roundOff,
      businessName: business.name,
      businessAddress: store?.address || business.address,
      businessGst: business.gstNumber,
      businessPhone: store?.phone || business.phone,
      businessEmail: business.email,
      businessFssai: business.fssaiLicense,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerGst: order.customerGst,
      paymentMethod: order.paymentMethod,
      paperSize,
      taxBreakdown: order.taxBreakdown,
      amountInWords:
        order.amountInWords || numberToWords(Math.round(order.totalAmount)),
      footerMessage: `Thank you for shopping at ${business.name}!`,
    });
  }, [order, business, store, paperSize]);

  const isA4 = paperSize === "A4";
  const is58mm = paperSize === "58mm";

  return (
    <div
      className={`thermal-print-area is-preview ${config.widthClass} bg-white border border-dashed border-muted-foreground/30 shadow-sm mx-auto ${className}`}
      data-paper-size={paperSize}
      data-receipt-raw={receipt.rawText}
    >
      <div
        className={`thermal-receipt-content ${config.padding} ${config.fontSize} space-y-1 font-mono leading-tight`}
      >
        {/* ── Header: Business Info ── */}
        <div className="text-center space-y-0">
          <p className={`font-bold ${config.headingSize} thermal-header-line`}>
            {business.name}
          </p>
          {(store?.address || business.address) && (
            <p className="thermal-header-line text-muted-foreground">
              {store?.address || business.address}
            </p>
          )}
          {business.tagline && !is58mm && (
            <p className="thermal-header-line text-muted-foreground italic">
              {business.tagline}
            </p>
          )}
          {(store?.phone || business.phone) && (
            <p className="thermal-header-line text-muted-foreground">
              Ph: {store?.phone || business.phone}
            </p>
          )}
          {business.email && !is58mm && (
            <p className="thermal-header-line text-muted-foreground">
              {business.email}
            </p>
          )}
          {business.gstNumber && (
            <p className="thermal-header-line text-muted-foreground font-semibold">
              GSTIN: {business.gstNumber}
            </p>
          )}
          {business.fssaiLicense && !is58mm && (
            <p className="thermal-header-line text-muted-foreground">
              FSSAI: {business.fssaiLicense}
            </p>
          )}
        </div>

        <hr className="thermal-divider" />

        <p
          className={`text-center font-bold ${config.titleSize} thermal-header-line`}
        >
          TAX INVOICE
        </p>

        <hr className="thermal-double-divider" />

        {/* ── Invoice Info ── */}
        <div className="space-y-0">
          <div className="flex justify-between">
            <span>Bill No:</span>
            <span className="font-bold">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Date:</span>
            <span>{order.date}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Time:</span>
            <span>{order.time}</span>
          </div>
          {order.cashier && (
            <div className="flex justify-between text-muted-foreground">
              <span>Cashier:</span>
              <span>{order.cashier}</span>
            </div>
          )}
          {store?.code && (
            <div className="flex justify-between text-muted-foreground">
              <span>Counter:</span>
              <span>{store.code}</span>
            </div>
          )}
        </div>

        {/* ── Customer Info ── */}
        {order.customerName && order.customerName !== "Walk-in Customer" && (
          <>
            <hr className="thermal-divider" />
            <div className="space-y-0">
              <p className="font-bold">Customer Details:</p>
              <p className="text-muted-foreground">{order.customerName}</p>
              {order.customerPhone && (
                <p className="text-muted-foreground">
                  Ph: {order.customerPhone}
                </p>
              )}
              {order.customerAddress && (
                <p className="text-muted-foreground break-all" style={{ fontSize: is58mm ? "6px" : "7px" }}>
                  {order.customerAddress}
                </p>
              )}
              {order.customerGst && (
                <p className="text-muted-foreground">
                  GSTIN: {order.customerGst}
                </p>
              )}
            </div>
          </>
        )}

        <hr className="thermal-divider" />

        {/* ── Item Table ── */}
        <div>
          <div
            className="flex font-bold uppercase tracking-wide text-muted-foreground"
            style={{ fontSize: is58mm ? "6px" : isA4 ? "8px" : "7px" }}
          >
            <span style={{ flex: 1 }}>Item</span>
            {!is58mm && <span className="w-10 text-center">HSN</span>}
            <span className="w-8 text-center">Qty</span>
            <span className="w-14 text-right">Rate</span>
            <span className="w-16 text-right">Amt</span>
          </div>
          <hr className="thermal-divider" />
          {order.items.map((item, idx) => (
            <div key={idx} className={`thermal-item-row ${config.itemPadding}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  {item.isVeg !== undefined && (
                    <span
                      className={`inline-block w-2 h-2 border ${
                        item.isVeg
                          ? "border-green-600 bg-green-600"
                          : "border-red-600 bg-red-600"
                      }`}
                      style={{ borderRadius: "1px" }}
                    />
                  )}
                  <p className="truncate">{item.name}</p>
                </div>
                {!is58mm && item.hsnCode && (
                  <p
                    className="text-muted-foreground"
                    style={{ fontSize: is58mm ? "5px" : "6px" }}
                  >
                    HSN: {item.hsnCode}
                    {item.gstRate ? ` @ ${item.gstRate}%` : ""}
                    {item.sku ? ` | SKU: ${item.sku}` : ""}
                  </p>
                )}
              </div>
              {!is58mm && (
                <span className="w-10 text-center shrink-0 text-muted-foreground" style={{ fontSize: "6px" }}>
                  {item.hsnCode || "-"}
                </span>
              )}
              <span className="w-8 text-center shrink-0">{item.qty}</span>
              <span className="w-14 text-right shrink-0">
                {item.rate.toFixed(2)}
              </span>
              <span className="w-16 text-right shrink-0 font-medium">
                {item.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <hr className="thermal-divider" />

        {/* ── Totals ── */}
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{order.subtotal.toFixed(2)}</span>
          </div>
          {order.discount && order.discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Discount</span>
              <span>-{order.discount.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* ── GST Breakdown ── */}
        {order.taxBreakdown && order.taxBreakdown.length > 0 ? (
          <div className="space-y-0.5">
            <p className="font-bold text-center mt-1">Tax Breakdown</p>
            {/* Table header for A4 */}
            {isA4 && (
              <div
                className="flex font-bold uppercase text-muted-foreground"
                style={{ fontSize: "7px" }}
              >
                <span className="w-12">Rate</span>
                <span className="flex-1 text-right">Taxable</span>
                <span className="w-14 text-right">CGST</span>
                <span className="w-14 text-right">SGST</span>
                <span className="w-14 text-right">IGST</span>
                <span className="w-14 text-right">Total</span>
              </div>
            )}
            {order.taxBreakdown.map((tb, idx) => (
              <div key={idx} className="space-y-0">
                {isA4 ? (
                  /* A4: Table row format */
                  <div className="flex text-muted-foreground" style={{ fontSize: "7px" }}>
                    <span className="w-12">{tb.rate}%</span>
                    <span className="flex-1 text-right">{tb.taxableAmount.toFixed(2)}</span>
                    <span className="w-14 text-right">{tb.cgst > 0 ? tb.cgst.toFixed(2) : "-"}</span>
                    <span className="w-14 text-right">{tb.sgst > 0 ? tb.sgst.toFixed(2) : "-"}</span>
                    <span className="w-14 text-right">{tb.igst > 0 ? tb.igst.toFixed(2) : "-"}</span>
                    <span className="w-14 text-right">{tb.totalTax.toFixed(2)}</span>
                  </div>
                ) : (
                  /* 58mm/80mm: Compact format */
                  <>
                    {tb.rate > 0 && (
                      <p className="text-muted-foreground" style={{ fontSize: "7px" }}>
                        {"  "}{tb.rate}% on ₹{tb.taxableAmount.toFixed(2)}
                      </p>
                    )}
                    {tb.cgst > 0 && (
                      <div className="flex justify-between text-muted-foreground" style={{ fontSize: "7px" }}>
                        <span>{"  "}CGST {tb.rate / 2}%</span>
                        <span>{tb.cgst.toFixed(2)}</span>
                      </div>
                    )}
                    {tb.sgst > 0 && (
                      <div className="flex justify-between text-muted-foreground" style={{ fontSize: "7px" }}>
                        <span>{"  "}SGST {tb.rate / 2}%</span>
                        <span>{tb.sgst.toFixed(2)}</span>
                      </div>
                    )}
                    {tb.igst > 0 && (
                      <div className="flex justify-between text-muted-foreground" style={{ fontSize: "7px" }}>
                        <span>{"  "}IGST {tb.rate}%</span>
                        <span>{tb.igst.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {order.cgst && order.cgst > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>CGST</span>
                <span>{order.cgst.toFixed(2)}</span>
              </div>
            )}
            {order.sgst && order.sgst > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>SGST</span>
                <span>{order.sgst.toFixed(2)}</span>
              </div>
            )}
            {order.igst && order.igst > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>IGST</span>
                <span>{order.igst.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Fees ── */}
        {order.deliveryFee && order.deliveryFee > 0 && (
          <div className="flex justify-between">
            <span>Delivery Fee</span>
            <span>{order.deliveryFee.toFixed(2)}</span>
          </div>
        )}
        {order.packagingFee && order.packagingFee > 0 && (
          <div className="flex justify-between">
            <span>Packaging Fee</span>
            <span>{order.packagingFee.toFixed(2)}</span>
          </div>
        )}
        {order.convenienceFee && order.convenienceFee > 0 && (
          <div className="flex justify-between">
            <span>Convenience Fee</span>
            <span>{order.convenienceFee.toFixed(2)}</span>
          </div>
        )}
        {order.roundOff && order.roundOff !== 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Round Off</span>
            <span>
              {order.roundOff > 0 ? "+" : ""}
              {order.roundOff.toFixed(2)}
            </span>
          </div>
        )}

        <hr className="thermal-double-divider" />

        <div
          className={`flex justify-between font-bold thermal-total-line ${config.totalSize}`}
        >
          <span>TOTAL</span>
          <span>{formatCurrency(order.totalAmount)}</span>
        </div>

        <hr className="thermal-double-divider" />

        {/* ── Amount in Words ── */}
        {(order.amountInWords || !is58mm) && (
          <p className="text-muted-foreground" style={{ fontSize: "7px" }}>
            Amt in words:{" "}
            {order.amountInWords ||
              numberToWords(Math.round(order.totalAmount))}
          </p>
        )}

        {/* ── Payment Method ── */}
        {order.paymentMethod && (
          <div className="flex justify-between">
            <span>Payment</span>
            <span className="font-medium">{order.paymentMethod}</span>
          </div>
        )}

        {/* ── QR Code Placeholder ── */}
        {showQR && (
          <div className="thermal-qr-placeholder">
            <span>Scan QR</span>
          </div>
        )}

        {/* ── Footer ── */}
        <hr className="thermal-divider" />

        <div className="text-center space-y-1 mt-2">
          <p className="font-bold">Thank you for your visit!</p>
          {business.supportPhone && (
            <p className="text-muted-foreground" style={{ fontSize: "7px" }}>
              Support: {business.supportPhone}
            </p>
          )}
          <p className="text-muted-foreground" style={{ fontSize: "7px" }}>
            Powered by Quantix Technology
          </p>
          <p className="text-muted-foreground" style={{ fontSize: "7px" }}>
            {business.website || "www.quantixtechnology.in"}
          </p>
          {business.fssaiLicense && is58mm && (
            <p className="text-muted-foreground" style={{ fontSize: "6px" }}>
              FSSAI: {business.fssaiLicense}
            </p>
          )}
        </div>

        {/* ── Barcode Placeholder ── */}
        <div className="thermal-barcode-placeholder">
          ||| {order.orderNumber} |||
        </div>

        <p
          className="text-center text-muted-foreground"
          style={{ fontSize: "6px" }}
        >
          *** CUSTOMER COPY ***
        </p>
      </div>
    </div>
  );
}
