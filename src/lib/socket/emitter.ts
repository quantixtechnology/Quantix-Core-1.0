// ============================================================================
// QUANTIX — Unified WebSocket Emitter
// Redis-ready: emits to realtime service on port 3003.
// Falls back gracefully — never blocks an API response.
//
// Usage:
//   import { emit } from '@/lib/socket/emitter'
//   import { SOCKET_EVENTS, orderRoom, userRoom } from '@/lib/socket/events'
//
//   await emit(SOCKET_EVENTS.ORDER_STATUS_CHANGED, payload, {
//     rooms: [businessRoom(biz), orderRoom(id), userRoom(customerId)],
//   })
// ============================================================================

import {
  SOCKET_EVENTS,
  SocketEventName,
  businessRoom,
  orderRoom,
  userRoom,
  partnerRoom,
  storeRoom,
  type OrderCreatedPayload,
  type OrderStatusChangedPayload,
  type DeliveryLocationUpdatedPayload,
  type PartnerAssignedPayload,
  type TrackingEtaUpdatedPayload,
  type NotificationNewPayload,
  type PaymentPayload,
} from './events';

const REALTIME_PORT = process.env.REALTIME_SERVICE_PORT || '3003';
const REALTIME_BASE = `http://localhost:${REALTIME_PORT}`;

interface EmitOptions {
  /** Explicit rooms to target. If omitted, businessId is required. */
  rooms?: string[];
  /** Emit to businessId room (convenience shorthand) */
  businessId?: string;
  /** Also emit to a userId room */
  userId?: string;
}

async function post(path: string, body: unknown): Promise<void> {
  try {
    const res = await fetch(`${REALTIME_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      console.warn(`[Socket] ${path} → ${res.status}: ${err.error || 'emit failed'}`);
    }
  } catch (e) {
    // Fire-and-forget — never block the main API response
    console.warn(`[Socket] emit failed (realtime service unreachable):`, e instanceof Error ? e.message : e);
  }
}

/**
 * Generic emit: targets one or more rooms.
 * Redis-ready: the realtime service handles fan-out.
 */
export async function emit(
  event: SocketEventName,
  data: Record<string, unknown>,
  opts: EmitOptions = {},
): Promise<void> {
  const payload = { ...data, timestamp: data.timestamp || new Date().toISOString() };

  if (opts.rooms && opts.rooms.length > 0) {
    await Promise.allSettled(
      opts.rooms.map((room) => post('/api/emit', { event, room, data: payload })),
    );
    return;
  }

  // Fallback: businessId-scoped
  if (opts.businessId) {
    await post('/api/emit', { event, businessId: opts.businessId, data: payload });
  }

  if (opts.userId) {
    await post('/api/emit', { event, userId: opts.userId, data: payload });
  }
}

// ── Typed helpers ─────────────────────────────────────────────────────────────

export async function emitOrderCreated(p: OrderCreatedPayload) {
  await emit(SOCKET_EVENTS.ORDER_CREATED, p as unknown as Record<string, unknown>, {
    rooms: [businessRoom(p.businessId), storeRoom(p.businessId, p.storeId)],
  });
}

export async function emitOrderStatusChanged(p: OrderStatusChangedPayload) {
  const rooms = [businessRoom(p.businessId)];
  if (p.storeId) rooms.push(storeRoom(p.businessId, p.storeId));
  rooms.push(orderRoom(p.orderId));
  if (p.customerId) rooms.push(userRoom(p.customerId));
  await emit(SOCKET_EVENTS.ORDER_STATUS_CHANGED, p as unknown as Record<string, unknown>, { rooms });
}

export async function emitDeliveryLocationUpdated(p: DeliveryLocationUpdatedPayload) {
  await emit(SOCKET_EVENTS.DELIVERY_LOCATION_UPDATED, p as unknown as Record<string, unknown>, {
    rooms: [orderRoom(p.orderId), businessRoom(p.businessId), partnerRoom(p.partnerId)],
  });
}

export async function emitPartnerAssigned(p: PartnerAssignedPayload) {
  await emit(SOCKET_EVENTS.PARTNER_ASSIGNED, p as unknown as Record<string, unknown>, {
    rooms: [orderRoom(p.orderId), businessRoom(p.businessId)],
  });
}

export async function emitTrackingEtaUpdated(p: TrackingEtaUpdatedPayload) {
  await emit(SOCKET_EVENTS.TRACKING_ETA_UPDATED, p as unknown as Record<string, unknown>, {
    rooms: [orderRoom(p.orderId)],
  });
}

export async function emitNotificationNew(p: NotificationNewPayload) {
  await emit(SOCKET_EVENTS.NOTIFICATION_NEW, p as unknown as Record<string, unknown>, {
    userId: p.userId,
  });
}

export async function emitPaymentEvent(event: typeof SOCKET_EVENTS.PAYMENT_RECEIVED | typeof SOCKET_EVENTS.PAYMENT_FAILED | typeof SOCKET_EVENTS.PAYMENT_REFUNDED, p: PaymentPayload) {
  await emit(event, p as unknown as Record<string, unknown>, {
    rooms: [businessRoom(p.businessId), orderRoom(p.orderId)],
  });
}

// Re-export event names and room helpers for convenience
export { SOCKET_EVENTS, businessRoom, orderRoom, userRoom, partnerRoom, storeRoom };
