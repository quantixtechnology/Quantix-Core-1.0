"use client";

// ============================================================================
// Quantix Technology — Toast Notification Hook
// Phase 5: Frontend Infrastructure
// Bridges WebSocket events to toast notifications using sonner
// ============================================================================

import { useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useRealtime, type RealtimeEvent, type RealtimePayload } from "./use-realtime";

// ============================================================================
// EVENT-TO-TOAST MAPPING
// ============================================================================

interface ToastConfig {
  title: string;
  description: (payload: RealtimePayload) => string;
  variant: "default" | "success" | "error" | "warning" | "info";
  icon?: string;
  action?: {
    label: string;
    onClick: (payload: RealtimePayload) => void;
  };
}

const eventToastMap: Partial<Record<RealtimeEvent, ToastConfig>> = {
  "order:created": {
    title: "New Order",
    description: (p) =>
      `Order #${(p.data.orderNumber as string) || (p.data.orderId as string)?.slice(-8)} has been placed`,
    variant: "info",
    action: {
      label: "View Order",
      onClick: (p) => {
        // Navigate to order detail — can be customized
        console.log("Navigate to order:", p.data.orderId);
      },
    },
  },

  "order:updated": {
    title: "Order Updated",
    description: (p) =>
      `Order #${(p.data.orderNumber as string) || (p.data.orderId as string)?.slice(-8)} has been updated`,
    variant: "default",
  },

  "order:status_changed": {
    title: "Order Status",
    description: (p) => {
      const status = (p.data.newStatus as string) || "updated";
      return `Order #${(p.data.orderNumber as string) || (p.data.orderId as string)?.slice(-8)} is now ${status.replace(/_/g, " ")}`;
    },
    variant: "info",
    action: {
      label: "View Order",
      onClick: (p) => {
        console.log("Navigate to order:", p.data.orderId);
      },
    },
  },

  "order:cancelled": {
    title: "Order Cancelled",
    description: (p) =>
      `Order #${(p.data.orderNumber as string) || (p.data.orderId as string)?.slice(-8)} has been cancelled`,
    variant: "error",
  },

  "delivery:assigned": {
    title: "Delivery Assigned",
    description: (p) =>
      `Delivery for order #${(p.data.orderNumber as string) || (p.data.orderId as string)?.slice(-8)} has been assigned`,
    variant: "info",
    action: {
      label: "View Details",
      onClick: (p) => {
        console.log("Navigate to delivery:", p.data.orderId);
      },
    },
  },

  "delivery:status_changed": {
    title: "Delivery Update",
    description: (p) => {
      const status = (p.data.newStatus as string) || "updated";
      return `Delivery is now ${status.replace(/_/g, " ")}`;
    },
    variant: "info",
  },

  "delivery:otp_verified": {
    title: "Delivery Confirmed",
    description: (p) =>
      `Delivery for order #${(p.data.orderNumber as string) || (p.data.orderId as string)?.slice(-8)} has been confirmed`,
    variant: "success",
  },

  "payment:received": {
    title: "Payment Received",
    description: (p) => {
      const amount = p.data.amount as number;
      const formatted = amount ? `₹${amount.toLocaleString("en-IN")}` : "";
      return `Payment of ${formatted} received for order #${(p.data.orderNumber as string) || (p.data.orderId as string)?.slice(-8)}`;
    },
    variant: "success",
  },

  "payment:failed": {
    title: "Payment Failed",
    description: (p) =>
      `Payment failed for order #${(p.data.orderNumber as string) || (p.data.orderId as string)?.slice(-8)}`,
    variant: "error",
  },

  "notification:new": {
    title: "New Notification",
    description: (p) => (p.data.message as string) || "You have a new notification",
    variant: "default",
  },

  "lead:updated": {
    title: "Lead Updated",
    description: (p) =>
      `Lead "${(p.data.businessName as string) || "Unknown"}" has been updated`,
    variant: "default",
  },

  "lead:stage_changed": {
    title: "Lead Stage Changed",
    description: (p) => {
      const stage = (p.data.newStage as string) || "updated";
      return `"${(p.data.businessName as string) || "Lead"}" moved to ${stage.replace(/_/g, " ")}`;
    },
    variant: "info",
    action: {
      label: "View Lead",
      onClick: (p) => {
        console.log("Navigate to lead:", p.data.leadId);
      },
    },
  },

  "business:updated": {
    title: "Business Updated",
    description: (p) =>
      `"${(p.data.businessName as string) || "Business"}" settings have been updated`,
    variant: "default",
  },

  "product:updated": {
    title: "Product Updated",
    description: (p) =>
      `"${(p.data.productName as string) || "Product"}" has been updated`,
    variant: "default",
  },

  "product:stock_changed": {
    title: "Stock Alert",
    description: (p) => {
      const productName = (p.data.productName as string) || "Product";
      const stock = p.data.newStock as number;
      if (stock === 0) {
        return `"${productName}" is now out of stock!`;
      }
      return `"${productName}" stock is now ${stock} units`;
    },
    variant: "warning",
  },
};

// ============================================================================
// SONNER VARIANT MAPPING
// ============================================================================

function showToast(config: ToastConfig, payload: RealtimePayload) {
  const description = config.description(payload);

  const toastOptions: Parameters<typeof toast>[1] = {
    description,
  };

  // Add action button if configured
  if (config.action) {
    toastOptions.action = {
      label: config.action.label,
      onClick: () => config.action!.onClick(payload),
    };
  }

  // Map variant to sonner toast type
  switch (config.variant) {
    case "success":
      toast.success(config.title, toastOptions);
      break;
    case "error":
      toast.error(config.title, toastOptions);
      break;
    case "warning":
      toast.warning(config.title, toastOptions);
      break;
    case "info":
      toast.info(config.title, toastOptions);
      break;
    default:
      toast(config.title, toastOptions);
  }
}

// ============================================================================
// HOOK
// ============================================================================

interface UseToastNotificationsOptions {
  /** Business ID for the realtime connection */
  businessId?: string;
  /** User ID for the realtime connection */
  userId?: string;
  /** Whether to enable toast notifications (default: true) */
  enabled?: boolean;
  /** Specific events to listen to (omit for all) */
  events?: RealtimeEvent[];
  /** Custom toast handler — overrides default behavior */
  customHandler?: (event: RealtimeEvent, payload: RealtimePayload) => void;
}

export function useToastNotifications(options: UseToastNotificationsOptions = {}) {
  const {
    businessId,
    userId,
    enabled = true,
    events,
    customHandler,
  } = options;

  const { subscribe } = useRealtime({
    businessId,
    userId,
    autoConnect: enabled,
    autoInvalidate: true,
  });

  useEffect(() => {
    if (!enabled) return;

    const allEvents: RealtimeEvent[] = events || Object.keys(eventToastMap) as RealtimeEvent[];

    const unsubscribes = allEvents.map((event) => {
      return subscribe(event, (payload) => {
        // Use custom handler if provided
        if (customHandler) {
          customHandler(event, payload);
          return;
        }

        // Use default toast mapping
        const config = eventToastMap[event];
        if (config) {
          showToast(config, payload);
        }
      });
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [enabled, events, customHandler, subscribe]);

  /**
   * Manually show a toast for a specific event type
   * Useful for non-realtime events (e.g., after a mutation)
   */
  const showEventToast = useCallback(
    (event: RealtimeEvent, payload: RealtimePayload) => {
      const config = eventToastMap[event];
      if (config) {
        showToast(config, payload);
      }
    },
    []
  );

  return { showEventToast };
}
