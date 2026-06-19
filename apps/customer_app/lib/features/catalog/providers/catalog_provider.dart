import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/contracts/product_dto.dart';
import '../services/catalog_service.dart';

// ── Categories ─────────────────────────────────────────────────────────────

final categoriesProvider = FutureProvider.autoDispose<List<CategoryDTO>>((ref) {
  return ref.read(catalogServiceProvider).getCategories();
});

final selectedCategoryProvider = StateProvider<String?>((ref) => null);

// ── Product list with filter ───────────────────────────────────────────────

final productFilterProvider = StateProvider<ProductFilter>((ref) {
  return const ProductFilter();
});

final productsProvider = FutureProvider.autoDispose<ProductListResponse>((ref) {
  final filter = ref.watch(productFilterProvider);
  return ref.read(catalogServiceProvider).getProducts(filter);
});

// Tracks the page for infinite scroll
final productPageProvider = StateProvider<int>((ref) => 1);

// Accumulates pages of products for infinite scroll
final productListProvider =
    StateNotifierProvider<ProductListNotifier, AsyncValue<List<ProductDTO>>>((ref) {
  return ProductListNotifier(ref.read(catalogServiceProvider));
});

class ProductListNotifier extends StateNotifier<AsyncValue<List<ProductDTO>>> {
  ProductListNotifier(this._service) : super(const AsyncValue.data([]));

  final CatalogService _service;
  int _page = 1;
  bool _hasMore = true;
  String? _categoryId;
  String? _search;

  bool get hasMore => _hasMore;

  Future<void> load({String? categoryId, String? search, bool reset = false}) async {
    if (reset) {
      _page = 1;
      _hasMore = true;
      _categoryId = categoryId;
      _search = search;
      state = const AsyncValue.data([]);
    }

    if (!_hasMore) return;

    state = AsyncValue.loading();
    try {
      final result = await _service.getProducts(ProductFilter(
        page: _page,
        categoryId: _categoryId,
        search: _search,
      ));
      final prev = state.valueOrNull ?? [];
      state = AsyncValue.data([...prev, ...result.data]);
      _hasMore = result.pagination.hasNext;
      if (_hasMore) _page++;
    } catch (e, s) {
      state = AsyncValue.error(e, s);
    }
  }

  Future<void> loadMore() => load();
}

// ── Product detail ─────────────────────────────────────────────────────────

final productDetailProvider =
    FutureProvider.autoDispose.family<ProductDTO, String>((ref, productId) {
  return ref.read(catalogServiceProvider).getProduct(productId);
});
