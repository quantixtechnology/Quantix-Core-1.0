import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/contracts/cart_dto.dart';
import '../services/cart_service.dart';

class CartState {
  const CartState({
    this.cart,
    this.isLoading = false,
    this.error,
    this.appliedCoupon,
  });

  final CartDTO? cart;
  final bool isLoading;
  final String? error;
  final CouponDTO? appliedCoupon;

  int get itemCount => cart?.itemCount ?? 0;
  double get total => cart?.total ?? 0;
  bool get isEmpty => itemCount == 0;

  CartState copyWith({
    CartDTO? cart,
    bool? isLoading,
    String? error,
    CouponDTO? appliedCoupon,
    bool clearCoupon = false,
    bool clearError = false,
  }) {
    return CartState(
      cart: cart ?? this.cart,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
      appliedCoupon: clearCoupon ? null : (appliedCoupon ?? this.appliedCoupon),
    );
  }
}

class CartNotifier extends StateNotifier<CartState> {
  CartNotifier(this._service) : super(const CartState());

  final CartService _service;

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final cart = await _service.getCart();
      state = state.copyWith(cart: cart, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> addItem(AddToCartRequest request) async {
    try {
      await _service.addItem(request);
      await load();
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> updateQuantity(String itemId, int quantity) async {
    try {
      if (quantity == 0) {
        await _service.removeItem(itemId);
      } else {
        await _service.updateItem(itemId: itemId, quantity: quantity);
      }
      await load();
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> removeItem(String itemId) async {
    try {
      await _service.removeItem(itemId);
      await load();
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> clearCart() async {
    try {
      await _service.clearCart();
      state = state.copyWith(
        cart: const CartDTO(data: [], total: 0, itemCount: 0),
        clearCoupon: true,
      );
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  void applyCoupon(CouponDTO coupon) {
    state = state.copyWith(appliedCoupon: coupon);
  }

  void removeCoupon() {
    state = state.copyWith(clearCoupon: true);
  }
}

final cartProvider = StateNotifierProvider<CartNotifier, CartState>((ref) {
  return CartNotifier(ref.read(cartServiceProvider));
});

final cartItemCountProvider = Provider<int>((ref) {
  return ref.watch(cartProvider).itemCount;
});

final couponsProvider = FutureProvider.autoDispose<List<CouponDTO>>((ref) {
  return ref.read(cartServiceProvider).getCoupons();
});
