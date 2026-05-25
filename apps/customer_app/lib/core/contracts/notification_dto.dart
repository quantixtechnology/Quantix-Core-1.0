import 'package:freezed_annotation/freezed_annotation.dart';

part 'notification_dto.freezed.dart';
part 'notification_dto.g.dart';

@freezed
class NotificationDTO with _$NotificationDTO {
  const factory NotificationDTO({
    required String id,
    required String type,
    required String channel,
    required String title,
    required String message,
    required bool isRead,
    required String createdAt,
    Map<String, dynamic>? data,
    String? readAt,
    String? sentAt,
  }) = _NotificationDTO;

  factory NotificationDTO.fromJson(Map<String, dynamic> json) =>
      _$NotificationDTOFromJson(json);
}

@freezed
class NotificationMeta with _$NotificationMeta {
  const factory NotificationMeta({
    required int page,
    required int limit,
    required int total,
    required int unreadCount,
    required int totalPages,
    required bool hasNext,
  }) = _NotificationMeta;

  factory NotificationMeta.fromJson(Map<String, dynamic> json) =>
      _$NotificationMetaFromJson(json);
}

@freezed
class NotificationsResponse with _$NotificationsResponse {
  const factory NotificationsResponse({
    required List<NotificationDTO> data,
    required NotificationMeta meta,
  }) = _NotificationsResponse;

  factory NotificationsResponse.fromJson(Map<String, dynamic> json) =>
      _$NotificationsResponseFromJson(json);
}

@freezed
class DeviceRegisterRequest with _$DeviceRegisterRequest {
  const factory DeviceRegisterRequest({
    required String fcmToken,
    required String platform,
    String? deviceId,
    String? appVersion,
  }) = _DeviceRegisterRequest;

  factory DeviceRegisterRequest.fromJson(Map<String, dynamic> json) =>
      _$DeviceRegisterRequestFromJson(json);
}

@freezed
class BannerDTO with _$BannerDTO {
  const factory BannerDTO({
    required String id,
    required String title,
    required String imageUrl,
    @Default(0) int sortOrder,
    String? link,
    String? startDate,
    String? endDate,
  }) = _BannerDTO;

  factory BannerDTO.fromJson(Map<String, dynamic> json) =>
      _$BannerDTOFromJson(json);
}

@freezed
class PromoDisplayDTO with _$PromoDisplayDTO {
  const factory PromoDisplayDTO({
    required String id,
    required String code,
    required String type,
    required double value,
    required double minOrderAmount,
    required String validUntil,
    String? description,
    double? maxDiscount,
  }) = _PromoDisplayDTO;

  factory PromoDisplayDTO.fromJson(Map<String, dynamic> json) =>
      _$PromoDisplayDTOFromJson(json);
}
