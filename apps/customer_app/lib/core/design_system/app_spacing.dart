// ============================================================================
// AppSpacing — mirrors src/design-system/spacing.ts
//
// Consistent spatial rhythm for all app screens and widgets.
// ============================================================================

class AppSpacing {
  AppSpacing._();

  static const double xs   = 4;
  static const double sm   = 8;
  static const double md   = 12;
  static const double lg   = 16;
  static const double xl   = 20;
  static const double xl2  = 24;
  static const double xl3  = 32;
  static const double xl4  = 40;
  static const double xl5  = 48;
  static const double xl6  = 64;

  // ── Common padding bundles ────────────────────────────────────────────

  /// Standard page horizontal padding
  static const double pageH = lg;

  /// Inner product card padding
  static const double cardInner = sm;

  /// Gap between product grid items
  static const double gridGap = sm;

  /// Gap between category tiles
  static const double catGap = md;

  /// Standard section vertical padding
  static const double sectionV = xl4;
}
