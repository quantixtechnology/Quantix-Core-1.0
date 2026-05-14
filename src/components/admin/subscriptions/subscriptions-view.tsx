"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { PageHeader } from "../shared/page-header"
import { StatCard } from "../shared/stat-card"
import { StatusBadge, CurrencyBadge } from "../shared/status-badge"
import { EmptyState } from "../shared/empty-state"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  CreditCard, Search, X, IndianRupee, AlertTriangle, CheckCircle2,
  ArrowUpRight, RefreshCw, Shield, Pencil, PauseCircle,
} from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"

// ---- API data types ----
interface SubscriptionApiData {
  id: string; businessId: string; planId: string; status: string
  planPrice: number; customPrice: number | null; discountPercentage: number | null
  manualPriceOverride: boolean; overrideReason: string | null; overrideApprovedBy: string | null
  billingCycle: string; currentPeriodStart: string; currentPeriodEnd: string
  nextBillingDate: string; nextPaymentAmount: number | null
  lastPaymentDate: string | null; lastPaymentAmount: number | null
  autoRenew: boolean; cancelledAt: string | null; cancelReason: string | null
  notes: string | null; createdAt: string
  business: { id: string; name: string; slug: string; businessType: string; status: string }
  plan: { id: string; name: string; tier: string; billingCycle: string; price: number; maxStores: number; maxProducts: number; maxOrders: number }
}

interface PlatformPlanData {
  id: string; name: string; tier: string; billingCycle: string; price: number
  implementationCharge: number; description: string | null
  maxStores: number; maxProducts: number; maxOrders: number
  maxDeliveryPartners: number; maxStaff: number
  hasPOS: boolean; hasDelivery: boolean; hasSubscription: boolean
  hasCustomDomain: boolean; hasWhiteLabel: boolean; hasAdvancedReports: boolean; hasAPIAccess: boolean
  features: string; isActive: boolean
}

type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED" | "EXPIRED"
type SubscriptionDisplayStatus = SubscriptionStatus | "PENDING_ACTIVATION" | "PAUSED"

const subscriptionStatuses: SubscriptionDisplayStatus[] = ["ACTIVE", "PENDING_ACTIVATION", "PAUSED", "PAST_DUE", "SUSPENDED", "EXPIRED", "CANCELLED"]

function getSubscriptionDisplayStatus(subscription: SubscriptionApiData): SubscriptionDisplayStatus {
  if (subscription.status === "ACTIVE" && subscription.business?.status === "ONBOARDING") {
    return "PENDING_ACTIVATION"
  }
  return subscription.status as SubscriptionDisplayStatus
}

function formatCurrency(amount: number): string { return `₹${amount.toLocaleString("en-IN")}` }
function formatDate(dateStr: string): string { try { return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) } catch { return dateStr } }
function formatInputDate(dateStr: string) { try { return new Date(dateStr).toISOString().slice(0, 10) } catch { return "" } }

export function SubscriptionsView() {
  const { searchQuery } = useAdminStore()
  const { permissions } = useAuthStore()
  const canEdit = permissions.includes("subscriptions:edit" as never)
  const canOverridePrice = permissions.includes("subscriptions:override_price" as never)
  const canManagePlans = permissions.includes("subscriptions:edit" as never)
  const [subscriptions, setSubscriptions] = useState<SubscriptionApiData[]>([])
  const [platformPlans, setPlatformPlans] = useState<PlatformPlanData[]>([])
  const [apiStats, setApiStats] = useState<{ total: number; active: number; pastDue: number; suspended: number; monthlyMRR: number; yearlyProjected: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [billingFilter, setBillingFilter] = useState<string>("all")
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionApiData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [managePlansOpen, setManagePlansOpen] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideDiscount, setOverrideDiscount] = useState<number>(0)
  const [overrideReason, setOverrideReason] = useState("")
  const [overrideApprover, setOverrideApprover] = useState("")
  const [submittingOverride, setSubmittingOverride] = useState(false)

  // Edit drawer state
  const [detailBusinessStatus, setDetailBusinessStatus] = useState<string>("")
  const [detailSubscriptionStatus, setDetailSubscriptionStatus] = useState<SubscriptionDisplayStatus>("ACTIVE")
  const [detailPlanId, setDetailPlanId] = useState<string>("")
  const [detailBillingCycle, setDetailBillingCycle] = useState<string>("MONTHLY")
  const [detailStartDate, setDetailStartDate] = useState<string>("")
  const [detailExpiryDate, setDetailExpiryDate] = useState<string>("")
  const [detailCustomPrice, setDetailCustomPrice] = useState<string>("")
  const [detailNotes, setDetailNotes] = useState<string>("")
  const [detailAutoRenew, setDetailAutoRenew] = useState<boolean>(true)
  const [detailSaving, setDetailSaving] = useState(false)
  const [billingHistory, setBillingHistory] = useState<any[]>([])
  const [loadingBillingHistory, setLoadingBillingHistory] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/admin/subscriptions", { headers: getAuthHeaders() })
      if (!res.ok) throw new Error("Failed to fetch subscriptions")
      const json = await res.json()
      if (json.success) {
        setSubscriptions(json.data)
        setPlatformPlans(json.platformPlans || [])
        setApiStats(json.stats || null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscriptions")
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [])

  const stats = useMemo(() => {
    if (apiStats) return apiStats
    const active = subscriptions.filter(s => s.status === "ACTIVE").length
    const pastDue = subscriptions.filter(s => s.status === "PAST_DUE").length
    const suspended = subscriptions.filter(s => s.status === "SUSPENDED").length
    let monthlyMRR = 0; let yearlyProjected = 0
    for (const s of subscriptions.filter(s => s.status === "ACTIVE" || s.status === "PAST_DUE")) {
      const price = s.customPrice || s.planPrice
      const isMonthly = s.billingCycle === "MONTHLY" || s.billingCycle === "monthly"
      if (isMonthly) { monthlyMRR += price; yearlyProjected += price * 12 } else { monthlyMRR += Math.round(price / 12); yearlyProjected += price }
    }
    return { total: subscriptions.length, active, pastDue, suspended, monthlyMRR, yearlyProjected }
  }, [subscriptions, apiStats])

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchSearch = !searchQuery || sub.business?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || sub.id.toLowerCase().includes(searchQuery.toLowerCase())
      const displayStatus = getSubscriptionDisplayStatus(sub)
      const matchStatus = statusFilter === "all" || displayStatus === statusFilter
      const matchBilling = billingFilter === "all" || (sub.billingCycle === "MONTHLY" || sub.billingCycle === "monthly" ? "MONTHLY" : "YEARLY") === billingFilter
      return matchSearch && matchStatus && matchBilling
    })
  }, [subscriptions, searchQuery, statusFilter, billingFilter])

  const overrideBasePrice = selectedSubscription?.planPrice || 0
  const overrideFinalPrice = Math.max(0, overrideBasePrice - overrideDiscount)

  const handleOpenOverride = () => {
    if (!selectedSubscription) return
    setOverrideDiscount(selectedSubscription.customPrice ? selectedSubscription.planPrice - selectedSubscription.customPrice : 0)
    setOverrideReason(""); setOverrideApprover(""); setOverrideOpen(true)
  }

  const handleSubmitOverride = async () => {
    if (!selectedSubscription || overrideDiscount === 0) return
    setSubmittingOverride(true)
    try {
      const res = await fetch(`/api/core/businesses/${selectedSubscription.businessId}/subscription/override-pricing`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ customPrice: overrideFinalPrice, reason: overrideReason }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Pricing override applied successfully")
        setOverrideOpen(false); fetchData()
      } else {
        toast.error(json.error || "Failed to apply override")
      }
    } catch {
      toast.error("Failed to apply pricing override")
    } finally { setSubmittingOverride(false) }
  }

  const loadBillingHistory = async (businessId: string) => {
    setLoadingBillingHistory(true)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/subscription`)
      if (!res.ok) return
      const json = await res.json()
      if (json.success) setBillingHistory(json.data.billingHistory || [])
    } catch { } finally { setLoadingBillingHistory(false) }
  }

  useEffect(() => {
    if (!selectedSubscription || !detailOpen) return
    setDetailBusinessStatus(selectedSubscription.business?.status || "ONBOARDING")
    setDetailSubscriptionStatus(getSubscriptionDisplayStatus(selectedSubscription))
    setDetailPlanId(selectedSubscription.plan?.id || "")
    setDetailBillingCycle(selectedSubscription.billingCycle === "YEARLY" ? "YEARLY" : "MONTHLY")
    setDetailStartDate(formatInputDate(selectedSubscription.currentPeriodStart))
    setDetailExpiryDate(formatInputDate(selectedSubscription.currentPeriodEnd))
    setDetailCustomPrice(selectedSubscription.customPrice ? selectedSubscription.customPrice.toString() : "")
    setDetailNotes(selectedSubscription.notes || "")
    setDetailAutoRenew(selectedSubscription.autoRenew)
    setBillingHistory([])
    loadBillingHistory(selectedSubscription.businessId)
  }, [selectedSubscription, detailOpen])

  const handleRenewSubscription = async (subscription: SubscriptionApiData) => {
    try {
      const now = new Date()
      const nextEnd = new Date(now)
      if (subscription.billingCycle === "YEARLY" || subscription.billingCycle === "yearly") {
        nextEnd.setFullYear(nextEnd.getFullYear() + 1)
      } else {
        nextEnd.setMonth(nextEnd.getMonth() + 1)
      }
      const res = await fetch(`/api/core/businesses/${subscription.businessId}/subscription`, {
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify({
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: nextEnd.toISOString(),
          nextBillingDate: nextEnd.toISOString(),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) { toast.error(json.error || "Failed to renew subscription"); return }
      toast.success("Subscription renewed successfully"); fetchData()
    } catch { toast.error("Failed to renew subscription") }
  }

  const handleSaveSubscriptionChanges = async () => {
    if (!selectedSubscription) return
    setDetailSaving(true)
    try {
      const updates: Record<string, unknown> = {}
      const businessUpdates: Record<string, unknown> = {}
      const currentDisplayStatus = getSubscriptionDisplayStatus(selectedSubscription)

      if (detailSubscriptionStatus !== currentDisplayStatus) {
        if (detailSubscriptionStatus === "ACTIVE") {
          if (selectedSubscription.business.status !== "ACTIVE") businessUpdates.status = "ACTIVE"
        } else if (detailSubscriptionStatus === "PENDING_ACTIVATION") {
          businessUpdates.status = "ONBOARDING"
        } else if (detailSubscriptionStatus === "SUSPENDED") {
          businessUpdates.status = "SUSPENDED"
        } else if (detailSubscriptionStatus === "PAUSED") {
          businessUpdates.status = "SUSPENDED"
          updates.notes = (detailNotes ? detailNotes + "\n" : "") + "[Paused by admin]"
        }
      }

      if (detailBusinessStatus && detailBusinessStatus !== selectedSubscription.business.status && !businessUpdates.status) {
        businessUpdates.status = detailBusinessStatus
      }

      if (detailPlanId && detailPlanId !== selectedSubscription.plan?.id) updates.planId = detailPlanId
      if (detailBillingCycle && detailBillingCycle !== selectedSubscription.billingCycle) updates.billingCycle = detailBillingCycle.toLowerCase()
      if (detailCustomPrice) {
        const customValue = Number(detailCustomPrice)
        if (!Number.isNaN(customValue) && customValue >= 0) {
          updates.customPrice = customValue
          updates.overrideReason = "Updated via admin"
        }
      }
      if (detailStartDate) updates.currentPeriodStart = new Date(detailStartDate)
      if (detailExpiryDate) updates.currentPeriodEnd = new Date(detailExpiryDate)
      if (detailNotes !== (selectedSubscription.notes || "") && detailSubscriptionStatus !== "PAUSED") updates.notes = detailNotes
      if (detailAutoRenew !== selectedSubscription.autoRenew) updates.autoRenew = detailAutoRenew

      if (Object.keys(businessUpdates).length > 0) {
        const res = await fetch(`/api/core/businesses/${selectedSubscription.businessId}/status`, {
          method: "PUT", headers: getAuthHeaders(),
          body: JSON.stringify({ status: businessUpdates.status }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) { toast.error(json.error || "Failed to update business status"); return }
      }

      if (Object.keys(updates).length > 0) {
        const res = await fetch(`/api/core/businesses/${selectedSubscription.businessId}/subscription`, {
          method: "PUT", headers: getAuthHeaders(),
          body: JSON.stringify(updates),
        })
        const json = await res.json()
        if (!res.ok || !json.success) { toast.error(json.error || "Failed to update subscription"); return }
      }

      if (detailSubscriptionStatus === "ACTIVE" && selectedSubscription.status !== "ACTIVE" && selectedSubscription.business.status === "ACTIVE") {
        const reactivateRes = await fetch(`/api/core/businesses/${selectedSubscription.businessId}/subscription/reactivate`, {
          method: "POST", headers: getAuthHeaders(),
        })
        const reactivateJson = await reactivateRes.json()
        if (!reactivateRes.ok || !reactivateJson.success) { toast.error(reactivateJson.error || "Failed to reactivate subscription"); return }
      }

      toast.success("Subscription saved successfully")
      fetchData()
      setDetailOpen(false)
    } catch {
      toast.error("Failed to save subscription changes")
    } finally { setDetailSaving(false) }
  }

  // ── Status toggle helpers ──────────────────────────────────────────────────
  const statusOptions: { value: SubscriptionDisplayStatus; label: string; active: string; hover: string }[] = [
    { value: "ACTIVE", label: "Active", active: "bg-emerald-600 text-white border-emerald-600", hover: "hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300" },
    { value: "PAUSED", label: "Paused", active: "bg-amber-500 text-white border-amber-500", hover: "hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300" },
    { value: "SUSPENDED", label: "Suspended", active: "bg-red-600 text-white border-red-600", hover: "hover:bg-red-50 hover:text-red-700 hover:border-red-300" },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Subscription Management" description="Manage platform subscriptions, billing, and pricing overrides" icon={CreditCard} />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (<Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>))}
        </div>
        <Card><CardContent className="p-6"><Skeleton className="h-[400px] w-full" /></CardContent></Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Subscription Management" description="Manage platform subscriptions, billing, and pricing overrides" icon={CreditCard} />
        <Card><CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Subscription Management"
        description="Manage platform subscriptions, billing, and pricing overrides"
        icon={CreditCard}
        action={canManagePlans ? (
          <Dialog open={managePlansOpen} onOpenChange={setManagePlansOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Shield className="h-4 w-4" /> Manage Plans</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Platform Plans</DialogTitle><DialogDescription>These are the platform plans. Pricing can be overridden per customer.</DialogDescription></DialogHeader>
              <div className="space-y-4 py-4">
                {platformPlans.map((plan) => (
                  <Card key={plan.id} className="border-2">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div><h4 className="font-semibold">{plan.name}</h4><p className="text-xs text-muted-foreground">{plan.billingCycle} billing · {plan.tier} tier</p></div>
                        <div className="text-right"><p className="text-xl font-bold">{formatCurrency(plan.price)}</p><p className="text-xs text-muted-foreground">{plan.billingCycle === "MONTHLY" ? "/month" : "/year"}</p></div>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>Up to {plan.maxStores} stores</span></div>
                        <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>Up to {plan.maxProducts.toLocaleString()} products</span></div>
                        <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>{plan.maxOrders.toLocaleString()} orders/mo</span></div>
                        <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>Up to {plan.maxStaff} staff</span></div>
                        {plan.hasPOS && <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>POS System</span></div>}
                        {plan.hasDelivery && <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>Delivery Management</span></div>}
                        {plan.hasCustomDomain && <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>Custom Domain</span></div>}
                        {plan.hasWhiteLabel && <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>White Label</span></div>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setManagePlansOpen(false)}>Close</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      {/* Summary Stat Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Subscriptions" value={stats.active} change={`${stats.total} total`} changeType="neutral" icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Monthly MRR" value={formatCurrency(stats.monthlyMRR)} change={`${subscriptions.filter(s => s.billingCycle === "MONTHLY" || s.billingCycle === "monthly").length} monthly subs`} changeType="positive" icon={IndianRupee} iconColor="text-sky-600" iconBg="bg-sky-50" />
        <StatCard title="Yearly Revenue" value={formatCurrency(stats.yearlyProjected)} change={`${subscriptions.filter(s => s.billingCycle === "YEARLY" || s.billingCycle === "yearly").length} yearly subs`} changeType="neutral" icon={ArrowUpRight} iconColor="text-amber-600" iconBg="bg-amber-50" />
        <StatCard title="Overdue" value={stats.pastDue} change={stats.suspended > 0 ? `${stats.suspended} suspended` : "No suspensions"} changeType={stats.pastDue > 0 ? "negative" : "neutral"} icon={AlertTriangle} iconColor="text-red-600" iconBg="bg-red-50" />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search subscriptions..." className="pl-8 h-9" value={searchQuery} readOnly />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {subscriptionStatuses.map((s) => (<SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={billingFilter} onValueChange={setBillingFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Billing" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Cycles</SelectItem><SelectItem value="MONTHLY">Monthly</SelectItem><SelectItem value="YEARLY">Yearly</SelectItem></SelectContent>
        </Select>
        {(statusFilter !== "all" || billingFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setBillingFilter("all") }}><X className="h-3 w-3 mr-1" /> Clear</Button>
        )}
      </div>

      {/* Subscription Table */}
      {filteredSubscriptions.length === 0 ? (
        <EmptyState icon={CreditCard} title="No subscriptions found" description="Try adjusting your filters or search query" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Business</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Billing</TableHead>
                    <TableHead className="w-[72px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((sub) => (
                    <TableRow
                      key={sub.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelectedSubscription(sub); setDetailOpen(true) }}
                    >
                      <TableCell>
                        <div className="font-medium text-sm">{sub.business?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{sub.business?.businessType || ""}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{sub.plan?.name || sub.plan?.tier || "Unknown"}</Badge></TableCell>
                      <TableCell><span className="text-sm">{(sub.billingCycle === "MONTHLY" || sub.billingCycle === "monthly") ? "Monthly" : "Yearly"}</span></TableCell>
                      <TableCell><span className="text-sm font-medium">{formatCurrency(sub.planPrice)}</span></TableCell>
                      <TableCell><CurrencyBadge amount={sub.customPrice || sub.planPrice} override={!!sub.customPrice} original={sub.customPrice ? sub.planPrice : undefined} /></TableCell>
                      <TableCell><StatusBadge status={getSubscriptionDisplayStatus(sub)} /></TableCell>
                      <TableCell><span className="text-sm">{formatDate(sub.nextBillingDate)}</span></TableCell>
                      {canEdit && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Edit Subscription"
                            onClick={() => { setSelectedSubscription(sub); setDetailOpen(true) }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Edit Subscription Drawer ─────────────────────────────────────── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[540px] sm:max-w-[540px] flex flex-col p-0">
          {selectedSubscription && (
            <>
              {/* Drawer Header */}
              <SheetHeader className="px-6 pt-6 pb-4 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="text-base font-semibold leading-tight">{selectedSubscription.business?.name || "Unknown"}</SheetTitle>
                    <SheetDescription className="text-xs mt-0.5">
                      {selectedSubscription.plan?.name} Plan · {(selectedSubscription.billingCycle === "MONTHLY" || selectedSubscription.billingCycle === "monthly") ? "Monthly" : "Yearly"} Billing
                    </SheetDescription>
                  </div>
                  <StatusBadge status={getSubscriptionDisplayStatus(selectedSubscription)} />
                </div>
              </SheetHeader>

              {/* Drawer Body */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="px-6 py-5 space-y-6">

                  {/* ── Section: Status Management ───────────────────────── */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status Management</p>

                    {/* Status toggle */}
                    <div>
                      <Label className="text-xs mb-1.5 block">Subscription Status</Label>
                      <div className="flex rounded-lg border overflow-hidden divide-x">
                        {statusOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setDetailSubscriptionStatus(opt.value)}
                            className={`flex-1 py-2 text-xs font-semibold transition-colors border-0 ${
                              detailSubscriptionStatus === opt.value ? opt.active : `text-muted-foreground bg-background ${opt.hover}`
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {detailSubscriptionStatus === "PAUSED" && (
                        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                          <PauseCircle className="h-3 w-3" /> Subscription will be paused (mapped to Suspended with pause note)
                        </p>
                      )}
                    </div>

                    {/* Business status + Auto-renew row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Business Status</Label>
                        <Select value={detailBusinessStatus} onValueChange={setDetailBusinessStatus}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="SUSPENDED">Suspended</SelectItem>
                            <SelectItem value="CHURNED">Churned</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end pb-1">
                        <div className="flex items-center justify-between w-full rounded-lg border px-3 py-2 h-8">
                          <span className="text-xs font-medium">Auto-Renew</span>
                          <Switch checked={detailAutoRenew} onCheckedChange={setDetailAutoRenew} className="scale-75" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* ── Section: Plan & Billing ───────────────────────────── */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan & Billing</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Change Plan</Label>
                        <Select value={detailPlanId} onValueChange={setDetailPlanId}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select plan" /></SelectTrigger>
                          <SelectContent>
                            {platformPlans.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name} — ₹{plan.price.toLocaleString("en-IN")}/{plan.billingCycle === "MONTHLY" ? "mo" : "yr"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Billing Cycle</Label>
                        <Select value={detailBillingCycle} onValueChange={setDetailBillingCycle}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MONTHLY">Monthly</SelectItem>
                            <SelectItem value="YEARLY">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Period Start</Label>
                        <Input type="date" value={detailStartDate} onChange={(e) => setDetailStartDate(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Renewal Date</Label>
                        <Input type="date" value={detailExpiryDate} onChange={(e) => setDetailExpiryDate(e.target.value)} className="h-8 text-xs" />
                      </div>
                    </div>
                    {/* Quick renew */}
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200" onClick={() => handleRenewSubscription(selectedSubscription)}>
                      <RefreshCw className="h-3 w-3" /> Renew for Next Period
                    </Button>
                  </div>

                  <Separator />

                  {/* ── Section: Custom Pricing ───────────────────────────── */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom Pricing</p>
                    <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Base Plan Price</span>
                      <span className="text-sm font-semibold">{formatCurrency(selectedSubscription.planPrice)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Custom Price (₹)</Label>
                        <Input
                          type="number"
                          value={detailCustomPrice}
                          onChange={(e) => setDetailCustomPrice(e.target.value)}
                          placeholder={selectedSubscription.planPrice.toString()}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Effective Price</Label>
                        <div className={`h-8 rounded-md border px-3 flex items-center text-xs font-semibold ${detailCustomPrice && Number(detailCustomPrice) !== selectedSubscription.planPrice ? "text-orange-700 bg-orange-50 border-orange-200" : "text-muted-foreground bg-muted"}`}>
                          {detailCustomPrice && !Number.isNaN(Number(detailCustomPrice)) ? formatCurrency(Math.max(0, Number(detailCustomPrice))) : formatCurrency(selectedSubscription.planPrice)}
                          {detailCustomPrice && Number(detailCustomPrice) !== selectedSubscription.planPrice && (
                            <Badge className="ml-1.5 bg-orange-100 text-orange-700 hover:bg-orange-100 text-[9px] border-0 h-4">CUSTOM</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {canOverridePrice && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleOpenOverride}>
                        <IndianRupee className="h-3 w-3" /> Apply Discount Override
                      </Button>
                    )}
                    {selectedSubscription.overrideReason && (
                      <p className="text-xs text-muted-foreground">Override reason: {selectedSubscription.overrideReason}</p>
                    )}
                  </div>

                  <Separator />

                  {/* ── Section: Notes ────────────────────────────────────── */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Internal Notes</p>
                    <Textarea
                      value={detailNotes}
                      onChange={(e) => setDetailNotes(e.target.value)}
                      placeholder="Add internal notes about this subscription (not visible to the business)..."
                      rows={3}
                      className="text-xs resize-none"
                    />
                  </div>

                  <Separator />

                  {/* ── Section: Billing Period (read-only) ───────────────── */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billing Period</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Period Start", value: formatDate(selectedSubscription.currentPeriodStart) },
                        { label: "Period End", value: formatDate(selectedSubscription.currentPeriodEnd) },
                        { label: "Next Billing", value: formatDate(selectedSubscription.nextBillingDate) },
                        { label: "Last Payment", value: selectedSubscription.lastPaymentDate ? formatDate(selectedSubscription.lastPaymentDate) : "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-lg border px-3 py-2">
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                          <p className="text-xs font-medium mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>
                    {selectedSubscription.lastPaymentAmount && (
                      <div className="rounded-lg border px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">Last Payment Amount</p>
                        <p className="text-xs font-medium mt-0.5">{formatCurrency(selectedSubscription.lastPaymentAmount)}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* ── Section: Billing History ──────────────────────────── */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billing History</p>
                    {loadingBillingHistory ? (
                      <Skeleton className="h-16 w-full rounded-lg" />
                    ) : billingHistory.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground text-center">No billing history available</div>
                    ) : (
                      <div className="space-y-2">
                        {billingHistory.map((record: any) => (
                          <div key={record.id} className="rounded-lg border px-3 py-2 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium">₹{record.amount.toLocaleString("en-IN")}</p>
                              <p className="text-[10px] text-muted-foreground">{record.description || record.status}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{new Date(record.dueDate).toLocaleDateString("en-IN")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

              {/* Drawer Footer */}
              <SheetFooter className="px-6 py-4 border-t bg-background">
                <div className="flex w-full items-center gap-2">
                  <Button variant="outline" size="sm" className={canEdit ? "flex-1" : "w-full"} onClick={() => setDetailOpen(false)}>Close</Button>
                  {canEdit && (
                    <Button size="sm" className="flex-1" onClick={handleSaveSubscriptionChanges} disabled={detailSaving}>
                      {detailSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  )}
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Pricing Override Dialog */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Override Pricing</DialogTitle>
            <DialogDescription>Set a custom price for {selectedSubscription?.business?.name}. This will override the standard plan price.</DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Current Plan</span><span className="font-medium">{selectedSubscription.plan?.name} ({(selectedSubscription.billingCycle === "MONTHLY" || selectedSubscription.billingCycle === "monthly") ? "Monthly" : "Yearly"})</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Current Price</span><span className="font-medium">{formatCurrency(selectedSubscription.customPrice || selectedSubscription.planPrice)}</span></div>
              </div>
              <Separator />
              <div className="space-y-2"><Label>Base Price (₹)</Label><Input value={overrideBasePrice} readOnly className="bg-muted" /><p className="text-xs text-muted-foreground">Standard plan price — cannot be modified</p></div>
              <div className="space-y-2">
                <Label>Discount Amount (₹)</Label>
                <Input type="number" min={0} max={overrideBasePrice} value={overrideDiscount || ""} onChange={(e) => { const val = parseInt(e.target.value) || 0; setOverrideDiscount(Math.min(val, overrideBasePrice)) }} placeholder="0" />
                <p className="text-xs text-muted-foreground">{overrideDiscount > 0 ? `${Math.round((overrideDiscount / overrideBasePrice) * 100)}% discount` : "Enter the discount amount"}</p>
              </div>
              <div className="space-y-2">
                <Label>Final Price (₹)</Label>
                <div className="flex items-center gap-2">
                  <Input value={formatCurrency(overrideFinalPrice)} readOnly className={`font-bold ${overrideDiscount > 0 ? "text-orange-700 bg-orange-50" : "bg-muted"}`} />
                  {overrideDiscount > 0 && <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px] border-0 shrink-0">CUSTOM</Badge>}
                </div>
              </div>
              <div className="space-y-2"><Label>Reason for Override *</Label><Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="e.g., Long-term customer loyalty discount, early adopter pricing..." rows={3} /></div>
              <div className="space-y-2">
                <Label>Approved By *</Label>
                <Select value={overrideApprover} onValueChange={setOverrideApprover}>
                  <SelectTrigger><SelectValue placeholder="Select approver" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Priya Sharma">Priya Sharma — Sales Lead</SelectItem>
                    <SelectItem value="Rahul Verma">Rahul Verma — Sales Lead</SelectItem>
                    <SelectItem value="Quantix Admin">Quantix Admin — Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {overrideDiscount > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium">Pricing Override Warning</p>
                    <p className="mt-0.5">You are applying a {formatCurrency(overrideDiscount)} discount ({Math.round((overrideDiscount / overrideBasePrice) * 100)}% off) to this subscription.</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitOverride} disabled={!overrideReason.trim() || !overrideApprover || overrideDiscount === 0 || submittingOverride}>
              {submittingOverride ? "Applying..." : "Apply Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
