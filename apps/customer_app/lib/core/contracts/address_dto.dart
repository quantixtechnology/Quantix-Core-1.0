import 'package:freezed_annotation/freezed_annotation.dart';

part 'address_dto.freezed.dart';
part 'address_dto.g.dart';

@freezed
class AddressDTO with _$AddressDTO {
  const factory AddressDTO({
    required String id,
    required String customerId,
    required String addressLine1,
    required String city,
    required String pincode,
    required String country,
    required String state,
    required bool isDefault,
    required String createdAt,
    required String updatedAt,
    String? label,
    String? area,
    String? addressLine2,
    String? landmark,
    String? instructions,
    double? latitude,
    double? longitude,
    double? gpsAccuracy,
  }) = _AddressDTO;

  factory AddressDTO.fromJson(Map<String, dynamic> json) =>
      _$AddressDTOFromJson(json);
}

@freezed
class CreateAddressRequest with _$CreateAddressRequest {
  const factory CreateAddressRequest({
    required String line1,
    required String city,
    required String pincode,
    String? label,
    String? area,
    String? line2,
    String? landmark,
    String? state,
    String? instructions,
    double? latitude,
    double? longitude,
    double? gpsAccuracy,
    bool? isDefault,
  }) = _CreateAddressRequest;

  factory CreateAddressRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateAddressRequestFromJson(json);
}

@freezed
class CustomerProfile with _$CustomerProfile {
  const factory CustomerProfile({
    required String id,
    @Default(0) int loyaltyPoints,
    @Default(0) int totalOrders,
    @Default(0.0) double totalSpent,
    String? name,
    String? email,
    String? phone,
    String? avatar,
    String? gstNumber,
    String? loyaltyTier,
  }) = _CustomerProfile;

  factory CustomerProfile.fromJson(Map<String, dynamic> json) =>
      _$CustomerProfileFromJson(json);
}
