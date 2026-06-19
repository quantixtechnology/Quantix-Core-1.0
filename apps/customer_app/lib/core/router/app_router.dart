import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/providers/auth_provider.dart';
import '../constants/route_paths.dart';

// ── Page stubs (replaced in Phase 2+ with real screens) ───────────────────
import '../../features/auth/login/login_page.dart';
import '../../features/auth/otp/otp_page.dart';
import '../../features/home/dashboard/home_page.dart';
import '../../features/catalog/categories/categories_page.dart';
import '../../features/catalog/products/products_page.dart';
import '../../features/catalog/product_detail/product_detail_page.dart';
import '../../features/catalog/search/search_page.dart';
import '../../features/cart/cart_page.dart';
import '../../features/checkout/checkout_page.dart';
import '../../features/orders/history/orders_page.dart';
import '../../features/orders/details/order_detail_page.dart';
import '../../features/orders/tracking/tracking_page.dart';
import '../../features/notifications/notifications_page.dart';
import '../../features/profile/account/profile_page.dart';
import '../../features/profile/addresses/addresses_page.dart';
import '../../features/profile/loyalty/loyalty_page.dart';
import '../../features/profile/settings/settings_page.dart';

// ── Router Provider ────────────────────────────────────────────────────────

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: RoutePaths.splash,
    debugLogDiagnostics: true,
    redirect: (context, state) {
      final isAuthenticated = authState.isAuthenticated;
      final isAuthRoute = state.matchedLocation == RoutePaths.login ||
          state.matchedLocation == RoutePaths.otp;

      // Still loading — no redirect yet
      if (authState.status == AuthStatus.initial ||
          authState.status == AuthStatus.loading) {
        return null;
      }

      // Not authenticated and trying to reach a protected route
      if (!isAuthenticated && !isAuthRoute) {
        return RoutePaths.login;
      }

      // Already authenticated and landing on auth route
      if (isAuthenticated && isAuthRoute) {
        return RoutePaths.home;
      }

      return null;
    },
    routes: [
      // ── Splash ────────────────────────────────────────────────────────
      GoRoute(
        path: RoutePaths.splash,
        builder: (_, __) => const SplashPage(),
      ),

      // ── Auth ──────────────────────────────────────────────────────────
      GoRoute(
        path: RoutePaths.login,
        builder: (_, __) => const LoginPage(),
        routes: [
          GoRoute(
            path: 'otp',
            builder: (_, __) => const OtpPage(),
          ),
        ],
      ),

      // ── Main shell (bottom nav) ────────────────────────────────────────
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(
            path: RoutePaths.home,
            builder: (_, __) => const HomePage(),
          ),
          GoRoute(
            path: RoutePaths.catalog,
            builder: (_, __) => const CategoriesPage(),
            routes: [
              GoRoute(
                path: 'products',
                builder: (_, state) => ProductsPage(
                  categoryId: state.uri.queryParameters['categoryId'],
                ),
              ),
              GoRoute(
                path: 'search',
                builder: (_, __) => const SearchPage(),
              ),
            ],
          ),
          GoRoute(
            path: RoutePaths.productParam,
            builder: (_, state) =>
                ProductDetailPage(productId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: RoutePaths.cart,
            builder: (_, __) => const CartPage(),
          ),
          GoRoute(
            path: RoutePaths.orders,
            builder: (_, __) => const OrdersPage(),
          ),
          GoRoute(
            path: RoutePaths.profile,
            builder: (_, __) => const ProfilePage(),
            routes: [
              GoRoute(
                path: 'addresses',
                builder: (_, __) => const AddressesPage(),
              ),
              GoRoute(
                path: 'loyalty',
                builder: (_, __) => const LoyaltyPage(),
              ),
              GoRoute(
                path: 'settings',
                builder: (_, __) => const SettingsPage(),
              ),
            ],
          ),
        ],
      ),

      // ── Full-screen routes (outside shell) ────────────────────────────
      GoRoute(
        path: RoutePaths.orderParam,
        builder: (_, state) =>
            OrderDetailPage(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: RoutePaths.trackingParam,
        builder: (_, state) =>
            TrackingPage(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: RoutePaths.checkout,
        builder: (_, __) => const CheckoutPage(),
      ),
      GoRoute(
        path: RoutePaths.notifications,
        builder: (_, __) => const NotificationsPage(),
      ),
    ],
  );
});

// ── Splash Page ────────────────────────────────────────────────────────────

class SplashPage extends ConsumerWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(authProvider, (_, next) {
      if (next.status == AuthStatus.authenticated) {
        context.go(RoutePaths.home);
      } else if (next.status == AuthStatus.unauthenticated) {
        context.go(RoutePaths.login);
      }
    });

    // Trigger session check on first build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authProvider.notifier).checkSession();
    });

    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}

// ── Main Shell with bottom navigation ─────────────────────────────────────

class MainShell extends ConsumerWidget {
  const MainShell({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO Phase 2: replace with themed BottomNavigationBar / NavigationBar
    return Scaffold(
      body: child,
      bottomNavigationBar: _BottomNav(),
    );
  }
}

class _BottomNav extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Placeholder — real nav bar built in Phase 2
    return const SizedBox.shrink();
  }
}
