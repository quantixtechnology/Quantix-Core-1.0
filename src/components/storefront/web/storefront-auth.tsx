"use client"

// ============================================================================
// StorefrontAuth — Email-first authentication flow
//
// Flows:
//   NEW CUSTOMER:
//     email → register (name+phone) → otp → set-initial-password → storefront
//
//   EXISTING CUSTOMER (password set):
//     email → login (password only) → storefront
//
//   EXISTING CUSTOMER (no password yet):
//     email → otp-setup (send code) → otp → set-initial-password → storefront
//
//   FORGOT PASSWORD:
//     email → forgot (enter email) → forgot-sent (check email) →
//     /reset-password?token=xxx (separate page) → storefront
//
// Rules:
//   • OTP is ONLY used for first-time email verification.
//   • Existing customers with a password NEVER see an OTP option.
//   • Passwords are MANDATORY — no account is active without one.
//   • Forgot password uses a tokenised email link, NOT a 6-digit OTP.
//   • Name is NEVER derived from the email address.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import {
  Phone, ArrowLeft, Loader2, CheckCircle2, User, Mail,
  AlertCircle, Eye, EyeOff, RefreshCw, HelpCircle, Lock, KeyRound,
} from "lucide-react"
import type { WebNav } from "./storefront-types"

interface StorefrontAuthProps {
  brandColor: string
  nav: WebNav
}

type AuthView =
  | "email"           // step 1: enter email
  | "register"        // new user: enter name + phone
  | "otp-setup"       // existing user with no password: prompt to send OTP
  | "otp"             // 6-digit OTP entry
  | "set-initial-password" // new or no-password user: set password after OTP
  | "login"           // existing user with password: enter password
  | "forgot"          // forgot password: enter email
  | "forgot-sent"     // forgot password: "check your email" confirmation

type OtpPurpose = "register" | "login"

const MAX_ATTEMPTS     = 5
const COOLDOWN_SECONDS = 30

function maskEmail(email: string): string {
  const [user, domain] = email.split("@")
  if (!domain) return email
  return `${user.slice(0, 2)}${"*".repeat(Math.max(3, user.length - 2))}@${domain}`
}

function normalizeEmail(e: string): string { return e.trim().toLowerCase() }
function normalizePhone(p: string): string {
  const d = p.replace(/\D/g, "")
  if (d.length === 10) return `+91${d}`
  if (d.startsWith("91") && d.length === 12) return `+${d}`
  return p.startsWith("+") ? p : `+${d}`
}

const PASSWORD_RULES = [
  { label: "8+ characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase",     test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase",     test: (p: string) => /[a-z]/.test(p) },
  { label: "Number",        test: (p: string) => /[0-9]/.test(p) },
  { label: "Special char",  test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function useCooldown(seconds = COOLDOWN_SECONDS) {
  const [remaining, setRemaining] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  const start = useCallback(() => {
    if (ref.current) clearInterval(ref.current)
    setRemaining(seconds)
    ref.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { if (ref.current) clearInterval(ref.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }, [seconds])
  useEffect(() => () => { if (ref.current) clearInterval(ref.current) }, [])
  return { remaining, start, active: remaining > 0 }
}

export function StorefrontAuth({ brandColor, nav }: StorefrontAuthProps) {
  const { currentBusinessId, currentBusinessName, currentStoreId } = useAdminStore()
  const { isAuthenticated } = useAuthStore()
  const businessId = currentBusinessId || ""
  const storeId    = currentStoreId || undefined

  const [view,    setView]    = useState<AuthView>("email")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const [success, setSuccess] = useState(false)

  // ── Email entry ──────────────────────────────────────────────────────────
  const [entryEmail, setEntryEmail] = useState("")
  const isEntryEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entryEmail.trim())

  // ── Registration form ────────────────────────────────────────────────────
  const [regName,  setRegName]  = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const isRegValid = (
    regName.trim().length >= 2 &&
    regPhone.length === 10 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())
  )

  // ── Password login ───────────────────────────────────────────────────────
  const [loginEmail,    setLoginEmail]    = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showLoginPw,   setShowLoginPw]   = useState(false)
  const isPasswordLoginValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim()) && loginPassword.length >= 1

  // ── OTP screen ───────────────────────────────────────────────────────────
  const [otpCode,    setOtpCode]    = useState("")
  const [otpEmail,   setOtpEmail]   = useState("")
  const [otpMasked,  setOtpMasked]  = useState("")
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose>("register")
  const [otpPhone,   setOtpPhone]   = useState("")
  const [otpName,    setOtpName]    = useState("")
  const [devCode,    setDevCode]    = useState("")
  const [attempts,   setAttempts]   = useState(0)
  const cooldown = useCooldown()

  // ── OTP setup (no-password existing user) ───────────────────────────────
  const [otpSetupEmail, setOtpSetupEmail] = useState("")

  // ── Set-initial-password screen (after OTP for new/no-password users) ───
  // pendingSessionData holds the session returned by verify; used as Bearer
  // token for set-password and as the final session after password is set.
  const [pendingSessionData, setPendingSessionData] = useState<Record<string, unknown> | null>(null)
  const [initPw,       setInitPw]       = useState("")
  const [initPwConf,   setInitPwConf]   = useState("")
  const [showInitPw,   setShowInitPw]   = useState(false)
  const [showInitConf, setShowInitConf] = useState(false)
  const initPwRules   = PASSWORD_RULES.map(r => ({ ...r, passed: r.test(initPw) }))
  const initAllPassed = initPwRules.every(r => r.passed)
  const initPwMatch   = initPw === initPwConf && initPwConf.length > 0
  const isInitPwValid = initAllPassed && initPwMatch

  // ── Forgot password ──────────────────────────────────────────────────────
  const [forgotEmail, setForgotEmail] = useState("")
  const isForgotEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())

  useEffect(() => {
    if (isAuthenticated && !success) nav.goBack("home")
  }, [isAuthenticated, success, nav])

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function sendOtpEmail(emailAddr: string): Promise<string | undefined> {
    const res = await fetch("/api/core/storefront/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailAddr, businessId, storeId }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || "Failed to send code")
    return json.code
  }

  function goToOtp(opts: {
    email: string; phone: string; name: string
    maskedEmail: string; purpose: OtpPurpose; dc?: string
  }) {
    setOtpEmail(opts.email)
    setOtpPhone(opts.phone)
    setOtpName(opts.name)
    setOtpMasked(opts.maskedEmail)
    setOtpPurpose(opts.purpose)
    setDevCode(opts.dc || "")
    setOtpCode("")
    setAttempts(0)
    setError("")
    setView("otp")
    cooldown.start()
  }

  function storeSession(session: Record<string, unknown>) {
    const u  = session.user as Record<string, unknown>
    const at = session.accessToken as string
    const rt = session.refreshToken as string
    if (at) {
      localStorage.setItem("quantix_auth_token", at)
      if (rt) localStorage.setItem("quantix_auth_refresh_token", rt)
      localStorage.setItem("quantix_auth_user", JSON.stringify(u))
      localStorage.setItem("quantix_auth_role", (u?.role as string) || "CUSTOMER")
      if (u?.businessId) localStorage.setItem("quantix_auth_business_id", u.businessId as string)
      if (u?.businessName) localStorage.setItem("quantix_auth_business_name", u.businessName as string)
      if (u?.businessType) localStorage.setItem("quantix_auth_business_type", u.businessType as string)
      if (session.businesses) localStorage.setItem("quantix_auth_businesses", JSON.stringify(session.businesses))
    }
    useAuthStore.getState().initialize()
    setSuccess(true)
    setTimeout(() => nav.goBack("home"), 900)
  }

  // ── Step 1: email check ──────────────────────────────────────────────────

  async function handleEmailCheck() {
    if (!isEntryEmailValid || loading) return
    setLoading(true); setError("")
    const normEmail = normalizeEmail(entryEmail)
    try {
      const res  = await fetch("/api/core/storefront/auth/check-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normEmail, businessId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Check failed")

      if (!json.exists) {
        // New customer — show registration form
        setRegEmail(normEmail)
        setRegName(""); setRegPhone("")
        setView("register")
      } else if (json.hasPassword) {
        // Existing customer with password — show password login only
        setLoginEmail(normEmail)
        setLoginPassword("")
        setView("login")
      } else {
        // Existing customer without password — OTP to verify, then set password
        setOtpSetupEmail(normEmail)
        setView("otp-setup")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally { setLoading(false) }
  }

  // ── Step 2a: register (new user) ─────────────────────────────────────────

  async function handleRegister() {
    if (!isRegValid || loading) return
    setLoading(true); setError("")
    const fullPhone = normalizePhone(regPhone)
    const normEmail = normalizeEmail(regEmail)
    try {
      const checkRes = await fetch("/api/core/storefront/auth/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, email: normEmail, businessId }),
      })
      const check = await checkRes.json()
      if (!check.success) throw new Error(check.error || "Check failed")

      if (check.status === "CONFLICT") {
        setError(`This mobile number is already registered with a different email (${check.maskedEmail}). Please use that email to sign in.`)
        setLoading(false); return
      }
      if (check.status === "EMAIL_TAKEN") {
        setError("This email is already linked to a different phone number. Please sign in instead.")
        setLoading(false); return
      }

      const dc = await sendOtpEmail(normEmail)
      goToOtp({ email: normEmail, phone: fullPhone, name: regName.trim(), maskedEmail: maskEmail(normEmail), purpose: "register", dc })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally { setLoading(false) }
  }

  // ── Step 2b: existing customer with no password — send OTP ───────────────

  async function handleSendSetupOtp() {
    if (loading) return
    setLoading(true); setError("")
    try {
      const dc = await sendOtpEmail(otpSetupEmail)
      goToOtp({ email: otpSetupEmail, phone: "", name: "", maskedEmail: maskEmail(otpSetupEmail), purpose: "login", dc })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally { setLoading(false) }
  }

  // ── Step 2c: password login (existing user with password) ────────────────

  async function handlePasswordLogin() {
    if (!isPasswordLoginValid || loading) return
    setLoading(true); setError("")
    try {
      const res  = await fetch("/api/customer/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(loginEmail), password: loginPassword, businessId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Login failed")
      storeSession({ accessToken: json.token, refreshToken: json.refreshToken, user: json.user, businesses: json.businesses })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally { setLoading(false) }
  }

  // ── Step 3: OTP verify ───────────────────────────────────────────────────

  const isLocked = attempts >= MAX_ATTEMPTS

  async function handleVerify() {
    if (otpCode.length < 6 || loading || isLocked) return
    setLoading(true); setError("")
    try {
      const res  = await fetch("/api/core/storefront/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:      otpEmail,
          phone:      otpPhone,
          code:       otpCode,
          name:       otpName,
          businessId,
          storeId,
          otpPurpose,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Invalid code")

      if (json.requirePasswordSetup) {
        // OTP verified — customer exists (or is newly created) but has no
        // password yet.  Store the session tokens and show the Set Password
        // screen.  storeSession is called AFTER the password is created.
        setPendingSessionData(json.data as Record<string, unknown>)
        setInitPw(""); setInitPwConf(""); setError("")
        setView("set-initial-password")
      } else {
        storeSession(json.data as Record<string, unknown>)
      }
    } catch (err) {
      const next = attempts + 1
      setAttempts(next)
      setError(next >= MAX_ATTEMPTS ? "Too many attempts. Request a new code." : (err instanceof Error ? err.message : "Invalid code"))
      setOtpCode("")
    } finally { setLoading(false) }
  }

  async function handleResendOtp() {
    if (cooldown.active || loading) return
    setLoading(true); setError("")
    try {
      const dc = await sendOtpEmail(otpEmail)
      if (dc) setDevCode(dc)
      setAttempts(0); setOtpCode("")
      cooldown.start()
    } catch (err) { setError(err instanceof Error ? err.message : "Resend failed") }
    finally { setLoading(false) }
  }

  // ── Step 4: set initial password (after OTP) ─────────────────────────────

  async function handleSetInitialPassword() {
    if (!isInitPwValid || loading || !pendingSessionData) return
    setLoading(true); setError("")
    const refreshToken = (pendingSessionData as Record<string, unknown>).refreshToken as string
    try {
      const res  = await fetch("/api/core/storefront/auth/set-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${refreshToken}`,
        },
        body: JSON.stringify({ password: initPw, confirmPassword: initPwConf, businessId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Failed to set password")
      // Password is set — complete the login with the session from verify
      storeSession(pendingSessionData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password")
    } finally { setLoading(false) }
  }

  // ── Forgot password ──────────────────────────────────────────────────────

  async function handleForgotSubmit() {
    if (!isForgotEmailValid || loading) return
    setLoading(true); setError("")
    try {
      const res  = await fetch("/api/core/storefront/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(forgotEmail), businessId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Request failed")
      // Generic success — always show "check your email" (anti-enumeration)
      setView("forgot-sent")
    } catch (err) {
      // Even on error show the same view to avoid leaking email existence
      setView("forgot-sent")
    } finally { setLoading(false) }
  }

  // ── Titles ───────────────────────────────────────────────────────────────

  const TITLES: Record<AuthView, string> = {
    email:                "Sign In or Register",
    register:             "Create Account",
    "otp-setup":          "Verify Your Email",
    otp:                  "Enter Code",
    "set-initial-password": "Set Your Password",
    login:                "Welcome Back",
    forgot:               "Reset Password",
    "forgot-sent":        "Check Your Email",
  }

  const initial = (currentBusinessName || "Q").charAt(0).toUpperCase()

  const Err = ({ msg }: { msg: string }) => msg ? (
    <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
      <p className="text-xs text-red-700">{msg}</p>
    </div>
  ) : null

  const Back = ({ to, label = "Back" }: { to: AuthView; label?: string }) => (
    <button onClick={() => { setView(to); setError("") }}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-5 transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" />{label}
    </button>
  )

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        <button onClick={() => nav.goBack("home")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to store
        </button>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold mx-auto mb-3"
              style={{ backgroundColor: brandColor }}>
              {initial}
            </div>
            <h1 className="text-lg font-bold text-gray-900">{TITLES[view]}</h1>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="text-sm font-medium text-gray-700">Signed in successfully!</p>
            </div>
          ) : (
            <>
              {/* ── STEP 1: EMAIL ENTRY ─────────────────────────────── */}
              {view === "email" && (
                <>
                  <p className="text-xs text-gray-500 mb-4 text-center">
                    Enter your email to sign in or create an account.
                  </p>
                  <Err msg={error} />
                  <Field icon={<Mail className="w-4 h-4 text-gray-400" />}
                    placeholder="Email Address *" type="email"
                    value={entryEmail}
                    onChange={v => { setEntryEmail(v); setError("") }}
                    onEnter={handleEmailCheck}
                  />
                  <PrimaryBtn label="Continue" loading={loading} disabled={!isEntryEmailValid} onClick={handleEmailCheck} color={brandColor} />
                  <button onClick={() => { setForgotEmail(""); setView("forgot"); setError("") }}
                    className="flex items-center justify-center gap-1.5 w-full mt-3 text-xs font-medium transition-colors"
                    style={{ color: brandColor }}>
                    <HelpCircle className="w-3.5 h-3.5" />Forgot password?
                  </button>
                </>
              )}

              {/* ── STEP 2A: REGISTRATION ──────────────────────────── */}
              {view === "register" && (
                <>
                  <Back to="email" label="Use a different email" />
                  <p className="text-xs text-gray-500 mb-4">
                    No account found. Fill in your details to get started.
                  </p>
                  <Err msg={error} />
                  <Field icon={<User className="w-4 h-4 text-gray-400" />}
                    placeholder="Full Name *" type="text"
                    value={regName} onChange={v => { setRegName(v); setError("") }} />
                  <PhoneField value={regPhone} onChange={v => { setRegPhone(v); setError("") }} />
                  <Field icon={<Mail className="w-4 h-4 text-gray-400" />}
                    placeholder="Email Address *" type="email"
                    value={regEmail} onChange={v => { setRegEmail(v); setError("") }} />
                  <PrimaryBtn label="Send Verification Code" loading={loading} disabled={!isRegValid} onClick={handleRegister} color={brandColor} />
                </>
              )}

              {/* ── STEP 2B: EXISTING CUSTOMER — NO PASSWORD (OTP SETUP) */}
              {view === "otp-setup" && (
                <>
                  <Back to="email" label="Use a different email" />
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mb-4">
                    <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-800">
                      This account doesn&apos;t have a password yet. We&apos;ll send a verification code to{" "}
                      <span className="font-semibold">{maskEmail(otpSetupEmail)}</span> so you can set one.
                    </p>
                  </div>
                  <Err msg={error} />
                  <PrimaryBtn label="Send Verification Code" loading={loading} disabled={false} onClick={handleSendSetupOtp} color={brandColor} />
                </>
              )}

              {/* ── STEP 2C: PASSWORD LOGIN ─────────────────────────── */}
              {view === "login" && (
                <>
                  <Back to="email" label="Use a different email" />
                  <p className="text-xs text-gray-500 mb-4">
                    Enter your password for <span className="font-semibold">{maskEmail(loginEmail)}</span>.
                  </p>
                  <Err msg={error} />
                  <PasswordField value={loginPassword} show={showLoginPw}
                    onChange={v => { setLoginPassword(v); setError("") }}
                    onToggle={() => setShowLoginPw(v => !v)}
                    onEnter={handlePasswordLogin}
                    placeholder="Password *" />
                  <PrimaryBtn label="Sign In" loading={loading} disabled={!isPasswordLoginValid} onClick={handlePasswordLogin} color={brandColor} />
                  <button onClick={() => { setForgotEmail(loginEmail); setView("forgot"); setError("") }}
                    className="flex items-center justify-center gap-1.5 w-full mt-3 text-xs font-medium transition-colors"
                    style={{ color: brandColor }}>
                    <HelpCircle className="w-3.5 h-3.5" />Forgot password?
                  </button>
                </>
              )}

              {/* ── STEP 3: OTP VERIFICATION ───────────────────────── */}
              {view === "otp" && (
                <>
                  <Back to={otpPurpose === "register" ? "register" : "email"} />
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-4">
                    <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-xs text-blue-800">
                      Code sent to <span className="font-semibold">{otpMasked}</span>
                    </p>
                  </div>
                  {devCode && (
                    <div className="mb-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-1.5">
                      <p className="text-xs text-amber-700">Dev: <span className="font-mono font-bold">{devCode}</span></p>
                    </div>
                  )}
                  <Err msg={error} />
                  <input
                    type="text" inputMode="numeric" placeholder="• • • • • •"
                    value={otpCode}
                    onChange={e => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError("") }}
                    onKeyDown={e => e.key === "Enter" && handleVerify()}
                    disabled={isLocked}
                    className="w-full h-12 px-4 text-center text-2xl font-bold tracking-[0.5em] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 transition-colors mb-3"
                    autoFocus
                  />
                  <PrimaryBtn label="Verify" loading={loading} disabled={otpCode.length < 6 || isLocked} onClick={handleVerify} color={brandColor} />
                  <div className="flex items-center justify-center mt-3">
                    <button onClick={handleResendOtp} disabled={cooldown.active || loading}
                      className="flex items-center gap-1.5 text-xs font-medium disabled:opacity-40 transition-opacity"
                      style={{ color: cooldown.active ? "#9ca3af" : brandColor }}>
                      <RefreshCw className="w-3 h-3" />
                      {cooldown.active ? `Resend in ${cooldown.remaining}s` : "Resend code"}
                    </button>
                  </div>
                  {attempts > 0 && !isLocked && (
                    <p className="text-center text-[10px] text-gray-400 mt-2">
                      {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? "s" : ""} remaining
                    </p>
                  )}
                </>
              )}

              {/* ── STEP 4: SET INITIAL PASSWORD ────────────────────── */}
              {view === "set-initial-password" && (
                <>
                  <p className="text-xs text-gray-500 mb-4">
                    Email verified. Create a password for your account.
                  </p>
                  <Err msg={error} />
                  <PasswordField value={initPw} show={showInitPw}
                    onChange={v => { setInitPw(v); setError("") }}
                    onToggle={() => setShowInitPw(v => !v)}
                    placeholder="New Password *" />
                  {initPw.length > 0 && (
                    <div className="grid grid-cols-2 gap-1 mb-3">
                      {initPwRules.map(r => (
                        <div key={r.label} className="flex items-center gap-1">
                          <CheckCircle2 className={`w-2.5 h-2.5 shrink-0 ${r.passed ? "text-emerald-500" : "text-gray-300"}`} />
                          <span className={`text-[9px] ${r.passed ? "text-emerald-700" : "text-gray-400"}`}>{r.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <PasswordField value={initPwConf} show={showInitConf}
                    onChange={v => { setInitPwConf(v); setError("") }}
                    onToggle={() => setShowInitConf(v => !v)}
                    placeholder="Confirm Password *" />
                  {initPwConf.length > 0 && !initPwMatch && (
                    <p className="text-[10px] text-red-500 mb-2">Passwords do not match</p>
                  )}
                  <div className="mt-1">
                    <PrimaryBtn label="Set Password & Sign In" loading={loading} disabled={!isInitPwValid} onClick={handleSetInitialPassword} color={brandColor} />
                  </div>
                </>
              )}

              {/* ── FORGOT PASSWORD — EMAIL ENTRY ───────────────────── */}
              {view === "forgot" && (
                <>
                  <Back to="email" />
                  <p className="text-xs text-gray-500 mb-4">
                    Enter your registered email and we&apos;ll send you a password reset link.
                  </p>
                  <Err msg={error} />
                  <Field icon={<Mail className="w-4 h-4 text-gray-400" />}
                    placeholder="Email Address *" type="email"
                    value={forgotEmail}
                    onChange={v => { setForgotEmail(v); setError("") }}
                    onEnter={handleForgotSubmit}
                  />
                  <PrimaryBtn label="Send Reset Link" loading={loading} disabled={!isForgotEmailValid} onClick={handleForgotSubmit} color={brandColor} />
                </>
              )}

              {/* ── FORGOT PASSWORD — SENT CONFIRMATION ─────────────── */}
              {view === "forgot-sent" && (
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
                    <Mail className="w-7 h-7" style={{ color: brandColor }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900 mb-1">Check your inbox</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      If <span className="font-medium text-gray-700">{forgotEmail}</span> is registered,
                      you&apos;ll receive a password reset link within a minute.
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      The link expires in 15 minutes.
                    </p>
                  </div>
                  <button onClick={() => { setView("email"); setForgotEmail(""); setError("") }}
                    className="text-xs font-medium transition-colors mt-1"
                    style={{ color: brandColor }}>
                    Back to sign in
                  </button>
                </div>
              )}
            </>
          )}

          <p className="text-[10px] text-gray-400 text-center mt-5">
            By continuing, you agree to our Terms &amp; Privacy Policy.
          </p>
        </div>

        {nav.prevPage === "checkout" && !success && (
          <div className="text-center mt-4">
            <button onClick={() => nav.go("checkout")} className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2">
              Continue as guest instead
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Small UI helpers ──────────────────────────────────────────────────────────

function Field({ icon, placeholder, type, value, onChange, onEnter }: {
  icon: React.ReactNode; placeholder: string; type: string
  value: string; onChange: (v: string) => void; onEnter?: () => void
}) {
  return (
    <div className="flex items-center border border-gray-200 rounded-xl px-3 h-11 focus-within:border-gray-400 transition-colors mb-3">
      <span className="shrink-0">{icon}</span>
      <input type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onEnter?.()}
        className="flex-1 text-sm outline-none bg-transparent ml-2.5" />
    </div>
  )
}

function PhoneField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center border border-gray-200 rounded-xl px-3 h-11 focus-within:border-gray-400 transition-colors mb-3">
      <div className="flex items-center gap-1.5 text-sm text-gray-600 shrink-0 border-r border-gray-200 pr-3">
        <Phone className="w-3.5 h-3.5" /><span>+91</span>
      </div>
      <input type="tel" placeholder="Mobile Number *" value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        className="flex-1 text-sm outline-none bg-transparent ml-3" maxLength={10} />
    </div>
  )
}

function PasswordField({ value, show, onChange, onToggle, onEnter, placeholder }: {
  value: string; show: boolean
  onChange: (v: string) => void; onToggle: () => void
  onEnter?: () => void; placeholder: string
}) {
  return (
    <div className="flex items-center border border-gray-200 rounded-xl px-3 h-11 focus-within:border-gray-400 transition-colors mb-3">
      <Lock className="w-4 h-4 text-gray-400 shrink-0" />
      <input type={show ? "text" : "password"} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onEnter?.()}
        className="flex-1 text-sm outline-none bg-transparent ml-2.5" />
      <button type="button" onClick={onToggle} className="text-gray-400 hover:text-gray-600 ml-1">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

function PrimaryBtn({ label, loading, disabled, onClick, color }: {
  label: string; loading: boolean; disabled: boolean; onClick: () => void; color: string
}) {
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
      style={{ backgroundColor: color }}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : label}
    </button>
  )
}
