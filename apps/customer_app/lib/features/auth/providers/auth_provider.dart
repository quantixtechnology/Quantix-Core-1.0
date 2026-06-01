import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/contracts/auth_dto.dart';
import '../services/auth_service.dart';

// ── Auth State ─────────────────────────────────────────────────────────────

enum AuthStatus { initial, loading, authenticated, unauthenticated, error }

class AuthState {
  const AuthState({
    this.status = AuthStatus.initial,
    this.session,
    this.error,
    this.email,
    this.otpSent = false,
  });

  final AuthStatus status;
  final AuthSession? session;
  final String? error;
  final String? email;
  final bool otpSent;

  bool get isAuthenticated => status == AuthStatus.authenticated && session != null;

  AuthState copyWith({
    AuthStatus? status,
    AuthSession? session,
    String? error,
    String? email,
    bool? otpSent,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: session ?? this.session,
      error: error,
      email: email ?? this.email,
      otpSent: otpSent ?? this.otpSent,
    );
  }
}

// ── Auth Notifier ──────────────────────────────────────────────────────────

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._service) : super(const AuthState());

  final AuthService _service;

  Future<void> checkSession() async {
    state = state.copyWith(status: AuthStatus.loading);
    final loggedIn = await _service.isLoggedIn;
    state = state.copyWith(
      status: loggedIn ? AuthStatus.authenticated : AuthStatus.unauthenticated,
    );
  }

  /// Called by LoginPage after any successful auth API call to mark the
  /// user as authenticated without repeating session storage logic here.
  void setAuthenticated(AuthSession session) {
    state = state.copyWith(
      status:  AuthStatus.authenticated,
      session: session,
      error:   null,
    );
  }

  Future<bool> sendOtp(String email) async {
    state = state.copyWith(status: AuthStatus.loading, email: email);
    try {
      final sent = await _service.sendOtp(email: email);
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        otpSent: sent,
      );
      return sent;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        error: e.toString(),
      );
      return false;
    }
  }

  Future<bool> verifyOtp({
    required String code,
    required String otpPurpose,
    String? phone,
    String? name,
  }) async {
    if (state.email == null) return false;
    state = state.copyWith(status: AuthStatus.loading);
    try {
      final session = await _service.verifyOtp(
        email:      state.email!,
        code:       code,
        otpPurpose: otpPurpose,
        phone:      phone,
        name:       name,
      );
      state = state.copyWith(
        status: AuthStatus.authenticated,
        session: session,
        otpSent: false,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        error: e.toString(),
      );
      return false;
    }
  }

  Future<void> logout() async {
    await _service.logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

// ── Providers ──────────────────────────────────────────────────────────────

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(authServiceProvider));
});

final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authProvider).isAuthenticated;
});
