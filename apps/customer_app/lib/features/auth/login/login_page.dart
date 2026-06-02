import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/contracts/auth_dto.dart';
import '../providers/auth_provider.dart';
import '../services/auth_service.dart';

// ============================================================================
// LoginPage — email-first authentication flow
//
// NEW CUSTOMER:   email → register → otp → setInitialPassword → home
// EXISTING + PW:  email → login (password only) → home
// EXISTING - PW:  email → otpSetup → otp → setInitialPassword → home
// FORGOT:         email → forgot → forgotSent ("check your email")
//                 reset-password link opens in device browser
// ============================================================================

enum _AuthView {
  email,
  register,
  login,
  otpSetup,
  otp,
  setInitialPassword,
  forgot,
  forgotSent,
}

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  _AuthView _view    = _AuthView.email;
  bool      _loading = false;
  String    _error   = '';

  // Step 1 — email entry
  final _emailCtrl = TextEditingController();

  // Step 2a — registration (new customer)
  final _nameCtrl  = TextEditingController();
  final _phoneCtrl = TextEditingController();

  // Step 2b — password login (existing customer with password)
  final _pwCtrl = TextEditingController();
  bool  _showPw = false;

  // OTP setup prompt (existing customer with NO password)
  String _otpSetupEmail = '';

  // OTP verification
  final _otpCtrl  = TextEditingController();
  String _otpEmail   = '';
  String _otpPurpose = 'register';
  String _otpPhone   = '';
  String _otpName    = '';
  String _otpMasked  = '';

  // Set-initial-password (after OTP for new / no-password users)
  // pendingSession is held here until the password is set, then saved.
  AuthSession? _pendingSession;
  final _initPwCtrl   = TextEditingController();
  final _initConfCtrl = TextEditingController();
  bool  _showInitPw   = false;
  bool  _showInitConf = false;

  // Forgot password
  final _forgotEmailCtrl = TextEditingController();
  String _forgotEmailSent = '';

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
    _initPwCtrl.dispose();
    _initConfCtrl.dispose();
    _forgotEmailCtrl.dispose();
    super.dispose();
  }

  AuthService get _service => ref.read(authServiceProvider);

  void _err(String msg) => setState(() => _error = msg);
  void _clearErr()      => setState(() => _error = '');

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
    _clearErr();
    setState(() {
      switch (_view) {
        case _AuthView.register:
        case _AuthView.login:
        case _AuthView.otpSetup:
        case _AuthView.forgot:
        case _AuthView.forgotSent:
          _view = _AuthView.email;
        case _AuthView.otp:
          _view = _otpPurpose == 'register'
              ? _AuthView.register
              : _AuthView.email;
        case _AuthView.setInitialPassword:
          // Can't go back from password setup — user must set a password.
          // Redirect to email entry and let them start over.
          _pendingSession = null;
          _view = _AuthView.email;
        case _AuthView.email:
          break;
      }
    });
  }

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
        } else if (result.hasPassword) {
          // Existing customer with password — show password screen only
          _pwCtrl.clear();
          _view = _AuthView.login;
        } else {
          // Existing customer without password — OTP then set password
          _otpSetupEmail = email;
          _view = _AuthView.otpSetup;
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

  // ── Step 2b: existing customer without password — send OTP ────────────────

  Future<void> _handleSendSetupOtp() async {
    _clearErr();
    setState(() => _loading = true);
    try {
      await _service.sendOtp(email: _otpSetupEmail);
      _goToOtp(email: _otpSetupEmail, phone: '', name: '', purpose: 'login');
    } catch (e) {
      _err(_friendly(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  // ── Step 2c: password login ────────────────────────────────────────────────

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

  // ── Step 3: OTP verify ─────────────────────────────────────────────────────

  Future<void> _handleVerify() async {
    if (_otpCtrl.text.length < 6) return;
    _clearErr();
    setState(() => _loading = true);
    try {
      final result = await _service.verifyOtp(
        email:      _otpEmail,
        code:       _otpCtrl.text.trim(),
        otpPurpose: _otpPurpose,
        phone:      _otpPhone.isNotEmpty ? _otpPhone : null,
        name:       _otpName.isNotEmpty  ? _otpName  : null,
      );

      if (result.requirePasswordSetup) {
        // Hold session — must set password before logging in
        setState(() {
          _pendingSession = result.session;
          _initPwCtrl.clear();
          _initConfCtrl.clear();
          _view = _AuthView.setInitialPassword;
        });
      } else {
        ref.read(authProvider.notifier).setAuthenticated(result.session);
      }
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

  // ── Step 4: set initial password (after OTP) ──────────────────────────────

  Future<void> _handleSetInitialPassword() async {
    final pw   = _initPwCtrl.text;
    final conf = _initConfCtrl.text;
    if (!_isStrongPw(pw))  { _err('Password does not meet requirements'); return; }
    if (pw != conf)         { _err('Passwords do not match');              return; }
    if (_pendingSession == null) { _err('Session expired. Please try again.'); return; }
    _clearErr();
    setState(() => _loading = true);
    try {
      await _service.setInitialPassword(
        refreshToken:    _pendingSession!.refreshToken ?? '',
        password:        pw,
        confirmPassword: conf,
      );
      // Password set — now save the session and log in
      await _service.saveSession(_pendingSession!);
      ref.read(authProvider.notifier).setAuthenticated(_pendingSession!);
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
      await _service.sendForgotOtp(email: email); // calls forgot-password (token link)
      setState(() {
        _forgotEmailSent = email;
        _view = _AuthView.forgotSent;
      });
    } catch (_) {
      // Anti-enumeration: always show "check email" even on error
      setState(() {
        _forgotEmailSent = email;
        _view = _AuthView.forgotSent;
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  // ── Title map ──────────────────────────────────────────────────────────────

  static final Map<_AuthView, String> _titles = {
    _AuthView.email:               'Sign In or Register',
    _AuthView.register:            'Create Account',
    _AuthView.login:               'Welcome Back',
    _AuthView.otpSetup:            'Verify Your Email',
    _AuthView.otp:                 'Enter Code',
    _AuthView.setInitialPassword:  'Set Your Password',
    _AuthView.forgot:              'Reset Password',
    _AuthView.forgotSent:          'Check Your Email',
  };

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final branding = ref.watch(authProvider).branding;
    final primary  = branding?.primaryColor != null
        ? Color(int.parse(branding!.primaryColor!.replaceFirst('#', '0xFF')))
        : const Color(0xFF10B981);

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Back button
              if (_view != _AuthView.email) ...[
                GestureDetector(
                  onTap: _goBack,
                  child: Row(
                    children: [
                      Icon(Icons.arrow_back_ios_new,
                          size: 16, color: Colors.grey[600]),
                      const SizedBox(width: 4),
                      Text('Back',
                          style: TextStyle(
                            fontSize: 13, color: Colors.grey[600])),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // Header
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 52, height: 52,
                      decoration: BoxDecoration(
                        color:        primary,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        (AppConfig.appName.isNotEmpty
                            ? AppConfig.appName[0]
                            : 'Q').toUpperCase(),
                        style: const TextStyle(
                          fontSize: 24, fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _titles[_view] ?? '',
                      style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold,
                        color: Color(0xFF111827),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Error banner
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
                        child: Text(_error,
                            style: const TextStyle(
                              fontSize: 13, color: Color(0xFF991B1B))),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Active view
              _buildView(primary),

              const SizedBox(height: 24),
              Text(
                'By continuing, you agree to our Terms & Privacy Policy.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: Colors.grey[400]),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildView(Color primary) {
    switch (_view) {
      case _AuthView.email:              return _buildEmailView(primary);
      case _AuthView.register:           return _buildRegisterView(primary);
      case _AuthView.login:              return _buildLoginView(primary);
      case _AuthView.otpSetup:           return _buildOtpSetupView(primary);
      case _AuthView.otp:                return _buildOtpView(primary);
      case _AuthView.setInitialPassword: return _buildSetInitialPasswordView(primary);
      case _AuthView.forgot:             return _buildForgotView(primary);
      case _AuthView.forgotSent:         return _buildForgotSentView(primary);
    }
  }

  // ── EMAIL VIEW ─────────────────────────────────────────────────────────────

  Widget _buildEmailView(Color primary) {
    final valid = _isValidEmail(_emailCtrl.text.trim());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Enter your email to sign in or create an account.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 13, color: Colors.grey[600]),
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
            _forgotEmailCtrl.text = _emailCtrl.text.trim();
            _view  = _AuthView.forgot;
            _error = '';
          }),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.help_outline, size: 14, color: primary),
              const SizedBox(width: 4),
              Text('Forgot password?',
                  style: TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600, color: primary)),
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
          'No account found. Fill in your details to get started.',
          style: TextStyle(fontSize: 13, color: Colors.grey[600]),
        ),
        const SizedBox(height: 20),
        _InputField(
          controller:  _nameCtrl,
          hint:        'Full Name',
          icon:        Icons.person_outline,
          onChanged:   (_) => setState(() => _clearErr()),
        ),
        _PhoneField(
          controller: _phoneCtrl,
          onChanged:  (_) => setState(() => _clearErr()),
        ),
        _InputField(
          controller:   TextEditingController(text: email),
          hint:         'Email Address',
          icon:         Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          readOnly:     true,
        ),
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

  // ── LOGIN VIEW (password only) ─────────────────────────────────────────────

  Widget _buildLoginView(Color primary) {
    final email = _emailCtrl.text.trim().toLowerCase();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Enter your password for ${_maskEmail(email)}.',
          style: TextStyle(fontSize: 13, color: Colors.grey[600]),
        ),
        const SizedBox(height: 20),
        _PasswordField(
          controller:  _pwCtrl,
          show:        _showPw,
          hint:        'Password',
          onChanged:   (_) => setState(() {}),
          onToggle:    () => setState(() => _showPw = !_showPw),
          onSubmitted: (_) => _handlePasswordLogin(),
        ),
        _PrimaryButton(
          label:    'Sign In',
          loading:  _loading,
          disabled: _pwCtrl.text.isEmpty,
          color:    primary,
          onTap:    _handlePasswordLogin,
        ),
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
              Text('Forgot password?',
                  style: TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600, color: primary)),
            ],
          ),
        ),
      ],
    );
  }

  // ── OTP SETUP VIEW (existing customer, no password) ────────────────────────

  Widget _buildOtpSetupView(Color primary) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color:  const Color(0xFFFFFBEB),
            border: Border.all(color: const Color(0xFFFDE68A)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.key_outlined,
                  size: 16, color: Color(0xFFD97706)),
              const SizedBox(width: 8),
              Expanded(
                child: RichText(
                  text: TextSpan(
                    style: const TextStyle(
                        fontSize: 13, color: Color(0xFF92400E)),
                    children: [
                      const TextSpan(
                        text: "This account doesn't have a password yet. "
                              "We'll send a verification code to ",
                      ),
                      TextSpan(
                        text: _maskEmail(_otpSetupEmail),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const TextSpan(text: ' so you can set one.'),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _PrimaryButton(
          label:   'Send Verification Code',
          loading: _loading,
          color:   primary,
          onTap:   _handleSendSetupOtp,
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
          label:    'Verify',
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
                  Text('Resend code',
                      style: TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600,
                        color: primary)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── SET INITIAL PASSWORD VIEW ──────────────────────────────────────────────

  Widget _buildSetInitialPasswordView(Color primary) {
    final pw      = _initPwCtrl.text;
    final conf    = _initConfCtrl.text;
    final pwMatch = pw == conf;
    final rules   = [
      _PwRule('8+ characters', pw.length >= 8),
      _PwRule('Uppercase',     pw.contains(RegExp(r'[A-Z]'))),
      _PwRule('Lowercase',     pw.contains(RegExp(r'[a-z]'))),
      _PwRule('Number',        pw.contains(RegExp(r'[0-9]'))),
      _PwRule('Special char',  pw.contains(RegExp(r'[^A-Za-z0-9]'))),
    ];
    final isValid = _isStrongPw(pw) && pwMatch && conf.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Email verified. Create a password for your account.',
          style: TextStyle(fontSize: 13, color: Colors.grey[600]),
        ),
        const SizedBox(height: 20),

        _PasswordField(
          controller: _initPwCtrl,
          show:       _showInitPw,
          hint:       'New Password',
          onChanged:  (_) => setState(() {}),
          onToggle:   () => setState(() => _showInitPw = !_showInitPw),
        ),

        if (pw.isNotEmpty) ...[
          Wrap(
            spacing: 8, runSpacing: 4,
            children: rules
                .map((r) => _RuleChip(label: r.label, met: r.met))
                .toList(),
          ),
          const SizedBox(height: 12),
        ],

        _PasswordField(
          controller: _initConfCtrl,
          show:       _showInitConf,
          hint:       'Confirm Password',
          onChanged:  (_) => setState(() {}),
          onToggle:   () => setState(() => _showInitConf = !_showInitConf),
        ),

        if (conf.isNotEmpty && !pwMatch) ...[
          const Text(
            'Passwords do not match',
            style: TextStyle(fontSize: 11, color: Color(0xFFEF4444)),
          ),
          const SizedBox(height: 8),
        ],

        _PrimaryButton(
          label:    'Set Password & Sign In',
          loading:  _loading,
          disabled: !isValid,
          color:    primary,
          onTap:    _handleSetInitialPassword,
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
          "Enter your registered email and we'll send you a password reset link.",
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
        _PrimaryButton(
          label:    'Send Reset Link',
          loading:  _loading,
          disabled: !valid,
          color:    primary,
          onTap:    _handleForgotSend,
        ),
      ],
    );
  }

  // ── FORGOT SENT VIEW ───────────────────────────────────────────────────────

  Widget _buildForgotSentView(Color primary) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Container(
            width: 60, height: 60,
            decoration: BoxDecoration(
              color:        primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(Icons.email_outlined, size: 30, color: primary),
          ),
        ),
        const SizedBox(height: 16),
        RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
            children: [
              const TextSpan(text: 'If '),
              TextSpan(
                text: _forgotEmailSent,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, color: Color(0xFF374151)),
              ),
              const TextSpan(
                text: ' is registered, you\'ll receive a password reset link '
                      'within a minute.\n\nThe link expires in 15 minutes.',
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        GestureDetector(
          onTap: () => setState(() {
            _view  = _AuthView.email;
            _error = '';
            _forgotEmailSent = '';
          }),
          child: Center(
            child: Text('Back to sign in',
                style: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600, color: primary)),
          ),
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
              Text('+91',
                  style: TextStyle(fontSize: 14, color: Colors.grey[700])),
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
            : Text(label,
                style: const TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w600)),
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
          Text(label,
              style: TextStyle(
                fontSize: 10,
                color: met ? const Color(0xFF065F46) : Colors.grey[500],
                fontWeight: FontWeight.w500,
              )),
        ],
      ),
    );
  }
}
