"use client"

// New Laundry Order — order intake at the store counter. Captures the customer,
// order type, services and logistics, then creates the order in
// PENDING_STORE_AUDIT. Garment counting, defects, photos and the final bill are
// captured at Store Audit, so amounts here read "Pending Audit". Services load
// from the Services master; nothing is hardcoded. Does not touch the workflow,
// billing resolver or order APIs beyond the existing create endpoint.

import { useState, useEffect, useCallback, useMemo } from "react"
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
import {
  Search, UserPlus, User, Phone, MapPin, Clock, CreditCard, Store as StoreIcon,
  FileText, Save, Send, ArrowRight, Loader2, ShoppingBag, CheckCircle2,
  Hash, Calendar, UserCircle, Trash2, Plus, WashingMachine, Info, X,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

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
  { value: "WALLET", label: "Wallet" },
  { value: "CORPORATE_BILLING", label: "Corporate Billing" },
]

const QUICK_NOTES = ["Starch Shirts", "Separate White Clothes", "Gentle Wash", "Express Delivery"]

const PICKUP_SLOTS = ["07:00 - 09:00", "09:00 - 12:00", "12:00 - 15:00", "15:00 - 18:00", "18:00 - 21:00"]

interface CustomerResult {
  id: string; name: string; phone: string | null; email: string | null
  loyaltyTier: string; walletBalance: number; customerCode: string | null
  totalOrders: number; addresses: { addressLine1: string; city: string }[]
}
interface ServiceMaster {
  id: string; name: string; defaultTurnaroundHours: number
  availableInStore: boolean; availableForPickup: boolean; isActive: boolean
}
interface StoreInfo { id: string; storeName: string; city?: string | null }

const turnaroundLabel = (h: number) => (h <= 0 ? "Custom" : h <= 12 ? "Same Day" : `${h} Hours`)
const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
const fmtDateTime = (d: Date) => `${fmtDate(d)} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`

export default function LaundryNewOrder() {
  const { currentBusinessId, user } = useAuthStore()
  const { setLaundryPage } = useAdminStore()
  const { toast } = useToast()
  const now = useMemo(() => new Date(), [])

  // Customer
  const [searchBy, setSearchBy] = useState("mobile")
  const [searchQuery, setSearchQuery] = useState("")
  const [customers, setCustomers] = useState<CustomerResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)
  const [newCustName, setNewCustName] = useState("")
  const [newCustMobile, setNewCustMobile] = useState("")
  const [newCustAltMobile, setNewCustAltMobile] = useState("")
  const [newCustEmail, setNewCustEmail] = useState("")
  const [newCustAddress, setNewCustAddress] = useState("")
  const [newCustArea, setNewCustArea] = useState("")
  const [newCustLandmark, setNewCustLandmark] = useState("")

  // Order
  const [orderType, setOrderType] = useState("WALK_IN")
  const [services, setServices] = useState<ServiceMaster[]>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [overrideDelivery, setOverrideDelivery] = useState(false)
  const [overrideReason, setOverrideReason] = useState("")
  const [customDeliveryDate, setCustomDeliveryDate] = useState("")
  const [pickupDate, setPickupDate] = useState("")
  const [pickupTimeSlot, setPickupTimeSlot] = useState("")
  const [pickupAddress, setPickupAddress] = useState("")
  const [pickupInstructions, setPickupInstructions] = useState("")
  const [paymentPreference, setPaymentPreference] = useState("COD")
  const [quickNotes, setQuickNotes] = useState<string[]>(["Separate White Clothes"])
  const [otherInstructions, setOtherInstructions] = useState("")

  const [stores, setStores] = useState<StoreInfo[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const isPickup = orderType === "HOME_PICKUP"
  const selectedStore = stores.find((s) => s.id === selectedStoreId)

  // Load stores + services
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/businesses/${currentBusinessId}`)
      .then((r) => r.json())
      .then((biz) => {
        if (biz.stores?.length) {
          setStores(biz.stores)
          setSelectedStoreId((p) => p || biz.stores[0].id)
        }
      })
      .catch(() => {})
    fetch(`/api/laundry/services?businessId=${currentBusinessId}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setServices((j.data as ServiceMaster[]).filter((s) => s.isActive)) })
      .catch(() => {})
  }, [currentBusinessId])

  const availableServices = useMemo(
    () => services.filter((s) => (isPickup ? s.availableForPickup : s.availableInStore)),
    [services, isPickup],
  )
  const selectedServices = useMemo(
    () => selectedServiceIds.map((id) => services.find((s) => s.id === id)).filter(Boolean) as ServiceMaster[],
    [selectedServiceIds, services],
  )

  const toggleService = (id: string) =>
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // Expected delivery from highest TAT (express halves it)
  const maxTat = useMemo(() => {
    const hrs = selectedServices.map((s) => s.defaultTurnaroundHours).filter((h) => h > 0)
    const base = hrs.length ? Math.max(...hrs) : 0
    return quickNotes.includes("Express Delivery") && base > 0 ? Math.max(4, Math.round(base / 2)) : base
  }, [selectedServices, quickNotes])

  const expectedDelivery = useMemo(() => {
    if (overrideDelivery && customDeliveryDate) return new Date(customDeliveryDate)
    if (maxTat === 0) return null
    const d = new Date(now); d.setHours(d.getHours() + maxTat); return d
  }, [maxTat, overrideDelivery, customDeliveryDate, now])

  // Customer search / create
  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentBusinessId) return
    setSearching(true)
    try {
      const res = await fetch(`/api/laundry/customers/search?businessId=${currentBusinessId}&q=${encodeURIComponent(searchQuery)}`)
      const json = await res.json()
      setCustomers(json.success ? json.data : [])
    } catch { setCustomers([]) } finally { setSearching(false) }
  }

  const handleCreateCustomer = async () => {
    if (!newCustName.trim() || !newCustMobile.trim()) {
      toast({ title: "Error", description: "Name and Mobile are required", variant: "destructive" }); return
    }
    try {
      const res = await fetch("/api/laundry/customers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: currentBusinessId, name: newCustName, mobile: newCustMobile,
          alternateMobile: newCustAltMobile, email: newCustEmail, address: newCustAddress,
          area: newCustArea, landmark: newCustLandmark,
        }),
      })
      const json = await res.json()
      if (res.status === 409 && json.data) {
        setSelectedCustomer({ ...json.data, addresses: [] }); toast({ title: "Customer Exists", description: "Using existing customer record" }); return
      }
      if (!json.success) { toast({ title: "Error", description: json.error || "Failed to create customer", variant: "destructive" }); return }
      const c = json.data
      setSelectedCustomer({ id: c.id, name: c.name, phone: c.phone, email: c.email, loyaltyTier: c.loyaltyTier || "BRONZE", walletBalance: c.walletBalance || 0, customerCode: c.customerCode, totalOrders: c.totalOrders || 0, addresses: [] })
      toast({ title: "Customer Created", description: `${c.name} saved successfully` })
    } catch { toast({ title: "Error", description: "Failed to create customer", variant: "destructive" }) }
  }

  const specialInstructions = useMemo(
    () => [...quickNotes, otherInstructions.trim()].filter(Boolean).join("; "),
    [quickNotes, otherInstructions],
  )

  const handleSubmit = async (action: "create" | "draft" | "audit") => {
    if (!currentBusinessId || !selectedStoreId) { toast({ title: "Error", description: "No business or store selected", variant: "destructive" }); return }
    if (!selectedCustomer) { toast({ title: "Error", description: "Select or create a customer first", variant: "destructive" }); return }
    if (selectedServices.length === 0) { toast({ title: "Error", description: "Select at least one service", variant: "destructive" }); return }

    setSubmitting(true)
    try {
      const payload = {
        businessId: currentBusinessId,
        storeId: selectedStoreId,
        customerId: selectedCustomer.id,
        orderType,
        services: selectedServices.map((s) => ({ serviceId: s.id, serviceName: s.name, turnaroundHours: s.defaultTurnaroundHours })),
        isExpress: quickNotes.includes("Express Delivery"),
        expectedDeliveryDate: expectedDelivery ? expectedDelivery.toISOString().split("T")[0] : null,
        deliveryOverride: overrideDelivery,
        overrideReason: overrideDelivery ? overrideReason : null,
        paymentPreference,
        pickupDate: isPickup ? pickupDate : null,
        pickupTimeSlot: isPickup ? pickupTimeSlot : null,
        pickupAddress: isPickup ? pickupAddress : null,
        pickupInstructions: isPickup ? pickupInstructions : null,
        specialInstructions,
        notes: null,
        createdBy: user?.name || "laundry_user",
      }
      const res = await fetch("/api/laundry/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!json.success) { toast({ title: "Error", description: json.error || "Failed to create order", variant: "destructive" }); return }
      toast({ title: "Order Created", description: `Order ${json.data.orderNumber} is now Pending Store Audit` })
      setLaundryPage(action === "audit" ? "audit-queue" : "orders")
    } catch { toast({ title: "Error", description: "Failed to create order", variant: "destructive" }) } finally { setSubmitting(false) }
  }

  const InfoCell = ({ icon: Icon, label, value, sub }: { icon: typeof Hash; label: string; value: string; sub?: string }) => (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 shrink-0"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className="text-sm font-semibold truncate">{value}</p>{sub && <p className="text-[11px] text-sky-600 truncate">{sub}</p>}</div>
    </div>
  )

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingBag className="h-6 w-6 text-sky-600" />
        <h1 className="text-xl font-bold">New Laundry Order</h1>
      </div>

      {/* Info strip */}
      <Card className="mb-5">
        <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
          <InfoCell icon={Hash} label="Order No." value="Auto Generated" sub="On create" />
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 shrink-0"><StoreIcon className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground">Store</p>
              {stores.length > 1 ? (
                <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                  <SelectTrigger className="h-7 px-2 text-sm font-semibold border-0 shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.storeName}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <><p className="text-sm font-semibold truncate">{selectedStore?.storeName || "—"}</p>{selectedStore?.city && <p className="text-[11px] text-sky-600">{selectedStore.city}</p>}</>
              )}
            </div>
          </div>
          <InfoCell icon={Calendar} label="Date & Time" value={fmtDateTime(now)} />
          <InfoCell icon={UserCircle} label="Executive Name" value={user?.name || "—"} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        {/* Main column */}
        <div className="space-y-5">
          {/* Customer */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" /> Customer Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Existing */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-sky-700">Existing Customer</p>
                  <RadioGroup value={searchBy} onValueChange={setSearchBy} className="flex gap-4">
                    {[["mobile", "Mobile Number"], ["name", "Customer Name"], ["id", "Customer ID"]].map(([v, l]) => (
                      <div key={v} className="flex items-center space-x-1.5"><RadioGroupItem value={v} id={`sb-${v}`} /><Label htmlFor={`sb-${v}`} className="text-xs cursor-pointer">{l}</Label></div>
                    ))}
                  </RadioGroup>
                  <div className="flex gap-2">
                    <Input placeholder="Search…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
                    <Button onClick={handleSearch} disabled={searching} className="gap-1 bg-sky-600 hover:bg-sky-700 text-white">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search</Button>
                  </div>

                  {selectedCustomer ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium"><CheckCircle2 className="h-4 w-4" /> Customer Found</div>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{selectedCustomer.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedCustomer.phone || "—"}</p>
                          {selectedCustomer.addresses?.[0] && <p className="text-xs text-muted-foreground mt-1">{selectedCustomer.addresses[0].addressLine1}, {selectedCustomer.addresses[0].city}</p>}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[11px] border-amber-300 text-amber-700 bg-amber-50">{selectedCustomer.loyaltyTier}</Badge>
                            <span className="text-[11px] text-muted-foreground">Wallet: ₹{selectedCustomer.walletBalance.toFixed(2)}</span>
                            <span className="text-[11px] text-muted-foreground">Orders: {selectedCustomer.totalOrders}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ) : customers.length > 0 ? (
                    <ScrollArea className="max-h-44 border rounded-lg">
                      {customers.map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-2.5 hover:bg-muted/50 cursor-pointer border-b last:border-0" onClick={() => setSelectedCustomer(c)}>
                          <div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.phone} {c.customerCode ? `• ${c.customerCode}` : ""}</p></div>
                          <Badge variant="secondary" className="text-[11px]">{c.loyaltyTier}</Badge>
                        </div>
                      ))}
                    </ScrollArea>
                  ) : null}
                </div>

                {/* New */}
                <div className="space-y-3 md:border-l md:pl-6">
                  <p className="text-sm font-semibold text-sky-700">New Customer</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 space-y-1"><Label className="text-xs">Customer Name *</Label><Input value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Enter customer name" className="h-9" /></div>
                    <div className="space-y-1"><Label className="text-xs">Mobile Number *</Label><Input value={newCustMobile} onChange={(e) => setNewCustMobile(e.target.value)} placeholder="Enter mobile" className="h-9" /></div>
                    <div className="space-y-1"><Label className="text-xs">Alternate Mobile</Label><Input value={newCustAltMobile} onChange={(e) => setNewCustAltMobile(e.target.value)} placeholder="Optional" className="h-9" /></div>
                    <div className="col-span-2 space-y-1"><Label className="text-xs">Email</Label><Input value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} placeholder="Enter email" className="h-9" /></div>
                    <div className="col-span-2 space-y-1"><Label className="text-xs">Address *</Label><Input value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)} placeholder="Enter address" className="h-9" /></div>
                    <div className="space-y-1"><Label className="text-xs">Area *</Label><Input value={newCustArea} onChange={(e) => setNewCustArea(e.target.value)} placeholder="Area" className="h-9" /></div>
                    <div className="space-y-1"><Label className="text-xs">Landmark</Label><Input value={newCustLandmark} onChange={(e) => setNewCustLandmark(e.target.value)} placeholder="Landmark" className="h-9" /></div>
                  </div>
                  <Button onClick={handleCreateCustomer} className="w-full gap-1 bg-sky-600 hover:bg-sky-700 text-white"><UserPlus className="h-4 w-4" /> Save Customer &amp; Continue</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Type + Services */}
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShoppingBag className="h-4 w-4" /> Order Type</CardTitle></CardHeader>
              <CardContent>
                <RadioGroup value={orderType} onValueChange={setOrderType} className="space-y-2.5">
                  {ORDER_TYPES.map((ot) => (
                    <div key={ot.value} className="flex items-center space-x-2"><RadioGroupItem value={ot.value} id={`ot-${ot.value}`} /><Label htmlFor={`ot-${ot.value}`} className="text-sm cursor-pointer">{ot.label}</Label></div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><WashingMachine className="h-4 w-4" /> Service Selection <span className="text-xs font-normal text-muted-foreground">(Select multiple services)</span></CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4">
                  <div className="rounded-lg border divide-y">
                    <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40"><span>Service</span><span>Est. Turnaround</span></div>
                    {availableServices.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground">No services configured.</p>
                    ) : availableServices.map((s) => (
                      <label key={s.id} className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/30">
                        <span className="flex items-center gap-2.5"><Checkbox checked={selectedServiceIds.includes(s.id)} onCheckedChange={() => toggleService(s.id)} /><span className="text-sm">{s.name}</span></span>
                        <span className="text-xs text-emerald-600">{turnaroundLabel(s.defaultTurnaroundHours)}</span>
                      </label>
                    ))}
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-sm font-semibold mb-2">Selected Services ({selectedServices.length})</p>
                    {selectedServices.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None selected yet.</p>
                    ) : (
                      <ol className="space-y-1.5">
                        {selectedServices.map((s, i) => (
                          <li key={s.id} className="flex items-center justify-between text-sm"><span>{i + 1}. {s.name}</span><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => toggleService(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button></li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Expected delivery + Pickup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Expected Delivery</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Order Created</span><span>{fmtDateTime(now)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Estimated Delivery</span><span className="text-emerald-600 font-medium">{expectedDelivery ? fmtDateTime(expectedDelivery) : "Select services"}</span></div>
                <p className="text-[11px] text-muted-foreground -mt-1">(Based on max. turnaround time)</p>
                <div className="flex items-center gap-3"><span className="text-muted-foreground">Override Allowed</span>
                  <div className="flex items-center gap-2"><Switch checked={overrideDelivery} onCheckedChange={setOverrideDelivery} /><span>{overrideDelivery ? "Yes" : "No"}</span></div>
                </div>
                {overrideDelivery && (
                  <div className="space-y-2">
                    <Input type="date" value={customDeliveryDate} onChange={(e) => setCustomDeliveryDate(e.target.value)} className="h-9" />
                    <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Reason (required if overridden)" className="min-h-[60px]" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={isPickup ? "" : "opacity-60"}>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Pickup Details <span className="text-xs font-normal text-muted-foreground">(Pickup orders only)</span></CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Pickup Date</Label><Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} disabled={!isPickup} className="h-9" /></div>
                  <div className="space-y-1"><Label className="text-xs">Pickup Time Slot</Label>
                    <Select value={pickupTimeSlot} onValueChange={setPickupTimeSlot} disabled={!isPickup}><SelectTrigger className="h-9"><SelectValue placeholder="Select slot" /></SelectTrigger>
                      <SelectContent>{PICKUP_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                  </div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Pickup Address</Label><Input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} disabled={!isPickup} className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">Special Instructions</Label><Input value={pickupInstructions} onChange={(e) => setPickupInstructions(e.target.value)} disabled={!isPickup} placeholder="e.g. Call before arrival" className="h-9" /></div>
              </CardContent>
            </Card>
          </div>

          {/* Summary + Payment + Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Order Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="text-xs">
                  <div className="flex justify-between font-semibold text-muted-foreground pb-1.5 border-b"><span>Service</span><span>Qty / Est. Value</span></div>
                  {selectedServices.length === 0 ? <p className="py-3 text-muted-foreground">No services selected</p> : selectedServices.map((s) => (
                    <div key={s.id} className="flex justify-between py-1.5 border-b last:border-0"><span>{s.name}</span><span className="text-muted-foreground">Pending Audit · ₹0</span></div>
                  ))}
                  <div className="flex justify-between pt-2 font-medium"><span>Total Items</span><span className="text-amber-600">Pending Audit</span></div>
                  <div className="flex justify-between pt-1 font-medium"><span>Estimated Amount</span><span className="text-amber-600">Pending Audit</span></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4" /> Payment Preference</CardTitle></CardHeader>
              <CardContent>
                <RadioGroup value={paymentPreference} onValueChange={setPaymentPreference} className="space-y-2">
                  {PAYMENT_PREFERENCES.map((p) => (
                    <div key={p.value} className="flex items-center space-x-2"><RadioGroupItem value={p.value} id={`pp-${p.value}`} /><Label htmlFor={`pp-${p.value}`} className="text-sm cursor-pointer">{p.label}</Label></div>
                  ))}
                </RadioGroup>
                <p className="mt-3 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">Payment is collected after Store Audit.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4" /> Notes / Special Instructions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  {QUICK_NOTES.map((n) => (
                    <label key={n} className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={quickNotes.includes(n)} onCheckedChange={() => setQuickNotes((p) => p.includes(n) ? p.filter((x) => x !== n) : [...p, n])} /> {n}</label>
                  ))}
                </div>
                <div className="space-y-1"><Label className="text-xs">Other Instructions</Label><Textarea value={otherInstructions} onChange={(e) => setOtherInstructions(e.target.value)} placeholder="Anything else for the team…" className="min-h-[70px]" /></div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Summary sidebar */}
        <Card className="lg:sticky lg:top-4">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base text-sky-700"><Info className="h-4 w-4" /> Quick Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Order Type</p><p className="font-semibold">{ORDER_TYPES.find((o) => o.value === orderType)?.label}</p></div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Services ({selectedServices.length})</p>
              {selectedServices.length === 0 ? <p className="text-muted-foreground text-xs">None</p> : <ul className="space-y-0.5">{selectedServices.map((s) => <li key={s.id} className="text-sm">• {s.name}</li>)}</ul>}
            </div>
            <Separator />
            <div><p className="text-xs text-muted-foreground">Est. Delivery</p><p className="font-semibold">{expectedDelivery ? fmtDateTime(expectedDelivery) : "—"}</p></div>
            <Separator />
            <div><p className="text-xs text-muted-foreground">Pickup</p><p className="font-semibold">{isPickup ? (pickupDate || "Scheduled") : "Not Applicable"}</p></div>
            <Separator />
            <div><p className="text-xs text-muted-foreground">Payment Pref.</p><p className="font-semibold">{PAYMENT_PREFERENCES.find((p) => p.value === paymentPreference)?.label}</p></div>
            <Separator />
            <div><p className="text-xs text-muted-foreground">Order Status</p><Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Pending Store Audit</Badge></div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 mt-5">
        <Button variant="outline" onClick={() => handleSubmit("draft")} disabled={submitting}><Save className="h-4 w-4 mr-2" /> Save Draft</Button>
        <Button onClick={() => handleSubmit("create")} disabled={submitting} className="bg-sky-600 hover:bg-sky-700 text-white">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Create Order</Button>
        <Button onClick={() => handleSubmit("audit")} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white"><ArrowRight className="h-4 w-4 mr-2" /> Create Order &amp; Start Audit</Button>
      </div>
    </div>
  )
}
