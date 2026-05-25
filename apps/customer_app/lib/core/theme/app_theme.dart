import 'package:flutter/material.dart';

// ============================================================================
// AppTheme — white-label ready.
// Primary color is populated from BusinessBranding.primaryColor at runtime.
// ============================================================================

class AppTheme {
  AppTheme._();

  // Default brand color (overridden from StoreContext after bootstrap)
  static Color _primary = const Color(0xFF10B981); // Emerald
  static Color _secondary = const Color(0xFF0F172A);

  static void applyBranding({
    required String? primaryColor,
    required String? secondaryColor,
  }) {
    if (primaryColor != null) {
      _primary = _hexToColor(primaryColor) ?? _primary;
    }
    if (secondaryColor != null) {
      _secondary = _hexToColor(secondaryColor) ?? _secondary;
    }
  }

  static Color? _hexToColor(String hex) {
    try {
      final clean = hex.replaceAll('#', '');
      return Color(int.parse('FF$clean', radix: 16));
    } catch (_) {
      return null;
    }
  }

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _primary,
          brightness: Brightness.light,
        ),
        fontFamily: 'Inter',
        appBarTheme: AppBarTheme(
          elevation: 0,
          centerTitle: false,
          backgroundColor: Colors.white,
          foregroundColor: _secondary,
          titleTextStyle: TextStyle(
            color: _secondary,
            fontSize: 18,
            fontWeight: FontWeight.w600,
            fontFamily: 'Inter',
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: _primary,
            foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              fontFamily: 'Inter',
            ),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFF8FAFC),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: _primary, width: 2),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
        cardTheme: CardTheme(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
          color: Colors.white,
        ),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
      );

  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _primary,
          brightness: Brightness.dark,
        ),
        fontFamily: 'Inter',
        scaffoldBackgroundColor: const Color(0xFF0F172A),
      );
}

// ── Semantic colors ────────────────────────────────────────────────────────

class AppColors {
  AppColors._();

  static const Color success  = Color(0xFF10B981);
  static const Color warning  = Color(0xFFF59E0B);
  static const Color error    = Color(0xFFEF4444);
  static const Color info     = Color(0xFF3B82F6);
  static const Color grey50   = Color(0xFFF8FAFC);
  static const Color grey100  = Color(0xFFF1F5F9);
  static const Color grey200  = Color(0xFFE2E8F0);
  static const Color grey500  = Color(0xFF64748B);
  static const Color grey900  = Color(0xFF0F172A);

  // Order status colors
  static Color orderStatusColor(String status) => switch (status) {
    'PENDING'           => warning,
    'CONFIRMED'         => info,
    'PREPARING'         => const Color(0xFF8B5CF6),
    'READY'             => const Color(0xFF06B6D4),
    'OUT_FOR_DELIVERY'  => const Color(0xFFF97316),
    'DELIVERED'         => success,
    'CANCELLED'         => error,
    'FAILED'            => error,
    _                   => grey500,
  };
}
