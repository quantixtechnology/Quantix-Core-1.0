import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/config/app_config.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/constants/storage_keys.dart';
import '../../../core/contracts/product_dto.dart';
import '../../../core/storage/hive_storage.dart';

final catalogServiceProvider = Provider<CatalogService>((ref) {
  return CatalogService(ref.read(dioClientProvider));
});

class ProductFilter {
  const ProductFilter({
    this.categoryId,
    this.search,
    this.page = 1,
    this.limit = 20,
    this.filterByStore = true,
  });

  final String? categoryId;
  final String? search;
  final int page;
  final int limit;
  final bool filterByStore;
}

class CatalogService {
  CatalogService(this._dio);

  final DioClient _dio;

  Future<List<CategoryDTO>> getCategories({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = HiveStorage.get<List<CategoryDTO>>(
        StorageKeys.boxCategories,
        'categories',
        AppConfig.ttlCategories,
        (j) => (j as List).map((e) => CategoryDTO.fromJson(e as Map<String, dynamic>)).toList(),
      );
      if (cached != null) return cached;
    }

    final data = await _dio.get<List<dynamic>>(
      ApiEndpoints.categories,
      queryParameters: {'businessId': AppConfig.businessId},
    );

    final cats = (data)
        .map((e) => CategoryDTO.fromJson(e as Map<String, dynamic>))
        .toList();
    await HiveStorage.put(StorageKeys.boxCategories, 'categories', data);
    return cats;
  }

  Future<ProductListResponse> getProducts(ProductFilter filter) async {
    final response = await _dio.dio.get<Map<String, dynamic>>(
      ApiEndpoints.products,
      queryParameters: {
        'businessId': AppConfig.businessId,
        'storeId': AppConfig.storeId,
        'filterByStore': filter.filterByStore,
        'page': filter.page,
        'limit': filter.limit,
        if (filter.categoryId != null) 'categoryId': filter.categoryId,
        if (filter.search != null && filter.search!.isNotEmpty) 'search': filter.search,
      },
    );

    final body = response.data!;
    return ProductListResponse(
      data: (body['data'] as List)
          .map((e) => ProductDTO.fromJson(e as Map<String, dynamic>))
          .toList(),
      pagination: PaginationMeta.fromJson(body['pagination'] as Map<String, dynamic>),
      storeId: body['storeId'] as String?,
    );
  }

  Future<ProductDTO> getProduct(String productId) async {
    final data = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.productById(productId),
    );
    return ProductDTO.fromJson(data);
  }
}
