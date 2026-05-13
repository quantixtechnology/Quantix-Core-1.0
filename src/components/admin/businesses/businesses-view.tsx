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
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { ExternalLink } from "lucide-react"
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
  id: string; name: string; slug: string; businessType: string; status: string
  city: string | null; state: string | null; address: string | null
  contactEmail: string | null; contactPhone: string | null; gstNumber: string | null
  isOnline: boolean; primaryColor: string; createdAt: string; onboardedAt: string | null; activatedAt: string | null
  subscription: {
    id: string; status: string; planPrice: number; customPrice: number | null
    discountPercentage: number | null; manualPriceOverride: boolean; overrideReason: string | null
    billingCycle: string; nextBillingDate: string
    plan: { name: string; tier: string; billingCycle: string; price: number } | null
  } | null
  domain: { domain: string; status: string } | null
  deployments: Array<{ id: string; type: string; status: string; version: string | null; healthStatus: string }>
  modules: Array<{ moduleKey: string; moduleName: string; status: string }>
  salesRep: string | null
  storeCount: number; orderCount: number; customerCount: number; totalRevenue: number
}

// Filter options
const allStatuses = [
  { value: "ALL", label: "All Statuses" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
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
  const [businesses, setBusinesses] = useState<BusinessApiData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [typeFilter, setTypeFilter] = useState<string>("ALL")
  const [onlineFilter, setOnlineFilter] = useState<string>("ALL")
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessApiData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [customPricing, setCustomPricing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [plans, setPlans] = useState<PlanApiData[]>([])
  const [activatingBusiness, setActivatingBusiness] = useState(false)

  // Form state
  const [formName, setFormName] = useState("")
  const [formSlug, setFormSlug] = useState("")
  const [formType, setFormType] = useState<string>("")
  const [formPlan, setFormPlan] = useState<string>("")
  const [formCity, setFormCity] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formAddress, setFormAddress] = useState("")
  const [formGST, setFormGST] = useState("")
  const [formCustomAmount, setFormCustomAmount] = useState("")
  const [formCustomReason, setFormCustomReason] = useState("")

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
    setFormCity(""); setFormPhone(""); setFormEmail(""); setFormAddress("")
    setFormGST(""); setCustomPricing(false); setFormCustomAmount(""); setFormCustomReason("")
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

    // Parse formPlan (e.g. "STANDARD_MONTHLY") into tier + billingCycle
    const [tierPart, cyclePart] = formPlan.split("_") as [string, string]
    const billingCycle = cyclePart === "YEARLY" ? "YEARLY" as const : "MONTHLY" as const

    // Look up planId from fetched plans
    const matchingPlan = plans.find(
      (p) => p.tier === tierPart && p.billingCycle === billingCycle
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
          billingCycle,
          city: formCity, contactPhone: formPhone, contactEmail: formEmail,
          address: formAddress, gstNumber: formGST,
          customPrice: customPricing && formCustomAmount ? Number(formCustomAmount) : undefined,
          overrideReason: customPricing ? formCustomReason : undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Business created successfully")
        setCreateOpen(false)
        resetForm()
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
        action={
          <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm() }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Create Business</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Business</DialogTitle>
                <DialogDescription>Onboard a new business onto the Quantix platform</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Business Name *</Label><Input placeholder="e.g. FreshMart Grocers" value={formName} onChange={(e) => handleNameChange(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Slug *</Label><Input placeholder="Auto-generated" value={formSlug} onChange={(e) => setFormSlug(e.target.value)} /></div>
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
                            {plan.name} — ₹{plan.price.toLocaleString("en-IN")}/{plan.billingCycle === "MONTHLY" ? "mo" : "yr"}
                          </SelectItem>
                        )) : (
                          <>
                            <SelectItem value="STANDARD_MONTHLY">Standard Monthly</SelectItem>
                            <SelectItem value="PRO_MONTHLY">Pro Monthly</SelectItem>
                            <SelectItem value="STANDARD_YEARLY">Standard Yearly</SelectItem>
                            <SelectItem value="PRO_YEARLY">Pro Yearly</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>City</Label><Input placeholder="e.g. Mumbai" value={formCity} onChange={(e) => setFormCity(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input placeholder="+91 98765 43210" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Email</Label><Input placeholder="admin@business.in" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Address</Label><Textarea placeholder="Full business address" rows={2} value={formAddress} onChange={(e) => setFormAddress(e.target.value)} /></div>
                <div className="space-y-2"><Label>GST Number</Label><Input placeholder="e.g. 27AABCF1234A1Z5" value={formGST} onChange={(e) => setFormGST(e.target.value)} /></div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5"><Label className="text-sm font-medium">Custom Pricing</Label><p className="text-xs text-muted-foreground">Override default plan pricing</p></div>
                  <Switch checked={customPricing} onCheckedChange={setCustomPricing} />
                </div>
                {customPricing && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Custom Amount (₹)</Label><Input placeholder="e.g. 3999" type="number" value={formCustomAmount} onChange={(e) => setFormCustomAmount(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Reason</Label><Input placeholder="e.g. Promotional discount" value={formCustomReason} onChange={(e) => setFormCustomReason(e.target.value)} /></div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm() }}>Cancel</Button>
                <Button onClick={handleCreateBusiness} disabled={creating}>{creating ? "Creating..." : "Create Business"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
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
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setCurrentBusiness(biz.id, biz.name, biz.businessType, biz.slug)}>
                              <ExternalLink className="size-3" />
                              Manage
                            </Button>
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
      <Sheet open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) setSelectedBusiness(null) }}>
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
                      <AvatarFallback className="text-sm font-semibold" style={{ backgroundColor: typeConf ? `${typeConf.color}18` : undefined, color: typeConf?.color }}>
                        {biz.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <SheetTitle className="text-lg">{biz.name}</SheetTitle>
                        <Button size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => { setDetailOpen(false); setCurrentBusiness(biz.id, biz.name, biz.businessType, biz.slug) }}>
                          <ExternalLink className="size-3" />
                          Manage Business
                        </Button>
                      </div>
                      <SheetDescription className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium" style={{ borderColor: typeConf?.color, color: typeConf?.color }}>{typeConf?.label}</Badge>
                        <StatusBadge status={biz.status} />
                        {biz.isOnline ? <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium"><Wifi className="h-3 w-3" /> Online</span>
                          : <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium"><WifiOff className="h-3 w-3" /> Offline</span>}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-120px)]">
                  <div className="space-y-6 p-6">
                    {/* Business Overview */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Overview</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border p-3 flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-[10px] text-muted-foreground">City</p><p className="text-sm font-medium">{biz.city || "—"}</p></div></div>
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
                    {/* Store Count */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Store Configuration</h4>
                      <div className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50"><Store className="h-4.5 w-4.5 text-amber-600" /></div>
                        <div>
                          <p className="text-sm font-medium">{biz.storeCount} {biz.storeCount === 1 ? "Store" : "Stores"}</p>
                          <p className="text-[10px] text-muted-foreground">{biz.city ? `Across ${biz.city}` : "Main store"}</p>
                        </div>
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
                            <div><p className="text-[10px] text-muted-foreground">Billing</p><p className="font-medium">{sub.billingCycle === "MONTHLY" || sub.billingCycle === "monthly" ? "Monthly" : "Yearly"}</p></div>
                            <div><p className="text-[10px] text-muted-foreground">Price</p>
                              {sub.customPrice ? <CurrencyBadge amount={sub.customPrice} override original={sub.planPrice} /> : <p className="font-medium">₹{sub.planPrice.toLocaleString("en-IN")}</p>}
                            </div>
                            <div><p className="text-[10px] text-muted-foreground">Next Billing</p><p className="font-medium">{new Date(sub.nextBillingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div>
                            {sub.discountPercentage && <div><p className="text-[10px] text-muted-foreground">Discount</p><p className="font-medium text-orange-600">{sub.discountPercentage}% off</p></div>}
                          </div>
                        </div>
                      ) : (<div className="rounded-lg border border-dashed p-4 text-center"><p className="text-sm text-muted-foreground">No active subscription</p></div>)}
                    </div>
                    <Separator />
                    {/* Domain & Deployments */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Domain & Deployment</h4>
                      <div className="space-y-2">
                        {biz.domain ? (
                          <div className="rounded-lg border p-3 flex items-center justify-between">
                            <div><p className="text-[10px] text-muted-foreground">Domain</p><p className="text-sm font-medium">{biz.domain.domain}</p></div>
                            <StatusBadge status={biz.domain.status} />
                          </div>
                        ) : (<div className="rounded-lg border border-dashed p-3 text-center"><p className="text-xs text-muted-foreground">No domain configured</p></div>)}
                        {biz.deployments.length > 0 && (
                          <div className="space-y-1.5">
                            {biz.deployments.map((dep) => (
                              <div key={dep.id} className="rounded-lg border p-2.5 flex items-center justify-between">
                                <div className="flex items-center gap-2"><span className="text-xs font-medium">{dep.type.replace(/_/g, " ")}</span><span className="text-[10px] text-muted-foreground">v{dep.version || "?"}</span></div>
                                <StatusBadge status={dep.status} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator />
                    {/* Business Details */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Details</h4>
                      <div className="space-y-2">
                        <div className="rounded-lg border p-3"><p className="text-[10px] text-muted-foreground">Address</p><p className="text-sm">{biz.address || `${biz.city || ""}, ${biz.state || ""} India`}</p></div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg border p-3"><p className="text-[10px] text-muted-foreground">GST</p><p className="text-sm font-mono">{biz.gstNumber || "—"}</p></div>
                          <div className="rounded-lg border p-3"><p className="text-[10px] text-muted-foreground">Created</p><p className="text-sm">{new Date(biz.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div>
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
