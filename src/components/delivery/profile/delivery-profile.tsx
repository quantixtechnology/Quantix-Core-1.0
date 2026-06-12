"use client"

import { useState, useEffect, useMemo } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useDeliveryEarnings } from "@/hooks/use-api"
import { useBusinessContext } from "@/hooks/use-business-context"
import { setBusinessContext } from "@/lib/api-client"
import { showSuccess, showInfo } from "@/lib/toast-utils"
import { SkeletonCard } from "@/components/ui/loading-states"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  User,
  Phone,
  Mail,
  Bike,
  Star,
  MapPin,
  Wallet,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  CreditCard,
  Clock,
  IndianRupee,
  Package,
  Award,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  ArrowLeftRight,
  Loader2,
} from "lucide-react"

export function DeliveryProfile() {
  const { setDeliveryLoggedIn, setDeliveryPage, setDeliveryPartnerName, setViewMode } = useAdminStore()
  const { user, logout: authLogout } = useAuthStore()
  const [notifOrders, setNotifOrders] = useState(true)
  const [notifPayments, setNotifPayments] = useState(true)
  const [notifPromos, setNotifPromos] = useState(false)
  const [showBankDetails, setShowBankDetails] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const { businessId } = useBusinessContext()

  // SECURITY: business context from the authenticated session (was hardcoded "biz_1")
  useEffect(() => {
    if (businessId) setBusinessContext(businessId)
  }, [businessId])

  // Fetch earnings to get partner data
  const { data: earningsData, isLoading: isLoadingEarnings } = useDeliveryEarnings()

  // Parse partner data from earnings API
  const partner = useMemo(() => {
    if (!earningsData?.data) return null
    const data = earningsData.data as Record<string, unknown>
    return data.partner as Record<string, unknown> | null
  }, [earningsData])

  // Build profile data from auth store and partner API data
  const profile = useMemo(() => {
    return {
      name: user?.name || (partner?.name as string) || "Delivery Partner",
      phone: user?.phone || "",
      email: user?.email || "",
      rating: partner?.rating ? Number(partner.rating) : 4.7,
      totalDeliveries: partner?.totalDeliveries ? Number(partner.totalDeliveries) : 0,
      totalEarnings: partner?.totalEarnings ? Number(partner.totalEarnings) : 0,
      isOnline: partner?.isOnline as boolean || false,
      vehicleType: "Motorcycle",
      vehicleNumber: "MH-02-AB-1234",
      bankAccount: "XXXX XXXX XXXX 4523",
      bankName: "HDFC Bank",
      upiId: "delivery@upi",
    }
  }, [user, partner])

  const handleLogout = () => {
    // Use auth store logout (clears tokens, calls server logout)
    authLogout()
    // Also update admin store
    setDeliveryLoggedIn(false)
    setDeliveryPartnerName("")
    setDeliveryPage("login")
    showSuccess("Logged Out", "You have been logged out successfully")
  }

  if (isLoadingEarnings) {
    return (
      <div className="px-4 py-4 space-y-4">
        <SkeletonCard count={1} />
        <SkeletonCard count={2} />
      </div>
    )
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Profile Card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 px-5 pt-5 pb-8 relative">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-white/5 -mr-8 -mt-8" />
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold text-white border-3 border-white/30 shadow-lg">
              {profile.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{profile.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-white/20 text-white border-0 text-xs px-2 h-5">
                  <Star className="h-3 w-3 mr-0.5 text-yellow-300" />
                  {profile.rating}
                </Badge>
                <span className="text-xs text-teal-100">{profile.totalDeliveries} deliveries</span>
              </div>
            </div>
          </div>
        </div>
        <CardContent className="p-4 -mt-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">{profile.phone || "Not provided"}</span>
              </div>
              <Badge variant="secondary" className="text-[10px] h-5 bg-green-50 text-green-600 border-0">
                Verified
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">{profile.email || "Not provided"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <Package className="h-5 w-5 text-teal-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{profile.totalDeliveries}</p>
            <p className="text-[10px] text-gray-500 font-medium">Total Deliveries</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <IndianRupee className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">
              ₹{profile.totalEarnings > 0 ? (profile.totalEarnings / 1000).toFixed(1) : "0"}k
            </p>
            <p className="text-[10px] text-gray-500 font-medium">Total Earnings</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <Award className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{profile.rating}</p>
            <p className="text-[10px] text-gray-500 font-medium">Rating</p>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Details */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bike className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-gray-900">Vehicle Details</h3>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Vehicle Type</span>
              <span className="text-sm font-medium text-gray-900">{profile.vehicleType}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Vehicle Number</span>
              <span className="text-sm font-medium text-gray-900 font-mono">{profile.vehicleNumber}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Account Info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-bold text-gray-900">Payment Details</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-gray-400"
              onClick={() => setShowBankDetails(!showBankDetails)}
            >
              {showBankDetails ? (
                <EyeOff className="h-3 w-3 mr-1" />
              ) : (
                <Eye className="h-3 w-3 mr-1" />
              )}
              {showBankDetails ? "Hide" : "Show"}
            </Button>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Bank Account</span>
              <span className="text-sm font-medium text-gray-900 font-mono">
                {showBankDetails ? "1234 5678 9012 4523" : profile.bankAccount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Bank</span>
              <span className="text-sm font-medium text-gray-900">{profile.bankName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">UPI ID</span>
              <span className="text-sm font-medium text-gray-900">{profile.upiId}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-gray-900">Notification Preferences</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">New Orders</p>
                <p className="text-xs text-gray-400">Get notified for new delivery assignments</p>
              </div>
              <Switch
                checked={notifOrders}
                onCheckedChange={(checked) => {
                  setNotifOrders(checked)
                  showInfo("Notification Preference", `New orders notifications ${checked ? "enabled" : "disabled"}`)
                }}
                className="data-[state=checked]:bg-teal-600"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">Payment Updates</p>
                <p className="text-xs text-gray-400">Earnings and settlement notifications</p>
              </div>
              <Switch
                checked={notifPayments}
                onCheckedChange={(checked) => {
                  setNotifPayments(checked)
                  showInfo("Notification Preference", `Payment notifications ${checked ? "enabled" : "disabled"}`)
                }}
                className="data-[state=checked]:bg-teal-600"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">Promotions</p>
                <p className="text-xs text-gray-400">Bonus offers and incentives</p>
              </div>
              <Switch
                checked={notifPromos}
                onCheckedChange={(checked) => {
                  setNotifPromos(checked)
                  showInfo("Notification Preference", `Promo notifications ${checked ? "enabled" : "disabled"}`)
                }}
                className="data-[state=checked]:bg-teal-600"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Online Schedule */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-gray-900">Today&apos;s Schedule</h3>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Shift Time</span>
              <span className="text-sm font-medium text-gray-900">8:00 AM - 4:00 PM</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Hours Online</span>
              <span className="text-sm font-medium text-gray-900">5h 32m</span>
            </div>
            <div className="bg-teal-50 rounded-lg p-2.5">
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-teal-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: "69%" }} />
                </div>
                <span className="text-xs font-medium text-teal-700">69%</span>
              </div>
              <p className="text-[10px] text-teal-600 mt-1">5h 32m of 8h shift completed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {[
            { icon: HelpCircle, label: "Help & Support", color: "text-blue-500", bgColor: "bg-blue-50" },
            { icon: Shield, label: "Safety & Insurance", color: "text-teal-500", bgColor: "bg-teal-50" },
            { icon: Info, label: "About Quantix Delivery", color: "text-gray-500", bgColor: "bg-gray-100" },
            { icon: ArrowLeftRight, label: "Switch View Mode (Demo)", color: "text-purple-500", bgColor: "bg-purple-50" },
          ].map((item) => (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              onClick={() => {
                if (item.label.includes("Demo")) {
                  setViewMode("super_admin")
                }
              }}
            >
              <div className={`h-8 w-8 rounded-lg ${item.bgColor} flex items-center justify-center`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <span className="text-sm font-medium text-gray-700 flex-1 text-left">{item.label}</span>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Logout */}
      {!showLogoutConfirm ? (
        <Button
          variant="outline"
          className="w-full h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-semibold text-sm"
          onClick={() => setShowLogoutConfirm(true)}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      ) : (
        <Card className="border border-red-200 bg-red-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-red-700 mb-3">
              Are you sure you want to logout?
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-10 rounded-lg"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* App version */}
      <p className="text-center text-[10px] text-gray-300 pb-4">
        Quantix Delivery v2.4.1 • Build 1247
      </p>

      <div className="h-4" />
    </div>
  )
}
