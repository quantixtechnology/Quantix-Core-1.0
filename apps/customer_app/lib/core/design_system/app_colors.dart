// ============================================================================
// AppColors — mirrors src/design-system/colors.ts
//
// Neutral and semantic colors used across all app screens.
// Brand colors (primary, secondary, accent) are injected at runtime via
// AppTheme.applyBranding() from the StoreContextDTO.
// ============================================================================

import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // ── Neutral palette ───────────────────────────────────────────────────
  static const Color neutral50  = Color(0xFFF9FAFB);
  static const Color neutral100 = Color(0xFFF3F4F6);
  static const Color neutral200 = Color(0xFFE5E7EB);
  static const Color neutral300 = Color(0xFFD1D5DB);
  static const Color neutral400 = Color(0xFF9CA3AF);
  static const Color neutral500 = Color(0xFF6B7280);
  static const Color neutral600 = Color(0xFF4B5563);
  static const Color neutral700 = Color(0xFF374151);
  static const Color neutral800 = Color(0xFF1F2937);
  static const Color neutral900 = Color(0xFF111827);

  // ── Semantic colors ───────────────────────────────────────────────────
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color error   = Color(0xFFEF4444);
  static const Color info    = Color(0xFF3B82F6);

  // ── Badge colors ──────────────────────────────────────────────────────
  static const Color vegBadge        = Color(0xFF22C55E);
  static const Color nonVegBadge     = Color(0xFFEF4444);
  static const Color halalBadge      = Color(0xFF059669);
  static const Color outOfStockBadge = Color(0xFF4B5563);

  // ── Helpers ───────────────────────────────────────────────────────────

  /// Returns the color with a given opacity (0.0–1.0)
  static Color withBrandAlpha(Color brand, double opacity) =>
      brand.withValues(alpha: opacity);

  /// Light tint for category/section backgrounds (10% opacity)
  static Color tint(Color brand) => brand.withValues(alpha: 0.10);

  /// Surface tint for icon backgrounds (30% opacity)
  static Color surface(Color brand) => brand.withValues(alpha: 0.30);
}
