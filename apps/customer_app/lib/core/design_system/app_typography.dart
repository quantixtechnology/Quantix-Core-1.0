// ============================================================================
// AppTypography — mirrors src/design-system/typography.ts
//
// Pre-built TextStyle values for every text role in the app.
// Brand-colored text (price, links) should apply a colorScheme.primary
// override at the call site.
// ============================================================================

import 'package:flutter/material.dart';

class AppTypography {
  AppTypography._();

  // ── Section headings ──────────────────────────────────────────────────

  static const TextStyle sectionTitle = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: Color(0xFF111827),
  );

  static const TextStyle sectionSub = TextStyle(
    fontSize: 13,
    color: Color(0xFF6B7280),
  );

  // ── Card text ─────────────────────────────────────────────────────────

  static const TextStyle cardName = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: Color(0xFF111827),
  );

  static const TextStyle cardVariant = TextStyle(
    fontSize: 11,
    color: Color(0xFF9CA3AF),
  );

  static const TextStyle cardDesc = TextStyle(
    fontSize: 11,
    color: Color(0xFF6B7280),
  );

  static const TextStyle priceMain = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle priceStrike = TextStyle(
    fontSize: 11,
    color: Color(0xFF9CA3AF),
    decoration: TextDecoration.lineThrough,
  );

  // ── Badge labels ──────────────────────────────────────────────────────

  static const TextStyle badgeLabel = TextStyle(
    fontSize: 9,
    fontWeight: FontWeight.w700,
    color: Colors.white,
  );

  // ── Empty & error states ──────────────────────────────────────────────

  static const TextStyle emptyTitle = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: Color(0xFF6B7280),
  );

  static const TextStyle emptySub = TextStyle(
    fontSize: 14,
    color: Color(0xFF9CA3AF),
  );

  // ── Navigation ────────────────────────────────────────────────────────

  static const TextStyle navLabel = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w500,
    color: Color(0xFF374151),
  );

  static const TextStyle viewAll = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
  );

  // ── Banner ────────────────────────────────────────────────────────────

  static const TextStyle bannerTitle = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: Colors.white,
  );

  static const TextStyle bannerSub = TextStyle(
    fontSize: 13,
    color: Colors.white70,
  );
}
