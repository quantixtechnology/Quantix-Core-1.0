// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_OrderItemDTO _$OrderItemDTOFromJson(Map<String, dynamic> json) =>
    _OrderItemDTO(
      id: json['id'] as String,
      itemType: json['itemType'] as String,
      itemName: json['itemName'] as String,
      quantity: (json['quantity'] as num).toInt(),
      unitPrice: (json['unitPrice'] as num).toDouble(),
      totalPrice: (json['totalPrice'] as num).toDouble(),
      variantName: json['variantName'] as String?,
      specialInstructions: json['specialInstructions'] as String?,
      isVeg: json['isVeg'] as bool?,
    );

Map<String, dynamic> _$OrderItemDTOToJson(_OrderItemDTO instance) =>
    <String, dynamic>{
      'id': instance.id,
      'itemType': instance.itemType,
      'itemName': instance.itemName,
      'quantity': instance.quantity,
      'unitPrice': instance.unitPrice,
      'totalPrice': instance.totalPrice,
      'variantName': instance.variantName,
      'specialInstructions': instance.specialInstructions,
      'isVeg': instance.isVeg,
    };

_OrderDTO _$OrderDTOFromJson(Map<String, dynamic> json) => _OrderDTO(
  id: json['id'] as String,
  businessId: json['businessId'] as String,
  storeId: json['storeId'] as String,
  orderNumber: json['orderNumber'] as String,
  orderType: json['orderType'] as String,
  orderSource: json['orderSource'] as String,
  status: json['status'] as String,
  paymentStatus: json['paymentStatus'] as String,
  subtotal: (json['subtotal'] as num).toDouble(),
  totalTax: (json['totalTax'] as num).toDouble(),
  deliveryFee: (json['deliveryFee'] as num).toDouble(),
  totalDiscount: (json['totalDiscount'] as num).toDouble(),
  totalAmount: (json['totalAmount'] as num).toDouble(),
  createdAt: json['createdAt'] as String,
  items:
      (json['items'] as List<dynamic>?)
          ?.map((e) => OrderItemDTO.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  paymentMethod: json['paymentMethod'] as String?,
  promoCodeId: json['promoCodeId'] as String?,
  deliveryAddress: json['deliveryAddress'] as String?,
  notes: json['notes'] as String?,
  confirmedAt: json['confirmedAt'] as String?,
  deliveredAt: json['deliveredAt'] as String?,
  deliveryLat: (json['deliveryLat'] as num?)?.toDouble(),
  deliveryLng: (json['deliveryLng'] as num?)?.toDouble(),
);

Map<String, dynamic> _$OrderDTOToJson(_OrderDTO instance) => <String, dynamic>{
  'id': instance.id,
  'businessId': instance.businessId,
  'storeId': instance.storeId,
  'orderNumber': instance.orderNumber,
  'orderType': instance.orderType,
  'orderSource': instance.orderSource,
  'status': instance.status,
  'paymentStatus': instance.paymentStatus,
  'subtotal': instance.subtotal,
  'totalTax': instance.totalTax,
  'deliveryFee': instance.deliveryFee,
  'totalDiscount': instance.totalDiscount,
  'totalAmount': instance.totalAmount,
  'createdAt': instance.createdAt,
  'items': instance.items,
  'paymentMethod': instance.paymentMethod,
  'promoCodeId': instance.promoCodeId,
  'deliveryAddress': instance.deliveryAddress,
  'notes': instance.notes,
  'confirmedAt': instance.confirmedAt,
  'deliveredAt': instance.deliveredAt,
  'deliveryLat': instance.deliveryLat,
  'deliveryLng': instance.deliveryLng,
};

_CreateOrderItem _$CreateOrderItemFromJson(Map<String, dynamic> json) =>
    _CreateOrderItem(
      productId: json['productId'] as String,
      quantity: (json['quantity'] as num).toInt(),
      variantId: json['variantId'] as String?,
      specialInstructions: json['specialInstructions'] as String?,
      customizations: json['customizations'] as Map<String, dynamic>?,
    );

Map<String, dynamic> _$CreateOrderItemToJson(_CreateOrderItem instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'quantity': instance.quantity,
      'variantId': instance.variantId,
      'specialInstructions': instance.specialInstructions,
      'customizations': instance.customizations,
    };

_CreateOrderRequest _$CreateOrderRequestFromJson(Map<String, dynamic> json) =>
    _CreateOrderRequest(
      storeId: json['storeId'] as String,
      orderType: json['orderType'] as String,
      items: (json['items'] as List<dynamic>)
          .map((e) => CreateOrderItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      deliveryAddressId: json['deliveryAddressId'] as String?,
      paymentMethod: json['paymentMethod'] as String?,
      promoCodeId: json['promoCodeId'] as String?,
      deliveryInstructions: json['deliveryInstructions'] as String?,
      notes: json['notes'] as String?,
      deliveryFee: (json['deliveryFee'] as num?)?.toDouble() ?? 0.0,
    );

Map<String, dynamic> _$CreateOrderRequestToJson(_CreateOrderRequest instance) =>
    <String, dynamic>{
      'storeId': instance.storeId,
      'orderType': instance.orderType,
      'items': instance.items,
      'deliveryAddressId': instance.deliveryAddressId,
      'paymentMethod': instance.paymentMethod,
      'promoCodeId': instance.promoCodeId,
      'deliveryInstructions': instance.deliveryInstructions,
      'notes': instance.notes,
      'deliveryFee': instance.deliveryFee,
    };
