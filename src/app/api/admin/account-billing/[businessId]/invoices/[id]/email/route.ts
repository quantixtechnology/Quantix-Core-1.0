// POST /api/admin/account-billing/[businessId]/invoices/[id]/email
// Send invoice or payment receipt email to the business contact.
// Writes INVOICE_EMAILED audit entry.

import { db }                        from '@/lib/db'
import { NextResponse }              from 'next/server'
import { withMiddleware }            from '@/lib/middleware'
import { sendTransactionalEmail }    from '@/lib/email-service'
import { getPlatformSettings }       from '@/lib/platform-settings'
import type { NextRequest }          from 'next/server'

interface LineItem { name: string; description?: string | null; quantity: number; unitPrice: number; amount: number }

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function buildEmailHtml(opts: {
  invoice:     Record<string, unknown>
  business:    Record<string, unknown>
  ps:          { companyName: string; companyAddress: string; companyEmail: string; companyPhone: string | null; companyGst: string; sacCode: string }
  lineItems:   LineItem[]
  accentColor: string
  logoUrl:     string | null
  baseUrl:     string
}): string {
  const { invoice, business, ps, lineItems, accentColor, logoUrl, baseUrl } = opts
  const isPaid   = invoice.status === 'PAID'
  const balance  = Math.max(0, (invoice.totalAmount as number) - (invoice.paidAmount as number))
  const subject  = isPaid ? 'Payment Receipt' : 'Invoice'

  const lineRows = lineItems.map(li => `
    <tr>
      <td style="padding:8px 0;color:#374151;border-bottom:1px solid #f3f4f6;">
        ${li.name}${li.description ? `<br/><span style="font-size:10px;color:#9ca3af;">${li.description}</span>` : ''}
      </td>
      <td style="padding:8px 0;text-align:center;border-bottom:1px solid #f3f4f6;color:#6b7280;">${li.quantity}</td>
      <td style="padding:8px 0;text-align:right;border-bottom:1px solid #f3f4f6;color:#374151;">${fmt(li.unitPrice)}</td>
      <td style="padding:8px 0;text-align:right;border-bottom:1px solid #f3f4f6;font-weight:600;">${fmt(li.amount)}</td>
    </tr>`).join('')

  const taxRows = [
    (invoice.cgstAmount as number) > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;">CGST (${invoice.cgstRate}%)</td><td style="text-align:right;">${fmt(invoice.cgstAmount as number)}</td></tr>` : '',
    (invoice.sgstAmount as number) > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;">SGST (${invoice.sgstRate}%)</td><td style="text-align:right;">${fmt(invoice.sgstAmount as number)}</td></tr>` : '',
    (invoice.igstAmount as number) > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;">IGST (${invoice.igstRate}%)</td><td style="text-align:right;">${fmt(invoice.igstAmount as number)}</td></tr>` : '',
  ].join('')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>${subject} ${invoice.invoiceNumber}</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">

  <!-- Header -->
  <tr><td style="background:${accentColor};padding:28px 32px;">
    ${logoUrl ? `<div style="background:#fff;border-radius:10px;padding:8px 16px;display:inline-block;margin-bottom:12px;">
      <img src="${logoUrl}" alt="${ps.companyName}" style="max-height:40px;width:auto;display:block;"/>
    </div><br/>` : ''}
    <span style="color:#fff;font-size:20px;font-weight:800;">${ps.companyName}</span>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">
      ${isPaid ? 'Payment Receipt' : 'Tax Invoice'}
    </p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px;">

    <!-- Invoice meta -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td>
          <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;">Invoice Number</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:700;font-family:monospace;color:#111827;">${invoice.invoiceNumber}</p>
          ${invoice.billingPeriod ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${invoice.billingPeriod}</p>` : ''}
        </td>
        <td style="text-align:right;vertical-align:top;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">Issued</p>
          <p style="margin:2px 0 0;font-size:12px;color:#374151;">${fmtDate(invoice.issuedDate as string | null)}</p>
          ${invoice.dueDate ? `<p style="margin:6px 0 0;font-size:11px;color:#9ca3af;">Due</p>
          <p style="margin:2px 0 0;font-size:12px;color:${isPaid ? '#374151' : '#dc2626'};font-weight:600;">${fmtDate(invoice.dueDate as string | null)}</p>` : ''}
        </td>
      </tr>
    </table>

    <p style="margin:0 0 20px;font-size:14px;color:#374151;">
      Dear <strong>${business.name as string}</strong>, please find your ${isPaid ? 'payment receipt' : 'invoice'} below.
    </p>

    <!-- Line items -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <tr>
        <td colspan="4" style="padding-bottom:10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Services</td>
      </tr>
      <tr style="font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">
        <td style="padding-bottom:6px;">Description</td>
        <td style="text-align:center;">Qty</td>
        <td style="text-align:right;">Unit</td>
        <td style="text-align:right;">Amount</td>
      </tr>
      ${lineRows}
      <tr><td colspan="4" style="border-top:1px solid #e5e7eb;padding-top:4px;"></td></tr>
      <tr><td colspan="2" style="padding:5px 0;color:#6b7280;">Subtotal</td><td colspan="2" style="text-align:right;">${fmt(invoice.subtotal as number)}</td></tr>
      ${taxRows}
      <tr>
        <td colspan="2" style="padding:8px 0;font-weight:700;font-size:15px;color:#111827;">Total</td>
        <td colspan="2" style="text-align:right;font-weight:700;font-size:15px;color:${accentColor};">${fmt(invoice.totalAmount as number)}</td>
      </tr>
      ${(invoice.paidAmount as number) > 0 ? `
      <tr>
        <td colspan="2" style="padding:4px 0;color:#059669;font-weight:600;">Paid</td>
        <td colspan="2" style="text-align:right;color:#059669;font-weight:600;">${fmt(invoice.paidAmount as number)}</td>
      </tr>` : ''}
    </table>

    <!-- Status box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${isPaid ? '#f0fdf4' : '#fffbeb'};border:1px solid ${isPaid ? '#86efac' : '#fde68a'};border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <tr>
        <td>
          <p style="margin:0;font-size:14px;font-weight:700;color:${isPaid ? '#059669' : '#d97706'};">${isPaid ? '✓ Payment Received' : 'Amount Due'}</p>
          ${isPaid ? '<p style="margin:4px 0 0;font-size:11px;color:#6b7280;">Thank you — your account is settled.</p>' : `<p style="margin:4px 0 0;font-size:11px;color:#6b7280;">Please pay by ${fmtDate(invoice.dueDate as string | null)}</p>`}
        </td>
        <td style="text-align:right;">
          <p style="margin:0;font-size:22px;font-weight:800;color:${isPaid ? '#059669' : '#d97706'};font-family:monospace;">${fmt(isPaid ? 0 : balance)}</p>
        </td>
      </tr>
    </table>

    ${invoice.notes ? `<p style="margin:0 0 20px;font-size:13px;color:#6b7280;background:#f9fafb;border-radius:8px;padding:12px 16px;"><strong style="color:#374151;">Note:</strong> ${invoice.notes}</p>` : ''}

    <p style="margin:0 0 16px;font-size:13px;color:#374151;">
      For queries: <a href="mailto:${ps.companyEmail}" style="color:${accentColor};">${ps.companyEmail}</a>
    </p>
    <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;line-height:1.7;">
      Computer-generated invoice — ${ps.companyName}. HSN/SAC: ${ps.sacCode}.<br/>
      ${ps.companyAddress}
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export const POST = withMiddleware({
  requireAuth:   true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req: NextRequest, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    const id         = params?.id         as string

    const body = await req.json() as { overrideTo?: string }

    const invoice = await db.billingInvoice.findFirst({
      where:   { id, businessId },
      include: {
        account: {
          include: {
            business: {
              select: { name: true, contactEmail: true, contactPhone: true },
            },
          },
        },
      },
    })
    if (!invoice) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })

    const business = invoice.account.business
    const toEmail  = body.overrideTo ?? business.contactEmail
    if (!toEmail) return NextResponse.json({ success: false, error: 'No recipient email — business has no contactEmail' }, { status: 400 })

    const ps = await getPlatformSettings()
    const baseUrl     = (process.env.DEPLOY_APP_URL ?? 'https://app.quantixtechnology.in').replace(/\/$/, '')
    const accentColor = ps.salesAccentColor ?? ps.primaryColor ?? '#7c3aed'
    const logoUrl     = ps.salesLogoUrl ?? ps.emailLogoUrl ?? ps.logoUrl ?? null
    const absoluteLogo = logoUrl
      ? (logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`)
      : null

    let lineItems: LineItem[] = []
    try { lineItems = JSON.parse(invoice.lineItems) } catch {
      const items = await db.billingInvoiceItem.findMany({ where: { invoiceId: id } })
      lineItems = items.map(i => ({ name: i.name, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, amount: i.amount }))
    }

    const html = buildEmailHtml({
      invoice:   invoice as unknown as Record<string, unknown>,
      business:  business as unknown as Record<string, unknown>,
      ps,
      lineItems,
      accentColor,
      logoUrl:   absoluteLogo,
      baseUrl,
    })

    const isPaid   = invoice.status === 'PAID'
    const subject  = isPaid
      ? `Payment Receipt — ${invoice.invoiceNumber} — ${ps.companyName}`
      : `Invoice — ${invoice.invoiceNumber} — ${ps.companyName}`

    const result = await sendTransactionalEmail(toEmail, subject, html)

    // Audit
    const performedById   = req.headers.get('x-user-id')   ?? null
    const performedByName = req.headers.get('x-user-name') ?? null
    await db.billingAudit.create({
      data: {
        accountId:       invoice.accountId,
        businessId,
        action:          'INVOICE_EMAILED',
        entityType:      'INVOICE',
        entityId:        id,
        description:     `Invoice ${invoice.invoiceNumber} emailed to ${toEmail}`,
        metadata:        JSON.stringify({ to: toEmail, sent: result.sent, error: result.error }),
        performedById,
        performedByName,
      },
    })

    if (!result.sent) {
      return NextResponse.json({ success: false, error: `Email delivery failed: ${result.error}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Invoice emailed to ${toEmail}` })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to email invoice'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
