import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';
import '../config/app_config.dart';
import '../constants/storage_keys.dart';
import '../exceptions/app_exception.dart';
import '../storage/secure_storage.dart';

// ============================================================================
// DioClient — single Dio instance for the entire app.
// Interceptors (in order):
//   1. TenantInterceptor  — adds x-business-id + x-store-id headers
//   2. AuthInterceptor    — adds Authorization: Bearer <jwt>
//   3. ErrorInterceptor   — maps DioException → AppException
//   4. PrettyDioLogger    — debug logging (debug builds only)
// ============================================================================

final dioClientProvider = Provider<DioClient>((ref) {
  final secureStorage = ref.read(secureStorageProvider);
  return DioClient(secureStorage);
});

class DioClient {
  DioClient(this._secureStorage) {
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiV1,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    _dio.interceptors.addAll([
      TenantInterceptor(),
      AuthInterceptor(_secureStorage),
      ErrorInterceptor(),
      if (AppConfig.isDebug)
        PrettyDioLogger(
          requestHeader: false,
          requestBody: true,
          responseBody: true,
          error: true,
          compact: true,
        ),
    ]);
  }

  final SecureStorageService _secureStorage;
  late final Dio _dio;

  Dio get dio => _dio;

  // ── Convenience wrappers ────────────────────────────────────────────────

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(path, queryParameters: queryParameters);
    final data = (res.data!['data']);
    return fromJson != null ? fromJson(data) : data as T;
  }

  Future<T> post<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(path, data: data);
    final body = (res.data!['data']);
    return fromJson != null ? fromJson(body) : body as T;
  }

  Future<T> patch<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
  }) async {
    final res = await _dio.patch<Map<String, dynamic>>(path, data: data);
    final body = (res.data!['data']);
    return fromJson != null ? fromJson(body) : body as T;
  }

  Future<T> put<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
  }) async {
    final res = await _dio.put<Map<String, dynamic>>(path, data: data);
    final body = (res.data!['data']);
    return fromJson != null ? fromJson(body) : body as T;
  }

  Future<void> delete(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    await _dio.delete<Map<String, dynamic>>(path, queryParameters: queryParameters);
  }
}

// ── TenantInterceptor ───────────────────────────────────────────────────────

class TenantInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (AppConfig.businessId.isNotEmpty) {
      options.headers['x-business-id'] = AppConfig.businessId;
    }
    if (AppConfig.storeId.isNotEmpty) {
      options.headers['x-store-id'] = AppConfig.storeId;
    }
    handler.next(options);
  }
}

// ── AuthInterceptor ─────────────────────────────────────────────────────────

class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._storage);
  final SecureStorageService _storage;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _storage.token;
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Token invalid/expired — the app router redirects to /login
      // via the auth provider's state change.
      handler.next(err);
      return;
    }
    handler.next(err);
  }
}

// ── ErrorInterceptor ────────────────────────────────────────────────────────

class ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final exception = _map(err);
    handler.reject(DioException(
      requestOptions: err.requestOptions,
      error: exception,
      message: exception.message,
    ));
  }

  AppException _map(DioException err) {
    if (err.type == DioExceptionType.connectionError ||
        err.type == DioExceptionType.unknown) {
      return const NetworkException();
    }

    final statusCode = err.response?.statusCode ?? 0;
    final body = err.response?.data as Map<String, dynamic>?;
    final message = body?['error'] as String? ?? err.message ?? 'Unknown error';
    final code = body?['code'] as String?;

    return switch (statusCode) {
      401 => const UnauthorizedException(),
      429 => const RateLimitException(),
      422 when code == StorageKeys.jwtToken => OutOfStockException(
          productId: body?['productId'] as String? ?? '',
          availableQty: body?['availableQty'] as int? ?? 0,
          requestedQty: body?['requestedQty'] as int? ?? 0,
          productName: message,
        ),
      >= 500 => const ServerException(),
      _ => ApiException(message, statusCode: statusCode, code: code),
    };
  }
}
