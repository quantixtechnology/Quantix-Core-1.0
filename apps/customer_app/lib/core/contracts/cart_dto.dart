import 'package:freezed_annotation/freezed_annotation.dart';

part 'cart_dto.freezed.dart';
part 'cart_dto.g.dart';

@freezed
class CartVariantSummary with _$CartVariantSummary {
  const factory CartVariantSummary({
    required String id,
    required String name,
    required double price,
    String? sku,
    double? mrp,
    double? discountPrice,
  }) = _CartVariantSummary;

  factory CartVariantSummary.fromJson(Map<String, dynamic> json) =>
      _$CartVariantSummaryFromJson(json);
}

@freezed
class CartProductSummary with _$CartProductSummary {
  const factory CartProductSummary({
    required String name,
    required String slug,
    required List<String> images,
    required String status,
  }) = _CartProductSummary;

  factory CartProductSummary.fromJson(Map<String, dynamic> json) =>
      _$CartProductSummaryFromJson(json);
}

@freezed
class CartItemDTO with _$CartItemDTO {
  const factory CartItemDTO({
    required String id,
    required String productId,
    required String storeId,
    required int quantity,
    required double unitPrice,
    required double lineTotal,
    required CartProductSummary product,
    String? variantId,
    int? availableQty,
    String? inventoryStatus,
    CartVariantSummary? variant,
  }) = _CartItemDTO;

  factory CartItemDTO.fromJson(Map<String, dynamic> json) =>
      _$CartItemDTOFromJson(json);
}

@freezed
class CartDTO with _$CartDTO {
  const factory CartDTO({
    required List<CartItemDTO> data,
    required double total,
    required int itemCount,
  }) = _CartDTO;

  factory CartDTO.fromJson(Map<String, dynamic> json) =>
      _$CartDTOFromJson(json);
}

@freezed
class AddToCartRequest with _$AddToCartRequest {
  const factory AddToCartRequest({
    required String productId,
    required String storeId,
    @Default(1) int quantity,
    String? variantId,
  }) = _AddToCartRequest;

  factory AddToCartRequest.fromJson(Map<String, dynamic> json) =>
      _$AddToCartRequestFromJson(json);
}

@freezed
class CouponDTO with _$CouponDTO {
  const factory CouponDTO({
    required String id,
    required String code,
    required String type,
    required double value,
    required double minOrder,
    required String validUntil,
    String? description,
    double? maxDiscount,
    int? usageLeft,
  }) = _CouponDTO;

  factory CouponDTO.fromJson(Map<String, dynamic> json) =>
      _$CouponDTOFromJson(json);
}
