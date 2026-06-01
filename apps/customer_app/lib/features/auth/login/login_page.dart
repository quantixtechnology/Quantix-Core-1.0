import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../providers/auth_provider.dart';
import '../services/auth_service.dart';

// ============================================================================
// LoginPage — email-first authentication flow
//
// Flow:
//   1. email    → user enters email; check-customer API determines next step
//   2. register → new users fill Name + Phone (email pre-filled, read-only)
//   3. login    → existing users: OTP tab | Password tab
//   4. otp      → 6-digit verification code (register / login / forgot)
//   5. forgot   → email input → send recovery OTP
//   6. reset    → code + new password
// ============================================================================

enum _AuthView { email, register, login, otp, forgot, reset }

enum _LoginMode { otp, password }

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  _AuthView  _view      = _AuthView.email;
  _LoginMode _loginMode = _LoginMode.otp;
  bool       _loading   = false;
  String     _error     = '';
  bool       _hasPassword = false;

  // Step 1 — email entry
  final _emailCtrl = TextEditingController();

  // Step 2a — registration
  final _nameCtrl  = TextEditingController();
  final _phoneCtrl = TextEditingController();

  // Step 2b — password login
  final _pwCtrl = TextEditingController();
  bool  _showPw = false;

  // OTP verification
  final _otpCtrl    = TextEditingController();
  String _otpEmail   = '';
  String _otpPurpose = 'login';
  String _otpPhone   = '';
  String _otpName    = '';
  String _otpMasked  = '';

  // Forgot / reset
  final _forgotEmailCtrl = TextEditingController();
  final _resetCodeCtrl   = TextEditingController();
  final _newPwCtrl       = TextEditingController();
  final _confirmPwCtrl   = TextEditingController();
  bool  _showNewPw       = false;
  String _forgotResolved = '';
  String _forgotMasked   = '';

  // OTP resend cooldown
  DateTime? _resendAvailableAt;
  bool get _canResend =>
      _resendAvailableAt == null || DateTime.now().isAfter(_resendAvailableAt!);

  @override
  void dispose() {
    _emailCtrl.dispose();
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _pwCtrl.dispose();
    _otpCtrl.dispose();
    _forgotEmailCtrl.dispose();
    _resetCodeCtrl.dispose();
    _newPwCtrl.dispose();
    _confirmPwCtrl.dispose();
    super.dispose();
  }

  AuthService get _service => ref.read(authServiceProvider);

  void _err(String msg)  => setState(() => _error = msg);
  void _clearErr()       => setState(() => _error = '');

  // ── Step 1: check customer ─────────────────────────────────────────────────

  Future<void> _handleEmailCheck() async {
    final email = _emailCtrl.text.trim().toLowerCase();
    if (!_isValidEmail(email)) { _err('Enter a valid email address'); return; }
    _clearErr();
    setState(() => _loading = true);
    try {
      final result = await _service.checkCustomer(email);
      setState(() {
        if (!result.exists) {
          _nameCtrl.clear();
          _phoneCtrl.clear();
          _view = _AuthView.register;
        } else {
          _hasPassword = result.hasPassword;
          _loginMode   = _LoginMode.otp;
          _view        = _AuthView.login;
        }
      });
    } catch (e) {
      _err(_friendly(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  // ── Step 2a: register (new customer) ──────────────────────────────────────

  Future<void> _handleRegister() async {
    final email = _emailCtrl.text.trim().toLowerCase();
    final name  = _nameCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    if (name.length < 2)    { _err('Enter your full name');                  return; }
    if (phone.length != 10) { _err('Enter a valid 10-digit mobile number'); return; }
    _clearErr();
    setState(() => _loading = true);
    try {
      await _service.sendOtp(email: email);
      _goToOtp(email: email, phone: '+91$phone', name: name, purpose: 'register');
    } catch (e) {
      _err(_friendly(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  // ── Step 2b: login via OTP ────────────────────────────────────────────────

  Future<void> _handleLoginOtp() async {
    final email = _emailCtrl.text.trim().toLowerCase();
    _clearErr();
    setState(() => _loading = true);
    try {
      await _service.sendOtp(email: email);
      _goToOtp(email: email, phone: '', name: '', purpose: 'login');
    } catch (e) {
      _err(_friendly(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  // ── Step 2b: login via password ────────────────────────────────────────────

  Future<void> _handlePasswordLogin() async {
    final email    = _emailCtrl.text.trim().toLowerCase();
    final password = _pwCtrl.text;
    if (password.isEmpty) { _err('Enter your password'); return; }
    _clearErr();
    setState(() => _loading = true);
    try {
      final session = await _service.loginWithPassword(
          email: email, password: password);
      ref.read(authProvider.notifier).setAuthenticated(session);
    } catch (e) {
      _err(_friendly(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  // ── OTP helpers ────────────────────────────────────────────────────────────

  void _goToOtp({
    required String email,
    required String phone,
    required String name,
    required String purpose,
  }) {
    setState(() {
      _otpEmail   = email;
      _otpPhone   = phone;
      _otpName    = name;
      _otpPurpose = purpose;
      _otpMasked  = _maskEmail(email);
      _otpCtrl.clear();
      _resendAvailableAt = DateTime.now().add(const Duration(seconds: 30));
      _view = _AuthView.otp;
    });
  }

  Future<void> _handleVerify() async {
    if (_otpCtrl.text.length < 6) return;
    _clearErr();
    setState(() => _loading = true);
    try {
      final session = await _service.verifyOtp(
        email:      _otpEmail,
        code:       _otpCtrl.text.trim(),
        otpPurpose: _otpPurpose,
        phone:      _otpPhone.isNotEmpty ? _otpPhone : null,
        name:       _otpName.isNotEmpty  ? _otpName  : null,
      );
      ref.read(authProvider.notifier).setAuthenticated(session);
    } catch (e) {
      _err(_friendly(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _handleResendOtp() async {
    if (!_canResend || _loading) return;
    _clearErr();
    setState(() => _loading = true);
    try {
      await _service.sendOtp(email: _otpEmail);
      setState(() {
        _otpCtrl.clear();
        _resendAvailableAt = DateTime.now().add(const Duration(seconds: 30));
      });
    } catch (e) {
      _err(_friendly(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  // ── Forgot password ────────────────────────────────────────────────────────

  Future<void> _handleForgotSend() async {
    final email = _forgotEmailCtrl.text.trim().toLowerCase();
    if (!_isValidEmail(email)) { _err('Enter a valid email address'); return; }
    _clearErr();
    setState(() => _loading = true);
    try {
      await _service.sendForgotOtp(email: email);
      setState(() {
        _forgotResolved    = email;
        _forgotMasked      = _maskEmail(email);
        _resetCodeCtrl.clear();
        _newPwCtrl.clear();
        _confirmPwCtrl.clear();
        _resendAvailableAt = DateTime.now().add(const Duration(seconds: 30));
        _view = _AuthView.reset;
      });
    } catch (e) {
      _err(_friendly(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _handleResendForgotOtp() async {
    if (!_canResend || _loading) return;
    _clearErr();
    setState(() => _loading = true);
    try {
      await _service.sendForgotOtp(email: _forgotResolved);
      setState(() {
        _resetCodeCtrl.clear();
        _resendAvailableAt = DateTime.now().add(const Duration(seconds: 30));
      });
    } catch (e) {
      _err(_friendly(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  // ── Reset password ─────────────────────────────────────────────────────────

  Future<void> _handleReset() async {
    final code   = _resetCodeCtrl.text.trim();
    final newPw  = _newPwCtrl.text;
    final confPw = _confirmPwCtrl.text;
    if (code.length < 6)      { _err('Enter the 6-digit recovery code');     return; }
    if (!_isStrongPw(newPw))  { _err('Password does not meet requirements'); return; }
    if (newPw != confPw)       { _err('Passwords do not match');              return; }
    _clearErr();
    setState(() => _loading = true);
    try {
      final session = await _service.resetPassword(
        email:    _forgotResolved,
        code:     code,
        password: newPw,
      );
      ref.read(authProvider.notifier).setAuthenticated(session);
    } catch (e) {
      _err(_friendly(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  bool _isValidEmail(String e) =>
      RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(e);

  bool _isStrongPw(String p) =>
      p.length >= 8 &&
      p.contains(RegExp(r'[A-Z]')) &&
      p.contains(RegExp(r'[a-z]')) &&
      p.contains(RegExp(r'[0-9]')) &&
      p.contains(RegExp(r'[^A-Za-z0-9]'));

  String _maskEmail(String email) {
    final parts = email.split('@');
    if (parts.length != 2) return email;
    final local = parts[0];
    if (local.length <= 2) return '**@${parts[1]}';
    return '${local[0]}${'*' * (local.length - 2)}${local[local.length - 1]}@${parts[1]}';
  }

  String _friendly(dynamic e) {
    final msg = e.toString().replaceFirst('Exception: ', '');
    return msg.length > 120 ? 'Something went wrong. Please try again.' : msg;
  }

  void _goBack() {
    setState(() {
      _error = '';
      switch (_view) {
        case _AuthView.register:
        case _AuthView.login:
        case _AuthView.forgot:
          _view = _AuthView.email;
        case _AuthView.otp:
          _view = _otpPurpose == 'register' ? _AuthView.register : _AuthView.email;
        case _AuthView.reset:
          _view = _AuthView.forgot;
        case _AuthView.email:
          break;
      }
    });
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  static const _titles = {
    _AuthView.email:    'Sign In or Register',
    _AuthView.register: 'Create Account',
    _AuthView.login:    'Welcome Back',
    _AuthView.otp:      'Enter Code',
    _AuthView.forgot:   'Reset Password',
    _AuthView.reset:    'Set New Password',
  };

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    const appName = AppConfig.appName;
    final initial = appName.isNotEmpty ? appName[0].toUpperCase() : 'Q';

    return Scaffold(
      backgroundColor: Colors.grey[50],
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Brand header ────────────────────────────────────────────
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 56, height: 56,
                      decoration: BoxDecoration(
                        color:        primary,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Center(
                        child: Text(
                          initial,
                          style: const TextStyle(
                            color: Colors.white, fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _titles[_view]!,
                      style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold,
                        color: Color(0xFF111827),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              // ── Back link ────────────────────────────────────────────────
              if (_view != _AuthView.email) ...[
                GestureDetector(
                  onTap: _goBack,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.arrow_back_ios_new,
                          size: 14, color: Color(0xFF6B7280)),
                      const SizedBox(width: 4),
                      Text(
                        _view == _AuthView.register || _view == _AuthView.login
                            ? 'Use a different email'
                            : 'Back',
                        style: const TextStyle(
                          fontSize: 13, color: Color(0xFF6B7280),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // ── Error banner ─────────────────────────────────────────────
              if (_error.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color:  const Color(0xFFFEF2F2),
                    border: Border.all(color: const Color(0xFFFECACA)),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline,
                          size: 16, color: Color(0xFFEF4444)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _error,
                          style: const TextStyle(
                            fontSize: 13, color: Color(0xFF991B1B),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // ── View content ─────────────────────────────────────────────
              _buildViewContent(primary),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildViewContent(Color primary) {
    switch (_view) {
      case _AuthView.email:    return _buildEmailView(primary);
      case _AuthView.register: return _buildRegisterView(primary);
      case _AuthView.login:    return _buildLoginView(primary);
      case _AuthView.otp:      return _buildOtpView(primary);
      case _AuthView.forgot:   return _buildForgotView(primary);
      case _AuthView.reset:    return _buildResetView(primary);
    }
  }

  // ── EMAIL VIEW ─────────────────────────────────────────────────────────────

  Widget _buildEmailView(Color primary) {
    final valid = _isValidEmail(_emailCtrl.text.trim());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Enter your email address to continue.',
          style: TextStyle(fontSize: 13, color: Colors.grey[600]),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),
        _InputField(
          controller:   _emailCtrl,
          hint:         'Email Address',
          icon:         Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          onChanged:    (_) => setState(() => _clearErr()),
          onSubmitted:  (_) => _handleEmailCheck(),
        ),
        const SizedBox(height: 16),
        _PrimaryButton(
          label:    'Continue',
          loading:  _loading,
          disabled: !valid,
          color:    primary,
          onTap:    _handleEmailCheck,
        ),
        const SizedBox(height: 12),
        GestureDetector(
          onTap: () => setState(() {
            _forgotEmailCtrl.clear();
            _view  = _AuthView.forgot;
            _error = '';
          }),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.help_outline, size: 14, color: primary),
              const SizedBox(width: 4),
              Text(
                'Forgot password?',
                style: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600, color: primary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── REGISTER VIEW ──────────────────────────────────────────────────────────

  Widget _buildRegisterView(Color primary) {
    final email = _emailCtrl.text.trim().toLowerCase();
    final valid = _nameCtrl.text.trim().length >= 2 &&
                  _phoneCtrl.text.trim().length == 10;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'No account found for this email. Please create one.',
          style: TextStyle(fontSize: 13, color: Colors.grey[600]),
        ),
        const SizedBox(height: 20),
        _InputField(
          controller: TextEditingController(text: email),
          hint:       'Email Address',
          icon:       Icons.email_outlined,
          readOnly:   true,
        ),
        _InputField(
          controller: _nameCtrl,
          hint:       'Full Name',
          icon:       Icons.person_outline,
          onChanged:  (_) => setState(() {}),
        ),
        _PhoneField(
          controller: _phoneCtrl,
          onChanged:  (_) => setState(() {}),
        ),
        const SizedBox(height: 16),
        _PrimaryButton(
          label:    'Send Verification Code',
          loading:  _loading,
          disabled: !valid,
          color:    primary,
          onTap:    _handleRegister,
        ),
      ],
    );
  }

  // ── LOGIN VIEW ─────────────────────────────────────────────────────────────

  Widget _buildLoginView(Color primary) {
    final email = _emailCtrl.text.trim().toLowerCase();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Mode tabs — only show when customer has a password
        if (_hasPassword) ...[
          Container(
            height: 40,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              border:       Border.all(color: Colors.grey[200]!),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                _TabBtn(
                  label:  'Email OTP',
                  active: _loginMode == _LoginMode.otp,
                  color:  primary,
                  onTap:  () => setState(() {
                    _loginMode = _LoginMode.otp; _clearErr();
                  }),
                ),
                _TabBtn(
                  label:  'Password',
                  active: _loginMode == _LoginMode.password,
                  color:  primary,
                  onTap:  () => setState(() {
                    _loginMode = _LoginMode.password; _clearErr();
                  }),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        if (_loginMode == _LoginMode.otp) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color:  const Color(0xFFEFF6FF),
              border: Border.all(color: const Color(0xFFBFDBFE)),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(Icons.email_outlined,
                    size: 16, color: Color(0xFF3B82F6)),
                const SizedBox(width: 8),
                Expanded(
                  child: RichText(
                    text: TextSpan(
                      style: const TextStyle(
                          fontSize: 13, color: Color(0xFF1E3A5F)),
                      children: [
                        const TextSpan(text: 'A code will be sent to '),
                        TextSpan(
                          text: _maskEmail(email),
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _PrimaryButton(
            label:   'Send Verification Code',
            loading: _loading,
            color:   primary,
            onTap:   _handleLoginOtp,
          ),
        ] else ...[
          _PasswordField(
            controller:  _pwCtrl,
            show:        _showPw,
            hint:        'Password',
            onChanged:   (_) => setState(() {}),
            onToggle:    () => setState(() => _showPw = !_showPw),
            onSubmitted: (_) => _handlePasswordLogin(),
          ),
          const SizedBox(height: 8),
          _PrimaryButton(
            label:    'Login',
            loading:  _loading,
            disabled: _pwCtrl.text.isEmpty,
            color:    primary,
            onTap:    _handlePasswordLogin,
          ),
        ],

        const SizedBox(height: 12),
        GestureDetector(
          onTap: () => setState(() {
            _forgotEmailCtrl.text = email;
            _view  = _AuthView.forgot;
            _error = '';
          }),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.help_outline, size: 14, color: primary),
              const SizedBox(width: 4),
              Text(
                'Forgot password?',
                style: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600, color: primary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── OTP VIEW ───────────────────────────────────────────────────────────────

  Widget _buildOtpView(Color primary) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color:  const Color(0xFFEFF6FF),
            border: Border.all(color: const Color(0xFFBFDBFE)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              const Icon(Icons.email_outlined,
                  size: 16, color: Color(0xFF3B82F6)),
              const SizedBox(width: 8),
              Expanded(
                child: RichText(
                  text: TextSpan(
                    style: const TextStyle(
                        fontSize: 13, color: Color(0xFF1E3A5F)),
                    children: [
                      const TextSpan(text: 'Code sent to '),
                      TextSpan(
                        text: _otpMasked,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        TextField(
          controller:   _otpCtrl,
          keyboardType: TextInputType.number,
          maxLength:    6,
          textAlign:    TextAlign.center,
          style: const TextStyle(
            fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: 12,
          ),
          decoration: InputDecoration(
            counterText: '',
            hintText:    '------',
            hintStyle: TextStyle(
              fontSize: 28, letterSpacing: 12,
              color:    Colors.grey[300], fontWeight: FontWeight.bold,
            ),
            contentPadding: const EdgeInsets.symmetric(vertical: 16),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:   BorderSide(color: Colors.grey[200]!),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:   BorderSide(color: Colors.grey[200]!),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:   BorderSide(color: Colors.grey[400]!),
            ),
          ),
          onChanged: (_) => setState(() => _clearErr()),
        ),
        const SizedBox(height: 16),

        _PrimaryButton(
          label:    'Verify & Continue',
          loading:  _loading,
          disabled: _otpCtrl.text.length < 6,
          color:    primary,
          onTap:    _handleVerify,
        ),
        const SizedBox(height: 12),

        Center(
          child: GestureDetector(
            onTap: _canResend ? _handleResendOtp : null,
            child: Opacity(
              opacity: _canResend ? 1.0 : 0.4,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.refresh, size: 14, color: primary),
                  const SizedBox(width: 4),
                  Text(
                    'Resend code',
                    style: TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600, color: primary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── FORGOT VIEW ────────────────────────────────────────────────────────────

  Widget _buildForgotView(Color primary) {
    final valid = _isValidEmail(_forgotEmailCtrl.text.trim());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          "Enter your registered email and we'll send a recovery code.",
          style: TextStyle(fontSize: 13, color: Colors.grey[600]),
        ),
        const SizedBox(height: 20),
        _InputField(
          controller:   _forgotEmailCtrl,
          hint:         'Email Address',
          icon:         Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          onChanged:    (_) => setState(() => _clearErr()),
          onSubmitted:  (_) => _handleForgotSend(),
        ),
        const SizedBox(height: 16),
        _PrimaryButton(
          label:    'Send Recovery Code',
          loading:  _loading,
          disabled: !valid,
          color:    primary,
          onTap:    _handleForgotSend,
        ),
      ],
    );
  }

  // ── RESET VIEW ─────────────────────────────────────────────────────────────

  Widget _buildResetView(Color primary) {
    final newPw  = _newPwCtrl.text;
    final confPw = _confirmPwCtrl.text;
    final pwMatch = newPw == confPw;
    final pwRules = [
      _PwRule('8+ characters', newPw.length >= 8),
      _PwRule('Uppercase',     newPw.contains(RegExp(r'[A-Z]'))),
      _PwRule('Lowercase',     newPw.contains(RegExp(r'[a-z]'))),
      _PwRule('Number',        newPw.contains(RegExp(r'[0-9]'))),
      _PwRule('Special char',  newPw.contains(RegExp(r'[^A-Za-z0-9]'))),
    ];
    final isValid = _resetCodeCtrl.text.trim().length == 6 &&
                    _isStrongPw(newPw) && pwMatch;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color:  const Color(0xFFEFF6FF),
            border: Border.all(color: const Color(0xFFBFDBFE)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              const Icon(Icons.email_outlined,
                  size: 14, color: Color(0xFF3B82F6)),
              const SizedBox(width: 8),
              Expanded(
                child: RichText(
                  text: TextSpan(
                    style: const TextStyle(
                        fontSize: 13, color: Color(0xFF1E3A5F)),
                    children: [
                      const TextSpan(text: 'Recovery code sent to '),
                      TextSpan(
                        text: _forgotMasked,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        TextField(
          controller:   _resetCodeCtrl,
          keyboardType: TextInputType.number,
          maxLength:    6,
          textAlign:    TextAlign.center,
          style: const TextStyle(
            fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: 12,
          ),
          decoration: InputDecoration(
            counterText: '',
            hintText:    '------',
            hintStyle: TextStyle(
              fontSize: 28, letterSpacing: 12,
              color:    Colors.grey[300], fontWeight: FontWeight.bold,
            ),
            contentPadding: const EdgeInsets.symmetric(vertical: 16),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:   BorderSide(color: Colors.grey[200]!),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:   BorderSide(color: Colors.grey[200]!),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:   BorderSide(color: Colors.grey[400]!),
            ),
          ),
          onChanged: (_) => setState(() => _clearErr()),
        ),
        const SizedBox(height: 4),

        Center(
          child: GestureDetector(
            onTap: _canResend ? _handleResendForgotOtp : null,
            child: Opacity(
              opacity: _canResend ? 1.0 : 0.4,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.refresh, size: 14, color: primary),
                  const SizedBox(width: 4),
                  Text(
                    'Resend code',
                    style: TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600, color: primary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),

        const Text(
          'New Password',
          style: TextStyle(
            fontSize: 11, fontWeight: FontWeight.w600,
            color: Color(0xFF4B5563),
          ),
        ),
        const SizedBox(height: 6),
        _PasswordField(
          controller: _newPwCtrl,
          show:       _showNewPw,
          hint:       'New password',
          onChanged:  (_) => setState(() {}),
          onToggle:   () => setState(() => _showNewPw = !_showNewPw),
        ),

        if (newPw.isNotEmpty) ...[
          Wrap(
            spacing: 8, runSpacing: 4,
            children: pwRules
                .map((r) => _RuleChip(label: r.label, met: r.met))
                .toList(),
          ),
          const SizedBox(height: 8),
        ],

        TextField(
          obscureText: true,
          controller:  _confirmPwCtrl,
          onChanged:   (_) => setState(() {}),
          decoration: InputDecoration(
            hintText:  'Confirm password',
            hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
            contentPadding: const EdgeInsets.symmetric(
                horizontal: 16, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: confPw.isNotEmpty && !pwMatch
                    ? Colors.red[300]!
                    : Colors.grey[200]!,
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: confPw.isNotEmpty && !pwMatch
                    ? Colors.red[300]!
                    : Colors.grey[200]!,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey[400]!),
            ),
          ),
        ),
        if (confPw.isNotEmpty && !pwMatch) ...[
          const SizedBox(height: 4),
          const Text(
            'Passwords do not match',
            style: TextStyle(fontSize: 11, color: Color(0xFFEF4444)),
          ),
        ],
        const SizedBox(height: 20),

        _PrimaryButton(
          label:    'Set Password & Login',
          loading:  _loading,
          disabled: !isValid,
          color:    primary,
          onTap:    _handleReset,
        ),
      ],
    );
  }
}

// ── Data helpers ───────────────────────────────────────────────────────────────

class _PwRule {
  const _PwRule(this.label, this.met);
  final String label;
  final bool   met;
}

// ── Reusable widgets ───────────────────────────────────────────────────────────

class _InputField extends StatelessWidget {
  const _InputField({
    required this.controller,
    required this.hint,
    required this.icon,
    this.keyboardType,
    this.readOnly    = false,
    this.onChanged,
    this.onSubmitted,
  });

  final TextEditingController  controller;
  final String                 hint;
  final IconData               icon;
  final TextInputType?         keyboardType;
  final bool                   readOnly;
  final ValueChanged<String>?  onChanged;
  final ValueChanged<String>?  onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller:   controller,
        readOnly:     readOnly,
        keyboardType: keyboardType,
        onChanged:    onChanged,
        onSubmitted:  onSubmitted,
        decoration: InputDecoration(
          hintText:  hint,
          hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
          prefixIcon: Icon(icon, size: 18, color: Colors.grey[400]),
          filled:    readOnly,
          fillColor: readOnly ? Colors.grey[50] : null,
          contentPadding: const EdgeInsets.symmetric(
              horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   BorderSide(color: Colors.grey[200]!),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   BorderSide(color: Colors.grey[200]!),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   BorderSide(color: Colors.grey[400]!),
          ),
        ),
      ),
    );
  }
}

class _PhoneField extends StatelessWidget {
  const _PhoneField({required this.controller, this.onChanged});

  final TextEditingController  controller;
  final ValueChanged<String>?  onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller:   controller,
        keyboardType: TextInputType.number,
        maxLength:    10,
        onChanged: onChanged == null
            ? null
            : (v) => onChanged!(v.replaceAll(RegExp(r'[^0-9]'), '')),
        decoration: InputDecoration(
          counterText: '',
          hintText:    'Mobile Number',
          hintStyle:   TextStyle(fontSize: 14, color: Colors.grey[400]),
          prefixIcon: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(width: 12),
              const Icon(Icons.phone_outlined,
                  size: 18, color: Color(0xFF9CA3AF)),
              const SizedBox(width: 6),
              Text('+91', style: TextStyle(
                  fontSize: 14, color: Colors.grey[700])),
              Container(
                width: 1, height: 20,
                margin: const EdgeInsets.symmetric(horizontal: 8),
                color: Colors.grey[200],
              ),
            ],
          ),
          contentPadding: const EdgeInsets.symmetric(
              horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   BorderSide(color: Colors.grey[200]!),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   BorderSide(color: Colors.grey[200]!),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   BorderSide(color: Colors.grey[400]!),
          ),
        ),
      ),
    );
  }
}

class _PasswordField extends StatelessWidget {
  const _PasswordField({
    required this.controller,
    required this.show,
    required this.hint,
    required this.onToggle,
    this.onChanged,
    this.onSubmitted,
  });

  final TextEditingController  controller;
  final bool                   show;
  final String                 hint;
  final VoidCallback           onToggle;
  final ValueChanged<String>?  onChanged;
  final ValueChanged<String>?  onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller:  controller,
        obscureText: !show,
        onChanged:   onChanged,
        onSubmitted: onSubmitted,
        decoration: InputDecoration(
          hintText:  hint,
          hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
          prefixIcon: const Icon(Icons.lock_outline,
              size: 18, color: Color(0xFF9CA3AF)),
          suffixIcon: IconButton(
            icon: Icon(
              show
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined,
              size: 18, color: Colors.grey[400],
            ),
            onPressed: onToggle,
          ),
          contentPadding: const EdgeInsets.symmetric(
              horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   BorderSide(color: Colors.grey[200]!),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   BorderSide(color: Colors.grey[200]!),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   BorderSide(color: Colors.grey[400]!),
          ),
        ),
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.label,
    required this.loading,
    required this.color,
    required this.onTap,
    this.disabled = false,
  });

  final String       label;
  final bool         loading;
  final bool         disabled;
  final Color        color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final active = !disabled && !loading;
    return SizedBox(
      height: 48,
      child: ElevatedButton(
        onPressed: active ? onTap : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: active ? color : Colors.grey[200],
          foregroundColor: active ? Colors.white : Colors.grey[400],
          elevation:       0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: loading
            ? const SizedBox(
                width: 20, height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2, color: Colors.white,
                ),
              )
            : Text(
                label,
                style: const TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w600,
                ),
              ),
      ),
    );
  }
}

class _TabBtn extends StatelessWidget {
  const _TabBtn({
    required this.label,
    required this.active,
    required this.color,
    required this.onTap,
  });

  final String       label;
  final bool         active;
  final Color        color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height:       double.infinity,
          decoration: BoxDecoration(
            color:        active ? color : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12, fontWeight: FontWeight.w600,
              color: active ? Colors.white : Colors.grey[500],
            ),
          ),
        ),
      ),
    );
  }
}

class _RuleChip extends StatelessWidget {
  const _RuleChip({required this.label, required this.met});
  final String label;
  final bool   met;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color:        met ? const Color(0xFFD1FAE5) : Colors.grey[100],
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            met ? Icons.check_circle_outline : Icons.radio_button_unchecked,
            size:  11,
            color: met ? const Color(0xFF059669) : Colors.grey[400],
          ),
          const SizedBox(width: 3),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: met ? const Color(0xFF065F46) : Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }
}
