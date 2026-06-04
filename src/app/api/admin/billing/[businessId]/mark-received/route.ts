// ============================================================================
// Route: POST /api/admin/billing/[businessId]/mark-received
// Records a subscription payment. Includes all ACTIVE RECURRING add-ons
// in the invoice line items. Generates sequential QTX/YYYY-YY/0001 invoice.
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { getPlatformSettings } from '@/lib/platform-settings';

const EXTRA_STORE_RATE = 1999;

function getFinancialYear(date: Date): string {
  const m = date.getMonth();
  const y = date.getFullYear();
  const startYear = m >= 3 ? y : y - 1;
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${String(endYear).padStart(2, '0')}`;
}

async function generateInvoiceNumber(date: Date, prefix: string): Promise<string> {
  const financialYear = getFinancialYear(date);
  const seq = await db.invoiceSequence.upsert({
    where: { financialYear },
    update: { nextVal: { increment: 1 } },
    create: { financialYear, nextVal: 2 },
  });
  const serial = seq.nextVal - 1;
  return `${prefix}/${financialYear}/${String(serial).padStart(4, '0')}`;
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
      includeGst?: boolean;
      isInterState?: boolean;
    };

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ success: false, error: 'amount must be positive' }, { status: 400 });
    }
    if (!body.paymentMode) {
      return NextResponse.json({ success: false, error: 'paymentMode required' }, { status: 400 });
    }

    const sub = await db.businessSubscription.findUnique({
      where: { businessId },
      include: { plan: true },
    });
    if (!sub) {
      return NextResponse.json({ success: false, error: 'No subscription found for this business' }, { status: 404 });
    }

    // Fetch all ACTIVE RECURRING add-ons for this business
    const activeAddons = await db.addon.findMany({
      where: { businessId, status: 'ACTIVE', billingType: 'RECURRING' },
      orderBy: { createdAt: 'asc' },
    });

    const paidDate = body.paidDate ? new Date(body.paidDate) : new Date();
    const includeGst = body.includeGst !== false;

    // Extra store charges (legacy system)
    const extraStores = Math.max(0, (sub.allowedStores ?? 1) - (sub.plan.maxStores ?? 1));
    const extraStoreAmount = extraStores > 0 ? extraStores * EXTRA_STORE_RATE : 0;

    // Add-on total
    const addonTotal = activeAddons.reduce((sum, a) => sum + a.amount, 0);

    // Line items array
    type LineItem = { name: string; description?: string; amount: number; type: string };
    const lineItems: LineItem[] = [
      { name: `${sub.plan.name} — Platform Subscription`, amount: body.amount, type: 'SUBSCRIPTION' },
    ];
    if (extraStores > 0) {
      lineItems.push({ name: `Additional Stores (${extraStores} × ₹${EXTRA_STORE_RATE.toLocaleString('en-IN')})`, amount: extraStoreAmount, type: 'EXTRA_STORE' });
    }
    for (const addon of activeAddons) {
      lineItems.push({ name: addon.name, description: addon.description || undefined, amount: addon.amount, type: 'ADDON' });
    }

    // Base = subscription + extra stores + addons (pre-GST)
    const baseTotal = body.amount + extraStoreAmount + addonTotal;

    // GST computation on full base
    let cgstAmount: number | null = null;
    let sgstAmount: number | null = null;
    let igstAmount: number | null = null;
    let totalWithGst: number | null = null;

    const ps = await getPlatformSettings();

    if (includeGst) {
      const isInterState = body.isInterState ?? false;
      const gstAmount = Math.round(baseTotal * (ps.gstRate / 100) * 100) / 100;
      if (isInterState) {
        igstAmount = gstAmount;
        cgstAmount = 0;
        sgstAmount = 0;
      } else {
        cgstAmount = Math.round(baseTotal * (ps.cgstRate / 100) * 100) / 100;
        sgstAmount = Math.round(baseTotal * (ps.sgstRate / 100) * 100) / 100;
        igstAmount = 0;
      }
      totalWithGst = Math.round((baseTotal + gstAmount) * 100) / 100;
    }

    const invoiceNumber = await generateInvoiceNumber(paidDate, ps.invoicePrefix);

    await db.billingRecord.create({
      data: {
        businessSubscriptionId: sub.id,
        amount: body.amount,
        currency: 'INR',
        status: 'paid',
        invoiceNumber,
        dueDate: sub.nextBillingDate,
        paidDate,
        paymentMode: body.paymentMode,
        paidBy: body.paidBy ?? null,
        receiptReference: body.receiptReference ?? null,
        remarks: body.remarks ?? null,
        periodYear: body.periodYear ?? paidDate.getFullYear(),
        periodLabel: body.periodLabel ?? null,
        description: `Platform subscription — ${sub.plan.name} — ${body.paymentMode}`,
        gstRate: includeGst ? ps.gstRate : null,
        cgstAmount: cgstAmount ?? null,
        sgstAmount: sgstAmount ?? null,
        igstAmount: igstAmount ?? null,
        totalWithGst: totalWithGst ?? null,
        extraStores: extraStores > 0 ? extraStores : null,
        extraStoreAmount: extraStoreAmount > 0 ? extraStoreAmount : null,
        lineItems: lineItems.length > 1 ? JSON.stringify(lineItems) : null,
        addonTotal: addonTotal > 0 ? addonTotal : null,
      },
    });

    // Advance subscription period
    const newPeriodStart = sub.nextBillingDate;
    const newPeriodEnd = addPeriod(newPeriodStart, sub.billingCycle);

    await db.businessSubscription.update({
      where: { id: sub.id },
      data: {
        lastPaymentDate: paidDate,
        lastPaymentAmount: body.amount,
        paymentVerified: true,
        paymentVerifiedAt: paidDate,
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        nextBillingDate: newPeriodEnd,
        status: sub.status === 'PAST_DUE' ? 'ACTIVE' : undefined,
      },
    });

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
          invoiceNumber,
          totalWithGst,
          activeAddonCount: activeAddons.length,
          addonTotal,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment recorded successfully',
      invoiceNumber,
      addonCount: activeAddons.length,
      addonTotal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record payment';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
