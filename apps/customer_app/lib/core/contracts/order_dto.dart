import 'package:freezed_annotation/freezed_annotation.dart';

part 'order_dto.freezed.dart';
part 'order_dto.g.dart';

@freezed
class OrderItemDTO with _$OrderItemDTO {
  const factory OrderItemDTO({
    required String id,
    required String itemType,
    required String itemName,
    required int quantity,
    required double unitPrice,
    required double totalPrice,
    String? variantName,
    String? specialInstructions,
    bool? isVeg,
  }) = _OrderItemDTO;

  factory OrderItemDTO.fromJson(Map<String, dynamic> json) =>
      _$OrderItemDTOFromJson(json);
}

@freezed
class OrderDTO with _$OrderDTO {
  const factory OrderDTO({
    required String id,
    required String businessId,
    required String storeId,
    required String orderNumber,
    required String orderType,
    required String orderSource,
    required String status,
    required String paymentStatus,
    required double subtotal,
    required double totalTax,
    required double deliveryFee,
    required double totalDiscount,
    required double totalAmount,
    required String createdAt,
    @Default([]) List<OrderItemDTO> items,
    String? paymentMethod,
    String? promoCodeId,
    String? deliveryAddress,
    String? notes,
    String? confirmedAt,
    String? deliveredAt,
    double? deliveryLat,
    double? deliveryLng,
  }) = _OrderDTO;

  factory OrderDTO.fromJson(Map<String, dynamic> json) =>
      _$OrderDTOFromJson(json);
}

@freezed
class CreateOrderItem with _$CreateOrderItem {
  const factory CreateOrderItem({
    required String productId,
    required int quantity,
    String? variantId,
    String? specialInstructions,
    Map<String, dynamic>? customizations,
  }) = _CreateOrderItem;

  factory CreateOrderItem.fromJson(Map<String, dynamic> json) =>
      _$CreateOrderItemFromJson(json);
}

@freezed
class CreateOrderRequest with _$CreateOrderRequest {
  const factory CreateOrderRequest({
    required String storeId,
    required String orderType,
    required List<CreateOrderItem> items,
    String? deliveryAddressId,
    String? paymentMethod,
    String? promoCodeId,
    String? deliveryInstructions,
    String? notes,
    @Default(0.0) double deliveryFee,
  }) = _CreateOrderRequest;

  factory CreateOrderRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateOrderRequestFromJson(json);
}
