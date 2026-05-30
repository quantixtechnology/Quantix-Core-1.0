// ============================================================================
// ProductImageWidget — shared image renderer for all product surfaces.
//
// Design decisions:
//   • BoxFit.contain   — never crops the product; shows full item shape
//   • White background — product stands out against a clean container
//   • Padding          — breathing room around the image
//   • CachedNetworkImage — disk/memory cache, no repeat downloads
//   • Shimmer loading  — matches the app's skeleton UI pattern
//   • Error placeholder — emoji or icon, configurable per call site
//
// Usage:
//   ProductImageWidget(imageUrl: product.images.firstOrNull)
//   ProductImageWidget(imageUrl: url, width: 64, height: 64)
//   ProductImageWidget(imageUrl: url, borderRadius: 8, fallbackEmoji: '🥩')
// ============================================================================

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

class ProductImageWidget extends StatelessWidget {
  const ProductImageWidget({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
    this.borderRadius = 0.0,
    this.padding = const EdgeInsets.all(8),
    this.fallbackEmoji = '📦',
    this.backgroundColor = Colors.white,
  });

  final String? imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final double borderRadius;
  final EdgeInsets padding;
  final String fallbackEmoji;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    final effectiveRadius = BorderRadius.circular(borderRadius);

    if (imageUrl == null || imageUrl!.isEmpty) {
      return _Placeholder(
        width: width,
        height: height,
        borderRadius: effectiveRadius,
        emoji: fallbackEmoji,
      );
    }

    return ClipRRect(
      borderRadius: effectiveRadius,
      child: Container(
        width: width,
        height: height,
        color: backgroundColor,
        padding: padding,
        child: CachedNetworkImage(
          imageUrl: imageUrl!,
          fit: fit,
          placeholder: (context, url) => _Shimmer(width: width, height: height),
          errorWidget: (context, url, error) => _Placeholder(
            width: width,
            height: height,
            borderRadius: BorderRadius.zero,
            emoji: fallbackEmoji,
          ),
        ),
      ),
    );
  }
}

// ── Internal shimmer loading skeleton ────────────────────────────────────────

class _Shimmer extends StatelessWidget {
  const _Shimmer({this.width, this.height});

  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey.shade200,
      highlightColor: Colors.grey.shade50,
      child: Container(
        width: width,
        height: height,
        color: Colors.white,
      ),
    );
  }
}

// ── Internal emoji placeholder ────────────────────────────────────────────────

class _Placeholder extends StatelessWidget {
  const _Placeholder({
    this.width,
    this.height,
    required this.borderRadius,
    required this.emoji,
  });

  final double? width;
  final double? height;
  final BorderRadius borderRadius;
  final String emoji;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: borderRadius,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Colors.grey.shade100, Colors.grey.shade50],
          ),
        ),
        child: Center(
          child: Text(
            emoji,
            style: TextStyle(fontSize: (height != null && height! < 60) ? 20 : 40),
          ),
        ),
      ),
    );
  }
}
