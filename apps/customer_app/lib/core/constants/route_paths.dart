class RoutePaths {
  RoutePaths._();

  static const String splash         = '/';
  static const String login          = '/login';
  static const String otp            = '/otp';
  static const String home           = '/home';
  static const String catalog        = '/catalog';
  static const String search         = '/search';
  static String product(String id)   => '/product/$id';
  static const String productParam   = '/product/:id';
  static const String cart           = '/cart';
  static const String checkout       = '/checkout';
  static const String orders         = '/orders';
  static String orderDetail(String id) => '/orders/$id';
  static const String orderParam     = '/orders/:id';
  static String tracking(String id)  => '/tracking/$id';
  static const String trackingParam  = '/tracking/:id';
  static const String profile        = '/profile';
  static const String addresses      = '/profile/addresses';
  static const String loyalty        = '/profile/loyalty';
  static const String profileSettings = '/profile/settings';
  static const String notifications  = '/notifications';
}
