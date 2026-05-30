// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'store_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_StoreTiming _$StoreTimingFromJson(Map<String, dynamic> json) => _StoreTiming(
  day: (json['day'] as num).toInt(),
  openTime: json['openTime'] as String,
  closeTime: json['closeTime'] as String,
  isClosed: json['isClosed'] as bool? ?? false,
);

Map<String, dynamic> _$StoreTimingToJson(_StoreTiming instance) =>
    <String, dynamic>{
      'day': instance.day,
      'openTime': instance.openTime,
      'closeTime': instance.closeTime,
      'isClosed': instance.isClosed,
    };

_StoreDTO _$StoreDTOFromJson(Map<String, dynamic> json) => _StoreDTO(
  id: json['id'] as String,
  name: json['name'] as String,
  slug: json['slug'] as String,
  address: json['address'] as String?,
  city: json['city'] as String?,
  state: json['state'] as String?,
  pincode: json['pincode'] as String?,
  phone: json['phone'] as String?,
  email: json['email'] as String?,
  latitude: (json['latitude'] as num?)?.toDouble(),
  longitude: (json['longitude'] as num?)?.toDouble(),
  deliveryRadius: (json['deliveryRadius'] as num?)?.toDouble(),
  deliveryFee: (json['deliveryFee'] as num?)?.toDouble(),
  freeDeliveryAbove: (json['freeDeliveryAbove'] as num?)?.toDouble(),
  minOrderAmount: (json['minOrderAmount'] as num?)?.toDouble(),
  preparationTime: (json['preparationTime'] as num?)?.toInt(),
  isMainStore: json['isMainStore'] as bool? ?? false,
  operatingHours: json['operatingHours'] as Map<String, dynamic>? ?? const {},
  storeTimings:
      (json['storeTimings'] as List<dynamic>?)
          ?.map((e) => StoreTiming.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$StoreDTOToJson(_StoreDTO instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'slug': instance.slug,
  'address': instance.address,
  'city': instance.city,
  'state': instance.state,
  'pincode': instance.pincode,
  'phone': instance.phone,
  'email': instance.email,
  'latitude': instance.latitude,
  'longitude': instance.longitude,
  'deliveryRadius': instance.deliveryRadius,
  'deliveryFee': instance.deliveryFee,
  'freeDeliveryAbove': instance.freeDeliveryAbove,
  'minOrderAmount': instance.minOrderAmount,
  'preparationTime': instance.preparationTime,
  'isMainStore': instance.isMainStore,
  'operatingHours': instance.operatingHours,
  'storeTimings': instance.storeTimings,
};

_PaymentGatewayDTO _$PaymentGatewayDTOFromJson(Map<String, dynamic> json) =>
    _PaymentGatewayDTO(
      id: json['id'] as String,
      name: json['name'] as String,
      gateway: json['gateway'] as String,
      isTestMode: json['isTestMode'] as bool? ?? false,
    );

Map<String, dynamic> _$PaymentGatewayDTOToJson(_PaymentGatewayDTO instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'gateway': instance.gateway,
      'isTestMode': instance.isTestMode,
    };

_BusinessBranding _$BusinessBrandingFromJson(Map<String, dynamic> json) =>
    _BusinessBranding(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      businessType: json['businessType'] as String,
      isOnline: json['isOnline'] as bool? ?? true,
      logo: json['logo'] as String?,
      favicon: json['favicon'] as String?,
      primaryColor: json['primaryColor'] as String?,
      secondaryColor: json['secondaryColor'] as String?,
      darkMode: json['darkMode'] as bool? ?? false,
      tagline: json['tagline'] as String?,
      description: json['description'] as String?,
      contactEmail: json['contactEmail'] as String?,
      contactPhone: json['contactPhone'] as String?,
      supportEmail: json['supportEmail'] as String?,
      supportPhone: json['supportPhone'] as String?,
    );

Map<String, dynamic> _$BusinessBrandingToJson(_BusinessBranding instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'slug': instance.slug,
      'businessType': instance.businessType,
      'isOnline': instance.isOnline,
      'logo': instance.logo,
      'favicon': instance.favicon,
      'primaryColor': instance.primaryColor,
      'secondaryColor': instance.secondaryColor,
      'darkMode': instance.darkMode,
      'tagline': instance.tagline,
      'description': instance.description,
      'contactEmail': instance.contactEmail,
      'contactPhone': instance.contactPhone,
      'supportEmail': instance.supportEmail,
      'supportPhone': instance.supportPhone,
    };

_StoreContextDTO _$StoreContextDTOFromJson(
  Map<String, dynamic> json,
) => _StoreContextDTO(
  business: BusinessBranding.fromJson(json['business'] as Map<String, dynamic>),
  store: json['store'] == null
      ? null
      : StoreDTO.fromJson(json['store'] as Map<String, dynamic>),
  ecommerceConfig: json['ecommerceConfig'] as Map<String, dynamic>? ?? const {},
  allowGuestCheckout: json['allowGuestCheckout'] as bool? ?? true,
  orderStages:
      (json['orderStages'] as List<dynamic>?)
          ?.map((e) => e as Map<String, dynamic>)
          .toList() ??
      const [],
  paymentGateways:
      (json['paymentGateways'] as List<dynamic>?)
          ?.map((e) => PaymentGatewayDTO.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$StoreContextDTOToJson(_StoreContextDTO instance) =>
    <String, dynamic>{
      'business': instance.business,
      'store': instance.store,
      'ecommerceConfig': instance.ecommerceConfig,
      'allowGuestCheckout': instance.allowGuestCheckout,
      'orderStages': instance.orderStages,
      'paymentGateways': instance.paymentGateways,
    };

_AppVersionDTO _$AppVersionDTOFromJson(Map<String, dynamic> json) =>
    _AppVersionDTO(
      platform: json['platform'] as String,
      version: json['version'] as String,
      minVersion: json['minVersion'] as String,
      forceUpdate: json['forceUpdate'] as bool? ?? false,
      changelogUrl: json['changelogUrl'] as String?,
      releaseNotes: json['releaseNotes'] as String?,
      publishedAt: json['publishedAt'] as String,
    );

Map<String, dynamic> _$AppVersionDTOToJson(_AppVersionDTO instance) =>
    <String, dynamic>{
      'platform': instance.platform,
      'version': instance.version,
      'minVersion': instance.minVersion,
      'forceUpdate': instance.forceUpdate,
      'changelogUrl': instance.changelogUrl,
      'releaseNotes': instance.releaseNotes,
      'publishedAt': instance.publishedAt,
    };
