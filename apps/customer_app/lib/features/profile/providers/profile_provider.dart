import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/contracts/address_dto.dart';
import '../services/customer_service.dart';

final profileProvider = FutureProvider.autoDispose<CustomerProfile>((ref) {
  return ref.read(customerServiceProvider).getProfile();
});

class ProfileEditNotifier extends StateNotifier<AsyncValue<CustomerProfile?>> {
  ProfileEditNotifier(this._service) : super(const AsyncValue.data(null));

  final CustomerService _service;

  Future<void> update({
    String? name,
    String? email,
    String? phone,
    String? gstNumber,
  }) async {
    state = const AsyncValue.loading();
    try {
      final updated = await _service.updateProfile(
        name: name,
        email: email,
        phone: phone,
        gstNumber: gstNumber,
      );
      state = AsyncValue.data(updated);
    } catch (e, s) {
      state = AsyncValue.error(e, s);
    }
  }
}

final profileEditProvider =
    StateNotifierProvider<ProfileEditNotifier, AsyncValue<CustomerProfile?>>((ref) {
  return ProfileEditNotifier(ref.read(customerServiceProvider));
});
