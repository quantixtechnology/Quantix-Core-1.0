import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/contracts/notification_dto.dart';
import '../../../core/contracts/store_dto.dart';
import '../services/home_service.dart';

// Store context (branding, config, payment gateways)
final storeContextProvider = FutureProvider.autoDispose<StoreContextDTO>((ref) {
  return ref.read(homeServiceProvider).getStoreContext();
});

// Banners for home screen carousel
final bannersProvider = FutureProvider.autoDispose<List<BannerDTO>>((ref) {
  return ref.read(homeServiceProvider).getBanners();
});

// Active promotions
final promotionsProvider = FutureProvider.autoDispose<List<PromoDisplayDTO>>((ref) {
  return ref.read(homeServiceProvider).getPromotions();
});

// App version check
final appVersionProvider = FutureProvider.autoDispose<AppVersionDTO>((ref) {
  return ref.read(homeServiceProvider).getAppVersion('android');
});

// Refresh trigger for home
final homeRefreshProvider = StateProvider<int>((ref) => 0);
