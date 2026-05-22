"use client"

import { useState, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { Phone, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react"
import type { WebNav } from "./storefront-website"

interface StorefrontAuthProps {
  brandColor: string
  nav: WebNav
}

export function StorefrontAuth({ brandColor, nav }: StorefrontAuthProps) {
  const { currentBusinessId, currentBusinessName } = useAdminStore()
  const { isAuthenticated } = useAuthStore()

  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isAuthenticated && !success) {
      nav.go(nav.prevPage || "home")
    }
  }, [isAuthenticated, success, nav])

  async function sendOtp() {
    if (phone.length < 10) { setError("Enter a valid 10-digit phone number"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/core/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+91${phone}`, channel: "WHATSAPP_OTP" }),
      })
      const data = await res.json()
      if (data.success) setStep("otp")
      else setError(data.error || "Failed to send OTP")
    } catch { setError("Network error") } finally { setLoading(false) }
  }

  async function verifyOtp() {
    if (otp.length < 4) { setError("Enter the OTP"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/core/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: `+91${phone}`,
          code: otp,
          channel: "WHATSAPP_OTP",
          businessId: currentBusinessId || undefined,
        }),
      })
      const data = await res.json()
      if (data.success && data.data) {
        const { user: sessionUser, accessToken, refreshToken, businesses, permissions } = data.data
        // Persist session to localStorage using auth-store keys
        localStorage.setItem("quantix_auth_token", accessToken)
        localStorage.setItem("quantix_auth_refresh_token", refreshToken || "")
        localStorage.setItem("quantix_auth_user", JSON.stringify(sessionUser))
        localStorage.setItem("quantix_auth_role", sessionUser.role || "CUSTOMER")
        if (sessionUser.businessId) localStorage.setItem("quantix_auth_business_id", sessionUser.businessId)
        if (sessionUser.businessName) localStorage.setItem("quantix_auth_business_name", sessionUser.businessName)
        if (sessionUser.businessType) localStorage.setItem("quantix_auth_business_type", sessionUser.businessType)
        if (permissions?.length) localStorage.setItem("quantix_auth_permissions", JSON.stringify(permissions))
        if (businesses?.length) localStorage.setItem("quantix_auth_businesses", JSON.stringify(businesses))
        // Hydrate auth store from localStorage
        useAuthStore.getState().initialize()
        setSuccess(true)
        setTimeout(() => nav.go(nav.prevPage || "home"), 900)
      } else {
        setError(data.error || "Invalid OTP")
      }
    } catch { setError("Network error") } finally { setLoading(false) }
  }

  const initial = (currentBusinessName || "Q").charAt(0).toUpperCase()

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <button
          onClick={() => nav.go(nav.prevPage || "home")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-4"
              style={{ backgroundColor: brandColor }}
            >
              {initial}
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              {step === "phone" ? "Sign in to continue" : "Verify your number"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {step === "phone"
                ? `Welcome to ${currentBusinessName || "the store"}`
                : `Enter the OTP sent to +91 ${phone}`}
            </p>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="text-sm font-medium text-gray-700">Signed in successfully!</p>
            </div>
          ) : step === "phone" ? (
            <>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone Number</label>
                <div className="flex items-center border border-gray-200 rounded-xl px-3 h-12 focus-within:border-gray-400 transition-colors">
                  <div className="flex items-center gap-1.5 text-sm text-gray-600 shrink-0 border-r border-gray-200 pr-3">
                    <Phone className="w-4 h-4" />
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    placeholder="10-digit number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                    className="flex-1 text-sm outline-none bg-transparent ml-3"
                    autoFocus
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
              <button
                onClick={sendOtp}
                disabled={loading || phone.length < 10}
                className="w-full h-12 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: brandColor }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send OTP via WhatsApp"}
              </button>
            </>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Enter OTP</label>
                <input
                  type="text"
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                  className="w-full h-12 px-4 text-center text-2xl font-bold tracking-[0.5em] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 transition-colors"
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
              <button
                onClick={verifyOtp}
                disabled={loading || otp.length < 4}
                className="w-full h-12 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: brandColor }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Sign In"}
              </button>
              <button
                onClick={() => { setStep("phone"); setOtp(""); setError("") }}
                className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Change number
              </button>
            </>
          )}

          <p className="text-xs text-gray-400 text-center mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => nav.go("checkout")}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors underline underline-offset-2"
          >
            Continue as guest instead
          </button>
        </div>
      </div>
    </div>
  )
}
