// ============================================================================
// Route: POST /api/admin/billing/[businessId]/mark-received
// Manually records a subscription payment received for a business.
// Does NOT auto-activate business or stores — purely a manual record.
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `QTX-${year}${month}-${rand}`;
}

function addPeriod(date: Date, cycle: string): Date {
  const d = new Date(date);
  switch (cycle) {
    case 'MONTHLY':      d.setMonth(d.getMonth() + 1); break;
    case 'QUARTERLY':    d.setMonth(d.getMonth() + 3); break;
    case 'HALF_YEARLY':  d.setMonth(d.getMonth() + 6); break;
    case 'YEARLY':       d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 });
    }

    const body = (await req.json()) as {
      amount: number;
      paymentMode: string;
      paidBy?: string;
      receiptReference?: string;
      remarks?: string;
      periodYear?: number;
      periodLabel?: string;
      paidDate?: string;
    };

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ success: false, error: 'amount must be positive' }, { status: 400 });
    }
    if (!body.paymentMode) {
      return NextResponse.json({ success: false, error: 'paymentMode required' }, { status: 400 });
    }

    const sub = await db.businessSubscription.findUnique({
      where: { businessId },
      select: {
        id: true,
        status: true,
        billingCycle: true,
        currentPeriodEnd: true,
        nextBillingDate: true,
      },
    });
    if (!sub) {
      return NextResponse.json({ success: false, error: 'No subscription found for this business' }, { status: 404 });
    }

    const paidDate = body.paidDate ? new Date(body.paidDate) : new Date();

    // Create BillingRecord
    await db.billingRecord.create({
      data: {
        businessSubscriptionId: sub.id,
        amount: body.amount,
        currency: 'INR',
        status: 'paid',
        invoiceNumber: generateInvoiceNumber(),
        dueDate: sub.nextBillingDate,
        paidDate,
        paymentMode: body.paymentMode,
        paidBy: body.paidBy ?? null,
        receiptReference: body.receiptReference ?? null,
        remarks: body.remarks ?? null,
        periodYear: body.periodYear ?? paidDate.getFullYear(),
        periodLabel: body.periodLabel ?? null,
        description: `Manual payment received — ${body.paymentMode}`,
      },
    });

    // Advance subscription period
    const newPeriodStart = sub.nextBillingDate;
    const newPeriodEnd = addPeriod(newPeriodStart, sub.billingCycle);
    const newNextBilling = new Date(newPeriodEnd);

    await db.businessSubscription.update({
      where: { id: sub.id },
      data: {
        lastPaymentDate: paidDate,
        lastPaymentAmount: body.amount,
        paymentVerified: true,
        paymentVerifiedAt: paidDate,
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        nextBillingDate: newNextBilling,
        // Only auto-restore PAST_DUE → ACTIVE, not SUSPENDED (requires manual decision)
        status: sub.status === 'PAST_DUE' ? 'ACTIVE' : undefined,
      },
    });

    // Audit log
    await db.activityLog.create({
      data: {
        businessId,
        action: 'BILLING_PAYMENT_RECEIVED',
        entity: 'BusinessSubscription',
        entityId: sub.id,
        details: JSON.stringify({
          amount: body.amount,
          paymentMode: body.paymentMode,
          receiptReference: body.receiptReference,
          periodLabel: body.periodLabel,
        }),
      },
    });

    return NextResponse.json({ success: true, message: 'Payment recorded successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record payment';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
