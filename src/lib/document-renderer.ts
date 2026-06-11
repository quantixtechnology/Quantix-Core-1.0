// Shared document rendering service for all Quantix printable documents.
// Renders print-ready HTML — no external PDF library, no Chromium required.
// Client opens the HTML in a print window and uses browser "Save as PDF".
//
// Supported: Invoice
// Planned: Quote, Proposal, Receipt, Credit Note

import { readFile } from 'fs/promises'
import { join }     from 'path'
import { UPLOAD_ROOT } from '@/lib/upload-root'
import type { PlatformSettingsData } from '@/lib/platform-settings'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LineItem {
  name:         string
  description?: string | null
  quantity:     number
  unitPrice:    number
  amount:       number
}

export interface Payment {
  amount:        number
  paidAt:        string | Date
  paymentMode:   string | null
  transactionId: string | null
  status:        string
}

export interface InvoiceRenderOpts {
  invoice:   Record<string, unknown>
  business:  Record<string, unknown>
  ps:        PlatformSettingsData
  lineItems: LineItem[]
  payments:  Payment[]
  logoSrc:   string | null
  /** When true, adds @page CSS and auto-print script for browser print-to-PDF */
  forPrint?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function paymentStatus(status: string) {
  if (status === 'PAID')      return { label: 'PAID',        color: '#059669', bg: '#f0fdf4', border: '#86efac' }
  if (status === 'CANCELLED') return { label: 'CANCELLED',   color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' }
  if (status === 'OVERDUE')   return { label: 'PAYMENT DUE', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' }
  return                             { label: 'PAYMENT DUE', color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
}

// ── Logo resolver ─────────────────────────────────────────────────────────────

/**
 * Resolves a logo URL to a base64 data URI (for embedding in standalone HTML).
 * External URLs are returned as-is (browser fetches them).
 * Local /uploads/ paths are read from disk and base64-encoded.
 */
export async function logoToBase64(url: string | null): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('http')) return url
  try {
    const rel  = url.replace(/^\/uploads\//, '')
    const path = join(UPLOAD_ROOT, rel)
    const buf  = await readFile(path)
    const ext  = path.split('.').pop()?.toLowerCase() ?? 'png'
    const mime = ext === 'svg'  ? 'image/svg+xml'
               : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
               : ext === 'webp' ? 'image/webp'
               : 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

// ── Invoice renderer ──────────────────────────────────────────────────────────

export function buildInvoiceHtml(opts: InvoiceRenderOpts): string {
  const { invoice, business, ps, lineItems, payments, logoSrc, forPrint = false } = opts
  const st      = paymentStatus(invoice.status as string)
  const isPaid  = invoice.status === 'PAID'
  const balance = Math.max(0, (invoice.totalAmount as number) - (invoice.paidAmount as number))

  // Company identity (invoice settings fallback chain)
  const coName    = ps.invoiceLegalName || ps.invoiceBusinessName || ps.companyName
  const coEmail   = ps.invoiceEmail     || ps.companyEmail
  const coPhone   = ps.invoicePhone     || ps.companyPhone || ''
  const coWebsite = ps.invoiceWebsite   || ps.companyWebsite || ''

  // Address — single compact line
  const addrCity = [
    ps.invoiceCity,
    ps.invoiceState,
    ps.invoicePincode ? `– ${ps.invoicePincode}` : null,
  ].filter(Boolean).join(', ')
  const addrFull = [ps.invoiceAddress || ps.companyAddress || '', addrCity].filter(Boolean).join(', ')

  // Registration numbers — only populated, non-placeholder values
  // Moved to footer so they appear on the last page only, not taking header space
  const regs = [
    ps.companyGst && ps.companyGst !== 'APPLIED FOR' ? `GSTIN: ${ps.companyGst}` : null,
    ps.companyPan     ? `PAN: ${ps.companyPan}`       : null,
    ps.companyMsme    ? `MSME: ${ps.companyMsme}`     : null,
    ps.companyShopEst ? `S&E: ${ps.companyShopEst}`   : null,
    ps.companyIec     ? `IEC: ${ps.companyIec}`        : null,
    ps.companyCin     ? `CIN: ${ps.companyCin}`        : null,
  ].filter(Boolean) as string[]

  // The first registration (GSTIN) shown in Bill From for GST compliance
  const primaryReg = regs[0] ?? null

  // ── Line item rows ─────────────────────────────────────────────────────────
  const lineRows = lineItems.map(li => `
    <tr>
      <td class="td-desc">
        <span class="item-name">${li.name}</span>
        ${li.description ? `<br/><span class="item-sub">${li.description}</span>` : ''}
      </td>
      <td class="td-c">${li.quantity}</td>
      <td class="td-r mono">${fmt(li.unitPrice)}</td>
      <td class="td-r mono bold">${fmt(li.amount)}</td>
    </tr>`).join('')

  // ── Totals table rows ──────────────────────────────────────────────────────
  const taxRows = [
    (invoice.cgstAmount as number) > 0
      ? `<tr class="t-muted"><td>CGST (${invoice.cgstRate}%)</td><td class="mono td-r">${fmt(invoice.cgstAmount as number)}</td></tr>` : '',
    (invoice.sgstAmount as number) > 0
      ? `<tr class="t-muted"><td>SGST (${invoice.sgstRate}%)</td><td class="mono td-r">${fmt(invoice.sgstAmount as number)}</td></tr>` : '',
    (invoice.igstAmount as number) > 0
      ? `<tr class="t-muted"><td>IGST (${invoice.igstRate}%)</td><td class="mono td-r">${fmt(invoice.igstAmount as number)}</td></tr>` : '',
  ].join('')

  // ── Payment history rows ───────────────────────────────────────────────────
  const paymentRows = payments.map(p => `
    <div class="pay-row">
      <span>${fmt(p.amount)}${p.paymentMode ? ` · ${p.paymentMode.replace(/_/g, ' ')}` : ''}${p.transactionId ? ` · <span class="mono">${p.transactionId}</span>` : ''}</span>
      <span class="muted">${fmtDate(p.paidAt)}</span>
    </div>`).join('')

  // ── Banking block (unpaid invoices, last-page summary only) ───────────────
  const hasBanking = !isPaid && (ps.bankAccountNumber || ps.bankUpiId || ps.bankIfsc)
  const bankBlock  = hasBanking ? `
    <div class="bank-box">
      <div class="sec-label">Bank Transfer Details</div>
      <div class="bank-grid">
        ${ps.bankAccountName   ? `<span class="bank-k">Account Name</span><span class="bank-v">${ps.bankAccountName}</span>` : ''}
        ${ps.bankName          ? `<span class="bank-k">Bank</span><span class="bank-v">${ps.bankName}</span>` : ''}
        ${ps.bankAccountNumber ? `<span class="bank-k">Account No.</span><span class="bank-v mono">${ps.bankAccountNumber}</span>` : ''}
        ${ps.bankIfsc          ? `<span class="bank-k">IFSC</span><span class="bank-v mono">${ps.bankIfsc}</span>` : ''}
        ${ps.bankUpiId         ? `<span class="bank-k">UPI</span><span class="bank-v mono">${ps.bankUpiId}</span>` : ''}
      </div>
    </div>` : ''

  // ── Notes ─────────────────────────────────────────────────────────────────
  const notesText = [ps.invoiceDefaultNotes, invoice.notes as string | undefined].filter(Boolean).join('\n\n')

  // ── Watermark ─────────────────────────────────────────────────────────────
  const wmColor = isPaid ? 'rgba(5,150,105,0.06)' : 'rgba(217,119,6,0.05)'
  const wmText  = isPaid ? 'PAID' : (invoice.status === 'OVERDUE' ? 'OVERDUE' : 'PAYMENT DUE')

  // ── Balance Due row label ──────────────────────────────────────────────────
  const dueLabel = isPaid ? '&#10003;&nbsp;Paid in Full' : 'Balance Due'
  const dueColor = st.color

  // ── Print CSS + script ────────────────────────────────────────────────────
  const printExtras = forPrint ? `
  @page { size: A4; margin: 12mm 10mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .watermark { color: ${isPaid ? 'rgba(5,150,105,0.04)' : 'rgba(217,119,6,0.03)'}; }
    .page { padding: 0; }
  }` : ''

  const printScript = forPrint
    ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},250);});</script>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Invoice ${invoice.invoiceNumber}</title>
${printScript}
<style>
/* ── Reset ── */
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;background:#fff;font-size:11.5px;line-height:1.45;}
.page{max-width:760px;margin:0 auto;padding:22px 28px 28px;}

/* ── Watermark ── */
.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:90px;font-weight:900;letter-spacing:10px;white-space:nowrap;pointer-events:none;z-index:-1;color:${wmColor};}

/* ── Header — compact band ── */
.hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:10px;border-bottom:2px solid #7c3aed;margin-bottom:10px;}
.hdr-left{display:flex;align-items:flex-start;gap:10px;min-width:0;}
.co-logo{height:30px;width:auto;object-fit:contain;flex-shrink:0;margin-top:1px;}
.co-info{min-width:0;}
.co-name{font-size:14px;font-weight:800;color:#111827;letter-spacing:-0.2px;line-height:1.2;}
.co-trade{font-size:10px;color:#6b7280;margin-top:1px;}
.co-meta{font-size:10px;color:#6b7280;margin-top:3px;line-height:1.65;}
.hdr-right{text-align:right;flex-shrink:0;}
.inv-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#7c3aed;}
.inv-num{font-size:16px;font-weight:800;font-family:monospace;color:#111827;margin-top:1px;line-height:1.15;}
.inv-meta{font-size:10px;color:#6b7280;margin-top:4px;line-height:1.7;}
.inv-badge{display:inline-block;border:2px solid ${st.color};border-radius:4px;padding:2px 9px;font-size:10px;font-weight:800;color:${st.color};letter-spacing:0.1em;text-transform:uppercase;margin-top:5px;transform:rotate(-4deg);}

/* ── Bill From / To — compact horizontal strip ── */
.billing{display:flex;gap:10px;margin-bottom:10px;}
.bsec{flex:1;border:1px solid #f3f4f6;border-radius:5px;padding:7px 10px;}
.bsec-lbl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:3px;}
.bsec-name{font-size:11.5px;font-weight:700;color:#111827;}
.bsec-meta{font-size:10px;color:#6b7280;line-height:1.6;margin-top:2px;}

/* ── Items table ── */
table.items{width:100%;border-collapse:collapse;font-size:11px;}
/* thead repeats on each printed page automatically */
table.items thead{display:table-header-group;}
table.items thead tr{background:#7c3aed;}
table.items thead th{padding:6px 8px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#fff;text-align:left;}
table.items thead th.th-r{text-align:right;}
table.items thead th.th-c{text-align:center;}
table.items tbody td{border-bottom:1px solid #f3f4f6;padding:6px 8px;vertical-align:top;}
table.items tbody tr:nth-child(even){background:#fafafa;}
.item-name{font-weight:600;color:#111827;}
.item-sub{font-size:9.5px;color:#9ca3af;}
.td-c{text-align:center;width:46px;}
.td-r{text-align:right;}
.td-desc{width:auto;}
.mono{font-family:monospace;}
.bold{font-weight:700;}
.muted{color:#6b7280;}

/* ── Summary block — always on final page, never split across pages ── */
.summary{page-break-inside:avoid;break-inside:avoid;margin-top:12px;}

/* ── Totals ── */
.totals-row{display:flex;justify-content:flex-end;margin-bottom:10px;}
.totals-tbl{width:250px;border-collapse:collapse;font-size:11px;}
.totals-tbl td{padding:3px 8px;}
.t-muted td{color:#6b7280;}
.t-sep td{border-top:1px solid #e5e7eb;padding-top:6px;}
.t-total td{font-size:13px;font-weight:800;color:#7c3aed;}
.t-paid td{color:#059669;font-weight:600;}
.t-due td{font-size:14px;font-weight:800;color:${dueColor};border-top:2px solid ${st.border};padding-top:7px;}

/* ── Payment history ── */
.pay-section{margin-bottom:10px;}
.sec-label{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:6px;}
.pay-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f3f4f6;font-size:11px;}

/* ── Bank + Notes side by side (or stacked if only one present) ── */
.bottom-cols{display:flex;gap:12px;margin-bottom:10px;}
.bottom-cols .col{flex:1;}
.bank-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:8px 10px;}
.bank-grid{display:grid;grid-template-columns:90px 1fr;gap:3px 10px;font-size:10px;}
.bank-k{color:#9ca3af;font-size:9px;font-weight:600;text-transform:uppercase;display:flex;align-items:center;}
.bank-v{color:#374151;font-weight:500;}
.notes-box{background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:8px 10px;font-size:10.5px;color:#6b7280;white-space:pre-wrap;line-height:1.55;}
.notes-box strong{color:#374151;}

/* ── Footer — registrations + legal + company info ── */
.footer{margin-top:10px;padding-top:8px;border-top:1px solid #f3f4f6;font-size:9.5px;color:#9ca3af;line-height:1.6;}
.footer-top{margin-bottom:3px;}
.footer-regs{font-size:9px;color:#b0b8c4;margin-bottom:3px;}
.footer-disclaimer{font-size:8.5px;color:#d1d5db;font-style:italic;margin-bottom:3px;}
.footer-bottom{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;}
.footer-left{line-height:1.55;}
.footer-right{text-align:right;flex-shrink:0;}

${printExtras}
</style>
</head>
<body>
<div class="watermark">${wmText}</div>
<div class="page">

  <!-- ── Compact Letterhead ── -->
  <div class="hdr">
    <div class="hdr-left">
      ${logoSrc ? `<img src="${logoSrc}" alt="${coName}" class="co-logo"/>` : ''}
      <div class="co-info">
        <div class="co-name">${coName}</div>
        ${ps.invoiceBusinessName && ps.invoiceLegalName ? `<div class="co-trade">${ps.invoiceBusinessName}</div>` : ''}
        <div class="co-meta">${[addrFull, coEmail, coPhone ? coPhone : null, coWebsite ? coWebsite : null].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>
      </div>
    </div>
    <div class="hdr-right">
      <div class="inv-label">Tax Invoice</div>
      <div class="inv-num">${invoice.invoiceNumber}</div>
      <div class="inv-meta">
        Issued: ${fmtDate(invoice.issuedDate as string | null)}
        ${invoice.dueDate ? `<br/>Due: ${fmtDate(invoice.dueDate as string | null)}` : ''}
        ${invoice.billingPeriod ? `<br/>${invoice.billingPeriod}` : ''}
      </div>
      <div><span class="inv-badge">${st.label}</span></div>
    </div>
  </div>

  <!-- ── Bill From / Bill To ── -->
  <div class="billing">
    <div class="bsec">
      <div class="bsec-lbl">Bill From</div>
      <div class="bsec-name">${coName}</div>
      <div class="bsec-meta">${[addrFull || null, coEmail, primaryReg].filter(Boolean).join('<br/>')}</div>
    </div>
    <div class="bsec">
      <div class="bsec-lbl">Bill To</div>
      <div class="bsec-name">${business.name}</div>
      <div class="bsec-meta">${[
        business.contactEmail ?? null,
        business.contactPhone ?? null,
        [business.address, business.city, business.state].filter(Boolean).join(', ') || null,
        (business as Record<string,unknown>).pincode ? `– ${(business as Record<string,unknown>).pincode}` : null,
        business.gstNumber ? `GSTIN: ${business.gstNumber}` : null,
      ].filter(Boolean).join('<br/>')}</div>
    </div>
  </div>

  <!-- ── Service / Line Items — thead repeats on each printed page ── -->
  <table class="items">
    <thead>
      <tr>
        <th class="td-desc">Service / Description</th>
        <th class="th-c" style="width:46px;">Qty</th>
        <th class="th-r" style="width:110px;">Unit Price</th>
        <th class="th-r" style="width:110px;">Amount</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <!-- ── Summary (page-break-inside: avoid — stays together on final page) ── -->
  <div class="summary">

    <!-- Totals — right-aligned, Balance Due replaces standalone banner -->
    <div class="totals-row">
      <table class="totals-tbl">
        <tr class="t-muted"><td>Subtotal</td><td class="mono td-r">${fmt(invoice.subtotal as number)}</td></tr>
        ${taxRows}
        <tr class="t-sep t-total"><td>Total</td><td class="mono td-r">${fmt(invoice.totalAmount as number)}</td></tr>
        ${(invoice.paidAmount as number) > 0 ? `<tr class="t-paid"><td>Paid</td><td class="mono td-r">${fmt(invoice.paidAmount as number)}</td></tr>` : ''}
        <tr class="t-due"><td>${dueLabel}</td><td class="mono td-r">${fmt(isPaid ? 0 : balance)}</td></tr>
      </table>
    </div>

    <!-- Payment History (if any) -->
    ${payments.length > 0 ? `
    <div class="pay-section">
      <div class="sec-label">Payment History</div>
      ${paymentRows}
    </div>` : ''}

    <!-- Bank Details + Notes — side by side when both present, full-width otherwise -->
    ${hasBanking || notesText ? `
    <div class="bottom-cols">
      ${hasBanking ? `<div class="col">${bankBlock}</div>` : ''}
      ${notesText  ? `<div class="col"><div class="notes-box"><strong>Notes:</strong> ${notesText}</div></div>` : ''}
    </div>` : ''}

    <!-- Footer — registrations (GSTIN, PAN, MSME, S&E, IEC, CIN) + legal + company meta -->
    <div class="footer">
      ${ps.invoiceFooterNotes ? `<div class="footer-top">${ps.invoiceFooterNotes}</div>` : ''}
      ${regs.length > 0 ? `<div class="footer-regs">${regs.join(' &nbsp;|&nbsp; ')}</div>` : ''}
      ${ps.invoiceLegalDisclaimer ? `<div class="footer-disclaimer">${ps.invoiceLegalDisclaimer}</div>` : ''}
      <div class="footer-bottom">
        <div class="footer-left">
          ${coName} &nbsp;·&nbsp; ${coEmail}${coWebsite ? ` &nbsp;·&nbsp; ${coWebsite}` : ''}
        </div>
        <div class="footer-right">
          SAC/HSN: ${ps.sacCode ?? '998314'} &nbsp;·&nbsp; Thank you for your business!
        </div>
      </div>
    </div>

  </div><!-- /summary -->

</div><!-- /page -->
</body>
</html>`
}

// ── Order Invoice renderer (Tenant → Customer) ────────────────────────────────
// Renders a B2C tax invoice for a store order.
// "Bill From" = the tenant business. "Bill To" = the end customer.

export interface OrderCustomer {
  name:    string
  phone?:  string | null
  email?:  string | null
  address?: string | null
}

export interface OrderInvoiceBusiness {
  name:         string
  slug:         string
  logo?:        string | null
  primaryColor?: string | null
  gstNumber?:   string | null
  panNumber?:   string | null
  address?:     string | null
  city?:        string | null
  state?:       string | null
  pincode?:     string | null
  contactEmail?: string | null
  contactPhone?: string | null
}

export interface OrderInvoiceRenderOpts {
  invoice:    Record<string, unknown>
  business:   OrderInvoiceBusiness
  storeName:  string
  customer:   OrderCustomer
  lineItems:  LineItem[]
  logoSrc:    string | null
  forPrint?:  boolean
}

export function buildOrderInvoiceHtml(opts: OrderInvoiceRenderOpts): string {
  const { invoice, business, storeName, customer, lineItems, logoSrc, forPrint = false } = opts

  const isPaid        = invoice.status === 'PAID'
  const isPartialPaid = !isPaid && (invoice.paidAmount as number) > 0
  const balance       = Math.max(0, (invoice.totalAmount as number) - (invoice.paidAmount as number))

  const statusInfo = isPaid
    ? { label: 'PAID',           color: '#059669', border: '#86efac' }
    : isPartialPaid
    ? { label: 'PARTIALLY PAID', color: '#d97706', border: '#fde68a' }
    : invoice.status === 'PAYMENT_DUE'
    ? { label: 'PAYMENT DUE',    color: '#d97706', border: '#fde68a' }
    : { label: 'DRAFT',          color: '#9ca3af', border: '#e5e7eb' }

  const accentColor = business.primaryColor || '#7c3aed'
  const dueLabel    = isPaid ? '&#10003;&nbsp;Paid in Full' : 'Balance Due'

  const sellerAddr = [
    business.address,
    business.city,
    business.state,
    business.pincode ? `– ${business.pincode}` : null,
  ].filter(Boolean).join(', ')

  const lineRows = lineItems.map(li => `
    <tr>
      <td class="td-desc">
        <span class="item-name">${li.name}</span>
        ${li.description ? `<br/><span class="item-sub">${li.description}</span>` : ''}
      </td>
      <td class="td-c">${li.quantity}</td>
      <td class="td-r mono">${fmt(li.unitPrice)}</td>
      <td class="td-r mono bold">${fmt(li.amount)}</td>
    </tr>`).join('')

  const taxRows = [
    (invoice.cgstAmount as number) > 0
      ? `<tr class="t-muted"><td>CGST</td><td class="mono td-r">${fmt(invoice.cgstAmount as number)}</td></tr>` : '',
    (invoice.sgstAmount as number) > 0
      ? `<tr class="t-muted"><td>SGST</td><td class="mono td-r">${fmt(invoice.sgstAmount as number)}</td></tr>` : '',
    (invoice.igstAmount as number) > 0
      ? `<tr class="t-muted"><td>IGST</td><td class="mono td-r">${fmt(invoice.igstAmount as number)}</td></tr>` : '',
  ].join('')

  const wmText  = isPaid ? 'PAID' : 'PAYMENT DUE'
  const wmColor = isPaid ? 'rgba(5,150,105,0.06)' : 'rgba(217,119,6,0.05)'

  const notesText = invoice.notes as string | null

  const printExtras = forPrint ? `
  @page { size: A4; margin: 12mm 10mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .watermark { color: ${isPaid ? 'rgba(5,150,105,0.04)' : 'rgba(217,119,6,0.03)'}; }
    .page { padding: 0; }
  }` : ''

  const printScript = forPrint
    ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},250);});</script>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Invoice ${invoice.invoiceNumber} — ${business.name}</title>
${printScript}
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;background:#fff;font-size:11.5px;line-height:1.45;}
.page{max-width:760px;margin:0 auto;padding:22px 28px 28px;}
.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:90px;font-weight:900;letter-spacing:10px;white-space:nowrap;pointer-events:none;z-index:-1;color:${wmColor};}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:10px;border-bottom:2px solid ${accentColor};margin-bottom:10px;}
.hdr-left{display:flex;align-items:flex-start;gap:10px;min-width:0;}
.co-logo{height:30px;width:auto;object-fit:contain;flex-shrink:0;margin-top:1px;}
.co-info{min-width:0;}
.co-name{font-size:14px;font-weight:800;color:#111827;letter-spacing:-0.2px;line-height:1.2;}
.co-meta{font-size:10px;color:#6b7280;margin-top:3px;line-height:1.65;}
.hdr-right{text-align:right;flex-shrink:0;}
.inv-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:${accentColor};}
.inv-num{font-size:16px;font-weight:800;font-family:monospace;color:#111827;margin-top:1px;line-height:1.15;}
.inv-meta{font-size:10px;color:#6b7280;margin-top:4px;line-height:1.7;}
.inv-badge{display:inline-block;border:2px solid ${statusInfo.color};border-radius:4px;padding:2px 9px;font-size:10px;font-weight:800;color:${statusInfo.color};letter-spacing:0.1em;text-transform:uppercase;margin-top:5px;transform:rotate(-4deg);}
.billing{display:flex;gap:10px;margin-bottom:10px;}
.bsec{flex:1;border:1px solid #f3f4f6;border-radius:5px;padding:7px 10px;}
.bsec-lbl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:3px;}
.bsec-name{font-size:11.5px;font-weight:700;color:#111827;}
.bsec-meta{font-size:10px;color:#6b7280;line-height:1.6;margin-top:2px;}
table.items{width:100%;border-collapse:collapse;font-size:11px;}
table.items thead{display:table-header-group;}
table.items thead tr{background:${accentColor};}
table.items thead th{padding:6px 8px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#fff;text-align:left;}
table.items thead th.th-r{text-align:right;}
table.items thead th.th-c{text-align:center;}
table.items tbody td{border-bottom:1px solid #f3f4f6;padding:6px 8px;vertical-align:top;}
table.items tbody tr:nth-child(even){background:#fafafa;}
.item-name{font-weight:600;color:#111827;}
.item-sub{font-size:9.5px;color:#9ca3af;}
.td-c{text-align:center;width:46px;}
.td-r{text-align:right;}
.td-desc{width:auto;}
.mono{font-family:monospace;}
.bold{font-weight:700;}
.muted{color:#6b7280;}
.summary{page-break-inside:avoid;break-inside:avoid;margin-top:12px;}
.totals-row{display:flex;justify-content:flex-end;margin-bottom:10px;}
.totals-tbl{width:250px;border-collapse:collapse;font-size:11px;}
.totals-tbl td{padding:3px 8px;}
.t-muted td{color:#6b7280;}
.t-sep td{border-top:1px solid #e5e7eb;padding-top:6px;}
.t-total td{font-size:13px;font-weight:800;color:${accentColor};}
.t-paid td{color:#059669;font-weight:600;}
.t-due td{font-size:14px;font-weight:800;color:${statusInfo.color};border-top:2px solid ${statusInfo.border};padding-top:7px;}
.order-ref{font-size:9.5px;color:#9ca3af;margin-bottom:8px;padding:4px 0;border-bottom:1px dashed #f3f4f6;}
.notes-box{background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:8px 10px;font-size:10.5px;color:#6b7280;white-space:pre-wrap;line-height:1.55;margin-bottom:10px;}
.footer{margin-top:10px;padding-top:8px;border-top:1px solid #f3f4f6;font-size:9.5px;color:#9ca3af;line-height:1.6;}
.footer-bottom{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;}
${printExtras}
</style>
</head>
<body>
<div class="watermark">${wmText}</div>
<div class="page">

  <div class="hdr">
    <div class="hdr-left">
      ${logoSrc ? `<img src="${logoSrc}" alt="${business.name}" class="co-logo"/>` : ''}
      <div class="co-info">
        <div class="co-name">${business.name}</div>
        <div class="co-meta">${[storeName !== business.name ? storeName : null, sellerAddr, business.contactEmail, business.contactPhone].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>
      </div>
    </div>
    <div class="hdr-right">
      <div class="inv-label">Tax Invoice</div>
      <div class="inv-num">${invoice.invoiceNumber}</div>
      <div class="inv-meta">
        Issued: ${fmtDate(invoice.createdAt as string | null)}
        ${invoice.dueDate ? `<br/>Due: ${fmtDate(invoice.dueDate as string | null)}` : ''}
        ${invoice.paidAt  ? `<br/>Paid: ${fmtDate(invoice.paidAt  as string | null)}` : ''}
      </div>
      <div><span class="inv-badge">${statusInfo.label}</span></div>
    </div>
  </div>

  ${(invoice.order as Record<string,unknown>)?.orderNumber
    ? `<div class="order-ref">Order Reference: <span style="font-family:monospace;color:#374151;font-weight:600;">${(invoice.order as Record<string,unknown>).orderNumber}</span></div>`
    : ''}

  <div class="billing">
    <div class="bsec">
      <div class="bsec-lbl">From</div>
      <div class="bsec-name">${business.name}</div>
      <div class="bsec-meta">${[sellerAddr || null, business.contactEmail, business.gstNumber ? `GSTIN: ${business.gstNumber}` : null].filter(Boolean).join('<br/>')}</div>
    </div>
    <div class="bsec">
      <div class="bsec-lbl">Bill To</div>
      <div class="bsec-name">${customer.name}</div>
      <div class="bsec-meta">${[customer.phone, customer.email, customer.address].filter(Boolean).join('<br/>')}</div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th class="td-desc">Item</th>
        <th class="th-c" style="width:46px;">Qty</th>
        <th class="th-r" style="width:110px;">Unit Price</th>
        <th class="th-r" style="width:110px;">Amount</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <div class="summary">
    <div class="totals-row">
      <table class="totals-tbl">
        <tr class="t-muted"><td>Subtotal</td><td class="mono td-r">${fmt(invoice.subtotal as number)}</td></tr>
        ${(invoice.totalDiscount as number) > 0 ? `<tr class="t-muted"><td>Discount</td><td class="mono td-r">−${fmt(invoice.totalDiscount as number)}</td></tr>` : ''}
        ${taxRows}
        <tr class="t-sep t-total"><td>Total</td><td class="mono td-r">${fmt(invoice.totalAmount as number)}</td></tr>
        ${(invoice.paidAmount as number) > 0 ? `<tr class="t-paid"><td>Paid</td><td class="mono td-r">${fmt(invoice.paidAmount as number)}</td></tr>` : ''}
        <tr class="t-due"><td>${dueLabel}</td><td class="mono td-r">${fmt(isPaid ? 0 : balance)}</td></tr>
      </table>
    </div>

    ${notesText ? `<div class="notes-box"><strong>Notes:</strong> ${notesText}</div>` : ''}

    <div class="footer">
      <div class="footer-bottom">
        <div>${business.name} &nbsp;·&nbsp; ${business.contactEmail || ''}</div>
        <div>${business.gstNumber ? `GSTIN: ${business.gstNumber}` : ''}</div>
      </div>
    </div>
  </div>

</div>
</body>
</html>`
}
