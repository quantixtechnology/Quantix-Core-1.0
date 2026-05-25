import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/config/app_config.dart';
import 'core/storage/hive_storage.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/home/services/home_service.dart';
import 'features/notifications/services/notification_service.dart';

// ── Background FCM handler (must be top-level) ─────────────────────────────
// @pragma('vm:entry-point')
// Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
//   await Firebase.initializeApp();
//   // Handle background notification — typically just log or persist
// }

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Orientation lock (portrait only for customer app)
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Firebase
  await Firebase.initializeApp();
  // FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  // Hive local cache
  await HiveStorage.init();

  // Local notifications (for foreground FCM display)
  await NotificationService.initLocalNotifications();

  runApp(
    const ProviderScope(
      child: _Bootstrap(),
    ),
  );
}

// ── Bootstrap widget — loads store context before showing app ───────────────

class _Bootstrap extends ConsumerStatefulWidget {
  const _Bootstrap();

  @override
  ConsumerState<_Bootstrap> createState() => _BootstrapState();
}

class _BootstrapState extends ConsumerState<_Bootstrap> {
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      // Load store context to populate AppConfig.businessId / storeId
      // In production: businessId comes from --dart-define or deep link
      final homeService = ref.read(homeServiceProvider);
      final context = await homeService.getStoreContext();

      AppConfig.businessId = context.business.id;
      AppConfig.storeId = context.store?.id ?? '';

      // Apply dynamic branding
      // AppTheme.applyBranding(
      //   primaryColor: context.business.primaryColor,
      //   secondaryColor: context.business.secondaryColor,
      // );

      // Start auth check
      await ref.read(authProvider.notifier).checkSession();
    } catch (_) {
      // Bootstrap failed (offline) — proceed anyway, app handles errors
    }
    if (mounted) setState(() => _ready = true);
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const MaterialApp(
        home: Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
      );
    }
    return const QuantixApp();
  }
}
