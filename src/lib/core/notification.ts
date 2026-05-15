// ============================================================================
// QUANTIX CORE — Notification System
// Multi-channel notifications: Push, Email, WhatsApp, In-App (NO SMS)
// Template engine with {{variable}} interpolation
// Order/Delivery/Subscription-specific notification helpers
// ============================================================================

import { db } from '@/lib/db';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType =
  | 'ORDER_STATUS'
  | 'DELIVERY_UPDATE'
  | 'PROMOTION'
  | 'SUBSCRIPTION'
  | 'PAYMENT'
  | 'SYSTEM';

export type NotificationChannel =
  | 'PUSH'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'IN_APP';

export interface SendNotificationParams {
  businessId: string;
  userId?: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  /** If true, attempts to actually send via external provider (FCM, email, etc.) */
  sendImmediately?: boolean;
}

export interface NotificationInfo {
  id: string;
  businessId: string;
  userId: string | null;
  type: string;
  channel: string;
  title: string;
  message: string;
  data: string;
  isRead: boolean;
  readAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

export interface NotificationFilters {
  type?: NotificationType;
  channel?: NotificationChannel;
  isRead?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface NotificationTemplateInfo {
  id: string;
  key: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  isActive: boolean;
}

// ============================================================================
// SEND NOTIFICATION
// ============================================================================

/**
 * Send a notification through the specified channel.
 * Creates a Notification record. If sendImmediately is true,
 * attempts delivery via the appropriate channel provider.
 * Otherwise, queues it for batch processing.
 */
export async function sendNotification(params: SendNotificationParams): Promise<{
  success: boolean;
  notification?: NotificationInfo;
  error?: string;
}> {
  try {
    const notification = await db.notification.create({
      data: {
        businessId: params.businessId,
        userId: params.userId,
        type: params.type,
        channel: params.channel,
        title: params.title,
        message: params.message,
        data: JSON.stringify(params.data || {}),
      },
    });

    // Attempt immediate delivery if requested
    if (params.sendImmediately) {
      const deliveryResult = await deliverNotification(
        params.channel,
        params
      );

      if (deliveryResult.success) {
        await db.notification.update({
          where: { id: notification.id },
          data: { sentAt: new Date() },
        });
      } else {
        await db.notification.update({
          where: { id: notification.id },
          data: {
            failedAt: new Date(),
            error: deliveryResult.error,
          },
        });
      }
    }

    const refreshed = await db.notification.findUnique({ where: { id: notification.id } });
    return {
      success: true,
      notification: refreshed ? mapNotificationToInfo(refreshed) : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error creating notification';
    return { success: false, error: message };
  }
}

// ============================================================================
// ORDER NOTIFICATIONS
// ============================================================================

/**
 * Send an order status notification to the customer.
 * Uses the appropriate template based on the status change.
 */
export async function sendOrderNotification(
  orderId: string,
  type: 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled'
): Promise<{ success: boolean; error?: string }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { business: true, customer: true },
  });

  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  const notificationMap: Record<string, { title: string; message: string; type: NotificationType }> = {
    confirmed: {
      title: 'Order Confirmed! 🎉',
      message: `Your order #${order.orderNumber} has been confirmed and is being processed.`,
      type: 'ORDER_STATUS',
    },
    preparing: {
      title: 'Order Preparing 👨‍🍳',
      message: `Your order #${order.orderNumber} is now being prepared.`,
      type: 'ORDER_STATUS',
    },
    ready: {
      title: 'Order Ready! ✅',
      message: `Your order #${order.orderNumber} is ready for pickup/delivery.`,
      type: 'ORDER_STATUS',
    },
    out_for_delivery: {
      title: 'Out for Delivery 🚗',
      message: `Your order #${order.orderNumber} is on its way to you!`,
      type: 'ORDER_STATUS',
    },
    delivered: {
      title: 'Order Delivered! 📦',
      message: `Your order #${order.orderNumber} has been delivered. Enjoy!`,
      type: 'ORDER_STATUS',
    },
    cancelled: {
      title: 'Order Cancelled ❌',
      message: `Your order #${order.orderNumber} has been cancelled.`,
      type: 'ORDER_STATUS',
    },
  };

  const config = notificationMap[type];
  if (!config) {
    return { success: false, error: `Unknown order notification type: ${type}` };
  }

  // Try to get template from DB
  const templateKey = `order.${type}`;
  const template = await getNotificationTemplate(templateKey, 'IN_APP');

  const renderedMessage = template
    ? renderTemplate(template.body, {
        orderNumber: order.orderNumber,
        customerName: order.customerName || 'Customer',
        businessName: order.business.name,
        totalAmount: order.totalAmount.toFixed(2),
      })
    : config.message;

  const renderedTitle = template?.subject
    ? renderTemplate(template.subject, {
        orderNumber: order.orderNumber,
        businessName: order.business.name,
      })
    : config.title;

  // Get userId from customer if available
  let userId: string | undefined;
  if (order.customerId) {
    const customer = await db.customer.findUnique({
      where: { id: order.customerId },
      select: { userId: true },
    });
    userId = customer?.userId || undefined;
  }

  // Send in-app notification
  await sendNotification({
    businessId: order.businessId,
    userId,
    type: config.type,
    channel: 'IN_APP',
    title: renderedTitle,
    message: renderedMessage,
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderType: type,
    },
    sendImmediately: true,
  });

  // Also queue a push notification if user has FCM token
  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (user?.fcmToken) {
      await sendNotification({
        businessId: order.businessId,
        userId,
        type: config.type,
        channel: 'PUSH',
        title: renderedTitle,
        message: renderedMessage,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderType: type,
        },
      });
    }
  }

  return { success: true };
}

// ============================================================================
// DELIVERY NOTIFICATIONS
// ============================================================================

/**
 * Send a delivery update notification.
 */
export async function sendDeliveryNotification(
  deliveryId: string,
  type: 'assigned' | 'picked_up' | 'on_the_way' | 'arrived' | 'delivered' | 'failed'
): Promise<{ success: boolean; error?: string }> {
  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      order: { include: { business: true, customer: true } },
      deliveryPartner: true,
    },
  });

  if (!delivery) {
    return { success: false, error: 'Delivery not found' };
  }

  const notificationMap: Record<string, { title: string; message: string }> = {
    assigned: {
      title: 'Delivery Partner Assigned',
      message: `A delivery partner has been assigned to your order #${delivery.order.orderNumber}.`,
    },
    picked_up: {
      title: 'Order Picked Up 📦',
      message: `Your order #${delivery.order.orderNumber} has been picked up and is on its way.`,
    },
    on_the_way: {
      title: 'On the Way 🚗',
      message: `Your order #${delivery.order.orderNumber} is on its way!`,
    },
    arrived: {
      title: 'Delivery Partner Arrived 📍',
      message: `Your delivery partner has arrived at your location for order #${delivery.order.orderNumber}.`,
    },
    delivered: {
      title: 'Order Delivered! ✅',
      message: `Your order #${delivery.order.orderNumber} has been delivered successfully.`,
    },
    failed: {
      title: 'Delivery Failed ❌',
      message: `Delivery of order #${delivery.order.orderNumber} could not be completed. We will retry.`,
    },
  };

  const config = notificationMap[type];
  if (!config) {
    return { success: false, error: `Unknown delivery notification type: ${type}` };
  }

  // Try template
  const templateKey = `delivery.${type}`;
  const template = await getNotificationTemplate(templateKey, 'IN_APP');

  const renderedMessage = template
    ? renderTemplate(template.body, {
        orderNumber: delivery.order.orderNumber,
        customerName: delivery.order.customerName || 'Customer',
        businessName: delivery.order.business.name,
        partnerName: delivery.deliveryPartner?.name || 'Delivery Partner',
        otp: delivery.deliveryOtp || '',
      })
    : config.message;

  // Get userId from customer
  let userId: string | undefined;
  if (delivery.order.customerId) {
    const customer = await db.customer.findUnique({
      where: { id: delivery.order.customerId },
      select: { userId: true },
    });
    userId = customer?.userId || undefined;
  }

  await sendNotification({
    businessId: delivery.order.businessId,
    userId,
    type: 'DELIVERY_UPDATE',
    channel: 'IN_APP',
    title: config.title,
    message: renderedMessage,
    data: {
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      orderNumber: delivery.order.orderNumber,
      deliveryType: type,
    },
    sendImmediately: true,
  });

  return { success: true };
}

// ============================================================================
// GET NOTIFICATIONS
// ============================================================================

/**
 * Get notifications for a user with optional filters.
 * Supports pagination, type filtering, and read status.
 */
export async function getNotifications(
  userId: string,
  filters?: NotificationFilters
): Promise<{
  notifications: NotificationInfo[];
  total: number;
  unreadCount: number;
}> {
  const whereClause: Record<string, unknown> = {
    userId,
    ...(filters?.type && { type: filters.type }),
    ...(filters?.channel && { channel: filters.channel }),
    ...(filters?.isRead !== undefined && { isRead: filters.isRead }),
    ...(filters?.dateFrom && filters?.dateTo && {
      createdAt: {
        gte: filters.dateFrom,
        lte: filters.dateTo,
      },
    }),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    }),
    db.notification.count({ where: whereClause }),
    db.notification.count({
      where: {
        userId,
        isRead: false,
      },
    }),
  ]);

  return {
    notifications: notifications.map(mapNotificationToInfo),
    total,
    unreadCount,
  };
}

// ============================================================================
// MARK AS READ
// ============================================================================

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const notification = await db.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    return { success: false, error: 'Notification not found' };
  }

  if (notification.isRead) {
    return { success: true }; // Already read
  }

  await db.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return { success: true };
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId: string): Promise<{
  success: boolean;
  count: number;
}> {
  const result = await db.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return { success: true, count: result.count };
}

// ============================================================================
// TEMPLATE ENGINE
// ============================================================================

/**
 * Get a notification template by key and channel.
 * Returns null if no template is found.
 */
export async function getNotificationTemplate(
  key: string,
  channel: NotificationChannel
): Promise<NotificationTemplateInfo | null> {
  const template = await db.notificationTemplate.findUnique({
    where: {
      key_channel: { key, channel },
    },
  });

  if (!template || !template.isActive) {
    return null;
  }

  return {
    id: template.id,
    key: template.key,
    name: template.name,
    channel: template.channel,
    subject: template.subject,
    body: template.body,
    isActive: template.isActive,
  };
}

/**
 * Render a template by replacing {{variable}} placeholders with actual values.
 * Supports nested data access: {{customer.name}}, {{order.totalAmount}} etc.
 *
 * Example:
 *   renderTemplate("Hello {{name}}, your order #{{orderNumber}} is confirmed!", {
 *     name: "John",
 *     orderNumber: "ORD-123"
 *   })
 *   → "Hello John, your order #ORD-123 is confirmed!"
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path: string) => {
    const value = getNestedValue(data, path);
    return value !== undefined && value !== null ? String(value) : match;
  });
}

// ============================================================================
// DELIVERY PROVIDER (Stub)
// In production, these would integrate with FCM, SendGrid, Twilio, etc.
// ============================================================================

async function deliverNotification(
  channel: NotificationChannel,
  params: SendNotificationParams
): Promise<{ success: boolean; error?: string }> {
  switch (channel) {
    case 'PUSH':
      // In production: call FCM/APNs with params.userId's fcmToken
      return { success: true };

    case 'EMAIL':
      // In production: call SendGrid/SES with params.userId's email
      return { success: true };

    case 'WHATSAPP':
      // In production: call WhatsApp Business API with params.userId's phone
      return { success: true };

    case 'IN_APP':
      // In-app notifications are already stored in DB — no external delivery needed
      return { success: true };

    default:
      return { success: false, error: `Unknown notification channel: ${channel}` };
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function mapNotificationToInfo(notification: {
  id: string;
  businessId: string;
  userId: string | null;
  type: string;
  channel: string;
  title: string;
  message: string;
  data: string;
  isRead: boolean;
  readAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
  error: string | null;
  createdAt: Date;
}): NotificationInfo {
  return {
    id: notification.id,
    businessId: notification.businessId,
    userId: notification.userId,
    type: notification.type,
    channel: notification.channel,
    title: notification.title,
    message: notification.message,
    data: notification.data,
    isRead: notification.isRead,
    readAt: notification.readAt,
    sentAt: notification.sentAt,
    failedAt: notification.failedAt,
    error: notification.error,
    createdAt: notification.createdAt,
  };
}

/**
 * Get a nested value from an object using dot notation.
 * E.g., getNestedValue({ customer: { name: "John" } }, "customer.name") → "John"
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
