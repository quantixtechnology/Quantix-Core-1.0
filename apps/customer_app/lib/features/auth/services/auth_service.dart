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

// ── Customer check result ─────────────────────────────────────────────────────

class CustomerCheckResult {
  const CustomerCheckResult({
    required this.exists,
    required this.hasPassword,
  });

  final bool exists;
  final bool hasPassword;
}

// ── Auth service ──────────────────────────────────────────────────────────────

class AuthService {
  AuthService(this._dio, this._storage);

  final DioClient _dio;
  final SecureStorageService _storage;

  /// Step 1 of the new auth flow: check whether a customer with this email
  /// already exists for the configured business.
  ///
  /// Returns [CustomerCheckResult] with:
  ///   exists=false  → show registration form
  ///   exists=true, hasPassword=false  → send OTP immediately
  ///   exists=true, hasPassword=true   → show OTP | Password login tabs
  Future<CustomerCheckResult> checkCustomer(String email) async {
    final response = await _dio.dio.post<Map<String, dynamic>>(
      ApiEndpoints.checkCustomer,
      data: {
        'email':      email.trim().toLowerCase(),
        'businessId': AppConfig.businessId,
      },
    );

    final data = response.data!;
    if (data['success'] != true) {
      throw Exception(data['error'] ?? 'Customer check failed');
    }

    return CustomerCheckResult(
      exists:      data['exists']      as bool? ?? false,
      hasPassword: data['hasPassword'] as bool? ?? false,
    );
  }

  /// Send an OTP to the given email address.
  Future<bool> sendOtp({required String email, String? storeId}) async {
    final response = await _dio.dio.post<Map<String, dynamic>>(
      ApiEndpoints.sendOtp,
      data: SendOtpRequest(
        email:      email.trim().toLowerCase(),
        businessId: AppConfig.businessId,
        storeId:    storeId,
      ).toJson(),
    );
    return response.data?['success'] == true;
  }

  /// Verify OTP and create a customer session.
  ///
  /// [otpPurpose] must be passed so the server can enforce the correct
  /// validation rules (e.g. name + phone required for 'register').
  Future<AuthSession> verifyOtp({
    required String email,
    required String code,
    required String otpPurpose,   // 'register' | 'login' | 'forgot'
    String? phone,
    String? name,
  }) async {
    final response = await _dio.dio.post<Map<String, dynamic>>(
      ApiEndpoints.verifyOtp,
      data: VerifyOtpRequest(
        email:      email.trim().toLowerCase(),
        code:       code,
        businessId: AppConfig.businessId,
        storeId:    AppConfig.storeId.isNotEmpty ? AppConfig.storeId : null,
        phone:      phone,
        name:       name,
        otpPurpose: otpPurpose,
      ).toJson(),
    );

    final session = AuthSession.fromJson(
      response.data!['data'] as Map<String, dynamic>,
    );

    await _storage.saveSession(
      token:      session.token,
      expiresAt:  session.expiresAt,
      userId:     session.user.id,
      email:      session.user.email,
      businessId: session.user.businessId,
      storeId:    AppConfig.storeId,
      name:       session.user.name,
      phone:      session.user.phone,
    );

    return session;
  }

  /// Password-based login for existing customers.
  Future<AuthSession> loginWithPassword({
    required String email,
    required String password,
  }) async {
    final response = await _dio.dio.post<Map<String, dynamic>>(
      ApiEndpoints.loginPassword,
      data: {
        'email':      email.trim().toLowerCase(),
        'password':   password,
        'businessId': AppConfig.businessId,
      },
    );

    final data = response.data!;
    if (data['success'] != true) {
      throw Exception(data['error'] ?? 'Login failed');
    }

    // Password login returns a flat response shape
    final session = AuthSession.fromJson({
      'token':        data['token'],
      'refreshToken': data['refreshToken'],
      'expiresAt':    data['expiresAt'] ?? '',
      'user':         data['user'],
    });

    await _storage.saveSession(
      token:      session.token,
      expiresAt:  session.expiresAt,
      userId:     session.user.id,
      email:      session.user.email,
      businessId: session.user.businessId,
      storeId:    AppConfig.storeId,
      name:       session.user.name,
      phone:      session.user.phone,
    );

    return session;
  }

  /// Send a password-recovery OTP to the customer's registered email.
  Future<void> sendForgotOtp({required String email}) async {
    final response = await _dio.dio.post<Map<String, dynamic>>(
      ApiEndpoints.forgotPassword,
      data: {
        'email':      email.trim().toLowerCase(),
        'businessId': AppConfig.businessId,
        if (AppConfig.storeId.isNotEmpty) 'storeId': AppConfig.storeId,
      },
    );
    final data = response.data!;
    // NOT_FOUND is treated as success (anti-enumeration)
    if (data['success'] != true) {
      throw Exception(data['error'] ?? 'Failed to send recovery code');
    }
  }

  /// Verify OTP and set a new password → returns an authenticated session.
  Future<AuthSession> resetPassword({
    required String email,
    required String code,
    required String password,
  }) async {
    final response = await _dio.dio.post<Map<String, dynamic>>(
      ApiEndpoints.resetPassword,
      data: {
        'email':      email.trim().toLowerCase(),
        'code':       code,
        'password':   password,
        'businessId': AppConfig.businessId,
        if (AppConfig.storeId.isNotEmpty) 'storeId': AppConfig.storeId,
      },
    );

    final data = response.data!;
    if (data['success'] != true) {
      throw Exception(data['error'] ?? 'Password reset failed');
    }

    final session = AuthSession.fromJson(
      data['data'] as Map<String, dynamic>,
    );

    await _storage.saveSession(
      token:      session.token,
      expiresAt:  session.expiresAt,
      userId:     session.user.id,
      email:      session.user.email,
      businessId: session.user.businessId,
      storeId:    AppConfig.storeId,
      name:       session.user.name,
      phone:      session.user.phone,
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
