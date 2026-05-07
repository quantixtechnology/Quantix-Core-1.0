// ============================================================================
// QUANTIX CORE — Dual Subscription Engine
//
// Part A: Platform Subscription (Quantix → Business)
//   - Businesses subscribe to platform plans (MONTHLY ₹4,999 / YEARLY ₹49,999)
//   - NO trial periods — business created ONLY after payment verified
//   - Super Admin can override pricing per customer
//   - Processes billing at the end of each cycle
//
// Part B: Customer Subscription (Business → Customer)
//   - Credit-based packages for Car Wash, Home Services, Laundry etc.
//   - Credit deduction, rollover on renewal, pause/resume, expiry tracking
//   - Cron-friendly renewal checks
//
// BUSINESS MODEL:
//   - NO free trial, NO self-signup
//   - Demo credentials given first; tenant created ONLY after payment verified
//   - Super Admin can override pricing per customer
// ============================================================================

import { db } from '@/lib/db';
import type { PlanBillingCycle } from './types';

// ============================================================================
// TYPES
// ============================================================================

export type SubscriptionBillingCycle = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

export type PlatformBillingCycle = PlanBillingCycle; // 'MONTHLY' | 'YEARLY'

export interface PlatformSubscriptionResult {
  success: boolean;
  subscription?: {
    id: string;
    businessId: string;
    planId: string;
    status: string;
    billingCycle: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    nextBillingDate: Date;
    planPrice: number;
    customPrice: number | null;
  };
  error?: string;
}

export interface BillingResult {
  success: boolean;
  billingRecord?: {
    id: string;
    amount: number;
    status: string;
    dueDate: Date;
  };
  error?: string;
}

export interface CustomerSubscriptionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface CreditDeductionResult {
  success: boolean;
  creditsUsed: number;
  remainingCredits: number;
  error?: string;
}

export interface RenewalCheckResult {
  subscriptionsNeedingRenewal: Array<{
    id: string;
    customerId: string;
    planName: string;
    nextBillingDate: Date;
    daysUntilBilling: number;
    autoRenew: boolean;
  }>;
  subscriptionsExpiringSoon: Array<{
    id: string;
    customerId: string;
    planName: string;
    currentPeriodEnd: Date;
    daysUntilExpiry: number;
    remainingCredits: number;
  }>;
}

// ============================================================================
// PART A: PLATFORM SUBSCRIPTION (Quantix → Business)
// NO TRIAL — Business subscription starts as ACTIVE after payment verified
// ============================================================================

/**
 * Create a platform subscription for a business.
 * Called ONLY after payment has been verified.
 * NO trial period — subscription starts as ACTIVE immediately.
 */
export async function createPlatformSubscription(params: {
  businessId: string;
  planId: string;
  billingCycle: PlatformBillingCycle;
  customPrice?: number;
  overrideReason?: string;
}): Promise<PlatformSubscriptionResult> {
  // Check if business already has a subscription
  const existing = await db.businessSubscription.findUnique({
    where: { businessId: params.businessId },
  });

  if (existing) {
    return { success: false, error: 'Business already has a platform subscription' };
  }

  // Validate plan exists and is active
  const plan = await db.platformPlan.findUnique({
    where: { id: params.planId },
  });

  if (!plan) {
    return { success: false, error: 'Platform plan not found' };
  }

  const now = new Date();

  // Get plan price from the plan record (price is per billing cycle now)
  const planPrice = plan.price;

  // Calculate period dates based on billing cycle
  const periodEnd = calculatePeriodEnd(now, params.billingCycle);

  // Determine effective price — custom price overrides plan price (Super Admin override)
  const effectivePrice = params.customPrice ?? planPrice;
  const hasOverride = params.customPrice !== undefined && params.customPrice !== planPrice;
  const discountPercentage = hasOverride && planPrice > 0
    ? Math.round(((planPrice - (params.customPrice || 0)) / planPrice) * 100 * 100) / 100
    : null;

  // Create subscription — starts as ACTIVE, NO TRIAL
  const subscription = await db.businessSubscription.create({
    data: {
      businessId: params.businessId,
      planId: params.planId,
      status: 'ACTIVE',
      planPrice,
      customPrice: params.customPrice,
      discountPercentage,
      manualPriceOverride: hasOverride,
      overrideReason: params.overrideReason,
      billingCycle: params.billingCycle === 'MONTHLY' ? 'monthly' : 'yearly',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingDate: periodEnd,
      nextPaymentAmount: effectivePrice,
      autoRenew: true,
      lastPaymentDate: now,
      lastPaymentAmount: effectivePrice,
    },
  });

  return {
    success: true,
    subscription: {
      id: subscription.id,
      businessId: subscription.businessId,
      planId: subscription.planId,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      nextBillingDate: subscription.nextBillingDate,
      planPrice: subscription.planPrice,
      customPrice: subscription.customPrice,
    },
  };
}

/**
 * Process a billing cycle for a platform subscription.
 * Creates a billing record and updates subscription period.
 */
export async function processBillingCycle(subscriptionId: string): Promise<BillingResult> {
  const subscription = await db.businessSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  const now = new Date();
  const effectivePrice = subscription.customPrice ?? subscription.planPrice;

  // Create billing record
  const invoiceNumber = `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-6)}`;
  const billingRecord = await db.billingRecord.create({
    data: {
      businessSubscriptionId: subscriptionId,
      amount: effectivePrice,
      currency: 'INR',
      status: 'pending',
      invoiceNumber,
      dueDate: subscription.nextBillingDate,
      description: `${subscription.billingCycle === 'yearly' ? 'Annual' : 'Monthly'} subscription - ${subscription.plan.name}`,
    },
  });

  // Calculate new period
  const billingCycle: PlatformBillingCycle = subscription.billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';
  const newPeriodEnd = calculatePeriodEnd(now, billingCycle);

  // Update subscription for next billing cycle
  await db.businessSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: newPeriodEnd,
      nextBillingDate: newPeriodEnd,
      nextPaymentAmount: effectivePrice,
    },
  });

  return {
    success: true,
    billingRecord: {
      id: billingRecord.id,
      amount: billingRecord.amount,
      status: billingRecord.status,
      dueDate: billingRecord.dueDate,
    },
  };
}

/**
 * Override subscription pricing — Super Admin only.
 * Allows setting a custom price for a business (e.g., enterprise negotiation).
 * Can be applied at any time during an active subscription.
 */
export async function overrideSubscriptionPricing(params: {
  subscriptionId: string;
  customPrice: number;
  reason: string;
}): Promise<PlatformSubscriptionResult> {
  const subscription = await db.businessSubscription.findUnique({
    where: { id: params.subscriptionId },
  });

  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  if (params.customPrice < 0) {
    return { success: false, error: 'Custom price cannot be negative' };
  }

  const discountPercentage = subscription.planPrice > 0
    ? Math.round(((subscription.planPrice - params.customPrice) / subscription.planPrice) * 100 * 100) / 100
    : 0;

  await db.businessSubscription.update({
    where: { id: params.subscriptionId },
    data: {
      customPrice: params.customPrice,
      manualPriceOverride: true,
      overrideReason: params.reason,
      discountPercentage,
      nextPaymentAmount: params.customPrice,
    },
  });

  const updated = await db.businessSubscription.findUnique({
    where: { id: params.subscriptionId },
  });

  return {
    success: true,
    subscription: updated ? {
      id: updated.id,
      businessId: updated.businessId,
      planId: updated.planId,
      status: updated.status,
      billingCycle: updated.billingCycle,
      currentPeriodStart: updated.currentPeriodStart,
      currentPeriodEnd: updated.currentPeriodEnd,
      nextBillingDate: updated.nextBillingDate,
      planPrice: updated.planPrice,
      customPrice: updated.customPrice,
    } : undefined,
  };
}

/**
 * Remove pricing override — Super Admin only.
 * Resets the subscription to the standard plan price.
 */
export async function removePricingOverride(subscriptionId: string): Promise<PlatformSubscriptionResult> {
  const subscription = await db.businessSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  await db.businessSubscription.update({
    where: { id: subscriptionId },
    data: {
      customPrice: null,
      manualPriceOverride: false,
      overrideReason: null,
      discountPercentage: null,
      nextPaymentAmount: subscription.planPrice,
    },
  });

  const updated = await db.businessSubscription.findUnique({
    where: { id: subscriptionId },
  });

  return {
    success: true,
    subscription: updated ? {
      id: updated.id,
      businessId: updated.businessId,
      planId: updated.planId,
      status: updated.status,
      billingCycle: updated.billingCycle,
      currentPeriodStart: updated.currentPeriodStart,
      currentPeriodEnd: updated.currentPeriodEnd,
      nextBillingDate: updated.nextBillingDate,
      planPrice: updated.planPrice,
      customPrice: updated.customPrice,
    } : undefined,
  };
}

/**
 * Suspend a platform subscription due to non-payment.
 * Called when payment is overdue or policy violation.
 */
export async function suspendPlatformSubscription(
  subscriptionId: string,
  reason: string
): Promise<PlatformSubscriptionResult> {
  const subscription = await db.businessSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  if (subscription.status === 'SUSPENDED') {
    return { success: false, error: 'Subscription is already suspended' };
  }

  await db.businessSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'SUSPENDED',
      pauseReason: reason,
    },
  });

  // Also suspend the business
  await db.business.update({
    where: { id: subscription.businessId },
    data: {
      status: 'SUSPENDED',
      suspendedAt: new Date(),
      isOnline: false,
    },
  });

  const updated = await db.businessSubscription.findUnique({
    where: { id: subscriptionId },
  });

  return {
    success: true,
    subscription: updated ? {
      id: updated.id,
      businessId: updated.businessId,
      planId: updated.planId,
      status: updated.status,
      billingCycle: updated.billingCycle,
      currentPeriodStart: updated.currentPeriodStart,
      currentPeriodEnd: updated.currentPeriodEnd,
      nextBillingDate: updated.nextBillingDate,
      planPrice: updated.planPrice,
      customPrice: updated.customPrice,
    } : undefined,
  };
}

/**
 * Reactivate a suspended platform subscription after payment received.
 */
export async function reactivatePlatformSubscription(
  subscriptionId: string
): Promise<PlatformSubscriptionResult> {
  const subscription = await db.businessSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  if (subscription.status !== 'SUSPENDED') {
    return { success: false, error: 'Only suspended subscriptions can be reactivated' };
  }

  const now = new Date();
  const billingCycle: PlatformBillingCycle = subscription.billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';
  const newPeriodEnd = calculatePeriodEnd(now, billingCycle);
  const effectivePrice = subscription.customPrice ?? subscription.planPrice;

  await db.businessSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: newPeriodEnd,
      nextBillingDate: newPeriodEnd,
      nextPaymentAmount: effectivePrice,
      pauseReason: null,
    },
  });

  // Also reactivate the business
  await db.business.update({
    where: { id: subscription.businessId },
    data: {
      status: 'ACTIVE',
      activatedAt: now,
    },
  });

  const updated = await db.businessSubscription.findUnique({
    where: { id: subscriptionId },
  });

  return {
    success: true,
    subscription: updated ? {
      id: updated.id,
      businessId: updated.businessId,
      planId: updated.planId,
      status: updated.status,
      billingCycle: updated.billingCycle,
      currentPeriodStart: updated.currentPeriodStart,
      currentPeriodEnd: updated.currentPeriodEnd,
      nextBillingDate: updated.nextBillingDate,
      planPrice: updated.planPrice,
      customPrice: updated.customPrice,
    } : undefined,
  };
}

/**
 * Cancel a platform subscription permanently.
 * Used when a business churns.
 */
export async function cancelPlatformSubscription(
  subscriptionId: string,
  reason: string
): Promise<PlatformSubscriptionResult> {
  const subscription = await db.businessSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  await db.businessSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: reason,
      autoRenew: false,
    },
  });

  // Also churn the business
  await db.business.update({
    where: { id: subscription.businessId },
    data: {
      status: 'CHURNED',
      isOnline: false,
    },
  });

  const updated = await db.businessSubscription.findUnique({
    where: { id: subscriptionId },
  });

  return {
    success: true,
    subscription: updated ? {
      id: updated.id,
      businessId: updated.businessId,
      planId: updated.planId,
      status: updated.status,
      billingCycle: updated.billingCycle,
      currentPeriodStart: updated.currentPeriodStart,
      currentPeriodEnd: updated.currentPeriodEnd,
      nextBillingDate: updated.nextBillingDate,
      planPrice: updated.planPrice,
      customPrice: updated.customPrice,
    } : undefined,
  };
}

// ============================================================================
// PART B: CUSTOMER SUBSCRIPTION (Business → Customer)
// Credit-based packages for Car Wash, Home Services, Laundry etc.
// ============================================================================

/**
 * Subscribe a customer to a plan with credits.
 * Creates the CustomerSubscription record with initial credits.
 * NO TRIAL — customer subscriptions start as ACTIVE.
 */
export async function subscribeCustomerToPlan(params: {
  businessId: string;
  customerId: string;
  planId: string;
  paymentMethodId?: string;
  autoRenew?: boolean;
}): Promise<CustomerSubscriptionResult> {
  const plan = await db.subscriptionPlan.findUnique({
    where: { id: params.planId },
    include: { planItems: true },
  });

  if (!plan) {
    return { success: false, error: 'Subscription plan not found' };
  }

  if (!plan.isActive) {
    return { success: false, error: 'This plan is no longer active' };
  }

  // Check max subscribers limit
  if (plan.maxSubscribers && plan.currentSubscribers >= plan.maxSubscribers) {
    return { success: false, error: 'This plan has reached its subscriber limit' };
  }

  // Check if customer already has an active subscription to this plan
  const existing = await db.customerSubscription.findFirst({
    where: {
      customerId: params.customerId,
      planId: params.planId,
      status: 'ACTIVE',
    },
  });

  if (existing) {
    return { success: false, error: 'Customer already has an active subscription to this plan' };
  }

  // Calculate period dates
  const now = new Date();
  const periodEnd = calculatePeriodEnd(now, plan.billingCycle as SubscriptionBillingCycle);

  // Calculate total credits from plan items
  const totalCredits = plan.totalCredits || plan.planItems.reduce((sum, item) => sum + item.creditsPerCycle, 0);

  // Create subscription — starts as ACTIVE, NO TRIAL
  const subscription = await db.customerSubscription.create({
    data: {
      businessId: params.businessId,
      customerId: params.customerId,
      planId: params.planId,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingDate: periodEnd,
      totalCredits,
      usedCredits: 0,
      remainingCredits: totalCredits,
      autoRenew: params.autoRenew !== false,
      paymentMethodId: params.paymentMethodId,
      lastPaymentAt: now,
      lastPaymentAmount: plan.price,
    },
  });

  // Increment plan's current subscriber count
  await db.subscriptionPlan.update({
    where: { id: params.planId },
    data: { currentSubscribers: { increment: 1 } },
  });

  return { success: true, data: subscription };
}

/**
 * Deduct credits when a service is used (e.g., car wash session).
 * Records usage history for audit trail.
 */
export async function deductCredits(params: {
  subscriptionId: string;
  creditsToDeduct?: number;
  orderId?: string;
  description?: string;
}): Promise<CreditDeductionResult> {
  const subscription = await db.customerSubscription.findUnique({
    where: { id: params.subscriptionId },
  });

  if (!subscription) {
    return { success: false, creditsUsed: 0, remainingCredits: 0, error: 'Subscription not found' };
  }

  if (subscription.status !== 'ACTIVE') {
    return {
      success: false,
      creditsUsed: 0,
      remainingCredits: subscription.remainingCredits,
      error: `Subscription is ${subscription.status}`,
    };
  }

  const creditsToUse = params.creditsToDeduct || 1;

  if (subscription.remainingCredits < creditsToUse) {
    return {
      success: false,
      creditsUsed: 0,
      remainingCredits: subscription.remainingCredits,
      error: 'Insufficient credits',
    };
  }

  const newUsed = subscription.usedCredits + creditsToUse;
  const newRemaining = subscription.remainingCredits - creditsToUse;

  // Update subscription
  await db.customerSubscription.update({
    where: { id: params.subscriptionId },
    data: {
      usedCredits: newUsed,
      remainingCredits: newRemaining,
    },
  });

  // Record usage
  await db.subscriptionUsage.create({
    data: {
      subscriptionId: params.subscriptionId,
      orderId: params.orderId,
      creditsUsed: creditsToUse,
      description: params.description,
    },
  });

  return {
    success: true,
    creditsUsed: creditsToUse,
    remainingCredits: newRemaining,
  };
}

/**
 * Process subscription renewal at the end of a billing period.
 * Handles credit rollover, auto-renewal, and expiry.
 */
export async function processRenewal(subscriptionId: string): Promise<CustomerSubscriptionResult> {
  const subscription = await db.customerSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: { include: { planItems: true } } },
  });

  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  const now = new Date();

  // If auto-renew is on, renew with credit rollover
  if (subscription.autoRenew) {
    const newPeriodEnd = calculatePeriodEnd(now, subscription.plan.billingCycle as SubscriptionBillingCycle);

    // Calculate rollover credits
    let rolloverCredits = 0;
    const planItems = subscription.plan.planItems;
    const anyRollover = planItems.some((item) => item.rollover);

    if (anyRollover && subscription.remainingCredits > 0) {
      const maxRollover = Math.max(
        ...planItems.filter((i) => i.rollover).map((i) => i.rolloverMax || Infinity)
      );
      rolloverCredits = Math.min(subscription.remainingCredits, maxRollover);
    }

    const newTotalCredits = subscription.plan.totalCredits + rolloverCredits;

    await db.customerSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        nextBillingDate: newPeriodEnd,
        totalCredits: newTotalCredits,
        usedCredits: 0,
        remainingCredits: newTotalCredits,
        lastPaymentAt: now,
        lastPaymentAmount: subscription.plan.price,
      },
    });

    return {
      success: true,
      data: {
        renewed: true,
        newPeriodEnd,
        rolloverCredits,
        newTotalCredits,
      },
    };
  }

  // If auto-renew is off, mark for expiry
  await db.customerSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'EXPIRED',
      cancelAtPeriodEnd: true,
    },
  });

  return {
    success: true,
    data: { renewed: false, expired: true, remainingCredits: subscription.remainingCredits },
  };
}

/**
 * Pause a subscription (customer going on vacation, etc.)
 */
export async function pauseSubscription(
  subscriptionId: string,
  pauseStart: Date,
  pauseEnd: Date
): Promise<CustomerSubscriptionResult> {
  const subscription = await db.customerSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) return { success: false, error: 'Subscription not found' };
  if (subscription.status !== 'ACTIVE') return { success: false, error: 'Only active subscriptions can be paused' };

  await db.customerSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'PAUSED',
      pauseStartAt: pauseStart,
      pauseEndAt: pauseEnd,
    },
  });

  return { success: true, data: { paused: true, resumeAt: pauseEnd } };
}

/**
 * Resume a paused subscription.
 * Extends the billing period by the duration of the pause.
 */
export async function resumeSubscription(subscriptionId: string): Promise<CustomerSubscriptionResult> {
  const subscription = await db.customerSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) return { success: false, error: 'Subscription not found' };
  if (subscription.status !== 'PAUSED') return { success: false, error: 'Subscription is not paused' };

  // Extend the period by the number of days paused
  const pauseDuration = subscription.pauseEndAt
    ? subscription.pauseEndAt.getTime() - (subscription.pauseStartAt?.getTime() || Date.now())
    : 0;
  const newPeriodEnd = new Date(subscription.currentPeriodEnd.getTime() + pauseDuration);

  await db.customerSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'ACTIVE',
      currentPeriodEnd: newPeriodEnd,
      nextBillingDate: newPeriodEnd,
      pauseStartAt: null,
      pauseEndAt: null,
    },
  });

  return { success: true, data: { resumed: true, newPeriodEnd } };
}

/**
 * Check all subscriptions for renewal/expiry needs.
 * Should be called by a cron job daily.
 * Returns subscriptions needing renewal (within 3 days) and expiring soon (within 7 days).
 */
export async function checkRenewals(businessId: string): Promise<RenewalCheckResult> {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Find subscriptions that need renewal (billing date within 3 days)
  const needingRenewal = await db.customerSubscription.findMany({
    where: {
      businessId,
      status: 'ACTIVE',
      nextBillingDate: { lte: threeDaysFromNow },
      autoRenew: true,
    },
    include: { plan: true, customer: true },
  });

  // Find subscriptions expiring soon (period end within 7 days)
  const expiringSoon = await db.customerSubscription.findMany({
    where: {
      businessId,
      status: 'ACTIVE',
      currentPeriodEnd: { lte: sevenDaysFromNow },
    },
    include: { plan: true, customer: true },
  });

  return {
    subscriptionsNeedingRenewal: needingRenewal.map((sub) => ({
      id: sub.id,
      customerId: sub.customerId,
      planName: sub.plan.name,
      nextBillingDate: sub.nextBillingDate,
      daysUntilBilling: Math.ceil(
        (sub.nextBillingDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      ),
      autoRenew: sub.autoRenew,
    })),
    subscriptionsExpiringSoon: expiringSoon.map((sub) => ({
      id: sub.id,
      customerId: sub.customerId,
      planName: sub.plan.name,
      currentPeriodEnd: sub.currentPeriodEnd,
      daysUntilExpiry: Math.ceil(
        (sub.currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      ),
      remainingCredits: sub.remainingCredits,
    })),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate the end date of a billing period.
 * Supports both platform (MONTHLY/YEARLY) and customer (weekly–yearly) cycles.
 */
export function calculatePeriodEnd(
  startDate: Date,
  cycle: SubscriptionBillingCycle | PlatformBillingCycle
): Date {
  const end = new Date(startDate);
  switch (cycle) {
    case 'WEEKLY':
      end.setDate(end.getDate() + 7);
      break;
    case 'MONTHLY':
    case 'monthly':
      end.setMonth(end.getMonth() + 1);
      break;
    case 'QUARTERLY':
      end.setMonth(end.getMonth() + 3);
      break;
    case 'HALF_YEARLY':
      end.setMonth(end.getMonth() + 6);
      break;
    case 'YEARLY':
    case 'yearly':
      end.setFullYear(end.getFullYear() + 1);
      break;
  }
  return end;
}
