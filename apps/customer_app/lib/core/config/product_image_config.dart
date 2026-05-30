// ============================================================================
// ProductImageConfig — Flutter mirror of src/config/product-image-config.ts
//
// Defines platform-wide defaults for every product image surface.
// Passed to ProductImageWidget so there are no magic numbers in UI code.
//
// Business admins can supply overrides via ecommerceConfig.imageConfig in
// their business settings.  The StoreContextDTO carries this config at
// bootstrap; pass it to ProductImageWidget via the config: param.
// ============================================================================

import 'package:flutter/material.dart';

class ProductImageConfig {
  const ProductImageConfig({
    this.cardHeight    = 120.0,
    this.padding       = 8.0,
    this.borderRadius  = 0.0,
    this.backgroundColor = Colors.white,
    this.fit           = BoxFit.contain,
    this.fallbackEmoji = '📦',
  });

  /// Product card image zone height in logical pixels (= h-28 equivalent)
  final double cardHeight;

  /// Inner padding around the image in logical pixels
  final double padding;

  /// Image container border-radius in logical pixels
  final double borderRadius;

  /// Background color for the image container
  final Color backgroundColor;

  /// How the image fills the container
  final BoxFit fit;

  /// Emoji shown when no image URL is provided or on load error
  final String fallbackEmoji;

  // ── Platform defaults ─────────────────────────────────────────────────────

  static const ProductImageConfig platform = ProductImageConfig();

  // ── Business override constructor ─────────────────────────────────────────
  // Merges a partial JSON map from ecommerceConfig.imageConfig onto defaults.
  // Missing keys fall back to the platform values.

  factory ProductImageConfig.fromMap(Map<String, dynamic>? map) {
    if (map == null || map.isEmpty) return platform;
    return ProductImageConfig(
      cardHeight:      (map['cardHeight']    as num?)?.toDouble() ?? platform.cardHeight,
      padding:         (map['padding']       as num?)?.toDouble() ?? platform.padding,
      borderRadius:    (map['borderRadius']  as num?)?.toDouble() ?? platform.borderRadius,
      fit: _fitFromString(map['fitMode'] as String?) ?? platform.fit,
      fallbackEmoji:   (map['fallbackEmoji'] as String?) ?? platform.fallbackEmoji,
    );
  }

  static BoxFit? _fitFromString(String? value) {
    switch (value) {
      case 'contain': return BoxFit.contain;
      case 'cover':   return BoxFit.cover;
      default:        return null;
    }
  }

  // ── copyWith ──────────────────────────────────────────────────────────────

  ProductImageConfig copyWith({
    double? cardHeight,
    double? padding,
    double? borderRadius,
    Color? backgroundColor,
    BoxFit? fit,
    String? fallbackEmoji,
  }) {
    return ProductImageConfig(
      cardHeight:      cardHeight      ?? this.cardHeight,
      padding:         padding         ?? this.padding,
      borderRadius:    borderRadius    ?? this.borderRadius,
      backgroundColor: backgroundColor ?? this.backgroundColor,
      fit:             fit             ?? this.fit,
      fallbackEmoji:   fallbackEmoji   ?? this.fallbackEmoji,
    );
  }
}
