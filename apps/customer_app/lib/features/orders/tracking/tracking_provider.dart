import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../core/constants/socket_events.dart';
import '../../../core/contracts/tracking_dto.dart';
import '../../../core/contracts/websocket_payloads.dart';
import '../../../core/sockets/socket_service.dart';
import '../services/order_service.dart';

// ── Tracking State ─────────────────────────────────────────────────────────

class TrackingState {
  const TrackingState({
    this.tracking,
    this.partnerLocation,
    this.etaMinutes,
    this.distanceKm,
    this.estimatedArrival,
    this.isLive = false,
    this.isLoading = true,
    this.error,
  });

  final OrderTrackingDTO? tracking;
  final LatLng? partnerLocation;
  final int? etaMinutes;
  final double? distanceKm;
  final String? estimatedArrival;
  final bool isLive;
  final bool isLoading;
  final String? error;

  String get etaLabel {
    if (etaMinutes == null) return '';
    return '$etaMinutes min${etaMinutes != 1 ? 's' : ''}';
  }

  TrackingState copyWith({
    OrderTrackingDTO? tracking,
    LatLng? partnerLocation,
    int? etaMinutes,
    double? distanceKm,
    String? estimatedArrival,
    bool? isLive,
    bool? isLoading,
    String? error,
  }) {
    return TrackingState(
      tracking: tracking ?? this.tracking,
      partnerLocation: partnerLocation ?? this.partnerLocation,
      etaMinutes: etaMinutes ?? this.etaMinutes,
      distanceKm: distanceKm ?? this.distanceKm,
      estimatedArrival: estimatedArrival ?? this.estimatedArrival,
      isLive: isLive ?? this.isLive,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

// ── Tracking Notifier ──────────────────────────────────────────────────────

class TrackingNotifier extends StateNotifier<TrackingState> {
  TrackingNotifier({
    required this.orderId,
    required OrderService orderService,
    required SocketService socketService,
  })  : _orderService = orderService,
        _socketService = socketService,
        super(const TrackingState()) {
    _init();
  }

  final String orderId;
  final OrderService _orderService;
  final SocketService _socketService;

  Timer? _pollTimer;
  bool _socketWorking = false;

  Future<void> _init() async {
    await _fetchTrackingData();
    _subscribeSocket();
    _startFallbackPoller();
  }

  Future<void> _fetchTrackingData() async {
    try {
      final tracking = await _orderService.trackOrder(orderId);
      final live = await _orderService.getLiveTracking(orderId);

      state = state.copyWith(
        tracking: tracking,
        isLoading: false,
        isLive: live.isLive,
        etaMinutes: live.etaMinutes,
        distanceKm: live.distanceKm,
        estimatedArrival: live.estimatedArrival,
        partnerLocation: live.location != null
            ? LatLng(live.location!.lat, live.location!.lng)
            : null,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void _subscribeSocket() {
    _socketService.joinOrderRoom(orderId);

    _socketService.on(SocketEvents.deliveryLocationUpdated, (data) {
      _socketWorking = true;
      _pollTimer?.cancel(); // WebSocket working — stop polling
      try {
        final payload = WsDeliveryLocationUpdated.fromJson(data as Map<String, dynamic>);
        if (payload.orderId != orderId) return;
        state = state.copyWith(
          partnerLocation: LatLng(payload.lat, payload.lng),
          isLive: true,
          etaMinutes: payload.etaMinutes,
          distanceKm: payload.distanceKm,
        );
      } catch (_) {}
    });

    _socketService.on(SocketEvents.trackingEtaUpdated, (data) {
      try {
        final payload = WsTrackingEtaUpdated.fromJson(data as Map<String, dynamic>);
        if (payload.orderId != orderId) return;
        state = state.copyWith(
          etaMinutes: payload.etaMinutes,
          distanceKm: payload.distanceKm,
          estimatedArrival: payload.estimatedArrival,
        );
      } catch (_) {}
    });

    _socketService.on(SocketEvents.orderStatusChanged, (data) {
      try {
        final payload = WsOrderStatusChanged.fromJson(data as Map<String, dynamic>);
        if (payload.orderId != orderId) return;
        // Refresh full tracking data on status change
        _fetchTrackingData();
      } catch (_) {}
    });
  }

  // Poll every 5s if WebSocket hasn't delivered any events yet
  void _startFallbackPoller() {
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      if (_socketWorking) {
        _pollTimer?.cancel();
        return;
      }
      try {
        final live = await _orderService.getLiveTracking(orderId);
        state = state.copyWith(
          partnerLocation: live.location != null
              ? LatLng(live.location!.lat, live.location!.lng)
              : null,
          isLive: live.isLive,
          etaMinutes: live.etaMinutes,
          distanceKm: live.distanceKm,
          estimatedArrival: live.estimatedArrival,
        );
      } catch (_) {}
    });
  }

  Future<void> refresh() => _fetchTrackingData();

  @override
  void dispose() {
    _pollTimer?.cancel();
    _socketService.leaveOrderRoom(orderId);
    _socketService.off(SocketEvents.deliveryLocationUpdated);
    _socketService.off(SocketEvents.trackingEtaUpdated);
    _socketService.off(SocketEvents.orderStatusChanged);
    super.dispose();
  }
}

// ── Provider ───────────────────────────────────────────────────────────────

final trackingProvider =
    StateNotifierProvider.autoDispose.family<TrackingNotifier, TrackingState, String>(
  (ref, orderId) {
    return TrackingNotifier(
      orderId: orderId,
      orderService: ref.read(orderServiceProvider),
      socketService: ref.read(socketServiceProvider),
    );
  },
);
