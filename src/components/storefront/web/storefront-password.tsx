"use client"

import { useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react"
import type { WebNav } from "./storefront-website"

interface StorefrontPasswordProps {
  brandColor: string
  nav: WebNav
}

export function StorefrontPassword({ brandColor, nav }: StorefrontPasswordProps) {
  const { user, token } = useAuthStore()

  const hasPassword = user?.hasPassword
  const isSettingNew = !hasPassword

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword,     setNewPassword]     = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState("")
  const [success, setSuccess] = useState("")

  async function handleSubmit() {
    setError(""); setSuccess("")
    if (!newPassword || !confirmPassword) { setError("All fields are required"); return }
    if (newPassword !== confirmPassword)  { setError("Passwords do not match"); return }
    if (newPassword.length < 8)           { setError("Password must be at least 8 characters"); return }
    if (!isSettingNew && !currentPassword) { setError("Current password is required"); return }

    setSaving(true)
    try {
      const endpoint = isSettingNew
        ? "/api/customer/auth/create-password"
        : "/api/customer/auth/change-password"

      const body = isSettingNew
        ? { password: newPassword, confirmPassword }
        : { currentPassword, newPassword, confirmPassword }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        setSuccess(isSettingNew ? "Password created! You can now login with your password." : "Password changed successfully.")
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("")
        // Refresh the page after 2s so hasPassword updates
        setTimeout(() => nav.go("profile"), 2000)
      } else {
        setError(data.error || "Failed to save password")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full h-11 px-3 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white"

  function PasswordField({
    label, value, onChange, show, onToggle, placeholder,
  }: { label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string }) {
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || label}
            className={inputCls}
          />
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => nav.goBack("profile")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {isSettingNew ? "Create Password" : "Change Password"}
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        {isSettingNew
          ? "Set a password so you can log in without OTP next time."
          : "Update your account password."}
      </p>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        {!isSettingNew && (
          <PasswordField
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggle={() => setShowCurrent((p) => !p)}
            placeholder="Enter current password"
          />
        )}
        <PasswordField
          label="New Password"
          value={newPassword}
          onChange={setNewPassword}
          show={showNew}
          onToggle={() => setShowNew((p) => !p)}
          placeholder="Min. 8 characters"
        />
        <PasswordField
          label="Confirm New Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          show={showConfirm}
          onToggle={() => setShowConfirm((p) => !p)}
          placeholder="Re-enter new password"
        />

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full h-11 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: brandColor }}
        >
          {saving ? "Saving…" : isSettingNew ? "Create Password" : "Change Password"}
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        You can always log in with OTP even after setting a password.
      </p>
    </div>
  )
}
