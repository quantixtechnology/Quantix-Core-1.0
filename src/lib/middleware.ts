// ============================================================================
// Quantix Technology — API Middleware Helpers
// MANAGED PLATFORM
// ============================================================================

import type { NextRequest } from 'next/server';
import type { ZodSchema } from 'zod';
import type { Role, Permission, BusinessContext } from './types';
import { db } from './db';
import { getDbPermissionsForRole } from './db-permissions';
import { resolveTenantFromHostname } from './tenant-resolver';

// ============================================================================
// TYPES
// ============================================================================

export interface RouteContext {
  params?: Promise<Record<string, string | string[]>>;
}

interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    name: string;
    role: Role;
    businessId?: string;
    storeId?: string;
    permissions: Permission[];
    isPlatformAdmin: boolean;
  };
  businessContext?: BusinessContext;
}

export type HandlerFunction = (
  req: AuthenticatedRequest,
  context?: RouteContext
) => Promise<Response>;

export interface MiddlewareConfig {
  requireAuth?: boolean;
  requireBusinessContext?: boolean;
  requirePlatformAdmin?: boolean;
  requiredPermission?: Permission;
  requiredPermissions?: Permission[];
  requiredRoles?: Role[];
  rateLimit?: RateLimitConfig;
  bodySchema?: ZodSchema;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting helper — uses in-memory store
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): string | null {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupRateLimitStore(now);
  }

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return null;
  }

  if (entry.count >= config.maxRequests) {
    return `Rate limit exceeded. Try again in ${Math.ceil((entry.resetTime - now) / 1000)} seconds.`;
  }

  entry.count++;
  return null;
}

function cleanupRateLimitStore(now: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// ============================================================================
// SESSION / AUTH EXTRACTION
// ============================================================================

// Distinct sentinel values so withMiddleware can return specific error
// responses.  Auth failures (missing / expired token) → 401.  Infra failures
// (DB unavailable, Prisma query error) → 503.  Never confuse the two —
// a temporary database hiccup must not log out every active session.
const AUTH_ERRORS = {
  NO_TOKEN:    'Session not found. Please sign in.',
  EXPIRED:     'Session expired. Please sign in again.',
  INACTIVE:    'Account is inactive or suspended.',
} as const
type AuthError = typeof AUTH_ERRORS[keyof typeof AUTH_ERRORS]

// Returned by extractUserFromRequest when the DB / Prisma query itself fails.
// withMiddleware maps this to a 503 instead of a 401.
const INFRA_FAILURE = Symbol('INFRA_FAILURE')

async function extractUserFromRequest(
  req: NextRequest,
): Promise<AuthenticatedRequest['user'] | AuthError | typeof INFRA_FAILURE> {
  try {
    const authHeader = req.headers.get('authorization');
    const businessIdHeader = req.headers.get('x-business-id');

    if (!authHeader) return AUTH_ERRORS.NO_TOKEN;

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return AUTH_ERRORS.NO_TOKEN;

    const refreshToken = await db.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
            platformRole: true,
            businessUsers: {
              where: { isActive: true },
              include: {
                business: {
                  select: { id: true, name: true, businessType: true, slug: true },
                },
              },
            },
            salesProfile: true,
          },
        },
      },
    });

    if (!refreshToken || refreshToken.expiresAt < new Date()) return AUTH_ERRORS.EXPIRED;
    if (!refreshToken.user.isActive) return AUTH_ERRORS.INACTIVE;

    const user = refreshToken.user;
    let role: Role = 'CUSTOMER';
    let businessId: string | undefined;
    let storeId: string | undefined;

    const platRoles = ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM', 'SUPPORT_TEAM', 'DEPLOYMENT_TEAM', 'FINANCE_TEAM'];
    if (user.platformRole && platRoles.includes(user.platformRole)) {
      // Platform staff have no businessUser records; they target businesses via header.
      role = user.platformRole as Role;
    } else if (user.businessUsers.length > 0) {
      // ── Hostname-first tenant resolution ─────────────────────────────────
      // The subdomain is the authoritative tenant identifier for ALL customer
      // storefront requests.  A customer registered at multiple businesses gets
      // the correct scoped context regardless of any client-supplied header.
      const hostnameBusinessId = await resolveTenantFromHostname(req as unknown as Request);

      let effectiveBU;
      if (hostnameBusinessId) {
        // On a tenant subdomain: require the user to have a BusinessUser record
        // for that specific tenant.  No fallback to other businesses.
        effectiveBU = user.businessUsers.find(bu => bu.business.id === hostnameBusinessId);
      } else {
        // Not on a tenant subdomain (admin panel, local dev).
        // Fall back to the header-matched BU, then the first BU so admin flows
        // and the test harness continue to work.
        effectiveBU = businessIdHeader
          ? (user.businessUsers.find(bu => bu.business.id === businessIdHeader) ?? user.businessUsers[0])
          : user.businessUsers[0];
      }

      if (effectiveBU) {
        role = effectiveBU.role;
        businessId = effectiveBU.business.id;
        storeId = effectiveBU.storeId || undefined;
      }
    }

    const platAdmin = role === 'QUANTIX_SUPER_ADMIN' || role === 'PLATFORM_ADMIN';
    const isPlatformRole = user.platformRole != null && platRoles.includes(user.platformRole);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      // Platform roles may target any business via the header.
      // Regular users get businessId exclusively from their verified BusinessUser record.
      businessId: businessId || (isPlatformRole ? businessIdHeader : undefined) || undefined,
      storeId,
      permissions: await getDbPermissionsForRole(role) as Permission[],
      isPlatformAdmin: platAdmin,
    };
  } catch (error) {
    console.error('[middleware] extractUserFromRequest error:', error);
    return INFRA_FAILURE;
  }
}

// ============================================================================
// MIDDLEWARE WRAPPERS
// ============================================================================

/**
 * Main API middleware wrapper
 */
export function withMiddleware(config: MiddlewareConfig = {}) {
  return function (handler: HandlerFunction): HandlerFunction {
    return async function (req, context) {
      try {
        // Rate limiting
        if (config.rateLimit) {
          const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
          const rateLimitKey = `${clientIp}:${req.nextUrl.pathname}`;
          const rateLimitError = checkRateLimit(rateLimitKey, config.rateLimit);
          if (rateLimitError) {
            return createErrorResponse(rateLimitError, 429);
          }
        }

        // Body validation
        if (config.bodySchema && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
          try {
            const body = await req.json();
            const validated = config.bodySchema.safeParse(body);
            if (!validated.success) {
              return createValidationErrorResponse(validated.error);
            }
            (req as AuthenticatedRequest & { validatedBody: unknown }).validatedBody = validated.data;
          } catch {
            return createErrorResponse('Invalid JSON body', 400);
          }
        }

        // Authentication
        if (config.requireAuth) {
          const userOrError = await extractUserFromRequest(req);
          if (userOrError === INFRA_FAILURE) {
            return createErrorResponse(
              'Authentication service temporarily unavailable. Please try again.',
              503,
            );
          }
          // String return = a specific auth error message → 401
          if (typeof userOrError === 'string') {
            return createErrorResponse(userOrError, 401);
          }
          const user = userOrError;
          (req as AuthenticatedRequest).user = user;

          // Super Admin has UNRESTRICTED access and is NOT permission-driven —
          // it bypasses the role/permission gates entirely (business owners and
          // staff below remain authorization-driven). This guarantees "Super
          // Admin → Always Allow" at the engine level, independent of whether
          // every permission happens to be listed for the role in the DB.
          const isSuperAdmin = user.role === 'QUANTIX_SUPER_ADMIN';

          // Platform admin check
          if (config.requirePlatformAdmin && !user.isPlatformAdmin) {
            return createErrorResponse(`Unauthorized role: ${user.role} — platform admin required`, 403);
          }

          // Business context
          if (config.requireBusinessContext && !user.businessId && !user.isPlatformAdmin) {
            return createErrorResponse('Business context required', 400);
          }

          if (!isSuperAdmin) {
            // Role check
            if (config.requiredRoles && config.requiredRoles.length > 0) {
              if (!config.requiredRoles.includes(user.role)) {
                return createErrorResponse(`Unauthorized role: ${user.role}`, 403);
              }
            }

            // Single permission check
            if (config.requiredPermission) {
              if (!user.permissions.includes(config.requiredPermission)) {
                return createErrorResponse(`Missing permission: ${config.requiredPermission}`, 403);
              }
            }

            // Multiple permissions check
            if (config.requiredPermissions && config.requiredPermissions.length > 0) {
              if (!config.requiredPermissions.some((p) => user.permissions.includes(p))) {
                return createErrorResponse(`Missing permission: one of [${config.requiredPermissions.join(', ')}]`, 403);
              }
            }
          }

          // Set business context on request
          if (user.businessId || user.isPlatformAdmin) {
            (req as AuthenticatedRequest).businessContext = {
              businessId: user.businessId || '',
              businessType: 'GROCERY',
              businessSlug: '',
              businessName: '',
              role: user.role,
              userId: user.id,
              storeId: user.storeId,
              permissions: user.permissions,
              isPlatformAdmin: user.isPlatformAdmin,
            };
          }
        }

        return handler(req as AuthenticatedRequest, context);
      } catch (error) {
        console.error('API Middleware Error:', error);
        return createErrorResponse('Internal server error', 500);
      }
    };
  };
}

// ============================================================================
// CONVENIENCE WRAPPERS
// ============================================================================

/**
 * Require authentication on an API route
 */
export function withAuth(handler: HandlerFunction): HandlerFunction {
  return withMiddleware({ requireAuth: true })(handler);
}

/**
 * Require a specific business context
 */
export function withBusinessContext(handler: HandlerFunction): HandlerFunction {
  return withMiddleware({ requireAuth: true, requireBusinessContext: true })(handler);
}

/**
 * Require platform admin access (Super Admin or Sales Team)
 */
export function withPlatformAccess(handler: HandlerFunction): HandlerFunction {
  return withMiddleware({ requireAuth: true, requirePlatformAdmin: true })(handler);
}

/**
 * Require a specific permission
 */
export function withPermission(permission: Permission): (handler: HandlerFunction) => HandlerFunction {
  return function (handler: HandlerFunction): HandlerFunction {
    return withMiddleware({
      requireAuth: true,
      requireBusinessContext: true,
      requiredPermission: permission,
    })(handler);
  };
}

/**
 * Require one of the specified roles
 */
export function withRole(...roles: Role[]): (handler: HandlerFunction) => HandlerFunction {
  return function (handler: HandlerFunction): HandlerFunction {
    return withMiddleware({
      requireAuth: true,
      requiredRoles: roles,
    })(handler);
  };
}

/**
 * Validate request body with Zod schema
 */
export function withValidation(schema: ZodSchema): (handler: HandlerFunction) => HandlerFunction {
  return function (handler: HandlerFunction): HandlerFunction {
    return withMiddleware({ bodySchema: schema })(handler);
  };
}

/**
 * Apply rate limiting to an API route
 */
export function withRateLimit(config: RateLimitConfig): (handler: HandlerFunction) => HandlerFunction {
  return function (handler: HandlerFunction): HandlerFunction {
    return withMiddleware({ rateLimit: config })(handler);
  };
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Create a success JSON response
 */
export function createSuccessResponse<T>(data: T, status: number = 200): Response {
  return Response.json(
    { success: true, data },
    { status }
  );
}

/**
 * Create a paginated success response
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  }
): Response {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  return Response.json({
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    },
  });
}

/**
 * Create an error JSON response
 */
export function createErrorResponse(message: string, status: number = 400): Response {
  return Response.json(
    { success: false, error: message },
    { status }
  );
}

/**
 * Create a validation error response from Zod error
 */
export function createValidationErrorResponse(error: unknown): Response {
  const errors = error && typeof error === 'object' && 'issues' in error
    ? (error as { issues: Array<{ path: (string | number)[]; message: string }> }).issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
    : [{ field: 'unknown', message: 'Validation failed' }];

  return Response.json(
    {
      success: false,
      error: 'Validation failed',
      errors,
    },
    { status: 400 }
  );
}

// ============================================================================
// PAGINATION HELPER
// ============================================================================

/**
 * Extract pagination params from request URL
 */
export function getPaginationParams(request: NextRequest): {
  page: number;
  limit: number;
  skip: number;
} {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

// ============================================================================
// QUERY PARAM HELPERS
// ============================================================================

/**
 * Extract filter params from request URL
 */
export function getFilterParams(
  request: NextRequest,
  allowedFilters: string[]
): Record<string, string | string[]> {
  const url = new URL(request.url);
  const filters: Record<string, string | string[]> = {};

  for (const key of allowedFilters) {
    const value = url.searchParams.getAll(key);
    if (value.length > 0) {
      filters[key] = value.length === 1 ? value[0] : value;
    }
  }

  return filters;
}
