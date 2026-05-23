"use client"

import React, { useState, useCallback, useEffect, useRef } from "react"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, Loader2, RefreshCw, AlertCircle } from "lucide-react"

interface Props {
  maskedEmail: string
  devCode?: string
  onVerify: (code: string) => Promise<void>
  onResend: () => Promise<void>
  onBack: () => void
  brandColor: string
  purpose: "register" | "login" | "forgot"
}

const MAX_ATTEMPTS = 5
const COOLDOWN_SECONDS = 30

export function CustomerOtp({ maskedEmail, devCode, onVerify, onResend, onBack, brandColor, purpose }: Props) {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCooldown(COOLDOWN_SECONDS)
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  // Start initial cooldown when screen mounts
  useEffect(() => {
    startCooldown()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [startCooldown])

  const isLocked = attempts >= MAX_ATTEMPTS

  const handleVerify = async () => {
    if (code.length < 6 || loading || isLocked) return
    setLoading(true)
    setError(null)
    try {
      await onVerify(code)
    } catch (err) {
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      if (newAttempts >= MAX_ATTEMPTS) {
        setError(`Too many failed attempts. Please request a new code.`)
      } else {
        setError(err instanceof Error ? err.message : "Invalid code. Please try again.")
      }
      setCode("")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resending || cooldown > 0) return
    setResending(true)
    setError(null)
    setCode("")
    setAttempts(0)
    try {
      await onResend()
      startCooldown()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend. Try again.")
    } finally {
      setResending(false)
    }
  }

  const subtitle: Record<typeof purpose, string> = {
    register: "Verify your email to complete registration",
    login: "Verify to sign in to your account",
    forgot: "Enter the code to reset your password",
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

      <h2 className="text-xl font-bold text-gray-900 mb-1">Enter Code</h2>
      <p className="text-sm text-gray-500 mb-2">{subtitle[purpose]}</p>

      <div className="flex items-center gap-2 mb-5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
        <Mail className="w-4 h-4 text-blue-500 shrink-0" />
        <p className="text-sm text-blue-800">
          Code sent to <span className="font-semibold">{maskedEmail}</span>
        </p>
      </div>

      {devCode && (
        <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <p className="text-xs text-amber-700">
            Dev mode — code: <span className="font-mono font-bold text-amber-900">{devCode}</span>
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="flex justify-center mb-6">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(v) => { setCode(v); setError(null) }}
          disabled={isLocked}
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
        disabled={code.length < 6 || loading || isLocked}
        className="w-full h-12 text-base font-semibold rounded-xl text-white disabled:bg-gray-200 disabled:text-gray-400"
        style={{ backgroundColor: code.length === 6 && !isLocked ? brandColor : undefined }}
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

      <div className="flex items-center justify-center gap-1.5 mt-4">
        <button
          className="text-xs flex items-center gap-1.5 font-medium disabled:opacity-40 transition-opacity"
          style={{ color: cooldown > 0 || resending ? "#9ca3af" : brandColor }}
          disabled={cooldown > 0 || resending}
          onClick={handleResend}
        >
          {resending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>

      {attempts > 0 && !isLocked && (
        <p className="text-center text-[11px] text-gray-400 mt-2">
          {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? "s" : ""} remaining
        </p>
      )}
    </div>
  )
}
