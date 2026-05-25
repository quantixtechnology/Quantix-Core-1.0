import 'package:freezed_annotation/freezed_annotation.dart';
import 'order_dto.dart';

part 'tracking_dto.freezed.dart';
part 'tracking_dto.g.dart';

@freezed
class PartnerTrackingSummary with _$PartnerTrackingSummary {
  const factory PartnerTrackingSummary({
    required String id,
    required String name,
    String? phone,
    String? avatar,
    String? vehicleType,
    double? rating,
  }) = _PartnerTrackingSummary;

  factory PartnerTrackingSummary.fromJson(Map<String, dynamic> json) =>
      _$PartnerTrackingSummaryFromJson(json);
}

@freezed
class LocationPoint with _$LocationPoint {
  const factory LocationPoint({
    required double lat,
    required double lng,
    String? timestamp,
  }) = _LocationPoint;

  factory LocationPoint.fromJson(Map<String, dynamic> json) =>
      _$LocationPointFromJson(json);
}

@freezed
class LiveTrackingDTO with _$LiveTrackingDTO {
  const factory LiveTrackingDTO({
    required Map<String, dynamic> order,
    required bool isLive,
    PartnerTrackingSummary? partner,
    LocationPoint? location,
    String? eta,
    String? estimatedArrival,
    String? deliveryStatus,
    int? etaMinutes,
    double? distanceKm,
  }) = _LiveTrackingDTO;

  factory LiveTrackingDTO.fromJson(Map<String, dynamic> json) =>
      _$LiveTrackingDTOFromJson(json);
}

@freezed
class EtaDTO with _$EtaDTO {
  const factory EtaDTO({
    int? etaMinutes,
    double? distanceKm,
    String? estimatedArrival,
    String? eta,
    String? lastLocationUpdate,
  }) = _EtaDTO;

  factory EtaDTO.fromJson(Map<String, dynamic> json) =>
      _$EtaDTOFromJson(json);
}

@freezed
class StatusHistoryItem with _$StatusHistoryItem {
  const factory StatusHistoryItem({
    required String status,
    required String timestamp,
    String? note,
  }) = _StatusHistoryItem;

  factory StatusHistoryItem.fromJson(Map<String, dynamic> json) =>
      _$StatusHistoryItemFromJson(json);
}

@freezed
class DeliveryInfo with _$DeliveryInfo {
  const factory DeliveryInfo({
    required String status,
    @Default([]) List<LocationPoint> liveTracking,
    String? estimatedDeliveryTime,
    String? actualDeliveryTime,
    String? actualPickupTime,
    double? distance,
    PartnerTrackingSummary? partner,
  }) = _DeliveryInfo;

  factory DeliveryInfo.fromJson(Map<String, dynamic> json) =>
      _$DeliveryInfoFromJson(json);
}

@freezed
class OrderTrackingDTO with _$OrderTrackingDTO {
  const factory OrderTrackingDTO({
    required String id,
    required String orderNumber,
    required String orderType,
    required String status,
    required String paymentStatus,
    required double totalAmount,
    required double subtotal,
    required double deliveryFee,
    required double totalTax,
    required double totalDiscount,
    required String createdAt,
    required List<OrderItemDTO> items,
    required List<StatusHistoryItem> statusHistory,
    Map<String, dynamic>? store,
    Map<String, dynamic>? customer,
    DeliveryInfo? delivery,
    String? confirmedAt,
    String? deliveredAt,
  }) = _OrderTrackingDTO;

  factory OrderTrackingDTO.fromJson(Map<String, dynamic> json) =>
      _$OrderTrackingDTOFromJson(json);
}
