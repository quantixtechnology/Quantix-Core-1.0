// ============================================================================
// Route: POST /api/admin/billing/invoices/[invoiceId]/email
// Emails a platform invoice to the business contact email.
// Renders individual line items when present (add-ons etc.).
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { sendTransactionalEmail } from '@/lib/email-service';

interface LineItem { name: string; description?: string; amount: number; type: string }

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildInvoiceEmailHtml(opts: {
  invoiceNumber: string;
  businessName: string;
  planName: string;
  periodLabel: string | null;
  baseAmount: number;
  lineItems: LineItem[] | null;
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
  totalWithGst: number | null;
  gstRate: number | null;
  extraStores: number | null;
  extraStoreAmount: number | null;
  paidDate: Date | null;
  dueDate: Date;
  status: string;
  paymentMode: string | null;
  receiptReference: string | null;
}): string {
  const cgst = opts.cgstAmount ?? 0;
  const sgst = opts.sgstAmount ?? 0;
  const igst = opts.igstAmount ?? 0;
  const gstRate = opts.gstRate ?? 18;
  const hasGst = opts.gstRate != null;
  const isInterState = igst > 0;

  // Build line item rows
  let itemRows = '';
  let subtotal = 0;

  if (opts.lineItems && opts.lineItems.length > 0) {
    for (const item of opts.lineItems) {
      subtotal += item.amount;
      itemRows += `<tr>
        <td style="padding:8px 0;color:#374151;border-bottom:1px solid #f3f4f6;">
          ${item.name}${item.description ? `<br/><span style="font-size:10px;color:#9ca3af;">${item.description}</span>` : ''}
        </td>
        <td style="padding:8px 0;text-align:right;border-bottom:1px solid #f3f4f6;">${formatINR(item.amount)}</td>
      </tr>`;
    }
  } else {
    const extraStoreAmt = opts.extraStoreAmount ?? 0;
    subtotal = opts.baseAmount + extraStoreAmt;
    itemRows = `<tr>
      <td style="padding:8px 0;color:#374151;border-bottom:1px solid #f3f4f6;">
        ${opts.planName} — Platform Subscription
        ${opts.periodLabel ? `<br/><span style="font-size:10px;color:#9ca3af;">${opts.periodLabel}</span>` : ''}
      </td>
      <td style="padding:8px 0;text-align:right;border-bottom:1px solid #f3f4f6;">${formatINR(opts.baseAmount)}</td>
    </tr>`;
    if ((opts.extraStores ?? 0) > 0) {
      itemRows += `<tr>
        <td style="padding:8px 0;color:#374151;border-bottom:1px solid #f3f4f6;">Additional Stores (${opts.extraStores} × ₹1,999)</td>
        <td style="padding:8px 0;text-align:right;border-bottom:1px solid #f3f4f6;">${formatINR(extraStoreAmt)}</td>
      </tr>`;
    }
  }

  const grandTotal = opts.totalWithGst ?? subtotal;

  const gstRows = hasGst
    ? isInterState
      ? `<tr><td style="padding:4px 0;color:#6b7280;">IGST (${gstRate}%)</td><td style="text-align:right;">${formatINR(igst)}</td></tr>`
      : `<tr><td style="padding:4px 0;color:#6b7280;">CGST (${gstRate / 2}%)</td><td style="text-align:right;">${formatINR(cgst)}</td></tr>
         <tr><td style="padding:4px 0;color:#6b7280;">SGST (${gstRate / 2}%)</td><td style="text-align:right;">${formatINR(sgst)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Invoice ${opts.invoiceNumber}</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">
  <tr><td style="background:#10B981;padding:28px 32px;">
    <p style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">Quantix Technology</p>
    <p style="margin:4px 0 0;color:#d1fae5;font-size:13px;">Platform Invoice</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Invoice Number</p>
    <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#111827;font-family:monospace;">${opts.invoiceNumber}</p>

    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      Dear <strong>${opts.businessName}</strong>, please find your platform invoice below.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <tr><td colspan="2" style="padding-bottom:10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Invoice Summary</td></tr>
      ${itemRows}
      <tr><td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:4px;"></td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Subtotal</td><td style="text-align:right;">${formatINR(subtotal)}</td></tr>
      ${gstRows}
      <tr>
        <td style="padding:8px 0;font-weight:700;font-size:15px;color:#111827;">Total</td>
        <td style="text-align:right;font-weight:700;font-size:15px;color:#10B981;">${formatINR(grandTotal)}</td>
      </tr>
      <tr><td style="padding:4px 0;color:#6b7280;font-size:11px;">Due Date</td><td style="text-align:right;font-size:11px;">${formatDate(opts.dueDate)}</td></tr>
      ${opts.paidDate ? `<tr><td style="padding:4px 0;color:#059669;font-size:11px;">Paid On</td><td style="text-align:right;font-size:11px;color:#059669;">${formatDate(opts.paidDate)}</td></tr>` : ''}
      ${opts.paymentMode ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:11px;">Mode</td><td style="text-align:right;font-size:11px;">${opts.paymentMode.replace(/_/g, ' ')}</td></tr>` : ''}
      ${opts.receiptReference ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:11px;">Reference</td><td style="text-align:right;font-size:11px;">${opts.receiptReference}</td></tr>` : ''}
    </table>

    <p style="margin:0 0 16px;font-size:13px;color:#374151;">
      For queries: <a href="mailto:billing@quantixtechnology.in" style="color:#10B981;">billing@quantixtechnology.in</a>
    </p>
    <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;line-height:1.6;">
      Automated invoice — Quantix Technology. HSN/SAC: 998314.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const invoiceId = params?.invoiceId as string;
    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'invoiceId required' }, { status: 400 });
    }

    const body = (await req.json()) as { overrideTo?: string };

    const record = await db.billingRecord.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: {
            business: { select: { name: true, contactEmail: true } },
            plan: { select: { name: true } },
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    const toEmail = body.overrideTo ?? record.subscription.business.contactEmail;
    if (!toEmail) {
      return NextResponse.json({ success: false, error: 'No recipient email available' }, { status: 400 });
    }

    const invoiceNumber = record.invoiceNumber ?? `INV-${record.id.slice(0, 8).toUpperCase()}`;
    const businessName = record.subscription.business.name;

    let parsedLineItems: LineItem[] | null = null;
    if (record.lineItems) {
      try { parsedLineItems = JSON.parse(record.lineItems) as LineItem[]; } catch { /* fall back */ }
    }

    const html = buildInvoiceEmailHtml({
      invoiceNumber,
      businessName,
      planName: record.subscription.plan.name,
      periodLabel: record.periodLabel,
      baseAmount: record.amount,
      lineItems: parsedLineItems,
      cgstAmount: record.cgstAmount,
      sgstAmount: record.sgstAmount,
      igstAmount: record.igstAmount,
      totalWithGst: record.totalWithGst,
      gstRate: record.gstRate,
      extraStores: record.extraStores,
      extraStoreAmount: record.extraStoreAmount,
      paidDate: record.paidDate,
      dueDate: record.dueDate,
      status: record.status,
      paymentMode: record.paymentMode,
      receiptReference: record.receiptReference,
    });

    const subject = record.status === 'paid'
      ? `Payment Receipt — ${invoiceNumber} — Quantix Technology`
      : `Invoice — ${invoiceNumber} — Quantix Technology`;

    const result = await sendTransactionalEmail(toEmail, subject, html);

    await db.activityLog.create({
      data: {
        businessId: record.subscription.businessId,
        action: 'INVOICE_EMAILED',
        entity: 'BillingRecord',
        entityId: record.id,
        details: JSON.stringify({ to: toEmail, invoiceNumber, emailSent: result.sent, error: result.error }),
      },
    });

    if (!result.sent) {
      return NextResponse.json({ success: false, error: `Email delivery failed: ${result.error}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Invoice emailed to ${toEmail}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to email invoice';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
