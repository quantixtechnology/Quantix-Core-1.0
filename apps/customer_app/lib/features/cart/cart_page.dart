import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/utils/image_url_utils.dart';
import '../../core/widgets/product_image_widget.dart';
import '../../core/constants/route_paths.dart';
import 'providers/cart_provider.dart';

class CartPage extends ConsumerWidget {
  const CartPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartState = ref.watch(cartProvider);
    final primary   = Theme.of(context).colorScheme.primary;

    if (cartState.isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final items = cartState.cart?.data ?? [];

    return Scaffold(
      appBar: AppBar(title: Text('Cart (${cartState.itemCount})')),
      body: items.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.shopping_cart_outlined,
                      size: 72, color: Colors.grey.shade300),
                  const SizedBox(height: 16),
                  const Text(
                    'Your cart is empty',
                    style: TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Browse products and add them to cart',
                    style: TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () => context.go(RoutePaths.catalog),
                    child: const Text('Shop Now'),
                  ),
                ],
              ),
            )
          : Column(
              children: [
                // ── Items list ─────────────────────────────────────────
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: items.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: 12),
                    itemBuilder: (_, i) {
                      final item        = items[i];
                      final imgUrl      = ImageUrlUtils.resolve(
                        item.product.images.firstOrNull,
                      );
                      final variantLabel =
                          item.variant?.name != 'Default'
                              ? item.variant?.name
                              : null;

                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: Colors.grey.shade100),
                        ),
                        child: Row(
                          children: [
                            // Product image via shared widget
                            ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: ProductImageWidget(
                                imageUrl: imgUrl,
                                width: 72,
                                height: 72,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.product.name,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (variantLabel != null)
                                    Text(
                                      variantLabel,
                                      style: const TextStyle(
                                        color: Colors.grey,
                                        fontSize: 12,
                                      ),
                                    ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '₹${item.lineTotal.toStringAsFixed(0)}',
                                    style: TextStyle(
                                      color: primary,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // Quantity stepper
                            Column(
                              children: [
                                _StepBtn(
                                  icon: Icons.add,
                                  filled: true,
                                  color: primary,
                                  onTap: () => ref
                                      .read(cartProvider.notifier)
                                      .updateQuantity(
                                          item.id, item.quantity + 1),
                                ),
                                const SizedBox(height: 4),
                                Text('${item.quantity}',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold)),
                                const SizedBox(height: 4),
                                _StepBtn(
                                  icon: item.quantity == 1
                                      ? Icons.delete_outline
                                      : Icons.remove,
                                  filled: false,
                                  color: item.quantity == 1
                                      ? Colors.red
                                      : Colors.grey.shade600,
                                  onTap: () => ref
                                      .read(cartProvider.notifier)
                                      .updateQuantity(
                                          item.id, item.quantity - 1),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),

                // ── Summary + checkout ─────────────────────────────────
                SafeArea(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border(
                        top: BorderSide(color: Colors.grey.shade200),
                      ),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment:
                              MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Subtotal',
                                style: TextStyle(color: Colors.grey)),
                            Text(
                              '₹${cartState.total.toStringAsFixed(0)}',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: () =>
                              context.push(RoutePaths.checkout),
                          child: Text(
                            'Proceed to Checkout'
                            '  ₹${cartState.total.toStringAsFixed(0)}',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _StepBtn extends StatelessWidget {
  const _StepBtn({
    required this.icon,
    required this.filled,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final bool filled;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: filled ? color : Colors.transparent,
          border: filled ? null : Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 16, color: filled ? Colors.white : color),
      ),
    );
  }
}
