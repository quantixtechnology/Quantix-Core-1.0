import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/contracts/cart_dto.dart';
import '../../../core/config/app_config.dart';
import '../../../core/utils/image_url_utils.dart';
import '../../../core/widgets/product_image_widget.dart';
import '../../../core/constants/route_paths.dart';
import '../../cart/providers/cart_provider.dart';
import '../providers/catalog_provider.dart';

class ProductDetailPage extends ConsumerStatefulWidget {
  const ProductDetailPage({super.key, required this.productId});

  final String productId;

  @override
  ConsumerState<ProductDetailPage> createState() => _ProductDetailPageState();
}

class _ProductDetailPageState extends ConsumerState<ProductDetailPage> {
  int _activeImage  = 0;
  String? _variantId;
  int _qty          = 1;
  bool _addedToCart = false;

  @override
  Widget build(BuildContext context) {
    final productAsync = ref.watch(productDetailProvider(widget.productId));
    final primary      = Theme.of(context).colorScheme.primary;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Product'),
        actions: [
          IconButton(
            icon: const Icon(Icons.shopping_cart_outlined),
            onPressed: () => context.push(RoutePaths.cart),
          ),
        ],
      ),
      body: productAsync.when(
        data: (product) {
          final images   = ImageUrlUtils.resolveAll(product.images);
          final variants = product.variants;
          final selected = variants.firstWhere(
            (v) => v.id == (_variantId ?? ''),
            orElse: () => variants.firstWhere(
              (v) => v.isDefault,
              orElse: () => variants.first,
            ),
          );
          final price   = selected.price;
          final mrp     = selected.mrp ?? 0.0;
          final hasDisc = mrp > price && mrp > 0;
          final discPct = hasDisc ? ((mrp - price) / mrp * 100).round() : 0;

          return Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── Main image ─────────────────────────────────
                      AspectRatio(
                        aspectRatio: 1,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: ProductImageWidget(
                            imageUrl: images.isNotEmpty
                                ? images[_activeImage]
                                : null,
                            width: double.infinity,
                            borderRadius: 0,
                          ),
                        ),
                      ),

                      // ── Thumbnail strip ─────────────────────────────
                      if (images.length > 1) ...[
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 64,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: images.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(width: 8),
                            itemBuilder: (_, i) => GestureDetector(
                              onTap: () =>
                                  setState(() => _activeImage = i),
                              child: Container(
                                width: 64,
                                height: 64,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: _activeImage == i
                                        ? primary
                                        : Colors.grey.shade200,
                                    width: _activeImage == i ? 2 : 1,
                                  ),
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(9),
                                  child: ProductImageWidget(
                                    imageUrl: images[i],
                                    width: 64,
                                    height: 64,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],

                      const SizedBox(height: 20),

                      // ── Name & discount badge ───────────────────────
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              product.name,
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          if (hasDisc)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: primary,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                '$discPct% OFF',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                        ],
                      ),

                      // ── Price ───────────────────────────────────────
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Text(
                            '₹${price.toStringAsFixed(0)}',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: primary,
                            ),
                          ),
                          if (hasDisc) ...[
                            const SizedBox(width: 8),
                            Text(
                              '₹${mrp.toStringAsFixed(0)}',
                              style: const TextStyle(
                                fontSize: 15,
                                color: Colors.grey,
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                          ],
                        ],
                      ),

                      // ── Dietary indicator ───────────────────────────
                      if (product.isVeg != null) ...[
                        const SizedBox(height: 10),
                        _VegBadge(isVeg: product.isVeg!),
                      ],

                      // ── Description ─────────────────────────────────
                      if (product.description != null) ...[
                        const SizedBox(height: 16),
                        Text(
                          product.description!,
                          style: TextStyle(
                            color: Colors.grey.shade700,
                            height: 1.5,
                          ),
                        ),
                      ],

                      // ── Variant selector ────────────────────────────
                      if (variants.length > 1) ...[
                        const SizedBox(height: 20),
                        Text(
                          'Options',
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: variants.map((v) {
                            final isActive = selected.id == v.id;
                            return GestureDetector(
                              onTap: () =>
                                  setState(() => _variantId = v.id),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: isActive
                                      ? primary
                                      : Colors.white,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: isActive
                                        ? primary
                                        : Colors.grey.shade300,
                                  ),
                                ),
                                child: Text(
                                  v.name,
                                  style: TextStyle(
                                    color: isActive
                                        ? Colors.white
                                        : Colors.black,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // ── Add to cart bar ────────────────────────────────────────
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  child: Row(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey.shade300),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove, size: 18),
                              onPressed: _qty > 1
                                  ? () => setState(() => _qty--)
                                  : null,
                            ),
                            Text(
                              '$_qty',
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold),
                            ),
                            IconButton(
                              icon: const Icon(Icons.add, size: 18),
                              onPressed: () => setState(() => _qty++),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          icon: Icon(_addedToCart
                              ? Icons.check
                              : Icons.shopping_cart_outlined),
                          label: Text(
                              _addedToCart ? 'Added!' : 'Add to Cart'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor:
                                _addedToCart ? Colors.green : primary,
                            foregroundColor: Colors.white,
                            minimumSize: const Size(0, 52),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed:
                              product.stockStatus == 'OUT_OF_STOCK'
                                  ? null
                                  : () async {
                                      await ref
                                          .read(cartProvider.notifier)
                                          .addItem(
                                            AddToCartRequest(
                                              productId: product.id,
                                              storeId: AppConfig.storeId,
                                              variantId: selected.id,
                                              quantity: _qty,
                                            ),
                                          );
                                      if (!mounted) return;
                                      setState(
                                          () => _addedToCart = true);
                                      Future.delayed(
                                        const Duration(seconds: 2),
                                        () {
                                          if (mounted) {
                                            setState(() =>
                                                _addedToCart = false);
                                          }
                                        },
                                      );
                                    },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
        loading: () =>
            const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}

/// Horizontal veg/non-veg badge row for the product detail screen.
class _VegBadge extends StatelessWidget {
  const _VegBadge({required this.isVeg});

  final bool isVeg;

  @override
  Widget build(BuildContext context) {
    final color = isVeg ? const Color(0xFF16A34A) : const Color(0xFFDC2626);
    final label = isVeg ? 'VEG' : 'NON-VEG';
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: color, width: 2),
            borderRadius: BorderRadius.circular(3),
          ),
          child: Center(
            child: Container(
              width: 9,
              height: 9,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ],
    );
  }
}
