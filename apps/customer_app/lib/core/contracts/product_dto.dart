import 'package:freezed_annotation/freezed_annotation.dart';

part 'product_dto.freezed.dart';
part 'product_dto.g.dart';

@freezed
class CategoryDTO with _$CategoryDTO {
  const factory CategoryDTO({
    required String id,
    required String name,
    required String slug,
    String? description,
    String? image,
    String? icon,
    @Default('#10B981') String color,
    @Default(0) int sortOrder,
    @Default(true) bool isActive,
    String? workflowType,
    @Default(0) int productCount,
    @Default([]) List<CategoryDTO> children,
  }) = _CategoryDTO;

  factory CategoryDTO.fromJson(Map<String, dynamic> json) =>
      _$CategoryDTOFromJson(json);
}

@freezed
class VariantDTO with _$VariantDTO {
  const factory VariantDTO({
    required String id,
    required String name,
    required double price,
    @Default(true) bool isDefault,
    @Default(true) bool isActive,
    @Default({}) Map<String, String> attributes,
    String? sku,
    double? mrp,
    double? discountPrice,
    double? discountPercent,
    int? stock,
  }) = _VariantDTO;

  factory VariantDTO.fromJson(Map<String, dynamic> json) =>
      _$VariantDTOFromJson(json);
}

@freezed
class ProductDTO with _$ProductDTO {
  const factory ProductDTO({
    required String id,
    required String businessId,
    required String name,
    required String slug,
    required String type,
    required String status,
    required double defaultPrice,
    required double defaultMrp,
    required String stockStatus,
    required int availableStock,
    @Default(false) bool hasInventory,
    @Default([]) List<String> images,
    @Default([]) List<VariantDTO> variants,
    @Default([]) List<String> tags,
    @Default(1) int minOrderQty,
    @Default(100) int maxOrderQty,
    @Default(0) int sortOrder,
    @Default(false) bool isFeatured,
    @Default(false) bool isPopular,
    @Default({}) Map<String, dynamic> metadata,
    String? categoryId,
    String? description,
    String? shortDesc,
    String? sku,
    String? unit,
    String? unitQuantity,
    String? workflowType,
    String? createdAt,
    String? updatedAt,
    bool? isVeg,
    int? preparationTime,
    CategoryDTO? category,
  }) = _ProductDTO;

  factory ProductDTO.fromJson(Map<String, dynamic> json) =>
      _$ProductDTOFromJson(json);
}

@freezed
class ProductListResponse with _$ProductListResponse {
  const factory ProductListResponse({
    required List<ProductDTO> data,
    required PaginationMeta pagination,
    String? storeId,
  }) = _ProductListResponse;

  factory ProductListResponse.fromJson(Map<String, dynamic> json) =>
      _$ProductListResponseFromJson(json);
}

@freezed
class PaginationMeta with _$PaginationMeta {
  const factory PaginationMeta({
    required int page,
    required int limit,
    required int total,
    required int totalPages,
    required bool hasNext,
    required bool hasPrev,
  }) = _PaginationMeta;

  factory PaginationMeta.fromJson(Map<String, dynamic> json) =>
      _$PaginationMetaFromJson(json);
}
