"use client"

import { forwardRef } from "react"
import { resolveImageUrl } from "@/lib/image-url"

export interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  amount: number
  hsnCode?: string
}

export interface DocumentData {
  documentNumber: string
  documentType: string
  status: string
  amount: number
  currency: string
  gstRate: number | null
  cgstAmount: number | null
  sgstAmount: number | null
  igstAmount: number | null
  totalWithGst: number | null
  lineItems: LineItem[]
  notes: string | null
  validUntil: string | null
  issuedDate: string | null
  paidDate: string | null
  createdAt: string
  createdByName: string | null
}

export interface Letterhead {
  name: string
  logo: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  gstNumber: string | null
  contactEmail: string | null
  contactPhone: string | null
}

interface Props {
  document: DocumentData
  letterhead: Letterhead
  clientName: string
  clientGst?: string | null
  clientEmail?: string | null
}

const DOC_META: Record<string, { title: string; headerBg: string; accent: string; accentText: string }> = {
  PROFORMA:        { title: "PROFORMA INVOICE",  headerBg: "#075985", accent: "#e0f2fe", accentText: "#075985" },
  TAX_INVOICE:     { title: "TAX INVOICE",        headerBg: "#065f46", accent: "#d1fae5", accentText: "#065f46" },
  PAYMENT_RECEIPT: { title: "PAYMENT RECEIPT",    headerBg: "#134e4a", accent: "#ccfbf1", accentText: "#134e4a" },
  CREDIT_NOTE:     { title: "CREDIT NOTE",        headerBg: "#4c1d95", accent: "#ede9fe", accentText: "#4c1d95" },
  DEBIT_NOTE:      { title: "DEBIT NOTE",         headerBg: "#9a3412", accent: "#ffedd5", accentText: "#9a3412" },
  ADJUSTMENT_NOTE: { title: "ADJUSTMENT NOTE",    headerBg: "#78350f", accent: "#fef3c7", accentText: "#78350f" },
}

function fmt(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
}

function cur(v: number | null | undefined, fallback = 0) {
  return `₹${(v ?? fallback).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const DocumentRenderer = forwardRef<HTMLDivElement, Props>(
  ({ document: doc, letterhead, clientName, clientGst, clientEmail }, ref) => {
    const meta = DOC_META[doc.documentType] ?? DOC_META.PROFORMA
    const subtotal = doc.amount
    const total = doc.totalWithGst ?? doc.amount
    const hasGst = (doc.cgstAmount ?? 0) > 0 || (doc.sgstAmount ?? 0) > 0 || (doc.igstAmount ?? 0) > 0
    const hasHsn = doc.lineItems.some(i => i.hsnCode)

    const cell: React.CSSProperties = { padding: "9px 12px", borderBottom: "1px solid #f0f0f0", fontSize: "12px", verticalAlign: "top" }
    const thCell: React.CSSProperties = { padding: "9px 12px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.3px" }

    return (
      <div
        ref={ref}
        id="doc-print-root"
        style={{
          fontFamily: "'Segoe UI', Arial, sans-serif",
          fontSize: "12px",
          color: "#111",
          background: "white",
          width: "100%",
          maxWidth: "760px",
          margin: "0 auto",
          padding: "36px 40px",
          boxSizing: "border-box",
        }}
      >
        {/* ── HEADER ── */}
        <div style={{ background: meta.headerBg, borderRadius: "8px", padding: "22px 28px", marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px" }}>
          {/* Left: issuer */}
          <div style={{ color: "white", flex: 1 }}>
            {letterhead.logo && (
              <img
                src={resolveImageUrl(letterhead.logo)}
                alt="Logo"
                style={{ height: "36px", marginBottom: "10px", objectFit: "contain", display: "block" }}
              />
            )}
            <div style={{ fontWeight: 700, fontSize: "17px", lineHeight: "1.2" }}>{letterhead.name}</div>
            {(letterhead.address || letterhead.city) && (
              <div style={{ fontSize: "11px", marginTop: "5px", opacity: 0.85, lineHeight: "1.4" }}>
                {[letterhead.address, letterhead.city, letterhead.state, letterhead.pincode].filter(Boolean).join(", ")}
              </div>
            )}
            {letterhead.gstNumber && (
              <div style={{ fontSize: "11px", marginTop: "3px", opacity: 0.8 }}>GSTIN: {letterhead.gstNumber}</div>
            )}
            {letterhead.contactEmail && (
              <div style={{ fontSize: "10px", marginTop: "2px", opacity: 0.75 }}>{letterhead.contactEmail}</div>
            )}
          </div>

          {/* Right: doc type + number */}
          <div style={{ textAlign: "right", color: "white", flexShrink: 0 }}>
            <div style={{ fontWeight: 800, fontSize: "18px", letterSpacing: "1px", textTransform: "uppercase" }}>{meta.title}</div>
            <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "14px", marginTop: "6px", background: "rgba(255,255,255,0.18)", borderRadius: "5px", padding: "4px 10px", display: "inline-block" }}>
              {doc.documentNumber}
            </div>
          </div>
        </div>

        {/* ── BILL-TO + META ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
          {/* Bill To */}
          <div style={{ background: meta.accent, borderRadius: "6px", padding: "16px 18px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: meta.accentText, marginBottom: "8px" }}>Bill To</div>
            <div style={{ fontWeight: 700, fontSize: "14px", lineHeight: "1.3" }}>{clientName}</div>
            {clientGst && <div style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>GSTIN: {clientGst}</div>}
            {clientEmail && <div style={{ fontSize: "11px", color: "#555", marginTop: "3px" }}>{clientEmail}</div>}
          </div>

          {/* Document meta */}
          <div style={{ background: "#f9fafb", borderRadius: "6px", padding: "16px 18px" }}>
            {[
              { label: "Issue Date",   value: fmt(doc.issuedDate || doc.createdAt)                            },
              ...(doc.documentType === "PROFORMA" && doc.validUntil
                ? [{ label: "Valid Until", value: fmt(doc.validUntil), warn: new Date(doc.validUntil) < new Date() }]
                : []
              ),
              ...(doc.paidDate
                ? [{ label: doc.documentType === "PAYMENT_RECEIPT" ? "Receipt Date" : "Paid On", value: fmt(doc.paidDate) }]
                : []
              ),
              { label: "Status", value: doc.status, badge: true },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #eee", fontSize: "12px" }}>
                <span style={{ color: "#666", fontSize: "11px" }}>{row.label}</span>
                {row.badge
                  ? <span style={{ background: meta.headerBg, color: "white", borderRadius: "4px", padding: "2px 8px", fontSize: "10px", fontWeight: 600 }}>{row.value}</span>
                  : <span style={{ fontWeight: 600, color: (row as { warn?: boolean }).warn ? "#dc2626" : "inherit" }}>{row.value}</span>
                }
              </div>
            ))}
          </div>
        </div>

        {/* ── LINE ITEMS ── */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
          <thead>
            <tr style={{ background: meta.headerBg, color: "white" }}>
              <th style={{ ...thCell, borderRadius: "5px 0 0 0", width: "36px" }}>#</th>
              <th style={{ ...thCell }}>Description</th>
              {hasHsn && <th style={{ ...thCell, textAlign: "center", width: "80px" }}>HSN/SAC</th>}
              <th style={{ ...thCell, textAlign: "right", width: "60px" }}>Qty</th>
              <th style={{ ...thCell, textAlign: "right", width: "100px" }}>Rate</th>
              <th style={{ ...thCell, textAlign: "right", borderRadius: "0 5px 0 0", width: "110px" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.lineItems.length === 0 ? (
              <tr>
                <td colSpan={hasHsn ? 6 : 5} style={{ ...cell, textAlign: "center", color: "#888", padding: "18px" }}>
                  {doc.documentType === "PAYMENT_RECEIPT" ? "Payment received in full" : "Service / charge"}
                </td>
              </tr>
            ) : doc.lineItems.map((item, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? "white" : "#fafafa" }}>
                <td style={{ ...cell, color: "#999", textAlign: "center", width: "36px" }}>{idx + 1}</td>
                <td style={{ ...cell }}>{item.description}</td>
                {hasHsn && <td style={{ ...cell, textAlign: "center", color: "#888" }}>{item.hsnCode ?? "—"}</td>}
                <td style={{ ...cell, textAlign: "right" }}>{item.quantity}</td>
                <td style={{ ...cell, textAlign: "right" }}>{cur(item.unitPrice)}</td>
                <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{cur(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── TOTALS ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px" }}>
          <div style={{ minWidth: "270px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #eee" }}>
              <span style={{ color: "#666", fontSize: "12px" }}>Subtotal</span>
              <span style={{ fontWeight: 600 }}>{cur(subtotal)}</span>
            </div>
            {hasGst && (
              <>
                {(doc.cgstAmount ?? 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #eee" }}>
                    <span style={{ color: "#666", fontSize: "12px" }}>CGST ({(doc.gstRate ?? 0) / 2}%)</span>
                    <span>{cur(doc.cgstAmount)}</span>
                  </div>
                )}
                {(doc.sgstAmount ?? 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #eee" }}>
                    <span style={{ color: "#666", fontSize: "12px" }}>SGST ({(doc.gstRate ?? 0) / 2}%)</span>
                    <span>{cur(doc.sgstAmount)}</span>
                  </div>
                )}
                {(doc.igstAmount ?? 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #eee" }}>
                    <span style={{ color: "#666", fontSize: "12px" }}>IGST ({doc.gstRate}%)</span>
                    <span>{cur(doc.igstAmount)}</span>
                  </div>
                )}
              </>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: meta.accent, borderRadius: "6px", marginTop: "6px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px", color: meta.accentText }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: "18px", color: meta.accentText }}>{cur(total)}</span>
            </div>
          </div>
        </div>

        {/* ── NOTES ── */}
        {doc.notes && (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "6px", padding: "14px 16px", marginBottom: "20px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "#888", marginBottom: "6px" }}>Notes</div>
            <div style={{ fontSize: "12px", color: "#444", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{doc.notes}</div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ borderTop: "1px solid #e8e8e8", paddingTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "#bbb" }}>
          <span>This is a computer-generated document. No signature required.</span>
          {doc.createdByName && <span>Prepared by: {doc.createdByName}</span>}
        </div>
      </div>
    )
  }
)

DocumentRenderer.displayName = "DocumentRenderer"
