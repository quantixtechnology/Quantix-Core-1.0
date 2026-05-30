// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_NotificationDTO _$NotificationDTOFromJson(Map<String, dynamic> json) =>
    _NotificationDTO(
      id: json['id'] as String,
      type: json['type'] as String,
      channel: json['channel'] as String,
      title: json['title'] as String,
      message: json['message'] as String,
      isRead: json['isRead'] as bool,
      createdAt: json['createdAt'] as String,
      data: json['data'] as Map<String, dynamic>?,
      readAt: json['readAt'] as String?,
      sentAt: json['sentAt'] as String?,
    );

Map<String, dynamic> _$NotificationDTOToJson(_NotificationDTO instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'channel': instance.channel,
      'title': instance.title,
      'message': instance.message,
      'isRead': instance.isRead,
      'createdAt': instance.createdAt,
      'data': instance.data,
      'readAt': instance.readAt,
      'sentAt': instance.sentAt,
    };

_NotificationMeta _$NotificationMetaFromJson(Map<String, dynamic> json) =>
    _NotificationMeta(
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
      total: (json['total'] as num).toInt(),
      unreadCount: (json['unreadCount'] as num).toInt(),
      totalPages: (json['totalPages'] as num).toInt(),
      hasNext: json['hasNext'] as bool,
    );

Map<String, dynamic> _$NotificationMetaToJson(_NotificationMeta instance) =>
    <String, dynamic>{
      'page': instance.page,
      'limit': instance.limit,
      'total': instance.total,
      'unreadCount': instance.unreadCount,
      'totalPages': instance.totalPages,
      'hasNext': instance.hasNext,
    };

_NotificationsResponse _$NotificationsResponseFromJson(
  Map<String, dynamic> json,
) => _NotificationsResponse(
  data: (json['data'] as List<dynamic>)
      .map((e) => NotificationDTO.fromJson(e as Map<String, dynamic>))
      .toList(),
  meta: NotificationMeta.fromJson(json['meta'] as Map<String, dynamic>),
);

Map<String, dynamic> _$NotificationsResponseToJson(
  _NotificationsResponse instance,
) => <String, dynamic>{'data': instance.data, 'meta': instance.meta};

_DeviceRegisterRequest _$DeviceRegisterRequestFromJson(
  Map<String, dynamic> json,
) => _DeviceRegisterRequest(
  fcmToken: json['fcmToken'] as String,
  platform: json['platform'] as String,
  deviceId: json['deviceId'] as String?,
  appVersion: json['appVersion'] as String?,
);

Map<String, dynamic> _$DeviceRegisterRequestToJson(
  _DeviceRegisterRequest instance,
) => <String, dynamic>{
  'fcmToken': instance.fcmToken,
  'platform': instance.platform,
  'deviceId': instance.deviceId,
  'appVersion': instance.appVersion,
};

_BannerDTO _$BannerDTOFromJson(Map<String, dynamic> json) => _BannerDTO(
  id: json['id'] as String,
  title: json['title'] as String,
  imageUrl: json['imageUrl'] as String,
  sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
  link: json['link'] as String?,
  startDate: json['startDate'] as String?,
  endDate: json['endDate'] as String?,
);

Map<String, dynamic> _$BannerDTOToJson(_BannerDTO instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'imageUrl': instance.imageUrl,
      'sortOrder': instance.sortOrder,
      'link': instance.link,
      'startDate': instance.startDate,
      'endDate': instance.endDate,
    };

_PromoDisplayDTO _$PromoDisplayDTOFromJson(Map<String, dynamic> json) =>
    _PromoDisplayDTO(
      id: json['id'] as String,
      code: json['code'] as String,
      type: json['type'] as String,
      value: (json['value'] as num).toDouble(),
      minOrderAmount: (json['minOrderAmount'] as num).toDouble(),
      validUntil: json['validUntil'] as String,
      description: json['description'] as String?,
      maxDiscount: (json['maxDiscount'] as num?)?.toDouble(),
    );

Map<String, dynamic> _$PromoDisplayDTOToJson(_PromoDisplayDTO instance) =>
    <String, dynamic>{
      'id': instance.id,
      'code': instance.code,
      'type': instance.type,
      'value': instance.value,
      'minOrderAmount': instance.minOrderAmount,
      'validUntil': instance.validUntil,
      'description': instance.description,
      'maxDiscount': instance.maxDiscount,
    };
