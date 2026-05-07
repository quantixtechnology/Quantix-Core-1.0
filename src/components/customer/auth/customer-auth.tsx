"use client"

import React, { useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Phone, ArrowLeft, Shield } from "lucide-react"

export function CustomerAuth() {
  const { setCustomerLoggedIn, setCustomerName, setCustomerPage } = useAdminStore()
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSendOTP = () => {
    if (phone.length < 10) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setStep("otp")
    }, 1000)
  }

  const handleVerifyOTP = () => {
    if (otp.length < 6) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setCustomerLoggedIn(true)
      setCustomerName("Rajesh Kumar")
      setCustomerPage("home")
    }, 1200)
  }

  const handleBack = () => {
    if (step === "otp") {
      setStep("phone")
      setOtp("")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-500 to-emerald-600 flex flex-col">
      {/* Top Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-8">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
          <span className="text-emerald-600 font-extrabold text-2xl">FM</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">FreshMart Grocers</h1>
        <p className="text-emerald-100 text-sm text-center">
          Fresh groceries delivered to your doorstep
        </p>
      </div>

      {/* Bottom Card */}
      <div className="bg-white rounded-t-3xl px-6 py-8 flex flex-col">
        {step === "phone" ? (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome!</h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter your phone number to continue
            </p>

            <div className="relative mb-4">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500 font-medium">+91</span>
                <div className="w-px h-5 bg-gray-200" />
              </div>
              <Input
                type="tel"
                placeholder="Enter phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="pl-20 h-12 text-base rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                maxLength={10}
              />
            </div>

            <Button
              onClick={handleSendOTP}
              disabled={phone.length < 10 || loading}
              className="w-full h-12 text-base font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400"
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </Button>

            <p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
              By continuing, you agree to our{" "}
              <span className="text-emerald-600">Terms of Service</span> &{" "}
              <span className="text-emerald-600">Privacy Policy</span>
            </p>
          </>
        ) : (
          <>
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-gray-500 mb-4 -mt-1 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>

            <h2 className="text-xl font-bold text-gray-900 mb-1">Verify OTP</h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter the 6-digit code sent to{" "}
              <span className="font-medium text-gray-700">+91 {phone}</span>
            </p>

            <div className="flex justify-center mb-6">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
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
              onClick={handleVerifyOTP}
              disabled={otp.length < 6 || loading}
              className="w-full h-12 text-base font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400"
            >
              {loading ? "Verifying..." : "Verify & Continue"}
            </Button>

            <div className="flex items-center justify-center gap-1.5 mt-4">
              <Shield className="w-3 h-3 text-gray-400" />
              <p className="text-[11px] text-gray-400">
                Didn&apos;t receive?{" "}
                <button className="text-emerald-600 font-medium">Resend OTP</button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
