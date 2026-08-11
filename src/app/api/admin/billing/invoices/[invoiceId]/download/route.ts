// ============================================================================
// Route: GET /api/admin/billing/invoices/[invoiceId]/download
// Returns a print-ready HTML GST invoice.
// Renders individual line items when present (add-ons, extra stores, plan).
// Falls back to single-item display for older records without lineItems.
// ============================================================================

import { db } from '@/lib/db';
import { withMiddleware } from '@/lib/middleware';
import { NextResponse } from 'next/server';
import { getPlatformSettings, salesDocLogoUrl, salesDocAccentColor } from '@/lib/platform-settings';
import { printedOnLine } from '@/lib/print-timestamp'

interface LineItem { name: string; description?: string; amount: number; type: string }

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildInvoiceHtml(opts: {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  paidDate: Date | null;
  status: string;
  sellerName: string;
  sellerAddress: string;
  sellerGst: string;
  sellerEmail: string;
  logoUrl: string | null;
  accentColor: string;
  sacCode: string;
  buyerName: string;
  buyerAddress: string;
  buyerGst: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  planName: string;
  periodLabel: string | null;
  description: string;
  // Core amounts
  baseAmount: number;
  lineItems: LineItem[] | null;
  gstRate: number | null;
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
  totalWithGst: number | null;
  // Legacy single-line fields (used when lineItems is null)
  extraStores: number | null;
  extraStoreAmount: number | null;
  paymentMode: string | null;
  receiptReference: string | null;
  paidBy: string | null;
  remarks: string | null;
}): string {
  const gstRate = opts.gstRate ?? 18;
  const cgst = opts.cgstAmount ?? 0;
  const sgst = opts.sgstAmount ?? 0;
  const igst = opts.igstAmount ?? 0;
  const isInterState = igst > 0;
  const hasGst = opts.gstRate != null;

  // Build line item rows
  let itemRows = '';
  let subtotal = 0;

  if (opts.lineItems && opts.lineItems.length > 0) {
    // Multi-line invoice
    for (const item of opts.lineItems) {
      subtotal += item.amount;
      itemRows += `<tr>
        <td class="desc">
          <strong>${item.name}</strong>
          ${item.description ? `<br/><span style="color:#6b7280;font-size:10px;">${item.description}</span>` : ''}
        </td>
        <td class="num">${opts.sacCode}</td>
        <td class="num">${formatINR(item.amount)}</td>
        <td class="num">${hasGst ? `${gstRate}%` : '—'}</td>
        <td class="num">${formatINR(item.amount)}</td>
      </tr>`;
    }
  } else {
    // Legacy single-line: plan + optional extra stores
    const extraStoreAmt = opts.extraStoreAmount ?? 0;
    subtotal = opts.baseAmount + extraStoreAmt;
    itemRows = `<tr>
      <td class="desc">
        <strong>${opts.planName} — Platform Subscription</strong>
        ${opts.periodLabel ? `<br/><span style="color:#6b7280;font-size:10px;">Period: ${opts.periodLabel}</span>` : ''}
        ${opts.description ? `<br/><span style="color:#6b7280;font-size:10px;">${opts.description}</span>` : ''}
      </td>
      <td class="num">998314</td>
      <td class="num">${formatINR(opts.baseAmount)}</td>
      <td class="num">${hasGst ? `${gstRate}%` : '—'}</td>
      <td class="num">${formatINR(opts.baseAmount)}</td>
    </tr>`;
    if ((opts.extraStores ?? 0) > 0) {
      itemRows += `<tr>
        <td class="desc">Additional Stores (${opts.extraStores} × ₹1,999/month)</td>
        <td class="num">—</td>
        <td class="num">${formatINR(extraStoreAmt)}</td>
        <td class="num">—</td>
        <td class="num">${formatINR(extraStoreAmt)}</td>
      </tr>`;
    }
  }

  const grandTotal = opts.totalWithGst ?? subtotal;

  const gstRows = hasGst
    ? isInterState
      ? `<tr><td class="lbl">IGST (${gstRate}%)</td><td class="val">${formatINR(igst)}</td></tr>`
      : `<tr><td class="lbl">CGST (${gstRate / 2}%)</td><td class="val">${formatINR(cgst)}</td></tr>
         <tr><td class="lbl">SGST (${gstRate / 2}%)</td><td class="val">${formatINR(sgst)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Invoice ${opts.invoiceNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111827; background: #fff; }
  .page { max-width: 800px; margin: 0 auto; padding: 28px 40px 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; margin-bottom: 0; }
  .brand { display: flex; align-items: flex-start; gap: 18px; }
  .brand-logo { max-height: 54px; max-width: 200px; object-fit: contain; display: block; flex-shrink: 0; width: auto; }
  .brand-name { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.3px; line-height: 1.1; flex-shrink: 0; }
  .brand-text h1 { font-size: 20px; color: #111827; font-weight: 800; letter-spacing: -0.3px; line-height: 1.1; }
  .brand-text .doc-type { font-size: 10px; font-weight: 700; color: ${opts.accentColor}; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 4px; }
  .brand-text .addr { font-size: 10.5px; color: #6b7280; margin-top: 6px; line-height: 1.55; }
  .brand-text .gst-num { font-size: 10.5px; color: #374151; font-family: monospace; margin-top: 2px; }
  .divider { height: 2px; background: linear-gradient(90deg, ${opts.accentColor}, #06b6d4); border-radius: 2px; margin-bottom: 20px; }
  .inv-meta { text-align: right; }
  .inv-meta .inv-label { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
  .inv-meta .inv-no { font-size: 17px; font-weight: 800; color: #111827; letter-spacing: -0.3px; font-family: monospace; white-space: nowrap; }
  .inv-meta .inv-dates { font-size: 10.5px; color: #6b7280; margin-top: 6px; line-height: 1.7; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; margin-top: 8px; }
  .status-paid { background: #d1fae5; color: #065f46; }
  .status-pending { background: #fef3c7; color: #92400e; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .party-box h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  .party-box .name { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 4px; }
  .party-box p { font-size: 11px; color: #374151; line-height: 1.5; }
  .party-box .gst { font-family: monospace; font-size: 11px; color: #374151; margin-top: 4px; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  table.items th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; border-bottom: 2px solid #e5e7eb; padding: 8px 6px; text-align: left; }
  table.items th.num { text-align: right; }
  table.items td { padding: 10px 6px; border-bottom: 1px solid #f3f4f6; font-size: 12px; vertical-align: top; }
  table.items td.num { text-align: right; }
  table.items td.desc { color: #111827; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
  .totals-box { width: 280px; }
  table.tot { width: 100%; border-collapse: collapse; }
  table.tot td { padding: 5px 0; font-size: 12px; }
  table.tot td.lbl { color: #6b7280; }
  table.tot td.val { text-align: right; font-weight: 500; }
  .grand-total td { border-top: 2px solid #111827; padding-top: 10px; font-size: 14px; font-weight: 700; }
  .payment-info { background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
  .payment-info h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 10px; }
  .payment-info .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .payment-info .item label { font-size: 10px; color: #6b7280; display: block; }
  .payment-info .item span { font-size: 12px; color: #111827; font-weight: 500; }
  .footer { border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 10px; color: #9ca3af; text-align: center; line-height: 1.6; }
  @media print {
    body { background: #fff; }
    .page { padding: 16px 20px 20px; max-width: 100%; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="brand">
      ${opts.logoUrl ? `<img src="${opts.logoUrl}" alt="${opts.sellerName}" class="brand-logo" />` : `<div class="brand-name">${opts.sellerName}</div>`}
      <div class="brand-text">
        <h1>${opts.sellerName}</h1>
        <div class="doc-type">Tax Invoice</div>
        <div class="addr">${opts.sellerAddress}</div>
        <div class="gst-num">GSTIN: ${opts.sellerGst}</div>
      </div>
    </div>
    <div class="inv-meta">
      <div class="inv-label">Invoice Number</div>
      <div class="inv-no">${opts.invoiceNumber}</div>
      <div class="inv-dates">Date: ${formatDate(opts.invoiceDate)}<br/>Due: &nbsp;${formatDate(opts.dueDate)}</div>
      <span class="status-badge ${opts.status === 'paid' ? 'status-paid' : 'status-pending'}">${opts.status.toUpperCase()}</span>
    </div>
  </div>
  <div class="divider"></div>

  <div class="parties">
    <div class="party-box">
      <h3>From (Seller)</h3>
      <div class="name">${opts.sellerName}</div>
      <p>${opts.sellerAddress}</p>
      <p class="gst">GSTIN: ${opts.sellerGst}</p>
    </div>
    <div class="party-box">
      <h3>To (Bill To)</h3>
      <div class="name">${opts.buyerName}</div>
      ${opts.buyerAddress ? `<p>${opts.buyerAddress}</p>` : ''}
      ${opts.buyerGst ? `<p class="gst">GSTIN: ${opts.buyerGst}</p>` : ''}
      ${opts.buyerEmail ? `<p>${opts.buyerEmail}</p>` : ''}
      ${opts.buyerPhone ? `<p>${opts.buyerPhone}</p>` : ''}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:44%">Description</th>
        <th class="num">HSN/SAC</th>
        <th class="num">Amount</th>
        <th class="num">GST Rate</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <table class="tot">
        <tr><td class="lbl">Subtotal</td><td class="val">${formatINR(subtotal)}</td></tr>
        ${gstRows}
        <tr class="grand-total"><td class="lbl">Grand Total</td><td class="val">${formatINR(grandTotal)}</td></tr>
      </table>
    </div>
  </div>

  ${opts.paidDate ? `
  <div class="payment-info">
    <h3>Payment Details</h3>
    <div class="grid">
      <div class="item"><label>Paid On</label><span>${formatDate(opts.paidDate)}</span></div>
      ${opts.paymentMode ? `<div class="item"><label>Mode</label><span>${opts.paymentMode.replace(/_/g, ' ')}</span></div>` : ''}
      ${opts.paidBy ? `<div class="item"><label>Paid By</label><span>${opts.paidBy}</span></div>` : ''}
      ${opts.receiptReference ? `<div class="item"><label>Reference</label><span>${opts.receiptReference}</span></div>` : ''}
    </div>
    ${opts.remarks ? `<p style="margin-top:8px;font-size:11px;color:#6b7280;">${opts.remarks}</p>` : ''}
  </div>` : ''}

  <div class="footer">
    <!-- When THIS copy was printed, distinct from the invoice Date above. -->
    <p>${printedOnLine()}</p>
    <p>This is a computer-generated invoice. No signature required.</p>
    <p>SAC Code ${opts.sacCode} — Information Technology (IT) Consulting and Support Services</p>
    <p style="margin-top:4px;">For billing queries: ${opts.sellerEmail}</p>
  </div>
</div>

<div class="no-print" style="position:fixed;top:16px;right:16px;">
  <button onclick="window.print()" style="background:${opts.accentColor};color:#fff;border:none;padding:8px 18px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">
    Print / Save PDF
  </button>
</div>
</body>
</html>`;
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (req, context) => {
  try {
    const params = await context?.params;
    const invoiceId = params?.invoiceId as string;
    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'invoiceId required' }, { status: 400 });
    }

    const record = await db.billingRecord.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: {
            business: {
              select: {
                id: true, name: true, slug: true, gstNumber: true,
                address: true, city: true, state: true, pincode: true,
                contactEmail: true, contactPhone: true,
              },
            },
            plan: { select: { name: true, tier: true } },
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    const biz = record.subscription.business;
    const buyerAddress = [biz.address, biz.city, biz.state, biz.pincode].filter(Boolean).join(', ');

    const ps = await getPlatformSettings();
    const sellerName    = ps.companyName;
    const sellerAddress = ps.companyAddress;
    const sellerGst     = ps.companyGst;
    const sellerEmail   = ps.companyEmail;
    // Invoice HTML opens as blob:// — relative URLs have no origin. Build an
    // absolute URL exactly like the email route does.
    const baseUrl = (process.env.DEPLOY_APP_URL ?? 'https://app.quantixtechnology.in').replace(/\/$/, '');

    // Parse lineItems if present
    let parsedLineItems: LineItem[] | null = null;
    if (record.lineItems) {
      try { parsedLineItems = JSON.parse(record.lineItems) as LineItem[]; } catch { /* fall back to legacy */ }
    }

    const html = buildInvoiceHtml({
      invoiceNumber: record.invoiceNumber ?? `INV-${record.id.slice(0, 8).toUpperCase()}`,
      invoiceDate: record.createdAt,
      dueDate: record.dueDate,
      paidDate: record.paidDate,
      status: record.status,
      sellerName,
      sellerAddress,
      sellerGst,
      sellerEmail,
      logoUrl: salesDocLogoUrl(ps, baseUrl),
      accentColor: salesDocAccentColor(ps),
      sacCode: ps.sacCode,
      buyerName: biz.name,
      buyerAddress,
      buyerGst: biz.gstNumber,
      buyerEmail: biz.contactEmail,
      buyerPhone: biz.contactPhone,
      planName: record.subscription.plan.name,
      periodLabel: record.periodLabel,
      description: record.description ?? '',
      baseAmount: record.amount,
      lineItems: parsedLineItems,
      gstRate: record.gstRate,
      cgstAmount: record.cgstAmount,
      sgstAmount: record.sgstAmount,
      igstAmount: record.igstAmount,
      totalWithGst: record.totalWithGst,
      extraStores: record.extraStores,
      extraStoreAmount: record.extraStoreAmount,
      paymentMode: record.paymentMode,
      receiptReference: record.receiptReference,
      paidBy: record.paidBy,
      remarks: record.remarks,
    });

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="invoice-${record.invoiceNumber ?? record.id}.html"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate invoice';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
