"use client";

// ============================================================================
// Quantix Core — Thermal Receipt Component
// Production thermal receipt with 3 paper sizes: 58mm, 80mm, A4
// GST-compliant, Indian billing standard, monospace formatting
// ============================================================================

import { useMemo } from "react";
import { generateThermalReceipt, numberToWords } from "@/lib/core/pos";
import type { ThermalReceipt } from "@/lib/core/pos";
import { formatCurrency } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface ThermalReceiptOrder {
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
  }>;
  subtotal: number;
  discount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalTax: number;
  deliveryFee?: number;
  packagingFee?: number;
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

export interface ThermalReceiptBusiness {
  name: string;
  address?: string;
  gstNumber?: string;
  phone?: string;
  email?: string;
  fssaiLicense?: string;
  supportPhone?: string;
  tagline?: string;
}

export interface ThermalReceiptStore {
  name?: string;
  address?: string;
  phone?: string;
  code?: string;
}

export interface ThermalReceiptProps {
  order: ThermalReceiptOrder;
  business: ThermalReceiptBusiness;
  store?: ThermalReceiptStore;
  paperSize: "58mm" | "80mm" | "A4";
  showQR?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ThermalReceiptComponent({
  order,
  business,
  store,
  paperSize,
  showQR = false,
  className = "",
}: ThermalReceiptProps) {
  // Generate receipt data using core library
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
      amountInWords: order.amountInWords || numberToWords(Math.round(order.totalAmount)),
      footerMessage: `Thank you for shopping at ${business.name}!`,
    });
  }, [order, business, store, paperSize]);

  // Width mapping
  const widthClass = {
    "58mm": "max-w-[232px]",
    "80mm": "max-w-[320px]",
    "A4": "max-w-[595px]",
  }[paperSize];

  const fontSizeClass = {
    "58mm": "text-[9px] leading-tight",
    "80mm": "text-[10px] leading-tight",
    "A4": "text-[11px] leading-normal",
  }[paperSize];

  const charsPerLine = { "58mm": 32, "80mm": 48, "A4": 80 }[paperSize];

  // Center text helper
  const centerText = (text: string) => {
    if (text.length >= charsPerLine) return text;
    const padding = Math.floor((charsPerLine - text.length) / 2);
    return " ".repeat(padding) + text;
  };

  // Right-align value helper
  const alignRight = (label: string, value: string) => {
    const space = Math.max(1, charsPerLine - label.length - value.length);
    return label + " ".repeat(space) + value;
  };

  // Item name max width
  const nameWidth = { "58mm": 14, "80mm": 22, "A4": 36 }[paperSize];

  return (
    <div
      className={`thermal-print-area is-preview ${widthClass} bg-white border border-dashed border-muted-foreground/30 shadow-sm mx-auto ${className}`}
      data-paper-size={paperSize}
    >
      <div className={`thermal-receipt-content p-3 ${fontSizeClass} space-y-1`}>
        {/* ── Header: Business Info ── */}
        <div className="text-center space-y-0">
          <p className="font-bold text-sm thermal-header-line">{business.name}</p>
          {(store?.address || business.address) && (
            <p className="thermal-header-line text-muted-foreground">
              {store?.address || business.address}
            </p>
          )}
          {business.tagline && (
            <p className="thermal-header-line text-muted-foreground italic">
              {business.tagline}
            </p>
          )}
          {(store?.phone || business.phone) && (
            <p className="thermal-header-line text-muted-foreground">
              Ph: {store?.phone || business.phone}
            </p>
          )}
          {business.email && (
            <p className="thermal-header-line text-muted-foreground">
              {business.email}
            </p>
          )}
          {business.gstNumber && (
            <p className="thermal-header-line text-muted-foreground">
              GSTIN: {business.gstNumber}
            </p>
          )}
          {business.fssaiLicense && (
            <p className="thermal-header-line text-muted-foreground">
              FSSAI: {business.fssaiLicense}
            </p>
          )}
        </div>

        <hr className="thermal-divider" />

        <p className="text-center font-bold thermal-header-line">TAX INVOICE</p>

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

        {/* ── Customer Info (for delivery orders) ── */}
        {order.customerName && order.customerName !== "Walk-in Customer" && (
          <>
            <hr className="thermal-divider" />
            <div className="space-y-0">
              <p className="font-bold">Customer Details:</p>
              <p className="text-muted-foreground">{order.customerName}</p>
              {order.customerPhone && (
                <p className="text-muted-foreground">Ph: {order.customerPhone}</p>
              )}
              {order.customerAddress && (
                <p className="text-muted-foreground text-[8px] break-all">
                  {order.customerAddress}
                </p>
              )}
              {order.customerGst && (
                <p className="text-muted-foreground">GSTIN: {order.customerGst}</p>
              )}
            </div>
          </>
        )}

        <hr className="thermal-divider" />

        {/* ── Item Table ── */}
        <div>
          <div className="flex font-bold uppercase tracking-wide text-muted-foreground" style={{ fontSize: paperSize === "58mm" ? "7px" : "8px" }}>
            <span style={{ flex: 1 }}>Item</span>
            <span className="w-8 text-center">Qty</span>
            <span className="w-14 text-right">Rate</span>
            <span className="w-16 text-right">Amt</span>
          </div>
          <hr className="thermal-divider" />
          {order.items.map((item, idx) => (
            <div key={idx} className="thermal-item-row py-0.5">
              <div className="flex-1 min-w-0">
                <p className="truncate">{item.name}</p>
                {paperSize !== "58mm" && item.hsnCode && (
                  <p className="text-muted-foreground" style={{ fontSize: "7px" }}>
                    HSN: {item.hsnCode} {item.gstRate ? `@ ${item.gstRate}%` : ""}
                  </p>
                )}
              </div>
              <span className="w-8 text-center shrink-0">{item.qty}</span>
              <span className="w-14 text-right shrink-0">{item.rate.toFixed(2)}</span>
              <span className="w-16 text-right shrink-0 font-medium">{item.amount.toFixed(2)}</span>
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
            {order.taxBreakdown.map((tb, idx) => (
              <div key={idx} className="space-y-0">
                {tb.rate > 0 && (
                  <p className="text-muted-foreground" style={{ fontSize: "8px" }}>
                    {"  "}{tb.rate}% on ₹{tb.taxableAmount.toFixed(2)}
                  </p>
                )}
                {tb.cgst > 0 && (
                  <div className="flex justify-between text-muted-foreground" style={{ fontSize: "8px" }}>
                    <span>{"  "}CGST {tb.rate / 2}%</span>
                    <span>{tb.cgst.toFixed(2)}</span>
                  </div>
                )}
                {tb.sgst > 0 && (
                  <div className="flex justify-between text-muted-foreground" style={{ fontSize: "8px" }}>
                    <span>{"  "}SGST {tb.rate / 2}%</span>
                    <span>{tb.sgst.toFixed(2)}</span>
                  </div>
                )}
                {tb.igst > 0 && (
                  <div className="flex justify-between text-muted-foreground" style={{ fontSize: "8px" }}>
                    <span>{"  "}IGST {tb.rate}%</span>
                    <span>{tb.igst.toFixed(2)}</span>
                  </div>
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
        {order.roundOff && order.roundOff !== 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Round Off</span>
            <span>{order.roundOff > 0 ? "+" : ""}{order.roundOff.toFixed(2)}</span>
          </div>
        )}

        <hr className="thermal-double-divider" />

        <div className="flex justify-between font-bold thermal-total-line">
          <span>TOTAL</span>
          <span>{formatCurrency(order.totalAmount)}</span>
        </div>

        <hr className="thermal-double-divider" />

        {/* ── Amount in Words ── */}
        {(order.amountInWords || paperSize !== "58mm") && (
          <p className="text-muted-foreground" style={{ fontSize: "8px" }}>
            Amt in words: {order.amountInWords || numberToWords(Math.round(order.totalAmount))}
          </p>
        )}

        {/* ── Payment Method ── */}
        {order.paymentMethod && (
          <div className="flex justify-between">
            <span>Payment</span>
            <span className="font-medium">{order.paymentMethod}</span>
          </div>
        )}

        {/* ── Footer ── */}
        <hr className="thermal-divider" />

        <div className="text-center space-y-1 mt-2">
          <p className="font-bold">Thank you for your visit!</p>
          <p className="text-muted-foreground" style={{ fontSize: "8px" }}>
            Powered by Quantix Technology
          </p>
          <p className="text-muted-foreground" style={{ fontSize: "8px" }}>
            www.quantixtechnology.in
          </p>
          {business.supportPhone && (
            <p className="text-muted-foreground" style={{ fontSize: "8px" }}>
              Support: {business.supportPhone}
            </p>
          )}
          {business.fssaiLicense && paperSize !== "58mm" && (
            <p className="text-muted-foreground" style={{ fontSize: "7px" }}>
              FSSAI License: {business.fssaiLicense}
            </p>
          )}
        </div>

        {/* ── QR Code Placeholder ── */}
        {showQR && (
          <div className="thermal-qr-placeholder">
            <span>QR Code</span>
          </div>
        )}

        {/* ── Barcode Placeholder ── */}
        <div className="thermal-barcode-placeholder">
          ||| {order.orderNumber} |||
        </div>

        <p className="text-center text-muted-foreground" style={{ fontSize: "7px" }}>
          *** CUSTOMER COPY ***
        </p>
      </div>
    </div>
  );
}
