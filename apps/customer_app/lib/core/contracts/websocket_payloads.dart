import 'package:freezed_annotation/freezed_annotation.dart';

part 'websocket_payloads.freezed.dart';
part 'websocket_payloads.g.dart';

@freezed
class WsOrderStatusChanged with _$WsOrderStatusChanged {
  const factory WsOrderStatusChanged({
    required String orderId,
    required String orderNumber,
    required String previousStatus,
    required String newStatus,
    required String businessId,
    required String timestamp,
    String? storeId,
    String? customerId,
    String? note,
  }) = _WsOrderStatusChanged;

  factory WsOrderStatusChanged.fromJson(Map<String, dynamic> json) =>
      _$WsOrderStatusChangedFromJson(json);
}

@freezed
class WsDeliveryLocationUpdated with _$WsDeliveryLocationUpdated {
  const factory WsDeliveryLocationUpdated({
    required String orderId,
    required String partnerId,
    required String partnerName,
    required double lat,
    required double lng,
    required String businessId,
    required String timestamp,
    double? accuracy,
    double? heading,
    double? speed,
    int? etaMinutes,
    double? distanceKm,
  }) = _WsDeliveryLocationUpdated;

  factory WsDeliveryLocationUpdated.fromJson(Map<String, dynamic> json) =>
      _$WsDeliveryLocationUpdatedFromJson(json);
}

@freezed
class WsPartnerAssigned with _$WsPartnerAssigned {
  const factory WsPartnerAssigned({
    required String orderId,
    required String orderNumber,
    required String partnerId,
    required String partnerName,
    required String partnerPhone,
    required String businessId,
    required String timestamp,
  }) = _WsPartnerAssigned;

  factory WsPartnerAssigned.fromJson(Map<String, dynamic> json) =>
      _$WsPartnerAssignedFromJson(json);
}

@freezed
class WsTrackingEtaUpdated with _$WsTrackingEtaUpdated {
  const factory WsTrackingEtaUpdated({
    required String orderId,
    required int etaMinutes,
    required double distanceKm,
    required String estimatedArrival,
    required String timestamp,
  }) = _WsTrackingEtaUpdated;

  factory WsTrackingEtaUpdated.fromJson(Map<String, dynamic> json) =>
      _$WsTrackingEtaUpdatedFromJson(json);
}

@freezed
class WsNotificationNew with _$WsNotificationNew {
  const factory WsNotificationNew({
    required String notificationId,
    required String type,
    required String title,
    required String message,
    required String userId,
    required String timestamp,
    Map<String, dynamic>? data,
  }) = _WsNotificationNew;

  factory WsNotificationNew.fromJson(Map<String, dynamic> json) =>
      _$WsNotificationNewFromJson(json);
}
