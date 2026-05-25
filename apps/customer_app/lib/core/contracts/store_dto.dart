import 'package:freezed_annotation/freezed_annotation.dart';

part 'store_dto.freezed.dart';
part 'store_dto.g.dart';

@freezed
class StoreTiming with _$StoreTiming {
  const factory StoreTiming({
    required int day,
    required String openTime,
    required String closeTime,
    @Default(false) bool isClosed,
  }) = _StoreTiming;

  factory StoreTiming.fromJson(Map<String, dynamic> json) =>
      _$StoreTimingFromJson(json);
}

@freezed
class StoreDTO with _$StoreDTO {
  const factory StoreDTO({
    required String id,
    required String name,
    required String slug,
    String? address,
    String? city,
    String? state,
    String? pincode,
    String? phone,
    String? email,
    double? latitude,
    double? longitude,
    double? deliveryRadius,
    double? deliveryFee,
    double? freeDeliveryAbove,
    double? minOrderAmount,
    int? preparationTime,
    @Default(false) bool isMainStore,
    @Default({}) Map<String, dynamic> operatingHours,
    @Default([]) List<StoreTiming> storeTimings,
  }) = _StoreDTO;

  factory StoreDTO.fromJson(Map<String, dynamic> json) =>
      _$StoreDTOFromJson(json);
}

@freezed
class PaymentGatewayDTO with _$PaymentGatewayDTO {
  const factory PaymentGatewayDTO({
    required String id,
    required String name,
    required String gateway,
    @Default(false) bool isTestMode,
  }) = _PaymentGatewayDTO;

  factory PaymentGatewayDTO.fromJson(Map<String, dynamic> json) =>
      _$PaymentGatewayDTOFromJson(json);
}

@freezed
class BusinessBranding with _$BusinessBranding {
  const factory BusinessBranding({
    required String id,
    required String name,
    required String slug,
    required String businessType,
    @Default(true) bool isOnline,
    String? logo,
    String? favicon,
    String? primaryColor,
    String? secondaryColor,
    @Default(false) bool darkMode,
    String? tagline,
    String? description,
    String? contactEmail,
    String? contactPhone,
    String? supportEmail,
    String? supportPhone,
  }) = _BusinessBranding;

  factory BusinessBranding.fromJson(Map<String, dynamic> json) =>
      _$BusinessBrandingFromJson(json);
}

@freezed
class StoreContextDTO with _$StoreContextDTO {
  const factory StoreContextDTO({
    required BusinessBranding business,
    StoreDTO? store,
    @Default({}) Map<String, dynamic> ecommerceConfig,
    @Default(true) bool allowGuestCheckout,
    @Default([]) List<Map<String, dynamic>> orderStages,
    @Default([]) List<PaymentGatewayDTO> paymentGateways,
  }) = _StoreContextDTO;

  factory StoreContextDTO.fromJson(Map<String, dynamic> json) =>
      _$StoreContextDTOFromJson(json);
}

@freezed
class AppVersionDTO with _$AppVersionDTO {
  const factory AppVersionDTO({
    required String platform,
    required String version,
    required String minVersion,
    @Default(false) bool forceUpdate,
    String? changelogUrl,
    String? releaseNotes,
    required String publishedAt,
  }) = _AppVersionDTO;

  factory AppVersionDTO.fromJson(Map<String, dynamic> json) =>
      _$AppVersionDTOFromJson(json);
}
