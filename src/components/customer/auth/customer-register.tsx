"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { User, Phone, Mail, Loader2, AlertCircle, LogIn } from "lucide-react"

interface CheckResult {
  status: "NEW" | "LOGIN" | "CONFLICT" | "EMAIL_TAKEN"
  maskedEmail?: string
  message?: string
}

interface Props {
  onSuccess: (data: { phone: string; email: string; name: string; maskedEmail: string; isLogin: boolean }) => void
  onSwitchToLogin: () => void
  brandColor: string
  businessId: string
  storeId?: string
  onGuest: () => void
}

export function CustomerRegister({ onSuccess, onSwitchToLogin, brandColor, businessId, storeId, onGuest }: Props) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictInfo, setConflictInfo] = useState<{ maskedEmail: string } | null>(null)

  const isValid = name.trim().length >= 2 && phone.length === 10 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const handleContinue = async () => {
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    setConflictInfo(null)

    const fullPhone = `+91${phone}`
    const normEmail = email.trim().toLowerCase()

    try {
      // Step 1: Check phone existence
      const checkRes = await fetch("/api/core/storefront/auth/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, email: normEmail, businessId }),
      })
      const check: { success: boolean; error?: string } & CheckResult = await checkRes.json()
      if (!check.success) throw new Error(check.error || "Check failed")

      if (check.status === "CONFLICT") {
        setConflictInfo({ maskedEmail: check.maskedEmail || "" })
        setLoading(false)
        return
      }

      if (check.status === "EMAIL_TAKEN") {
        setError("This email is already registered with a different phone number.")
        setLoading(false)
        return
      }

      // Step 2: Send OTP to email
      const otpRes = await fetch("/api/core/storefront/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normEmail, businessId, storeId }),
      })
      const otpJson = await otpRes.json()
      if (!otpJson.success) throw new Error(otpJson.error || "Failed to send code")

      const maskedEmail = check.maskedEmail || normEmail.replace(/^(.{2}).*@/, "$1***@")

      onSuccess({
        phone: fullPhone,
        email: normEmail,
        name: name.trim(),
        maskedEmail,
        isLogin: check.status === "LOGIN",
        // pass dev code through for display
        ...(otpJson.code ? { devCode: otpJson.code } : {}),
      } as Parameters<typeof onSuccess>[0] & { devCode?: string })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (conflictInfo) {
    return (
      <div className="flex flex-col">
        <div className="mb-6 p-4 rounded-2xl border border-red-100 bg-red-50">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Account already exists</p>
              <p className="text-xs text-red-600 mt-0.5">
                A account with phone <span className="font-semibold">+91 {phone}</span> is already registered.
              </p>
            </div>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Phone</span>
              <span className="font-medium text-gray-800">+91 {phone}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Registered Email</span>
              <span className="font-medium text-gray-800">{conflictInfo.maskedEmail}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Please login with your registered email.</p>
        </div>

        <Button
          onClick={onSwitchToLogin}
          className="w-full h-12 text-base font-semibold rounded-xl text-white mb-3"
          style={{ backgroundColor: brandColor }}
        >
          <LogIn className="w-4 h-4 mr-2" />
          Login with Registered Email
        </Button>
        <button
          onClick={() => setConflictInfo(null)}
          className="text-sm text-gray-500 hover:text-gray-700 text-center"
        >
          Use a different phone number
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Create Account</h2>
      <p className="text-sm text-gray-500 mb-5">Enter your details to get started</p>

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Name */}
      <div className="relative mb-3">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <div className="w-px h-5 bg-gray-200" />
        </div>
        <Input
          type="text"
          placeholder="Your Full Name *"
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
          placeholder="Phone Number *"
          value={phone}
          onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(null) }}
          className="pl-[5.5rem] h-12 text-base rounded-xl border-gray-200"
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
          placeholder="Email Address *"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null) }}
          className="pl-12 h-12 text-base rounded-xl border-gray-200"
        />
      </div>

      <Button
        onClick={handleContinue}
        disabled={!isValid || loading}
        className="w-full h-12 text-base font-semibold rounded-xl text-white disabled:bg-gray-200 disabled:text-gray-400"
        style={{ backgroundColor: isValid ? brandColor : undefined }}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking...
          </span>
        ) : (
          "Continue"
        )}
      </Button>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-[11px] text-gray-400">already have an account?</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <button
        onClick={onSwitchToLogin}
        className="w-full h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors mb-3"
      >
        Login
      </button>

      <button
        onClick={onGuest}
        className="text-xs text-gray-400 hover:text-gray-600 text-center transition-colors"
      >
        Browse as guest
      </button>

      <p className="text-[11px] text-gray-400 text-center mt-3 leading-relaxed">
        By continuing, you agree to our{" "}
        <span style={{ color: brandColor }}>Terms</span> &amp;{" "}
        <span style={{ color: brandColor }}>Privacy Policy</span>
      </p>
    </div>
  )
}
