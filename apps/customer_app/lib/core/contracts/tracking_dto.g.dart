// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tracking_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PartnerTrackingSummary _$PartnerTrackingSummaryFromJson(
  Map<String, dynamic> json,
) => _PartnerTrackingSummary(
  id: json['id'] as String,
  name: json['name'] as String,
  phone: json['phone'] as String?,
  avatar: json['avatar'] as String?,
  vehicleType: json['vehicleType'] as String?,
  rating: (json['rating'] as num?)?.toDouble(),
);

Map<String, dynamic> _$PartnerTrackingSummaryToJson(
  _PartnerTrackingSummary instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'phone': instance.phone,
  'avatar': instance.avatar,
  'vehicleType': instance.vehicleType,
  'rating': instance.rating,
};

_LocationPoint _$LocationPointFromJson(Map<String, dynamic> json) =>
    _LocationPoint(
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      timestamp: json['timestamp'] as String?,
    );

Map<String, dynamic> _$LocationPointToJson(_LocationPoint instance) =>
    <String, dynamic>{
      'lat': instance.lat,
      'lng': instance.lng,
      'timestamp': instance.timestamp,
    };

_LiveTrackingDTO _$LiveTrackingDTOFromJson(Map<String, dynamic> json) =>
    _LiveTrackingDTO(
      order: json['order'] as Map<String, dynamic>,
      isLive: json['isLive'] as bool,
      partner: json['partner'] == null
          ? null
          : PartnerTrackingSummary.fromJson(
              json['partner'] as Map<String, dynamic>,
            ),
      location: json['location'] == null
          ? null
          : LocationPoint.fromJson(json['location'] as Map<String, dynamic>),
      eta: json['eta'] as String?,
      estimatedArrival: json['estimatedArrival'] as String?,
      deliveryStatus: json['deliveryStatus'] as String?,
      etaMinutes: (json['etaMinutes'] as num?)?.toInt(),
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
    );

Map<String, dynamic> _$LiveTrackingDTOToJson(_LiveTrackingDTO instance) =>
    <String, dynamic>{
      'order': instance.order,
      'isLive': instance.isLive,
      'partner': instance.partner,
      'location': instance.location,
      'eta': instance.eta,
      'estimatedArrival': instance.estimatedArrival,
      'deliveryStatus': instance.deliveryStatus,
      'etaMinutes': instance.etaMinutes,
      'distanceKm': instance.distanceKm,
    };

_EtaDTO _$EtaDTOFromJson(Map<String, dynamic> json) => _EtaDTO(
  etaMinutes: (json['etaMinutes'] as num?)?.toInt(),
  distanceKm: (json['distanceKm'] as num?)?.toDouble(),
  estimatedArrival: json['estimatedArrival'] as String?,
  eta: json['eta'] as String?,
  lastLocationUpdate: json['lastLocationUpdate'] as String?,
);

Map<String, dynamic> _$EtaDTOToJson(_EtaDTO instance) => <String, dynamic>{
  'etaMinutes': instance.etaMinutes,
  'distanceKm': instance.distanceKm,
  'estimatedArrival': instance.estimatedArrival,
  'eta': instance.eta,
  'lastLocationUpdate': instance.lastLocationUpdate,
};

_StatusHistoryItem _$StatusHistoryItemFromJson(Map<String, dynamic> json) =>
    _StatusHistoryItem(
      status: json['status'] as String,
      timestamp: json['timestamp'] as String,
      note: json['note'] as String?,
    );

Map<String, dynamic> _$StatusHistoryItemToJson(_StatusHistoryItem instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp,
      'note': instance.note,
    };

_DeliveryInfo _$DeliveryInfoFromJson(Map<String, dynamic> json) =>
    _DeliveryInfo(
      status: json['status'] as String,
      liveTracking:
          (json['liveTracking'] as List<dynamic>?)
              ?.map((e) => LocationPoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      estimatedDeliveryTime: json['estimatedDeliveryTime'] as String?,
      actualDeliveryTime: json['actualDeliveryTime'] as String?,
      actualPickupTime: json['actualPickupTime'] as String?,
      distance: (json['distance'] as num?)?.toDouble(),
      partner: json['partner'] == null
          ? null
          : PartnerTrackingSummary.fromJson(
              json['partner'] as Map<String, dynamic>,
            ),
    );

Map<String, dynamic> _$DeliveryInfoToJson(_DeliveryInfo instance) =>
    <String, dynamic>{
      'status': instance.status,
      'liveTracking': instance.liveTracking,
      'estimatedDeliveryTime': instance.estimatedDeliveryTime,
      'actualDeliveryTime': instance.actualDeliveryTime,
      'actualPickupTime': instance.actualPickupTime,
      'distance': instance.distance,
      'partner': instance.partner,
    };

_OrderTrackingDTO _$OrderTrackingDTOFromJson(Map<String, dynamic> json) =>
    _OrderTrackingDTO(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String,
      orderType: json['orderType'] as String,
      status: json['status'] as String,
      paymentStatus: json['paymentStatus'] as String,
      totalAmount: (json['totalAmount'] as num).toDouble(),
      subtotal: (json['subtotal'] as num).toDouble(),
      deliveryFee: (json['deliveryFee'] as num).toDouble(),
      totalTax: (json['totalTax'] as num).toDouble(),
      totalDiscount: (json['totalDiscount'] as num).toDouble(),
      createdAt: json['createdAt'] as String,
      items: (json['items'] as List<dynamic>)
          .map((e) => OrderItemDTO.fromJson(e as Map<String, dynamic>))
          .toList(),
      statusHistory: (json['statusHistory'] as List<dynamic>)
          .map((e) => StatusHistoryItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      store: json['store'] as Map<String, dynamic>?,
      customer: json['customer'] as Map<String, dynamic>?,
      delivery: json['delivery'] == null
          ? null
          : DeliveryInfo.fromJson(json['delivery'] as Map<String, dynamic>),
      confirmedAt: json['confirmedAt'] as String?,
      deliveredAt: json['deliveredAt'] as String?,
    );

Map<String, dynamic> _$OrderTrackingDTOToJson(_OrderTrackingDTO instance) =>
    <String, dynamic>{
      'id': instance.id,
      'orderNumber': instance.orderNumber,
      'orderType': instance.orderType,
      'status': instance.status,
      'paymentStatus': instance.paymentStatus,
      'totalAmount': instance.totalAmount,
      'subtotal': instance.subtotal,
      'deliveryFee': instance.deliveryFee,
      'totalTax': instance.totalTax,
      'totalDiscount': instance.totalDiscount,
      'createdAt': instance.createdAt,
      'items': instance.items,
      'statusHistory': instance.statusHistory,
      'store': instance.store,
      'customer': instance.customer,
      'delivery': instance.delivery,
      'confirmedAt': instance.confirmedAt,
      'deliveredAt': instance.deliveredAt,
    };
