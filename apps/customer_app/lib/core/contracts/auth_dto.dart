import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_dto.freezed.dart';
part 'auth_dto.g.dart';

@freezed
class SendOtpRequest with _$SendOtpRequest {
  const factory SendOtpRequest({
    required String email,
    required String businessId,
    String? storeId,
  }) = _SendOtpRequest;

  factory SendOtpRequest.fromJson(Map<String, dynamic> json) =>
      _$SendOtpRequestFromJson(json);
}

@freezed
class VerifyOtpRequest with _$VerifyOtpRequest {
  const factory VerifyOtpRequest({
    required String email,
    required String code,
    required String businessId,
    String? phone,
    String? name,
    String? storeId,
    /// 'register' | 'login' | 'forgot' — tells the server which rules to apply
    @Default('login') String otpPurpose,
  }) = _VerifyOtpRequest;

  factory VerifyOtpRequest.fromJson(Map<String, dynamic> json) =>
      _$VerifyOtpRequestFromJson(json);
}

@freezed
class AuthUser with _$AuthUser {
  const factory AuthUser({
    required String id,
    required String email,
    required String businessId,
    @Default('CUSTOMER') String role,
    String? name,
    String? phone,
  }) = _AuthUser;

  factory AuthUser.fromJson(Map<String, dynamic> json) =>
      _$AuthUserFromJson(json);
}

@freezed
class AuthSession with _$AuthSession {
  const factory AuthSession({
    required String token,
    required String expiresAt,
    required AuthUser user,
    String? refreshToken,
  }) = _AuthSession;

  factory AuthSession.fromJson(Map<String, dynamic> json) =>
      _$AuthSessionFromJson(json);
}
