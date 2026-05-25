class StorageKeys {
  StorageKeys._();

  // ── Secure storage (FlutterSecureStorage) ─────────────────────────────────
  static const String jwtToken     = 'jwt_token';
  static const String expiresAt    = 'expires_at';
  static const String userId       = 'user_id';
  static const String userEmail    = 'user_email';
  static const String userName     = 'user_name';
  static const String userPhone    = 'user_phone';
  static const String businessId   = 'business_id';
  static const String storeId      = 'store_id';
  static const String fcmToken     = 'fcm_token';

  // ── Hive box names ────────────────────────────────────────────────────────
  static const String boxContext      = 'cache_context';
  static const String boxBanners      = 'cache_banners';
  static const String boxCategories   = 'cache_categories';
  static const String boxProducts     = 'cache_products';
  static const String boxOrders       = 'cache_orders';
  static const String boxProfile      = 'cache_profile';
  static const String boxNotifications = 'cache_notifications';
  static const String boxMeta         = 'cache_meta';  // TTL timestamps

  // ── Hive keys within boxes ────────────────────────────────────────────────
  static const String keyData      = 'data';
  static const String keyCachedAt  = 'cached_at';
}
