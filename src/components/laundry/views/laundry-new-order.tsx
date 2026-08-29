"use client"

// New Laundry Order — order intake at the store counter.
//
// The screen answers four questions and nothing else:
//
//   1. Who is the customer?          → search + Customer 360
//   2. What are they giving us?      → garments / services (existing pricing)
//   3. Do we collect the garments?   → Pickup Required
//   4. Do we deliver them back?      → Delivery Required
//
// Everything that used to be asked here and is decided elsewhere has been
// removed rather than reworked:
//   Order Type      — derived, never asked. Pickup Required = Yes IS a home
//                     pickup; the channel is already known (this screen is the
//                     offline/store path, the storefront is the online one).
//   Customer Type   — an account type and an active subscription are facts the
//                     system already holds; the operator does not restate them.
//   Payment         — Payment Collection owns it, after Store Audit fixes the
//                     amount. Nothing here decides money.
//   Expected Delivery / Instructions / Attachments — removed outright.
//
// Pickup and delivery are REQUIREMENTS on the order, not order types: the
// existing pickupRequired / deliveryRequired booleans plus the existing
// pickup/delivery date + slot fields carry all four combinations. No new model,
// no new status, no second scheduling mechanism.

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { AcquisitionFields, useAcquisitionOptions, defaultSourceId } from "@/components/laundry/customers/acquisition-fields"
import { generateSlots, DEFAULT_PICKUP_SLOT, DEFAULT_DELIVERY_SLOT, slotHasEnded, slotIsPast } from "@/lib/laundry-slots"
import { dayKey, earliestDeliveryDayKey } from "@/lib/laundry-tat"
import { fulfilmentError, fulfilmentPayload, needsAddress as fulfilmentNeedsAddress, addressLabel, type FulfilmentState } from "@/lib/laundry-fulfilment"
import { useAdminStore } from "@/stores/admin-store"
import { useToast } from "@/hooks/use-toast"
import { conflictMessage } from "@/lib/laundry-one-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  Search, UserPlus, User, Phone, MapPin,
  FileText, Save, ArrowRight, Loader2, ShoppingBag, ShoppingCart, CheckCircle2,
  Hash, Calendar, UserCircle, Trash2, Info, X, Shirt, Plus, Minus,
  BadgeCheck, Truck, Building2,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "./pricing/searchable-select"
import { INDIAN_STATES, isValidPincode } from "@/lib/india"
import { statusLabel } from "@/lib/laundry-workflow"
import { LaundryGarmentSelect } from "@/components/laundry/garment-select"
import { Customer360Panel } from "./customer-360-panel"

// Order type, validation and the fields an order actually carries live in
// src/lib/laundry-fulfilment.ts — pure, shared and tested, so the screen and the
// tests cannot describe different rules.
//
// Slots are configured per business (Settings → Pickup & Delivery Time Slots);
// these are only the fallback until the config loads.
const FALLBACK_PICKUP_SLOTS = generateSlots(DEFAULT_PICKUP_SLOT)
const FALLBACK_DELIVERY_SLOTS = generateSlots(DEFAULT_DELIVERY_SLOT)

interface AddressRow { id?: string; addressType?: string; label?: string | null; isPickupDefault?: boolean; isDeliveryDefault?: boolean; isDefault?: boolean; addressLine1?: string | null; addressLine2?: string | null; area?: string | null; landmark?: string | null; city?: string | null; state?: string | null; pincode?: string | null; country?: string | null; latitude?: number | null; longitude?: number | null }
interface CustomerResult {
  id: string; name: string; phone: string | null; email: string | null
  loyaltyTier: string; walletBalance: number; customerCode: string | null
  totalOrders: number; addresses: AddressRow[]; accountType?: string | null
}

// Customer 360 — read-only lifecycle summary from /api/laundry/customers/[id]/stats.
interface LcOrder { id: string; orderNumber: string; status: string; paymentStatus: string; grandTotal: number; createdAt: string }
interface Lifecycle {
  memberSince: string | null; loyaltyTier: string | null
  totalOrders: number; completed: number; cancelled: number; activeOrders: number
  grossValue: number; collected: number; outstanding: number; avgOrderValue: number
  lastOrders: LcOrder[]; activeOrdersList: LcOrder[]
  subscriptionsEnabled: boolean
  subscription: { planName: string; status: string; remainingKg: number; remainingPieces: number; expiry: string } | null
}
interface ServiceMaster {
  id: string; name: string; defaultTurnaroundHours: number
  availableInStore: boolean; availableForPickup: boolean; isActive: boolean
}
interface GarmentMaster { id: string; name: string; categoryId: string | null; defaultUnit: string; isActive: boolean }
interface LineItem { uid: string; garmentId: string; serviceId: string; quantity: number }
interface StoreInfo { id: string; storeName: string; city?: string | null }
const inr = (n: number) => `₹${(n || 0).toFixed(2)}`
// Digits-only, last-10 mobile (matches customerStats' phone aggregation).
const normPhone = (p: string | null | undefined) => { const d = (p || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : "" }

// One saved address → the single line the order stores and the executive reads.
const formatAddress = (a: AddressRow) => [a.addressLine1, a.addressLine2, a.area, a.city, a.pincode].filter(Boolean).join(", ")
const addressChoiceLabel = (a: AddressRow) => `${a.label || a.addressType || "Address"} — ${formatAddress(a)}`

const turnaroundLabel = (h: number) => (h <= 0 ? "Custom" : h <= 12 ? "Same Day" : `${h} Hours`)
const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
const fmtDateTime = (d: Date) => `${fmtDate(d)} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`

export default function LaundryNewOrder() {
  const { currentBusinessId, user } = useAuthStore()
  const { setLaundryPage, setLaundryFocusCustomerId, setLaundryFocusCustomerPhone, setSelectedOrderId } = useAdminStore()
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
  // Acquisition — chosen here so a customer is classified the moment they exist,
  // rather than needing a second visit to Customer Master.
  const [newCustSourceId, setNewCustSourceId] = useState("")
  const [newCustOwnerId, setNewCustOwnerId] = useState("")
  const [newCustOwnerName, setNewCustOwnerName] = useState("")
  const { sources: custSources, owners: custOwners } = useAcquisitionOptions(currentBusinessId || "")
  useEffect(() => {
    // Default to Direct once the list arrives, without overriding a choice.
    if (!newCustSourceId && custSources.length) setNewCustSourceId(defaultSourceId(custSources))
  }, [custSources, newCustSourceId])

  const [express, setExpress] = useState(false)
  const [expressCfg, setExpressCfg] = useState<{ enabled: boolean; hours: number | null }>({ enabled: false, hours: null })
  const [services, setServices] = useState<ServiceMaster[]>([])
  const [garments, setGarments] = useState<GarmentMaster[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [seeding, setSeeding] = useState(false)
  // Add-Garment modal
  const [addOpen, setAddOpen] = useState(false)
  // Reveal for the one-service disclaimer. Explains the rule on demand; it can
  // never change the order's service.
  const [svcNote, setSvcNote] = useState(false)
  const [mGarment, setMGarment] = useState("")
  const [mService, setMService] = useState("")
  const [mQty, setMQty] = useState(1)
  const [mPricingType, setMPricingType] = useState<string | null>(null) // resolved billing type for the modal selection
  const [mRate, setMRate] = useState<number | null>(null) // resolved unit rate (₹/KG or ₹/piece)
  const [mPrice, setMPrice] = useState<number | null>(null)
  const [mPricing, setMPricing] = useState(false)
  // live quote for the whole order
  const [quote, setQuote] = useState<{ grandTotal: number; lines: { lineTotal: number; matchedRuleId: string | null; pricingType: string | null; weightRequired?: boolean }[] } | null>(null)
  const [pickupRequired, setPickupRequired] = useState(false)
  const [deliveryRequired, setDeliveryRequired] = useState(false)
  const [pickupSlots, setPickupSlots] = useState<string[]>(FALLBACK_PICKUP_SLOTS)
  const [deliverySlots, setDeliverySlots] = useState<string[]>(FALLBACK_DELIVERY_SLOTS)
  const [pickupDate, setPickupDate] = useState("")
  const [pickupTimeSlot, setPickupTimeSlot] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState("")
  // ONE address per order. The schema carries a single address (pickupAddress /
  // pickupAddressId + lat/lng/landmark) and the delivery leg already reads it —
  // src/app/api/laundry/executive/jobs/route.ts maps `address: o.pickupAddress`
  // for BOTH job types. So a delivery-only order stores its address here too,
  // which is what puts an address in front of the delivery executive; before
  // this, a walk-in + delivery order reached them with no address at all.
  const [orderAddressId, setOrderAddressId] = useState("")
  const [savedAddresses, setSavedAddresses] = useState<AddressRow[]>([])
  const [addressesLoading, setAddressesLoading] = useState(false)
  const [creatingCust, setCreatingCust] = useState(false)

  const [stores, setStores] = useState<StoreInfo[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Pickup Required IS the home pickup. There is no separate order type to keep
  // in step with it, so the two can no longer disagree.
  const isPickup = pickupRequired
  const selectedStore = stores.find((s) => s.id === selectedStoreId)
  const selectedAddress = savedAddresses.find((a) => a.id === orderAddressId) || null
  const orderAddressText = selectedAddress ? formatAddress(selectedAddress) : ""
  const fulfilment: FulfilmentState = {
    pickupRequired, deliveryRequired,
    addressText: orderAddressText, addressId: orderAddressId,
    landmark: selectedAddress?.landmark ?? null, lat: selectedAddress?.latitude ?? null, lng: selectedAddress?.longitude ?? null,
    pickupDate, pickupTimeSlot, deliveryDate, deliveryTimeSlot,
  }
  const fulfilmentFields = fulfilmentPayload(fulfilment)
  const orderType = fulfilmentFields.orderType
  const needsAddress = fulfilmentNeedsAddress(fulfilment)

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
  // Config-driven pickup/delivery slots (single source — Settings → Time Slots).
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/slot-config?businessId=${encodeURIComponent(currentBusinessId)}`).then((r) => r.json())
      .then((j) => { if (j.success) { setPickupSlots(j.data.pickupSlots?.length ? j.data.pickupSlots : FALLBACK_PICKUP_SLOTS); setDeliverySlots(j.data.deliverySlots?.length ? j.data.deliverySlots : FALLBACK_DELIVERY_SLOTS) } })
      .catch(() => { /* keep fallback */ })
  }, [currentBusinessId])

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

  // garmentId → the services the Pricing Matrix actually prices it for. A cell
  // the matrix shows as NA is not orderable: adding it produced a ₹0 line,
  // because nothing matched and the engine's "No pricing rule" result was kept.
  const [garmentServices, setGarmentServices] = useState<Record<string, string[]>>({})
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/garment-services?businessId=${encodeURIComponent(currentBusinessId)}`)
      .then((r) => r.json())
      .then((j) => setGarmentServices(j.success ? (j.data || {}) : {}))
      .catch(() => {})
  }, [currentBusinessId])

  /** The services offerable for one garment — priced for it AND offered on this
   *  channel (store vs pickup). Empty until a garment is chosen. */
  const servicesForGarment = useCallback((garmentId: string) => {
    if (!garmentId) return []
    const priced = new Set(garmentServices[garmentId] || [])
    return availableServices.filter((s) => priced.has(s.id))
  }, [garmentServices, availableServices])
  const svcById = useCallback((id: string) => services.find((s) => s.id === id), [services])
  const grmById = useCallback((id: string) => garments.find((g) => g.id === id), [garments])
  // Distinct services used across the order's line items (drives TAT + records).
  const selectedServices = useMemo(() => {
    const ids = [...new Set(lineItems.map((l) => l.serviceId))]
    return ids.map((id) => services.find((s) => s.id === id)).filter(Boolean) as ServiceMaster[]
  }, [lineItems, services])

  const maxTat = useMemo(() => {
    const hrs = selectedServices.map((s) => s.defaultTurnaroundHours).filter((h) => h > 0)
    return hrs.length ? Math.max(...hrs) : 0
  }, [selectedServices])

  const customerType = orderType === "HOME_PICKUP" ? "PICKUP" : "WALK_IN"
  const totalPieces = useMemo(() => lineItems.reduce((s, l) => s + l.quantity, 0), [lineItems])

  // Express Delivery config (Charges & Rules). Hidden entirely if disabled.
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/charges-config?businessId=${currentBusinessId}`).then((r) => r.json())
      .then((j) => { if (j.success) { setExpressCfg({ enabled: !!j.data.expressEnabled, hours: j.data.expressTurnaroundHours ?? null }); if (!j.data.expressEnabled) setExpress(false) } }).catch(() => {})
  }, [currentBusinessId])

  // ── Live billing for the whole order (Pricing Engine; never hardcoded) ──
  const quoteKey = JSON.stringify({ items: lineItems.map((l) => [l.serviceId, l.garmentId, l.quantity]), storeId: selectedStoreId, customerType, express })
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!currentBusinessId || lineItems.length === 0) { setQuote(null); return }
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
    quoteTimer.current = setTimeout(async () => {
      try {
        const items = lineItems.map((l) => ({ serviceId: l.serviceId, garmentId: l.garmentId, categoryId: grmById(l.garmentId)?.categoryId || null, quantity: l.quantity }))
        const res = await fetch("/api/laundry/billing/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, storeId: selectedStoreId || null, customerType, express, items }) })
        const json = await res.json(); setQuote(json.success ? json.data : null)
      } catch { setQuote(null) }
    }, 250)
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, currentBusinessId])

  const lineAmount = (uid: string) => { const idx = lineItems.findIndex((l) => l.uid === uid); return idx >= 0 && quote ? quote.lines[idx]?.lineTotal ?? null : null }
  // Per-line billing type from the resolved quote (drives the Per-KG weight field).
  const linePricing = (uid: string) => { const idx = lineItems.findIndex((l) => l.uid === uid); return idx >= 0 && quote ? quote.lines[idx] ?? null : null }
  const grandTotal = quote?.grandTotal ?? 0
  // Weight is NEVER captured at booking — Per-KG lines are estimated (₹0) here and
  // priced at Store Audit when the garment is weighed. Booking records quantities only.
  const hasKgLine = lineItems.some((l) => linePricing(l.uid)?.pricingType === "PER_KG")

  // ── Subscription integration (automatic; never a manual step) ──────────────
  // Detect the selected customer's ACTIVE / GRACE subscription, and live-preview
  // how much of the current order it covers (nothing is consumed until Save).
  const [subInfo, setSubInfo] = useState<{ planName: string; status: string; remainingKg: number; remainingPieces: number; expiry: string; eligibleServices: string[] } | null>(null)
  const [subPreview, setSubPreview] = useState<{ coveredAmount: number; extraAmount: number } | null>(null)
  useEffect(() => {
    if (!currentBusinessId || !selectedCustomer) { setSubInfo(null); return }
    let cancel = false
    fetch(`/api/laundry/subscriptions/active?businessId=${currentBusinessId}&customerId=${selectedCustomer.id}`).then((r) => r.json())
      .then((j) => { if (!cancel) setSubInfo(j.success && j.data.length ? j.data[0] : null) }).catch(() => { if (!cancel) setSubInfo(null) })
    return () => { cancel = true }
  }, [currentBusinessId, selectedCustomer])
  // Walk-in POS lookup: the full membership picture the moment a customer is picked
  // (mobile/name search) — cashier instantly sees plan, validity, remaining, due.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [membership, setMembership] = useState<any>(null)
  useEffect(() => {
    if (!currentBusinessId || !selectedCustomer) { setMembership(null); return }
    let cancel = false
    fetch(`/api/laundry/customers/${selectedCustomer.id}/membership?businessId=${currentBusinessId}`).then((r) => r.json())
      .then((j) => { if (!cancel) setMembership(j.success ? j.data : null) }).catch(() => { if (!cancel) setMembership(null) })
    return () => { cancel = true }
  }, [currentBusinessId, selectedCustomer])
  // Customer 360 lifecycle summary (read-only) for the selected customer.
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null)
  const [lcLoading, setLcLoading] = useState(false)
  useEffect(() => {
    if (!currentBusinessId || !selectedCustomer) { setLifecycle(null); return }
    let cancel = false
    setLcLoading(true); setLifecycle(null)
    fetch(`/api/laundry/customers/${selectedCustomer.id}/stats?businessId=${currentBusinessId}`).then((r) => r.json())
      .then((j) => { if (!cancel) setLifecycle(j.success ? j.data : null) })
      .catch(() => { if (!cancel) setLifecycle(null) })
      .finally(() => { if (!cancel) setLcLoading(false) })
    return () => { cancel = true }
  }, [currentBusinessId, selectedCustomer])

  // The customer's saved addresses ARE the address list — the operator selects
  // one, never retypes house/street/area/city/PIN/GPS. The customer's own
  // pickup-default (falling back to their default, then the first) is
  // preselected, so the common case needs no interaction at all.
  useEffect(() => {
    if (!currentBusinessId || !selectedCustomer) { setSavedAddresses([]); setOrderAddressId(""); return }
    setAddressesLoading(true)
    setOrderAddressId("")
    fetch(`/api/laundry/customers/${selectedCustomer.id}/addresses?businessId=${currentBusinessId}`).then((r) => r.json())
      .then((j) => {
        const addrs: AddressRow[] = j.success ? j.data || [] : []
        setSavedAddresses(addrs)
        const def = addrs.find((a) => a.isPickupDefault) || addrs.find((a) => a.isDefault) || addrs[0]
        if (def?.id) setOrderAddressId(def.id)
      })
      .catch(() => setSavedAddresses([]))
      .finally(() => setAddressesLoading(false))
  }, [currentBusinessId, selectedCustomer])

  const subPreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!currentBusinessId || !selectedCustomer || !subInfo || lineItems.length === 0) { setSubPreview(null); return }
    if (subPreviewTimer.current) clearTimeout(subPreviewTimer.current)
    subPreviewTimer.current = setTimeout(async () => {
      try {
        const items = lineItems.map((l) => ({ serviceId: l.serviceId, garmentId: l.garmentId, quantity: l.quantity }))
        const res = await fetch("/api/laundry/subscriptions/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, customerId: selectedCustomer.id, storeId: selectedStoreId || null, orderType, express, items }) })
        const j = await res.json(); setSubPreview(j.success ? { coveredAmount: j.data.coveredAmount, extraAmount: j.data.extraAmount } : null)
      } catch { setSubPreview(null) }
    }, 300)
    return () => { if (subPreviewTimer.current) clearTimeout(subPreviewTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, currentBusinessId, selectedCustomer, subInfo])
  const covered = subPreview?.coveredAmount ?? 0
  const customerPays = Math.max(0, grandTotal - covered)

  // ── Add-Garment modal: live single-line price + resolved billing type ──
  // Weight is NEVER entered here. For Per-KG garments the amount is unknown until
  // the garment is weighed at Store Audit, so we only capture the quantity and
  // show the rate (₹/KG) for reference. Per-Piece garments price immediately.
  const mIsKg = mPricingType === "PER_KG"
  useEffect(() => {
    if (!addOpen || !mGarment || !mService || !currentBusinessId) { setMPrice(null); setMPricingType(null); return }
    setMPricing(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/laundry/billing/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, storeId: selectedStoreId || null, customerType, items: [{ serviceId: mService, garmentId: mGarment, categoryId: grmById(mGarment)?.categoryId || null, quantity: mQty || 1 }] }) })
        // Show ONLY the Service+Garment base line price — order-level charges
        // (minimum, pickup, delivery, express) belong in the Order Summary.
        const json = await res.json()
        const line = json.success ? json.data.lines?.[0] : null
        setMPricingType(line?.pricingType ?? null)
        setMRate(line?.unitPrice ?? null)
        // Per-KG is priced at Store Audit (after weighing) — no amount at booking.
        setMPrice(line ? (line.pricingType === "PER_KG" ? null : line.lineTotal ?? null) : null)
      } catch { setMPrice(null); setMPricingType(null); setMRate(null) } finally { setMPricing(false) }
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOpen, mGarment, mService, mQty, currentBusinessId, selectedStoreId, customerType])

  const mServices = useMemo(() => servicesForGarment(mGarment), [servicesForGarment, mGarment])
  // The order's service, derived from the lines rather than held separately, so
  // it can never go stale: empty the order and it is null again.
  const orderService = useMemo(() => {
    const first = lineItems[0]
    if (!first) return null
    const sv = svcById(first.serviceId)
    return { id: first.serviceId, name: sv?.name || "this service", turnaroundHours: sv?.defaultTurnaroundHours ?? 0 }
  }, [lineItems, services]) // eslint-disable-line react-hooks/exhaustive-deps
  // The inherited service must still be priced for the garment being added. It
  // usually is; when it is not, say so rather than letting Add fail later.
  const lockedServiceUnavailable = !!orderService && !!mGarment && !mServices.some((sv) => sv.id === orderService.id)

  // Choosing a different garment can invalidate the selected service, so the
  // selection follows the garment rather than being left stale.
  useEffect(() => {
    // One service per order: once the order has one, every later garment
    // inherits it — the garment never re-picks the service. It clears only when
    // the inherited service is not priced for the chosen garment, which the
    // note below explains.
    if (orderService) {
      setMService(mServices.some((sv) => sv.id === orderService.id) ? orderService.id : "")
      return
    }
    if (!mGarment) { setMService(""); return }
    if (!mServices.some((s) => s.id === mService)) setMService(mServices[0]?.id || "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mGarment, mServices, orderService])


  // Second garment onwards, the service is already known — inherit it so the
  // operator only picks the garment and the quantity.
  const openAddGarment = () => { setMGarment(""); setMService(orderService?.id || ""); setMQty(1); setMPricingType(null); setMRate(null); setMPrice(null); setSvcNote(false); setAddOpen(true) }
  const confirmAddGarment = () => {
    if (!mGarment || !mService) { toast({ title: "Select garment & service", variant: "destructive" }); return }
    // ONE SERVICE = ONE ORDER. The FIRST garment establishes this order's
    // service; a different one is refused with the reason and what to do about
    // it, never silently disabled. Removing every line clears the lock, because
    // an empty order has established nothing. The API refuses it too.
    if (orderService && mService !== orderService.id) {
      toast({
        title: "One service per order",
        description: conflictMessage(orderService.name, svcById(mService)?.name || "that service"),
        variant: "destructive",
      })
      return
    }
    // Last line of defence in the UI; the API refuses it too.
    if (!mServices.some((s) => s.id === mService)) {
      const sv = svcById(mService)?.name || "That service"
      toast({ title: `${sv} is not available for ${grmById(mGarment)?.name || "this garment"}. Please select an available service.`, variant: "destructive" })
      return
    }
    setLineItems((p) => [...p, { uid: `L${Date.now()}${p.length}`, garmentId: mGarment, serviceId: mService, quantity: Math.max(1, mQty || 1) }])
    setAddOpen(false)
  }
  const removeLine = (uid: string) => setLineItems((p) => p.filter((l) => l.uid !== uid))
  const setLineQty = (uid: string, q: number) => setLineItems((p) => p.map((l) => (l.uid === uid ? { ...l, quantity: Math.max(1, q) } : l)))

  // Still computed from the services' own turnaround — Order Details, reports
  // and the workstations read expectedDeliveryDate, so it must keep being
  // written. What was removed is ASKING the operator for it: no manual date, no
  // override, no reason. It is derived or it is nothing.
  const expectedDelivery = useMemo(() => {
    if (maxTat === 0) return null
    const d = new Date(now); d.setHours(d.getHours() + maxTat); return d
  }, [maxTat, now])

  // Today, and the earliest honest delivery day. Delivery cannot be promised
  // before the garments can be ready, so the floor is the services' own TAT
  // measured from the pickup (the garments cannot be washed before they are
  // collected) or from now for a counter drop-off. Same laundry-tat helpers the
  // storefront uses — not a second delivery-promise rule.
  const todayKey = dayKey(now)
  const earliestDeliveryKey = useMemo(
    () => earliestDeliveryDayKey(pickupRequired && pickupDate ? new Date(pickupDate) : now, selectedServices),
    [pickupRequired, pickupDate, selectedServices, now],
  )

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
    const resetForm = () => { setNewCustName(""); setNewCustMobile(""); setNewCustAltMobile(""); setNewCustEmail(""); setNewCustAddress(""); setNewCustAddress2(""); setNewCustArea(""); setNewCustLandmark(""); setNewCustCity(""); setNewCustState(""); setNewCustPincode(""); setNewCustOwnerId(""); setNewCustOwnerName(""); setCustomers([]) }
    const mobile = newCustMobile
    const payload = { businessId: currentBusinessId, name: newCustName, mobile, alternateMobile: newCustAltMobile, email: newCustEmail, customerSourceId: newCustSourceId || null, salesTeamOwnerId: newCustOwnerId || null, salesTeamOwnerName: newCustOwnerName || null, ...addressPayload }
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

  const handleSubmit = async (action: "create" | "draft" | "audit") => {
    if (!currentBusinessId || !selectedStoreId) { toast({ title: "Error", description: "No business or store selected", variant: "destructive" }); return }
    if (!selectedCustomer) { toast({ title: "Error", description: "Select or create a customer first", variant: "destructive" }); return }
    if (lineItems.length === 0) { toast({ title: "Add a garment", description: "Add at least one garment to the order.", variant: "destructive" }); return }
    // A switched-off leg is never validated (Pickup = No asks for nothing).
    const fErr = fulfilmentError(fulfilment)
    if (fErr) { toast({ title: "Fulfilment incomplete", description: fErr, variant: "destructive" }); return }
    // Weight is captured at Store Audit, never here — booking records quantities only.
    setSubmitting(true)
    try {
      const payload = {
        businessId: currentBusinessId, storeId: selectedStoreId, customerId: selectedCustomer.id,
        services: selectedServices.map((s) => ({ serviceId: s.id, serviceName: s.name, turnaroundHours: s.defaultTurnaroundHours })),
        items: lineItems.map((l) => ({ serviceId: l.serviceId, garmentId: l.garmentId, quantity: l.quantity })),
        isExpress: express,
        expectedDeliveryDate: expectedDelivery ? expectedDelivery.toISOString().split("T")[0] : null,
        // orderType + both requirement flags + the schedules + the one address,
        // from the shared rule. A leg that is off contributes nulls, so a
        // walk-in can never carry a stale pickup date.
        //
        // paymentPreference is deliberately NOT sent: Payment Collection owns
        // payment, after Store Audit fixes the amount. The server applies its
        // own default.
        ...fulfilmentFields,
        notes: null, createdBy: user?.name || "counter",
      }
      const res = await fetch("/api/laundry/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!json.success) { toast({ title: "Error", description: json.error || "Failed to create order", variant: "destructive" }); return }
      // Subscription was applied automatically server-side (no manual step).
      const cov = json.subscription?.coveredAmount || 0
      toast({ title: "Order Created", description: cov > 0 ? `Order ${json.data.orderNumber} · ${inr(cov)} covered by subscription, ${inr(json.data.balanceDue ?? 0)} to collect` : `Order ${json.data.orderNumber} is now Pending Store Audit` })
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
  // Compact Customer-snapshot tile.
  const Snap = ({ label, value, tone }: { label: string; value: string; tone?: "blue" | "rose" }) => {
    const t = tone === "blue" ? "text-blue-700" : tone === "rose" ? "text-rose-600" : "text-slate-800"
    return <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2"><p className="text-[10px] uppercase tracking-wide text-slate-400 truncate">{label}</p><p className={`text-sm font-bold ${t} truncate`}>{value}</p></div>
  }

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
                      {/* ── Customer 360 — read-only lifecycle summary (existing data only) ── */}
                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold shrink-0">{selectedCustomer.name.slice(0, 2).toUpperCase()}</div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-semibold text-slate-800 leading-tight">{selectedCustomer.name}</p>
                                <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Existing</span>
                                {(lifecycle?.loyaltyTier || selectedCustomer.loyaltyTier) && <Badge variant="outline" className="text-[10px] gap-1 border-emerald-300 text-emerald-700 bg-emerald-50"><BadgeCheck className="h-3 w-3" />{lifecycle?.loyaltyTier || selectedCustomer.loyaltyTier}</Badge>}
                              </div>
                              <p className="text-sm text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedCustomer.phone || "—"}{selectedCustomer.customerCode ? ` · ${selectedCustomer.customerCode}` : ""}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedCustomer(null)}><X className="h-4 w-4" /></Button>
                        </div>

                        {/* Walk-in membership panel — cashier sees it instantly. */}
                        {membership?.hasMembership && (
                          membership.status === "ACTIVE" || membership.status === "GRACE" ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-emerald-800 flex items-center gap-1"><BadgeCheck className="h-4 w-4" /> Subscription {membership.status === "GRACE" ? "In Grace" : "Active"}</p>
                                <span className="text-[10px] font-mono text-emerald-700">{membership.membershipId}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-emerald-800">
                                <span className="font-semibold">{membership.planName}</span>
                                {membership.endDate && <span>Valid until <b>{fmtDate(new Date(membership.endDate))}</b></span>}
                                {membership.garments?.total > 0 && <span>Garments <b>{membership.garments.remaining}/{membership.garments.total}</b></span>}
                                {membership.orders?.max != null && <span>Orders <b>{membership.orders.remaining}/{membership.orders.max}</b></span>}
                                {membership.kg?.total > 0 && <span>KG <b>{membership.kg.remaining}/{membership.kg.total}</b></span>}
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 flex items-center justify-between">
                              <p className="text-sm font-semibold text-amber-800">Subscription {membership.status === "PENDING_PAYMENT" ? "Pending Payment" : "Expired"}</p>
                              {membership.outstandingDue > 0 && <span className="text-xs font-bold text-amber-800">Collect {inr(membership.outstandingDue)}</span>}
                            </div>
                          )
                        )}

                        {lcLoading && !lifecycle ? (
                          <div className="py-6 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /> Loading customer history…</div>
                        ) : lifecycle ? (
                          <>
                            {/* Snapshot — who is this customer + do they owe money */}
                            <div className="grid grid-cols-3 gap-2">
                              <Snap label="Customer Since" value={lifecycle.memberSince ? fmtDate(new Date(lifecycle.memberSince)) : "—"} />
                              <Snap label="Outstanding" value={inr(lifecycle.outstanding)} tone={lifecycle.outstanding > 0 ? "rose" : undefined} />
                              <Snap label="Lifetime Value" value={inr(lifecycle.grossValue)} tone="blue" />
                            </div>

                            {/* Current Active Orders — the primary section; every active order, clickable */}
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Current Active Orders{lifecycle.activeOrdersList.length > 0 ? ` · ${lifecycle.activeOrdersList.length}` : ""}</p>
                              {lifecycle.activeOrdersList.length > 0 ? (
                                <div className="rounded-lg border border-slate-100 divide-y divide-slate-50">
                                  {lifecycle.activeOrdersList.map((o) => {
                                    const paid = o.paymentStatus === "PAID" || o.paymentStatus === "SUBSCRIPTION"
                                    return (
                                      <button type="button" key={o.id} onClick={() => { setSelectedOrderId(o.id); setLaundryPage("order-detail") }} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50">
                                        <div className="min-w-0">
                                          <p className="font-mono text-xs font-semibold text-blue-700">{o.orderNumber}</p>
                                          <p className="text-[11px] text-slate-400 truncate">{statusLabel(o.status as never)} · {fmtDate(new Date(o.createdAt))}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-xs font-semibold text-slate-700">{inr(o.grandTotal)}</span>
                                          <Badge variant="outline" className={`text-[10px] ${paid ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-rose-300 text-rose-700 bg-rose-50"}`}>{paid ? "PAID" : "UNPAID"}</Badge>
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">No active orders.</p>
                              )}
                            </div>

                            {/* Last 5 Orders — clickable + View All */}
                            {lifecycle.lastOrders.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Last 5 Orders</p>
                                  <button type="button" onClick={() => { setLaundryFocusCustomerId(selectedCustomer.id); setLaundryPage("orders") }} className="text-[11px] font-semibold text-blue-600 hover:underline">View All Orders</button>
                                </div>
                                <div className="rounded-lg border border-slate-100 divide-y divide-slate-50">
                                  {lifecycle.lastOrders.map((o) => (
                                    <button type="button" key={o.id} onClick={() => { setSelectedOrderId(o.id); setLaundryPage("order-detail") }} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50">
                                      <div><p className="font-mono text-xs font-semibold text-blue-700">{o.orderNumber}</p><p className="text-[11px] text-slate-400">{fmtDate(new Date(o.createdAt))}</p></div>
                                      <div className="text-right"><p className="text-xs font-semibold text-slate-700">{inr(o.grandTotal)}</p><p className="text-[11px] text-slate-400">{statusLabel(o.status as never)}</p></div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Financial Summary — one compact row */}
                            <div className="grid grid-cols-4 gap-2">
                              <Snap label="Outstanding" value={inr(lifecycle.outstanding)} tone={lifecycle.outstanding > 0 ? "rose" : undefined} />
                              <Snap label="Lifetime Value" value={inr(lifecycle.grossValue)} tone="blue" />
                              <Snap label="Total Paid" value={inr(lifecycle.collected)} />
                              <Snap label="Refund" value="₹0.00" />
                            </div>

                            {/* Subscription — only when the tenant has the Subscription module enabled */}
                            {lifecycle.subscriptionsEnabled && (
                              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                                {lifecycle.subscription ? (
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5"><BadgeCheck className="h-4 w-4" /> Active Subscription · {lifecycle.subscription.planName}</p>
                                    <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-white">{lifecycle.subscription.status === "GRACE" ? "In Grace" : "Active"}</Badge>
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-500 flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-slate-400" /> No Active Subscription</p>
                                )}
                              </div>
                            )}
                          </>
                        ) : null}

                        {/* Quick Actions */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => document.getElementById("laundry-order-garments")?.scrollIntoView({ behavior: "smooth" })}><ShoppingCart className="h-3.5 w-3.5" /> New Order</Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => { setLaundryFocusCustomerId(selectedCustomer.id); setLaundryPage("customers") }}><UserCircle className="h-3.5 w-3.5" /> View Customer</Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => { setLaundryFocusCustomerId(selectedCustomer.id); setLaundryFocusCustomerPhone(normPhone(selectedCustomer.phone) || null); setLaundryPage("orders") }}><ShoppingBag className="h-3.5 w-3.5" /> View Orders</Button>
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
                  <AcquisitionFields
                    sources={custSources}
                    owners={custOwners}
                    sourceId={newCustSourceId}
                    ownerId={newCustOwnerId}
                    onSourceChange={setNewCustSourceId}
                    onOwnerChange={(id, name) => { setNewCustOwnerId(id); setNewCustOwnerName(name) }}
                  />
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

          {/* Garments & Services — the order itself */}
          <div className="grid grid-cols-1">
            <Card id="laundry-order-garments" className="rounded-xl border-slate-200 shadow-sm scroll-mt-24">
              <CardHead icon={Shirt} title="Garments &amp; Services" note={seeding ? "· loading demo data…" : undefined}
                right={<Button type="button" size="sm" onClick={openAddGarment} disabled={garments.length === 0} className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white"><Plus className="h-3.5 w-3.5" /> Add Garment</Button>} />
              <CardContent className="px-5 pb-5 pt-0">
                {/* Delivery speed — only when Express is enabled in Charges & Rules.
                    It is a property of the work, not an order type. */}
                {expressCfg.enabled && (
                  <div className="mb-3 flex items-center gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Delivery Speed</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setExpress(false)} className={`rounded-lg border px-3 py-1 text-xs font-medium ${!express ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>Normal</button>
                      <button type="button" onClick={() => setExpress(true)} className={`rounded-lg border px-3 py-1 text-xs font-medium ${express ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600"}`}>Express{expressCfg.hours ? ` · ${expressCfg.hours}h` : ""}</button>
                    </div>
                  </div>
                )}
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
                      const lp = linePricing(l.uid)
                      const isKg = lp?.pricingType === "PER_KG"
                      return (
                        <div key={l.uid} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-slate-100 last:border-0">
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-slate-700">{grmById(l.garmentId)?.name || "—"}</span>
                            {/* Per-KG garments are weighed at Store Audit — no weight at booking. */}
                            {isKg && <p className="text-[10px] text-blue-600 mt-0.5">Weighed at Store Audit</p>}
                          </div>
                          <span className="text-sm text-slate-600">{svcById(l.serviceId)?.name || "—"}{isKg && <span className="ml-1 text-[10px] text-blue-600">Per KG</span>}</span>
                          <div className="flex items-center gap-1">
                            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setLineQty(l.uid, l.quantity - 1)} disabled={l.quantity <= 1}><Minus className="h-3 w-3" /></Button>
                            <span className="w-7 text-center text-sm tabular-nums">{l.quantity}</span>
                            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setLineQty(l.uid, l.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                          </div>
                          <span className="text-sm font-semibold text-slate-800 text-right w-16 tabular-nums">{isKg ? <span className="text-[11px] text-slate-400">At audit</span> : amt != null ? inr(amt) : "…"}</span>
                          <button className="text-red-500 hover:text-red-600" onClick={() => removeLine(l.uid)}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 text-sm">
                      <span className="text-slate-500">{totalPieces} piece{totalPieces === 1 ? "" : "s"} · {lineItems.length} item{lineItems.length === 1 ? "" : "s"}</span>
                      <span className="font-bold text-slate-800">{hasKgLine ? "Estimated " : "Total "}{inr(grandTotal)}</span>
                    </div>
                    {hasKgLine && <p className="px-4 py-2 text-[11px] text-blue-600 bg-blue-50/60 border-t border-blue-100">Per-KG items are weighed at Store Audit — the final amount is confirmed after inspection.</p>}
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
                  {/* Shared selector: same master, and searchable by CODE as well as name —
                      the previous options list carried only the name. */}
                  <LaundryGarmentSelect value={mGarment} onChange={setMGarment} garments={garments} />
                </div>
                <div className="space-y-1">
                  {/* Established → ONE compact line, not a field and not a card:
                      the service is inherited, so there is nothing to pick. The
                      action beside it exists purely to make the restriction
                      discoverable — it can never add a second service. */}
                  {orderService ? (
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-xs text-slate-600">
                        <span className="uppercase tracking-wide text-[10px] text-slate-400">Order service</span>{" "}
                        <span className="font-semibold text-slate-800">{orderService.name} · {turnaroundLabel(orderService.turnaroundHours)}</span>
                      </p>
                      <button type="button" onClick={() => setSvcNote((v) => !v)} className="text-[11px] font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5">
                        <Plus className="h-3 w-3" /> Add another service
                      </button>
                    </div>
                  ) : (
                    <>
                      <Label className="text-xs text-slate-600">Service</Label>
                      <SearchableSelect value={mService} onChange={setMService} options={mServices.map((s) => ({ value: s.id, label: `${s.name} · ${turnaroundLabel(s.defaultTurnaroundHours)}` }))} placeholder={mGarment ? (mServices.length ? "Select service…" : "No service priced for this garment") : "Select a garment first…"} />
                    </>
                  )}
                  {orderService && svcNote && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                      One service per order. For a different service, save this order and create a new one.
                    </p>
                  )}
                  {lockedServiceUnavailable && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      {orderService?.name} is not priced for {grmById(mGarment)?.name || "this garment"}. Choose a different garment, or create a separate order for another service.
                    </p>
                  )}
                  {!orderService && mGarment && mServices.length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      {grmById(mGarment)?.name || "This garment"} has no service priced in the Pricing Matrix. Add a price there before it can be ordered.
                    </p>
                  )}
                  {!orderService && mGarment && mServices.length > 0 && mServices.length < availableServices.length && (
                    <p className="text-[11px] text-slate-400 mt-1">Only services priced for this garment are listed.</p>
                  )}
                </div>
                {/* Billing Type is resolved from the saved pricing — read only. */}
                {mGarment && mService && (
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                    <span className="text-xs text-slate-500">Billing Type</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${mIsKg ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>
                      {mPricing && mPricingType == null ? "…" : mIsKg ? "Per KG" : mPricingType === "PER_PIECE" ? "Per Piece" : "—"}
                    </span>
                  </div>
                )}
                <div className="flex items-end justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Quantity{mIsKg ? " (garment count)" : ""}</Label>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setMQty((q) => Math.max(1, q - 1))} disabled={mQty <= 1}><Minus className="h-4 w-4" /></Button>
                      <span className="w-10 text-center text-lg font-semibold tabular-nums">{mQty}</span>
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setMQty((q) => q + 1)}><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  {/* Rate — read only, from the saved pricing. */}
                  {mIsKg && (
                    <div className="space-y-1 text-right">
                      <Label className="text-xs text-slate-600">Rate</Label>
                      <p className="text-sm font-medium text-slate-700 tabular-nums h-9 flex items-center justify-end">{mRate != null ? `${inr(mRate)}/KG` : "—"}</p>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-xs text-slate-500">{mIsKg ? "Amount" : "Price"}</p>
                    {mIsKg ? (
                      <p className="text-sm font-semibold text-blue-600 leading-tight">Weighed at<br />Store Audit</p>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-slate-800">{mPricing ? <Loader2 className="h-5 w-5 animate-spin inline" /> : mPrice != null ? inr(mPrice) : mGarment && mService ? "—" : ""}</p>
                        {mGarment && mService && mPrice == null && !mPricing && <p className="text-[11px] text-amber-600">No price configured</p>}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="button" onClick={confirmAddGarment} disabled={!mGarment || !mService} className="bg-blue-600 hover:bg-blue-700 text-white gap-1"><Plus className="h-4 w-4" /> Add Item</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── FULFILMENT ────────────────────────────────────────────────────
              Two questions, four real combinations, one card. Answering "No"
              shows nothing further — the walk-in who collects their own clothes
              never sees a scheduling field.

              These are requirements on the order, not order types: the existing
              pickupRequired / deliveryRequired booleans and the existing
              pickup/delivery date + slot fields already carry all four cases. */}
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHead icon={Truck} title="Fulfilment" note="· pickup and delivery are optional" />
            <CardContent className="px-5 pb-5 pt-0 space-y-4">
              {/* ONE address for the order. The schema holds a single address and
                  the delivery leg already reads it, so pickup and delivery share
                  it rather than the screen pretending two can be stored. */}
              {needsAddress && (
                <div className="space-y-1.5 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-blue-600" />
                    {addressLabel(fulfilment)}
                  </Label>
                  {addressesLoading ? (
                    <p className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading saved addresses…</p>
                  ) : savedAddresses.length > 0 ? (
                    <>
                      {/* Saved addresses only — the operator never retypes house,
                          street, area, city, PIN or GPS. */}
                      <Select value={orderAddressId} onValueChange={setOrderAddressId}>
                        <SelectTrigger className="bg-white border-slate-200 h-auto py-2 text-left"><SelectValue placeholder="Select address" /></SelectTrigger>
                        <SelectContent>
                          {savedAddresses.map((a) => <SelectItem key={a.id} value={a.id || ""}>{addressChoiceLabel(a)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {pickupRequired && deliveryRequired && <p className="text-[11px] text-slate-500">Collected from and delivered to this address.</p>}
                    </>
                  ) : (
                    <p className="text-[11px] text-amber-700">
                      {selectedCustomer ? "This customer has no saved address. Add one in Customers, then reopen this order." : "Select a customer to choose an address."}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* ── Pickup ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-700">Pickup Required</span>
                    <div className="flex gap-2">
                      {/* Default No: the walk-in counter case stays one click. */}
                      <button type="button" onClick={() => { setPickupRequired(false); setPickupDate(""); setPickupTimeSlot("") }} className={`px-3 py-1 text-xs rounded border ${!pickupRequired ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}>No</button>
                      <button type="button" onClick={() => setPickupRequired(true)} className={`px-3 py-1 text-xs rounded border ${pickupRequired ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}>Yes</button>
                    </div>
                  </div>
                  {pickupRequired ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs text-slate-600">Pickup Date</Label>
                        <Input type="date" min={todayKey} value={pickupDate} onChange={(e) => { setPickupDate(e.target.value); setPickupTimeSlot("") }} className="bg-slate-50 border-slate-200" /></div>
                      <div className="space-y-1"><Label className="text-xs text-slate-600">Pickup Slot</Label>
                        <Select value={pickupTimeSlot} onValueChange={setPickupTimeSlot}><SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="Select slot" /></SelectTrigger>
                          <SelectContent>
                            {/* A slot that has STARTED is still collectable; only
                                a finished one is gone (laundry-slots rule). */}
                            {pickupSlots.map((s) => { const gone = slotHasEnded(s, pickupDate, now); return <SelectItem key={s} value={s} disabled={gone}>{s}{gone ? " — ended" : ""}</SelectItem> })}
                          </SelectContent></Select>
                      </div>
                      <p className="col-span-2 text-[11px] text-slate-500">The garments are collected from the customer — this order waits for pickup instead of going straight to Store Audit.</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">Garments are with the store.</p>
                  )}
                </div>

                {/* ── Delivery ── */}
                <div className="space-y-3 md:border-l md:pl-5 border-slate-100">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-700">Delivery Required</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setDeliveryRequired(false); setDeliveryDate(""); setDeliveryTimeSlot("") }} className={`px-3 py-1 text-xs rounded border ${!deliveryRequired ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}>No</button>
                      <button type="button" onClick={() => setDeliveryRequired(true)} className={`px-3 py-1 text-xs rounded border ${deliveryRequired ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}>Yes</button>
                    </div>
                  </div>
                  {deliveryRequired ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs text-slate-600">Delivery Date</Label>
                        {/* Cannot be promised before the work can be done. */}
                        <Input type="date" min={earliestDeliveryKey} value={deliveryDate} onChange={(e) => { setDeliveryDate(e.target.value); setDeliveryTimeSlot("") }} className="bg-slate-50 border-slate-200" /></div>
                      <div className="space-y-1"><Label className="text-xs text-slate-600">Delivery Slot</Label>
                        <Select value={deliveryTimeSlot} onValueChange={setDeliveryTimeSlot}><SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="Select slot" /></SelectTrigger>
                          <SelectContent>
                            {/* Nothing may be promised in a slot already under way. */}
                            {deliverySlots.map((s) => { const gone = slotIsPast(s, deliveryDate, now); return <SelectItem key={s} value={s} disabled={gone}>{s}{gone ? " — passed" : ""}</SelectItem> })}
                          </SelectContent></Select>
                      </div>
                      <p className="col-span-2 text-[11px] text-slate-500">This is the customer&apos;s promise. Dispatch assigns the executive later.</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">Customer collects from the store.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Order Summary. Payment is deliberately absent — Store Audit fixes
              the amount and Payment Collection takes the money. */}
          <div className="grid grid-cols-1">
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHead icon={FileText} title="Order Summary" />
              <CardContent className="px-5 pb-5 pt-0">
                <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 font-semibold text-slate-500 bg-slate-50 border-b border-slate-200"><span>Item</span><span>Qty</span><span className="text-right">Amount</span></div>
                  {lineItems.length === 0 ? <p className="px-3 py-4 text-slate-400 text-center">No garments added</p> : lineItems.map((l) => {
                    const amt = lineAmount(l.uid)
                    return (
                      <div key={l.uid} className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 border-b border-slate-100 last:border-0 text-slate-700"><span>{grmById(l.garmentId)?.name} · {svcById(l.serviceId)?.name}{linePricing(l.uid)?.pricingType === "PER_KG" ? <span className="text-blue-500"> · Per KG</span> : null}</span><span className="text-slate-400 text-center">{l.quantity}</span><span className="text-right tabular-nums">{amt != null ? inr(amt) : "…"}</span></div>
                    )
                  })}
                </div>
                <div className="mt-3 space-y-2 text-sm border-t border-slate-100 pt-3">
                  <div className="flex justify-between"><span className="font-medium text-slate-600">Total Items</span><span className="font-medium text-slate-800">{totalPieces}</span></div>
                  <div className="flex justify-between"><span className="font-medium text-slate-600">Estimated Amount</span><span className="text-blue-700 font-bold">{inr(grandTotal)}</span></div>
                  {/* Automatic subscription split (Part 4) */}
                  {subInfo && covered > 0 && <>
                    <div className="flex justify-between"><span className="font-medium text-emerald-600">Covered by Subscription</span><span className="font-semibold text-emerald-700">− {inr(covered)}</span></div>
                    <div className="flex justify-between border-t border-slate-100 pt-2"><span className="font-semibold text-slate-700">Customer Pays</span><span className="font-bold text-slate-900">{inr(customerPays)}</span></div>
                  </>}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* RIGHT — Customer 360 above the summary. It answers "who is this
            customer", which the operator wants BEFORE confirming, and it fills
            the space the removed Instructions/Attachments cards left. */}
        <div className="space-y-4 xl:sticky xl:top-4">
        <Customer360Panel customerId={selectedCustomer?.id || null} businessId={currentBusinessId} />

        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHead icon={Info} title="Quick Summary" />
          <CardContent className="px-5 pb-5 pt-0 space-y-3.5 text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Garments ({totalPieces}) · Services ({selectedServices.length})</p>
              {selectedServices.length === 0 ? <p className="text-slate-400 text-xs">None</p> : <ul className="space-y-1">{selectedServices.map((s) => <li key={s.id} className="text-sm text-slate-700 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />{s.name}</li>)}</ul>}
            </div>
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between"><p className="text-xs text-slate-400">Estimated Total</p><p className="text-lg font-bold text-blue-700">{inr(grandTotal)}</p></div>
            <div className="border-t border-slate-100 pt-3"><p className="text-xs text-slate-400">Est. Delivery</p><p className="font-semibold text-slate-800">{expectedDelivery ? fmtDateTime(expectedDelivery) : "—"}</p></div>
            <div className="border-t border-slate-100 pt-3"><p className="text-xs text-slate-400">Pickup</p><p className="font-semibold text-slate-800">{pickupRequired ? [pickupDate, pickupTimeSlot].filter(Boolean).join(" · ") || "Required" : "Not Required"}</p></div>
            <div className="border-t border-slate-100 pt-3"><p className="text-xs text-slate-400">Delivery</p><p className="font-semibold text-slate-800">{deliveryRequired ? [deliveryDate, deliveryTimeSlot].filter(Boolean).join(" · ") || "Required" : "Not Required"}</p></div>
            {/* A pickup order is NOT at the store yet, so it does not start at
                Store Audit — the order engine starts it awaiting pickup. */}
            <div className="border-t border-slate-100 pt-3"><p className="text-xs text-slate-400">Order Status</p><Badge variant="outline" className="mt-1 border-amber-300 text-amber-700 bg-amber-50">{pickupRequired ? "Awaiting Pickup" : "Pending Store Audit"}</Badge></div>
          </CardContent>
        </Card>
        </div>
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
