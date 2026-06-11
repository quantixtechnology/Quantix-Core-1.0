// GET /api/admin/account-billing/[businessId]/invoices/[id]/pdf
// Generate a PDF invoice via Puppeteer. Returns application/pdf.
// Writes INVOICE_DOWNLOADED audit entry (non-blocking).

import puppeteer, { type Browser } from 'puppeteer'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { getPlatformSettings } from '@/lib/platform-settings'
import { UPLOAD_ROOT } from '@/lib/upload-root'
import type { NextRequest } from 'next/server'

interface LineItem {
  name: string
  description?: string | null
  quantity: number
  unitPrice: number
  amount: number
}

interface Payment {
  amount: number
  paidAt: string | Date
  paymentMode: string | null
  transactionId: string | null
  status: string
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function paymentStatus(status: string) {
  if (status === 'PAID')      return { label: 'PAID',         color: '#059669', bg: '#f0fdf4', border: '#86efac' }
  if (status === 'CANCELLED') return { label: 'CANCELLED',    color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' }
  if (status === 'OVERDUE')   return { label: 'PAYMENT DUE',  color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' }
  return                             { label: 'PAYMENT DUE',  color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
}

async function logoToBase64(url: string | null): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('http')) return url // external — Puppeteer fetches it
  try {
    const rel  = url.replace(/^\/uploads\//, '')
    const path = join(UPLOAD_ROOT, rel)
    const buf  = await readFile(path)
    const ext  = path.split('.').pop()?.toLowerCase() ?? 'png'
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch { return null }
}

function buildHtml(opts: {
  invoice:   Record<string, unknown>
  business:  Record<string, unknown>
  ps:        { companyName: string; companyAddress: string; companyEmail: string; companyPhone: string | null; companyGst: string; sacCode: string }
  lineItems: LineItem[]
  payments:  Payment[]
  logoSrc:   string | null
}): string {
  const { invoice, business, ps, lineItems, payments, logoSrc } = opts
  const st       = paymentStatus(invoice.status as string)
  const isPaid   = invoice.status === 'PAID'
  const balance  = Math.max(0, (invoice.totalAmount as number) - (invoice.paidAmount as number))

  const lineRows = lineItems.map(li => `
    <tr>
      <td class="item-cell">
        <strong>${li.name}</strong>
        ${li.description ? `<br/><small>${li.description}</small>` : ''}
      </td>
      <td class="num-center">${li.quantity}</td>
      <td class="num-right mono">${fmt(li.unitPrice)}</td>
      <td class="num-right mono bold">${fmt(li.amount)}</td>
    </tr>`).join('')

  const taxRows = [
    (invoice.cgstAmount as number) > 0 ? `<tr><td style="color:#6b7280;">CGST (${invoice.cgstRate}%)</td><td class="mono" style="text-align:right;">${fmt(invoice.cgstAmount as number)}</td></tr>` : '',
    (invoice.sgstAmount as number) > 0 ? `<tr><td style="color:#6b7280;">SGST (${invoice.sgstRate}%)</td><td class="mono" style="text-align:right;">${fmt(invoice.sgstAmount as number)}</td></tr>` : '',
    (invoice.igstAmount as number) > 0 ? `<tr><td style="color:#6b7280;">IGST (${invoice.igstRate}%)</td><td class="mono" style="text-align:right;">${fmt(invoice.igstAmount as number)}</td></tr>` : '',
  ].join('')

  const paymentRows = payments.map(p => `
    <div class="pay-row">
      <span>${fmt(p.amount)}${p.paymentMode ? ` · ${p.paymentMode.replace(/_/g,' ')}` : ''}${p.transactionId ? ` · <span class="mono">${p.transactionId}</span>` : ''}</span>
      <span style="color:#6b7280;">${fmtDate(p.paidAt)}</span>
    </div>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Invoice ${invoice.invoiceNumber}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;background:#fff;font-size:13px;line-height:1.5;}
  .page{max-width:780px;margin:0 auto;padding:48px 40px;}
  /* header */
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:28px;border-bottom:2px solid #e5e7eb;margin-bottom:28px;}
  .co-logo{height:44px;width:auto;object-fit:contain;display:block;margin-bottom:10px;}
  .co-name{font-size:20px;font-weight:800;color:#111827;letter-spacing:-0.3px;}
  .co-meta{font-size:11px;color:#6b7280;line-height:1.9;margin-top:4px;}
  .inv-right{text-align:right;}
  .inv-type{font-size:22px;font-weight:800;color:#7c3aed;letter-spacing:-0.5px;}
  .inv-num{font-size:15px;font-weight:700;font-family:monospace;margin-top:6px;color:#111827;}
  .inv-dates{font-size:11px;color:#6b7280;margin-top:6px;line-height:1.9;}
  /* status stamp */
  .stamp{display:inline-block;border:2.5px solid ${st.color};border-radius:6px;padding:5px 14px;font-size:14px;font-weight:800;color:${st.color};letter-spacing:0.14em;text-transform:uppercase;margin-top:10px;transform:rotate(-5deg);}
  /* billing */
  .billing{display:flex;gap:32px;margin-bottom:28px;}
  .bsec{flex:1;}
  .bsec-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:6px;}
  .bsec-name{font-size:14px;font-weight:700;color:#111827;}
  .bsec-meta{font-size:11px;color:#6b7280;line-height:1.9;margin-top:3px;}
  /* items */
  table.items{width:100%;border-collapse:collapse;margin-bottom:20px;}
  table.items thead tr{background:#f9fafb;}
  table.items thead th{padding:9px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#9ca3af;text-align:left;border-bottom:2px solid #e5e7eb;}
  table.items tbody td{border-bottom:1px solid #f3f4f6;padding:10px 14px;vertical-align:top;}
  .item-cell strong{font-weight:600;color:#111827;}
  .item-cell small{font-size:11px;color:#9ca3af;}
  .num-center{text-align:center;}
  .num-right{text-align:right;}
  .mono{font-family:monospace;}
  .bold{font-weight:700;}
  /* totals */
  .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:24px;}
  .totals-tbl{width:260px;}
  .totals-tbl td{padding:5px 14px;font-size:12px;}
  .totals-tbl .grand td{font-size:15px;font-weight:800;color:#7c3aed;border-top:2px solid #e5e7eb;padding-top:10px;}
  /* payment box */
  .pay-box{background:${st.bg};border:1px solid ${st.border};border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}
  .pay-box-label{font-size:13px;font-weight:700;color:${st.color};}
  .pay-box-sub{font-size:11px;color:#6b7280;margin-top:3px;}
  .pay-box-amt{font-size:22px;font-weight:800;color:${st.color};font-family:monospace;}
  /* payment history */
  .pay-history-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:8px;}
  .pay-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f3f4f6;font-size:12px;}
  /* notes */
  .notes{background:#f9fafb;border-radius:8px;padding:12px 16px;font-size:12px;color:#6b7280;margin-bottom:20px;}
  /* footer */
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between;}
  /* watermark */
  .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:80px;font-weight:900;letter-spacing:8px;white-space:nowrap;pointer-events:none;z-index:-1;${isPaid ? 'color:rgba(5,150,105,0.07);' : 'display:none;'}}
</style>
</head>
<body>
<div class="watermark">${isPaid ? 'PAID' : ''}</div>
<div class="page">

  <!-- Letterhead -->
  <div class="hdr">
    <div>
      ${logoSrc ? `<img src="${logoSrc}" alt="${ps.companyName}" class="co-logo"/>` : ''}
      <div class="co-name">${ps.companyName}</div>
      <div class="co-meta">
        ${ps.companyAddress}<br/>
        ${ps.companyEmail}${ps.companyPhone ? ` &nbsp;·&nbsp; ${ps.companyPhone}` : ''}
        ${ps.companyGst !== 'APPLIED FOR' ? `<br/>GSTIN: ${ps.companyGst}` : ''}
      </div>
    </div>
    <div class="inv-right">
      <div class="inv-type">TAX INVOICE</div>
      <div class="inv-num">${invoice.invoiceNumber}</div>
      <div class="inv-dates">
        Issued: ${fmtDate(invoice.issuedDate as string | null)}<br/>
        ${invoice.dueDate ? `Due: ${fmtDate(invoice.dueDate as string | null)}<br/>` : ''}
        ${invoice.billingPeriod ? `Period: ${invoice.billingPeriod}` : ''}
      </div>
      <div><span class="stamp">${st.label}</span></div>
    </div>
  </div>

  <!-- Bill From / Bill To -->
  <div class="billing">
    <div class="bsec">
      <div class="bsec-label">Bill From</div>
      <div class="bsec-name">${ps.companyName}</div>
      <div class="bsec-meta">
        ${ps.companyAddress}<br/>
        ${ps.companyEmail}
        ${ps.companyGst !== 'APPLIED FOR' ? `<br/>GSTIN: ${ps.companyGst}` : ''}
      </div>
    </div>
    <div class="bsec">
      <div class="bsec-label">Bill To</div>
      <div class="bsec-name">${business.name}</div>
      <div class="bsec-meta">
        ${business.contactEmail ?? ''}
        ${business.contactPhone ? `<br/>${business.contactPhone}` : ''}
        ${business.address ? `<br/>${business.address}` : ''}
        ${business.city ? `${business.city}${business.state ? ', ' + business.state : ''}${(business as Record<string,unknown>).pincode ? ' – ' + (business as Record<string,unknown>).pincode : ''}` : ''}
        ${business.gstNumber ? `<br/>GSTIN: ${business.gstNumber}` : ''}
      </div>
    </div>
  </div>

  <!-- Line Items -->
  <table class="items">
    <thead>
      <tr>
        <th>Service / Description</th>
        <th style="width:60px;text-align:center;">Qty</th>
        <th style="width:130px;text-align:right;">Unit Price</th>
        <th style="width:130px;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <!-- Totals -->
  <div class="totals-wrap">
    <table class="totals-tbl">
      <tr><td style="color:#6b7280;">Subtotal</td><td class="mono" style="text-align:right;">${fmt(invoice.subtotal as number)}</td></tr>
      ${taxRows}
      <tr class="grand">
        <td>Total</td>
        <td class="mono" style="text-align:right;">${fmt(invoice.totalAmount as number)}</td>
      </tr>
      ${(invoice.paidAmount as number) > 0 ? `
      <tr>
        <td style="color:#059669;font-weight:600;">Paid</td>
        <td class="mono" style="text-align:right;color:#059669;font-weight:600;">${fmt(invoice.paidAmount as number)}</td>
      </tr>` : ''}
    </table>
  </div>

  <!-- Payment Status Box -->
  <div class="pay-box">
    <div>
      <div class="pay-box-label">${isPaid ? '✓ Payment Received' : 'Amount Due'}</div>
      ${isPaid && payments.length > 0 ? `<div class="pay-box-sub">Payment received on ${fmtDate(payments[0].paidAt)}</div>` : ''}
    </div>
    <div class="pay-box-amt">${fmt(isPaid ? 0 : balance)}</div>
  </div>

  <!-- Payment History -->
  ${payments.length > 0 ? `
  <div style="margin-bottom:20px;">
    <div class="pay-history-label">Payment History</div>
    ${paymentRows}
  </div>` : ''}

  <!-- Notes -->
  ${invoice.notes ? `<div class="notes"><strong style="color:#374151;">Notes:</strong> ${invoice.notes}</div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <span>Thank you for your business!</span>
    <span>${ps.companyName} &nbsp;·&nbsp; ${ps.companyEmail} &nbsp;·&nbsp; HSN/SAC: ${ps.sacCode}</span>
  </div>

</div>
</body>
</html>`
}

export const GET = withMiddleware({
  requireAuth:         true,
  requiredPermission:  'subscriptions:view',
})(async (req: NextRequest, context) => {
  const params = await context?.params
  const businessId = params?.businessId as string
  const id         = params?.id         as string

  const invoice = await db.billingInvoice.findFirst({
    where:   { id, businessId },
    include: {
      payments: {
        where:   { status: 'COMPLETED' },
        orderBy: { paidAt: 'desc' },
        select:  { id: true, amount: true, paidAt: true, paymentMode: true, transactionId: true, status: true },
      },
      account: {
        include: {
          business: {
            select: {
              name: true, contactEmail: true, contactPhone: true,
              address: true, city: true, state: true, pincode: true,
              gstNumber: true,
            },
          },
        },
      },
    },
  })

  if (!invoice) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })

  const business = invoice.account.business
  const ps       = await getPlatformSettings()

  let lineItems: LineItem[] = []
  try { lineItems = JSON.parse(invoice.lineItems) } catch {
    const items = await db.billingInvoiceItem.findMany({ where: { invoiceId: id } })
    lineItems = items.map(i => ({ name: i.name, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, amount: i.amount }))
  }

  const logoUrl = ps.salesLogoUrl ?? ps.logoUrl ?? ps.emailLogoUrl ?? null
  const logoSrc = await logoToBase64(logoUrl)

  const html = buildHtml({
    invoice:   invoice as unknown as Record<string, unknown>,
    business:  business as unknown as Record<string, unknown>,
    ps,
    lineItems,
    payments:  invoice.payments as unknown as Payment[],
    logoSrc,
  })

  let pdfBytes: Uint8Array
  let browser: Browser | null = null
  try {
    browser = await puppeteer.launch({
      headless: true,
      args:     ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 })
    pdfBytes = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin:          { top: '0', right: '0', bottom: '0', left: '0' },
    })
  } finally {
    if (browser) await (browser as Browser).close().catch(() => {})
  }

  // Audit (non-blocking)
  const performedById   = req.headers.get('x-user-id')   ?? null
  const performedByName = req.headers.get('x-user-name') ?? null
  db.billingAudit.create({
    data: {
      accountId:       invoice.accountId,
      businessId,
      action:          'INVOICE_DOWNLOADED',
      entityType:      'INVOICE',
      entityId:        id,
      description:     `Invoice ${invoice.invoiceNumber} downloaded as PDF`,
      performedById,
      performedByName,
    },
  }).catch(() => {})

  const filename = `invoice-${(invoice.invoiceNumber as string).replace(/\//g, '-')}.pdf`
  const pdfBuf   = Buffer.from(pdfBytes!)

  return new NextResponse(pdfBuf as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(pdfBuf.length),
    },
  })
})
