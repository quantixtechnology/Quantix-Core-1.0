// ============================================================================
// Quantix Technology — API Error Interceptor
// Phase 5: Frontend Infrastructure
// Standalone interceptor utilities that can be integrated into api-client.ts
// ============================================================================

import { AppError, logError, isRetryable } from "./error-handler";

// ============================================================================
// TYPES
// ============================================================================

interface RequestLog {
  url: string;
  method: string;
  timestamp: string;
  headers?: Record<string, string>;
}

interface ResponseLog {
  url: string;
  status: number;
  ok: boolean;
  timestamp: string;
  duration?: number;
}

// ============================================================================
// REQUEST INTERCEPTOR
// ============================================================================

/**
 * Intercept and enhance outgoing API requests
 * - Adds authentication headers
 * - Adds request logging
 * - Adds request timing
 *
 * Usage in api-client.ts:
 * ```ts
 * const interceptedOptions = interceptRequest(url, options);
 * const response = await fetch(url, interceptedOptions);
 * ```
 */
export function interceptRequest(
  url: string,
  options: RequestInit
): RequestInit & { _meta?: { startTime: number } } {
  const startTime = Date.now();

  // Clone headers to avoid mutating the original
  const headers = new Headers(options.headers);

  // Ensure Content-Type is set for JSON requests
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    try {
      JSON.parse(options.body as string);
      headers.set("Content-Type", "application/json");
    } catch {
      // Not JSON body, skip
    }
  }

  // Add request ID for tracing
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  headers.set("X-Request-ID", requestId);

  // Add business context if available
  if (typeof window !== "undefined") {
    const businessId = localStorage.getItem("quantix_business_id");
    if (businessId && !headers.has("x-business-id")) {
      headers.set("x-business-id", businessId);
    }
  }

  // Log request in development
  if (process.env.NODE_ENV === "development") {
    const logEntry: RequestLog = {
      url,
      method: options.method || "GET",
      timestamp: new Date().toISOString(),
    };
    console.debug("[API Request]", logEntry);
  }

  return {
    ...options,
    headers: Object.fromEntries(headers.entries()),
    _meta: { startTime },
  };
}

// ============================================================================
// RESPONSE INTERCEPTOR
// ============================================================================

/**
 * Intercept and process API responses
 * - Checks status codes and converts errors to AppError
 * - Logs response metadata
 * - Handles common error patterns (auth, rate limit, etc.)
 *
 * Usage in api-client.ts:
 * ```ts
 * const data = await response.json();
 * interceptResponse(response, data);
 * ```
 */
export function interceptResponse(response: Response, data: unknown): void {
  // Log response in development
  if (process.env.NODE_ENV === "development") {
    const logEntry: ResponseLog = {
      url: response.url,
      status: response.status,
      ok: response.ok,
      timestamp: new Date().toISOString(),
    };
    console.debug("[API Response]", logEntry);
  }

  // If response is not OK, throw an AppError
  if (!response.ok) {
    const appError = AppError.fromApiError({
      status: response.status,
      data,
      message:
        (data as { error?: string; message?: string })?.error ||
        (data as { error?: string; message?: string })?.message ||
        `Request failed with status ${response.status}`,
    });

    logError(appError, {
      context: "API Response Interceptor",
      url: response.url,
      status: response.status,
    });

    throw appError;
  }
}

// ============================================================================
// MUTATION ERROR HANDLER
// ============================================================================

/**
 * Standardized error handler for mutations (create, update, delete)
 * Converts any error to AppError and logs it
 *
 * Usage with TanStack Query:
 * ```ts
 * useMutation({
 *   mutationFn: createOrder,
 *   onError: handleMutationError,
 * })
 * ```
 */
export function handleMutationError(error: unknown): AppError {
  const appError = error instanceof AppError ? error : AppError.fromApiError(error);

  logError(appError, {
    context: "Mutation Error",
    type: appError.type,
    status: appError.status,
  });

  return appError;
}

// ============================================================================
// FETCH WITH INTERCEPTORS
// ============================================================================

/**
 * Enhanced fetch function with built-in request/response interceptors
 * Can be used as a drop-in replacement for raw fetch calls
 *
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws AppError on failure
 */
export async function interceptedFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  // Apply request interceptor
  const interceptedOptions = interceptRequest(url, options) as RequestInit;
  const startTime = Date.now();

  try {
    const response = await fetch(url, interceptedOptions);

    const data = await response.json();
    const duration = Date.now() - startTime;

    // Log timing in development
    if (process.env.NODE_ENV === "development") {
      console.debug(`[API Timing] ${options.method || "GET"} ${url} — ${duration}ms`);
    }

    // Check for errors
    if (!response.ok) {
      const appError = AppError.fromApiError({
        status: response.status,
        data,
        message:
          data?.error || data?.message || `Request failed with status ${response.status}`,
      });

      logError(appError, {
        context: "interceptedFetch",
        url,
        status: response.status,
        duration,
      });

      throw appError;
    }

    return data as T;
  } catch (error) {
    // If already an AppError, re-throw
    if (error instanceof AppError) throw error;

    // Convert network/unknown errors
    const appError = AppError.fromApiError(error);
    logError(appError, {
      context: "interceptedFetch",
      url,
      duration: Date.now() - startTime,
    });

    throw appError;
  }
}
