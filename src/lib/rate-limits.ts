// ============================================================================
// Quantix Technology — Predefined Rate Limit Configurations
// MANAGED PLATFORM
//
// Centralizes rate limit settings for all API route categories.
// Used with checkRateLimit from @/lib/middleware.
// ============================================================================

export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed within the window */
  maxRequests: number;
}

// ============================================================================
// RATE LIMIT CONFIGURATIONS
// ============================================================================

export const RATE_LIMITS = {
  /** Auth routes (login, register): 10 requests per 15 minutes */
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 },

  /** OTP send/verify: 5 requests per hour */
  otp: { windowMs: 60 * 60 * 1000, maxRequests: 5 },

  /** Order creation: 10 requests per minute */
  orderCreate: { windowMs: 60 * 1000, maxRequests: 10 },

  /** Payment processing: 5 requests per minute */
  payment: { windowMs: 60 * 1000, maxRequests: 5 },

  /** General API: 60 requests per minute */
  api: { windowMs: 60 * 1000, maxRequests: 60 },

  /** Search endpoints: 30 requests per minute */
  search: { windowMs: 60 * 1000, maxRequests: 30 },

  /** Password reset: 3 requests per hour */
  passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3 },

  /** File upload: 10 requests per minute */
  upload: { windowMs: 60 * 1000, maxRequests: 10 },

  /** Webhook endpoints: 100 requests per minute */
  webhook: { windowMs: 60 * 1000, maxRequests: 100 },

  /** POS operations: 30 requests per minute */
  pos: { windowMs: 60 * 1000, maxRequests: 30 },

  /** Delivery status updates: 20 requests per minute */
  deliveryUpdate: { windowMs: 60 * 1000, maxRequests: 20 },
} as const;

// ============================================================================
// RATE LIMIT KEY HELPERS
// ============================================================================

/**
 * Generate a rate limit key combining IP address and route path.
 * Used to uniquely identify a client for rate limiting.
 *
 * @param ip - Client IP address
 * @param path - API route path
 * @returns Rate limit key string
 */
export function getRateLimitKey(ip: string, path: string): string {
  return `${ip}:${path}`;
}

/**
 * Generate a rate limit key for user-specific rate limiting.
 * Combines user ID with route path for authenticated rate limits.
 *
 * @param userId - Authenticated user ID
 * @param path - API route path
 * @returns Rate limit key string
 */
export function getUserRateLimitKey(userId: string, path: string): string {
  return `user:${userId}:${path}`;
}

/**
 * Generate a rate limit key for email-specific rate limiting.
 * Useful for auth routes where we want to limit per email, not per IP.
 *
 * @param email - Email address
 * @param action - Action being rate limited (e.g., "login", "otp")
 * @returns Rate limit key string
 */
export function getEmailRateLimitKey(email: string, action: string): string {
  return `email:${email.toLowerCase()}:${action}`;
}
