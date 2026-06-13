"use client"

import { useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { setBusinessContext } from "@/lib/api-client"
import { showSuccess, showError } from "@/lib/toast-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bike, Mail, Lock, Shield, ArrowRight, Loader2, Eye, EyeOff, KeyRound } from "lucide-react"

// Delivery Partner login — unified Quantix email + password authentication.
// Uses the same flow as Business Users (useAuthStore.login → /api/core/auth/login),
// so session, refresh token, and store/business context are all handled centrally.
// First-time partners issued a temporary password are forced to set a new one
// before reaching the dashboard.
export function DeliveryLogin() {
  const { setDeliveryLoggedIn, setDeliveryPartnerName, setDeliveryPage } = useAdminStore()
  const { login, logout, isLoading: isAuthLoading } = useAuthStore()

  const [step, setStep] = useState<"login" | "change-password">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState("")

  // Forced first-login password change
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changing, setChanging] = useState(false)

  // Finalize the delivery session once auth + (optional) password change succeed.
  const finishLogin = () => {
    const auth = useAuthStore.getState()
    const bizId = auth.currentBusinessId || auth.user?.businessId
    if (bizId) setBusinessContext(bizId)
    const partnerName = auth.user?.name || auth.user?.email || "Delivery Partner"
    setDeliveryLoggedIn(true)
    setDeliveryPartnerName(partnerName)
    setDeliveryPage("dashboard")
    showSuccess("Login Successful", `Welcome, ${partnerName}!`)
  }

  const handleLogin = async () => {
    const identifier = email.trim()
    if (!identifier || !password) {
      setError("Enter your email and password")
      return
    }
    setError("")
    try {
      await login(identifier, password)
      const auth = useAuthStore.getState()

      // Role guard: this app is for delivery partners only.
      if (auth.currentRole !== "DELIVERY_STAFF") {
        logout()
        setError("This login is for delivery partners only.")
        showError("Access Denied", "This account is not a delivery partner.")
        return
      }

      // Forced rotation for temp passwords issued at onboarding.
      if (auth.user?.mustChangePassword) {
        setStep("change-password")
        return
      }

      finishLogin()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid email or password"
      setError(message)
      showError("Login Failed", message)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    setError("")
    setChanging(true)
    try {
      const token = useAuthStore.getState().token
      const res = await fetch("/api/core/delivery/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // The current (temporary) password is the one just used to sign in.
        body: JSON.stringify({ currentPassword: password, newPassword }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || "Could not change password")
        showError("Update Failed", json.error || "Could not change password")
        return
      }
      // Reflect the cleared flag locally so a re-login isn't required.
      const auth = useAuthStore.getState()
      if (auth.user) auth.user.mustChangePassword = false
      showSuccess("Password Updated", "Your new password is set.")
      finishLogin()
    } catch {
      setError("Could not change password. Please try again.")
    } finally {
      setChanging(false)
    }
  }

  const isLoading = isAuthLoading

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-600 via-teal-500 to-teal-700 flex flex-col relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-[-60px] right-[-60px] h-48 w-48 rounded-full bg-teal-400/30" />
      <div className="absolute bottom-[-40px] left-[-40px] h-36 w-36 rounded-full bg-teal-400/20" />
      <div className="absolute top-[40%] left-[-20px] h-24 w-24 rounded-full bg-teal-400/10" />

      {/* Top section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-8 relative z-10">
        <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6 shadow-lg">
          <Bike className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Delivery Partner App</h1>
        <p className="text-teal-100 text-sm text-center mb-1">Sign in to receive and deliver orders</p>
        <div className="flex items-center gap-1.5 mt-2">
          <Shield className="h-3.5 w-3.5 text-teal-200" />
          <span className="text-xs text-teal-200">Secure Login</span>
        </div>
      </div>

      {/* Bottom card section */}
      <div className="bg-white rounded-t-3xl px-6 pt-8 pb-10 relative z-10">
        {step === "login" ? (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome Back!</h2>
            <p className="text-sm text-gray-500 mb-6">Login with your registered email and password</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    autoComplete="username"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError("") }}
                    className="pl-10 h-12 text-base rounded-xl border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError("") }}
                    className="pl-10 pr-10 h-12 text-base rounded-xl border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  Keep me signed in
                </label>
                <button
                  type="button"
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  onClick={() => showError("Forgot Password", "Contact your store administrator to reset your password.")}
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <Button
                onClick={handleLogin}
                disabled={isLoading || !email.trim() || !password}
                className="w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base shadow-lg shadow-teal-600/30 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (<>Login <ArrowRight className="h-4 w-4 ml-2" /></>)}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="h-5 w-5 text-teal-600" />
              <h2 className="text-xl font-bold text-gray-900">Set a New Password</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              For your security, please replace the temporary password before continuing.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); if (error) setError("") }}
                    className="pl-10 pr-10 h-12 text-base rounded-xl border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError("") }}
                    className="pl-10 h-12 text-base rounded-xl border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                    onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <Button
                onClick={handleChangePassword}
                disabled={changing || !newPassword || !confirmPassword}
                className="w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base shadow-lg shadow-teal-600/30 disabled:opacity-50"
              >
                {changing ? <Loader2 className="h-5 w-5 animate-spin" /> : (<>Save & Continue <ArrowRight className="h-4 w-4 ml-2" /></>)}
              </Button>
            </div>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-center text-xs text-gray-400">
            By logging in, you agree to our <span className="text-teal-600">Terms of Service</span> &{" "}
            <span className="text-teal-600">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  )
}
