import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/contracts/notification_dto.dart';
import '../../../core/constants/socket_events.dart';
import '../../../core/contracts/websocket_payloads.dart';
import '../../../core/sockets/socket_service.dart';
import '../services/notification_service.dart';

class NotificationState {
  const NotificationState({
    this.notifications = const [],
    this.unreadCount = 0,
    this.isLoading = false,
    this.error,
  });

  final List<NotificationDTO> notifications;
  final int unreadCount;
  final bool isLoading;
  final String? error;

  NotificationState copyWith({
    List<NotificationDTO>? notifications,
    int? unreadCount,
    bool? isLoading,
    String? error,
  }) {
    return NotificationState(
      notifications: notifications ?? this.notifications,
      unreadCount: unreadCount ?? this.unreadCount,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class NotificationNotifier extends StateNotifier<NotificationState> {
  NotificationNotifier(this._service, this._socket)
      : super(const NotificationState()) {
    _subscribeSocket();
  }

  final NotificationService _service;
  final SocketService _socket;

  void _subscribeSocket() {
    _socket.on(SocketEvents.notificationNew, (data) {
      try {
        final payload = WsNotificationNew.fromJson(data as Map<String, dynamic>);
        final newNotif = NotificationDTO(
          id: payload.notificationId,
          type: payload.type,
          channel: 'PUSH',
          title: payload.title,
          message: payload.message,
          isRead: false,
          createdAt: payload.timestamp,
          data: payload.data,
        );
        state = state.copyWith(
          notifications: [newNotif, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        );
      } catch (_) {}
    });
  }

  Future<void> load({bool reset = false}) async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await _service.getNotifications();
      state = state.copyWith(
        notifications: response.data,
        unreadCount: response.meta.unreadCount,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _service.markRead(id);
      final updated = state.notifications.map((n) {
        return n.id == id ? n.copyWith(isRead: true) : n;
      }).toList();
      final unread = updated.where((n) => !n.isRead).length;
      state = state.copyWith(notifications: updated, unreadCount: unread);
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    try {
      await _service.markAllRead();
      final updated = state.notifications.map((n) => n.copyWith(isRead: true)).toList();
      state = state.copyWith(notifications: updated, unreadCount: 0);
    } catch (_) {}
  }
}

final notificationProvider =
    StateNotifierProvider<NotificationNotifier, NotificationState>((ref) {
  return NotificationNotifier(
    ref.read(notificationServiceProvider),
    ref.read(socketServiceProvider),
  );
});

final unreadCountProvider = Provider<int>((ref) {
  return ref.watch(notificationProvider).unreadCount;
});
