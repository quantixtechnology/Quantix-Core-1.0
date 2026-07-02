"use client"

// New Laundry Order — enterprise reference layout (presentation layer only;
// no workflow/API/schema/pricing changes). Order intake at the store counter:
// customer, order type, services and logistics → creates the order in
// PENDING_STORE_AUDIT. Garment counting / final bill happen at Store Audit, so
// amounts read "Pending Audit". Services load from the Services master.

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  Search, UserPlus, User, Phone, MapPin, Clock, CreditCard, Store as StoreIcon,
  FileText, Save, Send, ArrowRight, Loader2, ShoppingBag, ShoppingCart, CheckCircle2,
  Hash, Calendar, UserCircle, Trash2, Info, X, Shirt, Plus, Minus,
  Wallet, BadgeCheck, Crown, ImagePlus, Upload, Truck, Paperclip, Building2,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "./pricing/searchable-select"
import { INDIAN_STATES, isValidPincode, formatAddressLines } from "@/lib/india"

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

interface AddressRow { addressLine1?: string | null; addressLine2?: string | null; area?: string | null; landmark?: string | null; city?: string | null; state?: string | null; pincode?: string | null; country?: string | null }
interface CustomerResult {
  id: string; name: string; phone: string | null; email: string | null
  loyaltyTier: string; walletBalance: number; customerCode: string | null
  totalOrders: number; addresses: AddressRow[]
}
interface ServiceMaster {
  id: string; name: string; defaultTurnaroundHours: number
  availableInStore: boolean; availableForPickup: boolean; isActive: boolean
}
interface GarmentMaster { id: string; name: string; categoryId: string | null; defaultUnit: string; isActive: boolean }
interface LineItem { uid: string; garmentId: string; serviceId: string; quantity: number }
interface StoreInfo { id: string; storeName: string; city?: string | null }
const inr = (n: number) => `₹${(n || 0).toFixed(2)}`

const turnaroundLabel = (h: number) => (h <= 0 ? "Custom" : h <= 12 ? "Same Day" : `${h} Hours`)
const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
const fmtDateTime = (d: Date) => `${fmtDate(d)} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`

export default function LaundryNewOrder() {
  const { currentBusinessId, user } = useAuthStore()
  const { setLaundryPage } = useAdminStore()
  const { toast } = useToast()
  const now = useMemo(() => new Date(), [])

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
  const [newCustAddress2, setNewCustAddress2] = useState("")
  const [newCustArea, setNewCustArea] = useState("")
  const [newCustLandmark, setNewCustLandmark] = useState("")
  const [newCustCity, setNewCustCity] = useState("")
  const [newCustState, setNewCustState] = useState("")
  const [newCustPincode, setNewCustPincode] = useState("")

  const [orderType, setOrderType] = useState("WALK_IN")
  const [services, setServices] = useState<ServiceMaster[]>([])
  const [garments, setGarments] = useState<GarmentMaster[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [seeding, setSeeding] = useState(false)
  // Add-Garment modal
  const [addOpen, setAddOpen] = useState(false)
  const [mGarment, setMGarment] = useState("")
  const [mService, setMService] = useState("")
  const [mQty, setMQty] = useState(1)
  const [mPrice, setMPrice] = useState<number | null>(null)
  const [mPricing, setMPricing] = useState(false)
  // live quote for the whole order
  const [quote, setQuote] = useState<{ grandTotal: number; lines: { lineTotal: number; matchedRuleId: string | null }[] } | null>(null)
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
  const [creatingCust, setCreatingCust] = useState(false)

  const [stores, setStores] = useState<StoreInfo[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const isPickup = orderType === "HOME_PICKUP"
  const selectedStore = stores.find((s) => s.id === selectedStoreId)

  const loadMasters = useCallback(async () => {
    if (!currentBusinessId) return { svc: 0, grm: 0 }
    const [svcJson, grmJson] = await Promise.all([
      fetch(`/api/laundry/services?businessId=${currentBusinessId}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/laundry/garments?businessId=${currentBusinessId}`).then((r) => r.json()).catch(() => ({})),
    ])
    const svc = svcJson.success ? (svcJson.data as ServiceMaster[]).filter((s) => s.isActive) : []
    const grm = grmJson.success ? (grmJson.data as GarmentMaster[]).filter((g) => g.isActive) : []
    setServices(svc); setGarments(grm)
    return { svc: svc.length, grm: grm.length }
  }, [currentBusinessId])

  const seededRef = useRef(false)
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/businesses/${currentBusinessId}`).then((r) => r.json())
      .then((biz) => { if (biz.stores?.length) { setStores(biz.stores); setSelectedStoreId((p) => p || biz.stores[0].id) } }).catch(() => {})
    loadMasters().then(async ({ svc, grm }) => {
      // Auto-seed demo masters once if the workspace has none (removes the
      // "No services configured" blocker). Idempotent server-side.
      if ((svc === 0 || grm === 0) && !seededRef.current) {
        seededRef.current = true
        setSeeding(true)
        try {
          await fetch("/api/laundry/seed-demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId }) })
          await loadMasters()
        } catch { /* noop */ } finally { setSeeding(false) }
      }
    })
  }, [currentBusinessId, loadMasters])

  const availableServices = useMemo(() => services.filter((s) => (isPickup ? s.availableForPickup : s.availableInStore)), [services, isPickup])
  const svcById = useCallback((id: string) => services.find((s) => s.id === id), [services])
  const grmById = useCallback((id: string) => garments.find((g) => g.id === id), [garments])
  // Distinct services used across the order's line items (drives TAT + records).
  const selectedServices = useMemo(() => {
    const ids = [...new Set(lineItems.map((l) => l.serviceId))]
    return ids.map((id) => services.find((s) => s.id === id)).filter(Boolean) as ServiceMaster[]
  }, [lineItems, services])

  const maxTat = useMemo(() => {
    const hrs = selectedServices.map((s) => s.defaultTurnaroundHours).filter((h) => h > 0)
    const base = hrs.length ? Math.max(...hrs) : 0
    return quickNotes.includes("Express Delivery") && base > 0 ? Math.max(4, Math.round(base / 2)) : base
  }, [selectedServices, quickNotes])

  const customerType = useMemo(() => (orderType === "CORPORATE" ? "CORPORATE" : orderType === "SUBSCRIPTION" ? "SUBSCRIPTION" : orderType === "HOME_PICKUP" ? "PICKUP" : "WALK_IN"), [orderType])
  const totalPieces = useMemo(() => lineItems.reduce((s, l) => s + l.quantity, 0), [lineItems])

  // ── Live billing for the whole order (Pricing Engine; never hardcoded) ──
  const quoteKey = JSON.stringify({ items: lineItems.map((l) => [l.serviceId, l.garmentId, l.quantity]), storeId: selectedStoreId, customerType })
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!currentBusinessId || lineItems.length === 0) { setQuote(null); return }
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
    quoteTimer.current = setTimeout(async () => {
      try {
        const items = lineItems.map((l) => ({ serviceId: l.serviceId, garmentId: l.garmentId, categoryId: grmById(l.garmentId)?.categoryId || null, quantity: l.quantity }))
        const res = await fetch("/api/laundry/billing/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, storeId: selectedStoreId || null, customerType, items }) })
        const json = await res.json(); setQuote(json.success ? json.data : null)
      } catch { setQuote(null) }
    }, 250)
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, currentBusinessId])

  const lineAmount = (uid: string) => { const idx = lineItems.findIndex((l) => l.uid === uid); return idx >= 0 && quote ? quote.lines[idx]?.lineTotal ?? null : null }
  const grandTotal = quote?.grandTotal ?? 0

  // ── Add-Garment modal: live single-line price ──
  useEffect(() => {
    if (!addOpen || !mGarment || !mService || !currentBusinessId) { setMPrice(null); return }
    setMPricing(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/laundry/billing/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, storeId: selectedStoreId || null, customerType, items: [{ serviceId: mService, garmentId: mGarment, categoryId: grmById(mGarment)?.categoryId || null, quantity: mQty || 1 }] }) })
        const json = await res.json(); setMPrice(json.success ? json.data.grandTotal : null)
      } catch { setMPrice(null) } finally { setMPricing(false) }
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOpen, mGarment, mService, mQty, currentBusinessId, selectedStoreId, customerType])

  const openAddGarment = () => { setMGarment(""); setMService(availableServices[0]?.id || ""); setMQty(1); setMPrice(null); setAddOpen(true) }
  const confirmAddGarment = () => {
    if (!mGarment || !mService) { toast({ title: "Select garment & service", variant: "destructive" }); return }
    setLineItems((p) => [...p, { uid: `L${Date.now()}${p.length}`, garmentId: mGarment, serviceId: mService, quantity: Math.max(1, mQty || 1) }])
    setAddOpen(false)
  }
  const removeLine = (uid: string) => setLineItems((p) => p.filter((l) => l.uid !== uid))
  const setLineQty = (uid: string, q: number) => setLineItems((p) => p.map((l) => (l.uid === uid ? { ...l, quantity: Math.max(1, q) } : l)))

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
      const json = await res.json(); setCustomers(json.success ? json.data : [])
    } catch { setCustomers([]) } finally { setSearching(false) }
  }

  const handleCreateCustomer = async () => {
    if (!currentBusinessId) { toast({ title: "No workspace selected", description: "Reopen the laundry workspace and try again.", variant: "destructive" }); return }
    if (!newCustName.trim() || !newCustMobile.trim()) { toast({ title: "Error", description: "Name and Mobile are required", variant: "destructive" }); return }
    // India address — required fields (per the * marks) must be complete.
    const missing = [
      !newCustAddress.trim() && "Address Line 1", !newCustArea.trim() && "Area / Locality",
      !newCustCity.trim() && "City / District", !newCustState.trim() && "State", !newCustPincode.trim() && "PIN Code",
    ].filter(Boolean)
    if (missing.length) { toast({ title: "Complete the address", description: `Required: ${missing.join(", ")}`, variant: "destructive" }); return }
    if (!isValidPincode(newCustPincode)) { toast({ title: "Invalid PIN Code", description: "PIN Code must be a 6-digit Indian pincode", variant: "destructive" }); return }
    const addressPayload: AddressRow = { addressLine1: newCustAddress, addressLine2: newCustAddress2, area: newCustArea, landmark: newCustLandmark, city: newCustCity, state: newCustState, pincode: newCustPincode, country: "India" }
    const resetForm = () => { setNewCustName(""); setNewCustMobile(""); setNewCustAltMobile(""); setNewCustEmail(""); setNewCustAddress(""); setNewCustAddress2(""); setNewCustArea(""); setNewCustLandmark(""); setNewCustCity(""); setNewCustState(""); setNewCustPincode(""); setCustomers([]) }
    const mobile = newCustMobile
    const payload = { businessId: currentBusinessId, name: newCustName, mobile, alternateMobile: newCustAltMobile, email: newCustEmail, ...addressPayload }
    // ── Production instrumentation (open DevTools console to read the trace) ──
    console.group("%c[Save Customer & Continue]", "color:#2563eb;font-weight:bold")
    console.log("1. payload", payload)
    console.log("2/3. tenantId/workspaceId (currentBusinessId)", currentBusinessId)
    console.log("4. authenticated user", user)
    console.log("5. request URL", "/api/laundry/customers")
    setCreatingCust(true)
    try {
      const res = await fetch("/api/laundry/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      console.log("6. response status", res.status)
      const json = await res.json().catch(() => ({}))
      console.log("7. response body", json)
      if (res.status === 409 && json.data) {
        const c = json.data
        console.log("8. existing customer id (409)", c.id)
        setSelectedCustomer({ id: c.id, name: c.name, phone: c.phone, email: c.email, loyaltyTier: c.loyaltyTier || "BRONZE", walletBalance: c.walletBalance || 0, customerCode: c.customerCode, totalOrders: c.totalOrders || 0, addresses: [addressPayload] })
        resetForm(); toast({ title: "Customer Exists", description: "Loaded the existing customer for this order." }); console.groupEnd(); return
      }
      if (!res.ok || !json.success) {
        console.error("SAVE FAILED at API layer:", res.status, json.error)
        toast({ title: "Could not save customer", description: `${json.error || "Failed to create customer"} (HTTP ${res.status})`, variant: "destructive" }); console.groupEnd(); return
      }
      const c = json.data
      console.log("8. created customer id", c.id, "| code", c.customerCode)

      // 9/10/11. Immediately re-query via the SAME tenant + search endpoint to
      // prove the write is visible to reads (same DB/tenant/filters).
      let appears = false
      try {
        const vr = await fetch(`/api/laundry/customers/search?businessId=${encodeURIComponent(currentBusinessId)}&q=${encodeURIComponent(mobile)}`)
        const vj = await vr.json().catch(() => ({}))
        appears = !!(vj.data || []).find((x: { id: string }) => x.id === c.id)
        console.log("10/11. search re-query via same tenant → appears?", appears, "| results", vj.data?.length)
      } catch (e) { console.warn("verification search failed", e) }

      // 12. Auto-select in the Existing Customer panel.
      setSelectedCustomer({ id: c.id, name: c.name, phone: c.phone, email: c.email, loyaltyTier: c.loyaltyTier || "BRONZE", walletBalance: c.walletBalance || 0, customerCode: c.customerCode, totalOrders: c.totalOrders || 0, addresses: [addressPayload] })
      resetForm()
      toast({ title: "Customer Saved", description: appears ? `${c.name} (${c.customerCode}) — verified in search.` : `${c.name} (${c.customerCode}) saved. ⚠ not returned by search — check tenant.`, variant: appears ? undefined : "destructive" })
    } catch (e) {
      console.error("SAVE FAILED (network/exception)", e)
      toast({ title: "Error", description: "Network error — customer not saved.", variant: "destructive" })
    } finally { setCreatingCust(false); console.groupEnd() }
  }

  const handleUpload = async (kind: string, files: FileList | null) => {
    if (!files?.length || !currentBusinessId) return
    setUploading(kind)
    try {
      for (const file of Array.from(files)) {
        const category = kind === "garment" ? "garments" : kind === "pickup" ? "delivery" : "documents"
        const fd = new FormData(); fd.append("file", file); fd.append("businessId", currentBusinessId); fd.append("type", "document"); fd.append("category", category)
        const res = await fetch("/api/uploads", { method: "POST", body: fd })
        const json = await res.json(); const url = json?.data?.url || json?.data?.uploadPath || json?.url
        if (json.success && url) setAttachments((p) => [...p, { url, kind }])
        else toast({ title: "Upload failed", description: json.error || "Try again", variant: "destructive" })
      }
    } catch { toast({ title: "Upload failed", variant: "destructive" }) } finally { setUploading(null) }
  }

  const specialInstructions = useMemo(() => [...quickNotes, otherInstructions.trim()].filter(Boolean).join("; "), [quickNotes, otherInstructions])

  const handleSubmit = async (action: "create" | "draft" | "audit") => {
    if (!currentBusinessId || !selectedStoreId) { toast({ title: "Error", description: "No business or store selected", variant: "destructive" }); return }
    if (!selectedCustomer) { toast({ title: "Error", description: "Select or create a customer first", variant: "destructive" }); return }
    if (lineItems.length === 0) { toast({ title: "Add a garment", description: "Add at least one garment to the order.", variant: "destructive" }); return }
    setSubmitting(true)
    try {
      const payload = {
        businessId: currentBusinessId, storeId: selectedStoreId, customerId: selectedCustomer.id, orderType,
        services: selectedServices.map((s) => ({ serviceId: s.id, serviceName: s.name, turnaroundHours: s.defaultTurnaroundHours })),
        items: lineItems.map((l) => ({ serviceId: l.serviceId, garmentId: l.garmentId, quantity: l.quantity })),
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

  const CardHead = ({ icon: Icon, title, note, right }: { icon: typeof User; title: string; note?: string; right?: React.ReactNode }) => (
    <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pt-5 pb-3.5">
      <CardTitle className="flex items-center gap-2 text-[15px] font-semibold text-slate-800"><Icon className="h-[18px] w-[18px] text-blue-600" /> {title}{note && <span className="text-xs font-normal text-slate-400">{note}</span>}</CardTitle>
      {right}
    </CardHeader>
  )
  const InfoCell = ({ icon: Icon, label, value, sub }: { icon: typeof Hash; label: string; value: string; sub?: string }) => (
    <div className="flex items-center gap-3 px-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0"><Icon className="h-5 w-5" /></div>
      <div className="min-w-0"><p className="text-[11px] text-slate-400">{label}</p><p className="text-sm font-semibold text-slate-800 truncate">{value}</p>{sub && <p className="text-[11px] text-blue-600 truncate">{sub}</p>}</div>
    </div>
  )

  return (
    <div className="min-h-full bg-[#eef2f7] px-4 lg:px-6 py-6">
      <div className="flex items-center gap-2 mb-5">
        <ShoppingCart className="h-6 w-6 text-blue-600" />
        <h1 className="text-xl font-bold tracking-tight text-slate-800">New Laundry Order</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5 items-start">
        {/* LEFT column */}
        <div className="space-y-5">
          {/* Info strip */}
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-y-4 p-0 py-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              <InfoCell icon={Hash} label="Order No." value="Auto Generated" />
              <div className="flex items-center gap-3 px-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0"><Building2 className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-400">Store</p>
                  {stores.length > 1 ? (
                    <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                      <SelectTrigger className="h-6 px-0 text-sm font-semibold text-slate-800 border-0 shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                      <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.storeName}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (<><p className="text-sm font-semibold text-slate-800 truncate">{selectedStore?.storeName || "—"}</p>{selectedStore?.city && <p className="text-[11px] text-blue-600">{selectedStore.city}</p>}</>)}
                </div>
              </div>
              <InfoCell icon={Calendar} label="Date & Time" value={fmtDateTime(now)} />
              <InfoCell icon={UserCircle} label="Executive Name" value={user?.name || "—"} />
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHead icon={User} title="Customer Information" />
            <CardContent className="px-5 pb-5 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-blue-700">Existing Customer</p>
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Search by:</p>
                    <RadioGroup value={searchBy} onValueChange={setSearchBy} className="flex flex-wrap gap-4">
                      {[["mobile", "Mobile Number"], ["name", "Customer Name"], ["id", "Customer ID"]].map(([v, l]) => (
                        <div key={v} className="flex items-center space-x-1.5"><RadioGroupItem value={v} id={`sb-${v}`} className="text-blue-600" /><Label htmlFor={`sb-${v}`} className="text-xs cursor-pointer">{l}</Label></div>
                      ))}
                    </RadioGroup>
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Enter search value…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="bg-slate-50 border-slate-200" />
                    <Button onClick={handleSearch} disabled={searching} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shrink-0">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search</Button>
                  </div>

                  {selectedCustomer ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium"><CheckCircle2 className="h-4 w-4" /> Customer Found</div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedCustomer(null)}><X className="h-4 w-4" /></Button>
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-4 mt-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-slate-600 font-semibold shrink-0">{selectedCustomer.name.slice(0, 2).toUpperCase()}</div>
                            <div className="space-y-0.5">
                              <p className="font-semibold text-slate-800 leading-tight">{selectedCustomer.name}</p>
                              <p className="text-sm text-slate-500">{selectedCustomer.phone || "—"}</p>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            {selectedCustomer.addresses?.[0] && formatAddressLines(selectedCustomer.addresses[0]).length > 0 && (<div><p className="text-slate-500 text-xs">Address</p><p className="text-slate-700 leading-snug whitespace-pre-line">{formatAddressLines(selectedCustomer.addresses[0]).join("\n")}</p></div>)}
                            <div><p className="text-slate-500 text-xs">Membership Status</p><Badge variant="outline" className="mt-0.5 text-[11px] gap-1 border-emerald-300 text-emerald-700 bg-emerald-50"><Crown className="h-3 w-3" />{selectedCustomer.loyaltyTier || "Bronze"} Member</Badge></div>
                            <div><p className="text-slate-500 text-xs">Subscription Status</p><Badge variant="outline" className="mt-0.5 text-[11px] gap-1 border-blue-300 text-blue-700 bg-blue-50"><BadgeCheck className="h-3 w-3" />Active</Badge></div>
                            <div><p className="text-slate-500 text-xs">Wallet Balance</p><p className="font-semibold text-emerald-600">₹{selectedCustomer.walletBalance.toFixed(2)}</p></div>
                          </div>
                        </div>
                      </div>
                      <Button onClick={() => handleSubmit("create")} disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">Create Order</Button>
                    </div>
                  ) : customers.length > 0 ? (
                    <ScrollArea className="max-h-48 border rounded-lg">
                      {customers.map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-0" onClick={() => setSelectedCustomer(c)}>
                          <div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-slate-500">{c.phone} {c.customerCode ? `• ${c.customerCode}` : ""}</p></div>
                          <Badge variant="secondary" className="text-[11px]">{c.loyaltyTier}</Badge>
                        </div>
                      ))}
                    </ScrollArea>
                  ) : null}
                </div>

                <div className="space-y-3 md:border-l md:pl-6 border-slate-100">
                  <p className="text-sm font-semibold text-blue-700">New Customer</p>
                  <div className="space-y-1"><Label className="text-xs text-slate-600">Customer Name *</Label><Input value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Enter customer name" className="bg-slate-50 border-slate-200" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs text-slate-600">Mobile Number *</Label><Input value={newCustMobile} onChange={(e) => setNewCustMobile(e.target.value)} placeholder="Enter mobile number" className="bg-slate-50 border-slate-200" /></div>
                    <div className="space-y-1"><Label className="text-xs text-slate-600">Alternate Mobile</Label><Input value={newCustAltMobile} onChange={(e) => setNewCustAltMobile(e.target.value)} placeholder="Enter alternate mobile" className="bg-slate-50 border-slate-200" /></div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs text-slate-600">Email</Label><Input value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} placeholder="Enter email" className="bg-slate-50 border-slate-200" /></div>
                  <div className="space-y-1"><Label className="text-xs text-slate-600">Address Line 1 *</Label><Input value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)} placeholder="House / Flat / Building" className="bg-slate-50 border-slate-200" /></div>
                  <div className="space-y-1"><Label className="text-xs text-slate-600">Address Line 2</Label><Input value={newCustAddress2} onChange={(e) => setNewCustAddress2(e.target.value)} placeholder="Street / Road (optional)" className="bg-slate-50 border-slate-200" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs text-slate-600">Area / Locality *</Label><Input value={newCustArea} onChange={(e) => setNewCustArea(e.target.value)} placeholder="Area / Locality" className="bg-slate-50 border-slate-200" /></div>
                    <div className="space-y-1"><Label className="text-xs text-slate-600">Landmark</Label><Input value={newCustLandmark} onChange={(e) => setNewCustLandmark(e.target.value)} placeholder="Landmark (optional)" className="bg-slate-50 border-slate-200" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs text-slate-600">City / District *</Label><Input value={newCustCity} onChange={(e) => setNewCustCity(e.target.value)} placeholder="City / District" className="bg-slate-50 border-slate-200" /></div>
                    <div className="space-y-1"><Label className="text-xs text-slate-600">State *</Label><SearchableSelect value={newCustState} onChange={setNewCustState} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} placeholder="Select state" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs text-slate-600">PIN Code *</Label><Input value={newCustPincode} inputMode="numeric" maxLength={6} onChange={(e) => setNewCustPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit PIN" className="bg-slate-50 border-slate-200" /></div>
                    <div className="space-y-1"><Label className="text-xs text-slate-600">Country</Label><Input value="India" disabled className="bg-slate-100 border-slate-200 text-slate-500" /></div>
                  </div>
                  <Button type="button" onClick={handleCreateCustomer} disabled={creatingCust} className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">{creatingCust ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Save Customer &amp; Continue</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Type + Services */}
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHead icon={ShoppingBag} title="Order Type" />
              <CardContent className="px-5 pb-5 pt-0">
                <RadioGroup value={orderType} onValueChange={setOrderType} className="space-y-3.5">
                  {ORDER_TYPES.map((ot) => (
                    <div key={ot.value} className="flex items-center space-x-2"><RadioGroupItem value={ot.value} id={`ot-${ot.value}`} className="text-blue-600" /><Label htmlFor={`ot-${ot.value}`} className="text-sm cursor-pointer">{ot.label}</Label></div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHead icon={Shirt} title="Garments &amp; Services" note={seeding ? "· loading demo data…" : undefined}
                right={<Button type="button" size="sm" onClick={openAddGarment} disabled={garments.length === 0} className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white"><Plus className="h-3.5 w-3.5" /> Add Garment</Button>} />
              <CardContent className="px-5 pb-5 pt-0">
                {lineItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center">
                    <Shirt className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No garments added yet.</p>
                    <p className="text-xs text-slate-400 mt-0.5">{garments.length === 0 ? (seeding ? "Loading demo services & garments…" : "Masters loading…") : "Click “Add Garment” to add an item."}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200"><span>Garment</span><span>Service</span><span className="text-center">Qty</span><span className="text-right">Amount</span><span /></div>
                    {lineItems.map((l) => {
                      const amt = lineAmount(l.uid)
                      return (
                        <div key={l.uid} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-slate-100 last:border-0">
                          <span className="text-sm font-medium text-slate-700">{grmById(l.garmentId)?.name || "—"}</span>
                          <span className="text-sm text-slate-600">{svcById(l.serviceId)?.name || "—"}</span>
                          <div className="flex items-center gap-1">
                            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setLineQty(l.uid, l.quantity - 1)} disabled={l.quantity <= 1}><Minus className="h-3 w-3" /></Button>
                            <span className="w-7 text-center text-sm tabular-nums">{l.quantity}</span>
                            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setLineQty(l.uid, l.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                          </div>
                          <span className="text-sm font-semibold text-slate-800 text-right w-16 tabular-nums">{amt != null ? inr(amt) : "…"}</span>
                          <button className="text-red-500 hover:text-red-600" onClick={() => removeLine(l.uid)}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 text-sm">
                      <span className="text-slate-500">{totalPieces} piece{totalPieces === 1 ? "" : "s"} · {lineItems.length} item{lineItems.length === 1 ? "" : "s"}</span>
                      <span className="font-bold text-slate-800">Total {inr(grandTotal)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Add Garment modal */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Shirt className="h-5 w-5 text-blue-600" /> Add Garment</DialogTitle>
                <DialogDescription>Pick a garment and service, set the quantity — the price is applied automatically.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-1">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Garment</Label>
                  <SearchableSelect value={mGarment} onChange={setMGarment} options={garments.map((g) => ({ value: g.id, label: g.name }))} placeholder="Search garment…" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Service</Label>
                  <SearchableSelect value={mService} onChange={setMService} options={availableServices.map((s) => ({ value: s.id, label: `${s.name} · ${turnaroundLabel(s.defaultTurnaroundHours)}` }))} placeholder="Select service…" />
                </div>
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Quantity</Label>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setMQty((q) => Math.max(1, q - 1))} disabled={mQty <= 1}><Minus className="h-4 w-4" /></Button>
                      <span className="w-10 text-center text-lg font-semibold tabular-nums">{mQty}</span>
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setMQty((q) => q + 1)}><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Price</p>
                    <p className="text-2xl font-bold text-slate-800">{mPricing ? <Loader2 className="h-5 w-5 animate-spin inline" /> : mPrice != null ? inr(mPrice) : mGarment && mService ? "—" : ""}</p>
                    {mGarment && mService && mPrice == null && !mPricing && <p className="text-[11px] text-amber-600">No price configured</p>}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="button" onClick={confirmAddGarment} disabled={!mGarment || !mService} className="bg-blue-600 hover:bg-blue-700 text-white gap-1"><Plus className="h-4 w-4" /> Add Item</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Expected Delivery + Pickup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHead icon={Clock} title="Expected Delivery" />
              <CardContent className="px-5 pb-5 pt-0 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Order Created</span><span className="font-medium text-slate-700">{fmtDateTime(now)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Estimated Delivery</span><span className="text-emerald-600 font-semibold">{expectedDelivery ? fmtDateTime(expectedDelivery) : "Select services"}</span></div>
                <p className="text-[11px] text-slate-400 -mt-1">(Based on max. turnaround time)</p>
                <div className="flex items-center gap-5 pt-1"><span className="text-slate-500">Override Allowed</span>
                  <RadioGroup value={overrideDelivery ? "yes" : "no"} onValueChange={(v) => setOverrideDelivery(v === "yes")} className="flex items-center gap-4">
                    <div className="flex items-center space-x-1.5"><RadioGroupItem value="yes" id="ov-yes" className="text-blue-600" /><Label htmlFor="ov-yes" className="text-sm cursor-pointer">Yes</Label></div>
                    <div className="flex items-center space-x-1.5"><RadioGroupItem value="no" id="ov-no" className="text-blue-600" /><Label htmlFor="ov-no" className="text-sm cursor-pointer">No</Label></div>
                  </RadioGroup>
                </div>
                <div className="space-y-1 pt-1">
                  <Label className="text-xs text-slate-500">Reason (Required if overridden)</Label>
                  <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} disabled={!overrideDelivery} placeholder="Enter reason for override" className="min-h-[60px] bg-slate-50 border-slate-200" />
                  {overrideDelivery && <Input type="date" value={customDeliveryDate} onChange={(e) => setCustomDeliveryDate(e.target.value)} className="bg-slate-50 border-slate-200" />}
                </div>
              </CardContent>
            </Card>

            <Card className={`rounded-xl border-slate-200 shadow-sm ${isPickup ? "" : "opacity-75"}`}>
              <CardHead icon={Truck} title="Pickup Details" note="(Only for Pickup Orders)" />
              <CardContent className="px-5 pb-5 pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs text-slate-600">Pickup Date</Label><Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} disabled={!isPickup} className="bg-slate-50 border-slate-200" /></div>
                  <div className="space-y-1"><Label className="text-xs text-slate-600">Pickup Time Slot</Label>
                    <Select value={pickupTimeSlot} onValueChange={setPickupTimeSlot} disabled={!isPickup}><SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="Select slot" /></SelectTrigger>
                      <SelectContent>{PICKUP_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                  </div>
                </div>
                <div className="space-y-1"><Label className="text-xs text-slate-600">Pickup Address</Label><Input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} disabled={!isPickup} placeholder="Enter pickup address" className="bg-slate-50 border-slate-200" /></div>
                <div className="space-y-1"><Label className="text-xs text-slate-600">Special Instructions</Label><Input value={pickupInstructions} onChange={(e) => setPickupInstructions(e.target.value)} disabled={!isPickup} placeholder="e.g. Call before arrival" className="bg-slate-50 border-slate-200" /></div>
              </CardContent>
            </Card>
          </div>

          {/* Summary + Payment + Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHead icon={FileText} title="Order Summary" />
              <CardContent className="px-5 pb-5 pt-0">
                <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 font-semibold text-slate-500 bg-slate-50 border-b border-slate-200"><span>Item</span><span>Qty</span><span className="text-right">Amount</span></div>
                  {lineItems.length === 0 ? <p className="px-3 py-4 text-slate-400 text-center">No garments added</p> : lineItems.map((l) => {
                    const amt = lineAmount(l.uid)
                    return (
                      <div key={l.uid} className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 border-b border-slate-100 last:border-0 text-slate-700"><span>{grmById(l.garmentId)?.name} · {svcById(l.serviceId)?.name}</span><span className="text-slate-400 text-center">{l.quantity}</span><span className="text-right tabular-nums">{amt != null ? inr(amt) : "…"}</span></div>
                    )
                  })}
                </div>
                <div className="mt-3 space-y-2 text-sm border-t border-slate-100 pt-3">
                  <div className="flex justify-between"><span className="font-medium text-slate-600">Total Items</span><span className="font-medium text-slate-800">{totalPieces}</span></div>
                  <div className="flex justify-between"><span className="font-medium text-slate-600">Estimated Amount</span><span className="text-blue-700 font-bold">{inr(grandTotal)}</span></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHead icon={CreditCard} title="Payment Preference" />
              <CardContent className="px-5 pb-5 pt-0">
                <RadioGroup value={paymentPreference} onValueChange={setPaymentPreference} className="space-y-2.5">
                  {PAYMENT_PREFERENCES.map((p) => (
                    <div key={p.value} className="flex items-center space-x-2"><RadioGroupItem value={p.value} id={`pp-${p.value}`} className="text-blue-600" /><Label htmlFor={`pp-${p.value}`} className="text-sm cursor-pointer">{p.label}</Label></div>
                  ))}
                </RadioGroup>
                <p className="mt-4 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 text-[11px] text-amber-700 text-center leading-snug">Note: Payment will be<br />collected after Store Audit</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHead icon={CheckCircle2} title="Notes / Special Instructions" />
              <CardContent className="px-5 pb-5 pt-0 space-y-3">
                <div className="space-y-2.5">
                  {QUICK_NOTES.map((n) => (
                    <label key={n} className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={quickNotes.includes(n)} onCheckedChange={() => setQuickNotes((p) => p.includes(n) ? p.filter((x) => x !== n) : [...p, n])} className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" /> {n}</label>
                  ))}
                </div>
                <div className="space-y-1 pt-1"><Label className="text-xs text-slate-600">Other Instructions</Label><Textarea value={otherInstructions} onChange={(e) => setOtherInstructions(e.target.value)} placeholder="Enter any other instructions" className="min-h-[70px] bg-slate-50 border-slate-200" /></div>
              </CardContent>
            </Card>
          </div>

          {/* Attachments */}
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHead icon={Paperclip} title="Attachments" note="(Optional)" />
            <CardContent className="px-5 pb-5 pt-0">
              <p className="text-xs text-slate-500 mb-3">Upload images (if any)</p>
              <div className="flex flex-wrap items-center gap-3">
                {[{ kind: "garment", label: "Upload Garment Photos", icon: ImagePlus }, { kind: "pickup", label: "Upload Pickup Photo", icon: Truck }, { kind: "other", label: "Upload Other Files", icon: Upload }].map((u) => (
                  <label key={u.kind} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm cursor-pointer text-blue-700 hover:bg-blue-50 hover:border-blue-200 shadow-sm">
                    {uploading === u.kind ? <Loader2 className="h-4 w-4 animate-spin" /> : <u.icon className="h-4 w-4" />} {u.label}
                    <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => handleUpload(u.kind, e.target.files)} />
                  </label>
                ))}
                <span className="text-[11px] text-slate-400 ml-auto">Supports: JPG, PNG, PDF (Max 5MB each)</span>
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

        {/* RIGHT — Quick Summary */}
        <Card className="rounded-xl border-slate-200 shadow-sm xl:sticky xl:top-4">
          <CardHead icon={Info} title="Quick Summary" />
          <CardContent className="px-5 pb-5 pt-0 space-y-3.5 text-sm">
            <div><p className="text-xs text-slate-400">Order Type</p><p className="font-semibold text-slate-800">{ORDER_TYPES.find((o) => o.value === orderType)?.label}</p></div>
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-400 mb-1.5">Garments ({totalPieces}) · Services ({selectedServices.length})</p>
              {selectedServices.length === 0 ? <p className="text-slate-400 text-xs">None</p> : <ul className="space-y-1">{selectedServices.map((s) => <li key={s.id} className="text-sm text-slate-700 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />{s.name}</li>)}</ul>}
            </div>
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between"><p className="text-xs text-slate-400">Estimated Total</p><p className="text-lg font-bold text-blue-700">{inr(grandTotal)}</p></div>
            <div className="border-t border-slate-100 pt-3"><p className="text-xs text-slate-400">Est. Delivery</p><p className="font-semibold text-slate-800">{expectedDelivery ? fmtDateTime(expectedDelivery) : "—"}</p></div>
            <div className="border-t border-slate-100 pt-3"><p className="text-xs text-slate-400">Pickup</p><p className="font-semibold text-slate-800">{isPickup ? (pickupDate || "Scheduled") : "Not Applicable"}</p></div>
            <div className="border-t border-slate-100 pt-3"><p className="text-xs text-slate-400">Payment Pref.</p><p className="font-semibold text-slate-800">{PAYMENT_PREFERENCES.find((p) => p.value === paymentPreference)?.label}</p></div>
            <div className="border-t border-slate-100 pt-3"><p className="text-xs text-slate-400">Order Status</p><Badge variant="outline" className="mt-1 border-amber-300 text-amber-700 bg-amber-50">Pending Store Audit</Badge></div>
          </CardContent>
        </Card>
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 mt-5 -mx-4 lg:-mx-6 border-t border-slate-200 bg-white/95 backdrop-blur px-4 lg:px-6 py-3">
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => handleSubmit("draft")} disabled={submitting} className="border-slate-300"><Save className="h-4 w-4 mr-2" /> Save Draft</Button>
          <Button onClick={() => handleSubmit("create")} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingCart className="h-4 w-4 mr-2" />} Create Order</Button>
          <Button onClick={() => handleSubmit("audit")} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white"><ArrowRight className="h-4 w-4 mr-2" /> Create Order &amp; Start Audit</Button>
        </div>
      </div>
    </div>
  )
}
