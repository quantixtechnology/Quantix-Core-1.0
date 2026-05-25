// ============================================================================
// AppConfig — single source of truth for environment-specific values.
// Set via --dart-define at build time:
//   flutter run --dart-define=BASE_URL=https://app.quantixtechnology.in
// ============================================================================

class AppConfig {
  AppConfig._();

  // ── API ───────────────────────────────────────────────────────────────────
  static const String baseUrl = String.fromEnvironment(
    'BASE_URL',
    defaultValue: 'https://app.quantixtechnology.in',
  );
  static const String apiV1 = '$baseUrl/api/v1';

  // ── Tenant (injected at runtime after bootstrap) ─────────────────────────
  // These are set once on app launch and never change within a session.
  static String businessId = '';
  static String storeId = '';

  // ── Realtime ─────────────────────────────────────────────────────────────
  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'https://app.quantixtechnology.in',
  );
  static const int socketPort = int.fromEnvironment('SOCKET_PORT', defaultValue: 3003);

  // ── Google Maps ───────────────────────────────────────────────────────────
  static const String googleMapsKey = String.fromEnvironment('GOOGLE_MAPS_KEY', defaultValue: '');

  // ── App ───────────────────────────────────────────────────────────────────
  static const String appName = String.fromEnvironment('APP_NAME', defaultValue: 'Quantix');
  static const bool isDebug = bool.fromEnvironment('dart.vm.product') == false;

  // ── Cache TTL (seconds) ───────────────────────────────────────────────────
  static const int ttlContext = 900;    // 15 min — store context
  static const int ttlBanners = 300;    // 5 min — home banners
  static const int ttlCategories = 600; // 10 min — category tree
  static const int ttlProducts = 120;   // 2 min — product list
  static const int ttlOrders = 120;     // 2 min — order list
}
