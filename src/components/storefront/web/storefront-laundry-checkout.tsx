"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store"
import type { WebNav } from "./storefront-website"
import type { PickedStore } from "./storefront-store-picker"
import {
  ArrowLeft, Loader2, CheckCircle2, MapPin, Plus, Trash2, Navigation,
  Mail, Lock, User, Phone, KeyRound, Eye, EyeOff, CreditCard, Home, Building, Tag,
} from "lucide-react"
import { formatINR } from "@/lib/currency"

interface Addr {
  id: string
  label?: string | null
  addressType?: string
  addressLine1: string
  addressLine2?: string | null
  area?: string | null
  landmark?: string | null
  city: string
  state: string
  pincode: string
  country?: string
  isDefault: boolean
  isPickupDefault?: boolean
  isDeliveryDefault?: boolean
  latitude?: number | null
  longitude?: number | null
  instructions?: string | null
}

interface CustomerInfo {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  customerCode: string | null
}

interface LaundryCheckoutProps {
  brandColor: string
  nav: WebNav
  currentStore?: PickedStore | null
  storeClosed?: boolean
  storeClosedMessage?: string
}

type Step = "email" | "auth" | "profile" | "address" | "review" | "success"
type AuthView = "login" | "register" | "otp" | "forgot"

const PICKUP_SLOTS = ["07:00 - 09:00", "09:00 - 12:00", "12:00 - 15:00", "15:00 - 18:00", "18:00 - 21:00"]
const ADDR_LABELS = ["Home", "Office", "Other"]

function normalizeEmail(e: string) { return e.trim().toLowerCase() }
function normalizePhone(p: string) {
  const d = p.replace(/\D/g, "")
  if (d.length === 10) return `+91${d}`
  if (d.startsWith("91") && d.length === 12) return `+${d}`
  return p.startsWith("+") ? p : `+${d}`
}

export function StorefrontLaundryCheckout({ brandColor, nav, currentStore, storeClosed = false, storeClosedMessage }: LaundryCheckoutProps) {
  const { currentBusinessId } = useAdminStore()
  const { items, subtotal, clearCart } = useCartStore()
  const { isAuthenticated, user, token, setSession } = useAuthStore()

  const rawSubtotal = subtotal()
  const itemCount = items.filter((i) => i.kind === "laundry" || !i.kind).length
  const deliveryFee = currentStore?.deliveryFee ?? 0
  const hasCartItems = itemCount > 0

  const [step, setStep] = useState<Step>(isAuthenticated ? "address" : "email")
  const [authView, setAuthView] = useState<AuthView>("login")

  const [email, setEmail] = useState("")
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [regName, setRegName] = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState("")

  const otpDetails = useRef<{ email: string; name: string; phone: string; password: string } | null>(null)

  const [customerResolved, setCustomerResolved] = useState<CustomerInfo | null>(null)
  const [customerLoading, setCustomerLoading] = useState(false)

  const [profileName, setProfileName] = useState("")
  const [profilePhone, setProfilePhone] = useState("")
  const [profileLoading, setProfileLoading] = useState(false)

  const [addresses, setAddresses] = useState<Addr[]>([])
  const [addressesLoading, setAddressesLoading] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [showAddrForm, setShowAddrForm] = useState(false)
  const [addrError, setAddrError] = useState("")

  const [newAddr, setNewAddr] = useState({
    label: "Home", addressType: "HOME",
    line1: "", line2: "", area: "", landmark: "", city: "", state: "", pincode: "",
    lat: undefined as number | undefined, lng: undefined as number | undefined,
    isPickupDefault: false, isDeliveryDefault: false,
  })
  const [addingGps, setAddingGps] = useState(false)

  const [pickupDate, setPickupDate] = useState("")
  const [pickupSlot, setPickupSlot] = useState("")
  const [pickupSlots, setPickupSlots] = useState<string[]>(PICKUP_SLOTS)
  const [dateUnavailable, setDateUnavailable] = useState("")
  const [pickupInstructions, setPickupInstructions] = useState("")
  const todayIst = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split("T")[0]
  // Slots are fetched from the public endpoint. The endpoint also validates the
  // chosen date (past / weekly off / holiday) and restricts slots to that day's
  // working hours, so we refetch whenever the pickup date changes.
  useEffect(() => {
    if (!currentBusinessId) return
    const q = pickupDate ? `&date=${encodeURIComponent(pickupDate)}` : ""
    fetch(`/api/core/storefront/laundry-slots?businessId=${encodeURIComponent(currentBusinessId)}${q}`).then((r) => r.json())
      .then((j) => {
        if (j.success && j.dateAvailable === false) {
          setDateUnavailable(j.dateReason || "Pickup is not available on this date.")
          setPickupSlot("")
          return
        }
        setDateUnavailable("")
        const slots = (j.data?.pickup?.slots as string[]) || PICKUP_SLOTS
        setPickupSlots(slots)
        if (!slots.includes(pickupSlot)) setPickupSlot("")
      })
      .catch(() => { /* keep fallback */ })
  }, [currentBusinessId, pickupDate])
  const [paymentMethod, setPaymentMethod] = useState("COD")
  const [payMethods, setPayMethods] = useState<{ cod: boolean; online: { gateway: string; keyId: string; environment: string } | null }>({ cod: true, online: null })
  // Which payment options this business offers (COD switch + active online gateway).
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/core/storefront/laundry-payment-methods?businessId=${encodeURIComponent(currentBusinessId)}`).then((r) => r.json())
      .then((j) => { if (j.success) { setPayMethods(j.data); setPaymentMethod(j.data.online ? "ONLINE" : "COD") } })
      .catch(() => { /* keep COD default */ })
  }, [currentBusinessId])
  const [placing, setPlacing] = useState(false)
  const [orderError, setOrderError] = useState("")
  const [orderResult, setOrderResult] = useState<{ orderNumber: string; orderId: string } | null>(null)

  const [couponCode, setCouponCode] = useState("")
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string; code: string; pending: boolean } | null>(null)
  const [couponBusy, setCouponBusy] = useState(false)

  const selectedAddr = addresses.find((a) => a.id === selectedAddressId)

  const canConfirm = isAuthenticated && !!customerResolved && !!selectedAddressId && !!pickupDate && !!pickupSlot && !dateUnavailable && hasCartItems && !storeClosed

  useEffect(() => {
    if (isAuthenticated && token && !customerResolved && (step === "email" || step === "address")) {
      resolveCustomer()
    }
  }, [isAuthenticated, token, step, customerResolved])

  const resolveCustomer = async () => {
    if (!currentBusinessId || !token) return
    setCustomerLoading(true)
    try {
      const res = await fetch("/api/core/storefront/laundry-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId: currentBusinessId }),
      })
      const data = await res.json()
      if (data.success) {
        const c = data.data as CustomerInfo
        setCustomerResolved(c)
        if (c.name && c.phone) {
          setStep("address")
          fetchAddresses()
        } else {
          setProfileName(c.name || "")
          setProfilePhone(c.phone || "")
          setStep("profile")
        }
      } else {
        setAuthError(data.error || "Could not resolve customer")
      }
    } catch {
      setAuthError("Network error resolving customer")
    } finally {
      setCustomerLoading(false)
    }
  }

  const fetchAddresses = useCallback(async () => {
    if (!token) return
    setAddressesLoading(true)
    try {
      const res = await fetch("/api/laundry/app/addresses", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setAddresses(data.data)
        const def = data.data.find((a: Addr) => a.isPickupDefault || a.isDefault)
        if (def) setSelectedAddressId(def.id)
        else if (data.data.length > 0) setSelectedAddressId(data.data[0].id)
      }
    } catch {
    } finally {
      setAddressesLoading(false)
    }
  }, [token])

  const handleCheckEmail = async () => {
    const e = normalizeEmail(email)
    if (!e) { setAuthError("Please enter your email"); return }
    setAuthEmail(e)
    setAuthLoading(true)
    setAuthError("")
    try {
      const res = await fetch("/api/core/storefront/auth/check-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e }),
      })
      const data = await res.json()
      if (data.success && data.exists) {
        setAuthView("login")
      } else {
        setAuthView("register")
      }
      setStep("auth")
    } catch {
      setAuthError("Network error. Please try again.")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!authPassword) { setAuthError("Enter your password"); return }
    setAuthLoading(true)
    setAuthError("")
    try {
      const res = await fetch("/api/core/storefront/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      })
      const data = await res.json()
      if (data.success) {
        setSession({ token: data.data.accessToken, refreshToken: data.data.refreshToken, user: data.data.user, businesses: data.data.businesses })
      } else {
        setAuthError(data.error || "Invalid email or password")
      }
    } catch {
      setAuthError("Network error")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!regName || !regPhone) { setAuthError("Name and mobile number are required"); return }
    const pw = regPassword
    if (pw.length < 8) { setAuthError("Password must be at least 8 characters"); return }
    setAuthLoading(true)
    setAuthError("")
    try {
      const phone = normalizePhone(regPhone)
      const registerRes = await fetch("/api/core/storefront/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, name: regName, phone }),
      })
      const registerData = await registerRes.json()
      if (registerData.success) {
        otpDetails.current = { email: authEmail, name: regName, phone, password: pw }
        setAuthView("otp")
      } else {
        setAuthError(registerData.error || "Registration failed")
      }
    } catch {
      setAuthError("Network error")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 4) { setAuthError("Enter the verification code"); return }
    const details = otpDetails.current
    if (!details) { setAuthError("Session expired, please restart"); return }
    setAuthLoading(true)
    setAuthError("")
    try {
      const verifyRes = await fetch("/api/core/storefront/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: details.email, code: otp, name: details.name, phone: details.phone }),
      })
      const verifyData = await verifyRes.json()
      if (verifyData.success) {
        const setPwRes = await fetch("/api/core/storefront/auth/set-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: details.email, password: details.password, token: verifyData.data?.token || verifyData.data?.accessToken }),
        })
        const setPwData = await setPwRes.json()
        if (setPwData.success || setPwData.data?.accessToken) {
          setSession({ token: setPwData.data.accessToken || verifyData.data.accessToken, refreshToken: setPwData.data?.refreshToken, user: setPwData.data.user || verifyData.data.user, businesses: setPwData.data?.businesses })
        } else {
          setAuthError(setPwData.error || "Failed to set password")
        }
      } else {
        setAuthError(verifyData.error || "Invalid verification code")
      }
    } catch {
      setAuthError("Network error")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleForgot = async () => {
    setAuthLoading(true)
    setAuthError("")
    try {
      const res = await fetch("/api/core/storefront/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail }),
      })
      const data = await res.json()
      if (data.success) {
        setAuthView("login")
        setAuthError("Check your email for reset instructions")
      } else {
        setAuthError(data.error || "Failed to send reset email")
      }
    } catch {
      setAuthError("Network error")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    const pn = profileName.trim()
    const pp = profilePhone.replace(/\D/g, "")
    if (!pn || !pp) { setAuthError("Name and mobile number are required"); return }
    if (!token || !customerResolved) return
    setProfileLoading(true)
    setAuthError("")
    try {
      const phone = normalizePhone(pp)
      const res = await fetch("/api/core/storefront/laundry-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId: currentBusinessId, name: pn, phone }),
      })
      const data = await res.json()
      if (data.success) {
        setCustomerResolved({ ...customerResolved, name: pn, phone })
        setStep("address")
        fetchAddresses()
      } else {
        setAuthError(data.error || "Failed to save profile")
      }
    } catch {
      setAuthError("Network error")
    } finally {
      setProfileLoading(false)
    }
  }

  const handleAddAddress = async () => {
    if (!newAddr.line1 || !newAddr.city || !newAddr.pincode) {
      setAddrError("Street address, city and pincode are required"); return
    }
    if (!token) return
    setAddrError("")
    try {
      const res = await fetch("/api/laundry/app/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          label: newAddr.label, addressType: newAddr.addressType,
          addressLine1: newAddr.line1, addressLine2: newAddr.line2 || undefined,
          area: newAddr.area || undefined, landmark: newAddr.landmark || undefined,
          city: newAddr.city, state: newAddr.state, pincode: newAddr.pincode,
          latitude: newAddr.lat, longitude: newAddr.lng,
          isPickupDefault: newAddr.isPickupDefault,
          isDeliveryDefault: newAddr.isDeliveryDefault,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setNewAddr({ label: "Home", addressType: "HOME", line1: "", line2: "", area: "", landmark: "", city: "", state: "", pincode: "", lat: undefined, lng: undefined, isPickupDefault: false, isDeliveryDefault: false })
        setShowAddrForm(false)
        setAddrError("")
        await fetchAddresses()
        if (data.data?.id) setSelectedAddressId(data.data.id)
      } else {
        setAddrError(data.error || "Failed to add address")
      }
    } catch {
      setAddrError("Network error")
    }
  }

  const handleDeleteAddress = async (addrId: string) => {
    if (!token) return
    try {
      await fetch(`/api/laundry/app/addresses/${addrId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
      setAddresses((prev) => prev.filter((a) => a.id !== addrId))
      if (selectedAddressId === addrId) setSelectedAddressId(null)
    } catch {
    }
  }

  const captureGps = () => {
    if (!navigator.geolocation) return
    setAddingGps(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewAddr((p) => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude }))
        setAddingGps(false)
      },
      () => setAddingGps(false),
      { timeout: 10000 },
    )
  }

  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponBusy(true)
    try {
      const res = await fetch("/api/core/marketing/evaluate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, workspaceType: "LAUNDRY", customerId: customerResolved?.id || undefined, code: couponCode.trim(), orderValue: rawSubtotal, applyTo: "ORDER" }),
      })
      const j = await res.json()
      if (!j.success) { setCouponMsg({ ok: false, text: j.error || "Invalid coupon code.", code: "", pending: false }); return }
      setCouponMsg({ ok: true, text: j.data.message, code: couponCode.trim().toUpperCase(), pending: !!j.data.pending })
    } catch { setCouponMsg({ ok: false, text: "Could not apply coupon. Try again.", code: "", pending: false }) } finally { setCouponBusy(false) }
  }
  const removeCoupon = () => { setCouponMsg(null); setCouponCode("") }

  const recordCoupon = (orderId: string | null) => {
    if (!couponMsg?.ok) return
    fetch("/api/core/marketing/apply", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: currentBusinessId, workspaceType: "LAUNDRY", customerId: customerResolved?.id || undefined, code: couponMsg.code, orderValue: rawSubtotal, applyTo: "ORDER", orderId }),
    }).catch(() => {})
  }

  // Load Razorpay checkout.js once, on demand.
  const loadRazorpay = () => new Promise<boolean>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Razorpay) return resolve(true)
    const s = document.createElement("script")
    s.src = "https://checkout.razorpay.com/v1/checkout.js"
    s.onload = () => resolve(true); s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })

  // Online payment for a just-placed laundry order. Resolves true only when the
  // payment is completed AND verified server-side (which books it on the order).
  const payOnline = (orderId: string, orderNumber: string) => new Promise<boolean>((resolve) => {
    ;(async () => {
      try {
        const co = await fetch("/api/core/storefront/laundry-pay/create-order", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ businessId: currentBusinessId, laundryOrderId: orderId }),
        }).then((r) => r.json())
        if (!co.success) { setOrderError(co.error || "Could not start payment"); return resolve(false) }
        if (!(await loadRazorpay())) { setOrderError("Could not load the payment window"); return resolve(false) }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new (window as any).Razorpay({
          key: co.data.keyId, order_id: co.data.razorpayOrderId, amount: Math.round(co.data.amount * 100), currency: "INR",
          name: currentStore?.name || "Laundry", description: `Order ${orderNumber}`,
          prefill: { name: customerResolved?.name || undefined, contact: customerResolved?.phone || undefined, email: customerResolved?.email || undefined },
          theme: { color: brandColor },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          handler: async (resp: any) => {
            const v = await fetch("/api/core/storefront/laundry-pay/verify", {
              method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ businessId: currentBusinessId, laundryOrderId: orderId, razorpay_payment_id: resp.razorpay_payment_id, razorpay_order_id: resp.razorpay_order_id, razorpay_signature: resp.razorpay_signature }),
            }).then((r) => r.json())
            if (v.success) resolve(true); else { setOrderError("Payment could not be verified — please contact the store."); resolve(false) }
          },
          modal: { ondismiss: () => resolve(false) },
        })
        rzp.open()
      } catch { setOrderError("Payment failed"); resolve(false) }
    })()
  })

  const handlePlaceOrder = async () => {
    if (!currentBusinessId || !token || !customerResolved || !selectedAddressId) {
      setOrderError("Missing required information"); return
    }
    if (storeClosed) { setOrderError(storeClosedMessage || "Store is closed"); return }
    const selAddr = addresses.find((a) => a.id === selectedAddressId)
    if (!selAddr) { setOrderError("Please select an address"); return }

    setPlacing(true)
    setOrderError("")
    try {
      const body: Record<string, unknown> = {
        businessId: currentBusinessId,
        customer: { id: customerResolved.id },
        pickup: {
          addressId: selectedAddressId,
          date: pickupDate || undefined,
          timeSlot: pickupSlot || undefined,
          instructions: pickupInstructions || undefined,
        },
        paymentMethod,
      }
      const laundryItems = items.filter((i) => i.kind === "laundry" || !i.kind)
        .map((i) => ({ serviceId: i.serviceId, garmentId: i.garmentId, quantity: i.quantity }))
      if (laundryItems.length > 0) body.items = laundryItems
      else {
        const bagServices = items.filter((i) => i.bagMode && i.serviceId)
          .map((i) => ({ serviceId: i.serviceId, serviceName: i.serviceName }))
        if (bagServices.length > 0) body.services = bagServices
        else { setOrderError("Cart is empty"); setPlacing(false); return }
      }

      const res = await fetch("/api/core/storefront/laundry-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        const orderId = data.data.orderId, orderNumber = data.data.orderNumber
        // Online: attempt payment now. The order is already placed; if the customer
        // cancels, it stays placed but unpaid (they can pay at delivery).
        if (paymentMethod === "ONLINE" && payMethods.online) {
          await payOnline(orderId, orderNumber)
        }
        clearCart()
        recordCoupon(data.data.id || null)
        setOrderResult({ orderNumber, orderId })
        setStep("success")
      } else {
        setOrderError(data.error || "Failed to place order")
      }
    } catch {
      setOrderError("Network error")
    } finally {
      setPlacing(false)
    }
  }

  if (!hasCartItems && step !== "success" && step !== "email") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-5xl">🧺</div>
        <h2 className="text-lg font-bold text-gray-900">Your cart is empty</h2>
        <button onClick={() => nav.go("home")} className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: brandColor }}>
          Browse Services
        </button>
      </div>
    )
  }

  if (step === "success" && orderResult) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h2>
          <p className="text-gray-500 mb-1">Your laundry order has been received.</p>
          <p className="text-sm font-mono font-bold text-gray-700 mb-8">{orderResult.orderNumber}</p>
          <button onClick={() => nav.go("orders")} className="w-full h-12 text-white font-bold text-sm rounded-xl mb-3" style={{ backgroundColor: brandColor }}>
            Track Order
          </button>
          <button onClick={() => nav.go("home")} className="w-full h-12 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl">
            Continue Shopping
          </button>
        </div>
      </div>
    )
  }

  const progressSteps: { key: Step; label: string }[] = [
    { key: "email", label: "Email" },
    { key: "auth", label: "Login" },
    { key: "profile", label: "Profile" },
    { key: "address", label: "Address" },
    { key: "review", label: "Checkout" },
  ]
  const currentProgressIdx = Math.max(0, progressSteps.findIndex((s) => s.key === step))
  const visibleProgress = step !== "success" ? progressSteps.slice(0, Math.max(currentProgressIdx + 1, 3)) : []

  const inputCls = "w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
  const labelCls = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => {
          if (step === "email") nav.goBack("home")
          else if (step === "auth") { setStep("email"); setAuthError("") }
          else if (step === "profile") nav.goBack("home")
          else if (step === "address") { setStep("email"); setAuthError("") }
          else if (step === "review") { setStep("address") }
          else nav.goBack("home")
        }}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">Checkout</h1>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {visibleProgress.map((s, i) => {
          const sIdx = visibleProgress.findIndex((p) => p.key === step)
          const isCurrent = s.key === step
          const isDone = sIdx > i
          const isSkipped = s.key === "profile" && step !== "profile" && step !== "email" && step !== "auth"
          if (isSkipped) return null
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isCurrent ? "text-white" : isDone ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                }`}
                style={isCurrent ? { backgroundColor: brandColor } : {}}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${isCurrent ? "text-gray-900" : "text-gray-400"}`}>
                {s.label}
              </span>
              {i < visibleProgress.length - 1 && <div className="w-6 h-px bg-gray-200 mx-1 shrink-0" />}
            </div>
          )
        })}
      </div>

      {/* ── STEP: Email ── */}
      {step === "email" && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md mx-auto">
          <div className="space-y-4">
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6 text-gray-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Continue with Email</h2>
              <p className="text-sm text-gray-500 mt-1">Enter your email address to get started</p>
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email" placeholder="Email Address" value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCheckEmail()}
                className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" autoFocus
              />
            </div>
            {authError && <p className="text-xs text-red-500">{authError}</p>}
            <button
              onClick={handleCheckEmail}
              disabled={authLoading || !email}
              className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: Auth ── */}
      {step === "auth" && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md mx-auto">
          {authView === "login" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6 text-blue-500" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Welcome back</h2>
                <p className="text-sm text-gray-500 mt-1">{authEmail}</p>
                <button onClick={() => { setStep("email"); setAuthEmail(""); setEmail(""); setAuthError("") }} className="text-xs text-gray-400 hover:text-gray-600 underline mt-1">Not you?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"} placeholder="Password" value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full h-11 pl-10 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" autoFocus
                />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
              <button onClick={() => setAuthView("forgot")} className="text-xs text-gray-500 hover:text-gray-700 underline">Forgot password?</button>
              {authError && <p className="text-xs text-red-500">{authError}</p>}
              <button onClick={handleLogin} disabled={authLoading || !authPassword}
                className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: brandColor }}
              >
                {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Login"}
              </button>
            </div>
          )}

          {authView === "register" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <User className="w-6 h-6 text-green-500" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Create Account</h2>
                <p className="text-sm text-gray-500 mt-1">{authEmail}</p>
                <button onClick={() => { setStep("email"); setAuthEmail(""); setEmail(""); setAuthError("") }} className="text-xs text-gray-400 hover:text-gray-600 underline mt-1">Use different email</button>
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Full Name *" value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="tel" placeholder="Mobile Number *" value={regPhone} onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showPassword ? "text" : "password"} placeholder="Password (min 8 chars) *" value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
              {authError && <p className="text-xs text-red-500">{authError}</p>}
              <button onClick={handleRegister} disabled={authLoading || !regName || !regPhone || !regPassword}
                className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: brandColor }}
              >
                {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
              </button>
              <p className="text-xs text-center text-gray-400">We'll send a verification code to your email</p>
            </div>
          )}

          {authView === "otp" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-6 h-6 text-purple-500" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Verify Email</h2>
                <p className="text-sm text-gray-500 mt-1">Enter the code sent to {authEmail}</p>
              </div>
              <input type="text" placeholder="Verification code" value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                className="w-full h-11 text-center text-lg tracking-widest border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" autoFocus />
              {authError && <p className="text-xs text-red-500">{authError}</p>}
              <button onClick={handleVerifyOtp} disabled={authLoading || otp.length < 4}
                className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: brandColor }}
              >
                {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Continue"}
              </button>
            </div>
          )}

          {authView === "forgot" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold text-gray-900">Reset Password</h2>
                <p className="text-sm text-gray-500 mt-1">We'll send reset instructions to {authEmail}</p>
              </div>
              {authError && <p className="text-xs text-red-500">{authError}</p>}
              <button onClick={handleForgot} disabled={authLoading}
                className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: brandColor }}
              >
                {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
              </button>
              <button onClick={() => setAuthView("login")} className="w-full text-sm text-gray-500 hover:text-gray-700">Back to login</button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP: Auth loading (after login, resolving customer) ── */}
      {step === "auth" && isAuthenticated && customerLoading && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: brandColor }} />
            <p className="text-sm text-gray-500">Setting up your profile...</p>
          </div>
        </div>
      )}

      {/* ── STEP: Profile ── */}
      {step === "profile" && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md mx-auto">
          <div className="space-y-4">
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-3">
                <User className="w-6 h-6 text-orange-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Complete Your Profile</h2>
              <p className="text-sm text-gray-500 mt-1">We need your name and mobile number to continue</p>
            </div>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Full Name *" value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" autoFocus />
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="tel" placeholder="Mobile Number *" value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="w-full h-11 pl-10 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
            </div>
            {authError && <p className="text-xs text-red-500">{authError}</p>}
            <button onClick={handleSaveProfile} disabled={profileLoading || !profileName || !profilePhone}
              className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {profileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Continue"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: Address (pre-checkout: select or add address only) ── */}
      {step === "address" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" style={{ color: brandColor }} />
              Pickup Address
            </h2>

            {addressesLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading addresses...
              </div>
            )}

            {!addressesLoading && addresses.length > 0 && (
              <div className="space-y-3 mb-4">
                {addresses.map((addr) => (
                  <div key={addr.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${selectedAddressId === addr.id ? "" : "border-gray-200 hover:border-gray-300"}`}
                    style={selectedAddressId === addr.id ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : {}}>
                    <div className="flex-1" onClick={() => setSelectedAddressId(addr.id)}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{addr.label || addr.addressType || "Address"}</span>
                        {(addr.isPickupDefault || addr.isDefault) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: brandColor }}>Default</span>}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{addr.addressLine1}</p>
                      {addr.area && <p className="text-xs text-gray-500">{addr.area}</p>}
                      {addr.landmark && <p className="text-xs text-gray-400">Near {addr.landmark}</p>}
                      <p className="text-sm text-gray-600">{addr.city}{addr.state ? `, ${addr.state}` : ""} - {addr.pincode}</p>
                    </div>
                    <button onClick={() => handleDeleteAddress(addr.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!addressesLoading && addresses.length === 0 && (
              <div className="text-center py-6 text-gray-400">
                <MapPin className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No saved addresses. Add one below.</p>
              </div>
            )}

            {showAddrForm ? (
              <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3 mt-4">
                <h3 className="text-sm font-semibold text-gray-700">Add New Address</h3>
                <div className="flex gap-2 flex-wrap">
                  {ADDR_LABELS.map((l) => (
                    <button key={l} type="button" onClick={() => setNewAddr((p) => ({ ...p, label: l, addressType: l.toUpperCase() }))}
                      className="px-3 py-1 rounded-lg text-xs font-medium border transition-colors"
                      style={newAddr.label === l ? { borderColor: brandColor, backgroundColor: `${brandColor}10`, color: brandColor } : { borderColor: "#e5e7eb", color: "#4b5563" }}>
                      {l === "Home" ? <Home className="w-3 h-3 inline mr-1" /> : l === "Office" ? <Building className="w-3 h-3 inline mr-1" /> : null}{l}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={captureGps} disabled={addingGps}
                  className="w-full flex items-center justify-center gap-2 py-2 border border-dashed rounded-xl text-xs font-medium transition-colors"
                  style={{ borderColor: `${brandColor}60`, color: brandColor }}>
                  {addingGps ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Detecting...</> : <><Navigation className="w-3.5 h-3.5" /> Use Current Location</>}
                </button>
                {newAddr.lat && <p className="text-[10px] text-center text-green-600">Location captured</p>}
                <input type="text" placeholder="Area / Locality" value={newAddr.area} onChange={(e) => setNewAddr((p) => ({ ...p, area: e.target.value }))} className={inputCls} />
                <input type="text" placeholder="Flat / Building / Street *" value={newAddr.line1} onChange={(e) => setNewAddr((p) => ({ ...p, line1: e.target.value }))} className={inputCls} />
                <input type="text" placeholder="Landmark (optional)" value={newAddr.landmark} onChange={(e) => setNewAddr((p) => ({ ...p, landmark: e.target.value }))} className={inputCls} />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="City *" value={newAddr.city} onChange={(e) => setNewAddr((p) => ({ ...p, city: e.target.value }))} className={inputCls} />
                  <input type="text" placeholder="State" value={newAddr.state} onChange={(e) => setNewAddr((p) => ({ ...p, state: e.target.value }))} className={inputCls} />
                </div>
                <input type="text" placeholder="Pincode *" value={newAddr.pincode} onChange={(e) => setNewAddr((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} className={inputCls} />
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={newAddr.isPickupDefault} onChange={(e) => setNewAddr((p) => ({ ...p, isPickupDefault: e.target.checked }))} className="rounded" />
                  Default pickup address
                </label>
                {addrError && <p className="text-xs text-red-500">{addrError}</p>}
                <div className="flex gap-2">
                  <button onClick={handleAddAddress} className="flex-1 h-9 text-sm font-semibold text-white rounded-lg" style={{ backgroundColor: brandColor }}>Save Address</button>
                  <button onClick={() => { setShowAddrForm(false); setAddrError("") }} className="flex-1 h-9 text-sm text-gray-600 border border-gray-200 rounded-lg">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddrForm(true)} className="flex items-center gap-2 text-sm font-medium mt-4 transition-colors" style={{ color: brandColor }}>
                <Plus className="w-4 h-4" /> Add new address
              </button>
            )}
          </div>

          <button onClick={() => setStep("review")} disabled={!selectedAddressId}
            className="w-full h-12 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: brandColor }}>
            Continue to Checkout
          </button>
        </div>
      )}

      {/* ── STEP: Review (Checkout — no auth fields) ── */}
      {step === "review" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-4">
            {/* Pickup Address (read-only with change) */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: brandColor }} />
                Pickup Address
              </h3>
              {selectedAddr && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{selectedAddr.label || selectedAddr.addressType || "Address"}</span>
                    {(selectedAddr.isPickupDefault || selectedAddr.isDefault) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: brandColor }}>Default</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{selectedAddr.addressLine1}</p>
                  {selectedAddr.area && <p className="text-xs text-gray-500">{selectedAddr.area}</p>}
                  {selectedAddr.landmark && <p className="text-xs text-gray-400">Near {selectedAddr.landmark}</p>}
                  <p className="text-sm text-gray-600">{selectedAddr.city}{selectedAddr.state ? `, ${selectedAddr.state}` : ""} - {selectedAddr.pincode}</p>
                </div>
              )}
              <button onClick={() => setStep("address")} className="text-xs font-medium mt-2" style={{ color: brandColor }}>Change</button>
            </div>

            {/* Pickup Schedule */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Pickup Schedule</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Pickup Date</label>
                  <input type="date" value={pickupDate} min={todayIst()} onChange={(e) => { setPickupDate(e.target.value); setPickupSlot("") }} className={inputCls} />
                  {dateUnavailable && <p className="mt-1 text-[11px] text-rose-600">{dateUnavailable}</p>}
                </div>
                <div>
                  <label className={labelCls}>Time Slot</label>
                  <select value={pickupSlot} onChange={(e) => setPickupSlot(e.target.value)} className={inputCls} disabled={!!dateUnavailable}>
                    <option value="">Select slot</option>
                    {pickupSlots.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className={labelCls}>Instructions (optional)</label>
                <input type="text" placeholder="e.g. Call before arrival" value={pickupInstructions} onChange={(e) => setPickupInstructions(e.target.value)} className={inputCls} />
              </div>
            </div>

            {/* Coupon */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4" style={{ color: brandColor }} />
                Coupon
              </h3>
              {couponMsg?.ok ? (
                <div className="flex items-start justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-700">{couponMsg.code} applied{couponMsg.pending ? " · Discount Pending" : ""}</p>
                    <p className="text-[11px] text-emerald-600">{couponMsg.text}</p>
                  </div>
                  <button onClick={removeCoupon} className="text-[11px] font-semibold text-gray-500 shrink-0 ml-2">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Enter coupon code" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none uppercase" />
                  <button onClick={applyCoupon} disabled={couponBusy || !couponCode.trim()} className="rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-40" style={{ backgroundColor: brandColor }}>
                    {couponBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                  </button>
                </div>
              )}
              {couponMsg && !couponMsg.ok && <p className="mt-1 text-[11px] text-rose-600">{couponMsg.text}</p>}
            </div>

            {/* Payment Method */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" style={{ color: brandColor }} />
                Payment Method
              </h3>
              <div className="space-y-2">
                {payMethods.online && (
                  <button type="button" onClick={() => setPaymentMethod("ONLINE")} className="w-full flex items-center gap-3 p-3 rounded-xl border text-left" style={paymentMethod === "ONLINE" ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : { borderColor: "#e5e7eb" }}>
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: paymentMethod === "ONLINE" ? brandColor : "#cbd5e1" }}>{paymentMethod === "ONLINE" && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }} />}</div>
                    <div className="flex-1"><span className="text-sm font-semibold text-gray-900">Pay Online</span><p className="text-[11px] text-gray-400">UPI · Cards · Wallets{payMethods.online.environment === "SANDBOX" ? " · Test mode" : ""}</p></div>
                  </button>
                )}
                {payMethods.cod && (
                  <button type="button" onClick={() => setPaymentMethod("COD")} className="w-full flex items-center gap-3 p-3 rounded-xl border text-left" style={paymentMethod === "COD" ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : { borderColor: "#e5e7eb" }}>
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: paymentMethod === "COD" ? brandColor : "#cbd5e1" }}>{paymentMethod === "COD" && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }} />}</div>
                    <span className="text-sm font-semibold text-gray-900">Cash on Delivery</span>
                  </button>
                )}
                {!payMethods.online && !payMethods.cod && <p className="text-xs text-amber-600">No payment method is available right now. Please contact the store.</p>}
              </div>
            </div>
          </div>

          {/* Order Summary sidebar */}
          <div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 sticky top-24">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Order Summary</h3>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {items.filter((i) => i.kind === "laundry" || !i.kind).map((item, idx) => (
                  <div key={`${item.productId}-${item.variantId}-${idx}`} className="flex justify-between text-sm">
                    <span className="text-gray-700 truncate mr-2">{item.name} × {item.quantity}</span>
                    <span className="font-semibold text-gray-900 shrink-0">{formatINR(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-3 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatINR(rawSubtotal)}</span></div>
                {deliveryFee > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Delivery</span><span>{formatINR(deliveryFee)}</span></div>}
                <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
                  <span>Total</span><span>{formatINR(rawSubtotal + deliveryFee)}</span>
                </div>
              </div>

              {storeClosed && (
                <div className="mt-3 rounded-lg bg-gray-900 text-white px-4 py-3 text-xs font-medium">
                  🔴 {storeClosedMessage || "Store is closed"}
                </div>
              )}

              {orderError && <p className="mt-3 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{orderError}</p>}

              <button onClick={handlePlaceOrder} disabled={placing || !canConfirm}
                className="w-full h-12 text-white font-bold text-sm rounded-xl mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: brandColor }}>
                {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : `Confirm Pickup · ${formatINR(rawSubtotal + deliveryFee)}`}
              </button>

              {!canConfirm && (
                <div className="mt-2 space-y-1">
                  {!isAuthenticated && <p className="text-[10px] text-red-400">Sign in required</p>}
                  {!customerResolved && <p className="text-[10px] text-red-400">Customer profile required</p>}
                  {!selectedAddressId && <p className="text-[10px] text-red-400">Select a pickup address</p>}
                  {!pickupDate && <p className="text-[10px] text-red-400">Select pickup date</p>}
                  {!pickupSlot && <p className="text-[10px] text-red-400">Select pickup time slot</p>}
                  {dateUnavailable && <p className="text-[10px] text-red-400">{dateUnavailable}</p>}
                  {!hasCartItems && <p className="text-[10px] text-red-400">Add items to your bag</p>}
                  {storeClosed && <p className="text-[10px] text-red-400">Store is closed</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
