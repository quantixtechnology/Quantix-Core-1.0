import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/config/app_config.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/constants/storage_keys.dart';
import '../../../core/contracts/notification_dto.dart';
import '../../../core/contracts/store_dto.dart';
import '../../../core/storage/hive_storage.dart';

final homeServiceProvider = Provider<HomeService>((ref) {
  return HomeService(ref.read(dioClientProvider));
});

class HomeService {
  HomeService(this._dio);

  final DioClient _dio;

  Future<StoreContextDTO> getStoreContext({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = HiveStorage.get<StoreContextDTO>(
        StorageKeys.boxContext,
        'context',
        AppConfig.ttlContext,
        (j) => StoreContextDTO.fromJson(j as Map<String, dynamic>),
      );
      if (cached != null) return cached;
    }

    final data = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.storeContext,
      queryParameters: {
        'businessId': AppConfig.businessId,
        if (AppConfig.storeId.isNotEmpty) 'storeId': AppConfig.storeId,
      },
    );

    final ctx = StoreContextDTO.fromJson(data);
    await HiveStorage.put(StorageKeys.boxContext, 'context', data);
    return ctx;
  }

  Future<List<BannerDTO>> getBanners({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = HiveStorage.get<List<BannerDTO>>(
        StorageKeys.boxBanners,
        'banners',
        AppConfig.ttlBanners,
        (j) => (j as List).map((e) => BannerDTO.fromJson(e as Map<String, dynamic>)).toList(),
      );
      if (cached != null) return cached;
    }

    final data = await _dio.get<List<dynamic>>(
      ApiEndpoints.banners,
      queryParameters: {
        'businessId': AppConfig.businessId,
        if (AppConfig.storeId.isNotEmpty) 'storeId': AppConfig.storeId,
      },
    );

    final banners = (data)
        .map((e) => BannerDTO.fromJson(e as Map<String, dynamic>))
        .toList();
    await HiveStorage.put(StorageKeys.boxBanners, 'banners', data);
    return banners;
  }

  Future<List<PromoDisplayDTO>> getPromotions() async {
    final data = await _dio.get<List<dynamic>>(
      ApiEndpoints.promotions,
      queryParameters: {'businessId': AppConfig.businessId},
    );
    return (data)
        .map((e) => PromoDisplayDTO.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<AppVersionDTO> getAppVersion(String platform) async {
    final data = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.appVersion,
      queryParameters: {'platform': platform},
    );
    return AppVersionDTO.fromJson(data);
  }
}
