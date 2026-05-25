import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/contracts/auth_dto.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/config/app_config.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(
    ref.read(dioClientProvider),
    ref.read(secureStorageProvider),
  );
});

class AuthService {
  AuthService(this._dio, this._storage);

  final DioClient _dio;
  final SecureStorageService _storage;

  Future<bool> sendOtp({required String email, String? storeId}) async {
    final response = await _dio.dio.post<Map<String, dynamic>>(
      ApiEndpoints.sendOtp,
      data: SendOtpRequest(
        email: email,
        businessId: AppConfig.businessId,
        storeId: storeId,
      ).toJson(),
    );
    return response.data?['success'] == true;
  }

  Future<AuthSession> verifyOtp({
    required String email,
    required String code,
    String? phone,
    String? name,
  }) async {
    final response = await _dio.dio.post<Map<String, dynamic>>(
      ApiEndpoints.verifyOtp,
      data: VerifyOtpRequest(
        email: email,
        code: code,
        businessId: AppConfig.businessId,
        storeId: AppConfig.storeId.isNotEmpty ? AppConfig.storeId : null,
        phone: phone,
        name: name,
      ).toJson(),
    );

    final session = AuthSession.fromJson(
      response.data!['data'] as Map<String, dynamic>,
    );

    await _storage.saveSession(
      token: session.token,
      expiresAt: session.expiresAt,
      userId: session.user.id,
      email: session.user.email,
      businessId: session.user.businessId,
      storeId: AppConfig.storeId,
      name: session.user.name,
      phone: session.user.phone,
    );

    return session;
  }

  Future<void> logout() async {
    final fcmToken = await _storage.fcmToken;
    if (fcmToken != null) {
      try {
        await _dio.delete(
          ApiEndpoints.devicesUnregister,
          queryParameters: {'fcmToken': fcmToken},
        );
      } catch (_) {}
    }
    await _storage.clearSession();
  }

  Future<bool> get isLoggedIn => _storage.hasValidSession;
}
