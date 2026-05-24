// ============================================================================
// QUANTIX — WebSocket Event Definitions
// Single source of truth for all real-time event names and payload shapes.
// Used by: API routes (emitters), Flutter client, delivery app, admin panel.
// Redis-ready: all events route through the realtime service on port 3003.
// ============================================================================

// ── Event name constants ──────────────────────────────────────────────────────

export const SOCKET_EVENTS = {
  // Order lifecycle
  ORDER_CREATED:        'order:created',
  ORDER_STATUS_CHANGED: 'order:status_changed',
  ORDER_UPDATED:        'order:updated',
  ORDER_CANCELLED:      'order:cancelled',

  // Delivery / partner
  DELIVERY_ASSIGNED:          'delivery:assigned',
  DELIVERY_STATUS_UPDATED:    'delivery:status_updated',
  DELIVERY_LOCATION_UPDATED:  'delivery:location_updated',
  PARTNER_ASSIGNED:           'partner:assigned',

  // Tracking
  TRACKING_ETA_UPDATED:  'tracking:eta_updated',
  TRACKING_SESSION_STARTED: 'tracking:session_started',
  TRACKING_SESSION_ENDED:   'tracking:session_ended',

  // Notifications
  NOTIFICATION_NEW:           'notification:new',
  NOTIFICATION_COUNT_UPDATED: 'notification:count_updated',

  // Payments
  PAYMENT_RECEIVED:  'payment:received',
  PAYMENT_FAILED:    'payment:failed',
  PAYMENT_REFUNDED:  'payment:refunded',

  // POS
  POS_SESSION: 'pos:session',
} as const;

export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

// ── Room naming conventions ───────────────────────────────────────────────────
// Clients subscribe to rooms; emitters target rooms.

export function businessRoom(businessId: string) {
  return `business:${businessId}`;
}
export function storeRoom(businessId: string, storeId: string) {
  return `business:${businessId}:store:${storeId}`;
}
export function orderRoom(orderId: string) {
  return `order:${orderId}`;
}
export function userRoom(userId: string) {
  return `user:${userId}`;
}
export function partnerRoom(partnerId: string) {
  return `partner:${partnerId}`;
}

// ── Payload type contracts ────────────────────────────────────────────────────

export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: string;
  orderType: string;
  totalAmount: number;
  customerName: string;
  businessId: string;
  storeId: string;
  timestamp: string;
}

export interface OrderStatusChangedPayload {
  orderId: string;
  orderNumber: string;
  previousStatus: string;
  newStatus: string;
  note?: string;
  businessId: string;
  storeId?: string;
  customerId?: string;
  timestamp: string;
}

export interface DeliveryLocationUpdatedPayload {
  orderId: string;
  partnerId: string;
  partnerName: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  etaMinutes?: number;
  distanceKm?: number;
  businessId: string;
  timestamp: string;
}

export interface PartnerAssignedPayload {
  orderId: string;
  orderNumber: string;
  partnerId: string;
  partnerName: string;
  partnerPhone: string;
  businessId: string;
  timestamp: string;
}

export interface TrackingEtaUpdatedPayload {
  orderId: string;
  etaMinutes: number;
  distanceKm: number;
  estimatedArrival: string;
  timestamp: string;
}

export interface NotificationNewPayload {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  userId: string;
  timestamp: string;
}

export interface PaymentPayload {
  orderId: string;
  paymentId: string;
  amount: number;
  status: string;
  method?: string;
  businessId: string;
  timestamp: string;
}
