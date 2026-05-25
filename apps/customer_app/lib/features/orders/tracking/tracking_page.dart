import 'package:flutter/material.dart';

// TODO Phase 2: implement screen
class TrackingPage extends StatelessWidget {
  const TrackingPage({super.key, required this.orderId});
  final String orderId;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('TrackingPage')),
      body: const Center(child: Text('TrackingPage — Phase 2')),
    );
  }
}
