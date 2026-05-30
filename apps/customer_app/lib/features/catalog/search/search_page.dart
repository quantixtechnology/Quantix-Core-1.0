import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/contracts/product_dto.dart';
import '../../../core/utils/image_url_utils.dart';
import '../../../core/widgets/product_image_widget.dart';
import '../../../core/constants/route_paths.dart';
import '../providers/catalog_provider.dart';

class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key});

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final _controller = TextEditingController();
  String _query     = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _search(String q) {
    setState(() => _query = q.trim());
    if (_query.isNotEmpty) {
      ref
          .read(productListProvider.notifier)
          .load(search: _query, reset: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final resultsAsync = ref.watch(productListProvider);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Search products…',
            border: InputBorder.none,
            contentPadding: EdgeInsets.symmetric(horizontal: 8),
          ),
          textInputAction: TextInputAction.search,
          onSubmitted: _search,
          onChanged: (v) {
            if (v.isEmpty) setState(() => _query = '');
          },
        ),
        actions: [
          if (_query.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.clear),
              onPressed: () {
                _controller.clear();
                setState(() => _query = '');
              },
            ),
        ],
      ),
      body: _query.isEmpty
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.search, size: 64, color: Colors.grey),
                  SizedBox(height: 12),
                  Text(
                    'Search for products',
                    style: TextStyle(color: Colors.grey),
                  ),
                ],
              ),
            )
          : resultsAsync.when(
              data: (products) {
                if (products.isEmpty) {
                  return Center(
                    child: Text('No results for "$_query"'),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: products.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (_, i) =>
                      _SearchResultTile(product: products[i]),
                );
              },
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
            ),
    );
  }
}

// ── Search result row ─────────────────────────────────────────────────────────

class _SearchResultTile extends StatelessWidget {
  const _SearchResultTile({required this.product});

  final ProductDTO product;

  @override
  Widget build(BuildContext context) {
    final imgUrl  = ImageUrlUtils.resolve(product.images.firstOrNull);
    final primary = Theme.of(context).colorScheme.primary;
    final price   = product.defaultPrice;
    final mrp     = product.defaultMrp;
    final hasDisc = mrp > price && mrp > 0;

    return ListTile(
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 0, vertical: 4),
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: ProductImageWidget(
          imageUrl: imgUrl,
          width: 64,
          height: 64,
          borderRadius: 0,
        ),
      ),
      title: Text(
        product.name,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Row(
        children: [
          Text(
            '₹${price.toStringAsFixed(0)}',
            style: TextStyle(
              color: primary,
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
          if (hasDisc) ...[
            const SizedBox(width: 6),
            Text(
              '₹${mrp.toStringAsFixed(0)}',
              style: const TextStyle(
                color: Colors.grey,
                fontSize: 12,
                decoration: TextDecoration.lineThrough,
              ),
            ),
          ],
        ],
      ),
      onTap: () => context.push(RoutePaths.product(product.id)),
    );
  }
}
