"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import {
  Phone, ArrowLeft, Loader2, CheckCircle2, User, Mail,
  AlertCircle, Eye, EyeOff, RefreshCw, HelpCircle, LogIn, Lock,
} from "lucide-react"
import type { WebNav } from "./storefront-website"

interface StorefrontAuthProps {
  brandColor: string
  nav: WebNav
}

type AuthView = "register" | "login" | "otp" | "forgot" | "reset"
type OtpPurpose = "register" | "login" | "forgot"

const MAX_ATTEMPTS = 5
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
  return p.startsWith("+") ? p : `+${d}`
}

const PASSWORD_RULES = [
  { label: "8+ characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /[0-9]/.test(p) },
  { label: "Special char", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
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
  const storeId = currentStoreId || undefined

  const [view, setView] = useState<AuthView>("register")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  // Register
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [conflictMasked, setConflictMasked] = useState("")

  // OTP screen
  const [otpCode, setOtpCode] = useState("")
  const [otpEmail, setOtpEmail] = useState("")
  const [otpMasked, setOtpMasked] = useState("")
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose>("register")
  const [otpPhone, setOtpPhone] = useState("")
  const [otpName, setOtpName] = useState("")
  const [devCode, setDevCode] = useState("")
  const [attempts, setAttempts] = useState(0)
  const cooldown = useCooldown()

  // Forgot
  const [forgotPhone, setForgotPhone] = useState("")
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotMasked, setForgotMasked] = useState("")
  const [forgotDevCode, setForgotDevCode] = useState("")

  // Reset password
  const [resetCode, setResetCode] = useState("")
  const [resetPw, setResetPw] = useState("")
  const [resetConfirm, setResetConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const resetCooldown = useCooldown()

  useEffect(() => {
    if (isAuthenticated && !success) nav.goBack("home")
  }, [isAuthenticated, success, nav])

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function goToOtp(opts: { email: string; phone: string; name: string; maskedEmail: string; purpose: OtpPurpose; dc?: string }) {
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

  function storeSession(session: Record<string, unknown>) {
    const u = session.user as Record<string, unknown>
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

  // ── Register flow ──────────────────────────────────────────────────────────

  const isRegValid = name.trim().length >= 2 && phone.length === 10 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function handleRegister() {
    if (!isRegValid || loading) return
    setLoading(true); setError(""); setConflictMasked("")
    const fullPhone = normalizePhone(phone)
    const normEmail = normalizeEmail(email)
    try {
      const checkRes = await fetch("/api/core/storefront/auth/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, email: normEmail, businessId }),
      })
      const check = await checkRes.json()
      if (!check.success) throw new Error(check.error || "Check failed")

      if (check.status === "CONFLICT") { setConflictMasked(check.maskedEmail || ""); setLoading(false); return }
      if (check.status === "EMAIL_TAKEN") { setError("This email is registered with a different phone number."); setLoading(false); return }

      const dc = await sendOtpEmail(normEmail)
      const masked = check.maskedEmail || maskEmail(normEmail)
      if (check.status === "LOGIN") setError("") // clear any stale

      await goToOtp({ email: normEmail, phone: fullPhone, name: name.trim(), maskedEmail: masked, purpose: check.status === "LOGIN" ? "login" : "register", dc })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally { setLoading(false) }
  }

  // ── Login flow ─────────────────────────────────────────────────────────────

  const [loginMode, setLoginMode] = useState<"otp" | "password">("otp")
  const [loginPhone, setLoginPhone] = useState("")
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showLoginPw, setShowLoginPw] = useState(false)
  const isLoginValid = loginPhone.length === 10 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())
  const isPasswordLoginValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim()) && loginPassword.length >= 1

  async function handleLogin() {
    if (!isLoginValid || loading) return
    setLoading(true); setError("")
    const fullPhone = normalizePhone(loginPhone)
    const normEmail = normalizeEmail(loginEmail)
    try {
      const checkRes = await fetch("/api/core/storefront/auth/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, email: normEmail, businessId }),
      })
      const check = await checkRes.json()
      if (!check.success) throw new Error(check.error || "Check failed")
      if (check.status === "NEW") { setError("No account found with this phone. Please register."); setLoading(false); return }
      if (check.status === "CONFLICT") { setError(`Phone is linked to a different email: ${check.maskedEmail}`); setLoading(false); return }

      const dc = await sendOtpEmail(normEmail)
      await goToOtp({ email: normEmail, phone: fullPhone, name: "", maskedEmail: check.maskedEmail || maskEmail(normEmail), purpose: "login", dc })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally { setLoading(false) }
  }

  async function handlePasswordLogin() {
    if (!isPasswordLoginValid || loading) return
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/customer/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(loginEmail), password: loginPassword, businessId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Login failed")
      // Password login returns flat: { token, refreshToken, user, ... }
      storeSession({
        accessToken: json.token,
        refreshToken: json.refreshToken,
        user: json.user,
        businesses: json.businesses,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally { setLoading(false) }
  }

  // ── OTP verify ─────────────────────────────────────────────────────────────

  const isLocked = attempts >= MAX_ATTEMPTS

  async function handleVerify() {
    if (otpCode.length < 6 || loading || isLocked) return
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/core/storefront/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, phone: otpPhone, code: otpCode, name: otpName, businessId, storeId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Invalid code")
      storeSession(json.data as Record<string, unknown>)
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

  // ── Forgot flow ────────────────────────────────────────────────────────────

  const isForgotValid = forgotPhone.length === 10

  async function handleForgotLookup() {
    if (!isForgotValid || loading) return
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/core/storefront/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizePhone(forgotPhone), businessId, storeId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Lookup failed")
      if (json.status === "NOT_FOUND") {
        setError("If an account exists, a recovery code has been sent to the registered email.")
        return
      }
      setForgotEmail(json.email)
      setForgotMasked(json.maskedEmail)
      setForgotDevCode(json.code || "")
      setResetCode(""); setResetPw(""); setResetConfirm("")
      setView("reset")
      resetCooldown.start()
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong") }
    finally { setLoading(false) }
  }

  // ── Reset password ─────────────────────────────────────────────────────────

  const pwRules = PASSWORD_RULES.map(r => ({ ...r, passed: r.test(resetPw) }))
  const allRulesPassed = pwRules.every(r => r.passed)
  const pwMatch = resetPw === resetConfirm && resetConfirm.length > 0
  const isResetValid = resetCode.length === 6 && allRulesPassed && pwMatch

  async function handleReset() {
    if (!isResetValid || loading) return
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/core/storefront/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail, code: resetCode, password: resetPw, businessId, storeId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Reset failed")
      storeSession(json.data as Record<string, unknown>)
    } catch (err) { setError(err instanceof Error ? err.message : "Reset failed") }
    finally { setLoading(false) }
  }

  async function handleResendResetOtp() {
    if (resetCooldown.active || loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/core/storefront/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizePhone(forgotPhone), businessId, storeId }),
      })
      const json = await res.json()
      if (json.code) setForgotDevCode(json.code)
      setResetCode("")
      resetCooldown.start()
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  // ── Shared UI pieces ───────────────────────────────────────────────────────

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

        {/* Page-level back (to storefront) */}
        <button onClick={() => nav.goBack("home")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />Back
        </button>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold mx-auto mb-3"
              style={{ backgroundColor: brandColor }}>
              {initial}
            </div>
            <h1 className="text-lg font-bold text-gray-900">
              {view === "register" && "Create Account"}
              {view === "login" && "Welcome Back"}
              {view === "otp" && "Enter Code"}
              {view === "forgot" && "Forgot Account?"}
              {view === "reset" && "Set New Password"}
            </h1>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="text-sm font-medium text-gray-700">Signed in successfully!</p>
            </div>
          ) : (

            <>
              {/* ── REGISTER ─────────────────────────────────────────── */}
              {view === "register" && (
                <>
                  {conflictMasked ? (
                    <div>
                      <div className="p-4 rounded-xl border border-red-100 bg-red-50 mb-4">
                        <div className="flex items-start gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <p className="text-xs font-semibold text-red-800">Account already exists</p>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">Phone</span><span className="font-medium">+91 {phone}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Registered email</span><span className="font-medium">{conflictMasked}</span></div>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">Please login with your registered email.</p>
                      </div>
                      <button onClick={() => setView("login")}
                        className="w-full h-10 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 mb-2"
                        style={{ backgroundColor: brandColor }}>
                        <LogIn className="w-4 h-4" />Login with Registered Email
                      </button>
                      <button onClick={() => setConflictMasked("")} className="w-full text-xs text-gray-400 hover:text-gray-600">Use a different number</button>
                    </div>
                  ) : (
                    <>
                      <Err msg={error} />
                      <Field icon={<User className="w-4 h-4 text-gray-400" />} placeholder="Full Name *" type="text"
                        value={name} onChange={v => { setName(v); setError("") }} />
                      <PhoneField value={phone} onChange={v => { setPhone(v); setError("") }} />
                      <Field icon={<Mail className="w-4 h-4 text-gray-400" />} placeholder="Email Address *" type="email"
                        value={email} onChange={v => { setEmail(v); setError("") }} />
                      <PrimaryBtn label="Continue" loading={loading} disabled={!isRegValid} onClick={handleRegister} color={brandColor} />
                      <div className="flex items-center gap-2 my-3">
                        <div className="flex-1 h-px bg-gray-100" />
                        <span className="text-[10px] text-gray-400">have an account?</span>
                        <div className="flex-1 h-px bg-gray-100" />
                      </div>
                      <SecondaryBtn label="Login" onClick={() => setView("login")} />
                    </>
                  )}
                </>
              )}

              {/* ── LOGIN ────────────────────────────────────────────── */}
              {view === "login" && (
                <>
                  <Back to="register" label="Back to register" />

                  {/* Mode tabs: OTP | Password */}
                  <div className="flex rounded-xl border border-gray-200 p-1 mb-4">
                    <button
                      onClick={() => { setLoginMode("otp"); setError("") }}
                      className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-colors ${loginMode === "otp" ? "text-white" : "text-gray-500 hover:text-gray-700"}`}
                      style={loginMode === "otp" ? { backgroundColor: brandColor } : {}}
                    >
                      OTP Login
                    </button>
                    <button
                      onClick={() => { setLoginMode("password"); setError("") }}
                      className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-colors ${loginMode === "password" ? "text-white" : "text-gray-500 hover:text-gray-700"}`}
                      style={loginMode === "password" ? { backgroundColor: brandColor } : {}}
                    >
                      Password Login
                    </button>
                  </div>

                  <Err msg={error} />

                  {loginMode === "otp" ? (
                    <>
                      <PhoneField value={loginPhone} onChange={v => { setLoginPhone(v); setError("") }} />
                      <Field icon={<Mail className="w-4 h-4 text-gray-400" />} placeholder="Email Address *" type="email"
                        value={loginEmail} onChange={v => { setLoginEmail(v); setError("") }} />
                      <PrimaryBtn label="Send Verification Code" loading={loading} disabled={!isLoginValid} onClick={handleLogin} color={brandColor} />
                    </>
                  ) : (
                    <>
                      <Field icon={<Mail className="w-4 h-4 text-gray-400" />} placeholder="Email Address *" type="email"
                        value={loginEmail} onChange={v => { setLoginEmail(v); setError("") }} />
                      <div className="flex items-center border border-gray-200 rounded-xl px-3 h-11 focus-within:border-gray-400 transition-colors mb-3">
                        <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                          type={showLoginPw ? "text" : "password"}
                          placeholder="Password *"
                          value={loginPassword}
                          onChange={e => { setLoginPassword(e.target.value); setError("") }}
                          onKeyDown={e => e.key === "Enter" && handlePasswordLogin()}
                          className="flex-1 text-sm outline-none bg-transparent ml-2.5"
                        />
                        <button type="button" onClick={() => setShowLoginPw(v => !v)} className="text-gray-400 hover:text-gray-600 ml-1">
                          {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <PrimaryBtn label="Login" loading={loading} disabled={!isPasswordLoginValid} onClick={handlePasswordLogin} color={brandColor} />
                    </>
                  )}

                  <button onClick={() => setView("forgot")}
                    className="flex items-center justify-center gap-1.5 w-full mt-3 text-xs font-medium transition-colors"
                    style={{ color: brandColor }}>
                    <HelpCircle className="w-3.5 h-3.5" />Forgot account / email?
                  </button>
                </>
              )}

              {/* ── OTP ──────────────────────────────────────────────── */}
              {view === "otp" && (
                <>
                  <Back to={otpPurpose === "login" ? "login" : "register"} />
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-4">
                    <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-xs text-blue-800">Code sent to <span className="font-semibold">{otpMasked}</span></p>
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
                  <PrimaryBtn label="Verify & Continue" loading={loading} disabled={otpCode.length < 6 || isLocked} onClick={handleVerify} color={brandColor} />
                  <div className="flex items-center justify-center mt-3">
                    <button
                      onClick={handleResendOtp}
                      disabled={cooldown.active || loading}
                      className="flex items-center gap-1.5 text-xs font-medium disabled:opacity-40 transition-opacity"
                      style={{ color: cooldown.active ? "#9ca3af" : brandColor }}>
                      <RefreshCw className="w-3 h-3" />
                      {cooldown.active ? `Resend in ${cooldown.remaining}s` : "Resend code"}
                    </button>
                  </div>
                  {attempts > 0 && !isLocked && (
                    <p className="text-center text-[10px] text-gray-400 mt-2">{MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? "s" : ""} remaining</p>
                  )}
                </>
              )}

              {/* ── FORGOT ───────────────────────────────────────────── */}
              {view === "forgot" && (
                <>
                  <Back to="login" label="Back to login" />
                  <p className="text-xs text-gray-500 mb-4">Enter your phone number and we&apos;ll send a recovery code to your registered email.</p>
                  <Err msg={error} />
                  <PhoneField value={forgotPhone} onChange={v => { setForgotPhone(v); setError("") }} />
                  <PrimaryBtn label="Send Recovery Code" loading={loading} disabled={!isForgotValid} onClick={handleForgotLookup} color={brandColor} />
                </>
              )}

              {/* ── RESET PASSWORD ────────────────────────────────────── */}
              {view === "reset" && (
                <>
                  <Back to="forgot" />
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-3">
                    <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <p className="text-xs text-blue-800">Recovery code sent to <span className="font-semibold">{forgotMasked}</span></p>
                  </div>
                  {forgotDevCode && (
                    <div className="mb-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-1.5">
                      <p className="text-xs text-amber-700">Dev: <span className="font-mono font-bold">{forgotDevCode}</span></p>
                    </div>
                  )}
                  <Err msg={error} />
                  <label className="text-[10px] font-semibold text-gray-600 block mb-1">Verification Code</label>
                  <input
                    type="text" inputMode="numeric" placeholder="• • • • • •"
                    value={resetCode}
                    onChange={e => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full h-11 px-4 text-center text-xl font-bold tracking-[0.4em] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 mb-3"
                  />
                  <div className="flex justify-center mb-4">
                    <button
                      onClick={handleResendResetOtp}
                      disabled={resetCooldown.active || loading}
                      className="flex items-center gap-1.5 text-xs font-medium disabled:opacity-40"
                      style={{ color: resetCooldown.active ? "#9ca3af" : brandColor }}>
                      <RefreshCw className="w-3 h-3" />
                      {resetCooldown.active ? `Resend in ${resetCooldown.remaining}s` : "Resend code"}
                    </button>
                  </div>
                  <label className="text-[10px] font-semibold text-gray-600 block mb-1">New Password</label>
                  <div className="relative mb-2">
                    <input
                      type={showPw ? "text" : "password"} placeholder="New password"
                      value={resetPw} onChange={e => setResetPw(e.target.value)}
                      className="w-full h-11 px-4 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 text-sm pr-10"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {resetPw.length > 0 && (
                    <div className="grid grid-cols-2 gap-1 mb-2">
                      {pwRules.map(r => (
                        <div key={r.label} className="flex items-center gap-1">
                          <CheckCircle2 className={`w-2.5 h-2.5 shrink-0 ${r.passed ? "text-emerald-500" : "text-gray-300"}`} />
                          <span className={`text-[9px] ${r.passed ? "text-emerald-700" : "text-gray-400"}`}>{r.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    type="password" placeholder="Confirm password"
                    value={resetConfirm} onChange={e => setResetConfirm(e.target.value)}
                    className={`w-full h-11 px-4 border rounded-xl focus:outline-none text-sm mb-1 ${resetConfirm.length > 0 && !pwMatch ? "border-red-300" : "border-gray-200 focus:border-gray-400"}`}
                  />
                  {resetConfirm.length > 0 && !pwMatch && <p className="text-[10px] text-red-500 mb-2">Passwords do not match</p>}
                  <div className="mt-3">
                    <PrimaryBtn label="Set Password & Login" loading={loading} disabled={!isResetValid} onClick={handleReset} color={brandColor} />
                  </div>
                </>
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

// ── Small UI helpers ───────────────────────────────────────────────────────────

function Field({ icon, placeholder, type, value, onChange }: {
  icon: React.ReactNode; placeholder: string; type: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center border border-gray-200 rounded-xl px-3 h-11 focus-within:border-gray-400 transition-colors mb-3">
      <span className="shrink-0">{icon}</span>
      <input type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
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
      <input type="tel" placeholder="Phone Number *" value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        className="flex-1 text-sm outline-none bg-transparent ml-3" maxLength={10} />
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

function SecondaryBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full h-10 border border-gray-200 text-sm text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors">
      {label}
    </button>
  )
}
