// ============================================================================
// Quantix Technology - API Middleware Helpers
// ============================================================================

import type { NextRequest } from 'next/server';
import type { NextApiResponse } from 'next';
import type { ZodSchema } from 'zod';
import type { Role, Permission, BusinessContext } from './types';
import { hasPermission, hasAnyPermission, getPermissionsForRole } from './permissions';
import { db } from './db';

// ============================================================================
// TYPES
// ============================================================================

interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    name: string;
    role: Role;
    businessId?: string;
    storeId?: string;
    permissions: Permission[];
  };
  businessContext?: BusinessContext;
}

type HandlerFunction = (
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string | string[]> }
) => Promise<Response>;

interface MiddlewareConfig {
  requireAuth?: boolean;
  requireBusinessContext?: boolean;
  requiredPermission?: Permission;
  requiredPermissions?: Permission[];
  requiredRoles?: Role[];
  rateLimit?: RateLimitConfig;
  bodySchema?: ZodSchema;
}

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

// ============================================================================
// RATE LIMITING
// ============================================================================

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting helper - uses in-memory store
 * Returns null if allowed, or an error message if rate limited
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

/**
 * Extract user info from request headers (set by NextAuth)
 * This is a simplified version - in production, you'd verify the JWT token
 */
async function extractUserFromRequest(req: NextRequest): Promise<AuthenticatedRequest['user'] | null> {
  try {
    // Get session token from cookies or authorization header
    const authHeader = req.headers.get('authorization');
    const businessIdHeader = req.headers.get('x-business-id');

    if (!authHeader) return null;

    // Extract token from Bearer header
    const token = authHeader.replace('Bearer ', '');
    if (!token) return null;

    // Look up the refresh token to find the user
    const refreshToken = await db.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            businessUsers: {
              where: { isActive: true },
              include: {
                business: {
                  select: { id: true, name: true, businessType: true, slug: true },
                },
              },
            },
          },
        },
      },
    });

    if (!refreshToken || refreshToken.expiresAt < new Date()) return null;
    if (!refreshToken.user.isActive) return null;

    const user = refreshToken.user;
    const primaryBusinessUser = user.businessUsers[0];
    const businessId = businessIdHeader || primaryBusinessUser?.business.id;

    // If a specific business context is requested, find the matching role
    let role: Role = primaryBusinessUser?.role || 'CUSTOMER';
    let storeId: string | undefined = primaryBusinessUser?.storeId || undefined;

    if (businessId && businessId !== primaryBusinessUser?.business.id) {
      const matchingBU = user.businessUsers.find(
        (bu) => bu.business.id === businessId
      );
      if (matchingBU) {
        role = matchingBU.role;
        storeId = matchingBU.storeId || undefined;
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      businessId,
      storeId,
      permissions: getPermissionsForRole(role),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// MIDDLEWARE WRAPPERS
// ============================================================================

/**
 * Main API middleware wrapper
 * Combines auth, permissions, rate limiting, and validation
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
            // Attach validated body to request for handler use
            (req as AuthenticatedRequest & { validatedBody: unknown }).validatedBody = validated.data;
          } catch {
            return createErrorResponse('Invalid JSON body', 400);
          }
        }

        // Authentication
        if (config.requireAuth) {
          const user = await extractUserFromRequest(req);
          if (!user) {
            return createErrorResponse('Authentication required', 401);
          }
          (req as AuthenticatedRequest).user = user;

          // Business context
          if (config.requireBusinessContext && !user.businessId) {
            return createErrorResponse('Business context required', 400);
          }

          // Role check
          if (config.requiredRoles && config.requiredRoles.length > 0) {
            if (!config.requiredRoles.includes(user.role)) {
              return createErrorResponse('Insufficient role permissions', 403);
            }
          }

          // Single permission check
          if (config.requiredPermission) {
            if (!hasPermission(user.role, config.requiredPermission)) {
              return createErrorResponse('Insufficient permissions', 403);
            }
          }

          // Multiple permissions check (any match)
          if (config.requiredPermissions && config.requiredPermissions.length > 0) {
            if (!hasAnyPermission(user.role, config.requiredPermissions)) {
              return createErrorResponse('Insufficient permissions', 403);
            }
          }

          // Set business context on request
          if (user.businessId) {
            (req as AuthenticatedRequest).businessContext = {
              businessId: user.businessId,
              businessType: 'GROCERY', // Would be populated from DB
              businessSlug: '',
              businessName: '',
              role: user.role,
              userId: user.id,
              storeId: user.storeId,
              permissions: user.permissions,
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
  // Handle Zod v4 error format
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
