import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/config/app_config.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/contracts/cart_dto.dart';

final cartServiceProvider = Provider<CartService>((ref) {
  return CartService(ref.read(dioClientProvider));
});

class CartService {
  CartService(this._dio);

  final DioClient _dio;

  Future<CartDTO> getCart() async {
    final response = await _dio.dio.get<Map<String, dynamic>>(
      ApiEndpoints.cart,
      queryParameters: {'storeId': AppConfig.storeId},
    );
    return CartDTO.fromJson(response.data!);
  }

  Future<void> addItem(AddToCartRequest request) async {
    await _dio.dio.post<Map<String, dynamic>>(
      ApiEndpoints.cart,
      data: request.toJson(),
    );
  }

  Future<void> updateItem({required String itemId, required int quantity}) async {
    await _dio.dio.patch<Map<String, dynamic>>(
      ApiEndpoints.cart,
      data: {'itemId': itemId, 'quantity': quantity},
    );
  }

  Future<void> removeItem(String itemId) async {
    await _dio.dio.delete<Map<String, dynamic>>(
      ApiEndpoints.cart,
      queryParameters: {'itemId': itemId},
    );
  }

  Future<void> clearCart() async {
    await _dio.dio.delete<Map<String, dynamic>>(
      ApiEndpoints.cart,
      queryParameters: {'clear': true, 'storeId': AppConfig.storeId},
    );
  }

  Future<List<CouponDTO>> getCoupons() async {
    final data = await _dio.get<List<dynamic>>(ApiEndpoints.coupons);
    return (data)
        .map((e) => CouponDTO.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
