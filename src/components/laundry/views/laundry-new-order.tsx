"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Search, UserPlus, User, Phone, MapPin, Clock, CreditCard,
  FileText, ArrowLeft, Save, Send, ArrowRight,
  Loader2, ShoppingBag, Plus, Trash2, Zap, Package,
} from "lucide-react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import type { BillingQuote } from "@/lib/laundry-billing"

// Order Type → Customer Type used by the Pricing Engine to resolve rules.
const ORDER_TYPES = [
  { value: "WALK_IN", label: "Walk-In", customerType: "WALK_IN" },
  { value: "STORE_DROP", label: "Store Drop", customerType: "WALK_IN" },
  { value: "HOME_PICKUP", label: "Home Pickup", customerType: "PICKUP" },
  { value: "CORPORATE", label: "Corporate Customer", customerType: "CORPORATE" },
  { value: "SUBSCRIPTION", label: "Subscription Customer", customerType: "SUBSCRIPTION" },
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

interface ServiceMaster {
  id: string
  name: string
  categoryId: string | null
  defaultTurnaroundHours: number
  availableInStore: boolean
  availableForPickup: boolean
  isActive: boolean
}

interface GarmentMaster {
  id: string
  name: string
  categoryId: string | null
  defaultService: string | null
  defaultUnit: string // PIECE | KG
  isActive: boolean
}

interface OrderLine {
  uid: string
  serviceId: string
  garmentId: string
  quantity: number
  weightKg: number
}

let lineSeq = 0
const newLine = (): OrderLine => ({ uid: `L${++lineSeq}`, serviceId: "", garmentId: "", quantity: 1, weightKg: 0 })

const inr = (n: number) => `₹${n.toFixed(2)}`

export default function LaundryNewOrder() {
  const { currentBusinessId } = useAuthStore()
  const { setLaundryPage } = useAdminStore()
  const { toast } = useToast()

  // ── Section 1: Customer ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("")
  const [customers, setCustomers] = useState<CustomerResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)

  const [newCustName, setNewCustName] = useState("")
  const [newCustMobile, setNewCustMobile] = useState("")
  const [newCustAltMobile, setNewCustAltMobile] = useState("")
  const [newCustEmail, setNewCustEmail] = useState("")
  const [newCustAddress, setNewCustAddress] = useState("")
  const [newCustArea, setNewCustArea] = useState("")
  const [newCustLandmark, setNewCustLandmark] = useState("")

  // ── Section 2: Order Type ────────────────────────────────────────────
  const [orderType, setOrderType] = useState("WALK_IN")

  // ── Masters (loaded from the master data — never hardcoded) ──────────
  const [services, setServices] = useState<ServiceMaster[]>([])
  const [garments, setGarments] = useState<GarmentMaster[]>([])
  const [mastersLoaded, setMastersLoaded] = useState(false)

  // ── Section 3: Items (service + garment + qty/weight) ────────────────
  const [lineItems, setLineItems] = useState<OrderLine[]>([newLine()])
  const [express, setExpress] = useState(false)

  // ── Live billing (resolved by the Pricing Engine) ────────────────────
  const [quote, setQuote] = useState<BillingQuote | null>(null)
  const [quoting, setQuoting] = useState(false)

  // ── Section 4: Expected Delivery ─────────────────────────────────────
  const [overrideDelivery, setOverrideDelivery] = useState(false)
  const [overrideReason, setOverrideReason] = useState("")
  const [customDeliveryDate, setCustomDeliveryDate] = useState("")

  // ── Section 5: Pickup (Home Pickup only) ────────────────────────────
  const [pickupDate, setPickupDate] = useState("")
  const [pickupTimeSlot, setPickupTimeSlot] = useState("")
  const [pickupAddress, setPickupAddress] = useState("")
  const [pickupInstructions, setPickupInstructions] = useState("")

  // ── Section 6/7 ──────────────────────────────────────────────────────
  const [paymentPreference, setPaymentPreference] = useState("COD")
  const [specialInstructions, setSpecialInstructions] = useState("")

  // ── Store list ───────────────────────────────────────────────────────
  const [stores, setStores] = useState<{ id: string; storeName: string }[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const customerType = useMemo(
    () => ORDER_TYPES.find((o) => o.value === orderType)?.customerType || "WALK_IN",
    [orderType],
  )
  const isPickup = orderType === "HOME_PICKUP"

  // ── Fetch stores + masters on mount ──────────────────────────────────
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/businesses/${currentBusinessId}`)
      .then((r) => r.json())
      .then((biz) => {
        if (biz.stores?.length) {
          setStores(biz.stores)
          setSelectedStoreId((prev) => prev || biz.stores[0].id)
        }
      })
      .catch(() => {})

    Promise.all([
      fetch(`/api/laundry/services?businessId=${currentBusinessId}`).then((r) => r.json()),
      fetch(`/api/laundry/garments?businessId=${currentBusinessId}`).then((r) => r.json()),
    ])
      .then(([svc, grm]) => {
        if (svc.success) setServices((svc.data as ServiceMaster[]).filter((s) => s.isActive))
        if (grm.success) setGarments((grm.data as GarmentMaster[]).filter((g) => g.isActive))
      })
      .catch(() => {})
      .finally(() => setMastersLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusinessId])

  // Services available for the chosen order channel.
  const availableServices = useMemo(
    () => services.filter((s) => (isPickup ? s.availableForPickup : s.availableInStore)),
    [services, isPickup],
  )

  const garmentById = useCallback((id: string) => garments.find((g) => g.id === id), [garments])

  // ── Live billing: resolve every line through the Pricing Engine ──────
  const validLines = useMemo(
    () => lineItems.filter((l) => l.serviceId && l.garmentId),
    [lineItems],
  )
  const quoteKey = JSON.stringify({ validLines, selectedStoreId, customerType, express, isPickup })
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!currentBusinessId || validLines.length === 0) {
      setQuote(null)
      return
    }
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
    quoteTimer.current = setTimeout(async () => {
      setQuoting(true)
      try {
        const items = validLines.map((l) => {
          const g = garmentById(l.garmentId)
          return {
            serviceId: l.serviceId,
            garmentId: l.garmentId,
            categoryId: g?.categoryId || null,
            quantity: l.quantity,
            weightKg: l.weightKg,
          }
        })
        const res = await fetch("/api/laundry/billing/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: currentBusinessId,
            storeId: selectedStoreId || null,
            customerType,
            express,
            delivery: isPickup,
            pickup: isPickup,
            items,
          }),
        })
        const json = await res.json()
        setQuote(json.success ? json.data : null)
      } catch {
        setQuote(null)
      } finally {
        setQuoting(false)
      }
    }, 350)
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, currentBusinessId])

  // Map a valid-line index back to its quote line (quote preserves order).
  const lineQuote = (line: OrderLine) => {
    const idx = validLines.findIndex((l) => l.uid === line.uid)
    return idx >= 0 && quote ? quote.lines[idx] : null
  }

  // ── Expected delivery from the selected services' turnaround ─────────
  const maxTurnaroundHours = useMemo(() => {
    const hrs = validLines
      .map((l) => services.find((s) => s.id === l.serviceId)?.defaultTurnaroundHours || 0)
      .filter((h) => h > 0)
    const base = hrs.length ? Math.max(...hrs) : 0
    return express && base > 0 ? Math.max(4, Math.round(base / 2)) : base
  }, [validLines, services, express])

  const computedDeliveryDate = useCallback(() => {
    if (overrideDelivery && customDeliveryDate) return customDeliveryDate
    if (maxTurnaroundHours === 0) return ""
    const date = new Date()
    date.setHours(date.getHours() + maxTurnaroundHours)
    return date.toISOString().split("T")[0]
  }, [maxTurnaroundHours, overrideDelivery, customDeliveryDate])

  // ── Customer search / create (unchanged behaviour) ───────────────────
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
          name: newCustName, mobile: newCustMobile, alternateMobile: newCustAltMobile,
          email: newCustEmail, address: newCustAddress, area: newCustArea, landmark: newCustLandmark,
        }),
      })
      const json = await res.json()
      if (res.status === 409 && json.data) {
        setSelectedCustomer({ ...json.data, addresses: [] })
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
        id: cust.id, name: cust.name, phone: cust.phone, email: cust.email,
        loyaltyTier: cust.loyaltyTier || "BRONZE", walletBalance: cust.walletBalance || 0,
        customerCode: cust.customerCode, totalOrders: cust.totalOrders || 0, addresses: [],
      })
      setShowNewCustomer(false)
      toast({ title: "Customer Created", description: `${cust.name} saved successfully` })
    } catch {
      toast({ title: "Error", description: "Failed to create customer", variant: "destructive" })
    }
  }

  // ── Line item helpers ────────────────────────────────────────────────
  const updateLine = (uid: string, patch: Partial<OrderLine>) =>
    setLineItems((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)))
  const addLine = () => setLineItems((prev) => [...prev, newLine()])
  const removeLine = (uid: string) =>
    setLineItems((prev) => (prev.length > 1 ? prev.filter((l) => l.uid !== uid) : prev))

  // Distinct services for the order workflow record (LaundryOrderService lines).
  const distinctServices = useMemo(() => {
    const map = new Map<string, { serviceName: string; turnaroundHours: number }>()
    validLines.forEach((l) => {
      const svc = services.find((s) => s.id === l.serviceId)
      if (svc && !map.has(svc.id)) map.set(svc.id, { serviceName: svc.name, turnaroundHours: svc.defaultTurnaroundHours })
    })
    return Array.from(map.values())
  }, [validLines, services])

  // ── Submit order ─────────────────────────────────────────────────────
  const handleSubmit = async (action: "create" | "draft" | "audit") => {
    if (!currentBusinessId || !selectedStoreId) {
      toast({ title: "Error", description: "No business or store selected", variant: "destructive" })
      return
    }
    if (validLines.length === 0) {
      toast({ title: "Error", description: "Add at least one item (service + garment)", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        businessId: currentBusinessId,
        storeId: selectedStoreId,
        customerId: selectedCustomer?.id || null,
        orderType,
        services: distinctServices,
        expectedDeliveryDate: computedDeliveryDate(),
        deliveryOverride: overrideDelivery,
        overrideReason: overrideDelivery ? overrideReason : null,
        paymentPreference,
        pickupDate: isPickup ? pickupDate : null,
        pickupTimeSlot: isPickup ? pickupTimeSlot : null,
        pickupAddress: isPickup ? pickupAddress : null,
        pickupInstructions: isPickup ? pickupInstructions : null,
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
      toast({ title: "Order Created", description: `Order ${json.data.orderNumber} is now PENDING_STORE_AUDIT` })
      setLaundryPage(action === "audit" ? "inbox" : "orders")
    } catch {
      toast({ title: "Error", description: "Failed to create order", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const noMasters = mastersLoaded && (availableServices.length === 0 || garments.length === 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLaundryPage("orders")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">New Laundry Order</h1>
          <p className="text-sm text-muted-foreground">Pricing is resolved live from the Pricing Engine</p>
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
                  <span className="text-xs text-muted-foreground">Wallet: ₹{selectedCustomer.walletBalance.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">Orders: {selectedCustomer.totalOrders}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>Change</Button>
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

      {/* Section 2: Order Type + Store */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4" /> Order Type
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={orderType} onValueChange={setOrderType} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {ORDER_TYPES.map((ot) => (
              <div key={ot.value} className="flex items-center space-x-2">
                <RadioGroupItem value={ot.value} id={`ot-${ot.value}`} />
                <Label htmlFor={`ot-${ot.value}`} className="text-sm cursor-pointer">{ot.label}</Label>
              </div>
            ))}
          </RadioGroup>
          {stores.length > 1 && (
            <div className="space-y-1 max-w-xs">
              <Label className="text-sm">Store</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.storeName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Items & Billing (master-driven) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><Package className="h-4 w-4" /> Items &amp; Pricing</span>
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${express ? "text-amber-500" : "text-muted-foreground"}`} />
              <Label htmlFor="express" className="text-xs font-normal cursor-pointer">Express</Label>
              <Switch id="express" checked={express} onCheckedChange={setExpress} />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {noMasters ? (
            <div className="text-sm text-muted-foreground border rounded-lg p-4">
              No active Services or Garments found. Add them under <strong>Masters → Services</strong> and{" "}
              <strong>Masters → Garments</strong>, then configure prices in the <strong>Pricing Engine</strong>.
            </div>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                <div className="col-span-4">Service</div>
                <div className="col-span-4">Garment</div>
                <div className="col-span-2">Qty / Weight</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>
              {lineItems.map((line) => {
                const g = garmentById(line.garmentId)
                const byWeight = g?.defaultUnit === "KG"
                const lq = lineQuote(line)
                return (
                  <div key={line.uid} className="grid grid-cols-12 gap-2 items-center border rounded-lg p-2">
                    <div className="col-span-12 sm:col-span-4">
                      <Select value={line.serviceId} onValueChange={(v) => updateLine(line.uid, { serviceId: v })}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Service" /></SelectTrigger>
                        <SelectContent>
                          {availableServices.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-7 sm:col-span-4">
                      <Select value={line.garmentId} onValueChange={(v) => updateLine(line.uid, { garmentId: v })}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Garment" /></SelectTrigger>
                        <SelectContent>
                          {garments.map((gm) => <SelectItem key={gm.id} value={gm.id}>{gm.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      {byWeight ? (
                        <Input
                          type="number" min={0} step={0.5} className="h-9" placeholder="kg"
                          value={line.weightKg || ""}
                          onChange={(e) => updateLine(line.uid, { weightKg: parseFloat(e.target.value) || 0 })}
                        />
                      ) : (
                        <Input
                          type="number" min={1} step={1} className="h-9" placeholder="qty"
                          value={line.quantity || ""}
                          onChange={(e) => updateLine(line.uid, { quantity: parseInt(e.target.value) || 0 })}
                        />
                      )}
                    </div>
                    <div className="col-span-2 sm:col-span-2 flex items-center justify-end gap-1">
                      <span className="text-sm font-medium tabular-nums">
                        {lq ? (lq.matchedRuleId ? inr(lq.lineTotal) : "—") : (line.serviceId && line.garmentId ? "…" : "")}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeLine(line.uid)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {lq && !lq.matchedRuleId && line.serviceId && line.garmentId && (
                      <div className="col-span-12 text-[11px] text-amber-600">
                        No pricing rule matches this combination — configure it in the Pricing Engine.
                      </div>
                    )}
                  </div>
                )
              })}
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            </>
          )}
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
            <Badge variant="secondary">{computedDeliveryDate() || "Add items"}</Badge>
            {maxTurnaroundHours > 0 && <span className="text-xs text-muted-foreground">(Highest TAT: {maxTurnaroundHours}h{express ? ", express" : ""})</span>}
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
      {isPickup && (
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
                  <SelectTrigger><SelectValue placeholder="Select time slot" /></SelectTrigger>
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
          <p className="text-xs text-muted-foreground mt-2">Payment is collected during Stage 2 (Store Audit), after the store confirms the resolved amount.</p>
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
            placeholder="Examples: Starch Shirts, Separate White Clothes, Gentle Wash..."
            className="min-h-[80px]"
          />
        </CardContent>
      </Card>

      {/* Order Summary — resolved live from the Pricing Engine */}
      <Card className="bg-muted/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Order Summary</span>
            {quoting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {quote ? (
            <>
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{inr(quote.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="tabular-nums">{inr(quote.gstTotal)}</span></div>
              {quote.expressCharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Express Charge</span><span className="tabular-nums">{inr(quote.expressCharge)}</span></div>}
              {quote.pickupCharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Pickup Charge</span><span className="tabular-nums">{inr(quote.pickupCharge)}</span></div>}
              {quote.deliveryCharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Delivery Charge</span><span className="tabular-nums">{inr(quote.deliveryCharge)}</span></div>}
              <Separator />
              <div className="flex justify-between text-base font-semibold"><span>Estimated Total</span><span className="tabular-nums">{inr(quote.grandTotal)}</span></div>
              <p className="text-xs text-muted-foreground pt-1">Final amount is confirmed during Store Audit.</p>
            </>
          ) : (
            <p className="text-muted-foreground">{validLines.length > 0 ? "Resolving prices…" : "Add items to see the resolved price"}</p>
          )}
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
