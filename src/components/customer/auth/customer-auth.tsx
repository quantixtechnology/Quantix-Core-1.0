"use client"

import React, { useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store";
import { showSuccess, showError } from "@/lib/toast-utils"
import { CustomerRegister } from "./customer-register"
import { CustomerLogin } from "./customer-login"
import { CustomerOtp } from "./customer-otp"
import { ForgotPassword } from "./forgot-password"
import { ResetPassword } from "./reset-password"

type AuthView = "register" | "login" | "otp" | "forgot" | "reset"
type OtpPurpose = "register" | "login" | "forgot"

interface OtpState {
  phone: string
  email: string
  name: string
  maskedEmail: string
  devCode?: string
  purpose: OtpPurpose
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
  const businessId = currentBusinessId || ""
  const storeId = currentStoreId || undefined

  const { loginWithOtp } = useAuthStore()

  const [view, setView] = useState<AuthView>("register")
  const [otpState, setOtpState] = useState<OtpState | null>(null)

  // forgot recovery state
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState("")
  const [forgotDevCode, setForgotDevCode] = useState<string | undefined>()

  const handlePostLogin = (name: string) => {
    setCustomerLoggedIn(true)
    setCustomerName(name)
    if (customerNavStack.length > 0) popCustomerPage()
    else setCustomerPage("home")
  }

  const storeSessionAndLogin = (session: Record<string, unknown>, userName: string) => {
    const accessToken = session.accessToken as string | undefined
    const refreshToken = session.refreshToken as string | undefined
    // Persist into the ISOLATED customer namespace (quantix_customer_*) shared
    // with the Customer Website — never the Admin namespace.
    if (accessToken) {
      useAuthStore.getState().setSession({ token: accessToken, refreshToken: refreshToken || null, user: (session.user as Record<string, unknown>) || { role: "CUSTOMER", name: userName }, businesses: session.businesses })
    }
    handlePostLogin(userName)
    showSuccess("Welcome!", `Hi ${userName}, you're now signed in.`)
  }

  // ── OTP verify handler ────────────────────────────────────────────────────

  const handleVerifyOtp = async (code: string) => {
    if (!otpState) return
    const { email, phone, name, purpose } = otpState

    if (purpose === "forgot") {
      // Handled by ResetPassword component — shouldn't reach here
      return
    }

    const res = await fetch("/api/core/storefront/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, code, name, businessId, storeId }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || "Invalid code")

    const session = json.data as Record<string, unknown>
    const user = session.user as Record<string, unknown> | undefined
    const userName = (user?.name as string) || name || "User"

    // Update auth store
    try { await loginWithOtp(phone, code) } catch { /* non-critical */ }

    storeSessionAndLogin(session, userName)
  }

  // ── OTP resend handler ────────────────────────────────────────────────────

  const handleResendOtp = async () => {
    if (!otpState) return
    const res = await fetch("/api/core/storefront/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: otpState.email, businessId, storeId }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || "Failed to resend")
    setOtpState(prev => prev ? { ...prev, devCode: json.code } : prev)
  }

  // ── Reset password resend ─────────────────────────────────────────────────

  const handleResendForgotOtp = async () => {
    const res = await fetch("/api/core/storefront/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail, businessId, storeId }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || "Failed to resend")
    return { devCode: json.code }
  }

  // ── Handle session from reset password ────────────────────────────────────

  const handleResetComplete = (session: Record<string, unknown>) => {
    const user = session.user as Record<string, unknown> | undefined
    const userName = (user?.name as string) || "User"
    storeSessionAndLogin(session, userName)
    showSuccess("Password set!", "You can now login with email + password.")
  }

  // ── Branding wrapper ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(160deg, ${brandColor} 0%, ${brandColor}cc 100%)` }}>
      {/* Top branding */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6 min-h-[160px]">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
          <span className="font-extrabold text-2xl" style={{ color: brandColor }}>{displayInitials}</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{displayName}</h1>
        <p className="text-white/80 text-sm text-center">
          {view === "register" && "Create your account to get started"}
          {view === "login" && "Sign in to your account"}
          {view === "otp" && "Check your email for the code"}
          {view === "forgot" && "Recover access to your account"}
          {view === "reset" && "Set a new password"}
        </p>
      </div>

      {/* Bottom card */}
      <div className="bg-white rounded-t-3xl px-6 py-8 flex flex-col">

        {view === "register" && (
          <CustomerRegister
            brandColor={brandColor}
            businessId={businessId}
            storeId={storeId}
            onSuccess={(data) => {
              const extra = data as typeof data & { devCode?: string }
              setOtpState({
                phone: data.phone,
                email: data.email,
                name: data.name,
                maskedEmail: data.maskedEmail,
                devCode: extra.devCode,
                purpose: data.isLogin ? "login" : "register",
              })
              setView("otp")
              if (data.isLogin) showSuccess("Welcome back!", "A verification code has been sent to your email.")
            }}
            onSwitchToLogin={() => setView("login")}
            onGuest={() => {
              if (customerNavStack.length > 0) popCustomerPage()
              else setCustomerPage("home")
            }}
          />
        )}

        {view === "login" && (
          <CustomerLogin
            brandColor={brandColor}
            businessId={businessId}
            storeId={storeId}
            onSuccess={(data) => {
              setOtpState({
                phone: data.phone,
                email: data.email,
                name: "",
                maskedEmail: data.maskedEmail,
                devCode: data.devCode,
                purpose: "login",
              })
              setView("otp")
            }}
            onForgotAccount={() => setView("forgot")}
            onSwitchToRegister={() => setView("register")}
          />
        )}

        {view === "otp" && otpState && (
          <CustomerOtp
            maskedEmail={otpState.maskedEmail}
            devCode={otpState.devCode}
            purpose={otpState.purpose}
            brandColor={brandColor}
            onVerify={handleVerifyOtp}
            onResend={handleResendOtp}
            onBack={() => {
              setView(otpState.purpose === "login" ? "login" : "register")
              setOtpState(null)
            }}
          />
        )}

        {view === "forgot" && (
          <ForgotPassword
            brandColor={brandColor}
            businessId={businessId}
            storeId={storeId}
            onFound={(data) => {
              setForgotEmail(data.email)
              setForgotMaskedEmail(data.maskedEmail)
              setForgotDevCode(data.devCode)
              setView("reset")
            }}
            onBack={() => setView("login")}
          />
        )}

        {view === "reset" && (
          <ResetPassword
            email={forgotEmail}
            maskedEmail={forgotMaskedEmail}
            devCode={forgotDevCode}
            brandColor={brandColor}
            businessId={businessId}
            storeId={storeId}
            onReset={handleResetComplete}
            onBack={() => setView("forgot")}
            onResendCode={handleResendForgotOtp}
          />
        )}

      </div>
    </div>
  )
}
