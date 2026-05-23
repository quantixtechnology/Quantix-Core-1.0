"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Phone, ArrowLeft, Loader2, Mail, AlertCircle } from "lucide-react"

interface Props {
  onFound: (data: { email: string; maskedEmail: string; devCode?: string }) => void
  onBack: () => void
  brandColor: string
  businessId: string
  storeId?: string
}

export function ForgotPassword({ onFound, onBack, brandColor, businessId, storeId }: Props) {
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = phone.length === 10

  const handleLookup = async () => {
    if (!isValid || loading) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/core/storefront/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+91${phone}`, businessId, storeId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Lookup failed")

      if (json.status === "NOT_FOUND") {
        // Generic message — don't reveal if account exists
        setError("If an account exists with this number, a recovery code has been sent to the registered email.")
        setLoading(false)
        return
      }

      onFound({
        email: json.email,
        maskedEmail: json.maskedEmail,
        ...(json.code ? { devCode: json.code } : {}),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-gray-500 mb-4 -mt-1 hover:text-gray-700 transition-colors self-start"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to login</span>
      </button>

      <h2 className="text-xl font-bold text-gray-900 mb-1">Forgot Account?</h2>
      <p className="text-sm text-gray-500 mb-5">
        Enter your phone number and we&apos;ll send a recovery code to your registered email.
      </p>

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">{error}</p>
        </div>
      )}

      <div className="relative mb-5">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <Phone className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500 font-medium">+91</span>
          <div className="w-px h-5 bg-gray-200" />
        </div>
        <Input
          type="tel"
          placeholder="Your Phone Number"
          value={phone}
          onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(null) }}
          className="pl-[5.5rem] h-12 text-base rounded-xl border-gray-200"
          maxLength={10}
        />
      </div>

      <Button
        onClick={handleLookup}
        disabled={!isValid || loading}
        className="w-full h-12 text-base font-semibold rounded-xl text-white disabled:bg-gray-200 disabled:text-gray-400"
        style={{ backgroundColor: isValid ? brandColor : undefined }}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Looking up...
          </span>
        ) : (
          "Send Recovery Code"
        )}
      </Button>

      <div className="mt-6 flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-3">
        <Mail className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-gray-500 leading-relaxed">
          The recovery code will be sent to the email address you used when creating your account.
          If you don&apos;t have access to that email, please contact support.
        </p>
      </div>
    </div>
  )
}
