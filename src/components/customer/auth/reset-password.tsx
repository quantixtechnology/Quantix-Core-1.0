"use client"

import React, { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { ArrowLeft, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react"

interface PasswordRule {
  label: string
  test: (pw: string) => boolean
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: pw => pw.length >= 8 },
  { label: "One uppercase letter", test: pw => /[A-Z]/.test(pw) },
  { label: "One lowercase letter", test: pw => /[a-z]/.test(pw) },
  { label: "One number", test: pw => /[0-9]/.test(pw) },
  { label: "One special character", test: pw => /[^A-Za-z0-9]/.test(pw) },
]

const COOLDOWN_SECONDS = 30

interface Props {
  email: string
  maskedEmail: string
  devCode?: string
  onReset: (session: Record<string, unknown>) => void
  onBack: () => void
  brandColor: string
  businessId: string
  storeId?: string
  onResendCode: () => Promise<{ devCode?: string }>
}

export function ResetPassword({ email, maskedEmail, devCode: initialDevCode, onReset, onBack, brandColor, businessId, storeId, onResendCode }: Props) {
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS)
  const [devCode, setDevCode] = useState(initialDevCode)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = useCallback((from = COOLDOWN_SECONDS) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCooldown(from)
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => {
    startCooldown()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [startCooldown])

  const pwRules = PASSWORD_RULES.map(r => ({ ...r, passed: r.test(password) }))
  const allRulesPass = pwRules.every(r => r.passed)
  const passwordsMatch = password === confirm && confirm.length > 0
  const isValid = code.length === 6 && allRulesPass && passwordsMatch

  const handleReset = async () => {
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/core/storefront/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password, businessId, storeId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Reset failed")
      onReset(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resending || cooldown > 0) return
    setResending(true)
    try {
      const result = await onResendCode()
      if (result.devCode) setDevCode(result.devCode)
      startCooldown()
      setCode("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resend failed")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-gray-500 mb-4 -mt-1 hover:text-gray-700 transition-colors self-start"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back</span>
      </button>

      <h2 className="text-xl font-bold text-gray-900 mb-1">Set New Password</h2>
      <p className="text-sm text-gray-500 mb-1">Code sent to <span className="font-medium text-gray-700">{maskedEmail}</span></p>

      {devCode && (
        <div className="mb-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <p className="text-xs text-amber-700">
            Dev code: <span className="font-mono font-bold text-amber-900">{devCode}</span>
          </p>
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* OTP */}
      <p className="text-xs font-medium text-gray-600 mb-2">Verification Code</p>
      <div className="flex justify-center mb-4">
        <InputOTP maxLength={6} value={code} onChange={(v) => { setCode(v); setError(null) }}>
          <InputOTPGroup>
            <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <div className="flex justify-center mb-4">
        <button
          className="text-xs flex items-center gap-1.5 font-medium disabled:opacity-40"
          style={{ color: cooldown > 0 || resending ? "#9ca3af" : brandColor }}
          disabled={cooldown > 0 || resending}
          onClick={handleResend}
        >
          {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>

      {/* New password */}
      <p className="text-xs font-medium text-gray-600 mb-2">New Password</p>
      <div className="relative mb-2">
        <Input
          type={showPw ? "text" : "password"}
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 text-base rounded-xl border-gray-200 pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPw(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        >
          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* Password rules */}
      {password.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-1">
          {pwRules.map(rule => (
            <div key={rule.label} className="flex items-center gap-1">
              <CheckCircle2 className={`w-3 h-3 shrink-0 ${rule.passed ? "text-emerald-500" : "text-gray-300"}`} />
              <span className={`text-[10px] ${rule.passed ? "text-emerald-700" : "text-gray-400"}`}>{rule.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Confirm */}
      <div className="relative mb-5">
        <Input
          type={showConfirm ? "text" : "password"}
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={`h-12 text-base rounded-xl border-gray-200 pr-10 ${confirm.length > 0 && !passwordsMatch ? "border-red-300" : ""}`}
        />
        <button
          type="button"
          onClick={() => setShowConfirm(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        >
          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {confirm.length > 0 && !passwordsMatch && (
        <p className="text-xs text-red-500 -mt-4 mb-3">Passwords do not match</p>
      )}

      <Button
        onClick={handleReset}
        disabled={!isValid || loading}
        className="w-full h-12 text-base font-semibold rounded-xl text-white disabled:bg-gray-200 disabled:text-gray-400"
        style={{ backgroundColor: isValid ? brandColor : undefined }}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Setting password...
          </span>
        ) : (
          "Set Password & Login"
        )}
      </Button>
    </div>
  )
}
