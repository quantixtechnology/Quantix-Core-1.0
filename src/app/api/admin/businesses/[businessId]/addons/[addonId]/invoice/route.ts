// ============================================================================
// POST /api/admin/businesses/[businessId]/addons/[addonId]/invoice
// Generates a platform invoice for a ONE_TIME add-on and marks it COMPLETED.
// For RECURRING add-ons, use the standard mark-received flow which includes
// all active recurring add-ons automatically.
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

const GST_RATE = 18;

function getFinancialYear(date: Date): string {
  const m = date.getMonth();
  const y = date.getFullYear();
  const startYear = m >= 3 ? y : y - 1;
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${String(endYear).padStart(2, '0')}`;
}

async function generateInvoiceNumber(date: Date): Promise<string> {
  const financialYear = getFinancialYear(date);
  const seq = await db.invoiceSequence.upsert({
    where: { financialYear },
    update: { nextVal: { increment: 1 } },
    create: { financialYear, nextVal: 2 },
  });
  const serial = seq.nextVal - 1;
  return `QTX/${financialYear}/${String(serial).padStart(4, '0')}`;
}

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const addonId = params?.addonId as string;
    if (!businessId || !addonId) {
      return NextResponse.json({ success: false, error: 'businessId and addonId required' }, { status: 400 });
    }

    const addon = await db.addon.findFirst({
      where: { id: addonId, businessId },
    });
    if (!addon) return NextResponse.json({ success: false, error: 'Add-on not found' }, { status: 404 });
    if (addon.billingType !== 'ONE_TIME') {
      return NextResponse.json({
        success: false,
        error: 'Only ONE_TIME add-ons can be invoiced individually. Recurring add-ons are included in subscription renewals.',
      }, { status: 400 });
    }
    if (addon.status === 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Invoice already generated for this add-on' }, { status: 409 });
    }

    const sub = await db.businessSubscription.findUnique({
      where: { businessId },
      include: { plan: true },
    });
    if (!sub) {
      return NextResponse.json({ success: false, error: 'No subscription found for this business. Create a subscription first.' }, { status: 404 });
    }

    const body = (await req.json()).catch?.(() => ({})) as { isInterState?: boolean; paidDate?: string } ?? {};
    const isInterState = body.isInterState ?? false;
    const paidDate = body.paidDate ? new Date(body.paidDate) : new Date();

    const gstAmount = Math.round(addon.amount * (GST_RATE / 100) * 100) / 100;
    const cgstAmount = isInterState ? 0 : Math.round(gstAmount / 2 * 100) / 100;
    const sgstAmount = isInterState ? 0 : Math.round(gstAmount / 2 * 100) / 100;
    const igstAmount = isInterState ? gstAmount : 0;
    const totalWithGst = Math.round((addon.amount + gstAmount) * 100) / 100;

    const lineItems = JSON.stringify([
      { name: addon.name, description: addon.description || undefined, amount: addon.amount, type: 'ADDON' },
    ]);

    const invoiceNumber = await generateInvoiceNumber(paidDate);

    const record = await db.billingRecord.create({
      data: {
        businessSubscriptionId: sub.id,
        amount: addon.amount,
        currency: 'INR',
        status: 'paid',
        invoiceNumber,
        dueDate: paidDate,
        paidDate,
        description: `${addon.name} — One-time add-on`,
        gstRate: GST_RATE,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalWithGst,
        lineItems,
        addonTotal: addon.amount,
      },
    });

    // Mark addon as COMPLETED so it never appears again
    await db.addon.update({
      where: { id: addonId },
      data: { status: 'COMPLETED', invoicedAt: paidDate },
    });

    await db.activityLog.create({
      data: {
        businessId,
        action: 'ADDON_INVOICE_GENERATED',
        entity: 'BillingRecord',
        entityId: record.id,
        details: JSON.stringify({ addonId, addonName: addon.name, amount: addon.amount, invoiceNumber }),
      },
    });

    return NextResponse.json({
      success: true,
      invoiceNumber,
      billingRecordId: record.id,
      message: `Invoice ${invoiceNumber} generated. Add-on marked as COMPLETED.`,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate invoice';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
