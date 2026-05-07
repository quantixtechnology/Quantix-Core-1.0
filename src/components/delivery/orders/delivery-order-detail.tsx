"use client"

import { useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { assignedOrders } from "@/components/delivery/data"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import {
  Phone,
  MapPin,
  Navigation,
  Package,
  Truck,
  CheckCircle2,
  ChevronRight,
  IndianRupee,
  Clock,
  Store,
  CreditCard,
  Banknote,
  Smartphone,
  Shield,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react"

const statusSteps = [
  { key: "PICKUP", label: "Pickup", icon: Package },
  { key: "PICKED_UP", label: "Picked Up", icon: Truck },
  { key: "ON_THE_WAY", label: "On the Way", icon: Navigation },
  { key: "DELIVERED", label: "Delivered", icon: CheckCircle2 },
]

export function DeliveryOrderDetail() {
  const { selectedOrderId, setDeliveryPage } = useAdminStore()
  const [otpInput, setOtpInput] = useState("")
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpError, setOtpError] = useState("")
  const [copied, setCopied] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)

  const order = assignedOrders.find((o) => o.id === selectedOrderId)

  if (!order) {
    return (
      <div className="px-4 py-12 text-center">
        <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Order not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setDeliveryPage("dashboard")}
        >
          Back to Dashboard
        </Button>
      </div>
    )
  }

  const currentStepIndex = statusSteps.findIndex((s) => s.key === order.status)

  const handleVerifyOtp = () => {
    if (otpInput === order.deliveryOtp) {
      setOtpVerified(true)
      setOtpError("")
    } else {
      setOtpError("Invalid OTP. Please try again.")
    }
  }

  const handleCopyOtp = () => {
    navigator.clipboard?.writeText(order.deliveryOtp)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const paymentIcons: Record<string, React.ElementType> = {
    UPI: Smartphone,
    CARD: CreditCard,
    CASH: Banknote,
    COD: Banknote,
  }

  const PaymentIcon = paymentIcons[order.paymentMethod] || Banknote

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Status Progress Bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">{order.orderNumber}</h3>
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0.5 ${
                order.status === "DELIVERED"
                  ? "text-green-700 bg-green-50 border-green-200"
                  : order.status === "ON_THE_WAY"
                  ? "text-teal-700 bg-teal-50 border-teal-200"
                  : order.status === "PICKED_UP"
                  ? "text-blue-700 bg-blue-50 border-blue-200"
                  : "text-amber-700 bg-amber-50 border-amber-200"
              } border-0 font-semibold`}
            >
              {statusSteps[currentStepIndex]?.label || order.status}
            </Badge>
          </div>

          {/* Progress Steps */}
          <div className="relative">
            <div className="flex items-center justify-between relative z-10">
              {statusSteps.map((step, index) => {
                const isCompleted = index <= currentStepIndex
                const isCurrent = index === currentStepIndex

                return (
                  <div key={step.key} className="flex flex-col items-center relative z-10">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center transition-all ${
                        isCompleted
                          ? isCurrent
                            ? "bg-teal-600 text-white shadow-md shadow-teal-600/30 ring-4 ring-teal-100"
                            : "bg-teal-500 text-white"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <step.icon className="h-4 w-4" />
                    </div>
                    <span
                      className={`text-[10px] mt-1.5 font-medium ${
                        isCompleted ? "text-teal-700" : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Progress line */}
            <div className="absolute top-[18px] left-[24px] right-[24px] h-0.5 bg-gray-200 z-0">
              <div
                className="h-full bg-teal-500 transition-all duration-500"
                style={{
                  width: `${Math.min((currentStepIndex / (statusSteps.length - 1)) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store Pickup Info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Store className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-gray-900">Pickup From</h3>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{order.storeName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{order.storeAddress}</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-teal-200 text-teal-600 hover:bg-teal-50 shrink-0"
              onClick={() => {}}
            >
              <Phone className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-teal-200 text-teal-600 hover:bg-teal-50"
              onClick={() => {}}
            >
              <Navigation className="h-3 w-3 mr-1" />
              Navigate to Store
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customer Info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-gray-900">Deliver To</h3>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{order.customerName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{order.deliveryAddress}</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-teal-200 text-teal-600 hover:bg-teal-50 shrink-0"
              onClick={() => {}}
            >
              <Phone className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-teal-200 text-teal-600 hover:bg-teal-50"
              onClick={() => {}}
            >
              <Navigation className="h-3 w-3 mr-1" />
              Get Directions
            </Button>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {order.estimatedDelivery}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-gray-900">Order Items</h3>
            <Badge variant="secondary" className="text-[10px] h-5 ml-auto">
              {order.items.length} items
            </Badge>
          </div>
          <div className="space-y-2">
            {order.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-teal-50 flex items-center justify-center text-[10px] font-bold text-teal-600">
                    {item.qty}×
                  </span>
                  <span className="text-sm text-gray-700">{item.name}</span>
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <PaymentIcon className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">{order.paymentMethod}</span>
            </div>
            <div className="flex items-center gap-1">
              <IndianRupee className="h-4 w-4 text-gray-600" />
              <span className="text-base font-bold text-gray-900">₹{order.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery OTP Section */}
      {order.status !== "DELIVERED" && (
        <Card className="border-0 shadow-sm border-2 border-teal-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-bold text-gray-900">Delivery OTP</h3>
            </div>

            {/* OTP Display for partner */}
            <div className="bg-teal-50 rounded-xl p-3 mb-3">
              <p className="text-xs text-teal-600 mb-1 font-medium">Share this OTP with the customer</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold tracking-[8px] text-teal-700">
                    {order.deliveryOtp}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-teal-600 h-8"
                  onClick={handleCopyOtp}
                >
                  {copied ? (
                    <Check className="h-4 w-4 mr-1" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            {/* OTP Verification Input */}
            {!otpVerified ? (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  Enter OTP from customer to confirm delivery
                </p>
                <div className="flex items-center gap-2">
                  <InputOTP
                    value={otpInput}
                    onChange={(val) => {
                      setOtpInput(val)
                      if (otpError) setOtpError("")
                    }}
                    maxLength={4}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="h-10 w-10 text-sm rounded-md border-2 data-[active=true]:border-teal-500" />
                      <InputOTPSlot index={1} className="h-10 w-10 text-sm rounded-md border-2 data-[active=true]:border-teal-500" />
                      <InputOTPSlot index={2} className="h-10 w-10 text-sm rounded-md border-2 data-[active=true]:border-teal-500" />
                      <InputOTPSlot index={3} className="h-10 w-10 text-sm rounded-md border-2 data-[active=true]:border-teal-500" />
                    </InputOTPGroup>
                  </InputOTP>
                  <Button
                    size="sm"
                    className="h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-lg"
                    onClick={handleVerifyOtp}
                    disabled={otpInput.length < 4}
                  >
                    Verify
                  </Button>
                </div>
                {otpError && (
                  <p className="text-xs text-red-500 mt-1.5">{otpError}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">OTP Verified Successfully!</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delivered confirmation */}
      {order.status === "DELIVERED" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-green-700">Order Delivered Successfully</p>
            <p className="text-xs text-gray-500 mt-1">₹{order.totalAmount.toFixed(2)} • {order.paymentMethod}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {order.status === "PICKUP" && (
          <Button className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-base shadow-lg shadow-amber-500/20">
            <Package className="h-5 w-5 mr-2" />
            Mark as Picked Up
          </Button>
        )}
        {order.status === "PICKED_UP" && (
          <Button className="w-full h-12 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/20">
            <Navigation className="h-5 w-5 mr-2" />
            Start Navigation
          </Button>
        )}
        {order.status === "ON_THE_WAY" && !otpVerified && (
          <Button
            className="w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base shadow-lg shadow-teal-600/20"
            disabled
          >
            <Shield className="h-5 w-5 mr-2" />
            Verify OTP to Complete
          </Button>
        )}
        {order.status === "ON_THE_WAY" && otpVerified && (
          <Button className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-base shadow-lg shadow-green-600/20">
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Mark as Delivered
          </Button>
        )}

        {/* Report Issue */}
        {order.status !== "DELIVERED" && (
          <Button
            variant="outline"
            className="w-full h-10 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm"
            onClick={() => setShowReportDialog(!showReportDialog)}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Report Issue
          </Button>
        )}

        {showReportDialog && (
          <Card className="border border-red-200 bg-red-50/50">
            <CardContent className="p-3 space-y-2">
              <p className="text-xs font-medium text-red-700">Select an issue:</p>
              {[
                "Customer not available",
                "Wrong address",
                "Items damaged",
                "Payment issue",
                "Vehicle breakdown",
              ].map((issue) => (
                <button
                  key={issue}
                  className="w-full text-left text-xs text-red-600 hover:bg-red-100 rounded-lg px-3 py-2 transition-colors"
                  onClick={() => setShowReportDialog(false)}
                >
                  {issue}
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="h-4" />
    </div>
  )
}
