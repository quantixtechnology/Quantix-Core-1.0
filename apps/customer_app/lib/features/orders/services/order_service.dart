import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/contracts/order_dto.dart';
import '../../../core/contracts/tracking_dto.dart';
import '../../../core/contracts/address_dto.dart';

final orderServiceProvider = Provider<OrderService>((ref) {
  return OrderService(ref.read(dioClientProvider));
});

class OrderService {
  OrderService(this._dio);

  final DioClient _dio;

  Future<List<OrderDTO>> getOrders() async {
    final data = await _dio.get<List<dynamic>>(ApiEndpoints.orders);
    return (data)
        .map((e) => OrderDTO.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<OrderDTO> createOrder(CreateOrderRequest request) async {
    final data = await _dio.post<Map<String, dynamic>>(
      ApiEndpoints.orders,
      data: request.toJson(),
    );
    return OrderDTO.fromJson(data);
  }

  Future<OrderTrackingDTO> trackOrder(String orderId) async {
    final data = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.orderTrack(orderId),
    );
    return OrderTrackingDTO.fromJson(data);
  }

  Future<LiveTrackingDTO> getLiveTracking(String orderId) async {
    final data = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.orderLive(orderId),
    );
    return LiveTrackingDTO.fromJson(data);
  }

  Future<EtaDTO> getEta(String orderId) async {
    final data = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.orderEta(orderId),
    );
    return EtaDTO.fromJson(data);
  }

  // ── Addresses ──────────────────────────────────────────────────────────

  Future<List<AddressDTO>> getAddresses() async {
    final data = await _dio.get<List<dynamic>>(ApiEndpoints.addresses);
    return (data)
        .map((e) => AddressDTO.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<AddressDTO> createAddress(CreateAddressRequest request) async {
    final data = await _dio.post<Map<String, dynamic>>(
      ApiEndpoints.addresses,
      data: request.toJson(),
    );
    return AddressDTO.fromJson(data);
  }

  Future<AddressDTO> setDefaultAddress(String addressId) async {
    final data = await _dio.patch<Map<String, dynamic>>(
      ApiEndpoints.addressById(addressId),
      data: {'isDefault': true},
    );
    return AddressDTO.fromJson(data);
  }

  Future<void> deleteAddress(String addressId) async {
    await _dio.delete(ApiEndpoints.addressById(addressId));
  }
}
