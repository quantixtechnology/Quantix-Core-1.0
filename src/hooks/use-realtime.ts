"use client";

// ============================================================================
// Quantix Technology — WebSocket Real-time Hook v2.0
// Phase 5: Frontend Infrastructure
// Uses socket.io-client to connect via gateway routing
// URL: /?XTransformPort=3003
//
// Features:
//   - Auto-connect using auth token from localStorage
//   - Auto-join business/user rooms
//   - Typed event handlers for all events
//   - Auto-invalidate React Query cache
//   - Connection status tracking (connected, disconnected, reconnecting)
//   - Event-specific callbacks
//   - Reconnection with exponential backoff
// ============================================================================

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./use-api";

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

export type RealtimeEvent =
  | "order:created"
  | "order:updated"
  | "order:status_changed"
  | "order:cancelled"
  | "delivery:assigned"
  | "delivery:updated"
  | "delivery:status_changed"
  | "delivery:otp_verified"
  | "delivery:location_update"
  | "payment:received"
  | "payment:completed"
  | "payment:failed"
  | "notification:new"
  | "notification:count_updated"
  | "pos:session"
  | "lead:updated"
  | "lead:stage_changed"
  | "business:updated"
  | "product:updated"
  | "product:stock_changed";

interface RealtimePayload {
  event: RealtimeEvent;
  data: Record<string, unknown>;
  timestamp: string;
  businessId?: string;
  userId?: string;
}

// Typed event data interfaces
export interface OrderUpdate {
  orderId: string;
  orderNumber?: string;
  status?: string;
  oldStatus?: string;
  newStatus?: string;
  changedBy?: string;
  businessId?: string;
  customerId?: string;
  totalAmount?: number;
  [key: string]: unknown;
}

export interface DeliveryUpdate {
  deliveryId?: string;
  orderId: string;
  orderNumber?: string;
  status?: string;
  partnerId?: string;
  partnerName?: string;
  partnerPhone?: string;
  lat?: number;
  lng?: number;
  heading?: number;
  estimatedDeliveryTime?: string;
  [key: string]: unknown;
}

export interface PaymentUpdate {
  paymentId?: string;
  orderId: string;
  orderNumber?: string;
  amount?: number;
  currency?: string;
  method?: string;
  status?: string;
  [key: string]: unknown;
}

export interface NotificationUpdate {
  notificationId?: string;
  type?: string;
  title?: string;
  message?: string;
  userId?: string;
  unreadCount?: number;
  [key: string]: unknown;
}

interface UseRealtimeOptions {
  /** Business ID to join business room */
  businessId?: string;
  /** User ID to join personal room */
  userId?: string;
  /** Whether to auto-connect (default: true) */
  autoConnect?: boolean;
  /** Whether to auto-update React Query cache (default: true) */
  autoInvalidate?: boolean;
}

interface UseRealtimeReturn {
  /** Whether the socket is connected */
  isConnected: boolean;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** The last event received */
  lastEvent: RealtimePayload | null;
  /** Register an event callback */
  on: (event: string, callback: (data: unknown) => void) => void;
  /** Unregister an event callback */
  off: (event: string, callback: (data: unknown) => void) => void;
  /** Emit an event to the server */
  emit: (event: string, data: unknown) => void;
  /** Subscribe to a specific event channel (returns unsubscribe function) */
  subscribe: (channel: RealtimeEvent, callback: (payload: RealtimePayload) => void) => () => void;
  /** Manually reconnect */
  reconnect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
}

// ============================================================================
// SOCKET.IO LAZY LOADER
// ============================================================================

let socketIoModule: typeof import("socket.io-client") | null = null;

async function getSocketIo() {
  if (!socketIoModule) {
    socketIoModule = await import("socket.io-client");
  }
  return socketIoModule;
}

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

const AUTH_TOKEN_KEY = "quantix_auth_token";
const BUSINESS_ID_KEY = "quantix_business_id";

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getStoredBusinessId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BUSINESS_ID_KEY);
}

// ============================================================================
// SINGLETON SOCKET MANAGER
// ============================================================================

class SocketManager {
  private static instance: SocketManager | null = null;
  private socket: ReturnType<typeof import("socket.io-client").io> | null = null;
  private listeners: Map<string, Set<(payload: RealtimePayload) => void>> = new Map();
  private eventCallbacks: Map<string, Set<(data: unknown) => void>> = new Map();
  private connectionListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private lastEvent: RealtimePayload | null = null;
  private lastEventListeners: Set<(event: RealtimePayload | null) => void> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connectionStatus: ConnectionStatus = "disconnected";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private currentBusinessId: string | null = null;
  private currentUserId: string | null = null;

  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  get connectionStatus() {
    return this._connectionStatus;
  }

  get connected() {
    return this._connectionStatus === "connected";
  }

  getLastEvent() {
    return this.lastEvent;
  }

  onConnectionChange(callback: (status: ConnectionStatus) => void) {
    this.connectionListeners.add(callback);
    // Immediately fire with current value
    callback(this._connectionStatus);
    return () => this.connectionListeners.delete(callback);
  }

  onLastEventChange(callback: (event: RealtimePayload | null) => void) {
    this.lastEventListeners.add(callback);
    // Immediately fire with current value
    callback(this.lastEvent);
    return () => this.lastEventListeners.delete(callback);
  }

  /**
   * Register a callback for a specific event type
   */
  onEvent(event: string, callback: (data: unknown) => void) {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, new Set());
    }
    this.eventCallbacks.get(event)!.add(callback);
    return () => this.eventCallbacks.get(event)?.delete(callback);
  }

  /**
   * Unregister a callback for a specific event type
   */
  offEvent(event: string, callback: (data: unknown) => void) {
    this.eventCallbacks.get(event)?.delete(callback);
  }

  /**
   * Emit an event to the server
   */
  emitEvent(event: string, data: unknown) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  private setConnectionStatus(status: ConnectionStatus) {
    this._connectionStatus = status;
    this.connectionListeners.forEach((cb) => cb(status));
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit("heartbeat");
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async connect(businessId?: string, userId?: string) {
    // Store current IDs for reconnection
    if (businessId) this.currentBusinessId = businessId;
    if (userId) this.currentUserId = userId;

    // Use stored values if not provided
    const bid = this.currentBusinessId || getStoredBusinessId();
    const uid = this.currentUserId;

    // Get auth token
    const token = getAuthToken();

    // Disconnect existing
    this.disconnectInternal();

    try {
      const { io } = await getSocketIo();

      this.socket = io("/", {
        path: "/?XTransformPort=3003",
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        timeout: 10000,
        query: {
          businessId: bid || "",
          userId: uid || "",
          role: "",
          token: token || "",
        },
        auth: {
          businessId: bid,
          userId: uid,
          token,
        },
      });

      this.socket.on("connect", () => {
        this.setConnectionStatus("connected");
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      });

      this.socket.on("disconnect", (reason) => {
        this.stopHeartbeat();

        if (reason === "io server disconnect") {
          this.setConnectionStatus("disconnected");
          // Server explicitly disconnected — try manual reconnect
          this.scheduleReconnect();
        } else {
          this.setConnectionStatus("reconnecting");
          // socket.io will auto-reconnect
        }
      });

      this.socket.on("connect_error", () => {
        this.setConnectionStatus("reconnecting");
      });

      // Socket.io reconnection events
      this.socket.on("reconnect_attempt", () => {
        this.setConnectionStatus("reconnecting");
      });

      this.socket.on("reconnect_failed", () => {
        this.setConnectionStatus("disconnected");
        // Schedule manual reconnect with exponential backoff
        this.scheduleReconnect();
      });

      this.socket.on("reconnect", () => {
        this.setConnectionStatus("connected");
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      });

      // Listen for all event types
      const eventTypes: RealtimeEvent[] = [
        "order:created",
        "order:updated",
        "order:status_changed",
        "order:cancelled",
        "delivery:assigned",
        "delivery:updated",
        "delivery:status_changed",
        "delivery:otp_verified",
        "delivery:location_update",
        "payment:received",
        "payment:completed",
        "payment:failed",
        "notification:new",
        "notification:count_updated",
        "pos:session",
        "lead:updated",
        "lead:stage_changed",
        "business:updated",
        "product:updated",
        "product:stock_changed",
      ];

      eventTypes.forEach((eventType) => {
        this.socket?.on(eventType, (payload: RealtimePayload) => {
          this.handleEvent(eventType, payload);
        });
      });

      // Handle heartbeat ack
      this.socket.on("heartbeat:ack", () => {
        // Heartbeat acknowledged — connection is alive
      });
    } catch (error) {
      console.error("[SocketManager] Failed to connect:", error);
      this.setConnectionStatus("disconnected");
    }
  }

  private disconnectInternal() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
  }

  disconnect() {
    this.disconnectInternal();
    this.setConnectionStatus("disconnected");
  }

  subscribe(channel: RealtimeEvent, callback: (payload: RealtimePayload) => void) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(callback);

    return () => {
      this.listeners.get(channel)?.delete(callback);
    };
  }

  private handleEvent(eventType: RealtimeEvent, payload: RealtimePayload) {
    // Update last event
    this.lastEvent = { ...payload, event: eventType };
    this.lastEventListeners.forEach((cb) => cb(this.lastEvent));

    // Notify channel subscribers
    this.listeners.get(eventType)?.forEach((cb) => cb(payload));

    // Also notify wildcard subscribers
    this.listeners.get("*" as RealtimeEvent)?.forEach((cb) => cb(payload));

    // Notify event-specific callbacks
    const data = payload.data || payload;
    this.eventCallbacks.get(eventType)?.forEach((cb) => cb(data));
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[SocketManager] Max reconnect attempts reached");
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s, 30s...
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.setConnectionStatus("reconnecting");

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.currentBusinessId || undefined, this.currentUserId || undefined);
    }, delay);
  }
}

// ============================================================================
// REACT QUERY CACHE INVALIDATION
// ============================================================================

function useCacheInvalidation() {
  const queryClient = useQueryClient();

  const invalidateCache = useCallback(
    (event: RealtimeEvent, payload: RealtimePayload) => {
      switch (event) {
        case "order:created":
        case "order:updated":
        case "order:status_changed":
        case "order:cancelled":
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
          if (payload.data?.orderId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.orders.detail(String(payload.data.orderId)),
            });
          }
          // Also invalidate business dashboard if order count changed
          if (payload.data?.businessId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.businesses.stats(String(payload.data.businessId)),
            });
          }
          break;

        case "delivery:assigned":
        case "delivery:updated":
        case "delivery:status_changed":
        case "delivery:otp_verified":
        case "delivery:location_update":
          queryClient.invalidateQueries({ queryKey: queryKeys.delivery.orders() });
          if (payload.data?.orderId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.orders.detail(String(payload.data.orderId)),
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.orders.track(String(payload.data.orderId)),
            });
          }
          break;

        case "payment:received":
        case "payment:completed":
        case "payment:failed":
          if (payload.data?.orderId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.orders.detail(String(payload.data.orderId)),
            });
          }
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
          if (payload.data?.businessId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.businesses.stats(String(payload.data.businessId)),
            });
          }
          break;

        case "notification:new":
        case "notification:count_updated":
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
          break;

        case "pos:session":
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
          break;

        case "lead:updated":
        case "lead:stage_changed":
          queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
          if (payload.data?.leadId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.leads.detail(String(payload.data.leadId)),
            });
          }
          break;

        case "business:updated":
          queryClient.invalidateQueries({ queryKey: queryKeys.businesses.lists() });
          if (payload.data?.businessId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.businesses.detail(String(payload.data.businessId)),
            });
          }
          break;

        case "product:updated":
        case "product:stock_changed":
          queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
          if (payload.data?.productId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.products.detail(String(payload.data.productId)),
            });
          }
          break;
      }
    },
    [queryClient]
  );

  return invalidateCache;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const { businessId, userId, autoConnect = true, autoInvalidate = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [lastEvent, setLastEvent] = useState<RealtimePayload | null>(null);
  const manager = useRef(SocketManager.getInstance());
  const invalidateCache = useCacheInvalidation();

  // Subscribe to connection state
  useEffect(() => {
    const unsubscribe = manager.current.onConnectionChange((status) => {
      setIsConnected(status === "connected");
      setConnectionStatus(status);
    });
    return unsubscribe;
  }, []);

  // Subscribe to last event
  useEffect(() => {
    const unsubscribe = manager.current.onLastEventChange(setLastEvent);
    return unsubscribe;
  }, []);

  // Auto-connect on mount with auth token and business context
  useEffect(() => {
    if (autoConnect) {
      // Read business context from localStorage if not provided
      const effectiveBusinessId = businessId || getStoredBusinessId() || undefined;
      manager.current.connect(effectiveBusinessId, userId);
    }

    return () => {
      // Don't disconnect on unmount — let the singleton persist
      // Individual component subscriptions are cleaned up via the unsubscribe functions
    };
  }, [autoConnect, businessId, userId]);

  // Auto-invalidate React Query cache
  useEffect(() => {
    if (!autoInvalidate) return;

    const unsubscribe = manager.current.subscribe(
      "*" as RealtimeEvent,
      (payload) => {
        invalidateCache(payload.event, payload);
      }
    );

    return unsubscribe;
  }, [autoInvalidate, invalidateCache]);

  // on — register event callback
  const on = useCallback((event: string, callback: (data: unknown) => void) => {
    manager.current.onEvent(event, callback);
  }, []);

  // off — unregister event callback
  const off = useCallback((event: string, callback: (data: unknown) => void) => {
    manager.current.offEvent(event, callback);
  }, []);

  // emit — send event to server
  const emit = useCallback((event: string, data: unknown) => {
    manager.current.emitEvent(event, data);
  }, []);

  // Subscribe function
  const subscribe = useCallback(
    (channel: RealtimeEvent, callback: (payload: RealtimePayload) => void) => {
      return manager.current.subscribe(channel, callback);
    },
    []
  );

  // Reconnect function
  const reconnect = useCallback(() => {
    const effectiveBusinessId = businessId || getStoredBusinessId() || undefined;
    manager.current.connect(effectiveBusinessId, userId);
  }, [businessId, userId]);

  // Disconnect function
  const disconnect = useCallback(() => {
    manager.current.disconnect();
  }, []);

  return useMemo(
    () => ({
      isConnected,
      connectionStatus,
      lastEvent,
      on,
      off,
      emit,
      subscribe,
      reconnect,
      disconnect,
    }),
    [isConnected, connectionStatus, lastEvent, on, off, emit, subscribe, reconnect, disconnect]
  );
}

// ============================================================================
// SPECIALIZED HOOKS
// ============================================================================

/**
 * Hook for tracking order updates for a specific business
 */
export function useOrderUpdates(businessId: string): {
  latestOrder: OrderUpdate | null;
  orderCount: number;
} {
  const [latestOrder, setLatestOrder] = useState<OrderUpdate | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const manager = useRef(SocketManager.getInstance());

  useEffect(() => {
    const handleOrderEvent = (payload: RealtimePayload) => {
      const data = (payload.data || {}) as OrderUpdate;
      if (data.businessId === businessId || !data.businessId) {
        setLatestOrder(data);
        setOrderCount((prev) => prev + 1);
      }
    };

    const unsubCreated = manager.current.subscribe("order:created", handleOrderEvent);
    const unsubUpdated = manager.current.subscribe("order:updated", handleOrderEvent);
    const unsubStatusChanged = manager.current.subscribe("order:status_changed", handleOrderEvent);

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubStatusChanged();
    };
  }, [businessId]);

  return { latestOrder, orderCount };
}

/**
 * Hook for tracking delivery updates, optionally filtered by orderId
 */
export function useDeliveryUpdates(orderId?: string): {
  latestUpdate: DeliveryUpdate | null;
  partnerLocation: { lat: number; lng: number } | null;
} {
  const [latestUpdate, setLatestUpdate] = useState<DeliveryUpdate | null>(null);
  const [partnerLocation, setPartnerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const manager = useRef(SocketManager.getInstance());

  useEffect(() => {
    const handleDeliveryEvent = (payload: RealtimePayload) => {
      const data = (payload.data || {}) as DeliveryUpdate;

      // Filter by orderId if specified
      if (orderId && data.orderId !== orderId) return;

      setLatestUpdate(data);

      // Update partner location if present
      if (data.lat !== undefined && data.lng !== undefined) {
        setPartnerLocation({ lat: data.lat, lng: data.lng });
      }
    };

    const handleLocationUpdate = (payload: RealtimePayload) => {
      const data = (payload.data || {}) as DeliveryUpdate;

      // Filter by orderId if specified
      if (orderId && data.orderId !== orderId) return;

      if (data.lat !== undefined && data.lng !== undefined) {
        setPartnerLocation({ lat: data.lat, lng: data.lng });
      }
    };

    const unsubAssigned = manager.current.subscribe("delivery:assigned", handleDeliveryEvent);
    const unsubUpdated = manager.current.subscribe("delivery:updated", handleDeliveryEvent);
    const unsubStatusChanged = manager.current.subscribe("delivery:status_changed", handleDeliveryEvent);
    const unsubLocation = manager.current.subscribe("delivery:location_update", handleLocationUpdate);

    return () => {
      unsubAssigned();
      unsubUpdated();
      unsubStatusChanged();
      unsubLocation();
    };
  }, [orderId]);

  return { latestUpdate, partnerLocation };
}

/**
 * Hook for tracking notification updates for a specific user
 */
export function useNotificationUpdates(userId: string): {
  unreadCount: number;
  latestNotification: NotificationUpdate | null;
} {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState<NotificationUpdate | null>(null);
  const manager = useRef(SocketManager.getInstance());

  useEffect(() => {
    const handleNewNotification = (payload: RealtimePayload) => {
      const data = (payload.data || {}) as NotificationUpdate;

      // Filter by userId if present in the notification
      if (data.userId && data.userId !== userId) return;

      setLatestNotification(data);
      setUnreadCount((prev) => prev + 1);
    };

    const handleCountUpdated = (payload: RealtimePayload) => {
      const data = (payload.data || {}) as NotificationUpdate;

      if (data.userId && data.userId !== userId) return;

      if (typeof data.unreadCount === "number") {
        setUnreadCount(data.unreadCount);
      }
    };

    const unsubNew = manager.current.subscribe("notification:new", handleNewNotification);
    const unsubCount = manager.current.subscribe("notification:count_updated", handleCountUpdated);

    return () => {
      unsubNew();
      unsubCount();
    };
  }, [userId]);

  return { unreadCount, latestNotification };
}
