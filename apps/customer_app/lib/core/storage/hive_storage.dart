import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import '../constants/storage_keys.dart';

// ============================================================================
// HiveStorage — JSON cache with TTL.
// Each box stores: { 'data': <json>, 'cached_at': <iso-string> }
// ============================================================================

class HiveStorage {
  HiveStorage._();

  static Future<void> init() async {
    await Hive.initFlutter();
    await Future.wait([
      Hive.openBox<String>(StorageKeys.boxContext),
      Hive.openBox<String>(StorageKeys.boxBanners),
      Hive.openBox<String>(StorageKeys.boxCategories),
      Hive.openBox<String>(StorageKeys.boxProducts),
      Hive.openBox<String>(StorageKeys.boxOrders),
      Hive.openBox<String>(StorageKeys.boxProfile),
      Hive.openBox<String>(StorageKeys.boxNotifications),
      Hive.openBox<String>(StorageKeys.boxMeta),
    ]);
  }

  // Write JSON-encodable value with current timestamp.
  static Future<void> put(String boxName, String key, dynamic value) async {
    final box = Hive.box<String>(boxName);
    await box.put(key, jsonEncode({
      StorageKeys.keyData: value,
      StorageKeys.keyCachedAt: DateTime.now().toIso8601String(),
    }));
  }

  // Read if not stale (ttlSeconds). Returns null on miss or expired.
  static T? get<T>(String boxName, String key, int ttlSeconds, T Function(dynamic) fromJson) {
    final box = Hive.box<String>(boxName);
    final raw = box.get(key);
    if (raw == null) return null;

    final map = jsonDecode(raw) as Map<String, dynamic>;
    final cachedAt = DateTime.tryParse(map[StorageKeys.keyCachedAt] as String? ?? '');
    if (cachedAt == null) return null;

    final age = DateTime.now().difference(cachedAt).inSeconds;
    if (age > ttlSeconds) return null;

    return fromJson(map[StorageKeys.keyData]);
  }

  static Future<void> evict(String boxName, [String? key]) async {
    final box = Hive.box<String>(boxName);
    if (key != null) {
      await box.delete(key);
    } else {
      await box.clear();
    }
  }

  static Future<void> evictAll() async {
    await Future.wait([
      evict(StorageKeys.boxContext),
      evict(StorageKeys.boxBanners),
      evict(StorageKeys.boxCategories),
      evict(StorageKeys.boxProducts),
      evict(StorageKeys.boxOrders),
      evict(StorageKeys.boxProfile),
      evict(StorageKeys.boxNotifications),
    ]);
  }
}
