"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Settings, Save, RotateCcw, MapPin, Clock, Printer, Building2, Lock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { setBusinessContext } from "@/lib/api-client"
import { showSuccess, showError } from "@/lib/toast-utils"
import { PageHeader } from "@/components/admin/shared/page-header"
import { useAdminStore } from "@/stores/admin-store"
import { useBusinessContext } from "@/hooks/use-business-context"
import { getAuthHeaders } from "@/lib/admin-fetch"

// ─── Types ─────────────────────────────────────────────────────────────────

type DayName = "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY"

interface StoreTiming {
  day: DayName
  // Maps to DB: day=0 (Sun)…6 (Sat)
  dayIndex: number
  open: string
  close: string
  isClosed: boolean
}

// Day index: StoreTiming.day column is 0=Sun, 1=Mon … 6=Sat
const DAY_DEFS: { name: DayName; index: number }[] = [
  { name: "MONDAY",    index: 1 },
  { name: "TUESDAY",   index: 2 },
  { name: "WEDNESDAY", index: 3 },
  { name: "THURSDAY",  index: 4 },
  { name: "FRIDAY",    index: 5 },
  { name: "SATURDAY",  index: 6 },
  { name: "SUNDAY",    index: 0 },
]

const defaultStoreTiming: StoreTiming[] = DAY_DEFS.map(({ name, index }) => ({
  day: name,
  dayIndex: index,
  open: name === "SUNDAY" ? "09:00" : "08:00",
  close: name === "SUNDAY" ? "20:00" : "22:00",
  isClosed: false,
}))

const gstRates = [
  { rate: "0%",  label: "0% (Exempt)",  enabled: true },
  { rate: "5%",  label: "5%",            enabled: true },
  { rate: "12%", label: "12%",           enabled: true },
  { rate: "18%", label: "18%",           enabled: true },
  { rate: "28%", label: "28%",           enabled: false },
]

// ─── Component ─────────────────────────────────────────────────────────────

export function StoreSettingsView() {
  const { businessId }            = useBusinessContext()
  const { currentBusinessId }     = useAdminStore()
  const effectiveBizId            = currentBusinessId || businessId || ""

  useEffect(() => { if (businessId) setBusinessContext(businessId) }, [businessId])

  // ── Business Profile ──────────────────────────────────────────────────────
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving,  setProfileSaving]  = useState(false)
  const [profileBizId,   setProfileBizId]   = useState("")
  const [profileName,    setProfileName]    = useState("")
  const [profilePhone,   setProfilePhone]   = useState("")
  const [profileEmail,   setProfileEmail]   = useState("")
  const [profileGst,     setProfileGst]     = useState("")
  const [profileAddress, setProfileAddress] = useState("")
  const [profileCity,    setProfileCity]    = useState("")
  const [profileState,   setProfileState]   = useState("")
  const [profilePincode, setProfilePincode] = useState("")
  const [profileStatus,  setProfileStatus]  = useState("")

  useEffect(() => {
    if (!effectiveBizId) return
    setProfileLoading(true)
    fetch(`/api/core/businesses/${effectiveBizId}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data) {
          const d = j.data
          setProfileBizId(d.id ?? "")
          setProfileName(d.name ?? "")
          setProfilePhone(d.contactPhone ?? "")
          setProfileEmail(d.contactEmail ?? "")
          setProfileGst(d.gstNumber ?? "")
          setProfileAddress(d.address ?? "")
          setProfileCity(d.city ?? "")
          setProfileState(d.state ?? "")
          setProfilePincode(d.pincode ?? "")
          setProfileStatus(d.status ?? "")
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false))
  }, [effectiveBizId])

  const handleSaveProfile = async () => {
    if (!effectiveBizId) return
    setProfileSaving(true)
    try {
      const res = await fetch(`/api/core/businesses/${effectiveBizId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          name: profileName, contactPhone: profilePhone, contactEmail: profileEmail,
          gstNumber: profileGst, address: profileAddress, city: profileCity,
          state: profileState, pincode: profilePincode,
        }),
      })
      const json = await res.json()
      if (json.success) showSuccess("Business profile saved")
      else showError(json.error || "Failed to save profile")
    } catch { showError("Failed to save profile") }
    finally { setProfileSaving(false) }
  }

  // ── Store tab ─────────────────────────────────────────────────────────────
  const [storeLoading,  setStoreLoading]  = useState(false)
  const [storeSaving,   setStoreSaving]   = useState(false)
  const [storeId,       setStoreId]       = useState<string | null>(null)
  const [storeName,     setStoreName]     = useState("")
  const [storePhone,    setStorePhone]    = useState("")
  const [storeEmail,    setStoreEmail]    = useState("")
  const [storeAddress,  setStoreAddress]  = useState("")
  const [isOnline,      setIsOnline]      = useState(false)
  const [minOrder,      setMinOrder]      = useState("0")
  const [prepTime,      setPrepTime]      = useState("30")
  const [timings,       setTimings]       = useState<StoreTiming[]>(defaultStoreTiming)

  // Load store + business.isOnline on mount
  useEffect(() => {
    if (!effectiveBizId) return
    setStoreLoading(true)
    Promise.all([
      fetch(`/api/core/stores?businessId=${effectiveBizId}`, { headers: getAuthHeaders() })
        .then(r => r.json()),
      fetch(`/api/core/businesses/${effectiveBizId}`, { headers: getAuthHeaders() })
        .then(r => r.json()),
    ])
      .then(([storesJson, bizJson]) => {
        // Store settings
        const store = Array.isArray(storesJson?.data) ? storesJson.data[0] : null
        if (store) {
          setStoreId(store.id)
          setStoreName(store.name ?? "")
          setStorePhone(store.phone ?? "")
          setStoreEmail(store.email ?? "")
          setStoreAddress(store.address ?? "")
          setMinOrder(String(store.minOrderAmount ?? 0))
          setPrepTime(String(store.preparationTime ?? 30))

          // Load timings from DB
          if (store.storeTimings && store.storeTimings.length > 0) {
            const dbTimings: StoreTiming[] = DAY_DEFS.map(({ name, index }) => {
              const row = store.storeTimings.find((t: { day: number }) => t.day === index)
              return {
                day: name, dayIndex: index,
                open:    row?.openTime  ?? (name === "SUNDAY" ? "09:00" : "08:00"),
                close:   row?.closeTime ?? (name === "SUNDAY" ? "20:00" : "22:00"),
                isClosed: row?.isClosed ?? false,
              }
            })
            setTimings(dbTimings)
          }
        }
        // Business online/offline
        if (bizJson?.success) setIsOnline(bizJson.data?.isOnline ?? false)
      })
      .catch(() => {})
      .finally(() => setStoreLoading(false))
  }, [effectiveBizId])

  const handleSaveStore = async () => {
    if (!storeId) { showError("No store found for this business"); return }
    setStoreSaving(true)
    try {
      // 1. Update store fields
      const storeRes = await fetch(`/api/core/stores/${storeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          name: storeName, phone: storePhone, email: storeEmail, address: storeAddress,
          minOrderAmount: parseFloat(minOrder) || 0,
          preparationTime: parseInt(prepTime, 10) || 30,
        }),
      })
      const storeJson = await storeRes.json()
      if (!storeJson.success) { showError(storeJson.error || "Failed to save store"); return }

      // 2. Update store timings
      const timingsPayload = timings.map(t => ({
        day: t.dayIndex,
        openTime: t.open,
        closeTime: t.close,
        isClosed: t.isClosed,
      }))
      const timingsRes = await fetch(`/api/core/stores/${storeId}/timings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(timingsPayload),
      })
      const timingsJson = await timingsRes.json()
      if (!timingsJson.success) { showError(timingsJson.error || "Failed to save timings"); return }

      // 3. Update business isOnline
      const bizRes = await fetch(`/api/core/businesses/${effectiveBizId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ isOnline }),
      })
      const bizJson = await bizRes.json()
      if (!bizJson.success) { showError(bizJson.error || "Failed to save availability"); return }

      showSuccess("Store settings saved")
    } catch { showError("Failed to save store settings") }
    finally { setStoreSaving(false) }
  }

  // ── Delivery tab ──────────────────────────────────────────────────────────
  const [deliverySaving,     setDeliverySaving]     = useState(false)
  const [deliveryRadius,     setDeliveryRadius]     = useState("5")
  const [deliveryFee,        setDeliveryFee]        = useState("0")
  const [freeDeliveryAbove,  setFreeDeliveryAbove]  = useState("")

  useEffect(() => {
    if (!storeId) return
    fetch(`/api/core/stores/${storeId}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data) {
          setDeliveryRadius(String(j.data.deliveryRadius ?? 5))
          setDeliveryFee(String(j.data.deliveryFee ?? 0))
          setFreeDeliveryAbove(j.data.freeDeliveryAbove ? String(j.data.freeDeliveryAbove) : "")
        }
      })
      .catch(() => {})
  }, [storeId])

  const handleSaveDelivery = async () => {
    if (!storeId) { showError("No store found"); return }
    setDeliverySaving(true)
    try {
      const res = await fetch(`/api/core/stores/${storeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          deliveryRadius: parseFloat(deliveryRadius) || 5,
          deliveryFee: parseFloat(deliveryFee) || 0,
          freeDeliveryAbove: freeDeliveryAbove ? parseFloat(freeDeliveryAbove) : null,
        }),
      })
      const json = await res.json()
      if (json.success) showSuccess("Delivery settings saved")
      else showError(json.error || "Failed to save delivery settings")
    } catch { showError("Failed to save delivery settings") }
    finally { setDeliverySaving(false) }
  }

  // ── Checkout tab ──────────────────────────────────────────────────────────
  const [allowGuestCheckout,      setAllowGuestCheckout]      = useState(true)
  const [checkoutSettingLoading,  setCheckoutSettingLoading]  = useState(false)

  useEffect(() => {
    if (!effectiveBizId) return
    fetch(`/api/core/businesses/${effectiveBizId}/checkout-settings`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => { if (j.success) setAllowGuestCheckout(j.data?.allowGuestCheckout !== false) })
      .catch(() => {})
  }, [effectiveBizId])

  const handleSaveCheckoutSettings = async () => {
    if (!effectiveBizId) return
    setCheckoutSettingLoading(true)
    try {
      const res = await fetch(`/api/core/businesses/${effectiveBizId}/checkout-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ allowGuestCheckout }),
      })
      const json = await res.json()
      if (json.success) showSuccess("Checkout settings saved")
      else showError(json.error || "Failed to save")
    } catch { showError("Failed to save") }
    finally { setCheckoutSettingLoading(false) }
  }

  // ── Taxes tab ─────────────────────────────────────────────────────────────
  const [taxesSaving,       setTaxesSaving]       = useState(false)
  const [gstNumber,         setGstNumber]         = useState("")
  const [defaultGstRate,    setDefaultGstRate]    = useState("18%")
  const [includeGstInPrice, setIncludeGstInPrice] = useState(true)
  const [gstRateToggles,    setGstRateToggles]    = useState<Record<string, boolean>>(
    Object.fromEntries(gstRates.map((r) => [r.rate, r.enabled]))
  )

  // Load GST from business profile
  useEffect(() => { if (profileGst) setGstNumber(profileGst) }, [profileGst])

  const handleSaveTaxes = async () => {
    if (!effectiveBizId) return
    setTaxesSaving(true)
    try {
      const res = await fetch(`/api/core/businesses/${effectiveBizId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ gstNumber }),
      })
      const json = await res.json()
      if (json.success) showSuccess("Tax settings saved")
      else showError(json.error || "Failed to save tax settings")
    } catch { showError("Failed to save tax settings") }
    finally { setTaxesSaving(false) }
  }

  // ── Printer tab ──────────────────────────────────────────────────────────
  const [paperSize,     setPaperSize]     = useState("80mm")
  const [printerType,   setPrinterType]   = useState("thermal")
  const [autoPrint,     setAutoPrint]     = useState(true)
  const [printOnPayment,setPrintOnPayment]= useState(true)
  const [includeQr,     setIncludeQr]     = useState(true)
  const [receiptHeader, setReceiptHeader] = useState("")
  const [receiptFooter, setReceiptFooter] = useState("Thank you for shopping with us!\nVisit again soon.")
  const [numCopies,     setNumCopies]     = useState("2")
  const [printerSaving, setPrinterSaving] = useState(false)

  // Load printer config from store
  useEffect(() => {
    if (!storeId) return
    fetch(`/api/core/stores/${storeId}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data) {
          if (j.data.paperSize)   setPaperSize(j.data.paperSize)
          if (j.data.printerType) setPrinterType(j.data.printerType)
        }
      })
      .catch(() => {})
  }, [storeId])

  const handleSavePrinter = async () => {
    if (!storeId) { showError("No store found"); return }
    setPrinterSaving(true)
    try {
      const res = await fetch(`/api/core/stores/${storeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ paperSize, printerType }),
      })
      const json = await res.json()
      if (json.success) showSuccess("Printer settings saved")
      else showError(json.error || "Failed to save printer settings")
    } catch { showError("Failed to save printer settings") }
    finally { setPrinterSaving(false) }
  }

  // ── Timing helpers ────────────────────────────────────────────────────────

  const handleTimingToggle = (index: number) => {
    setTimings(prev => prev.map((t, i) => i === index ? { ...t, isClosed: !t.isClosed } : t))
  }
  const handleTimingChange = (index: number, field: "open" | "close", value: string) => {
    setTimings(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }
  const toggleGstRate = (rate: string) => {
    setGstRateToggles(prev => ({ ...prev, [rate]: !prev[rate] }))
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader title="Store Settings" description="Manage your store configuration and preferences" icon={Settings} />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Business Profile</TabsTrigger>
          <TabsTrigger value="general">Store</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="checkout">Checkout</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          <TabsTrigger value="printer">Printer</TabsTrigger>
        </TabsList>

        {/* ── Business Profile ─────────────────────────────────────────── */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="size-4" /> Business Profile
                  </CardTitle>
                  <CardDescription>Your registered business details.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveProfile} disabled={profileSaving} className="gap-1.5">
                  <Save className="size-3.5" />
                  {profileSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Lock className="size-3" /> Business ID</Label>
                      <Input value={profileBizId} readOnly className="h-9 text-xs font-mono bg-muted/40" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Lock className="size-3" /> Status</Label>
                      <div className="flex items-center h-9">
                        <Badge variant="outline" className={`text-xs ${profileStatus === "ACTIVE" ? "border-emerald-500 text-emerald-600" : "border-amber-500 text-amber-600"}`}>
                          {profileStatus || "—"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Business Name</Label>
                    <Input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Business name" className="h-9" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Contact Phone</Label>
                      <Input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="+91 98765 43210" className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Contact Email</Label>
                      <Input value={profileEmail} onChange={e => setProfileEmail(e.target.value)} placeholder="contact@business.in" className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">GST Number</Label>
                    <Input value={profileGst} onChange={e => setProfileGst(e.target.value)} placeholder="22AAAAA0000A1Z5" className="h-9 font-mono" />
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Address</Label>
                    <Textarea value={profileAddress} onChange={e => setProfileAddress(e.target.value)} placeholder="Street address" rows={2} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">City</Label>
                      <Input value={profileCity} onChange={e => setProfileCity(e.target.value)} placeholder="City" className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">State</Label>
                      <Input value={profileState} onChange={e => setProfileState(e.target.value)} placeholder="State" className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Pincode</Label>
                      <Input value={profilePincode} onChange={e => setProfilePincode(e.target.value)} placeholder="560001" className="h-9" />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Store Tab ────────────────────────────────────────────────── */}
        <TabsContent value="general" className="space-y-6">
          {storeLoading ? (
            <p className="text-sm text-muted-foreground px-1">Loading store data…</p>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Store Information</CardTitle>
                  <CardDescription>Contact details and availability</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Store Name</Label>
                      <Input value={storeName} onChange={e => setStoreName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input value={storePhone} onChange={e => setStorePhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input type="email" value={storeEmail} onChange={e => setStoreEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Input value={storeAddress} onChange={e => setStoreAddress(e.target.value)} />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Store Availability</Label>
                      <p className="text-sm text-muted-foreground">Toggle your store online or offline for customers</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={isOnline ? "default" : "destructive"} className="text-xs">
                        {isOnline ? "Online" : "Offline"}
                      </Badge>
                      <Switch checked={isOnline} onCheckedChange={setIsOnline} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="size-4" /> Store Timings
                  </CardTitle>
                  <CardDescription>Set your daily operating hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Open Time</TableHead>
                        <TableHead>Close Time</TableHead>
                        <TableHead className="text-center">Closed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timings.map((t, index) => (
                        <TableRow key={t.day}>
                          <TableCell className="font-medium">{t.day}</TableCell>
                          <TableCell>
                            <Input type="time" value={t.open} disabled={t.isClosed}
                              onChange={e => handleTimingChange(index, "open", e.target.value)}
                              className="w-32 h-8 text-sm" />
                          </TableCell>
                          <TableCell>
                            <Input type="time" value={t.close} disabled={t.isClosed}
                              onChange={e => handleTimingChange(index, "close", e.target.value)}
                              className="w-32 h-8 text-sm" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch checked={t.isClosed} onCheckedChange={() => handleTimingToggle(index)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Order Settings</CardTitle>
                  <CardDescription>Minimum order and preparation time — both enforced on order placement</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Minimum Order Amount (₹)</Label>
                      <Input type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Orders below this amount are rejected</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Preparation Time (minutes)</Label>
                      <Input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Shown to customer at checkout as estimated ready time</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center gap-3 justify-end">
                <Button variant="outline" className="gap-2" onClick={() => {
                  setStoreName(""); setStorePhone(""); setStoreEmail(""); setStoreAddress("")
                  setIsOnline(false); setMinOrder("0"); setPrepTime("30"); setTimings(defaultStoreTiming)
                }}>
                  <RotateCcw className="h-4 w-4" /> Reset
                </Button>
                <Button className="gap-2" onClick={handleSaveStore} disabled={storeSaving}>
                  <Save className="h-4 w-4" />
                  {storeSaving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Delivery Tab ─────────────────────────────────────────────── */}
        <TabsContent value="delivery" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delivery Configuration</CardTitle>
              <CardDescription>Radius, fees and free delivery threshold — saved to the store record</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Delivery Radius (km)</Label>
                <div className="flex items-center gap-4">
                  <Input type="number" value={deliveryRadius} onChange={e => setDeliveryRadius(e.target.value)} className="w-24 h-9" />
                  <span className="text-sm text-muted-foreground">km</span>
                  <div className="flex-1">
                    <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.min((Number(deliveryRadius) / 15) * 100, 100)}%` }} />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                      <span>0 km</span><span>15 km</span>
                    </div>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Delivery Fee (₹)</Label>
                  <Input type="number" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Standard delivery charge</p>
                </div>
                <div className="space-y-2">
                  <Label>Free Delivery Above (₹)</Label>
                  <Input type="number" value={freeDeliveryAbove} onChange={e => setFreeDeliveryAbove(e.target.value)} placeholder="e.g. 500" />
                  <p className="text-xs text-muted-foreground">Orders above this amount get free delivery (enforced on order creation)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex items-center gap-3 justify-end">
            <Button className="gap-2" onClick={handleSaveDelivery} disabled={deliverySaving}>
              <Save className="h-4 w-4" />
              {deliverySaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </TabsContent>

        {/* ── Checkout Tab ─────────────────────────────────────────────── */}
        <TabsContent value="checkout" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Guest Checkout</CardTitle>
              <CardDescription>Control whether customers can place orders without creating an account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border border-gray-200 rounded-xl px-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Allow Guest Checkout</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {allowGuestCheckout
                      ? "Customers can checkout without signing in."
                      : "Customers must sign in or register before placing an order."}
                  </p>
                </div>
                <Switch checked={allowGuestCheckout} onCheckedChange={setAllowGuestCheckout} />
              </div>
              {!allowGuestCheckout && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Guest checkout is OFF. The checkout screen will only show the Login / Register option.</span>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex items-center gap-3 justify-end">
            <Button className="gap-2" onClick={handleSaveCheckoutSettings} disabled={checkoutSettingLoading}>
              <Save className="h-4 w-4" />
              {checkoutSettingLoading ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </TabsContent>

        {/* ── Taxes Tab ────────────────────────────────────────────────── */}
        <TabsContent value="taxes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">GST Registration</CardTitle>
              <CardDescription>Saved to your business profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>GST Registration Number</Label>
                <Input value={gstNumber} onChange={e => setGstNumber(e.target.value)} placeholder="e.g., 27AABCF8078M1Z5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">GST Rates</CardTitle>
              <CardDescription>Enable or disable applicable GST rates</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rate</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gstRates.map(rate => (
                    <TableRow key={rate.rate}>
                      <TableCell className="font-medium">{rate.rate}</TableCell>
                      <TableCell className="text-muted-foreground">{rate.label}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={gstRateToggles[rate.rate]} onCheckedChange={() => toggleGstRate(rate.rate)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator className="my-4" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Default GST Rate</Label>
                  <Select value={defaultGstRate} onValueChange={setDefaultGstRate}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {gstRates.filter(r => gstRateToggles[r.rate]).map(rate => (
                        <SelectItem key={rate.rate} value={rate.rate}>{rate.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Include GST in Price</Label>
                    <p className="text-xs text-muted-foreground">Show prices inclusive of GST</p>
                  </div>
                  <Switch checked={includeGstInPrice} onCheckedChange={setIncludeGstInPrice} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 justify-end">
            <Button className="gap-2" onClick={handleSaveTaxes} disabled={taxesSaving}>
              <Save className="h-4 w-4" />
              {taxesSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </TabsContent>

        {/* ── Printer Tab ──────────────────────────────────────────────── */}
        <TabsContent value="printer" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Printer className="size-4" /> Printer Configuration
              </CardTitle>
              <CardDescription>Set up your receipt printer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Default Paper Size</Label>
                  <Select value={paperSize} onValueChange={setPaperSize}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58mm">58mm (2 inch)</SelectItem>
                      <SelectItem value="80mm">80mm (3 inch)</SelectItem>
                      <SelectItem value="A4">A4 (Full page)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Printer Type</Label>
                  <Select value={printerType} onValueChange={setPrinterType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thermal">Thermal</SelectItem>
                      <SelectItem value="bluetooth">Bluetooth</SelectItem>
                      <SelectItem value="usb">USB</SelectItem>
                      <SelectItem value="network">Network (LAN/WiFi)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                {[
                  { id: "autoPrint",     checked: autoPrint,      setter: setAutoPrint,      label: "Auto-print on New Order", desc: "Automatically print receipt when a new order arrives" },
                  { id: "printOnPay",    checked: printOnPayment, setter: setPrintOnPayment, label: "Print Receipt on Payment", desc: "Automatically print receipt when payment is confirmed" },
                  { id: "includeQr",     checked: includeQr,      setter: setIncludeQr,      label: "Include QR Code",          desc: "Add payment QR code on printed receipts" },
                ].map(({ id, checked, setter, label, desc }) => (
                  <div key={id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">{label}</Label>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch checked={checked} onCheckedChange={setter} />
                  </div>
                ))}
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Receipt Header Text</Label>
                  <Textarea value={receiptHeader} onChange={e => setReceiptHeader(e.target.value)} rows={3} className="text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Receipt Footer Text</Label>
                  <Textarea value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} rows={3} className="text-sm" />
                </div>
              </div>
              <div className="space-y-2 max-w-[200px]">
                <Label>Number of Copies</Label>
                <Select value={numCopies} onValueChange={setNumCopies}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Copy</SelectItem>
                    <SelectItem value="2">2 Copies</SelectItem>
                    <SelectItem value="3">3 Copies</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          <div className="flex items-center gap-3 justify-end">
            <Button className="gap-2" onClick={handleSavePrinter} disabled={printerSaving}>
              <Save className="h-4 w-4" />
              {printerSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
