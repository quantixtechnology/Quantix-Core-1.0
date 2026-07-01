"use client"

// New Laundry Order — enterprise reference layout. Order intake at the store
// counter: customer, order type, services and logistics → creates the order in
// PENDING_STORE_AUDIT. Garment counting / final bill happen at Store Audit, so
// amounts read "Pending Audit". Services load from the Services master. Uses
// only the existing order/customer/upload APIs; no workflow/billing changes.

import { useState, useEffect, useMemo } from "react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Search, UserPlus, User, Phone, MapPin, Clock, CreditCard, Store as StoreIcon,
  FileText, Save, Send, ArrowRight, Loader2, ShoppingBag, CheckCircle2,
  Hash, Calendar, UserCircle, Trash2, Plus, WashingMachine, Info, X,
  Wallet, BadgeCheck, Crown, ImagePlus, Upload, Truck, Paperclip,
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
const turnaroundClass = (h: number) => (h <= 0 ? "text-slate-500" : h <= 12 ? "text-sky-600" : h <= 24 ? "text-emerald-600" : "text-amber-600")
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
  const [attachments, setAttachments] = useState<{ url: string; kind: string }[]>([])
  const [uploading, setUploading] = useState<string | null>(null)

  const [stores, setStores] = useState<StoreInfo[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const isPickup = orderType === "HOME_PICKUP"
  const selectedStore = stores.find((s) => s.id === selectedStoreId)

  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/businesses/${currentBusinessId}`)
      .then((r) => r.json())
      .then((biz) => { if (biz.stores?.length) { setStores(biz.stores); setSelectedStoreId((p) => p || biz.stores[0].id) } })
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
        body: JSON.stringify({ businessId: currentBusinessId, name: newCustName, mobile: newCustMobile, alternateMobile: newCustAltMobile, email: newCustEmail, address: newCustAddress, area: newCustArea, landmark: newCustLandmark }),
      })
      const json = await res.json()
      if (res.status === 409 && json.data) { setSelectedCustomer({ ...json.data, addresses: [] }); toast({ title: "Customer Exists", description: "Using existing customer record" }); return }
      if (!json.success) { toast({ title: "Error", description: json.error || "Failed to create customer", variant: "destructive" }); return }
      const c = json.data
      setSelectedCustomer({ id: c.id, name: c.name, phone: c.phone, email: c.email, loyaltyTier: c.loyaltyTier || "BRONZE", walletBalance: c.walletBalance || 0, customerCode: c.customerCode, totalOrders: c.totalOrders || 0, addresses: [] })
      toast({ title: "Customer Created", description: `${c.name} saved successfully` })
    } catch { toast({ title: "Error", description: "Failed to create customer", variant: "destructive" }) }
  }

  const handleUpload = async (kind: string, files: FileList | null) => {
    if (!files?.length || !currentBusinessId) return
    setUploading(kind)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append("file", file); fd.append("businessId", currentBusinessId); fd.append("type", "document")
        const res = await fetch("/api/uploads", { method: "POST", body: fd })
        const json = await res.json()
        const url = json?.data?.url || json?.data?.uploadPath || json?.url
        if (json.success && url) setAttachments((p) => [...p, { url, kind }])
        else toast({ title: "Upload failed", description: json.error || "Try again", variant: "destructive" })
      }
    } catch { toast({ title: "Upload failed", variant: "destructive" }) } finally { setUploading(null) }
  }

  const specialInstructions = useMemo(() => [...quickNotes, otherInstructions.trim()].filter(Boolean).join("; "), [quickNotes, otherInstructions])

  const handleSubmit = async (action: "create" | "draft" | "audit") => {
    if (!currentBusinessId || !selectedStoreId) { toast({ title: "Error", description: "No business or store selected", variant: "destructive" }); return }
    if (!selectedCustomer) { toast({ title: "Error", description: "Select or create a customer first", variant: "destructive" }); return }
    if (selectedServices.length === 0) { toast({ title: "Error", description: "Select at least one service", variant: "destructive" }); return }
    setSubmitting(true)
    try {
      const payload = {
        businessId: currentBusinessId, storeId: selectedStoreId, customerId: selectedCustomer.id, orderType,
        services: selectedServices.map((s) => ({ serviceId: s.id, serviceName: s.name, turnaroundHours: s.defaultTurnaroundHours })),
        isExpress: quickNotes.includes("Express Delivery"),
        expectedDeliveryDate: expectedDelivery ? expectedDelivery.toISOString().split("T")[0] : null,
        deliveryOverride: overrideDelivery, overrideReason: overrideDelivery ? overrideReason : null,
        paymentPreference,
        pickupDate: isPickup ? pickupDate : null, pickupTimeSlot: isPickup ? pickupTimeSlot : null,
        pickupAddress: isPickup ? pickupAddress : null, pickupInstructions: isPickup ? pickupInstructions : null,
        specialInstructions, notes: null, createdBy: user?.name || "counter",
      }
      const res = await fetch("/api/laundry/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!json.success) { toast({ title: "Error", description: json.error || "Failed to create order", variant: "destructive" }); return }
      toast({ title: "Order Created", description: `Order ${json.data.orderNumber} is now Pending Store Audit` })
      setLaundryPage(action === "audit" ? "audit-queue" : "orders")
    } catch { toast({ title: "Error", description: "Failed to create order", variant: "destructive" }) } finally { setSubmitting(false) }
  }

  const tierBadge = (tier: string) => {
    const t = (tier || "").toUpperCase()
    if (t === "GOLD") return { label: "Gold Member", cls: "border-amber-300 text-amber-700 bg-amber-50" }
    if (t === "PLATINUM") return { label: "Platinum Member", cls: "border-violet-300 text-violet-700 bg-violet-50" }
    if (t === "SILVER") return { label: "Silver Member", cls: "border-slate-300 text-slate-600 bg-slate-50" }
    return { label: `${tier || "Bronze"} Member`, cls: "border-orange-300 text-orange-700 bg-orange-50" }
  }

  const InfoCell = ({ icon: Icon, label, value, sub }: { icon: typeof Hash; label: string; value: string; sub?: string }) => (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 shrink-0"><Icon className="h-5 w-5" /></div>
      <div className="min-w-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className="text-sm font-semibold truncate">{value}</p>{sub && <p className="text-[11px] text-sky-600 truncate">{sub}</p>}</div>
    </div>
  )

  return (
    <div className="px-4 lg:px-6 py-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white"><ShoppingBag className="h-4.5 w-4.5" /></div>
        <h1 className="text-xl font-bold tracking-tight">New Laundry Order</h1>
      </div>

      {/* Info strip */}
      <Card className="mb-5 shadow-sm">
        <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-5 p-5">
          <InfoCell icon={Hash} label="Order No." value="ORD — Auto" sub="Auto Generated" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 shrink-0"><StoreIcon className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground">Store</p>
              {stores.length > 1 ? (
                <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                  <SelectTrigger className="h-7 px-0 text-sm font-semibold border-0 shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.storeName}</SelectItem>)}</SelectContent>
                </Select>
              ) : (<><p className="text-sm font-semibold truncate">{selectedStore?.storeName || "—"}</p>{selectedStore?.city && <p className="text-[11px] text-sky-600">{selectedStore.city}</p>}</>)}
            </div>
          </div>
          <InfoCell icon={Calendar} label="Date & Time" value={fmtDateTime(now)} />
          <InfoCell icon={UserCircle} label="Executive Name" value={user?.name || "—"} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5 items-start">
        <div className="space-y-5">
          {/* Customer Information */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b"><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4 text-sky-600" /> Customer Information</CardTitle></CardHeader>
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Existing */}
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-sky-700">Existing Customer</p>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Search by:</p>
                    <RadioGroup value={searchBy} onValueChange={setSearchBy} className="flex flex-wrap gap-4">
                      {[["mobile", "Mobile Number"], ["name", "Customer Name"], ["id", "Customer ID"]].map(([v, l]) => (
                        <div key={v} className="flex items-center space-x-1.5"><RadioGroupItem value={v} id={`sb-${v}`} /><Label htmlFor={`sb-${v}`} className="text-xs cursor-pointer">{l}</Label></div>
                      ))}
                    </RadioGroup>
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Enter search value…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
                    <Button onClick={handleSearch} disabled={searching} className="gap-1 bg-sky-600 hover:bg-sky-700 text-white shrink-0">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search</Button>
                  </div>

                  {selectedCustomer ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium"><CheckCircle2 className="h-4 w-4" /> Customer Found</div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-sky-700 font-semibold shrink-0">{selectedCustomer.name.slice(0, 2).toUpperCase()}</div>
                          <div className="space-y-0.5">
                            <p className="font-semibold">{selectedCustomer.name}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedCustomer.phone || "—"}</p>
                            {selectedCustomer.addresses?.[0] && <p className="text-xs text-muted-foreground flex items-start gap-1"><MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {selectedCustomer.addresses[0].addressLine1}, {selectedCustomer.addresses[0].city}</p>}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedCustomer(null)}><X className="h-4 w-4" /></Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-t border-emerald-200/70 pt-3">
                        <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Membership</p><Badge variant="outline" className={`mt-1 text-[11px] gap-1 ${tierBadge(selectedCustomer.loyaltyTier).cls}`}><Crown className="h-3 w-3" />{tierBadge(selectedCustomer.loyaltyTier).label}</Badge></div>
                        <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Subscription</p><Badge variant="outline" className="mt-1 text-[11px] gap-1 border-sky-300 text-sky-700 bg-sky-50"><BadgeCheck className="h-3 w-3" />Active</Badge></div>
                        <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Wallet</p><p className="mt-1 text-sm font-semibold flex items-center gap-1"><Wallet className="h-3.5 w-3.5 text-emerald-600" />₹{selectedCustomer.walletBalance.toFixed(2)}</p></div>
                      </div>
                    </div>
                  ) : customers.length > 0 ? (
                    <ScrollArea className="max-h-48 border rounded-lg">
                      {customers.map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-0" onClick={() => setSelectedCustomer(c)}>
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
                  <div className="space-y-1"><Label className="text-xs">Customer Name *</Label><Input value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Enter customer name" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Mobile Number *</Label><Input value={newCustMobile} onChange={(e) => setNewCustMobile(e.target.value)} placeholder="Enter mobile number" /></div>
                    <div className="space-y-1"><Label className="text-xs">Alternate Mobile</Label><Input value={newCustAltMobile} onChange={(e) => setNewCustAltMobile(e.target.value)} placeholder="Enter alternate mobile" /></div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} placeholder="Enter email" /></div>
                  <div className="space-y-1"><Label className="text-xs">Address *</Label><Input value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)} placeholder="Enter address" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Area *</Label><Input value={newCustArea} onChange={(e) => setNewCustArea(e.target.value)} placeholder="Enter area" /></div>
                    <div className="space-y-1"><Label className="text-xs">Landmark</Label><Input value={newCustLandmark} onChange={(e) => setNewCustLandmark(e.target.value)} placeholder="Enter landmark" /></div>
                  </div>
                  <Button onClick={handleCreateCustomer} className="w-full gap-1 bg-sky-600 hover:bg-sky-700 text-white"><UserPlus className="h-4 w-4" /> Save Customer &amp; Continue</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Type + Services */}
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b"><CardTitle className="flex items-center gap-2 text-base"><ShoppingBag className="h-4 w-4 text-sky-600" /> Order Type</CardTitle></CardHeader>
              <CardContent className="pt-4">
                <RadioGroup value={orderType} onValueChange={setOrderType} className="space-y-3">
                  {ORDER_TYPES.map((ot) => (
                    <div key={ot.value} className="flex items-center space-x-2"><RadioGroupItem value={ot.value} id={`ot-${ot.value}`} /><Label htmlFor={`ot-${ot.value}`} className="text-sm cursor-pointer">{ot.label}</Label></div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2"><WashingMachine className="h-4 w-4 text-sky-600" /> Service Selection <span className="text-xs font-normal text-muted-foreground">(Select multiple services)</span></span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
                  <div className="rounded-lg border overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-slate-50 border-b"><span>Service</span><span>Estimated Turnaround</span></div>
                    {availableServices.length === 0 ? (
                      <p className="px-3 py-6 text-sm text-muted-foreground text-center">No services configured.</p>
                    ) : availableServices.map((s) => (
                      <label key={s.id} className={`grid grid-cols-[1fr_auto] items-center px-3 py-2.5 cursor-pointer border-b last:border-0 transition-colors ${selectedServiceIds.includes(s.id) ? "bg-sky-50/60" : "hover:bg-muted/30"}`}>
                        <span className="flex items-center gap-2.5"><Checkbox checked={selectedServiceIds.includes(s.id)} onCheckedChange={() => toggleService(s.id)} /><span className="text-sm">{s.name}</span></span>
                        <span className={`text-xs font-medium ${turnaroundClass(s.defaultTurnaroundHours)}`}>{turnaroundLabel(s.defaultTurnaroundHours)}</span>
                      </label>
                    ))}
                  </div>
                  <div className="rounded-lg border bg-slate-50/60 p-3">
                    <p className="text-sm font-semibold mb-2">Selected Services ({selectedServices.length})</p>
                    {selectedServices.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None selected yet.</p>
                    ) : (
                      <ol className="space-y-1.5">
                        {selectedServices.map((s, i) => (
                          <li key={s.id} className="flex items-center justify-between text-sm bg-white rounded-md border px-2 py-1"><span>{i + 1}. {s.name}</span><button className="text-muted-foreground hover:text-destructive" onClick={() => toggleService(s.id)}><Trash2 className="h-3.5 w-3.5" /></button></li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Expected Delivery + Pickup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b"><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-sky-600" /> Expected Delivery</CardTitle></CardHeader>
              <CardContent className="pt-4 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Order Created</span><span className="font-medium">{fmtDateTime(now)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Estimated Delivery</span><span className="text-emerald-600 font-semibold">{expectedDelivery ? fmtDateTime(expectedDelivery) : "Select services"}</span></div>
                <p className="text-[11px] text-muted-foreground -mt-1">(Based on max. turnaround time)</p>
                <div className="flex items-center gap-4 pt-1"><span className="text-muted-foreground">Override Allowed</span>
                  <div className="flex items-center gap-2"><Switch checked={overrideDelivery} onCheckedChange={setOverrideDelivery} /><span className="text-xs">{overrideDelivery ? "Yes" : "No"}</span></div>
                </div>
                {overrideDelivery && (
                  <div className="space-y-2 pt-1">
                    <Input type="date" value={customDeliveryDate} onChange={(e) => setCustomDeliveryDate(e.target.value)} />
                    <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Reason (required if overridden)" className="min-h-[60px]" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={`shadow-sm ${isPickup ? "" : "opacity-70"}`}>
              <CardHeader className="pb-3 border-b"><CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4 text-sky-600" /> Pickup Details <span className="text-xs font-normal text-muted-foreground">(Only for Pickup Orders)</span></CardTitle></CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Pickup Date</Label><Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} disabled={!isPickup} /></div>
                  <div className="space-y-1"><Label className="text-xs">Pickup Time Slot</Label>
                    <Select value={pickupTimeSlot} onValueChange={setPickupTimeSlot} disabled={!isPickup}><SelectTrigger><SelectValue placeholder="Select slot" /></SelectTrigger>
                      <SelectContent>{PICKUP_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                  </div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Pickup Address</Label><Input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} disabled={!isPickup} placeholder="Enter pickup address" /></div>
                <div className="space-y-1"><Label className="text-xs">Special Instructions</Label><Input value={pickupInstructions} onChange={(e) => setPickupInstructions(e.target.value)} disabled={!isPickup} placeholder="e.g. Call before arrival" /></div>
              </CardContent>
            </Card>
          </div>

          {/* Summary + Payment + Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-sky-600" /> Order Summary</CardTitle></CardHeader>
              <CardContent className="pt-4">
                <div className="rounded-lg border overflow-hidden text-xs">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 font-semibold text-muted-foreground bg-slate-50 border-b"><span>Service</span><span>Qty</span><span>Est. Value</span></div>
                  {selectedServices.length === 0 ? <p className="px-3 py-4 text-muted-foreground text-center">No services selected</p> : selectedServices.map((s) => (
                    <div key={s.id} className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 border-b last:border-0"><span>{s.name}</span><span className="text-muted-foreground">Pending</span><span className="text-muted-foreground">₹0</span></div>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="font-medium">Total Items</span><span className="text-amber-600 font-medium">Pending Audit</span></div>
                  <div className="flex justify-between"><span className="font-medium">Estimated Amount</span><span className="text-amber-600 font-semibold">Pending Audit</span></div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b"><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4 text-sky-600" /> Payment Preference</CardTitle></CardHeader>
              <CardContent className="pt-4">
                <RadioGroup value={paymentPreference} onValueChange={setPaymentPreference} className="space-y-2.5">
                  {PAYMENT_PREFERENCES.map((p) => (
                    <div key={p.value} className="flex items-center space-x-2"><RadioGroupItem value={p.value} id={`pp-${p.value}`} /><Label htmlFor={`pp-${p.value}`} className="text-sm cursor-pointer">{p.label}</Label></div>
                  ))}
                </RadioGroup>
                <p className="mt-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-[11px] text-amber-700 text-center">Note: Payment will be collected after Store Audit.</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b"><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-sky-600" /> Notes / Special Instructions</CardTitle></CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-2.5">
                  {QUICK_NOTES.map((n) => (
                    <label key={n} className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={quickNotes.includes(n)} onCheckedChange={() => setQuickNotes((p) => p.includes(n) ? p.filter((x) => x !== n) : [...p, n])} /> {n}</label>
                  ))}
                </div>
                <div className="space-y-1"><Label className="text-xs">Other Instructions</Label><Textarea value={otherInstructions} onChange={(e) => setOtherInstructions(e.target.value)} placeholder="Anything else for the team…" className="min-h-[70px]" /></div>
              </CardContent>
            </Card>
          </div>

          {/* Attachments */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b"><CardTitle className="flex items-center gap-2 text-base"><Paperclip className="h-4 w-4 text-sky-600" /> Attachments <span className="text-xs font-normal text-muted-foreground">(Optional)</span></CardTitle></CardHeader>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-3">Upload images (if any)</p>
              <div className="flex flex-wrap items-center gap-3">
                {[{ kind: "garment", label: "Upload Garment Photos", icon: ImagePlus }, { kind: "pickup", label: "Upload Pickup Photo", icon: Truck }, { kind: "other", label: "Upload Other Files", icon: Upload }].map((u) => (
                  <label key={u.kind} className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-sm cursor-pointer text-sky-700 hover:bg-sky-50">
                    {uploading === u.kind ? <Loader2 className="h-4 w-4 animate-spin" /> : <u.icon className="h-4 w-4" />} {u.label}
                    <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => handleUpload(u.kind, e.target.files)} />
                  </label>
                ))}
                <span className="text-[11px] text-muted-foreground ml-auto">Supports: JPG, PNG, PDF (Max 5MB each)</span>
              </div>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {attachments.map((a, i) => (
                    <div key={i} className="relative h-16 w-16 rounded-lg border overflow-hidden group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt={a.kind} className="h-full w-full object-cover" />
                      <button onClick={() => setAttachments((p) => p.filter((_, x) => x !== i))} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 opacity-0 group-hover:opacity-100"><X className="h-3 w-3 text-white" /></button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Summary sidebar */}
        <Card className="shadow-sm xl:sticky xl:top-4">
          <CardHeader className="pb-3 border-b"><CardTitle className="flex items-center gap-2 text-base text-sky-700"><Info className="h-4 w-4" /> Quick Summary</CardTitle></CardHeader>
          <CardContent className="pt-4 space-y-3.5 text-sm">
            <div><p className="text-xs text-muted-foreground">Order Type</p><p className="font-semibold">{ORDER_TYPES.find((o) => o.value === orderType)?.label}</p></div>
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-1">Services ({selectedServices.length})</p>
              {selectedServices.length === 0 ? <p className="text-muted-foreground text-xs">None</p> : <ul className="space-y-1">{selectedServices.map((s) => <li key={s.id} className="text-sm flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sky-500" />{s.name}</li>)}</ul>}
            </div>
            <div className="border-t pt-3"><p className="text-xs text-muted-foreground">Est. Delivery</p><p className="font-semibold">{expectedDelivery ? fmtDateTime(expectedDelivery) : "—"}</p></div>
            <div className="border-t pt-3"><p className="text-xs text-muted-foreground">Pickup</p><p className="font-semibold">{isPickup ? (pickupDate || "Scheduled") : "Not Applicable"}</p></div>
            <div className="border-t pt-3"><p className="text-xs text-muted-foreground">Payment Pref.</p><p className="font-semibold">{PAYMENT_PREFERENCES.find((p) => p.value === paymentPreference)?.label}</p></div>
            <div className="border-t pt-3"><p className="text-xs text-muted-foreground">Order Status</p><Badge variant="outline" className="mt-1 border-amber-300 text-amber-700 bg-amber-50">Pending Store Audit</Badge></div>
          </CardContent>
        </Card>
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 mt-5 -mx-4 lg:-mx-6 border-t bg-background/95 backdrop-blur px-4 lg:px-6 py-3">
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => handleSubmit("draft")} disabled={submitting}><Save className="h-4 w-4 mr-2" /> Save Draft</Button>
          <Button onClick={() => handleSubmit("create")} disabled={submitting} className="bg-sky-600 hover:bg-sky-700 text-white">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Create Order</Button>
          <Button onClick={() => handleSubmit("audit")} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white"><ArrowRight className="h-4 w-4 mr-2" /> Create Order &amp; Start Audit</Button>
        </div>
      </div>
    </div>
  )
}
