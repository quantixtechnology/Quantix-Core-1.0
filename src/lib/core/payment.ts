// ============================================================================
// QUANTIX CORE — Payment Processing
// Payment record management, status tracking, refund processing
// Payment stats by method, gateway validation
// ============================================================================

import { db } from '@/lib/db';

// ============================================================================
// TYPES
// ============================================================================

export interface CreatePaymentParams {
  orderId: string;
  businessId: string;
  amount: number;
  currency?: string;
  method: 'CASH' | 'CARD' | 'UPI' | 'NETBANKING' | 'WALLET' | 'COD' | 'CREDIT' | 'MIXED';
  gatewayName?: string;
  gatewayTransactionId?: string;
  gatewayResponse?: string;
}

export interface PaymentInfo {
  id: string;
  orderId: string;
  businessId: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  gatewayTransactionId: string | null;
  gatewayName: string | null;
  refundAmount: number | null;
  refundStatus: string | null;
  refundedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface PaymentStats {
  totalPayments: number;
  totalAmount: number;
  byMethod: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
  totalRefunds: number;
  refundAmount: number;
  netRevenue: number;
}

export interface RefundResult {
  success: boolean;
  payment?: PaymentInfo;
  error?: string;
}

export interface PaymentMethodValidation {
  valid: boolean;
  gateway?: {
    id: string;
    name: string;
    gateway: string;
    isActive: boolean;
    isTestMode: boolean;
  };
  error?: string;
}

// ============================================================================
// CREATE PAYMENT
// ============================================================================

/**
 * Create a payment record for an order.
 * Sets initial status to PENDING. Gateway integration should call updatePaymentStatus
 * when the payment is confirmed/failed by the gateway.
 */
export async function createPayment(params: CreatePaymentParams): Promise<{
  success: boolean;
  payment?: PaymentInfo;
  error?: string;
}> {
  // Verify order exists and belongs to business
  const order = await db.order.findFirst({
    where: {
      id: params.orderId,
      businessId: params.businessId,
    },
  });

  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  // Check if a completed payment already exists for this order
  const existingPayment = await db.payment.findFirst({
    where: {
      orderId: params.orderId,
      status: { in: ['COMPLETED', 'PROCESSING'] },
    },
  });

  if (existingPayment) {
    return { success: false, error: 'A completed or processing payment already exists for this order' };
  }

  const payment = await db.payment.create({
    data: {
      orderId: params.orderId,
      businessId: params.businessId,
      amount: params.amount,
      currency: params.currency || 'INR',
      method: params.method,
      status: 'PENDING',
      gatewayName: params.gatewayName,
      gatewayTransactionId: params.gatewayTransactionId,
      gatewayResponse: params.gatewayResponse,
    },
  });

  // Update order payment method
  await db.order.update({
    where: { id: params.orderId },
    data: {
      paymentMethod: params.method,
      paymentStatus: 'PENDING',
    },
  });

  return {
    success: true,
    payment: mapPaymentToInfo(payment),
  };
}

// ============================================================================
// UPDATE PAYMENT STATUS
// ============================================================================

/**
 * Update the status of a payment.
 * Typically called by webhook handlers from payment gateways.
 * Also updates the order's payment status accordingly.
 */
export async function updatePaymentStatus(
  paymentId: string,
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED',
  gatewayTransactionId?: string
): Promise<{
  success: boolean;
  payment?: PaymentInfo;
  error?: string;
}> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    return { success: false, error: 'Payment not found' };
  }

  // Validate status transition
  const validTransitions: Record<string, string[]> = {
    PENDING: ['PROCESSING', 'COMPLETED', 'FAILED'],
    PROCESSING: ['COMPLETED', 'FAILED'],
    COMPLETED: ['REFUNDED', 'PARTIALLY_REFUNDED'],
    FAILED: ['PENDING'], // Allow retry
    REFUNDED: [],
    PARTIALLY_REFUNDED: ['REFUNDED'],
  };

  const allowed = validTransitions[payment.status as keyof typeof validTransitions];
  if (!allowed || !allowed.includes(status)) {
    return { success: false, error: `Cannot transition payment from ${payment.status} to ${status}` };
  }

  const updateData: Record<string, unknown> = {
    status,
    ...(gatewayTransactionId && { gatewayTransactionId }),
  };

  // Set paidAt timestamp when payment is completed
  if (status === 'COMPLETED') {
    updateData.paidAt = new Date();
  }

  const updated = await db.payment.update({
    where: { id: paymentId },
    data: updateData,
  });

  // Update order payment status
  const orderPaymentStatusMap: Record<string, string> = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
    PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  };

  await db.order.update({
    where: { id: payment.orderId },
    data: {
      paymentStatus: orderPaymentStatusMap[status] as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED',
    },
  });

  return {
    success: true,
    payment: mapPaymentToInfo(updated),
  };
}

// ============================================================================
// REFUND PROCESSING
// ============================================================================

/**
 * Process a refund for a payment.
 * Supports partial refunds. Updates both payment and order records.
 */
export async function processRefund(
  paymentId: string,
  amount: number
): Promise<RefundResult> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    return { success: false, error: 'Payment not found' };
  }

  if (payment.status !== 'COMPLETED' && payment.status !== 'PARTIALLY_REFUNDED') {
    return { success: false, error: `Cannot refund a payment with status ${payment.status}` };
  }

  if (amount <= 0) {
    return { success: false, error: 'Refund amount must be greater than zero' };
  }

  if (amount > payment.amount) {
    return { success: false, error: 'Refund amount cannot exceed payment amount' };
  }

  // Check existing refund amounts
  const existingRefund = payment.refundAmount || 0;
  if (existingRefund + amount > payment.amount) {
    return { success: false, error: 'Total refund amount would exceed payment amount' };
  }

  const newRefundAmount = existingRefund + amount;
  const isFullRefund = newRefundAmount >= payment.amount;
  const newStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  const newRefundStatus = isFullRefund ? 'completed' : 'processing';

  const updated = await db.payment.update({
    where: { id: paymentId },
    data: {
      status: newStatus,
      refundAmount: newRefundAmount,
      refundStatus: newRefundStatus,
      refundedAt: new Date(),
    },
  });

  // Update order payment status
  await db.order.update({
    where: { id: payment.orderId },
    data: {
      paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    },
  });

  return {
    success: true,
    payment: mapPaymentToInfo(updated),
  };
}

// ============================================================================
// QUERY PAYMENTS
// ============================================================================

/**
 * Get the payment for an order.
 */
export async function getPaymentByOrder(orderId: string): Promise<{
  payment?: PaymentInfo;
  error?: string;
}> {
  const payment = await db.payment.findFirst({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
  });

  if (!payment) {
    return { error: 'No payment found for this order' };
  }

  return { payment: mapPaymentToInfo(payment) };
}

/**
 * Get payment statistics for a business.
 * Groups by payment method and status. Supports date range filtering.
 */
export async function getPaymentStats(
  businessId: string,
  dateRange?: { from: Date; to: Date }
): Promise<PaymentStats> {
  const whereClause: Record<string, unknown> = {
    businessId,
    ...(dateRange && {
      createdAt: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
    }),
  };

  // Get all payments for this business in the date range
  const payments = await db.payment.findMany({
    where: whereClause,
    select: {
      amount: true,
      method: true,
      status: true,
      refundAmount: true,
    },
  });

  // Calculate stats
  let totalAmount = 0;
  let totalRefunds = 0;
  let refundAmount = 0;
  const byMethod = new Map<string, { count: number; amount: number }>();
  const byStatus = new Map<string, { count: number; amount: number }>();

  for (const p of payments) {
    totalAmount += p.amount;

    // Count refunds
    if (p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED') {
      totalRefunds++;
      refundAmount += p.refundAmount || 0;
    }

    // Group by method
    const methodKey = p.method;
    const methodData = byMethod.get(methodKey) || { count: 0, amount: 0 };
    methodData.count++;
    methodData.amount += p.amount;
    byMethod.set(methodKey, methodData);

    // Group by status
    const statusKey = p.status;
    const statusData = byStatus.get(statusKey) || { count: 0, amount: 0 };
    statusData.count++;
    statusData.amount += p.amount;
    byStatus.set(statusKey, statusData);
  }

  // Filter to completed payments for net revenue
  const completedAmount = payments
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    totalPayments: payments.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
    byMethod: Array.from(byMethod.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      amount: Math.round(data.amount * 100) / 100,
    })),
    byStatus: Array.from(byStatus.entries()).map(([status, data]) => ({
      status,
      count: data.count,
      amount: Math.round(data.amount * 100) / 100,
    })),
    totalRefunds,
    refundAmount: Math.round(refundAmount * 100) / 100,
    netRevenue: Math.round((completedAmount - refundAmount) * 100) / 100,
  };
}

// ============================================================================
// VALIDATE PAYMENT METHOD
// ============================================================================

/**
 * Check if a payment method is configured for a business.
 * For CASH and COD, always valid (no gateway needed).
 * For CARD/UPI/NETBANKING/WALLET, checks if an active gateway is configured.
 */
export async function validatePaymentMethod(
  businessId: string,
  method: string
): Promise<PaymentMethodValidation> {
  // Cash and COD don't need a gateway
  if (method === 'CASH' || method === 'COD') {
    return { valid: true };
  }

  // Credit is internal — no gateway needed
  if (method === 'CREDIT') {
    return { valid: true };
  }

  // For online payment methods, check if a gateway is configured
  const gateway = await db.paymentGateway.findFirst({
    where: {
      businessId,
      isActive: true,
    },
  });

  if (!gateway) {
    return {
      valid: false,
      error: `No active payment gateway configured for ${method}. Please configure a payment gateway first.`,
    };
  }

  return {
    valid: true,
    gateway: {
      id: gateway.id,
      name: gateway.name,
      gateway: gateway.gateway,
      isActive: gateway.isActive,
      isTestMode: gateway.isTestMode,
    },
  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function mapPaymentToInfo(payment: {
  id: string;
  orderId: string;
  businessId: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  gatewayTransactionId: string | null;
  gatewayName: string | null;
  refundAmount: number | null;
  refundStatus: string | null;
  refundedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}): PaymentInfo {
  return {
    id: payment.id,
    orderId: payment.orderId,
    businessId: payment.businessId,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    gatewayTransactionId: payment.gatewayTransactionId,
    gatewayName: payment.gatewayName,
    refundAmount: payment.refundAmount,
    refundStatus: payment.refundStatus,
    refundedAt: payment.refundedAt,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  };
}
