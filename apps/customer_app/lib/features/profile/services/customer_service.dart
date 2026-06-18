import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/contracts/address_dto.dart';

final customerServiceProvider = Provider<CustomerService>((ref) {
  return CustomerService(ref.read(dioClientProvider));
});

class CustomerService {
  CustomerService(this._dio);

  final DioClient _dio;

  Future<CustomerProfile> getProfile() async {
    final data = await _dio.get<Map<String, dynamic>>(ApiEndpoints.profile);
    return CustomerProfile.fromJson(data);
  }

  Future<CustomerProfile> updateProfile({
    String? name,
    String? email,
    String? phone,
    String? gstNumber,
  }) async {
    final data = await _dio.put<Map<String, dynamic>>(
      ApiEndpoints.profile,
      data: {
        'name': ?name,
        'email': ?email,
        'phone': ?phone,
        'gstNumber': ?gstNumber,
      },
    );
    return CustomerProfile.fromJson(data);
  }
}
