import 'package:flutter/material.dart';

// TODO Phase 2: implement screen
class ProductDetailPage extends StatelessWidget {
  const ProductDetailPage({super.key, required this.productId});
  final String productId;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ProductDetailPage')),
      body: const Center(child: Text('ProductDetailPage — Phase 2')),
    );
  }
}
