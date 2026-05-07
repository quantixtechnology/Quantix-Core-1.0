// ============================================================================
// QUANTIX CORE PLATFORM — Realtime WebSocket Service v2.0
// Socket.io server on port 3003 for real-time event broadcasting
//
// EVENTS:
//   order:created           - New order placed
//   order:updated           - Order updated
//   order:status_changed    - Order status changed
//   delivery:assigned       - Delivery partner assigned
//   delivery:updated        - Delivery status changed
//   delivery:location_update- Delivery partner location update
//   notification:new        - New notification
//   notification:count_updated - Notification count changed
//   pos:session             - POS session opened/closed
//   payment:received        - Payment completed
//   payment:completed       - Payment fully completed
//   payment:failed          - Payment failed
// ============================================================================

import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = 3003;

// ============================================================================
// TYPES
// ============================================================================

interface ConnectionInfo {
  businessId: string;
  userId: string;
  role?: string;
  token?: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

const VALID_EVENTS = new Set([
  'order:created',
  'order:updated',
  'order:status_changed',
  'delivery:assigned',
  'delivery:updated',
  'delivery:location_update',
  'notification:new',
  'notification:count_updated',
  'pos:session',
  'payment:received',
  'payment:completed',
  'payment:failed',
]);

// ============================================================================
// ROOM TRACKING
// ============================================================================

const connectionMap = new Map<string, ConnectionInfo>();

/** Map of room -> Set of socket IDs */
const roomClients = new Map<string, Set<string>>();

function addToRoom(room: string, socketId: string) {
  if (!roomClients.has(room)) {
    roomClients.set(room, new Set());
  }
  roomClients.get(room)!.add(socketId);
}

function removeFromRoom(room: string, socketId: string) {
  const clients = roomClients.get(room);
  if (clients) {
    clients.delete(socketId);
    if (clients.size === 0) {
      roomClients.delete(room);
    }
  }
}

function getRoomStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const [room, clients] of roomClients.entries()) {
    if (clients.size > 0) {
      stats[room] = clients.size;
    }
  }
  return stats;
}

// ============================================================================
// HTTP + SOCKET.IO SERVER
// ============================================================================

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['*'],
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

io.use((socket, next) => {
  const { businessId, userId, role, token } = socket.handshake.query as {
    businessId?: string;
    userId?: string;
    role?: string;
    token?: string;
  };

  if (!businessId || !userId) {
    console.warn(
      `[WS] Connection rejected — missing businessId or userId. Socket: ${socket.id}`
    );
    next(new Error('Authentication failed: businessId and userId are required'));
    return;
  }

  // Validate token if provided
  // In production, this would verify JWT or check against auth store
  // For now, we accept connections with token or without (for development)
  if (token) {
    // Token validation placeholder — in production, verify JWT here
    console.log(`[WS] Authenticated connection: user=${userId} business=${businessId}`);
  } else {
    console.log(`[WS] Unauthenticated connection (dev mode): user=${userId} business=${businessId}`);
  }

  next();
});

// ============================================================================
// CONNECTION HANDLING
// ============================================================================

io.on('connection', (socket) => {
  const { businessId, userId, role, token } = socket.handshake.query as {
    businessId?: string;
    userId?: string;
    role?: string;
    token?: string;
  };

  if (!businessId || !userId) {
    socket.disconnect(true);
    return;
  }

  // Store connection info
  const connInfo: ConnectionInfo = {
    businessId,
    userId,
    role: role || undefined,
    token: token || undefined,
    connectedAt: new Date(),
    lastHeartbeat: new Date(),
  };
  connectionMap.set(socket.id, connInfo);

  // Join rooms
  const businessRoom = `business:${businessId}`;
  const userRoom = `user:${userId}`;

  socket.join(businessRoom);
  addToRoom(businessRoom, socket.id);

  socket.join(userRoom);
  addToRoom(userRoom, socket.id);

  if (role) {
    const roleRoom = `role:${role}`;
    socket.join(roleRoom);
    addToRoom(roleRoom, socket.id);
  }

  console.log(
    `[WS] Connected: socket=${socket.id} user=${userId} business=${businessId} role=${role || 'none'} — Total: ${connectionMap.size}`
  );

  // ---------------------------------------------------------------------------
  // HEARTBEAT / PING-PONG
  // ---------------------------------------------------------------------------
  socket.on('heartbeat', () => {
    const info = connectionMap.get(socket.id);
    if (info) {
      info.lastHeartbeat = new Date();
    }
    socket.emit('heartbeat:ack', { timestamp: Date.now() });
  });

  // Legacy ping support
  socket.on('ping', (cb) => {
    if (typeof cb === 'function') cb('pong');
  });

  // ---------------------------------------------------------------------------
  // DELIVERY LOCATION UPDATES
  // ---------------------------------------------------------------------------
  socket.on('delivery:location_update', (data: { orderId: string; lat: number; lng: number; heading?: number }) => {
    const info = connectionMap.get(socket.id);
    if (info) {
      const payload = {
        ...data,
        deliveryPartnerId: info.userId,
        timestamp: new Date().toISOString(),
      };
      // Broadcast to business room
      io.to(`business:${info.businessId}`).emit('delivery:location_update', payload);
    }
  });

  // ---------------------------------------------------------------------------
  // DISCONNECT
  // ---------------------------------------------------------------------------
  socket.on('disconnect', (reason) => {
    const info = connectionMap.get(socket.id);
    if (info) {
      removeFromRoom(`business:${info.businessId}`, socket.id);
      removeFromRoom(`user:${info.userId}`, socket.id);
      if (info.role) {
        removeFromRoom(`role:${info.role}`, socket.id);
      }
    }
    connectionMap.delete(socket.id);
    console.log(
      `[WS] Disconnected: socket=${socket.id} user=${userId} reason=${reason} — Total: ${connectionMap.size}`
    );
  });
});

// ============================================================================
// REST ENDPOINT: POST /emit
// Internal use — allows Next.js API routes to broadcast events
// Body: { room: string, event: string, data: any, targetAll?: boolean, businessId?: string, userId?: string, role?: string }
// ============================================================================

function handleEmit(body: {
  room?: string;
  event?: string;
  data?: unknown;
  targetAll?: boolean;
  businessId?: string;
  userId?: string;
  role?: string;
}): { success: boolean; error?: string; event?: string } {
  if (!body.event) {
    return { success: false, error: 'event is required' };
  }

  if (!VALID_EVENTS.has(body.event)) {
    console.warn(`[WS] Unknown event type: ${body.event} — allowing anyway`);
  }

  // Determine target rooms
  if (body.room) {
    io.to(body.room).emit(body.event, body.data);
  } else if (body.targetAll) {
    io.emit(body.event, body.data);
  } else {
    const rooms: string[] = [];
    if (body.businessId) rooms.push(`business:${body.businessId}`);
    if (body.userId) rooms.push(`user:${body.userId}`);
    if (body.role) rooms.push(`role:${body.role}`);

    if (rooms.length > 0) {
      io.to(rooms).emit(body.event, body.data);
    } else {
      return { success: false, error: 'No target specified. Provide room, businessId, userId, role, or targetAll.' };
    }
  }

  console.log(
    `[WS] Emitted: event=${body.event} room=${body.room || 'auto'} targetAll=${body.targetAll || false}`
  );

  return { success: true, event: body.event };
}

// ============================================================================
// REST ENDPOINT: POST /broadcast
// Higher-level broadcast with event + room + businessId
// Body: { event: string, room?: string, data: any, businessId?: string }
// ============================================================================

function handleBroadcast(body: {
  event?: string;
  room?: string;
  data?: unknown;
  businessId?: string;
}): { success: boolean; error?: string; event?: string; targetRoom?: string } {
  if (!body.event) {
    return { success: false, error: 'event is required' };
  }

  if (!VALID_EVENTS.has(body.event)) {
    console.warn(`[WS] Unknown event type in broadcast: ${body.event} — allowing anyway`);
  }

  let targetRoom: string;

  if (body.room) {
    targetRoom = body.room;
    io.to(body.room).emit(body.event, body.data);
  } else if (body.businessId) {
    targetRoom = `business:${body.businessId}`;
    io.to(targetRoom).emit(body.event, body.data);
  } else {
    targetRoom = 'all';
    io.emit(body.event, body.data);
  }

  console.log(
    `[WS] Broadcast: event=${body.event} room=${targetRoom}`
  );

  return { success: true, event: body.event, targetRoom };
}

// ============================================================================
// REQUEST ROUTING
// ============================================================================

function sendJson(res: import('http').ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req: import('http').IncomingMessage): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

httpServer.on('request', async (req, res) => {
  const url = req.url?.split('?')[0] || '/';
  const method = req.method || 'GET';

  // POST /emit
  if (url === '/emit' && method === 'POST') {
    try {
      const bodyText = await readBody(req);
      const body = JSON.parse(bodyText);
      const result = handleEmit(body);
      sendJson(res, result.success ? 200 : 400, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      sendJson(res, 500, { success: false, error: message });
    }
  }
  // POST /broadcast
  else if (url === '/broadcast' && method === 'POST') {
    try {
      const bodyText = await readBody(req);
      const body = JSON.parse(bodyText);
      const result = handleBroadcast(body);
      sendJson(res, result.success ? 200 : 400, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      sendJson(res, 500, { success: false, error: message });
    }
  }
  // GET /stats
  else if (url === '/stats' && method === 'GET') {
    const rooms = getRoomStats();
    sendJson(res, 200, {
      totalConnections: connectionMap.size,
      rooms,
      roomCount: Object.keys(rooms).length,
      uptime: process.uptime(),
    });
  }
  // GET /health
  else if (url === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      connections: connectionMap.size,
      uptime: process.uptime(),
    });
  }
  // All other paths are handled by socket.io automatically
});

// ============================================================================
// HEARTBEAT MONITOR — cleanup stale connections
// ============================================================================

setInterval(() => {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes

  for (const [socketId, info] of connectionMap.entries()) {
    const lastHeartbeat = info.lastHeartbeat.getTime();
    if (now - lastHeartbeat > staleThreshold) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        console.warn(`[WS] Disconnecting stale connection: socket=${socketId} user=${info.userId}`);
        socket.disconnect(true);
      }
    }
  }
}, 60 * 1000); // Check every minute

// ============================================================================
// PROCESS ERROR HANDLERS
// ============================================================================

process.on('uncaughtException', (err) => {
  console.error('[WS] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[WS] Unhandled Rejection:', reason);
});

// ============================================================================
// START
// ============================================================================

httpServer.listen(PORT, () => {
  console.log(`[WS] Quantix Realtime Service v2.0 running on port ${PORT}`);
  console.log(`[WS] Socket.IO endpoint: ws://localhost:${PORT}`);
  console.log(`[WS] REST emit endpoint: http://localhost:${PORT}/emit`);
  console.log(`[WS] REST broadcast endpoint: http://localhost:${PORT}/broadcast`);
  console.log(`[WS] Stats endpoint: http://localhost:${PORT}/stats`);
  console.log(`[WS] Health check: http://localhost:${PORT}/health`);
});
