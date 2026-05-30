// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_SendOtpRequest _$SendOtpRequestFromJson(Map<String, dynamic> json) =>
    _SendOtpRequest(
      email: json['email'] as String,
      businessId: json['businessId'] as String,
      storeId: json['storeId'] as String?,
    );

Map<String, dynamic> _$SendOtpRequestToJson(_SendOtpRequest instance) =>
    <String, dynamic>{
      'email': instance.email,
      'businessId': instance.businessId,
      'storeId': instance.storeId,
    };

_VerifyOtpRequest _$VerifyOtpRequestFromJson(Map<String, dynamic> json) =>
    _VerifyOtpRequest(
      email: json['email'] as String,
      code: json['code'] as String,
      businessId: json['businessId'] as String,
      phone: json['phone'] as String?,
      name: json['name'] as String?,
      storeId: json['storeId'] as String?,
    );

Map<String, dynamic> _$VerifyOtpRequestToJson(_VerifyOtpRequest instance) =>
    <String, dynamic>{
      'email': instance.email,
      'code': instance.code,
      'businessId': instance.businessId,
      'phone': instance.phone,
      'name': instance.name,
      'storeId': instance.storeId,
    };

_AuthUser _$AuthUserFromJson(Map<String, dynamic> json) => _AuthUser(
  id: json['id'] as String,
  email: json['email'] as String,
  businessId: json['businessId'] as String,
  role: json['role'] as String? ?? 'CUSTOMER',
  name: json['name'] as String?,
  phone: json['phone'] as String?,
);

Map<String, dynamic> _$AuthUserToJson(_AuthUser instance) => <String, dynamic>{
  'id': instance.id,
  'email': instance.email,
  'businessId': instance.businessId,
  'role': instance.role,
  'name': instance.name,
  'phone': instance.phone,
};

_AuthSession _$AuthSessionFromJson(Map<String, dynamic> json) => _AuthSession(
  token: json['token'] as String,
  expiresAt: json['expiresAt'] as String,
  user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
  refreshToken: json['refreshToken'] as String?,
);

Map<String, dynamic> _$AuthSessionToJson(_AuthSession instance) =>
    <String, dynamic>{
      'token': instance.token,
      'expiresAt': instance.expiresAt,
      'user': instance.user,
      'refreshToken': instance.refreshToken,
    };
