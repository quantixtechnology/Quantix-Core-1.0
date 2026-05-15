// ============================================================================
// QUANTIX CORE — Real-time Event Emitter Utility
// Server-side utility for API routes to emit WebSocket events
// via the realtime service (port 3003)
//
// Uses internal fetch with XTransformPort=3003 (gateway rule)
// ============================================================================

const REALTIME_SERVICE_PORT = 3003;

/**
 * Internal fetch wrapper for the realtime service
 * Uses relative path with XTransformPort query parameter (gateway rule)
 */
async function emitToRealtimeService(payload: {
  event: string;
  room?: string;
  data: Record<string, unknown>;
  businessId?: string;
  userId?: string;
  role?: string;
  targetAll?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = process.env.NODE_ENV === 'production'
      ? `http://localhost:${REALTIME_SERVICE_PORT}`
      : `http://localhost:${REALTIME_SERVICE_PORT}`;
    const response = await fetch(`${baseUrl}/api/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`[RealtimeEmitter] Failed to emit ${payload.event}:`, result);
      return { success: false, error: (result as { error?: string }).error || 'Emit failed' };
    }

    return { success: true };
  } catch (error) {
    // Don't throw — realtime events should be fire-and-forget
    // Log the error but don't block the API response
    console.error(`[RealtimeEmitter] Error emitting ${payload.event}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================================================
// ORDER EVENTS
// ============================================================================

/**
 * Emit an order-related event to a business room.
 * Events: order:created, order:updated, order:status_changed, order:cancelled
 */
export async function emitOrderEvent(
  businessId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  await emitToRealtimeService({
    event,
    businessId,
    data: {
      ...data,
      businessId,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Emit an order event scoped to BOTH the business room and the specific store room.
 * Store room pattern: business:{businessId}:store:{storeId}
 *
 * Use this for all order lifecycle events so STORE_MANAGER clients only receive
 * events for their assigned store, while CLIENT_OWNER clients (subscribed to
 * the business room) still receive everything.
 */
export async function emitStoreOrderEvent(
  businessId: string,
  storeId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const payload = {
    ...data,
    businessId,
    storeId,
    timestamp: new Date().toISOString(),
  };

  // Emit to business-level room (CLIENT_OWNER, platform admins)
  await emitToRealtimeService({ event, businessId, data: payload });

  // Emit to store-scoped room (STORE_MANAGER, DELIVERY_STAFF for that store)
  if (storeId) {
    await emitToRealtimeService({
      event,
      room: `business:${businessId}:store:${storeId}`,
      data: payload,
    });
  }
}

// ============================================================================
// DELIVERY EVENTS
// ============================================================================

/**
 * Emit a delivery-related event to business room and optionally user room
 * Events: delivery:assigned, delivery:updated, delivery:location_update
 */
export async function emitDeliveryEvent(
  businessId: string,
  orderId: string,
  data: Record<string, unknown>
): Promise<void> {
  const payload = {
    ...data,
    orderId,
    businessId,
    timestamp: new Date().toISOString(),
  };

  // Emit to business room
  await emitToRealtimeService({
    event: data.event as string || 'delivery:updated',
    businessId,
    data: payload,
  });

  // If a userId is specified (e.g., customer to notify), also emit to user room
  if (data.userId && typeof data.userId === 'string') {
    await emitToRealtimeService({
      event: data.event as string || 'delivery:updated',
      userId: data.userId,
      data: payload,
    });
  }
}

// ============================================================================
// PAYMENT EVENTS
// ============================================================================

/**
 * Emit a payment-related event to business room
 * Events: payment:received, payment:completed, payment:failed
 */
export async function emitPaymentEvent(
  businessId: string,
  orderId: string,
  data: Record<string, unknown>
): Promise<void> {
  await emitToRealtimeService({
    event: data.event as string || 'payment:received',
    businessId,
    data: {
      ...data,
      orderId,
      businessId,
      timestamp: new Date().toISOString(),
    },
  });
}

// ============================================================================
// NOTIFICATION EVENTS
// ============================================================================

/**
 * Emit a notification event to a user room
 * Events: notification:new, notification:count_updated
 */
export async function emitNotificationEvent(
  userId: string,
  data: Record<string, unknown>
): Promise<void> {
  await emitToRealtimeService({
    event: data.event as string || 'notification:new',
    userId,
    data: {
      ...data,
      userId,
      timestamp: new Date().toISOString(),
    },
  });
}

// ============================================================================
// POS EVENTS
// ============================================================================

/**
 * Emit a POS session event to business room
 * Events: pos:session
 */
export async function emitPOSEvent(
  businessId: string,
  storeId: string,
  data: Record<string, unknown>
): Promise<void> {
  await emitToRealtimeService({
    event: 'pos:session',
    businessId,
    data: {
      ...data,
      businessId,
      storeId,
      timestamp: new Date().toISOString(),
    },
  });
}

// ============================================================================
// BROADCAST HELPER
// ============================================================================

/**
 * Broadcast an event using the /broadcast endpoint
 * Higher-level API that auto-determines target room from businessId
 */
export async function broadcastEvent(
  event: string,
  data: Record<string, unknown>,
  businessId?: string,
  room?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = process.env.NODE_ENV === 'production'
      ? `http://localhost:${REALTIME_SERVICE_PORT}`
      : `http://localhost:${REALTIME_SERVICE_PORT}`;
    const response = await fetch(`${baseUrl}/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        room,
        businessId,
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`[RealtimeEmitter] Broadcast failed for ${event}:`, result);
      return { success: false, error: (result as { error?: string }).error || 'Broadcast failed' };
    }

    return { success: true };
  } catch (error) {
    console.error(`[RealtimeEmitter] Broadcast error for ${event}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
