"use client"

import React, { useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { showSuccess, showError } from "@/lib/toast-utils"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Phone, ArrowLeft, Shield, Loader2, User, Mail, MessageCircle, RefreshCw } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"

type Step = "register" | "otp"

interface OtpMeta {
  whatsappSent: boolean
  emailSent: boolean
  code?: string // dev / fallback safety net
}

export function CustomerAuth() {
  const {
    setCustomerLoggedIn, setCustomerName, setCustomerPage,
    popCustomerPage, customerNavStack,
    currentBusinessName: bizName, currentBusinessPrimaryColor,
    currentBusinessId, currentStoreId,
  } = useAdminStore()
  const displayName = bizName || "My Store"
  const brandColor = currentBusinessPrimaryColor || "#10B981"
  const displayInitials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
  const { loginWithOtp } = useAuthStore()

  const handlePostLogin = (name: string) => {
    setCustomerLoggedIn(true)
    setCustomerName(name)
    if (customerNavStack.length > 0) popCustomerPage()
    else setCustomerPage("home")
  }

  const [step, setStep] = useState<Step>("register")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [otpMeta, setOtpMeta] = useState<OtpMeta>({ whatsappSent: false, emailSent: false })

  const isPhoneValid = phone.length === 10
  const isFormValid = name.trim().length >= 2 && isPhoneValid

  // ── Send OTP ────────────────────────────────────────────────────────────────

  const doSendOtp = async (): Promise<OtpMeta> => {
    const fullPhone = `+91${phone}`
    const res = await fetch("/api/core/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: fullPhone,
        email: email.trim() || undefined,
        channel: "WHATSAPP_OTP",
        businessId: currentBusinessId || undefined,
        storeId: currentStoreId || undefined,
        name: name.trim() || undefined,
      }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || "Failed to send OTP")
    return {
      whatsappSent: !!json.delivered,
      emailSent: !!json.emailFallbackSent,
      code: json.code,
    }
  }

  const handleContinue = async () => {
    if (!isFormValid) return
    setLoading(true)
    setError(null)
    try {
      const meta = await doSendOtp()
      setOtpMeta(meta)
      setStep("otp")
      const where = meta.emailSent
        ? "WhatsApp and your email"
        : "WhatsApp"
      showSuccess("Code sent!", `Check ${where} for your verification code.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send OTP"
      setError(msg)
      // Still proceed to OTP screen — dev mode OTP visible in toast
      setOtpMeta({ whatsappSent: false, emailSent: false })
      setStep("otp")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async (channel: "whatsapp" | "email") => {
    setResending(true)
    setError(null)
    try {
      if (channel === "email" && email.trim()) {
        const res = await fetch("/api/core/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            channel: "EMAIL_OTP",
            businessId: currentBusinessId || undefined,
            storeId: currentStoreId || undefined,
          }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || "Failed to resend")
        setOtpMeta(prev => ({ ...prev, emailSent: true }))
        showSuccess("Email OTP sent!", `Check ${email} for your code.`)
      } else {
        const meta = await doSendOtp()
        setOtpMeta(meta)
        showSuccess("OTP resent!", "Check your WhatsApp.")
      }
    } catch (err) {
      showError("Resend failed", err instanceof Error ? err.message : "Try again")
    } finally {
      setResending(false)
    }
  }

  // ── Verify OTP ──────────────────────────────────────────────────────────────

  const handleVerify = async () => {
    if (otp.length < 6) return
    setLoading(true)
    setError(null)

    // In dev fallback, auto-fill OTP from meta
    const codeToVerify = otp

    try {
      const fullPhone = `+91${phone}`
      const res = await fetch("/api/core/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fullPhone,
          code: codeToVerify,
          channel: "WHATSAPP_OTP",
          businessId: currentBusinessId || undefined,
          storeId: currentStoreId || undefined,
          name: name.trim() || undefined,
        }),
      })
      const result = await res.json()

      if (!result.success) {
        // Try email channel fallback if email was provided
        if (email.trim()) {
          const res2 = await fetch("/api/core/auth/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: email.trim(),
              code: codeToVerify,
              channel: "EMAIL_OTP",
              businessId: currentBusinessId || undefined,
              storeId: currentStoreId || undefined,
              name: name.trim() || undefined,
            }),
          })
          const result2 = await res2.json()
          if (!result2.success) throw new Error(result2.error || "Invalid OTP")
          return handleVerifySuccess(result2)
        }
        throw new Error(result.error || "Invalid OTP")
      }

      handleVerifySuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.")
      showError("Verification failed", "The code you entered may be incorrect.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifySuccess = (result: Record<string, unknown>) => {
    const data = result.data as Record<string, unknown> | undefined
    if (data) {
      const user = data.user as Record<string, unknown> | undefined
      const accessToken = data.accessToken as string | undefined
      const refreshToken = data.refreshToken as string | undefined
      if (accessToken) {
        localStorage.setItem("quantix_auth_token", accessToken)
        if (refreshToken) localStorage.setItem("quantix_auth_refresh_token", refreshToken)
        if (data.businesses) localStorage.setItem("quantix_auth_businesses", JSON.stringify(data.businesses))
      }
      const userName = (user?.name as string) || name.trim() || "User"
      handlePostLogin(userName)
      showSuccess("Welcome!", `Hi ${userName}, you're now logged in.`)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(160deg, ${brandColor} 0%, ${brandColor}cc 100%)` }}>
      {/* Top branding */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
          <span className="font-extrabold text-2xl" style={{ color: brandColor }}>{displayInitials}</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{displayName}</h1>
        <p className="text-white/80 text-sm text-center">Sign in to track orders &amp; save addresses</p>
      </div>

      {/* Bottom card */}
      <div className="bg-white rounded-t-3xl px-6 py-8 flex flex-col">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        {step === "register" ? (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome!</h2>
            <p className="text-sm text-gray-500 mb-5">Enter your details to get started</p>

            {/* Name */}
            <div className="relative mb-3">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <div className="w-px h-5 bg-gray-200" />
              </div>
              <Input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null) }}
                className="pl-12 h-12 text-base rounded-xl border-gray-200"
              />
            </div>

            {/* Phone */}
            <div className="relative mb-3">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500 font-medium">+91</span>
                <div className="w-px h-5 bg-gray-200" />
              </div>
              <Input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(null) }}
                className="pl-24 h-12 text-base rounded-xl border-gray-200"
                maxLength={10}
              />
            </div>

            {/* Email */}
            <div className="relative mb-5">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <div className="w-px h-5 bg-gray-200" />
              </div>
              <Input
                type="email"
                placeholder="Email address (for OTP backup)"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null) }}
                className="pl-12 h-12 text-base rounded-xl border-gray-200"
              />
            </div>

            <Button
              onClick={handleContinue}
              disabled={!isFormValid || loading}
              className="w-full h-12 text-base font-semibold rounded-xl text-white disabled:bg-gray-200 disabled:text-gray-400"
              style={{ backgroundColor: isFormValid ? brandColor : undefined }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending OTP...
                </span>
              ) : (
                "Continue"
              )}
            </Button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <button
              onClick={() => {
                if (customerNavStack.length > 0) popCustomerPage()
                else setCustomerPage("home")
              }}
              className="w-full h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Browse as Guest
            </button>

            <p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
              By continuing, you agree to our{" "}
              <span style={{ color: brandColor }}>Terms</span> &amp;{" "}
              <span style={{ color: brandColor }}>Privacy Policy</span>
            </p>
          </>
        ) : (
          <>
            <button
              onClick={() => { setStep("register"); setOtp(""); setError(null) }}
              className="flex items-center gap-1 text-gray-500 mb-4 -mt-1 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>

            <h2 className="text-xl font-bold text-gray-900 mb-1">Verify Code</h2>

            {/* Delivery status */}
            <div className="space-y-1.5 mb-5">
              {otpMeta.whatsappSent && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-green-500" />
                  Sent to WhatsApp: <span className="font-medium text-gray-700">+91 {phone}</span>
                </p>
              )}
              {otpMeta.emailSent && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-500" />
                  Also sent to: <span className="font-medium text-gray-700">{email}</span>
                </p>
              )}
              {!otpMeta.whatsappSent && !otpMeta.emailSent && (
                <p className="text-sm text-gray-500">
                  Enter the code sent to <span className="font-medium text-gray-700">+91 {phone}</span>
                </p>
              )}
              {otpMeta.code && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                  Dev mode — your code: <span className="font-mono font-bold">{otpMeta.code}</span>
                </p>
              )}
            </div>

            <div className="flex justify-center mb-6">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => { setOtp(value); setError(null) }}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={handleVerify}
              disabled={otp.length < 6 || loading}
              className="w-full h-12 text-base font-semibold rounded-xl text-white disabled:bg-gray-200 disabled:text-gray-400"
              style={{ backgroundColor: otp.length === 6 ? brandColor : undefined }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </span>
              ) : (
                "Verify & Continue"
              )}
            </Button>

            {/* Resend options */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-center gap-1.5">
                <Shield className="w-3 h-3 text-gray-400" />
                <button
                  className="text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                  style={{ color: brandColor }}
                  disabled={resending}
                  onClick={() => handleResend("whatsapp")}
                >
                  {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Resend WhatsApp OTP
                </button>
              </div>

              {email.trim() && (
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    className="text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                    style={{ color: brandColor }}
                    disabled={resending}
                    onClick={() => handleResend("email")}
                  >
                    {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                    Send Email OTP instead
                  </button>
                </div>
              )}

              <div className="flex items-center justify-center">
                <button
                  className="text-xs text-gray-400 hover:text-gray-600"
                  onClick={() => { setStep("register"); setOtp(""); setError(null) }}
                >
                  Change number
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
