// ============================================================================
// Quantix Technology — Toast Notification Utilities
// Phase 5: Frontend Infrastructure
// Bridges error handling to sonner toast system
// ============================================================================

import { toast } from "sonner";
import {
  AppError,
  handleApiError,
  getErrorTitle,
  getErrorAction,
  type ErrorType,
} from "./error-handler";

// ============================================================================
// BASE TOAST FUNCTIONS
// ============================================================================

/**
 * Show a success toast (green)
 */
export function showSuccess(message: string, description?: string): string | number {
  return toast.success(message, {
    description,
  });
}

/**
 * Show an error toast (red)
 */
export function showError(message: string, description?: string): string | number {
  return toast.error(message, {
    description,
  });
}

/**
 * Show a warning toast (yellow)
 */
export function showWarning(message: string, description?: string): string | number {
  return toast.warning(message, {
    description,
  });
}

/**
 * Show an info toast (blue)
 */
export function showInfo(message: string, description?: string): string | number {
  return toast.info(message, {
    description,
  });
}

/**
 * Show a loading toast with spinner
 * Returns the toast ID for later dismissal/update
 */
export function showLoading(message: string, description?: string): string | number {
  return toast.loading(message, {
    description,
  });
}

/**
 * Dismiss a specific toast by ID, or all toasts if no ID provided
 */
export function dismissToast(id?: string | number): void {
  if (id !== undefined) {
    toast.dismiss(id);
  } else {
    toast.dismiss();
  }
}

// ============================================================================
// API ERROR TOAST
// ============================================================================

/**
 * Automatically convert an API error to an appropriate toast notification
 * Uses the error handler to determine message, title, and action
 */
export function showApiError(error: unknown): string | number {
  const appError = error instanceof AppError ? error : AppError.fromApiError(error);
  const title = getErrorTitle(appError.type);
  const action = getErrorAction(appError.type);

  // Map error types to appropriate toast variants
  switch (appError.type) {
    case "NETWORK":
      return toast.warning(title, {
        description: action,
        duration: 6000,
      });

    case "AUTH":
      return toast.error(title, {
        description: action,
        duration: 8000,
        action: {
          label: "Log In",
          onClick: () => {
            if (typeof window !== "undefined") {
              window.location.href = "/?view=auth";
            }
          },
        },
      });

    case "VALIDATION":
      return toast.warning(title, {
        description: appError.message || action,
        duration: 5000,
      });

    case "NOT_FOUND":
      return toast.info(title, {
        description: action,
        duration: 4000,
      });

    case "RATE_LIMIT": {
      const retryMsg = appError.retryAfter
        ? `Please wait ${appError.retryAfter} seconds before trying again.`
        : action;
      return toast.warning(title, {
        description: retryMsg,
        duration: 6000,
      });
    }

    case "SERVER":
      return toast.error(title, {
        description: action,
        duration: 6000,
      });

    case "BUSINESS":
      return toast.warning(title, {
        description: appError.message || action,
        duration: 5000,
      });

    case "PAYMENT":
      return toast.error(title, {
        description: appError.message || action,
        duration: 7000,
        action: {
          label: "Retry Payment",
          onClick: () => {
            // Payment retry logic handled by consuming component
          },
        },
      });

    default:
      return toast.error(title, {
        description: appError.message || action,
        duration: 5000,
      });
  }
}

// ============================================================================
// DOMAIN-SPECIFIC TOASTS
// ============================================================================

/**
 * Order status update toast with appropriate styling
 */
export function showOrderUpdate(
  status: string,
  orderNumber: string
): string | number {
  const statusMessages: Record<string, { title: string; desc: string; variant: "success" | "warning" | "info" | "error" }> = {
    placed: {
      title: "Order Placed!",
      desc: `Order #${orderNumber} has been placed successfully.`,
      variant: "success",
    },
    confirmed: {
      title: "Order Confirmed",
      desc: `Order #${orderNumber} has been confirmed by the store.`,
      variant: "success",
    },
    preparing: {
      title: "Being Prepared",
      desc: `Order #${orderNumber} is now being prepared.`,
      variant: "info",
    },
    ready: {
      title: "Ready for Pickup",
      desc: `Order #${orderNumber} is ready for pickup.`,
      variant: "info",
    },
    out_for_delivery: {
      title: "Out for Delivery",
      desc: `Order #${orderNumber} is on its way!`,
      variant: "info",
    },
    delivered: {
      title: "Delivered!",
      desc: `Order #${orderNumber} has been delivered successfully.`,
      variant: "success",
    },
    cancelled: {
      title: "Order Cancelled",
      desc: `Order #${orderNumber} has been cancelled.`,
      variant: "error",
    },
    refunded: {
      title: "Refund Processed",
      desc: `Refund for order #${orderNumber} has been initiated.`,
      variant: "info",
    },
  };

  const config = statusMessages[status.toLowerCase()];
  if (!config) {
    return toast.info("Order Update", {
      description: `Order #${orderNumber} status changed to ${status}.`,
    });
  }

  return toast[config.variant](config.title, {
    description: config.desc,
  });
}

/**
 * Payment status toast with amount formatting
 */
export function showPaymentStatus(
  status: string,
  amount: number
): string | number {
  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  const statusMessages: Record<string, { title: string; desc: string; variant: "success" | "warning" | "info" | "error" }> = {
    pending: {
      title: "Payment Pending",
      desc: `Payment of ${formattedAmount} is pending.`,
      variant: "warning",
    },
    processing: {
      title: "Processing Payment",
      desc: `Payment of ${formattedAmount} is being processed.`,
      variant: "info",
    },
    completed: {
      title: "Payment Successful!",
      desc: `Payment of ${formattedAmount} completed successfully.`,
      variant: "success",
    },
    failed: {
      title: "Payment Failed",
      desc: `Payment of ${formattedAmount} could not be processed. Please try again.`,
      variant: "error",
    },
    refunded: {
      title: "Refund Initiated",
      desc: `Refund of ${formattedAmount} has been initiated.`,
      variant: "info",
    },
    partially_refunded: {
      title: "Partial Refund",
      desc: `Partial refund for ${formattedAmount} has been initiated.`,
      variant: "info",
    },
  };

  const config = statusMessages[status.toLowerCase()];
  if (!config) {
    return toast.info("Payment Update", {
      description: `Payment of ${formattedAmount} status: ${status}.`,
    });
  }

  return toast[config.variant](config.title, {
    description: config.desc,
  });
}

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

export { toast };
