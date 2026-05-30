// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_CategoryDTO _$CategoryDTOFromJson(Map<String, dynamic> json) => _CategoryDTO(
  id: json['id'] as String,
  name: json['name'] as String,
  slug: json['slug'] as String,
  description: json['description'] as String?,
  image: json['image'] as String?,
  icon: json['icon'] as String?,
  color: json['color'] as String? ?? '#10B981',
  sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
  isActive: json['isActive'] as bool? ?? true,
  workflowType: json['workflowType'] as String?,
  productCount: (json['productCount'] as num?)?.toInt() ?? 0,
  children:
      (json['children'] as List<dynamic>?)
          ?.map((e) => CategoryDTO.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$CategoryDTOToJson(_CategoryDTO instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'slug': instance.slug,
      'description': instance.description,
      'image': instance.image,
      'icon': instance.icon,
      'color': instance.color,
      'sortOrder': instance.sortOrder,
      'isActive': instance.isActive,
      'workflowType': instance.workflowType,
      'productCount': instance.productCount,
      'children': instance.children,
    };

_VariantDTO _$VariantDTOFromJson(Map<String, dynamic> json) => _VariantDTO(
  id: json['id'] as String,
  name: json['name'] as String,
  price: (json['price'] as num).toDouble(),
  isDefault: json['isDefault'] as bool? ?? true,
  isActive: json['isActive'] as bool? ?? true,
  attributes:
      (json['attributes'] as Map<String, dynamic>?)?.map(
        (k, e) => MapEntry(k, e as String),
      ) ??
      const {},
  sku: json['sku'] as String?,
  mrp: (json['mrp'] as num?)?.toDouble(),
  discountPrice: (json['discountPrice'] as num?)?.toDouble(),
  discountPercent: (json['discountPercent'] as num?)?.toDouble(),
  stock: (json['stock'] as num?)?.toInt(),
);

Map<String, dynamic> _$VariantDTOToJson(_VariantDTO instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'price': instance.price,
      'isDefault': instance.isDefault,
      'isActive': instance.isActive,
      'attributes': instance.attributes,
      'sku': instance.sku,
      'mrp': instance.mrp,
      'discountPrice': instance.discountPrice,
      'discountPercent': instance.discountPercent,
      'stock': instance.stock,
    };

_ProductDTO _$ProductDTOFromJson(Map<String, dynamic> json) => _ProductDTO(
  id: json['id'] as String,
  businessId: json['businessId'] as String,
  name: json['name'] as String,
  slug: json['slug'] as String,
  type: json['type'] as String,
  status: json['status'] as String,
  defaultPrice: (json['defaultPrice'] as num).toDouble(),
  defaultMrp: (json['defaultMrp'] as num).toDouble(),
  stockStatus: json['stockStatus'] as String,
  availableStock: (json['availableStock'] as num).toInt(),
  hasInventory: json['hasInventory'] as bool? ?? false,
  images:
      (json['images'] as List<dynamic>?)?.map((e) => e as String).toList() ??
      const [],
  variants:
      (json['variants'] as List<dynamic>?)
          ?.map((e) => VariantDTO.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  tags:
      (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ??
      const [],
  minOrderQty: (json['minOrderQty'] as num?)?.toInt() ?? 1,
  maxOrderQty: (json['maxOrderQty'] as num?)?.toInt() ?? 100,
  sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
  isFeatured: json['isFeatured'] as bool? ?? false,
  isPopular: json['isPopular'] as bool? ?? false,
  metadata: json['metadata'] as Map<String, dynamic>? ?? const {},
  categoryId: json['categoryId'] as String?,
  description: json['description'] as String?,
  shortDesc: json['shortDesc'] as String?,
  sku: json['sku'] as String?,
  unit: json['unit'] as String?,
  unitQuantity: json['unitQuantity'] as String?,
  workflowType: json['workflowType'] as String?,
  createdAt: json['createdAt'] as String?,
  updatedAt: json['updatedAt'] as String?,
  isVeg: json['isVeg'] as bool?,
  preparationTime: (json['preparationTime'] as num?)?.toInt(),
  category: json['category'] == null
      ? null
      : CategoryDTO.fromJson(json['category'] as Map<String, dynamic>),
);

Map<String, dynamic> _$ProductDTOToJson(_ProductDTO instance) =>
    <String, dynamic>{
      'id': instance.id,
      'businessId': instance.businessId,
      'name': instance.name,
      'slug': instance.slug,
      'type': instance.type,
      'status': instance.status,
      'defaultPrice': instance.defaultPrice,
      'defaultMrp': instance.defaultMrp,
      'stockStatus': instance.stockStatus,
      'availableStock': instance.availableStock,
      'hasInventory': instance.hasInventory,
      'images': instance.images,
      'variants': instance.variants,
      'tags': instance.tags,
      'minOrderQty': instance.minOrderQty,
      'maxOrderQty': instance.maxOrderQty,
      'sortOrder': instance.sortOrder,
      'isFeatured': instance.isFeatured,
      'isPopular': instance.isPopular,
      'metadata': instance.metadata,
      'categoryId': instance.categoryId,
      'description': instance.description,
      'shortDesc': instance.shortDesc,
      'sku': instance.sku,
      'unit': instance.unit,
      'unitQuantity': instance.unitQuantity,
      'workflowType': instance.workflowType,
      'createdAt': instance.createdAt,
      'updatedAt': instance.updatedAt,
      'isVeg': instance.isVeg,
      'preparationTime': instance.preparationTime,
      'category': instance.category,
    };

_ProductListResponse _$ProductListResponseFromJson(Map<String, dynamic> json) =>
    _ProductListResponse(
      data: (json['data'] as List<dynamic>)
          .map((e) => ProductDTO.fromJson(e as Map<String, dynamic>))
          .toList(),
      pagination: PaginationMeta.fromJson(
        json['pagination'] as Map<String, dynamic>,
      ),
      storeId: json['storeId'] as String?,
    );

Map<String, dynamic> _$ProductListResponseToJson(
  _ProductListResponse instance,
) => <String, dynamic>{
  'data': instance.data,
  'pagination': instance.pagination,
  'storeId': instance.storeId,
};

_PaginationMeta _$PaginationMetaFromJson(Map<String, dynamic> json) =>
    _PaginationMeta(
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
      total: (json['total'] as num).toInt(),
      totalPages: (json['totalPages'] as num).toInt(),
      hasNext: json['hasNext'] as bool,
      hasPrev: json['hasPrev'] as bool,
    );

Map<String, dynamic> _$PaginationMetaToJson(_PaginationMeta instance) =>
    <String, dynamic>{
      'page': instance.page,
      'limit': instance.limit,
      'total': instance.total,
      'totalPages': instance.totalPages,
      'hasNext': instance.hasNext,
      'hasPrev': instance.hasPrev,
    };
