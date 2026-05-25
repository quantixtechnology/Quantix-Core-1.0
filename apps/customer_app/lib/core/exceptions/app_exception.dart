// ============================================================================
// AppException hierarchy — all API and app errors funnel through here.
// ============================================================================

sealed class AppException implements Exception {
  const AppException(this.message);
  final String message;

  @override
  String toString() => message;
}

// HTTP 4xx — server rejected the request (bad input, auth, etc.)
final class ApiException extends AppException {
  const ApiException(super.message, {required this.statusCode, this.code});
  final int statusCode;
  final String? code; // e.g. "OUT_OF_STOCK"
}

// HTTP 401 — JWT expired or invalid
final class UnauthorizedException extends AppException {
  const UnauthorizedException([super.message = 'Session expired. Please log in again.']);
}

// HTTP 429 — rate limit
final class RateLimitException extends AppException {
  const RateLimitException([super.message = 'Too many requests. Please wait and try again.']);
}

// Network connectivity
final class NetworkException extends AppException {
  const NetworkException([super.message = 'No internet connection.']);
}

// Server 5xx
final class ServerException extends AppException {
  const ServerException([super.message = 'Something went wrong on our end. Please try again.']);
}

// Checkout: product went out of stock between cart and checkout
final class OutOfStockException extends AppException {
  const OutOfStockException({
    required this.productId,
    required this.availableQty,
    required this.requestedQty,
    required String productName,
  }) : super('"$productName" is out of stock. Available: $availableQty');
  final String productId;
  final int availableQty;
  final int requestedQty;
}

// Promo code validation failures
final class PromoException extends AppException {
  const PromoException(super.message);
}

// Location / GPS
final class LocationException extends AppException {
  const LocationException([super.message = 'Unable to get your location.']);
}

// Cache miss (caller should fetch from network)
final class CacheMissException extends AppException {
  const CacheMissException([super.message = 'Cache miss']);
}
