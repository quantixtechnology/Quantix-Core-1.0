// ============================================================================
// GET  /api/admin/payment-plugins  — List all platform plugins + business access
// PATCH /api/admin/payment-plugins — Toggle global enable, assign to business,
//                                    assign stores, set canConfigure permission
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { platformOnly } from "@/lib/platform-guard"

// Canonical gateway definitions — source of truth for the plugin registry
const GATEWAY_DEFINITIONS = [
  { gateway: 'razorpay',    displayName: 'Razorpay',            description: 'India\'s most popular payment gateway. Supports UPI, Cards, Netbanking, Wallets.', supportedMethods: ['UPI','CARD','NETBANKING','WALLET'], webhookPath: '/api/core/payments/razorpay/webhook', docsUrl: 'https://razorpay.com/docs' },
  { gateway: 'phonepe',     displayName: 'PhonePe Business',    description: 'PhonePe\'s business payment suite. Strong UPI & QR coverage across India.', supportedMethods: ['UPI','WALLET','QR'], docsUrl: 'https://developer.phonepe.com' },
  { gateway: 'paytm',       displayName: 'Paytm Business',      description: 'Paytm Business payments — UPI, Wallet, Cards, EMI support.', supportedMethods: ['UPI','WALLET','CARD','EMI'], docsUrl: 'https://developer.paytm.com' },
  { gateway: 'bharatpe',    displayName: 'BharatPe',            description: 'BharatPe merchant payments — interoperable UPI QR, soundbox support.', supportedMethods: ['UPI','QR'], docsUrl: 'https://bharatpe.com/business' },
  { gateway: 'pinelabs',    displayName: 'Pine Labs',           description: 'Pine Labs POS — card, contactless, EMI, and multi-bank acquiring.', supportedMethods: ['CARD','CONTACTLESS','EMI'], docsUrl: 'https://developer.pinelabs.com' },
  { gateway: 'cashfree',    displayName: 'Cashfree Payments',   description: 'Cashfree — fast settlement, subscriptions, split pay, payouts.', supportedMethods: ['UPI','CARD','NETBANKING','WALLET'], docsUrl: 'https://docs.cashfree.com' },
  { gateway: 'payu',        displayName: 'PayU India',          description: 'PayU — credit/debit cards, netbanking, UPI, EMI, buy-now-pay-later.', supportedMethods: ['CARD','NETBANKING','UPI','EMI'], docsUrl: 'https://devguide.payu.in' },
  { gateway: 'stripe',      displayName: 'Stripe',              description: 'Stripe — global cards, USD/multi-currency, subscriptions, webhooks.', supportedMethods: ['CARD','WALLET','ACH'], docsUrl: 'https://stripe.com/docs' },
  { gateway: 'hdfc',        displayName: 'HDFC SmartGateway',   description: 'HDFC Bank\'s SmartGateway — direct bank integration, EMI offers.', supportedMethods: ['CARD','NETBANKING','UPI','EMI'], docsUrl: 'https://smartgateway.hdfcbank.com' },
  { gateway: 'ccavenue',    displayName: 'CCAvenue',            description: 'CCAvenue — 200+ payment options, multi-currency, subscription billing.', supportedMethods: ['CARD','NETBANKING','UPI','WALLET','EMI'], docsUrl: 'https://www.ccavenue.com' },
] as const;

// Seed all defined gateways into the database (idempotent)
async function seedPlugins() {
  for (const def of GATEWAY_DEFINITIONS) {
    await db.platformPaymentPlugin.upsert({
      where: { gateway: def.gateway },
      update: { displayName: def.displayName, description: def.description, supportedMethods: JSON.stringify(def.supportedMethods), webhookPath: (def as Record<string, unknown>).webhookPath as string | undefined, docsUrl: def.docsUrl },
      create: {
        gateway: def.gateway,
        displayName: def.displayName,
        description: def.description,
        supportedMethods: JSON.stringify(def.supportedMethods),
        webhookPath: (def as Record<string, unknown>).webhookPath as string | undefined,
        docsUrl: def.docsUrl,
        isGloballyEnabled: def.gateway === 'razorpay', // Razorpay pre-enabled
      },
    });
  }
}

export async function GET(request: NextRequest) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(request)
  if (_denied) return _denied
  try {
    await seedPlugins();

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    const plugins = await db.platformPaymentPlugin.findMany({
      orderBy: { displayName: 'asc' },
      include: businessId
        ? { businessAccess: { where: { businessId }, take: 1 } }
        : { businessAccess: { include: { business: { select: { id: true, name: true, businessType: true } } } } },
    });

    return NextResponse.json({ success: true, data: plugins });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list plugins';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(request)
  if (_denied) return _denied
  try {
    const body = (await request.json()) as {
      action: 'toggle_global' | 'assign_business' | 'set_can_configure' | 'set_active' | 'save_config' | 'assign_stores';
      pluginId?: string;
      gateway?: string;
      businessId?: string;
      value?: boolean;
      config?: Record<string, unknown>;
      notes?: string;
      storeIds?: string[];
    };

    if (body.action === 'toggle_global') {
      const plugin = body.pluginId
        ? await db.platformPaymentPlugin.findUnique({ where: { id: body.pluginId } })
        : await db.platformPaymentPlugin.findUnique({ where: { gateway: body.gateway || '' } });
      if (!plugin) return NextResponse.json({ success: false, error: 'Plugin not found' }, { status: 404 });

      const updated = await db.platformPaymentPlugin.update({
        where: { id: plugin.id },
        data: { isGloballyEnabled: body.value ?? !plugin.isGloballyEnabled },
      });
      return NextResponse.json({ success: true, data: updated, message: `${plugin.displayName} ${updated.isGloballyEnabled ? 'enabled' : 'disabled'} globally` });
    }

    if (body.action === 'assign_business') {
      if (!body.businessId || !body.pluginId) return NextResponse.json({ success: false, error: 'businessId and pluginId required' }, { status: 400 });
      const access = await db.businessGatewayAccess.upsert({
        where: { businessId_pluginId: { businessId: body.businessId, pluginId: body.pluginId } },
        update: { isAssigned: body.value ?? true, assignedAt: body.value ? new Date() : null, notes: body.notes },
        create: { businessId: body.businessId, pluginId: body.pluginId, isAssigned: body.value ?? true, assignedAt: body.value ? new Date() : null, notes: body.notes },
      });
      return NextResponse.json({ success: true, data: access });
    }

    if (body.action === 'set_can_configure') {
      if (!body.businessId || !body.pluginId) return NextResponse.json({ success: false, error: 'businessId and pluginId required' }, { status: 400 });
      const access = await db.businessGatewayAccess.upsert({
        where: { businessId_pluginId: { businessId: body.businessId, pluginId: body.pluginId } },
        update: { canConfigure: body.value ?? false },
        create: { businessId: body.businessId, pluginId: body.pluginId, isAssigned: true, canConfigure: body.value ?? false },
      });
      return NextResponse.json({ success: true, data: access });
    }

    if (body.action === 'save_config') {
      if (!body.businessId || !body.pluginId) return NextResponse.json({ success: false, error: 'businessId and pluginId required' }, { status: 400 });
      const access = await db.businessGatewayAccess.upsert({
        where: { businessId_pluginId: { businessId: body.businessId, pluginId: body.pluginId } },
        update: { config: JSON.stringify(body.config || {}), isActive: true },
        create: { businessId: body.businessId, pluginId: body.pluginId, isAssigned: true, config: JSON.stringify(body.config || {}), isActive: true },
      });
      return NextResponse.json({ success: true, data: access, message: 'Gateway configuration saved' });
    }

    if (body.action === 'assign_stores') {
      if (!body.businessId || !body.pluginId) return NextResponse.json({ success: false, error: 'businessId and pluginId required' }, { status: 400 });
      const storeIds = body.storeIds ?? [];
      const access = await db.businessGatewayAccess.upsert({
        where: { businessId_pluginId: { businessId: body.businessId, pluginId: body.pluginId } },
        update: { assignedStoreIds: JSON.stringify(storeIds) },
        create: { businessId: body.businessId, pluginId: body.pluginId, isAssigned: true, assignedStoreIds: JSON.stringify(storeIds) },
      });
      return NextResponse.json({ success: true, data: access, message: `${storeIds.length} store(s) assigned` });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Operation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
