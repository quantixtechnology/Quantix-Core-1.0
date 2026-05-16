"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { PageHeader } from "../shared/page-header"
import { StatusBadge, CurrencyBadge } from "../shared/status-badge"
import { EmptyState } from "../shared/empty-state"
import { businessTypeConfig } from "@/components/dashboard/data"
import type { BusinessType } from "@/components/dashboard/data"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Building2, Plus, Search, X, MapPin, Phone, Mail, IndianRupee,
  ShoppingCart, Users, Wifi, WifiOff, Puzzle, Store, CreditCard, RefreshCw, AlertTriangle,
  LogIn, Copy, Check, Hash, Globe, ImageIcon, Save, Palette,
} from "lucide-react"
import { AvatarImage } from "@/components/ui/avatar"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"

// ---- Plan data type ----
interface PlanApiData {
  id: string;
  tier: string;
  billingCycle: string;
  price: number;
  name: string;
}

// ---- API data types ----
interface BusinessApiData {
  id: string; businessCode: string | null; name: string; slug: string; businessType: string; status: string
  city: string | null; state: string | null; pincode: string | null; address: string | null
  contactEmail: string | null; contactPhone: string | null; gstNumber: string | null
  isOnline: boolean; primaryColor: string; logo: string | null; createdAt: string; onboardedAt: string | null; activatedAt: string | null
  subscription: {
    id: string; status: string; planPrice: number; customPrice: number | null
    discountPercentage: number | null; manualPriceOverride: boolean; overrideReason: string | null
    billingCycle: string; billingCycleDay: number | null; currentPeriodStart: string; nextBillingDate: string
    plan: { name: string; tier: string; billingCycle: string; price: number } | null
  } | null
  domain: { domain: string; status: string } | null
  deployments: Array<{ id: string; type: string; status: string; version: string | null; healthStatus: string }>
  modules: Array<{ moduleKey: string; moduleName: string; status: string }>
  salesRep: string | null
  mainStore: { id: string; storeCode: string | null } | null
  storeCount: number; orderCount: number; customerCount: number; totalRevenue: number
}

// Filter options
const allStatuses = [
  { value: "ALL", label: "All Statuses" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "TRIAL", label: "Trial" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CHURNED", label: "Churned" },
]

const allTypes = [
  { value: "ALL", label: "All Types" },
  ...Object.entries(businessTypeConfig).map(([key, val]) => ({ value: key, label: val.label })),
]

const onlineFilterOptions = [
  { value: "ALL", label: "All" },
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
]

function formatCurrency(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value.toLocaleString("en-IN")}`
}

export function BusinessesView() {
  const { searchQuery, setCurrentBusiness } = useAdminStore()
  const { permissions } = useAuthStore()
  const canCreate = permissions.includes("businesses:create" as never)
  const canEdit = permissions.includes("businesses:edit" as never)
  const canImpersonate = permissions.includes("businesses:impersonate" as never)
  const [businesses, setBusinesses] = useState<BusinessApiData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [typeFilter, setTypeFilter] = useState<string>("ALL")
  const [onlineFilter, setOnlineFilter] = useState<string>("ALL")
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessApiData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [plans, setPlans] = useState<PlanApiData[]>([])
  const [activatingBusiness, setActivatingBusiness] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Branding & domain edit state
  const [brandingOpen, setBrandingOpen] = useState(false)
  const [editLogo, setEditLogo] = useState("")
  const [editDomain, setEditDomain] = useState("")
  const [editSubdomain, setEditSubdomain] = useState("")
  const [editPrimaryColor, setEditPrimaryColor] = useState("")
  const [savingBranding, setSavingBranding] = useState(false)
  const [createdResult, setCreatedResult] = useState<{
    businessCode: string | null; businessId: string
    mainStoreCode: string | null; registrationDate: string
    subscriptionStart: string; renewalDate: string
    ownerEmail: string; ownerPassword: string
  } | null>(null)

  const copyBusinessId = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(slug)
    setCopiedId(slug)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Form state
  const [formName, setFormName] = useState("")
  const [formSlug, setFormSlug] = useState("")
  const [formType, setFormType] = useState<string>("")
  const [formPlan, setFormPlan] = useState<string>("")
  const [formCity, setFormCity] = useState("")
  const [formState, setFormState] = useState("")
  const [formPincode, setFormPincode] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formAddress, setFormAddress] = useState("")
  const [formGST, setFormGST] = useState("")
  const [formSubscriptionAmount, setFormSubscriptionAmount] = useState("")
  const [formRenewalDate, setFormRenewalDate] = useState("")
  const [formSubscriptionNotes, setFormSubscriptionNotes] = useState("")
  const [formOwnerName, setFormOwnerName] = useState("")
  const [formOwnerEmail, setFormOwnerEmail] = useState("")
  const [formOwnerPassword, setFormOwnerPassword] = useState("")

  const fetchBusinesses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/businesses?limit=100", {
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error("Failed to fetch businesses")
      const json = await res.json()
      if (json.success) setBusinesses(json.data)
      else throw new Error(json.error || "Failed to load businesses")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load businesses")
      toast.error(err instanceof Error ? err.message : "Failed to load businesses")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/core/platform/plans", {
        headers: getAuthHeaders(),
      })
      if (!res.ok) return
      const json = await res.json()
      if (json.success) setPlans(json.data)
    } catch {
      // Plans fetch failure is non-critical — creation will fail gracefully
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBusinesses(); fetchPlans()
  }, [])

  const filteredBusinesses = useMemo(() => {
    return businesses.filter((biz) => {
      const matchSearch = !searchQuery ||
        biz.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        biz.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (biz.city || "").toLowerCase().includes(searchQuery.toLowerCase())
      const matchStatus = statusFilter === "ALL" || biz.status === statusFilter
      const matchType = typeFilter === "ALL" || biz.businessType === typeFilter
      const matchOnline = onlineFilter === "ALL" ||
        (onlineFilter === "ONLINE" && biz.isOnline) ||
        (onlineFilter === "OFFLINE" && !biz.isOnline)
      return matchSearch && matchStatus && matchType && matchOnline
    })
  }, [businesses, searchQuery, statusFilter, typeFilter, onlineFilter])

  const resetForm = () => {
    setFormName(""); setFormSlug(""); setFormType(""); setFormPlan("")
    setFormCity(""); setFormState(""); setFormPincode("")
    setFormPhone(""); setFormEmail(""); setFormAddress("")
    setFormGST(""); setFormSubscriptionAmount(""); setFormRenewalDate(""); setFormSubscriptionNotes("")
    setFormOwnerName(""); setFormOwnerEmail(""); setFormOwnerPassword("")
    setCreatedResult(null)
  }

  const handleNameChange = (value: string) => {
    setFormName(value)
    setFormSlug(value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "").replace(/-+/g, "").slice(0, 20))
  }

  const handleCreateBusiness = async () => {
    if (!formName || !formSlug || !formType) {
      toast.error("Please fill in required fields: Name, Slug, Business Type")
      return
    }
    if (!formPlan) {
      toast.error("Please select a plan")
      return
    }

    // Parse formPlan (e.g. "STANDARD_HALF_YEARLY") into tier + billingCycle at first underscore
    const firstUnderscore = formPlan.indexOf("_")
    const tierPart = formPlan.slice(0, firstUnderscore)
    const cyclePart = formPlan.slice(firstUnderscore + 1) as 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY'

    // Look up planId from fetched plans
    const matchingPlan = plans.find(
      (p) => p.tier === tierPart && p.billingCycle === cyclePart
    )
    if (!matchingPlan) {
      toast.error("Selected plan not found. Please refresh and try again.")
      return
    }

    setCreating(true)
    try {
      const res = await fetch("/api/core/businesses", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: formName, slug: formSlug, businessType: formType,
          planId: matchingPlan.id,
          billingCycle: cyclePart,
          city: formCity, state: formState, pincode: formPincode,
          contactPhone: formPhone, contactEmail: formEmail,
          address: formAddress, gstNumber: formGST,
          customPrice: formSubscriptionAmount ? Number(formSubscriptionAmount) : undefined,
          renewalDate: formRenewalDate || undefined,
          subscriptionNotes: formSubscriptionNotes || undefined,
          ownerName: formOwnerName || undefined,
          ownerEmail: formOwnerEmail || undefined,
          ownerPassword: formOwnerPassword || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Business created successfully")
        const d = json.data
        setCreatedResult({
          businessCode: d?.businessCode ?? null,
          businessId: d?.slug ?? formSlug,
          mainStoreCode: d?.mainStoreCode ?? null,
          registrationDate: d?.createdAt ? new Date(d.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
          subscriptionStart: d?.businessSubscription?.currentPeriodStart ? new Date(d.businessSubscription.currentPeriodStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
          renewalDate: d?.businessSubscription?.nextBillingDate ? new Date(d.businessSubscription.nextBillingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—",
          ownerEmail: d?.ownerCredentials?.email ?? formOwnerEmail,
          ownerPassword: d?.ownerCredentials?.password ?? "—",
        })
        fetchBusinesses()
      } else {
        const errMsg = json.error || json.message || "Failed to create business"
        toast.error(errMsg)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create business")
    } finally {
      setCreating(false)
    }
  }

  const openBrandingEditor = (biz: BusinessApiData) => {
    setEditLogo(biz.logo ?? "")
    setEditDomain(biz.domain?.domain ?? "")
    setEditSubdomain("")
    setEditPrimaryColor(biz.primaryColor ?? "#10B981")
    setBrandingOpen(true)
  }

  const handleSaveBranding = async (biz: BusinessApiData) => {
    setSavingBranding(true)
    try {
      const body: Record<string, unknown> = {
        logo: editLogo || null,
        primaryColor: editPrimaryColor,
      }
      if (editDomain) {
        body.domain = editDomain
        body.subdomain = editSubdomain || undefined
      }
      const res = await fetch(`/api/core/businesses/${biz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to save")
      toast.success("Branding & domain saved")
      setBrandingOpen(false)
      fetchBusinesses()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSavingBranding(false)
    }
  }

  const handleToggleOnline = async (biz: BusinessApiData) => {
    try {
      const res = await fetch(`/api/core/businesses/${biz.id}/toggle-online`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isOnline: !biz.isOnline }),
      })
      if (res.ok) {
        toast.success(`${biz.name} is now ${!biz.isOnline ? "online" : "offline"}`)
        fetchBusinesses()
      } else {
        const json = await res.json()
        toast.error(json.error || "Failed to toggle online status")
      }
    } catch {
      toast.error("Failed to toggle online status")
    }
  }

  const handleActivateBusiness = async (biz: BusinessApiData) => {
    setActivatingBusiness(true)
    try {
      if (biz.status !== "ACTIVE") {
        const res = await fetch(`/api/core/businesses/${biz.id}/status`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({ status: "ACTIVE" }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          toast.error(json.error || "Failed to activate business")
          return
        }
        toast.success("Business activated successfully")
      } else if (biz.subscription && biz.subscription.status !== "ACTIVE") {
        const res = await fetch(`/api/core/businesses/${biz.id}/subscription/reactivate`, {
          method: "POST",
          headers: getAuthHeaders(),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          toast.error(json.error || "Failed to reactivate subscription")
          return
        }
        toast.success("Subscription reactivated successfully")
      } else {
        toast.success("Business is already active")
      }
      fetchBusinesses()
    } catch {
      toast.error("Failed to activate business")
    } finally {
      setActivatingBusiness(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Business Management" description="Manage all platform businesses, subscriptions, and configurations" icon={Building2} />
        <Card><CardContent className="p-6"><Skeleton className="h-[400px] w-full" /></CardContent></Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Business Management" description="Manage all platform businesses, subscriptions, and configurations" icon={Building2} />
        <Card><CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchBusinesses} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Management"
        description="Manage all platform businesses, subscriptions, and configurations"
        icon={Building2}
        action={canCreate ? (
          <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm() }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Create Business</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Business</DialogTitle>
                <DialogDescription>Onboard a new business onto the Quantix platform</DialogDescription>
              </DialogHeader>

              {createdResult ? (
                /* ── Success screen ── */
                <div className="space-y-4 py-2">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-emerald-800">Business created successfully</p>
                    {/* Business identifiers */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Business Code</p>
                        <p className="font-mono text-sm font-bold text-emerald-900">{createdResult.businessCode ?? createdResult.businessId}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Store Code</p>
                        <p className="font-mono text-sm font-bold text-emerald-900">{createdResult.mainStoreCode ?? "—"}</p>
                      </div>
                    </div>
                    <Separator className="border-emerald-200" />
                    {/* Subscription dates */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Registered</p>
                        <p className="text-xs font-medium text-emerald-900">{createdResult.registrationDate}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Sub. Start</p>
                        <p className="text-xs font-medium text-emerald-900">{createdResult.subscriptionStart}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Renewal</p>
                        <p className="text-xs font-medium text-emerald-900">{createdResult.renewalDate}</p>
                      </div>
                    </div>
                    <Separator className="border-emerald-200" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Owner Credentials</p>
                      <p className="font-mono text-sm text-emerald-900">{createdResult.ownerEmail}</p>
                      <p className="font-mono text-sm text-emerald-900">{createdResult.ownerPassword}</p>
                    </div>
                    <p className="text-[11px] text-emerald-700">Share these credentials securely with the business owner. This password will not be shown again.</p>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => { setCreateOpen(false); resetForm() }}>Done</Button>
                  </DialogFooter>
                </div>
              ) : (
                /* ── Creation form ── */
                <>
                  <div className="grid gap-4 py-4">
                    {/* Business Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Business Name *</Label><Input placeholder="e.g. FreshMart Grocers" value={formName} onChange={(e) => handleNameChange(e.target.value)} /></div>
                      <div className="space-y-2">
                        <Label>Business ID (Slug) *</Label>
                        <Input placeholder="Auto-generated" value={formSlug} onChange={(e) => setFormSlug(e.target.value)} />
                        {formSlug && <p className="text-[10px] text-muted-foreground font-mono">ID: {formSlug}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Business Type *</Label>
                        <Select value={formType} onValueChange={setFormType}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>{Object.entries(businessTypeConfig).map(([key, val]) => (<SelectItem key={key} value={key}>{val.label}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Plan *</Label>
                        <Select value={formPlan} onValueChange={setFormPlan}><SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                          <SelectContent>
                            {plans.length > 0 ? plans.map((plan) => (
                              <SelectItem key={plan.id} value={`${plan.tier}_${plan.billingCycle}`}>
                                {plan.name} — ₹{plan.price.toLocaleString("en-IN")}/{plan.billingCycle === "MONTHLY" ? "mo" : plan.billingCycle === "QUARTERLY" ? "qtr" : plan.billingCycle === "HALF_YEARLY" ? "6mo" : "yr"}
                              </SelectItem>
                            )) : (
                              <>
                                <SelectItem value="STANDARD_MONTHLY">Standard Monthly</SelectItem>
                                <SelectItem value="STANDARD_QUARTERLY">Standard Quarterly</SelectItem>
                                <SelectItem value="STANDARD_HALF_YEARLY">Standard Half-Yearly</SelectItem>
                                <SelectItem value="STANDARD_YEARLY">Standard Yearly</SelectItem>
                                <SelectItem value="PRO_MONTHLY">Pro Monthly</SelectItem>
                                <SelectItem value="PRO_QUARTERLY">Pro Quarterly</SelectItem>
                                <SelectItem value="PRO_HALF_YEARLY">Pro Half-Yearly</SelectItem>
                                <SelectItem value="PRO_YEARLY">Pro Yearly</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>City</Label><Input placeholder="e.g. Mumbai" value={formCity} onChange={(e) => setFormCity(e.target.value)} /></div>
                      <div className="space-y-2"><Label>State</Label><Input placeholder="e.g. Maharashtra" value={formState} onChange={(e) => setFormState(e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Pincode</Label><Input placeholder="e.g. 400001" value={formPincode} onChange={(e) => setFormPincode(e.target.value)} /></div>
                      <div className="space-y-2"><Label>Phone</Label><Input placeholder="+91 98765 43210" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} /></div>
                    </div>
                    <div className="space-y-2"><Label>Business Email</Label><Input placeholder="contact@business.in" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Address</Label><Textarea placeholder="Full business address" rows={2} value={formAddress} onChange={(e) => setFormAddress(e.target.value)} /></div>
                    <div className="space-y-2"><Label>GST Number</Label><Input placeholder="e.g. 27AABCF1234A1Z5" value={formGST} onChange={(e) => setFormGST(e.target.value)} /></div>

                    <Separator />

                    {/* Owner Account */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold">Business Owner Account</p>
                      <p className="text-[11px] text-muted-foreground">Set the primary owner login credentials. Leave password blank to auto-generate.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Owner Name</Label><Input placeholder="e.g. Rahul Sharma" value={formOwnerName} onChange={(e) => setFormOwnerName(e.target.value)} /></div>
                      <div className="space-y-2"><Label>Owner Email *</Label><Input placeholder="owner@business.in" type="email" value={formOwnerEmail} onChange={(e) => setFormOwnerEmail(e.target.value)} /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>Owner Password <span className="text-muted-foreground font-normal">(blank = auto-generated)</span></Label>
                      <Input type="text" placeholder="Leave blank to auto-generate" value={formOwnerPassword} onChange={(e) => setFormOwnerPassword(e.target.value)} className="font-mono" />
                    </div>

                    <Separator />

                    {/* Subscription & Renewal */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold">Subscription & Renewal</p>
                      <p className="text-[11px] text-muted-foreground">Set agreed amount and renewal cycle. Amount overrides the plan price.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Subscription Amount (₹)</Label><Input placeholder="e.g. 3999" type="number" value={formSubscriptionAmount} onChange={(e) => setFormSubscriptionAmount(e.target.value)} /></div>
                      <div className="space-y-2">
                        <Label>Renewal Date</Label>
                        <Input type="date" value={formRenewalDate} onChange={(e) => setFormRenewalDate(e.target.value)} />
                        {formRenewalDate && <p className="text-[10px] text-muted-foreground">Billing day: {new Date(formRenewalDate).getDate()} of each month</p>}
                      </div>
                    </div>
                    <div className="space-y-2"><Label>Subscription Notes <span className="text-muted-foreground font-normal">(optional)</span></Label><Input placeholder="e.g. Negotiated rate, promotional offer" value={formSubscriptionNotes} onChange={(e) => setFormSubscriptionNotes(e.target.value)} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm() }}>Cancel</Button>
                    <Button onClick={handleCreateBusiness} disabled={creating}>{creating ? "Creating..." : "Create Business"}</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search businesses..." className="pl-8 h-9" value={searchQuery} readOnly />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>{allStatuses.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Business Type" /></SelectTrigger>
          <SelectContent>{allTypes.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
        </Select>
        <Select value={onlineFilter} onValueChange={setOnlineFilter}>
          <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Online" /></SelectTrigger>
          <SelectContent>{onlineFilterOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
        </Select>
        {(statusFilter !== "ALL" || typeFilter !== "ALL" || onlineFilter !== "ALL") && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("ALL"); setTypeFilter("ALL"); setOnlineFilter("ALL") }}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Business Table */}
      {filteredBusinesses.length === 0 ? (
        <EmptyState icon={Building2} title="No businesses found" description="Try adjusting your filters or create a new business" action={{ label: "Create Business", onClick: () => setCreateOpen(true) }} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Customers</TableHead>
                    <TableHead className="text-center">Online</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBusinesses.map((biz) => {
                    const typeConf = businessTypeConfig[biz.businessType as BusinessType]
                    const sub = biz.subscription
                    return (
                      <TableRow key={biz.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedBusiness(biz); setDetailOpen(true) }}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: typeConf ? `${typeConf.color}18` : undefined, color: typeConf?.color }}>
                                {biz.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">{biz.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-medium" style={{ borderColor: typeConf?.color, color: typeConf?.color }}>
                                  {typeConf?.label || biz.businessType}
                                </Badge>
                                {biz.city && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{biz.city}</span>}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => copyBusinessId(biz.slug, e)}
                                className="flex items-center gap-1 mt-0.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors group"
                              >
                                <Hash className="h-2.5 w-2.5" />
                                {biz.slug}
                                {copiedId === biz.slug
                                  ? <Check className="h-2.5 w-2.5 text-emerald-600" />
                                  : <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                              </button>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge status={biz.status} /></TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{sub?.plan?.name || sub?.plan?.tier || "No Plan"}</span>
                            {sub?.customPrice && (
                              <span className="text-[10px] text-orange-600 font-medium">Custom: ₹{sub.customPrice.toLocaleString("en-IN")}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(biz.totalRevenue)}</TableCell>
                        <TableCell className="text-right text-sm">{biz.orderCount.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right text-sm">{biz.customerCount.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-center">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Switch checked={biz.isOnline} onCheckedChange={() => handleToggleOnline(biz)} className="data-[state=checked]:bg-emerald-500" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setSelectedBusiness(biz); setDetailOpen(true) }}>View</Button>
                            {canImpersonate && (
                              <Button
                                variant="outline" size="sm"
                                className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
                                onClick={() => setCurrentBusiness(biz.id, biz.name, biz.businessType, biz.slug)}
                              >
                                <LogIn className="size-3" />
                                Login As
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) { setSelectedBusiness(null); setBrandingOpen(false) } }}>
        <SheetContent className="w-[520px] sm:max-w-[520px] p-0">
          {selectedBusiness && (() => {
            const biz = selectedBusiness
            const typeConf = businessTypeConfig[biz.businessType as BusinessType]
            const sub = biz.subscription
            const enabledModules = biz.modules.filter(m => m.status === "ENABLED")
            return (
              <>
                <SheetHeader className="px-6 pt-6 pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={biz.logo ?? undefined} alt={biz.name} className="object-contain" />
                      <AvatarFallback className="text-sm font-semibold" style={{ backgroundColor: typeConf ? `${typeConf.color}18` : undefined, color: typeConf?.color }}>
                        {biz.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <SheetTitle className="text-lg">{biz.name}</SheetTitle>
                        {canImpersonate && (
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1 shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => { setDetailOpen(false); setCurrentBusiness(biz.id, biz.name, biz.businessType, biz.slug) }}
                          >
                            <LogIn className="size-3" />
                            Login as Business
                          </Button>
                        )}
                      </div>
                      <SheetDescription className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium" style={{ borderColor: typeConf?.color, color: typeConf?.color }}>{typeConf?.label}</Badge>
                        <StatusBadge status={biz.status} />
                        {biz.isOnline ? <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium"><Wifi className="h-3 w-3" /> Online</span>
                          : <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium"><WifiOff className="h-3 w-3" /> Offline</span>}
                      </SheetDescription>
                      {/* Business ID — tenant identifier */}
                      <button
                        type="button"
                        onClick={(e) => copyBusinessId(biz.slug, e)}
                        className="flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded bg-muted hover:bg-muted/80 transition-colors group w-fit"
                      >
                        <Hash className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[11px] font-mono font-medium text-muted-foreground">{biz.slug}</span>
                        {copiedId === biz.slug
                          ? <Check className="h-3 w-3 text-emerald-600" />
                          : <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </button>
                    </div>
                  </div>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-120px)]">
                  <div className="space-y-6 p-6">
                    {/* Business Overview */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Overview</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border p-3 flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-[10px] text-muted-foreground">City</p><p className="text-sm font-medium">{biz.city || "—"}{biz.state ? `, ${biz.state}` : ""}</p>{biz.pincode && <p className="text-[10px] text-muted-foreground">PIN {biz.pincode}</p>}</div></div>
                        <div className="rounded-lg border p-3 flex items-start gap-2"><Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-[10px] text-muted-foreground">Phone</p><p className="text-sm font-medium">{biz.contactPhone || "—"}</p></div></div>
                        <div className="rounded-lg border p-3 flex items-start gap-2 col-span-2"><Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-[10px] text-muted-foreground">Email</p><p className="text-sm font-medium">{biz.contactEmail || "—"}</p></div></div>
                      </div>
                    </div>
                    <Separator />
                    {/* Performance */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Performance</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <Card className="shadow-none"><CardContent className="p-3 text-center"><IndianRupee className="h-4 w-4 text-emerald-600 mx-auto mb-1" /><p className="text-lg font-bold">{formatCurrency(biz.totalRevenue)}</p><p className="text-[10px] text-muted-foreground">Revenue</p></CardContent></Card>
                        <Card className="shadow-none"><CardContent className="p-3 text-center"><ShoppingCart className="h-4 w-4 text-sky-600 mx-auto mb-1" /><p className="text-lg font-bold">{biz.orderCount.toLocaleString("en-IN")}</p><p className="text-[10px] text-muted-foreground">Orders</p></CardContent></Card>
                        <Card className="shadow-none"><CardContent className="p-3 text-center"><Users className="h-4 w-4 text-violet-600 mx-auto mb-1" /><p className="text-lg font-bold">{biz.customerCount.toLocaleString("en-IN")}</p><p className="text-[10px] text-muted-foreground">Customers</p></CardContent></Card>
                      </div>
                    </div>
                    <Separator />
                    {/* Active Modules */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Modules</h4>
                      {enabledModules.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {enabledModules.map((mod) => (<Badge key={mod.moduleKey} variant="secondary" className="text-xs gap-1.5 py-1 px-2.5 bg-muted/80"><Puzzle className="h-3 w-3 text-muted-foreground" />{mod.moduleName}</Badge>))}
                        </div>
                      ) : (<p className="text-sm text-muted-foreground">No modules enabled</p>)}
                    </div>
                    <Separator />
                    {/* Store Configuration */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Store Configuration</h4>
                      <div className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50"><Store className="h-4.5 w-4.5 text-amber-600" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{biz.storeCount} {biz.storeCount === 1 ? "Store" : "Stores"}</p>
                          <p className="text-[10px] text-muted-foreground">{biz.city ? `Across ${biz.city}` : "Main store"}</p>
                        </div>
                        {biz.mainStore?.storeCode && (
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Primary Store</p>
                            <p className="font-mono text-xs font-semibold">{biz.mainStore.storeCode}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator />
                    {/* Subscription */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div><h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscription</h4></div>
                        {(biz.status !== "ACTIVE" || (sub && sub.status !== "ACTIVE")) && (
                          <Button
                            size="sm"
                            onClick={() => handleActivateBusiness(biz)}
                            disabled={activatingBusiness}
                          >
                            {biz.status !== "ACTIVE" ? "Activate Business" : "Reactivate Subscription"}
                          </Button>
                        )}
                      </div>
                      {sub ? (
                        <div className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{sub.plan?.name || sub.plan?.tier || "Unknown"} Plan</span></div>
                            <StatusBadge status={sub.status} />
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><p className="text-[10px] text-muted-foreground">Billing</p><p className="font-medium">{sub.billingCycle === "MONTHLY" || sub.billingCycle === "monthly" ? "Monthly" : sub.billingCycle === "QUARTERLY" ? "Quarterly" : sub.billingCycle === "HALF_YEARLY" ? "Half-Yearly" : "Yearly"}{sub.billingCycleDay ? ` · day ${sub.billingCycleDay}` : ""}</p></div>
                            <div><p className="text-[10px] text-muted-foreground">Price</p>
                              {sub.customPrice ? <CurrencyBadge amount={sub.customPrice} override original={sub.planPrice} /> : <p className="font-medium">₹{sub.planPrice.toLocaleString("en-IN")}</p>}
                            </div>
                            <div><p className="text-[10px] text-muted-foreground">Sub. Started</p><p className="font-medium">{new Date(sub.currentPeriodStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div>
                            <div><p className="text-[10px] text-muted-foreground">Renewal Due</p><p className="font-medium">{new Date(sub.nextBillingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div>
                            {sub.discountPercentage && <div><p className="text-[10px] text-muted-foreground">Discount</p><p className="font-medium text-orange-600">{sub.discountPercentage}% off</p></div>}
                          </div>
                        </div>
                      ) : (<div className="rounded-lg border border-dashed p-4 text-center"><p className="text-sm text-muted-foreground">No active subscription</p></div>)}
                    </div>
                    {biz.deployments.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deployments</h4>
                          <div className="space-y-1.5">
                            {biz.deployments.map((dep) => (
                              <div key={dep.id} className="rounded-lg border p-2.5 flex items-center justify-between">
                                <div className="flex items-center gap-2"><span className="text-xs font-medium">{dep.type.replace(/_/g, " ")}</span><span className="text-[10px] text-muted-foreground">v{dep.version || "?"}</span></div>
                                <StatusBadge status={dep.status} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    <Separator />
                    {/* Branding & Domain */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branding & Domain</h4>
                        {!brandingOpen && canEdit && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openBrandingEditor(biz)}>
                            <Palette className="size-3" /> Edit
                          </Button>
                        )}
                      </div>

                      {brandingOpen ? (
                        <div className="rounded-lg border p-4 space-y-4">
                          {/* Logo URL */}
                          <div className="space-y-2">
                            <Label className="text-xs font-medium flex items-center gap-1.5"><ImageIcon className="size-3" /> Business Logo URL</Label>
                            <Input
                              placeholder="https://example.com/logo.png"
                              value={editLogo}
                              onChange={(e) => setEditLogo(e.target.value)}
                              className="h-8 text-xs"
                            />
                            {editLogo && (
                              <div className="flex items-center gap-3 rounded-lg border border-dashed p-2 bg-muted/30">
                                <img src={editLogo} alt="Preview" className="h-10 w-10 rounded object-contain bg-white border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                                <p className="text-[10px] text-muted-foreground">Logo preview</p>
                              </div>
                            )}
                          </div>

                          {/* Domain */}
                          <div className="space-y-2">
                            <Label className="text-xs font-medium flex items-center gap-1.5"><Globe className="size-3" /> Custom Domain</Label>
                            <Input
                              placeholder="e.g. royalmart.in"
                              value={editDomain}
                              onChange={(e) => setEditDomain(e.target.value)}
                              className="h-8 text-xs font-mono"
                            />
                            <p className="text-[10px] text-muted-foreground">Enter the domain without https://. DNS must point to the server.</p>
                          </div>

                          {/* Subdomain */}
                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Subdomain <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Input
                              placeholder="e.g. app or store"
                              value={editSubdomain}
                              onChange={(e) => setEditSubdomain(e.target.value)}
                              className="h-8 text-xs font-mono"
                            />
                          </div>

                          {/* Primary Color */}
                          <div className="space-y-2">
                            <Label className="text-xs font-medium flex items-center gap-1.5"><Palette className="size-3" /> Brand Color</Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={editPrimaryColor}
                                onChange={(e) => setEditPrimaryColor(e.target.value)}
                                className="h-8 w-10 cursor-pointer rounded border p-0.5"
                              />
                              <Input
                                value={editPrimaryColor}
                                onChange={(e) => setEditPrimaryColor(e.target.value)}
                                className="h-8 text-xs font-mono flex-1"
                                placeholder="#10B981"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => setBrandingOpen(false)} disabled={savingBranding}>
                              Cancel
                            </Button>
                            <Button size="sm" className="h-7 text-xs flex-1 gap-1" onClick={() => handleSaveBranding(biz)} disabled={savingBranding}>
                              <Save className="size-3" />{savingBranding ? "Saving…" : "Save Changes"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {biz.logo ? (
                            <div className="rounded-lg border p-3 flex items-center gap-3">
                              <img src={biz.logo} alt="Logo" className="h-10 w-10 rounded object-contain bg-white border" />
                              <div><p className="text-[10px] text-muted-foreground">Logo</p><p className="text-xs font-mono truncate max-w-[220px]">{biz.logo}</p></div>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed p-3 text-center">
                              <ImageIcon className="size-4 text-muted-foreground mx-auto mb-1" />
                              <p className="text-xs text-muted-foreground">No logo set</p>
                            </div>
                          )}
                          {biz.domain ? (
                            <div className="rounded-lg border p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2"><Globe className="size-3.5 text-muted-foreground" /><div><p className="text-[10px] text-muted-foreground">Domain</p><p className="text-sm font-mono font-medium">{biz.domain.domain}</p></div></div>
                              <StatusBadge status={biz.domain.status} />
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed p-3 text-center">
                              <Globe className="size-4 text-muted-foreground mx-auto mb-1" />
                              <p className="text-xs text-muted-foreground">No domain configured</p>
                            </div>
                          )}
                          <div className="rounded-lg border p-3 flex items-center gap-2">
                            <div className="size-5 rounded-full border" style={{ backgroundColor: biz.primaryColor }} />
                            <div><p className="text-[10px] text-muted-foreground">Brand Color</p><p className="text-xs font-mono">{biz.primaryColor}</p></div>
                          </div>
                        </div>
                      )}
                    </div>
                    <Separator />
                    {/* Business Details */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Details</h4>
                      <div className="space-y-2">
                        {/* Human-readable ID */}
                        {biz.businessCode && (
                          <div className="rounded-lg border p-3 bg-muted/30">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Business Code</p>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-mono font-bold text-foreground">{biz.businessCode}</p>
                              <button type="button" onClick={(e) => copyBusinessId(biz.businessCode!, e)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                                {copiedId === biz.businessCode ? <><Check className="h-3 w-3 text-emerald-600" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Slug / tenant ID */}
                        <div className="rounded-lg border p-3 bg-muted/30">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Tenant Slug (API / URL)</p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-mono font-semibold text-foreground">{biz.slug}</p>
                            <button type="button" onClick={(e) => copyBusinessId(biz.slug, e)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                              {copiedId === biz.slug ? <><Check className="h-3 w-3 text-emerald-600" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                            </button>
                          </div>
                        </div>
                        <div className="rounded-lg border p-3"><p className="text-[10px] text-muted-foreground">Address</p><p className="text-sm">{biz.address || [biz.city, biz.state, biz.pincode, "India"].filter(Boolean).join(", ")}</p></div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg border p-3"><p className="text-[10px] text-muted-foreground">GST</p><p className="text-sm font-mono">{biz.gstNumber || "—"}</p></div>
                          <div className="rounded-lg border p-3"><p className="text-[10px] text-muted-foreground">Registration Date</p><p className="text-sm font-medium">{new Date(biz.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
