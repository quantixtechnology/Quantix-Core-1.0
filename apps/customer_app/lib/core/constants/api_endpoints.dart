// ============================================================================
// API Endpoints — mirrors openapi/customer-v1.yaml
// All paths are relative to AppConfig.apiV1
// ============================================================================

class ApiEndpoints {
  ApiEndpoints._();

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  static const String storeContext   = '/stores/context';
  static const String storesNearest  = '/stores/nearest';
  static const String appVersion     = '/app/version';

  // ── Auth ──────────────────────────────────────────────────────────────────
  /// Email-only customer existence check (step 1 of registration/login flow)
  static const String checkCustomer  = '/auth/check-customer';
  static const String sendOtp        = '/auth/send-otp';
  static const String verifyOtp      = '/auth/verify';
  static const String loginPassword  = '/auth/login-password';
  // Token-based forgot-password (sends a link, not a 6-digit OTP code)
  static const String forgotPassword    = '/auth/forgot-password';
  // Set password for the first time (Bearer refresh token required)
  static const String setPassword       = '/auth/set-password';
  // Legacy OTP reset — kept for backward compat but no longer used in UI
  static const String resetPasswordOtp  = '/auth/reset-password';

  // ── Profile ───────────────────────────────────────────────────────────────
  static const String profile = '/profile';

  // ── Addresses ─────────────────────────────────────────────────────────────
  static const String addresses = '/addresses';
  static String addressById(String id) => '/addresses/$id';

  // ── Catalog ───────────────────────────────────────────────────────────────
  static const String categories = '/categories';
  static const String products   = '/products';
  static String productById(String id) => '/products/$id';

  // ── Cart ──────────────────────────────────────────────────────────────────
  static const String cart    = '/cart';
  static const String coupons = '/coupons';

  // ── Orders / Checkout ─────────────────────────────────────────────────────
  static const String orders = '/orders';
  static String orderTrack(String id) => '/orders/$id/track';
  static String orderLive(String id)  => '/orders/$id/live';
  static String orderEta(String id)   => '/orders/$id/eta';

  // ── Notifications ─────────────────────────────────────────────────────────
  static const String notifications       = '/notifications';
  static const String notificationsReadAll = '/notifications/read-all';
  static String notificationRead(String id) => '/notifications/$id/read';

  // ── Devices ───────────────────────────────────────────────────────────────
  static const String devicesRegister   = '/devices/register';
  static const String devicesUnregister = '/devices/unregister';

  // ── CMS ───────────────────────────────────────────────────────────────────
  static const String banners     = '/storefront/banners';
  static const String promotions  = '/storefront/promotions';
}
