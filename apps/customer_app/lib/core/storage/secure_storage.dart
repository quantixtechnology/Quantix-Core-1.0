import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../constants/storage_keys.dart';

final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

class SecureStorageService {
  SecureStorageService()
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
        );

  final FlutterSecureStorage _storage;

  Future<void> saveSession({
    required String token,
    required String expiresAt,
    required String userId,
    required String email,
    required String businessId,
    required String storeId,
    String? name,
    String? phone,
  }) async {
    await Future.wait([
      _storage.write(key: StorageKeys.jwtToken,   value: token),
      _storage.write(key: StorageKeys.expiresAt,  value: expiresAt),
      _storage.write(key: StorageKeys.userId,     value: userId),
      _storage.write(key: StorageKeys.userEmail,  value: email),
      _storage.write(key: StorageKeys.businessId, value: businessId),
      _storage.write(key: StorageKeys.storeId,    value: storeId),
      if (name != null)  _storage.write(key: StorageKeys.userName,  value: name),
      if (phone != null) _storage.write(key: StorageKeys.userPhone, value: phone),
    ]);
  }

  Future<String?> get token      => _storage.read(key: StorageKeys.jwtToken);
  Future<String?> get expiresAt  => _storage.read(key: StorageKeys.expiresAt);
  Future<String?> get userId     => _storage.read(key: StorageKeys.userId);
  Future<String?> get userEmail  => _storage.read(key: StorageKeys.userEmail);
  Future<String?> get userName   => _storage.read(key: StorageKeys.userName);
  Future<String?> get userPhone  => _storage.read(key: StorageKeys.userPhone);
  Future<String?> get businessId => _storage.read(key: StorageKeys.businessId);
  Future<String?> get storeId    => _storage.read(key: StorageKeys.storeId);
  Future<String?> get fcmToken   => _storage.read(key: StorageKeys.fcmToken);

  Future<void> saveFcmToken(String token) =>
      _storage.write(key: StorageKeys.fcmToken, value: token);

  Future<bool> get hasValidSession async {
    final t = await token;
    final exp = await expiresAt;
    if (t == null || exp == null) return false;
    return DateTime.tryParse(exp)?.isAfter(DateTime.now()) ?? false;
  }

  Future<void> clearSession() async {
    await Future.wait([
      _storage.delete(key: StorageKeys.jwtToken),
      _storage.delete(key: StorageKeys.expiresAt),
      _storage.delete(key: StorageKeys.userId),
      _storage.delete(key: StorageKeys.userEmail),
      _storage.delete(key: StorageKeys.userName),
      _storage.delete(key: StorageKeys.userPhone),
      _storage.delete(key: StorageKeys.businessId),
      _storage.delete(key: StorageKeys.storeId),
    ]);
  }
}
