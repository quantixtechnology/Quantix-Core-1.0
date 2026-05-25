import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/contracts/order_dto.dart';
import '../../../core/contracts/address_dto.dart';
import '../services/order_service.dart';

// ── Order list ─────────────────────────────────────────────────────────────

final orderListProvider = FutureProvider.autoDispose<List<OrderDTO>>((ref) {
  return ref.read(orderServiceProvider).getOrders();
});

// ── Order detail / tracking ────────────────────────────────────────────────

final orderTrackingProvider =
    FutureProvider.autoDispose.family<dynamic, String>((ref, orderId) {
  return ref.read(orderServiceProvider).trackOrder(orderId);
});

// ── Checkout state ─────────────────────────────────────────────────────────

class CheckoutState {
  const CheckoutState({
    this.selectedAddressId,
    this.paymentMethod,
    this.promoCodeId,
    this.deliveryFee = 0,
    this.isSubmitting = false,
    this.error,
    this.createdOrder,
  });

  final String? selectedAddressId;
  final String? paymentMethod;
  final String? promoCodeId;
  final double deliveryFee;
  final bool isSubmitting;
  final String? error;
  final OrderDTO? createdOrder;

  CheckoutState copyWith({
    String? selectedAddressId,
    String? paymentMethod,
    String? promoCodeId,
    double? deliveryFee,
    bool? isSubmitting,
    String? error,
    OrderDTO? createdOrder,
  }) {
    return CheckoutState(
      selectedAddressId: selectedAddressId ?? this.selectedAddressId,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      promoCodeId: promoCodeId ?? this.promoCodeId,
      deliveryFee: deliveryFee ?? this.deliveryFee,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      error: error,
      createdOrder: createdOrder ?? this.createdOrder,
    );
  }
}

class CheckoutNotifier extends StateNotifier<CheckoutState> {
  CheckoutNotifier(this._service) : super(const CheckoutState());

  final OrderService _service;

  void selectAddress(String addressId) =>
      state = state.copyWith(selectedAddressId: addressId);

  void selectPaymentMethod(String method) =>
      state = state.copyWith(paymentMethod: method);

  void applyPromo(String promoCodeId) =>
      state = state.copyWith(promoCodeId: promoCodeId);

  void setDeliveryFee(double fee) =>
      state = state.copyWith(deliveryFee: fee);

  Future<OrderDTO?> placeOrder(CreateOrderRequest request) async {
    state = state.copyWith(isSubmitting: true, error: null);
    try {
      final order = await _service.createOrder(request);
      state = state.copyWith(isSubmitting: false, createdOrder: order);
      return order;
    } catch (e) {
      state = state.copyWith(isSubmitting: false, error: e.toString());
      return null;
    }
  }

  void reset() => state = const CheckoutState();
}

final checkoutProvider = StateNotifierProvider<CheckoutNotifier, CheckoutState>((ref) {
  return CheckoutNotifier(ref.read(orderServiceProvider));
});

// ── Addresses ──────────────────────────────────────────────────────────────

final addressListProvider = FutureProvider.autoDispose<List<AddressDTO>>((ref) {
  return ref.read(orderServiceProvider).getAddresses();
});

final selectedAddressProvider = StateProvider<AddressDTO?>((ref) => null);
