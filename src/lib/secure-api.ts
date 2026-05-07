// ============================================================================
// Quantix Technology — Secure API Middleware
// MANAGED PLATFORM
//
// Composable middleware that combines:
// - Auth check
// - Rate limiting
// - Input validation
// - CORS headers
// - Request size limit
// - Security headers
//
// Built on top of the existing withMiddleware from @/lib/middleware.
// ============================================================================

import type { NextRequest } from 'next/server';
import type { ZodSchema } from 'zod';
import type { Role } from './types';
import { checkRateLimit } from './middleware';

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
    permissions: string[];
    isPlatformAdmin: boolean;
  };
  businessContext?: {
    businessId: string;
    businessType: string;
    businessSlug: string;
    businessName: string;
    role: Role;
    userId: string;
    storeId?: string;
    permissions: string[];
    isPlatformAdmin: boolean;
  };
  validatedBody?: unknown;
}

type HandlerFunction = (
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string | string[]> }
) => Promise<Response>;

interface SecureApiConfig {
  /** Require authentication (default: true) */
  requireAuth?: boolean;
  /** Require specific roles */
  requiredRoles?: Role[];
  /** Rate limit configuration */
  rateLimit?: { windowMs: number; maxRequests: number };
  /** Zod schema for request body validation */
  bodySchema?: ZodSchema;
  /** Allowed HTTP methods (default: all) */
  methods?: string[];
  /** Maximum request body size in bytes (default: 1MB) */
  maxBodySize?: number;
}

// ============================================================================
// SECURITY HEADERS
// ============================================================================

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Request-ID': '',
};

function addSecurityHeaders(response: Response, requestId?: string): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (key === 'X-Request-ID' && requestId) {
      headers.set(key, requestId);
    } else if (value) {
      headers.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ============================================================================
// CORS HEADERS
// ============================================================================

const ALLOWED_ORIGINS = [
  'https://quantixtechnology.in',
  'https://*.quantixtechnology.in',
];

function addCorsHeaders(response: Response, request: NextRequest): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get('origin') || '';

  // Check if origin is allowed
  const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
    if (allowed.startsWith('*.')) {
      return origin.endsWith(allowed.slice(1));
    }
    return origin === allowed;
  });

  // In development, allow all origins
  const isDev = process.env.NODE_ENV === 'development';

  if (isAllowed || isDev) {
    headers.set('Access-Control-Allow-Origin', isDev ? '*' : origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-business-id');
    headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ============================================================================
// REQUEST ID GENERATOR
// ============================================================================

function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `qtx_${timestamp}_${random}`;
}

// ============================================================================
// EXTRACT USER FROM REQUEST
// ============================================================================

async function extractUserFromRequest(req: NextRequest): Promise<AuthenticatedRequest['user'] | null> {
  try {
    const authHeader = req.headers.get('authorization');
    const businessIdHeader = req.headers.get('x-business-id');

    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    if (!token) return null;

    // Dynamic import to avoid circular deps
    const { db } = await import('./db');
    const { getPermissionsForRole } = await import('./permissions');

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
            salesProfile: true,
          },
        },
      },
    });

    if (!refreshToken || refreshToken.expiresAt < new Date()) return null;
    if (!refreshToken.user.isActive) return null;

    const user = refreshToken.user;
    let role: Role = 'CUSTOMER';
    let businessId: string | undefined;
    let storeId: string | undefined;

    if (user.salesProfile) {
      role = 'QUANTIX_SALES_TEAM';
    } else if (user.email.endsWith('@quantixtechnology.in') && user.businessUsers.length === 0) {
      role = 'QUANTIX_SUPER_ADMIN';
    } else if (user.businessUsers.length > 0) {
      const targetBU = businessIdHeader
        ? user.businessUsers.find(bu => bu.business.id === businessIdHeader)
        : user.businessUsers[0];
      if (targetBU) {
        role = targetBU.role;
        businessId = targetBU.business.id;
        storeId = targetBU.storeId || undefined;
      }
    }

    const platAdmin = role === 'QUANTIX_SUPER_ADMIN' || role === 'QUANTIX_SALES_TEAM';

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      businessId: businessId || businessIdHeader || undefined,
      storeId,
      permissions: getPermissionsForRole(role),
      isPlatformAdmin: platAdmin,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// HELPER RESPONSES
// ============================================================================

function errorResponse(message: string, status: number): Response {
  return Response.json({ success: false, error: message }, { status });
}

function validationErrorResponse(error: unknown): Response {
  const errors = error && typeof error === 'object' && 'issues' in error
    ? (error as { issues: Array<{ path: (string | number)[]; message: string }> }).issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
    : [{ field: 'unknown', message: 'Validation failed' }];

  return Response.json(
    { success: false, error: 'Validation failed', errors },
    { status: 400 }
  );
}

// ============================================================================
// SECURE API MIDDLEWARE
// ============================================================================

/**
 * Composable secure API route middleware.
 * Combines auth, rate limiting, validation, CORS, and security headers.
 *
 * @example
 * ```ts
 * export const POST = secureApiRoute({
 *   requireAuth: true,
 *   requiredRoles: ['CLIENT_OWNER'],
 *   rateLimit: RATE_LIMITS.payment,
 *   bodySchema: paymentSchema,
 * })(async (req) => {
 *   const body = req.validatedBody as PaymentInput;
 *   // ... handler logic
 *   return Response.json({ success: true, data: result });
 * });
 * ```
 */
export function secureApiRoute(config: SecureApiConfig = {}) {
  return function (handler: HandlerFunction): HandlerFunction {
    return async function (req, context) {
      const requestId = generateRequestId();

      try {
        // ── Method Check ──
        if (config.methods && config.methods.length > 0) {
          if (!config.methods.includes(req.method)) {
            return addSecurityHeaders(
              addCorsHeaders(
                errorResponse(`Method ${req.method} not allowed`, 405),
                req
              ),
              requestId
            );
          }
        }

        // ── CORS Preflight ──
        if (req.method === 'OPTIONS') {
          return addSecurityHeaders(
            addCorsHeaders(
              new Response(null, { status: 204 }),
              req
            ),
            requestId
          );
        }

        // ── Rate Limiting ──
        if (config.rateLimit) {
          const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
          const rateLimitKey = `${clientIp}:${req.nextUrl.pathname}`;
          const rateLimitError = checkRateLimit(rateLimitKey, config.rateLimit);
          if (rateLimitError) {
            const response = errorResponse(rateLimitError, 429);
            response.headers.set('Retry-After', String(Math.ceil(config.rateLimit.windowMs / 1000)));
            return addSecurityHeaders(addCorsHeaders(response, req), requestId);
          }
        }

        // ── Body Validation & Size Limit ──
        if (config.bodySchema && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
          try {
            const maxBodySize = config.maxBodySize || 1024 * 1024; // 1MB default

            // Check content-length if available
            const contentLength = req.headers.get('content-length');
            if (contentLength && parseInt(contentLength, 10) > maxBodySize) {
              return addSecurityHeaders(
                addCorsHeaders(
                  errorResponse('Request body too large', 413),
                  req
                ),
                requestId
              );
            }

            const body = await req.json();
            const validated = config.bodySchema.safeParse(body);
            if (!validated.success) {
              return addSecurityHeaders(
                addCorsHeaders(
                  validationErrorResponse(validated.error),
                  req
                ),
                requestId
              );
            }
            (req as AuthenticatedRequest).validatedBody = validated.data;
          } catch {
            return addSecurityHeaders(
              addCorsHeaders(
                errorResponse('Invalid JSON body', 400),
                req
              ),
              requestId
            );
          }
        }

        // ── Authentication ──
        if (config.requireAuth !== false) {
          const user = await extractUserFromRequest(req);
          if (!user) {
            return addSecurityHeaders(
              addCorsHeaders(
                errorResponse('Authentication required', 401),
                req
              ),
              requestId
            );
          }
          (req as AuthenticatedRequest).user = user;

          // ── Role Check ──
          if (config.requiredRoles && config.requiredRoles.length > 0) {
            if (!config.requiredRoles.includes(user.role)) {
              return addSecurityHeaders(
                addCorsHeaders(
                  errorResponse('Insufficient role permissions', 403),
                  req
                ),
                requestId
              );
            }
          }
        }

        // ── Execute Handler ──
        const response = await handler(req as AuthenticatedRequest, context);
        return addSecurityHeaders(addCorsHeaders(response, req), requestId);
      } catch (error) {
        console.error('[SecureAPI] Unhandled error:', error);
        return addSecurityHeaders(
          addCorsHeaders(
            errorResponse('Internal server error', 500),
            req
          ),
          requestId
        );
      }
    };
  };
}
