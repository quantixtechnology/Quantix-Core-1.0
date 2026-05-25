import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/contracts/notification_dto.dart';
import '../../../core/storage/secure_storage.dart';
import 'package:package_info_plus/package_info_plus.dart';

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService(
    ref.read(dioClientProvider),
    ref.read(secureStorageProvider),
  );
});

class NotificationService {
  NotificationService(this._dio, this._storage);

  final DioClient _dio;
  final SecureStorageService _storage;

  static final _localNotifications = FlutterLocalNotificationsPlugin();

  // ── Init FCM + local notifications ───────────────────────────────────────

  static Future<void> initLocalNotifications() async {
    const initSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: initSettingsAndroid);
    await _localNotifications.initialize(initSettings);
  }

  static Future<void> showLocalNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'quantix_orders',
        'Order Updates',
        channelDescription: 'Notifications about your orders',
        importance: Importance.high,
        priority: Priority.high,
      ),
    );
    await _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      details,
      payload: payload,
    );
  }

  // ── Device registration ───────────────────────────────────────────────────

  Future<void> registerDevice() async {
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission();

    final token = await messaging.getToken();
    if (token == null) return;

    await _storage.saveFcmToken(token);

    final deviceInfo = DeviceInfoPlugin();
    final packageInfo = await PackageInfo.fromPlatform();

    String? deviceId;
    if (Platform.isAndroid) {
      final info = await deviceInfo.androidInfo;
      deviceId = info.id;
    } else if (Platform.isIOS) {
      final info = await deviceInfo.iosInfo;
      deviceId = info.identifierForVendor;
    }

    await _dio.dio.post<Map<String, dynamic>>(
      ApiEndpoints.devicesRegister,
      data: DeviceRegisterRequest(
        fcmToken: token,
        platform: Platform.isAndroid ? 'ANDROID' : 'IOS',
        deviceId: deviceId,
        appVersion: packageInfo.version,
      ).toJson(),
    );

    // Listen for token refresh
    messaging.onTokenRefresh.listen((newToken) async {
      await _storage.saveFcmToken(newToken);
      await _dio.dio.post<Map<String, dynamic>>(
        ApiEndpoints.devicesRegister,
        data: DeviceRegisterRequest(
          fcmToken: newToken,
          platform: Platform.isAndroid ? 'ANDROID' : 'IOS',
          deviceId: deviceId,
          appVersion: packageInfo.version,
        ).toJson(),
      );
    });
  }

  // ── Notification CRUD ─────────────────────────────────────────────────────

  Future<NotificationsResponse> getNotifications({
    int page = 1,
    bool unreadOnly = false,
  }) async {
    final response = await _dio.dio.get<Map<String, dynamic>>(
      ApiEndpoints.notifications,
      queryParameters: {'page': page, 'limit': 20, 'unreadOnly': unreadOnly},
    );
    return NotificationsResponse.fromJson(response.data!);
  }

  Future<void> markRead(String notificationId) async {
    await _dio.dio.patch<Map<String, dynamic>>(
      ApiEndpoints.notificationRead(notificationId),
    );
  }

  Future<int> markAllRead() async {
    final response = await _dio.dio.post<Map<String, dynamic>>(
      ApiEndpoints.notificationsReadAll,
    );
    return response.data?['data']?['updated'] as int? ?? 0;
  }
}
