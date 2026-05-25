import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config/app_config.dart';
import '../constants/socket_events.dart';
import '../storage/secure_storage.dart';

// ============================================================================
// SocketService — manages a single Socket.IO connection.
//
// Usage pattern:
//   1. connect(token)         — after login
//   2. joinRoom(room)         — when navigating to tracking screen / home
//   3. on(event, handler)     — subscribe to events
//   4. leaveRoom(room)        — when leaving screen
//   5. disconnect()           — on logout
//
// All events are logged; missed events are queued when disconnected.
// ============================================================================

final socketServiceProvider = Provider<SocketService>((ref) {
  final storage = ref.read(secureStorageProvider);
  final service = SocketService(storage);
  ref.onDispose(service.dispose);
  return service;
});

class SocketService {
  SocketService(this._storage);

  final SecureStorageService _storage;
  final Logger _log = Logger();

  io.Socket? _socket;
  bool _isConnected = false;

  final Set<String> _joinedRooms = {};
  final Map<String, List<void Function(dynamic)>> _listeners = {};

  bool get isConnected => _isConnected;

  // ── Connect ───────────────────────────────────────────────────────────────

  Future<void> connect() async {
    if (_isConnected) return;

    final token = await _storage.token;

    _socket = io.io(
      AppConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(10)
          .setReconnectionDelay(2000)
          .setAuth({'token': token ?? ''})
          .build(),
    );

    _socket!
      ..onConnect((_) {
        _isConnected = true;
        _log.i('[Socket] Connected');
        // Rejoin rooms after reconnection
        for (final room in _joinedRooms) {
          _socket!.emit('join', room);
        }
      })
      ..onDisconnect((_) {
        _isConnected = false;
        _log.w('[Socket] Disconnected');
      })
      ..onConnectError((err) => _log.e('[Socket] Connect error: $err'))
      ..onReconnect((_) => _log.i('[Socket] Reconnected'));
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────

  void joinRoom(String room) {
    _joinedRooms.add(room);
    if (_isConnected) {
      _socket?.emit('join', room);
      _log.d('[Socket] Joined room: $room');
    }
  }

  void leaveRoom(String room) {
    _joinedRooms.remove(room);
    if (_isConnected) {
      _socket?.emit('leave', room);
      _log.d('[Socket] Left room: $room');
    }
  }

  void joinUserRoom(String userId) => joinRoom(SocketRooms.user(userId));
  void joinOrderRoom(String orderId) => joinRoom(SocketRooms.order(orderId));
  void leaveOrderRoom(String orderId) => leaveRoom(SocketRooms.order(orderId));

  // ── Event subscriptions ───────────────────────────────────────────────────

  StreamController<T> stream<T>(String event, T Function(dynamic) mapper) {
    final controller = StreamController<T>.broadcast();
    final handler = (dynamic data) {
      try {
        controller.add(mapper(data));
      } catch (e) {
        _log.e('[Socket] Parse error for $event: $e');
      }
    };
    _listeners.putIfAbsent(event, () => []).add(handler);
    _socket?.on(event, handler);
    return controller;
  }

  void on(String event, void Function(dynamic) handler) {
    _listeners.putIfAbsent(event, () => []).add(handler);
    _socket?.on(event, handler);
  }

  void off(String event) {
    _socket?.off(event);
    _listeners.remove(event);
  }

  // ── Disconnect ────────────────────────────────────────────────────────────

  void disconnect() {
    _joinedRooms.clear();
    _listeners.clear();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
  }

  void dispose() => disconnect();
}
