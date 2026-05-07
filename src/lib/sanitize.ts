// ============================================================================
// Quantix Technology — Input Sanitization Utilities
// MANAGED PLATFORM
//
// Provides sanitization functions for all user inputs to prevent
// injection attacks, XSS, and data integrity issues.
// ============================================================================

// ============================================================================
// STRING SANITIZATION
// ============================================================================

/**
 * Sanitize a general string input.
 * - Strips HTML tags
 * - Trims whitespace
 * - Normalizes Unicode
 * - Removes null bytes
 *
 * @param input - Raw string input
 * @param maxLength - Optional max length (default: no limit)
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength?: number): string {
  if (typeof input !== 'string') return '';

  let sanitized = input
    // Remove null bytes
    .replace(/\0/g, '')
    // Strip HTML tags (basic — catches <script>, <img onerror=>, etc.)
    .replace(/<[^>]*>/g, '')
    // Trim whitespace
    .trim()
    // Normalize Unicode (NFC form)
    .normalize('NFC');

  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

// ============================================================================
// PHONE SANITIZATION
// ============================================================================

/**
 * Sanitize an Indian phone number.
 * - Strips all non-digit characters
 * - Validates Indian format (starts with 6-9, 10 digits)
 * - Handles +91 prefix
 *
 * @param phone - Raw phone input
 * @returns Sanitized 10-digit phone number or empty string if invalid
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return '';

  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle +91 prefix (strip leading 91 if 12 digits)
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.substring(2);
  }

  // Handle leading 0 (strip if 11 digits starting with 0)
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // Validate Indian phone format: 10 digits starting with 6-9
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }

  return '';
}

// ============================================================================
// EMAIL SANITIZATION
// ============================================================================

/**
 * Sanitize and normalize an email address.
 * - Trims whitespace
 * - Converts to lowercase
 * - Removes surrounding quotes
 * - Basic format validation
 *
 * @param email - Raw email input
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';

  let sanitized = email
    .trim()
    .toLowerCase()
    // Remove surrounding quotes
    .replace(/^["']|["']$/g, '')
    // Remove any whitespace within (shouldn't be there)
    .replace(/\s/g, '');

  // Basic email format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(sanitized)) {
    return '';
  }

  return sanitized;
}

// ============================================================================
// SEARCH QUERY SANITIZATION
// ============================================================================

/**
 * Sanitize a search query string.
 * - Strips HTML tags
 * - Removes SQL injection patterns
 * - Removes shell metacharacters
 * - Trims and normalizes whitespace
 * - Limits length
 *
 * @param query - Raw search query
 * @param maxLength - Maximum query length (default: 200)
 * @returns Sanitized search query
 */
export function sanitizeSearchQuery(query: string, maxLength: number = 200): string {
  if (typeof query !== 'string') return '';

  let sanitized = query
    // Remove null bytes
    .replace(/\0/g, '')
    // Strip HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove SQL injection patterns
    .replace(/(--|;|\/\*|\*\/|xp_|sp_)/gi, '')
    // Remove shell metacharacters
    .replace(/[`$|&;<>(){}[\]\\!]/g, '')
    // Normalize whitespace (collapse multiple spaces)
    .replace(/\s+/g, ' ')
    .trim()
    // Limit length
    .substring(0, maxLength);

  return sanitized;
}

// ============================================================================
// URL SANITIZATION
// ============================================================================

/** Allowed URL protocols */
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Sanitize and validate a URL.
 * - Validates protocol (only http/https allowed)
 * - Trims whitespace
 * - Checks for valid URL format
 *
 * @param url - Raw URL input
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';

  const trimmed = url.trim();

  // Check for empty or obviously invalid URLs
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);

    // Only allow http/https protocols
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return '';
    }

    // Block localhost/private IPs in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsed.hostname;
      const privatePatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
        /^192\.168\./,
        /^0\./,
        /^::1$/,
        /^fc00:/i,
        /^fe80:/i,
      ];
      if (privatePatterns.some(pattern => pattern.test(hostname))) {
        return '';
      }
    }

    return trimmed;
  } catch {
    return '';
  }
}

// ============================================================================
// OBJECT SANITIZATION
// ============================================================================

/**
 * Recursively sanitize all string values in an object.
 * Useful for sanitizing entire request bodies.
 *
 * @param obj - Object to sanitize
 * @param maxLength - Max length for string values
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  maxLength?: number
): T {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value, maxLength);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeString(item, maxLength)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>, maxLength)
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, maxLength);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}
