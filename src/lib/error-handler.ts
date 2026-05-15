// ============================================================================
// Quantix Technology — Centralized Error Handling
// Phase 5: Frontend Infrastructure — Enhanced
// ============================================================================

// ============================================================================
// ERROR TYPES & SEVERITY
// ============================================================================

export type ErrorType =
  | "NETWORK"
  | "AUTH"
  | "VALIDATION"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "SERVER"
  | "BUSINESS"
  | "PAYMENT"
  | "UNKNOWN";

export type ErrorSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL";

// ============================================================================
// APP ERROR CLASS
// ============================================================================

export class AppError extends Error {
  type: ErrorType;
  status: number;
  data?: unknown;
  retryable: boolean;
  severity: ErrorSeverity;
  /** Optional field name for validation errors */
  field?: string;
  /** Retry-After seconds for rate limit errors */
  retryAfter?: number;

  constructor(
    message: string,
    type: ErrorType,
    status: number,
    options?: {
      data?: unknown;
      retryable?: boolean;
      severity?: ErrorSeverity;
      field?: string;
      retryAfter?: number;
    }
  ) {
    super(message);
    this.name = "AppError";
    this.type = type;
    this.status = status;
    this.data = options?.data;
    this.retryable = options?.retryable ?? false;
    this.severity = options?.severity ?? "ERROR";
    this.field = options?.field;
    this.retryAfter = options?.retryAfter;
  }

  /**
   * Create an AppError from an API error response
   */
  static fromApiError(error: unknown): AppError {
    if (error instanceof AppError) return error;

    // Handle fetch errors with status and data
    if (error && typeof error === "object" && "status" in error) {
      const apiErr = error as { status: number; data?: unknown; message?: string };
      const status = apiErr.status;
      const message = apiErr.message || "An error occurred";

      switch (status) {
        case 401:
          return AppError.auth();
        case 403:
          return AppError.auth("You do not have permission to perform this action.");
        case 404:
          return AppError.notFound();
        case 422:
          return AppError.validation(
            "Please check your input and try again.",
            undefined,
            apiErr.data
          );
        case 429:
          return AppError.rateLimit(
            (apiErr.data as { retryAfter?: number })?.retryAfter
          );
        case 500:
          return AppError.server();
        case 502:
        case 503:
        case 504:
          return AppError.server("Service temporarily unavailable. Please try again.");
        default:
          return new AppError(message, "UNKNOWN", status, {
            data: apiErr.data,
            severity: status >= 500 ? "ERROR" : "WARN",
          });
      }
    }

    // Handle network errors
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      return AppError.network();
    }

    // Handle generic Error
    if (error instanceof Error) {
      return new AppError(error.message, "UNKNOWN", 0, {
        severity: "WARN",
      });
    }

    // Handle string errors
    if (typeof error === "string") {
      return new AppError(error, "UNKNOWN", 0, {
        severity: "WARN",
      });
    }

    return new AppError("An unexpected error occurred", "UNKNOWN", 0, {
      severity: "ERROR",
    });
  }

  /**
   * Create a network error (no connectivity)
   */
  static network(message?: string): AppError {
    return new AppError(
      message || "Network error. Please check your connection and try again.",
      "NETWORK",
      0,
      { retryable: true, severity: "WARN" }
    );
  }

  /**
   * Create an authentication/authorization error
   */
  static auth(message?: string): AppError {
    return new AppError(
      message || "Your session has expired. Please log in again.",
      "AUTH",
      401,
      { severity: "WARN" }
    );
  }

  /**
   * Create a validation error
   */
  static validation(message: string, field?: string, data?: unknown): AppError {
    return new AppError(message, "VALIDATION", 422, {
      data,
      field,
      severity: "INFO",
    });
  }

  /**
   * Create a not found error
   */
  static notFound(resource?: string): AppError {
    return new AppError(
      resource
        ? `${resource} not found.`
        : "The requested resource was not found.",
      "NOT_FOUND",
      404,
      { severity: "WARN" }
    );
  }

  /**
   * Create a rate limit error
   */
  static rateLimit(retryAfter?: number): AppError {
    return new AppError(
      "Too many requests. Please try again later.",
      "RATE_LIMIT",
      429,
      { retryable: true, severity: "WARN", retryAfter }
    );
  }

  /**
   * Create a server error
   */
  static server(message?: string): AppError {
    return new AppError(
      message || "Internal server error. Please try again.",
      "SERVER",
      500,
      { retryable: true, severity: "ERROR" }
    );
  }

  /**
   * Create a business logic error
   */
  static business(message: string): AppError {
    return new AppError(message, "BUSINESS", 400, {
      severity: "WARN",
    });
  }

  /**
   * Create a payment error
   */
  static payment(message: string): AppError {
    return new AppError(message, "PAYMENT", 402, {
      severity: "ERROR",
    });
  }
}

// ============================================================================
// ERROR UTILITY FUNCTIONS
// ============================================================================

/**
 * Handle an API error and return a user-friendly message
 * This function also shows a toast via the returned data, which can be
 * consumed by toast-utils.showApiError()
 */
export function handleApiError(error: unknown): {
  message: string;
  type: ErrorType;
  severity: ErrorSeverity;
} {
  const appError = AppError.fromApiError(error);
  return {
    message: appError.message,
    type: appError.type,
    severity: appError.severity,
  };
}

/**
 * Get a human-readable error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return "An unexpected error occurred";

  if (error instanceof AppError) return error.message;

  if (error instanceof Error) return error.message;

  if (typeof error === "string") return error;

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return "An unexpected error occurred";
}

/**
 * Check if an error is worth retrying
 */
export function isRetryable(error: unknown): boolean {
  if (!error) return false;

  if (error instanceof AppError) {
    return error.retryable;
  }

  // Check for network errors
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return true;
  }

  // Check for status in object
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    return status === 429 || (status >= 500 && status < 600);
  }

  return false;
}

/**
 * Generic retry wrapper with exponential backoff
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in ms for exponential backoff (default: 1000)
 * @returns The result of the function or throws the last error
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt or the error isn't retryable
      if (attempt === maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const delay = getRetryDelay(attempt, baseDelay);

      logError(error, {
        context: "withRetry",
        attempt: attempt + 1,
        maxRetries,
        nextRetryIn: delay,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Calculate retry delay with exponential backoff + jitter
 * @param failureCount - The failure attempt number (0-indexed)
 * @param baseDelay - Base delay in ms (default: 1000)
 * @returns Delay in milliseconds
 */
export function getRetryDelay(failureCount: number, baseDelay: number = 1000): number {
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, failureCount), maxDelay);
  // Add jitter: random value between 0 and 25% of delay
  const jitter = delay * 0.25 * Math.random();
  return delay + jitter;
}

/**
 * Check if an error is retryable (legacy alias)
 * @deprecated Use isRetryable() instead
 */
export function isRetryableError(error: unknown): boolean {
  return isRetryable(error);
}

/**
 * Log an error with context
 * In production, this could send to Sentry, DataDog, etc.
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  const appError = error instanceof AppError ? error : AppError.fromApiError(error);

  const logData = {
    timestamp: new Date().toISOString(),
    type: appError.type,
    severity: appError.severity,
    message: appError.message,
    status: appError.status,
    retryable: appError.retryable,
    ...(appError.field && { field: appError.field }),
    ...(appError.retryAfter && { retryAfter: appError.retryAfter }),
    ...(context && { context }),
    ...(appError.data !== undefined && appError.data !== null ? { data: appError.data as Record<string, unknown> } : {}),
    // Include original stack trace in development
    ...(process.env.NODE_ENV === "development" && {
      stack: error instanceof Error ? error.stack : undefined,
    }),
  };

  switch (appError.severity) {
    case "INFO":
      console.info("[Quantix Error]", logData);
      break;
    case "WARN":
      console.warn("[Quantix Error]", logData);
      break;
    case "CRITICAL":
      console.error("[Quantix CRITICAL]", logData);
      break;
    case "ERROR":
    default:
      console.error("[Quantix Error]", logData);
      break;
  }

  // TODO: Send to external error tracking service
  // if (appError.severity === "CRITICAL" || appError.severity === "ERROR") {
  //   sendToSentry(appError, context);
  // }
}

// ============================================================================
// ERROR DISPLAY UTILITIES
// ============================================================================

/**
 * Get a human-readable error title based on error type
 */
export function getErrorTitle(typeOrCode: string): string {
  switch (typeOrCode) {
    case "NETWORK":
    case "NETWORK_ERROR":
      return "Connection Lost";
    case "AUTH":
    case "UNAUTHORIZED":
      return "Session Expired";
    case "FORBIDDEN":
      return "Access Denied";
    case "NOT_FOUND":
      return "Not Found";
    case "VALIDATION":
    case "VALIDATION_ERROR":
      return "Invalid Input";
    case "RATE_LIMIT":
    case "RATE_LIMITED":
      return "Too Many Requests";
    case "SERVER":
    case "SERVER_ERROR":
    case "SERVICE_UNAVAILABLE":
      return "Server Error";
    case "BUSINESS":
      return "Action Not Allowed";
    case "PAYMENT":
      return "Payment Error";
    case "API_ERROR":
      return "Request Failed";
    default:
      return "Something Went Wrong";
  }
}

/**
 * Get suggested action based on error type
 */
export function getErrorAction(typeOrCode: string): string {
  switch (typeOrCode) {
    case "NETWORK":
    case "NETWORK_ERROR":
      return "Check your internet connection and try again.";
    case "AUTH":
    case "UNAUTHORIZED":
      return "Please log in again to continue.";
    case "FORBIDDEN":
      return "Contact your administrator for access.";
    case "NOT_FOUND":
      return "The item you're looking for may have been moved or deleted.";
    case "VALIDATION":
    case "VALIDATION_ERROR":
      return "Review the highlighted fields and correct any errors.";
    case "RATE_LIMIT":
    case "RATE_LIMITED":
      return "Wait a moment before trying again.";
    case "SERVER":
    case "SERVER_ERROR":
    case "SERVICE_UNAVAILABLE":
      return "Our team has been notified. Please try again in a few minutes.";
    case "BUSINESS":
      return "This action cannot be performed at this time.";
    case "PAYMENT":
      return "There was an issue processing your payment. Please try again.";
    default:
      return "Try refreshing the page or contact support if the problem persists.";
  }
}
