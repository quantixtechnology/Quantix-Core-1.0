"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Search, UserPlus, User, Phone, MapPin, Clock, CreditCard,
  FileText, ArrowLeft, Save, Send, ArrowRight, AlertCircle,
  Loader2, CheckCircle2, ShoppingBag,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

const DEFAULT_SERVICES = [
  { name: "Wash + Dry + Fold", hours: 24 },
  { name: "Wash + Dry + Iron", hours: 24 },
  { name: "Dry Clean", hours: 48 },
  { name: "Steam Iron", hours: 12 },
  { name: "Shoe Cleaning", hours: 48 },
  { name: "Carpet Cleaning", hours: 72 },
]

const ORDER_TYPES = [
  { value: "WALK_IN", label: "Walk-In" },
  { value: "STORE_DROP", label: "Store Drop" },
  { value: "HOME_PICKUP", label: "Home Pickup" },
  { value: "CORPORATE", label: "Corporate Customer" },
  { value: "SUBSCRIPTION", label: "Subscription Customer" },
]

const PAYMENT_PREFERENCES = [
  { value: "FULL_ADVANCE", label: "Full Advance" },
  { value: "PARTIAL_ADVANCE", label: "Partial Advance" },
  { value: "COD", label: "COD" },
  { value: "SUBSCRIPTION_BILLING", label: "Subscription Billing" },
]

interface CustomerResult {
  id: string
  name: string
  phone: string | null
  email: string | null
  loyaltyTier: string
  walletBalance: number
  customerCode: string | null
  totalOrders: number
  addresses: { addressLine1: string; city: string }[]
}

export default function LaundryNewOrder() {
  const router = useRouter()
  const { currentBusinessId } = useAuthStore()
  const { setLaundryPage } = useAdminStore()
  const { toast } = useToast()

  // ── Section 1: Customer ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("")
  const [customers, setCustomers] = useState<CustomerResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)

  // New customer form
  const [newCustName, setNewCustName] = useState("")
  const [newCustMobile, setNewCustMobile] = useState("")
  const [newCustAltMobile, setNewCustAltMobile] = useState("")
  const [newCustEmail, setNewCustEmail] = useState("")
  const [newCustAddress, setNewCustAddress] = useState("")
  const [newCustArea, setNewCustArea] = useState("")
  const [newCustLandmark, setNewCustLandmark] = useState("")

  // ── Section 2: Order Type ────────────────────────────────────────────
  const [orderType, setOrderType] = useState("WALK_IN")

  // ── Section 3: Services ──────────────────────────────────────────────
  const [selectedServices, setSelectedServices] = useState<string[]>([])

  // ── Section 4: Expected Delivery ─────────────────────────────────────
  const [overrideDelivery, setOverrideDelivery] = useState(false)
  const [overrideReason, setOverrideReason] = useState("")
  const [customDeliveryDate, setCustomDeliveryDate] = useState("")

  // ── Section 5: Pickup (Home Pickup only) ────────────────────────────
  const [pickupDate, setPickupDate] = useState("")
  const [pickupTimeSlot, setPickupTimeSlot] = useState("")
  const [pickupAddress, setPickupAddress] = useState("")
  const [pickupInstructions, setPickupInstructions] = useState("")

  // ── Section 6: Payment Preference ────────────────────────────────────
  const [paymentPreference, setPaymentPreference] = useState("COD")

  // ── Section 7: Special Instructions ──────────────────────────────────
  const [specialInstructions, setSpecialInstructions] = useState("")

  // ── Store list ───────────────────────────────────────────────────────
  const [stores, setStores] = useState<{ id: string; storeName: string }[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // ── Computed ─────────────────────────────────────────────────────────
  const computedDeliveryDate = useCallback(() => {
    if (overrideDelivery && customDeliveryDate) return customDeliveryDate
    if (selectedServices.length === 0) return ""
    const maxHours = Math.max(
      ...selectedServices.map(
        (s) => DEFAULT_SERVICES.find((ds) => ds.name === s)?.hours || 24
      )
    )
    const date = new Date()
    date.setHours(date.getHours() + maxHours)
    return date.toISOString().split("T")[0]
  }, [selectedServices, overrideDelivery, customDeliveryDate])

  // ── Fetch stores on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/businesses/${currentBusinessId}`)
      .then((r) => r.json())
      .then((biz) => {
        if (biz.stores?.length) {
          setStores(biz.stores)
          if (!selectedStoreId) setSelectedStoreId(biz.stores[0].id)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusinessId])

  // ── Customer search ──────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentBusinessId) return
    setSearching(true)
    try {
      const res = await fetch(`/api/laundry/customers/search?businessId=${currentBusinessId}&q=${encodeURIComponent(searchQuery)}`)
      const json = await res.json()
      if (json.success) setCustomers(json.data)
    } catch {
      setCustomers([])
    } finally {
      setSearching(false)
    }
  }

  // ── Create new customer ──────────────────────────────────────────────
  const handleCreateCustomer = async () => {
    if (!newCustName.trim() || !newCustMobile.trim()) {
      toast({ title: "Error", description: "Name and Mobile are required", variant: "destructive" })
      return
    }
    try {
      const res = await fetch("/api/laundry/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: currentBusinessId,
          name: newCustName,
          mobile: newCustMobile,
          alternateMobile: newCustAltMobile,
          email: newCustEmail,
          address: newCustAddress,
          area: newCustArea,
          landmark: newCustLandmark,
        }),
      })
      const json = await res.json()
      if (res.status === 409 && json.data) {
        setSelectedCustomer({ ...json.data, address: [] })
        setShowNewCustomer(false)
        toast({ title: "Customer Exists", description: "Using existing customer record" })
        return
      }
      if (!json.success) {
        toast({ title: "Error", description: json.error || "Failed to create customer", variant: "destructive" })
        return
      }
      const cust = json.data
      setSelectedCustomer({
        id: cust.id,
        name: cust.name,
        phone: cust.phone,
        email: cust.email,
        loyaltyTier: cust.loyaltyTier || "BRONZE",
        walletBalance: cust.walletBalance || 0,
        customerCode: cust.customerCode,
        totalOrders: cust.totalOrders || 0,
        addresses: [],
      })
      setShowNewCustomer(false)
      toast({ title: "Customer Created", description: `${cust.name} saved successfully` })
    } catch {
      toast({ title: "Error", description: "Failed to create customer", variant: "destructive" })
    }
  }

  // ── Service toggle ───────────────────────────────────────────────────
  const toggleService = (name: string) => {
    setSelectedServices((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    )
  }

  // ── Submit order ─────────────────────────────────────────────────────
  const handleSubmit = async (action: "create" | "draft" | "audit") => {
    if (!currentBusinessId || !selectedStoreId) {
      toast({ title: "Error", description: "No business or store selected", variant: "destructive" })
      return
    }
    if (selectedServices.length === 0) {
      toast({ title: "Error", description: "Select at least one service", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        businessId: currentBusinessId,
        storeId: selectedStoreId,
        customerId: selectedCustomer?.id || null,
        orderType,
        services: selectedServices.map((name) => {
          const svc = DEFAULT_SERVICES.find((s) => s.name === name)
          return { serviceName: name, turnaroundHours: svc?.hours || 24 }
        }),
        expectedDeliveryDate: computedDeliveryDate(),
        deliveryOverride: overrideDelivery,
        overrideReason: overrideDelivery ? overrideReason : null,
        paymentPreference,
        pickupDate: orderType === "HOME_PICKUP" ? pickupDate : null,
        pickupTimeSlot: orderType === "HOME_PICKUP" ? pickupTimeSlot : null,
        pickupAddress: orderType === "HOME_PICKUP" ? pickupAddress : null,
        pickupInstructions: orderType === "HOME_PICKUP" ? pickupInstructions : null,
        specialInstructions,
        notes: null,
        createdBy: "laundry_user",
      }

      const res = await fetch("/api/laundry/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) {
        toast({ title: "Error", description: json.error || "Failed to create order", variant: "destructive" })
        return
      }

      toast({
        title: "Order Created",
        description: `Order ${json.data.orderNumber} is now PENDING_STORE_AUDIT`,
      })

      if (action === "audit") {
        setLaundryPage("inbox")
      } else {
        setLaundryPage("orders")
      }
    } catch {
      toast({ title: "Error", description: "Failed to create order", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const maxDeliveryHours = selectedServices.length > 0
    ? Math.max(...selectedServices.map((s) => DEFAULT_SERVICES.find((ds) => ds.name === s)?.hours || 24))
    : 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLaundryPage("orders")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">New Laundry Order</h1>
          <p className="text-sm text-muted-foreground">Create a new order and start the laundry workflow</p>
        </div>
      </div>

      {/* Section 1: Customer Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedCustomer ? (
            <div className="flex items-start justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-1">
                <p className="font-semibold">{selectedCustomer.name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" /> {selectedCustomer.phone || "N/A"}
                </div>
                {selectedCustomer.addresses?.[0] && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedCustomer.addresses[0].addressLine1}, {selectedCustomer.addresses[0].city}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{selectedCustomer.loyaltyTier}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Wallet: ₹{selectedCustomer.walletBalance.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Orders: {selectedCustomer.totalOrders}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by Mobile, Name, or Customer ID..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {customers.length > 0 && (
                <ScrollArea className="max-h-48 border rounded-lg">
                  {customers.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-0"
                      onClick={() => setSelectedCustomer(c)}
                    >
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-sm text-muted-foreground">{c.phone} {c.customerCode ? `• ${c.customerCode}` : ""}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{c.loyaltyTier}</Badge>
                    </div>
                  ))}
                </ScrollArea>
              )}

              <Separator />

              <div className="text-center">
                <Button variant="outline" onClick={() => setShowNewCustomer(true)}>
                  <UserPlus className="h-4 w-4 mr-2" /> New Customer
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Customer Dialog */}
      <Dialog open={showNewCustomer} onOpenChange={setShowNewCustomer}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
            <DialogDescription>Add a new customer to your laundry business</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Customer Name *</Label>
                <Input value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1">
                <Label>Mobile Number *</Label>
                <Input value={newCustMobile} onChange={(e) => setNewCustMobile(e.target.value)} placeholder="10-digit number" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Alternate Mobile</Label>
                <Input value={newCustAltMobile} onChange={(e) => setNewCustAltMobile(e.target.value)} placeholder="Alternate number" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} placeholder="email@example.com" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Textarea value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)} placeholder="Full address" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Area</Label>
                <Input value={newCustArea} onChange={(e) => setNewCustArea(e.target.value)} placeholder="Area / locality" />
              </div>
              <div className="space-y-1">
                <Label>Landmark</Label>
                <Input value={newCustLandmark} onChange={(e) => setNewCustLandmark(e.target.value)} placeholder="Nearby landmark" />
              </div>
            </div>
            <Button className="w-full" onClick={handleCreateCustomer}>
              <UserPlus className="h-4 w-4 mr-2" /> Save Customer &amp; Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Section 2: Order Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4" /> Order Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={orderType} onValueChange={setOrderType} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {ORDER_TYPES.map((ot) => (
              <div key={ot.value} className="flex items-center space-x-2">
                <RadioGroupItem value={ot.value} id={`ot-${ot.value}`} />
                <Label htmlFor={`ot-${ot.value}`} className="text-sm cursor-pointer">{ot.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Section 3: Service Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4" /> Service Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {DEFAULT_SERVICES.map((svc) => (
              <div
                key={svc.name}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedServices.includes(svc.name) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
                onClick={() => toggleService(svc.name)}
              >
                <Checkbox checked={selectedServices.includes(svc.name)} onCheckedChange={() => toggleService(svc.name)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{svc.name}</p>
                  <p className="text-xs text-muted-foreground">{svc.hours}h TAT</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Expected Delivery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Expected Delivery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Auto-calculated:</span>
            <Badge variant="secondary">{computedDeliveryDate() || "Select services"}</Badge>
            {maxDeliveryHours > 0 && <span className="text-xs text-muted-foreground">(Based on highest TAT: {maxDeliveryHours}h)</span>}
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={overrideDelivery} onCheckedChange={setOverrideDelivery} id="override-delivery" />
            <Label htmlFor="override-delivery" className="text-sm">Allow Override</Label>
          </div>
          {overrideDelivery && (
            <div className="space-y-2 pl-10">
              <div className="space-y-1">
                <Label>Custom Delivery Date</Label>
                <Input type="date" value={customDeliveryDate} onChange={(e) => setCustomDeliveryDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Override Reason *</Label>
                <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Why is the delivery date being overridden?" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Pickup Details (Home Pickup only) */}
      {orderType === "HOME_PICKUP" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Pickup Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Pickup Date</Label>
                <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Pickup Time Slot</Label>
                <Select value={pickupTimeSlot} onValueChange={setPickupTimeSlot}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="07:00-09:00">07:00 - 09:00</SelectItem>
                    <SelectItem value="09:00-12:00">09:00 - 12:00</SelectItem>
                    <SelectItem value="12:00-15:00">12:00 - 15:00</SelectItem>
                    <SelectItem value="15:00-18:00">15:00 - 18:00</SelectItem>
                    <SelectItem value="18:00-21:00">18:00 - 21:00</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Pickup Address</Label>
              <Textarea value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="Enter pickup address" />
            </div>
            <div className="space-y-1">
              <Label>Special Instructions for Pickup</Label>
              <Input value={pickupInstructions} onChange={(e) => setPickupInstructions(e.target.value)} placeholder="e.g., Leave at door, Call before arriving" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 6: Payment Preference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" /> Payment Preference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={paymentPreference} onValueChange={setPaymentPreference} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PAYMENT_PREFERENCES.map((pp) => (
              <div key={pp.value} className="flex items-center space-x-2">
                <RadioGroupItem value={pp.value} id={`pp-${pp.value}`} />
                <Label htmlFor={`pp-${pp.value}`} className="text-sm cursor-pointer">{pp.label}</Label>
              </div>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground mt-2">No payment is collected at order intake. Payment will be processed during Stage 2 (Store Audit).</p>
        </CardContent>
      </Card>

      {/* Section 7: Special Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Special Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            placeholder="Examples: Starch Shirts, Separate White Clothes, Gentle Wash, Express Delivery..."
            className="min-h-[80px]"
          />
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card className="bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {selectedServices.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedServices.map((s) => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No services selected</p>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
            <div>
              <span className="text-muted-foreground">Total Items:</span>
              <span className="ml-2 font-medium">Pending Audit</span>
            </div>
            <div>
              <span className="text-muted-foreground">Estimated Amount:</span>
              <span className="ml-2 font-medium">Pending Audit</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2 pb-8">
        <Button variant="outline" onClick={() => handleSubmit("draft")} disabled={submitting}>
          <Save className="h-4 w-4 mr-2" /> Save Draft
        </Button>
        <Button onClick={() => handleSubmit("create")} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Create Order
        </Button>
        <Button variant="default" className="bg-amber-600 hover:bg-amber-700" onClick={() => handleSubmit("audit")} disabled={submitting}>
          <ArrowRight className="h-4 w-4 mr-2" /> Create Order &amp; Start Audit
        </Button>
      </div>
    </div>
  )
}
