import 'package:flutter/material.dart';

// TODO Phase 2: implement screen
class OrderDetailPage extends StatelessWidget {
  const OrderDetailPage({super.key, required this.orderId});
  final String orderId;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('OrderDetailPage')),
      body: const Center(child: Text('OrderDetailPage — Phase 2')),
    );
  }
}
