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
export async function logActivity(params: LogActivityParams): Promise<void> {
  await db.activityLog.create({
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
