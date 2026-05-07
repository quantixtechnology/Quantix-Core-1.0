"use client"

import { useState, useRef } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { partnerProfile } from "@/components/delivery/data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Bike, Phone, Shield, ArrowRight, Loader2 } from "lucide-react"

export function DeliveryLogin() {
  const { setDeliveryLoggedIn, setDeliveryPartnerName, setDeliveryPage } = useAdminStore()
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSendOtp = () => {
    if (phone.length < 10) {
      setError("Please enter a valid 10-digit phone number")
      return
    }
    setIsLoading(true)
    setError("")
    setTimeout(() => {
      setIsLoading(false)
      setStep("otp")
    }, 1500)
  }

  const handleVerifyOtp = () => {
    if (otp.length < 4) {
      setError("Please enter the 4-digit OTP")
      return
    }
    setIsLoading(true)
    setError("")
    setTimeout(() => {
      setIsLoading(false)
      if (otp === "1234" || otp.length === 4) {
        setDeliveryLoggedIn(true)
        setDeliveryPartnerName(partnerProfile.name)
        setDeliveryPage("dashboard")
      } else {
        setError("Invalid OTP. Try again.")
      }
    }, 1500)
  }

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10)
    setPhone(digits)
    if (error) setError("")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-600 via-teal-500 to-teal-700 flex flex-col relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-[-60px] right-[-60px] h-48 w-48 rounded-full bg-teal-400/30" />
      <div className="absolute bottom-[-40px] left-[-40px] h-36 w-36 rounded-full bg-teal-400/20" />
      <div className="absolute top-[40%] left-[-20px] h-24 w-24 rounded-full bg-teal-400/10" />

      {/* Top section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-8 relative z-10">
        {/* Logo / Icon */}
        <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6 shadow-lg">
          <Bike className="h-10 w-10 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">Quantix Delivery</h1>
        <p className="text-teal-100 text-sm text-center mb-1">
          Delivery Partner App
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <Shield className="h-3.5 w-3.5 text-teal-200" />
          <span className="text-xs text-teal-200">Secure & Fast Login</span>
        </div>
      </div>

      {/* Bottom card section */}
      <div className="bg-white rounded-t-3xl px-6 pt-8 pb-10 relative z-10">
        {step === "phone" ? (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Welcome Back!
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter your phone number to login
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-gray-400">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm font-medium">+91</span>
                    <span className="w-px h-5 bg-gray-300" />
                  </div>
                  <Input
                    ref={inputRef}
                    type="tel"
                    placeholder="Enter 10-digit number"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="pl-[72px] h-12 text-base rounded-xl border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                    maxLength={10}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                  />
                </div>
                {phone.length > 0 && phone.length < 10 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {10 - phone.length} more digit{10 - phone.length !== 1 ? "s" : ""} needed
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <Button
                onClick={handleSendOtp}
                disabled={isLoading || phone.length < 10}
                className="w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base shadow-lg shadow-teal-600/30 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Send OTP
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Verify OTP
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter the 4-digit code sent to{" "}
              <span className="font-medium text-gray-700">+91 {phone}</span>
            </p>

            <div className="space-y-5">
              <div className="flex flex-col items-center">
                <InputOTP
                  value={otp}
                  onChange={setOtp}
                  maxLength={4}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="h-14 w-14 text-xl font-bold rounded-lg border-2 data-[active=true]:border-teal-500" />
                    <InputOTPSlot index={1} className="h-14 w-14 text-xl font-bold rounded-lg border-2 data-[active=true]:border-teal-500" />
                    <InputOTPSlot index={2} className="h-14 w-14 text-xl font-bold rounded-lg border-2 data-[active=true]:border-teal-500" />
                    <InputOTPSlot index={3} className="h-14 w-14 text-xl font-bold rounded-lg border-2 data-[active=true]:border-teal-500" />
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-xs text-gray-400 mt-3">
                  Demo: Enter any 4 digits to login
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <Button
                onClick={handleVerifyOtp}
                disabled={isLoading || otp.length < 4}
                className="w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base shadow-lg shadow-teal-600/30 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Verify & Login
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setStep("phone")
                    setOtp("")
                    setError("")
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Change number
                </button>
                <button
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  onClick={() => {
                    setOtp("1234")
                  }}
                >
                  Resend OTP
                </button>
              </div>
            </div>
          </>
        )}

        {/* Bottom info */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-center text-xs text-gray-400">
            By logging in, you agree to our{" "}
            <span className="text-teal-600">Terms of Service</span> &{" "}
            <span className="text-teal-600">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  )
}
