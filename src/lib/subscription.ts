// ============================================================================
// Quantix Technology — Subscription Service Engine
// Credit-based packages for Car Wash, Home Services, Laundry etc.
// Expiry tracking, usage history, renewal reminders, rollover logic
// ============================================================================

import { db } from './db';
import type { CustomerSubscriptionStatus, SubscriptionBillingCycle } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriptionEngineResult {
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
// CREDIT-BASED SUBSCRIPTION ENGINE
// ============================================================================

/**
 * Subscribe a customer to a plan.
 * Creates the CustomerSubscription record with initial credits.
 */
export async function subscribeCustomerToPlan(params: {
  businessId: string;
  customerId: string;
  planId: string;
  paymentMethodId?: string;
  autoRenew?: boolean;
}): Promise<SubscriptionEngineResult> {
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

  // Apply trial days if applicable
  const trialEnd = plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000) : null;

  // Create subscription
  const subscription = await db.customerSubscription.create({
    data: {
      businessId: params.businessId,
      customerId: params.customerId,
      planId: params.planId,
      status: trialEnd ? 'TRIAL' : 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingDate: periodEnd,
      totalCredits,
      usedCredits: 0,
      remainingCredits: totalCredits,
      autoRenew: params.autoRenew !== false,
      paymentMethodId: params.paymentMethodId,
      lastPaymentAt: trialEnd ? undefined : now,
      lastPaymentAmount: trialEnd ? undefined : plan.price,
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
 * Returns the number of credits deducted and remaining.
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

  if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL') {
    return { success: false, creditsUsed: 0, remainingCredits: subscription.remainingCredits, error: `Subscription is ${subscription.status}` };
  }

  const creditsToUse = params.creditsToDeduct || 1;

  if (subscription.remainingCredits < creditsToUse) {
    return { success: false, creditsUsed: 0, remainingCredits: subscription.remainingCredits, error: 'Insufficient credits' };
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
export async function processRenewal(subscriptionId: string): Promise<SubscriptionEngineResult> {
  const subscription = await db.customerSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: { include: { planItems: true } } },
  });

  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  const now = new Date();

  // If auto-renew is on and payment method exists, renew
  if (subscription.autoRenew) {
    const newPeriodEnd = calculatePeriodEnd(now, subscription.plan.billingCycle as SubscriptionBillingCycle);

    // Calculate rollover credits
    let rolloverCredits = 0;
    const planItems = subscription.plan.planItems;
    const anyRollover = planItems.some(item => item.rollover);

    if (anyRollover && subscription.remainingCredits > 0) {
      const maxRollover = Math.max(...planItems.filter(i => i.rollover).map(i => i.rolloverMax || Infinity));
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
 * Pause a subscription (customer going on vacation etc.)
 */
export async function pauseSubscription(
  subscriptionId: string,
  pauseStart: Date,
  pauseEnd: Date
): Promise<SubscriptionEngineResult> {
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
 */
export async function resumeSubscription(subscriptionId: string): Promise<SubscriptionEngineResult> {
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
      status: { in: ['ACTIVE', 'TRIAL'] },
      currentPeriodEnd: { lte: sevenDaysFromNow },
    },
    include: { plan: true, customer: true },
  });

  return {
    subscriptionsNeedingRenewal: needingRenewal.map(sub => ({
      id: sub.id,
      customerId: sub.customerId,
      planName: sub.plan.name,
      nextBillingDate: sub.nextBillingDate,
      daysUntilBilling: Math.ceil((sub.nextBillingDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      autoRenew: sub.autoRenew,
    })),
    subscriptionsExpiringSoon: expiringSoon.map(sub => ({
      id: sub.id,
      customerId: sub.customerId,
      planName: sub.plan.name,
      currentPeriodEnd: sub.currentPeriodEnd,
      daysUntilExpiry: Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      remainingCredits: sub.remainingCredits,
    })),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function calculatePeriodEnd(startDate: Date, cycle: SubscriptionBillingCycle): Date {
  const end = new Date(startDate);
  switch (cycle) {
    case 'WEEKLY':
      end.setDate(end.getDate() + 7);
      break;
    case 'MONTHLY':
      end.setMonth(end.getMonth() + 1);
      break;
    case 'QUARTERLY':
      end.setMonth(end.getMonth() + 3);
      break;
    case 'HALF_YEARLY':
      end.setMonth(end.getMonth() + 6);
      break;
    case 'YEARLY':
      end.setFullYear(end.getFullYear() + 1);
      break;
  }
  return end;
}
