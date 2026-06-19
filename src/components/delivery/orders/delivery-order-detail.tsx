"use client"

import { useState, useEffect, useMemo } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useDeliveryOrders, useUpdateDeliveryStatus, useVerifyDeliveryOtp } from "@/hooks/use-api"
import { useDeliveryUpdates } from "@/hooks/use-realtime"
import { useBusinessContext } from "@/hooks/use-business-context"
import { setBusinessContext } from "@/lib/api-client"
import { callPhone, openWhatsApp, navigateToLocation } from "@/lib/delivery-actions"
import { showSuccess, showError, showApiError } from "@/lib/toast-utils"
import { SectionLoader, ErrorState } from "@/components/ui/loading-states"
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
  Loader2,
  MessageCircle,
} from "lucide-react"

const statusSteps = [
  { key: "ASSIGNED", label: "Pickup", icon: Package },
  { key: "PICKUP", label: "Pickup", icon: Package },
  { key: "PICKED_UP", label: "Picked Up", icon: Truck },
  { key: "ON_THE_WAY", label: "On the Way", icon: Navigation },
  { key: "DELIVERED", label: "Delivered", icon: CheckCircle2 },
]

const paymentIcons: Record<string, React.ElementType> = {
  UPI: Smartphone,
  CARD: CreditCard,
  CASH: Banknote,
  COD: Banknote,
  CASH_ON_DELIVERY: Banknote,
  RAZORPAY: CreditCard,
}

export function DeliveryOrderDetail() {
  const { selectedOrderId, setDeliveryPage } = useAdminStore()
  const { businessId } = useBusinessContext()
  const [otpInput, setOtpInput] = useState("")
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpError, setOtpError] = useState("")
  const [copied, setCopied] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)

  // SECURITY: business context comes from the authenticated session
  // (was a hardcoded "biz_1" placeholder before)
  useEffect(() => {
    if (businessId) setBusinessContext(businessId)
  }, [businessId])

  // Fetch active and completed orders to find the selected one
  const { data: activeData, isLoading: isLoadingActive } = useDeliveryOrders("active")
  const { data: completedData, isLoading: isLoadingCompleted } = useDeliveryOrders("completed")

  // Real-time delivery updates for this order
  const { latestUpdate } = useDeliveryUpdates(selectedOrderId || undefined)

  // Update status mutation
  const updateStatusMutation = useUpdateDeliveryStatus({
    onSuccess: (data) => {
      const responseData = data.data as Record<string, unknown> | undefined
      const newStatus = responseData?.status || ""
      showSuccess("Status Updated", `Delivery status updated to ${newStatus}`)
    },
    onError: (err) => {
      showApiError(err)
    },
  })

  // Verify OTP mutation
  const verifyOtpMutation = useVerifyDeliveryOtp({
    onSuccess: (data) => {
      const responseData = data.data as Record<string, unknown> | undefined
      setOtpVerified(true)
      setOtpError("")
      const deliveryStatus = responseData?.deliveryStatus as string || ""
      showSuccess("OTP Verified", `Delivery status updated to ${deliveryStatus}`)
    },
    onError: (err) => {
      setOtpError(err.message || "Invalid OTP. Please try again.")
      showError("OTP Verification Failed", err.message || "Invalid OTP")
    },
  })

  // Find the order from API data
  const order = useMemo(() => {
    const allRaw = [
      ...(Array.isArray(activeData?.data) ? activeData.data as Array<Record<string, unknown>> : []),
      ...(Array.isArray(completedData?.data) ? completedData.data as Array<Record<string, unknown>> : []),
    ]

    const raw = allRaw.find((o) => {
      const orderData = (o.order || {}) as Record<string, unknown>
      return orderData.id === selectedOrderId || o.deliveryId === selectedOrderId
    })

    if (!raw) return null

    const orderData = (raw.order || {}) as Record<string, unknown>
    const storeData = (orderData.store || {}) as Record<string, unknown>

    return {
      id: (orderData.id || "") as string,
      deliveryId: (raw.deliveryId || "") as string,
      orderNumber: (orderData.orderNumber || "") as string,
      status: (raw.deliveryStatus || orderData.status || "") as string,
      customerName: (orderData.customerName || "Customer") as string,
      customerPhone: (orderData.customerPhone || "") as string,
      deliveryAddress: (raw.dropAddress || orderData.deliveryAddress || "") as string,
      deliveryInstructions: (orderData.deliveryInstructions || "") as string,
      pickupAddress: (raw.pickupAddress || storeData.address || "") as string,
      // Coordinates from the Delivery record (drop/pickup) with store GPS fallback
      dropLat: (raw.dropLat ?? null) as number | null,
      dropLng: (raw.dropLng ?? null) as number | null,
      pickupLat: (raw.pickupLat ?? storeData.latitude ?? null) as number | null,
      pickupLng: (raw.pickupLng ?? storeData.longitude ?? null) as number | null,
      storeName: (storeData.name || "Store") as string,
      storeAddress: (storeData.address || raw.pickupAddress || "") as string,
      storePhone: (storeData.phone || "") as string,
      totalAmount: Number(orderData.totalAmount || 0),
      paymentMethod: (orderData.paymentMethod || "COD") as string,
      paymentStatus: (orderData.paymentStatus || "") as string,
      deliveryOtp: (orderData.deliveryOtp || "") as string,
      pickupOtp: (orderData.pickupOtp || "") as string,
      estimatedDeliveryTime: raw.estimatedDeliveryTime
        ? new Date(raw.estimatedDeliveryTime as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "30 min",
      distance: (raw.distance || "") as string,
      items: [] as Array<{ name: string; qty: number }>,
    }
  }, [activeData, completedData, selectedOrderId])

  // Apply real-time status updates
  const currentStatus = useMemo(() => {
    if (latestUpdate?.newStatus) {
      return latestUpdate.newStatus as string
    }
    return order?.status || ""
  }, [order, latestUpdate])

  const isLoading = isLoadingActive || isLoadingCompleted

  if (isLoading) {
    return <SectionLoader message="Loading order details..." />
  }

  if (!order) {
    return (
      <ErrorState
        title="Order not found"
        description="The selected order could not be found. It may have been removed or unassigned."
        onRetry={() => setDeliveryPage("dashboard")}
      />
    )
  }

  const normalizedStatus = currentStatus === "PICKUP" ? "ASSIGNED" : currentStatus
  const currentStepIndex = statusSteps.findIndex((s) => s.key === normalizedStatus)
  const effectiveStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex

  const handleVerifyOtp = () => {
    if (otpInput.length < 4) {
      setOtpError("Please enter the 4-digit OTP")
      return
    }
    verifyOtpMutation.mutate({ orderId: order.id, otp: otpInput })
  }

  const handleCopyOtp = () => {
    navigator.clipboard?.writeText(order.deliveryOtp)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStatusUpdate = (newStatus: string) => {
    updateStatusMutation.mutate({ deliveryId: order.deliveryId, status: newStatus })
  }

  const handleReportIssue = (issue: string) => {
    setShowReportDialog(false)
    updateStatusMutation.mutate({
      deliveryId: order.deliveryId,
      status: "CANCELLED",
      note: `Issue reported: ${issue}`,
    })
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
                normalizedStatus === "DELIVERED"
                  ? "text-green-700 bg-green-50 border-green-200"
                  : normalizedStatus === "ON_THE_WAY"
                  ? "text-teal-700 bg-teal-50 border-teal-200"
                  : normalizedStatus === "PICKED_UP"
                  ? "text-blue-700 bg-blue-50 border-blue-200"
                  : "text-amber-700 bg-amber-50 border-amber-200"
              } border-0 font-semibold`}
            >
              {statusSteps[effectiveStepIndex]?.label || normalizedStatus}
            </Badge>
          </div>

          {/* Progress Steps */}
          <div className="relative">
            <div className="flex items-center justify-between relative z-10">
              {statusSteps.filter((s, i) => i === 0 || s.key !== "ASSIGNED").map((step, index) => {
                const filteredSteps = statusSteps.filter((s, i) => i === 0 || s.key !== "ASSIGNED")
                const isCompleted = index <= effectiveStepIndex || (index === 0 && effectiveStepIndex >= 0)
                const isCurrent = step.key === normalizedStatus || (step.key === "ASSIGNED" && normalizedStatus === "ASSIGNED")

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
                  width: `${Math.min((effectiveStepIndex / (statusSteps.length - 1)) * 100, 100)}%`,
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
              disabled={!order.storePhone}
              onClick={() => {
                if (!callPhone(order.storePhone)) {
                  showError("No Phone Number", "Store phone number is not available")
                }
              }}
            >
              <Phone className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-teal-200 text-teal-600 hover:bg-teal-50"
              onClick={() => {
                if (!navigateToLocation(order.pickupLat, order.pickupLng, order.storeAddress)) {
                  showError("No Location", "Store location is not available")
                }
              }}
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
              {order.deliveryInstructions && (
                <p className="text-xs text-amber-600 mt-1 italic">📝 {order.deliveryInstructions}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-teal-200 text-teal-600 hover:bg-teal-50 shrink-0"
              disabled={!order.customerPhone}
              onClick={() => {
                if (!callPhone(order.customerPhone)) {
                  showError("No Phone Number", "Customer phone number is not available")
                }
              }}
            >
              <Phone className="h-4 w-4" />
            </Button>
          </div>
          {/* Quick actions: Navigate / Call / WhatsApp — thumb-sized for one-hand use */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Button
              size="sm"
              className="h-10 text-xs rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              onClick={() => {
                if (!navigateToLocation(order.dropLat, order.dropLng, order.deliveryAddress)) {
                  showError("No Location", "Delivery address is not available")
                }
              }}
            >
              <Navigation className="h-4 w-4 mr-1" />
              Navigate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 text-xs rounded-xl border-teal-200 text-teal-700 hover:bg-teal-50 font-semibold"
              disabled={!order.customerPhone}
              onClick={() => callPhone(order.customerPhone)}
            >
              <Phone className="h-4 w-4 mr-1" />
              Call
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 text-xs rounded-xl border-green-200 text-green-700 hover:bg-green-50 font-semibold"
              disabled={!order.customerPhone}
              onClick={() => {
                openWhatsApp(
                  order.customerPhone,
                  `Hi ${order.customerName}, I'm your delivery partner from ${order.storeName}. I'm on my way with your order ${order.orderNumber}.`,
                )
              }}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              WhatsApp
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ETA {order.estimatedDeliveryTime}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Order Items / Payment */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-gray-900">Order Summary</h3>
            {order.distance && (
              <Badge variant="secondary" className="text-[10px] h-5 ml-auto">
                {order.distance}
              </Badge>
            )}
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <PaymentIcon className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">{order.paymentMethod}</span>
              {order.paymentStatus && (
                <Badge variant="outline" className={`text-[10px] h-5 px-1 border-0 ${
                  order.paymentStatus === "COMPLETED" || order.paymentStatus === "PAID"
                    ? "bg-green-50 text-green-600"
                    : "bg-amber-50 text-amber-600"
                }`}>
                  {order.paymentStatus}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <IndianRupee className="h-4 w-4 text-gray-600" />
              <span className="text-base font-bold text-gray-900">₹{order.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery OTP Section */}
      {normalizedStatus !== "DELIVERED" && normalizedStatus !== "CANCELLED" && (
        <Card className="border-0 shadow-sm border-2 border-teal-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-bold text-gray-900">Delivery OTP</h3>
            </div>

            {/* OTP Display for partner */}
            {order.deliveryOtp && (
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
            )}

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
                    disabled={otpInput.length < 4 || verifyOtpMutation.isPending}
                  >
                    {verifyOtpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
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
      {normalizedStatus === "DELIVERED" && (
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
        {(normalizedStatus === "ASSIGNED" || normalizedStatus === "PICKUP") && (
          <Button
            className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-base shadow-lg shadow-amber-500/20"
            disabled={updateStatusMutation.isPending}
            onClick={() => handleStatusUpdate("PICKED_UP")}
          >
            {updateStatusMutation.isPending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Package className="h-5 w-5 mr-2" />}
            Mark as Picked Up
          </Button>
        )}
        {normalizedStatus === "PICKED_UP" && (
          <Button
            className="w-full h-12 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/20"
            disabled={updateStatusMutation.isPending}
            onClick={() => {
              handleStatusUpdate("ON_THE_WAY")
              // Launch turn-by-turn directions alongside the status change
              navigateToLocation(order.dropLat, order.dropLng, order.deliveryAddress)
            }}
          >
            {updateStatusMutation.isPending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Navigation className="h-5 w-5 mr-2" />}
            Start Navigation
          </Button>
        )}
        {(normalizedStatus === "ON_THE_WAY" || normalizedStatus === "ARRIVED") && !otpVerified && (
          <Button
            className="w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base shadow-lg shadow-teal-600/20"
            disabled
          >
            <Shield className="h-5 w-5 mr-2" />
            Verify OTP to Complete
          </Button>
        )}
        {(normalizedStatus === "ON_THE_WAY" || normalizedStatus === "ARRIVED") && otpVerified && (
          <Button
            className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-base shadow-lg shadow-green-600/20"
            disabled={updateStatusMutation.isPending}
            onClick={() => handleStatusUpdate("DELIVERED")}
          >
            {updateStatusMutation.isPending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
            Mark as Delivered
          </Button>
        )}

        {/* Report Issue */}
        {normalizedStatus !== "DELIVERED" && normalizedStatus !== "CANCELLED" && (
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
                  onClick={() => handleReportIssue(issue)}
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
