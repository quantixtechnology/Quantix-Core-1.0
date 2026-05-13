"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { PageHeader } from "../shared/page-header"
import { StatCard } from "../shared/stat-card"
import { StatusBadge, CurrencyBadge } from "../shared/status-badge"
import { EmptyState } from "../shared/empty-state"
import { businessTypeConfig } from "@/components/dashboard/data"
import { useAdminStore } from "@/stores/admin-store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  CreditCard, Plus, Search, X, IndianRupee, AlertTriangle, CheckCircle2,
  FileText, ArrowUpRight, RefreshCw, Shield,
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
type SubscriptionDisplayStatus = SubscriptionStatus | "PENDING_ACTIVATION"

const subscriptionStatuses: SubscriptionDisplayStatus[] = ["ACTIVE", "PENDING_ACTIVATION", "PAST_DUE", "SUSPENDED", "EXPIRED", "CANCELLED"]

function getSubscriptionStatusColor(status: SubscriptionDisplayStatus): string {
  const map: Record<SubscriptionDisplayStatus, string> = {
    ACTIVE: "text-emerald-700",
    PENDING_ACTIVATION: "text-violet-700",
    PAST_DUE: "text-amber-700",
    SUSPENDED: "text-red-700",
    CANCELLED: "text-slate-500",
    EXPIRED: "text-slate-500",
  }
  return map[status] || "text-slate-700"
}

function getSubscriptionDisplayStatus(subscription: SubscriptionApiData): SubscriptionDisplayStatus {
  if (subscription.status === "ACTIVE" && subscription.business?.status === "ONBOARDING") {
    return "PENDING_ACTIVATION"
  }
  return subscription.status as SubscriptionDisplayStatus
}

function formatCurrency(amount: number): string { return `₹${amount.toLocaleString("en-IN")}` }
function formatDate(dateStr: string): string { try { return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) } catch { return dateStr } }

export function SubscriptionsView() {
  const { searchQuery } = useAdminStore()
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

  const [detailBusinessStatus, setDetailBusinessStatus] = useState<string>("")
  const [detailSubscriptionStatus, setDetailSubscriptionStatus] = useState<SubscriptionDisplayStatus>("ACTIVE")
  const [detailPlanId, setDetailPlanId] = useState<string>("")
  const [detailBillingCycle, setDetailBillingCycle] = useState<string>("MONTHLY")
  const [detailStartDate, setDetailStartDate] = useState<string>("")
  const [detailExpiryDate, setDetailExpiryDate] = useState<string>("")
  const [detailCustomPrice, setDetailCustomPrice] = useState<string>("")
  const [detailActivationStatus, setDetailActivationStatus] = useState(false)
  const [detailSaving, setDetailSaving] = useState(false)
  const [billingHistory, setBillingHistory] = useState<any[]>([])
  const [loadingBillingHistory, setLoadingBillingHistory] = useState(false)
  const [billingHistoryOpen, setBillingHistoryOpen] = useState(true)

  // Toggle states for subscription and business online
  const [subscriptionActive, setSubscriptionActive] = useState(false)
  const [businessOnline, setBusinessOnline] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/admin/subscriptions")
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [])

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
    } finally {
      setSubmittingOverride(false)
    }
  }

  const formatInputDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toISOString().slice(0, 10)
    } catch {
      return ""
    }
  }

  const loadBillingHistory = async (businessId: string) => {
    setLoadingBillingHistory(true)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/subscription`)
      if (!res.ok) return
      const json = await res.json()
      if (json.success) {
        setBillingHistory(json.data.billingHistory || [])
      }
    } catch {
      // ignore silently
    } finally {
      setLoadingBillingHistory(false)
    }
  }

  useEffect(() => {
    if (!selectedSubscription || !detailOpen) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetailBusinessStatus(selectedSubscription.business?.status || "ONBOARDING")
    setDetailSubscriptionStatus(getSubscriptionDisplayStatus(selectedSubscription))
    setDetailPlanId(selectedSubscription.plan?.id || "")
    setDetailBillingCycle(selectedSubscription.billingCycle === "YEARLY" ? "YEARLY" : "MONTHLY")
    setDetailStartDate(formatInputDate(selectedSubscription.currentPeriodStart))
    setDetailExpiryDate(formatInputDate(selectedSubscription.currentPeriodEnd))
    setDetailCustomPrice(selectedSubscription.customPrice ? selectedSubscription.customPrice.toString() : "")
    setDetailActivationStatus(selectedSubscription.business?.status === "ACTIVE")
    setBillingHistory([])
    loadBillingHistory(selectedSubscription.businessId)

    // Set toggle states
    setSubscriptionActive(selectedSubscription.status === "ACTIVE")
    setBusinessOnline(selectedSubscription.business?.status === "ACTIVE")
  }, [selectedSubscription, detailOpen])

  const handleActivateSubscription = async (subscription: SubscriptionApiData) => {
    try {
      if (subscription.business?.status !== "ACTIVE") {
        const res = await fetch(`/api/core/businesses/${subscription.businessId}/status`, {
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
      } else if (subscription.status !== "ACTIVE") {
        const res = await fetch(`/api/core/businesses/${subscription.businessId}/subscription/reactivate`, {
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
        toast.success("Subscription is already active")
      }
      fetchData()
    } catch {
      toast.error("Failed to activate subscription")
    }
  }

  const handleSuspendSubscription = async (subscription: SubscriptionApiData) => {
    try {
      const res = await fetch(`/api/core/businesses/${subscription.businessId}/status`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: "SUSPENDED", reason: "Suspended from subscription admin" }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to suspend subscription")
        return
      }
      toast.success("Subscription suspended successfully")
      fetchData()
    } catch {
      toast.error("Failed to suspend subscription")
    }
  }

  const handleSubscriptionActiveToggle = async (active: boolean) => {
    if (!selectedSubscription) return

    setSubscriptionActive(active)
    if (!active) {
      // When subscription becomes SUSPENDED, business goes offline
      setBusinessOnline(false)
    }

    try {
      if (active) {
        // Activate subscription
        if (selectedSubscription.business?.status !== "ACTIVE") {
          const res = await fetch(`/api/core/businesses/${selectedSubscription.businessId}/status`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: "ACTIVE" }),
          })
          const json = await res.json()
          if (!res.ok || !json.success) {
            toast.error(json.error || "Failed to activate business")
            setSubscriptionActive(false)
            return
          }
        }
        if (selectedSubscription.status !== "ACTIVE") {
          const res = await fetch(`/api/core/businesses/${selectedSubscription.businessId}/subscription/reactivate`, {
            method: "POST",
            headers: getAuthHeaders(),
          })
          const json = await res.json()
          if (!res.ok || !json.success) {
            toast.error(json.error || "Failed to reactivate subscription")
            setSubscriptionActive(false)
            return
          }
        }
        toast.success("Subscription activated successfully")
      } else {
        // Suspend subscription
        const res = await fetch(`/api/core/businesses/${selectedSubscription.businessId}/status`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({ status: "SUSPENDED", reason: "Suspended via subscription toggle" }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          toast.error(json.error || "Failed to suspend subscription")
          setSubscriptionActive(true)
          return
        }
        toast.success("Subscription suspended successfully")
      }
      fetchData()
    } catch {
      toast.error("Failed to update subscription status")
      setSubscriptionActive(!active)
    }
  }

  const handleBusinessOnlineToggle = async (online: boolean) => {
    if (!selectedSubscription) return

    setBusinessOnline(online)

    try {
      const res = await fetch(`/api/core/businesses/${selectedSubscription.businessId}/toggle-online`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isOnline: online }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to toggle online status")
        setBusinessOnline(!online)
        return
      }
      toast.success(`Business ${online ? "is now online" : "is now offline"}`)
      fetchData()
    } catch {
      toast.error("Failed to toggle online status")
      setBusinessOnline(!online)
    }
  }

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
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: nextEnd.toISOString(),
          nextBillingDate: nextEnd.toISOString(),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to renew subscription")
        return
      }
      toast.success("Subscription renewed successfully")
      fetchData()
    } catch {
      toast.error("Failed to renew subscription")
    }
  }

  const handleSaveSubscriptionChanges = async () => {
    if (!selectedSubscription) return
    setDetailSaving(true)
    try {
      const updates: Record<string, unknown> = {}
      const businessUpdates: Record<string, unknown> = {}

      // Use toggle states for subscription and business status
      const currentDisplayStatus = getSubscriptionDisplayStatus(selectedSubscription)
      const targetSubscriptionStatus = subscriptionActive ? "ACTIVE" : "SUSPENDED"
      const targetBusinessStatus = businessOnline ? "ACTIVE" : (subscriptionActive ? selectedSubscription.business?.status : "SUSPENDED")

      if (targetSubscriptionStatus !== currentDisplayStatus) {
        if (targetSubscriptionStatus === "ACTIVE") {
          if (selectedSubscription.business.status !== "ACTIVE") {
            businessUpdates.status = "ACTIVE"
          }
        } else if (targetSubscriptionStatus === "SUSPENDED") {
          businessUpdates.status = "SUSPENDED"
        }
      }

      if (targetBusinessStatus && targetBusinessStatus !== selectedSubscription.business.status) {
        businessUpdates.status = targetBusinessStatus
      }

      if (detailPlanId && detailPlanId !== selectedSubscription.plan?.id) {
        updates.planId = detailPlanId
      }

      if (detailBillingCycle && detailBillingCycle !== selectedSubscription.billingCycle) {
        updates.billingCycle = detailBillingCycle.toLowerCase()
      }

      if (detailCustomPrice) {
        const customValue = Number(detailCustomPrice)
        if (!Number.isNaN(customValue) && customValue >= 0) {
          updates.customPrice = customValue
          updates.overrideReason = detailCustomPrice !== (selectedSubscription.customPrice?.toString() || "") ? "Updated via admin" : selectedSubscription.overrideReason
        }
      }

      if (detailStartDate) {
        updates.currentPeriodStart = new Date(detailStartDate)
      }
      if (detailExpiryDate) {
        updates.currentPeriodEnd = new Date(detailExpiryDate)
      }

      if (Object.keys(businessUpdates).length > 0) {
        const res = await fetch(`/api/core/businesses/${selectedSubscription.businessId}/status`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({ status: businessUpdates.status }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          toast.error(json.error || "Failed to update business status")
          return
        }
        toast.success("Business status updated")
      }

      if (Object.keys(updates).length > 0) {
        const res = await fetch(`/api/core/businesses/${selectedSubscription.businessId}/subscription`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(updates),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          toast.error(json.error || "Failed to update subscription")
          return
        }
        toast.success("Subscription updated successfully")
      }

      if (targetSubscriptionStatus === "ACTIVE" && selectedSubscription.status !== "ACTIVE" && selectedSubscription.business.status === "ACTIVE") {
        const reactivateRes = await fetch(`/api/core/businesses/${selectedSubscription.businessId}/subscription/reactivate`, {
          method: "POST",
          headers: getAuthHeaders(),
        })
        const reactivateJson = await reactivateRes.json()
        if (!reactivateRes.ok || !reactivateJson.success) {
          toast.error(reactivateJson.error || "Failed to reactivate subscription")
          return
        }
        toast.success("Subscription reactivated successfully")
      }

      if (Object.keys(businessUpdates).length === 0 && Object.keys(updates).length === 0) {
        toast.success("No changes to save")
      }

      fetchData()
      setDetailOpen(false)
    } catch {
      toast.error("Failed to save subscription changes")
    } finally {
      setDetailSaving(false)
    }
  }

  const selectedPlan = platformPlans.find((plan) => plan.id === detailPlanId) || platformPlans.find((plan) => plan.id === selectedSubscription?.plan?.id)

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
        action={
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
        }
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
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Billing Cycle</TableHead>
                    <TableHead>Plan Price</TableHead>
                    <TableHead>Custom Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Billing</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((sub) => (
                    <TableRow key={sub.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedSubscription(sub); setDetailOpen(true) }}>
                      <TableCell>
                        <div className="font-medium">{sub.business?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{sub.business?.businessType || ""}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{sub.plan?.name || sub.plan?.tier || "Unknown"}</Badge></TableCell>
                      <TableCell><span className="text-sm">{(sub.billingCycle === "MONTHLY" || sub.billingCycle === "monthly") ? "Monthly" : "Yearly"}</span></TableCell>
                      <TableCell><span className="text-sm font-medium">{formatCurrency(sub.planPrice)}</span></TableCell>
                      <TableCell>
                        <CurrencyBadge amount={sub.customPrice || sub.planPrice} override={!!sub.customPrice} original={sub.customPrice ? sub.planPrice : undefined} />
                      </TableCell>
                      <TableCell><StatusBadge status={getSubscriptionDisplayStatus(sub)} /></TableCell>
                      <TableCell><span className="text-sm">{formatDate(sub.nextBillingDate)}</span></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setSelectedSubscription(sub); setDetailOpen(true) }}>
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setSelectedSubscription(sub); setDetailOpen(true) }}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full max-w-[min(560px,90vw)] xl:max-w-[30vw]">
          {selectedSubscription && (
            <>
              <SheetHeader className="gap-4 pb-0 px-4 pt-4">
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{selectedSubscription.business?.name || "Unknown"}</h3>
                        <p className="text-sm text-muted-foreground">{selectedSubscription.plan?.name || "Unknown"} · {(selectedSubscription.billingCycle === "MONTHLY" || selectedSubscription.billingCycle === "monthly") ? "Monthly" : "Yearly"} billing</p>
                      </div>
                      <StatusBadge status={getSubscriptionDisplayStatus(selectedSubscription)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-700">Plan</span>
                          <span className="text-sm">{selectedSubscription.plan?.name || "Unknown"}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-700">Cycle</span>
                          <span className="text-sm">{(selectedSubscription.billingCycle === "MONTHLY" || selectedSubscription.billingCycle === "monthly") ? "Monthly" : "Yearly"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Subscription Active</p>
                        <p className="text-sm font-semibold text-slate-900">{subscriptionActive ? "Enabled" : "Disabled"}</p>
                      </div>
                      <Switch
                        checked={subscriptionActive}
                        onCheckedChange={handleSubscriptionActiveToggle}
                      />
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Business Online</p>
                        <p className="text-sm font-semibold text-slate-900">{businessOnline ? "Online" : "Offline"}</p>
                      </div>
                      <Switch
                        checked={businessOnline}
                        onCheckedChange={handleBusinessOnlineToggle}
                        disabled={!subscriptionActive}
                      />
                    </div>
                  </div>
                </div>
              </SheetHeader>
              <ScrollArea className="mt-3 h-[calc(100vh-220px)] px-4">
                <div className="space-y-4 pb-4">
                  <div className="grid gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                        <Label className="text-xs font-semibold text-slate-600 uppercase">Business Status</Label>
                        <Select value={detailBusinessStatus} onValueChange={setDetailBusinessStatus}>
                          <SelectTrigger className="w-full h-9 mt-2"><SelectValue placeholder="Status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ONBOARDING">ONBOARDING</SelectItem>
                            <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                            <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                            <SelectItem value="CHURNED">CHURNED</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                        <Label className="text-xs font-semibold text-slate-600 uppercase">Subscription Status</Label>
                        <Select value={detailSubscriptionStatus} onValueChange={(value) => setDetailSubscriptionStatus(value as SubscriptionDisplayStatus)}>
                          <SelectTrigger className="w-full h-9 mt-2"><SelectValue placeholder="Subscription status" /></SelectTrigger>
                          <SelectContent>
                            {subscriptionStatuses.map((status) => (<SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                        <Label className="text-xs font-semibold text-slate-600 uppercase">Plan Type</Label>
                        <Select value={detailPlanId} onValueChange={setDetailPlanId}>
                          <SelectTrigger className="w-full h-9 mt-2"><SelectValue placeholder="Select plan" /></SelectTrigger>
                          <SelectContent>
                            {platformPlans.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>{plan.name} — ₹{plan.price.toLocaleString("en-IN")}/{plan.billingCycle === "MONTHLY" ? "mo" : "yr"}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                        <Label className="text-xs font-semibold text-slate-600 uppercase">Billing Cycle</Label>
                        <Select value={detailBillingCycle} onValueChange={setDetailBillingCycle}>
                          <SelectTrigger className="w-full h-9 mt-2"><SelectValue placeholder="Billing cycle" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MONTHLY">Monthly</SelectItem>
                            <SelectItem value="YEARLY">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                        <Label className="text-xs font-semibold text-slate-600 uppercase">Period Start</Label>
                        <Input type="date" value={detailStartDate} onChange={(e) => setDetailStartDate(e.target.value)} className="mt-2 h-9" />
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                        <Label className="text-xs font-semibold text-slate-600 uppercase">Expiry Date</Label>
                        <Input type="date" value={detailExpiryDate} onChange={(e) => setDetailExpiryDate(e.target.value)} className="mt-2 h-9" />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Pricing Snapshot</h4>
                        <p className="text-xs text-muted-foreground">Compact pricing and override details</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{selectedSubscription.manualPriceOverride ? "Override" : "Standard"}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Base price</p>
                        <p className="mt-2 text-sm font-semibold">{formatCurrency(selectedSubscription.planPrice)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <Label className="text-xs font-semibold text-slate-600 uppercase">Custom price</Label>
                        <Input type="number" value={detailCustomPrice} onChange={(e) => setDetailCustomPrice(e.target.value)} className="mt-2 h-9" />
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Effective price</p>
                        <p className="mt-2 text-sm font-semibold text-orange-700">{formatCurrency(Math.max(0, Number(detailCustomPrice || selectedSubscription.customPrice || selectedSubscription.planPrice)))}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <Label className="text-xs font-semibold text-slate-600 uppercase">Override reason</Label>
                        <Textarea value={selectedSubscription.overrideReason || ""} readOnly className="mt-2 h-20 resize-none" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Period start</p>
                      <p className="mt-2 text-sm font-semibold">{formatDate(selectedSubscription.currentPeriodStart)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Period end</p>
                      <p className="mt-2 text-sm font-semibold">{formatDate(selectedSubscription.currentPeriodEnd)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Last payment</p>
                      <p className="mt-2 text-sm font-semibold">{selectedSubscription.lastPaymentDate ? formatDate(selectedSubscription.lastPaymentDate) : "—"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Last amount</p>
                      <p className="mt-2 text-sm font-semibold">{selectedSubscription.lastPaymentAmount ? formatCurrency(selectedSubscription.lastPaymentAmount) : "—"}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <button type="button" className="flex w-full items-center justify-between text-sm font-semibold text-slate-900" onClick={() => setBillingHistoryOpen((prev) => !prev)}>
                      <span>Billing History</span>
                      <span className="text-xs text-muted-foreground">{billingHistoryOpen ? "Collapse" : "Expand"}</span>
                    </button>
                    {billingHistoryOpen && (
                      <div className="mt-3 space-y-2">
                        {loadingBillingHistory ? (
                          <div className="rounded-lg border border-dashed p-3"><Skeleton className="h-20 w-full" /></div>
                        ) : billingHistory.length === 0 ? (
                          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No billing history available</div>
                        ) : (
                          <div className="space-y-2">
                            {billingHistory.map((record: any) => (
                              <div key={record.id} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">Amount</p>
                                  <p className="mt-1 text-sm font-semibold">{formatCurrency(record.amount)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">{new Date(record.dueDate).toLocaleDateString("en-IN")}</p>
                                  <p className="text-sm">{record.description || record.status}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="h-9 gap-2" onClick={handleOpenOverride}><IndianRupee className="h-3.5 w-3.5" /> Apply Discount</Button>
                      <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => handleRenewSubscription(selectedSubscription)}><RefreshCw className="h-3.5 w-3.5" /> Renew</Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-background/90 px-4 py-3 backdrop-blur-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button onClick={handleSaveSubscriptionChanges} disabled={detailSaving} className="w-full sm:w-auto">
                    {detailSaving ? "Saving…" : "Save Changes"}
                  </Button>
                  <Button variant={subscriptionActive ? "destructive" : "secondary"} onClick={() => subscriptionActive ? handleSuspendSubscription(selectedSubscription) : handleActivateSubscription(selectedSubscription)} className="w-full sm:w-auto">
                    {subscriptionActive ? "Suspend" : "Activate"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Pricing Override Dialog */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Override Pricing</DialogTitle>
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
              <div className="space-y-2"><Label>Discount Amount (₹)</Label>
                <Input type="number" min={0} max={overrideBasePrice} value={overrideDiscount || ""} onChange={(e) => { const val = parseInt(e.target.value) || 0; setOverrideDiscount(Math.min(val, overrideBasePrice)) }} placeholder="0" />
                <p className="text-xs text-muted-foreground">{overrideDiscount > 0 ? `${Math.round((overrideDiscount / overrideBasePrice) * 100)}% discount` : "Enter the discount amount"}</p>
              </div>
              <div className="space-y-2"><Label>Final Price (₹)</Label>
                <div className="flex items-center gap-2">
                  <Input value={formatCurrency(overrideFinalPrice)} readOnly className={`font-bold ${overrideDiscount > 0 ? "text-orange-700 bg-orange-50" : "bg-muted"}`} />
                  {overrideDiscount > 0 && <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px] border-0 shrink-0">CUSTOM</Badge>}
                </div>
              </div>
              <div className="space-y-2"><Label>Reason for Override *</Label><Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="e.g., Long-term customer loyalty discount, early adopter pricing..." rows={3} /></div>
              <div className="space-y-2"><Label>Approved By *</Label>
                <Select value={overrideApprover} onValueChange={setOverrideApprover}><SelectTrigger><SelectValue placeholder="Select approver" /></SelectTrigger>
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
