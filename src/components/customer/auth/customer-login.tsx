"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Phone, Mail, Loader2, AlertCircle, HelpCircle } from "lucide-react"

interface Props {
  onSuccess: (data: { phone: string; email: string; maskedEmail: string; devCode?: string }) => void
  onForgotAccount: () => void
  onSwitchToRegister: () => void
  brandColor: string
  businessId: string
  storeId?: string
}

export function CustomerLogin({ onSuccess, onForgotAccount, onSwitchToRegister, brandColor, businessId, storeId }: Props) {
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = phone.length === 10 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const handleLogin = async () => {
    if (!isValid || loading) return
    setLoading(true)
    setError(null)

    const fullPhone = `+91${phone}`
    const normEmail = email.trim().toLowerCase()

    try {
      // Validate phone + email match
      const checkRes = await fetch("/api/core/storefront/auth/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, email: normEmail, businessId }),
      })
      const check = await checkRes.json()
      if (!check.success) throw new Error(check.error || "Check failed")

      if (check.status === "NEW") {
        setError("No account found with this phone number. Please register first.")
        setLoading(false)
        return
      }
      if (check.status === "CONFLICT") {
        setError(`Phone is registered with a different email: ${check.maskedEmail}`)
        setLoading(false)
        return
      }

      // Send OTP
      const otpRes = await fetch("/api/core/storefront/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normEmail, businessId, storeId }),
      })
      const otpJson = await otpRes.json()
      if (!otpJson.success) throw new Error(otpJson.error || "Failed to send code")

      onSuccess({
        phone: fullPhone,
        email: normEmail,
        maskedEmail: check.maskedEmail || normEmail.replace(/^(.{2}).*@/, "$1***@"),
        ...(otpJson.code ? { devCode: otpJson.code } : {}),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome Back</h2>
      <p className="text-sm text-gray-500 mb-5">Sign in with your phone and email</p>

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

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
        onClick={handleLogin}
        disabled={!isValid || loading}
        className="w-full h-12 text-base font-semibold rounded-xl text-white disabled:bg-gray-200 disabled:text-gray-400"
        style={{ backgroundColor: isValid ? brandColor : undefined }}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending Code...
          </span>
        ) : (
          "Send Verification Code"
        )}
      </Button>

      <button
        onClick={onForgotAccount}
        className="flex items-center justify-center gap-1.5 mt-4 text-xs font-medium transition-colors"
        style={{ color: brandColor }}
      >
        <HelpCircle className="w-3.5 h-3.5" />
        Forgot account / email?
      </button>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-[11px] text-gray-400">new customer?</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <button
        onClick={onSwitchToRegister}
        className="w-full h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        Create Account
      </button>
    </div>
  )
}
