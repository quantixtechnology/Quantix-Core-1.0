import 'package:flutter/material.dart';

// TODO Phase 2: implement screen
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('HomePage')),
      body: const Center(child: Text('HomePage — Phase 2')),
    );
  }
}
