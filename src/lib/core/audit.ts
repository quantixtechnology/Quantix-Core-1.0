// ============================================================================
// Quantix Core Platform — Audit Logging
// "Run Your Business Smarter" — www.quantixtechnology.in
//
// Tracks all significant actions across the platform for compliance,
// debugging, and security monitoring.
//
// Server-side only — do NOT import React components from this file.
// ============================================================================

import { db } from '@/lib/db';

// ============================================================================
// TYPES
// ============================================================================

/** Parameters for logging an activity */
export interface LogActivityParams {
  /** Business ID — null for platform-level actions */
  businessId?: string | null;
  /** User ID — null for system actions */
  userId?: string | null;
  /** Action identifier — dot-notation (e.g., "business.created", "order.cancelled") */
  action: string;
  /** Entity type (e.g., "Business", "Order", "User", "Product") */
  entity: string;
  /** Entity ID — the primary key of the affected record */
  entityId?: string | null;
  /** JSON details — typically { before: {}, after: {} } for change tracking */
  details?: Record<string, unknown> | null;
  /** Request IP address */
  ip?: string | null;
  /** Request user agent */
  userAgent?: string | null;
}

/** Activity log record returned from domain-specific loggers */
interface ActivityLogRecord {
  id: string;
  businessId: string | null;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/** Helper to extract IP and user-agent from a Request-like object */
function extractRequestMeta(request?: { headers?: { get(name: string): string | null } }): {
  ip: string | null;
  userAgent: string | null;
} {
  if (!request?.headers) return { ip: null, userAgent: null };
  return {
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
    userAgent: request.headers.get('user-agent') || null,
  };
}

/** Filters for querying activity logs */
export interface ActivityLogFilters {
  /** Filter by action type (e.g., "order.created") */
  action?: string;
  /** Filter by entity type (e.g., "Order") */
  entity?: string;
  /** Filter by user ID */
  userId?: string;
  /** Filter by actions starting with prefix (e.g., "order." for all order actions) */
  actionPrefix?: string;
  /** Date range start */
  dateFrom?: Date;
  /** Date range end */
  dateTo?: Date;
}

/** Paginated activity log result */
export interface ActivityLogResult {
  logs: Array<{
    id: string;
    businessId: string | null;
    userId: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    details: Record<string, unknown> | null;
    ip: string | null;
    userAgent: string | null;
    createdAt: Date;
    user?: {
      id: string;
      name: string;
      email: string;
    } | null;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Date range for export */
export interface DateRange {
  from: Date;
  to: Date;
}

// ============================================================================
// LOG ACTIVITY — Create an audit log entry
// ============================================================================

/**
 * Create an activity log entry.
 * This is the primary function for recording all significant platform actions.
 *
 * @example
 * ```ts
 * await logActivity({
 *   businessId: business.id,
 *   userId: session.user.id,
 *   action: 'business.created',
 *   entity: 'Business',
 *   entityId: business.id,
 *   details: { after: { name: business.name, type: business.businessType } },
 *   ip: request.headers.get('x-forwarded-for'),
 *   userAgent: request.headers.get('user-agent'),
 * });
 * ```
 */
export async function logActivity(params: LogActivityParams): Promise<ActivityLogRecord> {
  const record = await db.activityLog.create({
    data: {
      businessId: params.businessId || null,
      userId: params.userId || null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId || null,
      details: params.details ? JSON.stringify(params.details) : null,
      ip: params.ip || null,
      userAgent: params.userAgent || null,
    },
  });
  return record;
}

// ============================================================================
// GET ACTIVITY LOGS — Query logs with pagination
// ============================================================================

/**
 * Query activity logs for a business with filtering and pagination.
 *
 * @param businessId - The business to query logs for
 * @param filters - Optional filters for action, entity, user, date range
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @returns Paginated activity log results
 */
export async function getActivityLogs(
  businessId: string,
  filters?: ActivityLogFilters,
  page: number = 1,
  limit: number = 50
): Promise<ActivityLogResult> {
  const where: Record<string, unknown> = {
    businessId,
  };

  if (filters?.action) {
    where.action = filters.action;
  }

  if (filters?.actionPrefix) {
    where.action = { startsWith: filters.actionPrefix };
  }

  if (filters?.entity) {
    where.entity = filters.entity;
  }

  if (filters?.userId) {
    where.userId = filters.userId;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (filters.dateFrom) createdAt.gte = filters.dateFrom;
    if (filters.dateTo) createdAt.lte = filters.dateTo;
    where.createdAt = createdAt;
  }

  const [logs, total] = await Promise.all([
    db.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.activityLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      id: log.id,
      businessId: log.businessId,
      userId: log.userId,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      details: log.details ? JSON.parse(log.details) : null,
      ip: log.ip,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
      user: log.user
        ? { id: log.user.id, name: log.user.name, email: log.user.email }
        : null,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ============================================================================
// EXPORT AUDIT LOG — Export as JSON
// ============================================================================

/**
 * Export activity logs for a business within a date range.
 * Returns a JSON-serializable array of log entries.
 *
 * @param businessId - The business to export logs for
 * @param dateRange - Date range for export
 * @returns Array of log entries suitable for JSON export
 */
export async function exportAuditLog(
  businessId: string,
  dateRange: DateRange
): Promise<Array<{
  id: string;
  businessId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}>> {
  const logs = await db.activityLog.findMany({
    where: {
      businessId,
      createdAt: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return logs.map((log) => ({
    id: log.id,
    businessId: log.businessId,
    userId: log.userId,
    userName: log.user?.name ?? null,
    userEmail: log.user?.email ?? null,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    details: log.details ? JSON.parse(log.details) : null,
    ip: log.ip,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  }));
}

// ============================================================================
// DOMAIN-SPECIFIC AUDIT LOGGERS
// Convenience wrappers that auto-set entity, action prefix, and request meta
// ============================================================================

/**
 * Log an order-related activity.
 * Actions: order.created, order.status_changed, order.cancelled, order.refunded, etc.
 */
export async function logOrderActivity(
  businessId: string | null,
  userId: string | null,
  action: string,
  orderId: string,
  details?: Record<string, unknown> | null,
  request?: { headers?: { get(name: string): string | null } }
): Promise<ActivityLogRecord> {
  const meta = extractRequestMeta(request);
  return logActivity({
    businessId,
    userId,
    action: action.startsWith('order.') ? action : `order.${action}`,
    entity: 'Order',
    entityId: orderId,
    details,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

/**
 * Log a payment-related activity.
 * Actions: payment.created, payment.completed, payment.failed, payment.refunded, payment.verified, etc.
 */
export async function logPaymentActivity(
  businessId: string | null,
  userId: string | null,
  action: string,
  paymentId: string,
  details?: Record<string, unknown> | null,
  request?: { headers?: { get(name: string): string | null } }
): Promise<ActivityLogRecord> {
  const meta = extractRequestMeta(request);
  return logActivity({
    businessId,
    userId,
    action: action.startsWith('payment.') ? action : `payment.${action}`,
    entity: 'Payment',
    entityId: paymentId,
    details,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

/**
 * Log a POS-related activity.
 * Actions: pos.session_opened, pos.session_closed, pos.order_created, etc.
 */
export async function logPOSActivity(
  businessId: string | null,
  userId: string | null,
  action: string,
  sessionId: string,
  details?: Record<string, unknown> | null,
  request?: { headers?: { get(name: string): string | null } }
): Promise<ActivityLogRecord> {
  const meta = extractRequestMeta(request);
  return logActivity({
    businessId,
    userId,
    action: action.startsWith('pos.') ? action : `pos.${action}`,
    entity: 'POSSession',
    entityId: sessionId,
    details,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

/**
 * Log a lead/sales-related activity.
 * Actions: lead.created, lead.stage_changed, lead.converted, lead.demo_shared, etc.
 */
export async function logLeadActivity(
  userId: string | null,
  action: string,
  leadId: string,
  details?: Record<string, unknown> | null,
  request?: { headers?: { get(name: string): string | null } }
): Promise<ActivityLogRecord> {
  const meta = extractRequestMeta(request);
  return logActivity({
    businessId: null, // Leads are platform-level
    userId,
    action: action.startsWith('lead.') ? action : `lead.${action}`,
    entity: 'Lead',
    entityId: leadId,
    details,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

/**
 * Log a delivery-related activity.
 * Actions: delivery.assigned, delivery.picked_up, delivery.on_the_way, delivery.delivered, etc.
 */
export async function logDeliveryActivity(
  businessId: string | null,
  userId: string | null,
  action: string,
  deliveryId: string,
  details?: Record<string, unknown> | null,
  request?: { headers?: { get(name: string): string | null } }
): Promise<ActivityLogRecord> {
  const meta = extractRequestMeta(request);
  return logActivity({
    businessId,
    userId,
    action: action.startsWith('delivery.') ? action : `delivery.${action}`,
    entity: 'Delivery',
    entityId: deliveryId,
    details,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

/**
 * Log an auth-related activity.
 * Actions: auth.login, auth.logout, auth.login_failed, auth.token_refreshed, auth.otp_sent, etc.
 */
export async function logAuthActivity(
  userId: string | null,
  action: string,
  details?: Record<string, unknown> | null,
  request?: { headers?: { get(name: string): string | null } }
): Promise<ActivityLogRecord> {
  const meta = extractRequestMeta(request);
  return logActivity({
    businessId: null, // Auth is platform-level
    userId,
    action: action.startsWith('auth.') ? action : `auth.${action}`,
    entity: 'User',
    entityId: userId,
    details,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

/**
 * Log a subscription-related activity.
 * Actions: subscription.created, subscription.cancelled, subscription.renewed, subscription.plan_changed, etc.
 */
export async function logSubscriptionActivity(
  businessId: string | null,
  userId: string | null,
  action: string,
  subscriptionId: string,
  details?: Record<string, unknown> | null,
  request?: { headers?: { get(name: string): string | null } }
): Promise<ActivityLogRecord> {
  const meta = extractRequestMeta(request);
  return logActivity({
    businessId,
    userId,
    action: action.startsWith('subscription.') ? action : `subscription.${action}`,
    entity: 'BusinessSubscription',
    entityId: subscriptionId,
    details,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}
