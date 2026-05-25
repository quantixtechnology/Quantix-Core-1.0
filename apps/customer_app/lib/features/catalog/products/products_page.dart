import 'package:flutter/material.dart';

// TODO Phase 2: implement screen
class ProductsPage extends StatelessWidget {
  const ProductsPage({super.key, this.categoryId});
  final String? categoryId;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ProductsPage')),
      body: const Center(child: Text('ProductsPage — Phase 2')),
    );
  }
}
