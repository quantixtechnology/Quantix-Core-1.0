// ============================================================================
// Route: POST /api/admin/billing/[businessId]/send-reminder
// Sends a renewal reminder email to the business owner and updates reminderSentAt.
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { sendTransactionalEmail } from '@/lib/email-service';

const EXTRA_STORE_RATE = 1999;

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildReminderHtml(opts: {
  businessName: string;
  planName: string;
  billingCycle: string;
  amountDue: number;
  extraStores: number;
  extraStoreAmount: number;
  nextBillingDate: Date;
  daysUntilDue: number;
}): string {
  const isOverdue = opts.daysUntilDue < 0;
  const urgencyLabel = isOverdue
    ? `<strong style="color:#dc2626;">OVERDUE by ${Math.abs(opts.daysUntilDue)} day(s)</strong>`
    : opts.daysUntilDue === 0
    ? `<strong style="color:#d97706;">Due Today</strong>`
    : `Due in ${opts.daysUntilDue} day(s)`;

  const extraStoreRow = opts.extraStores > 0
    ? `<tr><td style="padding:6px 0;color:#6b7280;">Extra Stores (${opts.extraStores} × ${formatCurrency(EXTRA_STORE_RATE)})</td><td style="padding:6px 0;text-align:right;">${formatCurrency(opts.extraStoreAmount)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Subscription Renewal Reminder</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">
        <tr><td style="background:#10B981;padding:28px 32px;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Quantix Technology</p>
          <p style="margin:4px 0 0;color:#d1fae5;font-size:13px;">Subscription Renewal Reminder</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#111827;">Dear <strong>${opts.businessName}</strong>,</p>
          <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
            This is a reminder that your Quantix Platform subscription renewal is ${urgencyLabel}.
            Please arrange payment at the earliest to avoid service interruption.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
            <tr><td colspan="2" style="padding-bottom:10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;">Invoice Summary</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Plan</td><td style="padding:6px 0;text-align:right;font-weight:600;">${opts.planName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Billing Cycle</td><td style="padding:6px 0;text-align:right;">${opts.billingCycle}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Subscription Fee</td><td style="padding:6px 0;text-align:right;">${formatCurrency(opts.amountDue)}</td></tr>
            ${extraStoreRow}
            <tr><td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:10px;margin-top:10px;"></td></tr>
            <tr>
              <td style="padding:6px 0;font-weight:700;color:#111827;">Total Due</td>
              <td style="padding:6px 0;text-align:right;font-weight:700;font-size:16px;color:#10B981;">${formatCurrency(opts.amountDue + opts.extraStoreAmount)}</td>
            </tr>
            <tr><td style="padding:4px 0;color:#6b7280;font-size:12px;">Due Date</td><td style="padding:4px 0;text-align:right;font-size:12px;">${formatDate(opts.nextBillingDate)}</td></tr>
          </table>

          <p style="margin:0 0 8px;font-size:13px;color:#374151;">For payment or queries, please contact us:</p>
          <p style="margin:0;font-size:13px;color:#374151;">
            📧 <a href="mailto:billing@quantixtechnology.in" style="color:#10B981;">billing@quantixtechnology.in</a><br/>
            📞 Support: +91 XXXXX XXXXX
          </p>

          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
            This is an automated reminder from Quantix Technology. Please do not reply to this email directly.
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
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM', 'QUANTIX_SALES_TEAM'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 });
    }

    const sub = await db.businessSubscription.findUnique({
      where: { businessId },
      include: {
        plan: true,
        business: { select: { name: true, contactEmail: true, slug: true } },
      },
    });

    if (!sub) {
      return NextResponse.json({ success: false, error: 'No subscription found for this business' }, { status: 404 });
    }

    const contactEmail = sub.business.contactEmail;
    if (!contactEmail) {
      return NextResponse.json({ success: false, error: 'Business has no contact email configured' }, { status: 400 });
    }

    const now = new Date();
    const daysUntilDue = Math.ceil(
      (sub.nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const amountDue = sub.finalAmount ?? sub.subscriptionAmount ?? sub.customPrice ?? sub.planPrice ?? 0;
    const extraStores = Math.max(0, (sub.allowedStores ?? 1) - (sub.plan.maxStores ?? 1));
    const extraStoreAmount = extraStores > 0 ? extraStores * EXTRA_STORE_RATE : 0;

    const billingCycleLabel: Record<string, string> = {
      MONTHLY: 'Monthly',
      QUARTERLY: 'Quarterly',
      HALF_YEARLY: 'Half-Yearly',
      YEARLY: 'Yearly',
    };

    const html = buildReminderHtml({
      businessName: sub.business.name,
      planName: sub.plan.name,
      billingCycle: billingCycleLabel[sub.billingCycle] ?? sub.billingCycle,
      amountDue,
      extraStores,
      extraStoreAmount,
      nextBillingDate: sub.nextBillingDate,
      daysUntilDue,
    });

    const subject = daysUntilDue < 0
      ? `[OVERDUE] Quantix Subscription Renewal — ${sub.business.name}`
      : `Subscription Renewal Reminder — ${sub.business.name}`;

    const emailResult = await sendTransactionalEmail(contactEmail, subject, html);

    // Always update reminderSentAt even if email fails (to record the attempt)
    await db.businessSubscription.update({
      where: { id: sub.id },
      data: { reminderSentAt: now },
    });

    await db.activityLog.create({
      data: {
        businessId,
        action: 'BILLING_REMINDER_SENT',
        entity: 'BusinessSubscription',
        entityId: sub.id,
        details: JSON.stringify({
          to: contactEmail,
          emailSent: emailResult.sent,
          emailError: emailResult.error,
          daysUntilDue,
          amountDue,
        }),
      },
    });

    if (!emailResult.sent) {
      return NextResponse.json({
        success: true,
        warned: true,
        message: `Reminder logged but email delivery failed: ${emailResult.error}`,
        reminderSentAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Reminder sent to ${contactEmail}`,
      reminderSentAt: now,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send reminder';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
