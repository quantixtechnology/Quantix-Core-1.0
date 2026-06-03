"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { PageHeader } from "../shared/page-header"
import { StatCard } from "../shared/stat-card"
import { StatusBadge } from "../shared/status-badge"
import { EmptyState } from "../shared/empty-state"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  CreditCard, Search, X, IndianRupee, AlertTriangle, CheckCircle2,
  ArrowUpRight, RefreshCw, Shield, Pencil, PauseCircle,
  CalendarDays, History, Phone, Mail, CheckCheck, Clock,
  BanknoteIcon, TrendingUp, Bell, Store,
} from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"

// ── Types ──────────────────────────────────────────────────────────────────────

interface SubscriptionApiData {
  id: string; businessId: string; planId: string; status: string
  subscriptionAmount: number | null; discountAmount: number | null; finalAmount: number | null
  planPrice: number | null; customPrice: number | null; discountPercentage: number | null
  billingCycle: string
  manualPriceOverride: boolean; overrideReason: string | null; overrideApprovedBy: string | null
  currentPeriodStart: string; currentPeriodEnd: string
  nextBillingDate: string; nextPaymentAmount: number | null
  lastPaymentDate: string | null; lastPaymentAmount: number | null
  autoRenew: boolean; cancelledAt: string | null; cancelReason: string | null
  notes: string | null; createdAt: string
  business: { id: string; name: string; slug: string; businessType: string; status: string; contactPhone: string | null; contactEmail: string | null }
  plan: { id: string; name: string; tier: string; maxStores: number; maxProducts: number; maxOrders: number }
}

interface PlatformPlanData {
  id: string; name: string; tier: string
  description: string | null
  maxStores: number; maxProducts: number; maxOrders: number
  maxDeliveryPartners: number; maxStaff: number
  hasPOS: boolean; hasDelivery: boolean; hasSubscription: boolean
  hasCustomDomain: boolean; hasWhiteLabel: boolean; hasAdvancedReports: boolean; hasAPIAccess: boolean
  features: string; isActive: boolean
}

interface RenewalRow {
  subscriptionId: string; businessId: string; businessName: string
  businessType: string; businessStatus: string
  contactPhone: string | null; contactEmail: string | null
  planTier: string; planName: string
  billingCycle: string; subscriptionStatus: string; renewalStatus: string
  daysUntilDue: number; amountDue: number; baseAmountDue: number
  extraStores: number; extraStoreAmount: number
  currentPeriodStart: string; currentPeriodEnd: string
  nextBillingDate: string; lastPaymentDate: string | null; lastPaymentAmount: number | null
  reminderSentAt: string | null
  lastRecord: { id: string; amount: number; status: string; paidDate: string | null; paymentMode: string | null; invoiceNumber: string | null; periodLabel: string | null } | null
  notes: string | null
}

interface RenewalStats {
  dueToday: number; overdue: number; upcomingNextWeek: number; suspended: number; collectionsThisMonth: number
}

interface BillingHistoryYear {
  year: number
  totalPaid: number
  records: Array<{
    id: string; amount: number; currency: string; status: string
    invoiceNumber: string | null; paymentMode: string | null
    paidBy: string | null; receiptReference: string | null; remarks: string | null
    periodYear: number | null; periodLabel: string | null
    dueDate: string; paidDate: string | null; description: string | null; createdAt: string
  }>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED" | "EXPIRED"
type SubscriptionDisplayStatus = SubscriptionStatus | "PENDING_ACTIVATION" | "PAUSED"

const RENEWAL_STATUS_CONFIG: Record<string, { cls: string; label: string }> = {
  Paid:      { cls: "bg-emerald-50 text-emerald-700 border-emerald-200",  label: "Paid" },
  Due:       { cls: "bg-amber-50  text-amber-700  border-amber-200",   label: "Due Soon" },
  Overdue:   { cls: "bg-red-50    text-red-700    border-red-200",     label: "Overdue" },
  Upcoming:  { cls: "bg-sky-50    text-sky-700    border-sky-200",     label: "Upcoming" },
  Suspended: { cls: "bg-gray-100  text-gray-600   border-gray-200",   label: "Suspended" },
  Cancelled: { cls: "bg-gray-100  text-gray-500   border-gray-200",   label: "Cancelled" },
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—"
  return `₹${amount.toLocaleString("en-IN")}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  try { return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) } catch { return dateStr }
}

function formatInputDate(dateStr: string | null) {
  if (!dateStr) return ""
  try { return new Date(dateStr).toISOString().slice(0, 10) } catch { return "" }
}

function getSubscriptionDisplayStatus(sub: SubscriptionApiData): SubscriptionDisplayStatus {
  if (sub.status === "ACTIVE" && sub.business?.status === "ONBOARDING") return "PENDING_ACTIVATION"
  return sub.status as SubscriptionDisplayStatus
}

function effectiveAmount(sub: SubscriptionApiData): number {
  return sub.finalAmount ?? sub.subscriptionAmount ?? sub.customPrice ?? sub.planPrice ?? 0
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SubscriptionsView() {
  const { searchQuery } = useAdminStore()
  const { permissions } = useAuthStore()
  const canEdit = permissions.includes("subscriptions:edit" as never)
  const canManagePlans = permissions.includes("subscriptions:edit" as never)

  // ── Subscriptions tab data ──────────────────────────────────────────────────
  const [subscriptions, setSubscriptions] = useState<SubscriptionApiData[]>([])
  const [platformPlans, setPlatformPlans] = useState<PlatformPlanData[]>([])
  const [apiStats, setApiStats] = useState<{ total: number; active: number; pastDue: number; suspended: number; monthlyMRR: number; yearlyProjected: number } | null>(null)
  const [loadingSubs, setLoadingSubs] = useState(true)
  const [errorSubs, setErrorSubs] = useState<string | null>(null)

  // ── Renewals tab data ───────────────────────────────────────────────────────
  const [renewals, setRenewals] = useState<RenewalRow[]>([])
  const [renewalStats, setRenewalStats] = useState<RenewalStats | null>(null)
  const [loadingRenewals, setLoadingRenewals] = useState(true)
  const [errorRenewals, setErrorRenewals] = useState<string | null>(null)

  // ── Shared filters ──────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [billingFilter, setBillingFilter] = useState<string>("all")
  const [renewalStatusFilter, setRenewalStatusFilter] = useState<string>("all")

  // ── Subscriptions edit drawer ───────────────────────────────────────────────
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionApiData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
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

  // ── Mark Received dialog ────────────────────────────────────────────────────
  const [markOpen, setMarkOpen] = useState(false)
  const [markRow, setMarkRow] = useState<RenewalRow | null>(null)
  const [markAmount, setMarkAmount] = useState<string>("")
  const [markMode, setMarkMode] = useState<string>("")
  const [markPaidBy, setMarkPaidBy] = useState<string>("")
  const [markRef, setMarkRef] = useState<string>("")
  const [markRemarks, setMarkRemarks] = useState<string>("")
  const [markPeriodLabel, setMarkPeriodLabel] = useState<string>("")
  const [markPaidDate, setMarkPaidDate] = useState<string>("")
  const [markSubmitting, setMarkSubmitting] = useState(false)

  // ── Payment History sheet ───────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyBusiness, setHistoryBusiness] = useState<{ id: string; name: string } | null>(null)
  const [historyData, setHistoryData] = useState<BillingHistoryYear[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // ── Reminder state ──────────────────────────────────────────────────────────
  const [reminderSending, setReminderSending] = useState<string | null>(null)

  // ── Manage plans dialog ─────────────────────────────────────────────────────
  const [managePlansOpen, setManagePlansOpen] = useState(false)

  // ── Fetch subscriptions ─────────────────────────────────────────────────────
  const fetchSubscriptions = useCallback(async () => {
    setLoadingSubs(true); setErrorSubs(null)
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
      setErrorSubs(err instanceof Error ? err.message : "Failed to load subscriptions")
    } finally { setLoadingSubs(false) }
  }, [])

  // ── Fetch renewals ──────────────────────────────────────────────────────────
  const fetchRenewals = useCallback(async () => {
    setLoadingRenewals(true); setErrorRenewals(null)
    try {
      const res = await fetch("/api/admin/billing/renewals", { headers: getAuthHeaders() })
      if (!res.ok) throw new Error("Failed to fetch renewals")
      const json = await res.json()
      if (json.success) {
        setRenewals(json.data)
        setRenewalStats(json.stats)
      }
    } catch (err) {
      setErrorRenewals(err instanceof Error ? err.message : "Failed to load renewals")
    } finally { setLoadingRenewals(false) }
  }, [])

  useEffect(() => { fetchSubscriptions(); fetchRenewals() }, [])

  // ── Computed stats ──────────────────────────────────────────────────────────
  const subStats = useMemo(() => {
    if (apiStats) return apiStats
    const active = subscriptions.filter(s => s.status === "ACTIVE").length
    const pastDue = subscriptions.filter(s => s.status === "PAST_DUE").length
    const suspended = subscriptions.filter(s => s.status === "SUSPENDED").length
    let monthlyMRR = 0; let yearlyProjected = 0
    for (const s of subscriptions.filter(s => s.status === "ACTIVE" || s.status === "PAST_DUE")) {
      const price = effectiveAmount(s)
      const isMonthly = s.billingCycle?.toUpperCase() === "MONTHLY"
      if (isMonthly) { monthlyMRR += price; yearlyProjected += price * 12 }
      else { monthlyMRR += Math.round(price / 12); yearlyProjected += price }
    }
    return { total: subscriptions.length, active, pastDue, suspended, monthlyMRR, yearlyProjected }
  }, [subscriptions, apiStats])

  // ── Filtered subscriptions ──────────────────────────────────────────────────
  const filteredSubs = useMemo(() => subscriptions.filter((sub) => {
    const matchSearch = !searchQuery || sub.business?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    const displayStatus = getSubscriptionDisplayStatus(sub)
    const matchStatus = statusFilter === "all" || displayStatus === statusFilter
    const matchBilling = billingFilter === "all" || (sub.billingCycle?.toUpperCase() === billingFilter)
    return matchSearch && matchStatus && matchBilling
  }), [subscriptions, searchQuery, statusFilter, billingFilter])

  // ── Filtered renewals ───────────────────────────────────────────────────────
  const filteredRenewals = useMemo(() => renewals.filter((r) => {
    const matchSearch = !searchQuery || r.businessName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = renewalStatusFilter === "all" || r.renewalStatus === renewalStatusFilter
    return matchSearch && matchStatus
  }), [renewals, searchQuery, renewalStatusFilter])

  // ── Mark Received handlers ──────────────────────────────────────────────────
  const openMarkReceived = (row: RenewalRow) => {
    setMarkRow(row)
    setMarkAmount(row.amountDue > 0 ? row.amountDue.toString() : "")
    setMarkMode("")
    setMarkPaidBy("")
    setMarkRef("")
    setMarkRemarks("")
    setMarkPaidDate(new Date().toISOString().slice(0, 10))
    const now = new Date()
    setMarkPeriodLabel(`${now.toLocaleString("en-IN", { month: "long" })} ${now.getFullYear()}`)
    setMarkOpen(true)
  }

  const handleMarkReceived = async () => {
    if (!markRow || !markMode || !markAmount) return
    setMarkSubmitting(true)
    try {
      const res = await fetch(`/api/admin/billing/${markRow.businessId}/mark-received`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({
          amount: Number(markAmount),
          paymentMode: markMode,
          paidBy: markPaidBy || undefined,
          receiptReference: markRef || undefined,
          remarks: markRemarks || undefined,
          periodLabel: markPeriodLabel || undefined,
          periodYear: new Date(markPaidDate).getFullYear(),
          paidDate: markPaidDate,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Payment recorded successfully")
        setMarkOpen(false)
        fetchRenewals()
      } else {
        toast.error(json.error || "Failed to record payment")
      }
    } catch { toast.error("Failed to record payment") }
    finally { setMarkSubmitting(false) }
  }

  // ── Payment History handlers ────────────────────────────────────────────────
  const openHistory = async (businessId: string, businessName: string) => {
    setHistoryBusiness({ id: businessId, name: businessName })
    setHistoryData([])
    setHistoryOpen(true)
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/admin/billing/${businessId}/history`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) setHistoryData(json.data)
    } catch { toast.error("Failed to load history") }
    finally { setLoadingHistory(false) }
  }

  // ── Send Reminder handler ───────────────────────────────────────────────────
  const handleSendReminder = async (businessId: string, businessName: string) => {
    setReminderSending(businessId)
    try {
      const res = await fetch(`/api/admin/billing/${businessId}/send-reminder`, {
        method: "POST", headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.warned ? `Reminder logged (email failed: ${json.message})` : `Reminder sent to ${businessName}`)
        fetchRenewals()
      } else {
        toast.error(json.error || "Failed to send reminder")
      }
    } catch { toast.error("Failed to send reminder") }
    finally { setReminderSending(null) }
  }

  // ── Edit subscription drawer ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedSubscription || !detailOpen) return
    setDetailBusinessStatus(selectedSubscription.business?.status || "ONBOARDING")
    setDetailSubscriptionStatus(getSubscriptionDisplayStatus(selectedSubscription))
    setDetailPlanId(selectedSubscription.plan?.id || "")
    setDetailBillingCycle(selectedSubscription.billingCycle?.toUpperCase() === "YEARLY" ? "YEARLY" : "MONTHLY")
    setDetailStartDate(formatInputDate(selectedSubscription.currentPeriodStart))
    setDetailExpiryDate(formatInputDate(selectedSubscription.currentPeriodEnd))
    setDetailCustomPrice(selectedSubscription.finalAmount ? selectedSubscription.finalAmount.toString() : selectedSubscription.customPrice ? selectedSubscription.customPrice.toString() : "")
    setDetailNotes(selectedSubscription.notes || "")
    setDetailAutoRenew(selectedSubscription.autoRenew)
  }, [selectedSubscription, detailOpen])

  const handleRenewSubscription = async (sub: SubscriptionApiData) => {
    try {
      const now = new Date()
      const nextEnd = new Date(now)
      if (sub.billingCycle?.toUpperCase() === "YEARLY") nextEnd.setFullYear(nextEnd.getFullYear() + 1)
      else nextEnd.setMonth(nextEnd.getMonth() + 1)
      const res = await fetch(`/api/core/businesses/${sub.businessId}/subscription`, {
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify({ currentPeriodStart: now.toISOString(), currentPeriodEnd: nextEnd.toISOString(), nextBillingDate: nextEnd.toISOString() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) { toast.error(json.error || "Failed to renew"); return }
      toast.success("Subscription renewed"); fetchSubscriptions()
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
      if (detailBillingCycle && detailBillingCycle !== selectedSubscription.billingCycle?.toUpperCase()) updates.billingCycle = detailBillingCycle
      if (detailCustomPrice) {
        const v = Number(detailCustomPrice)
        if (!Number.isNaN(v) && v >= 0) { updates.finalAmount = v; updates.overrideReason = "Updated via admin" }
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

      toast.success("Subscription saved")
      fetchSubscriptions()
      setDetailOpen(false)
    } catch { toast.error("Failed to save subscription") }
    finally { setDetailSaving(false) }
  }

  const statusOptions: { value: SubscriptionDisplayStatus; label: string; active: string; hover: string }[] = [
    { value: "ACTIVE", label: "Active", active: "bg-emerald-600 text-white border-emerald-600", hover: "hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300" },
    { value: "PAUSED", label: "Paused", active: "bg-amber-500 text-white border-amber-500", hover: "hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300" },
    { value: "SUSPENDED", label: "Suspended", active: "bg-red-600 text-white border-red-600", hover: "hover:bg-red-50 hover:text-red-700 hover:border-red-300" },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Management"
        description="Renewals tracking, payment recording, and subscription configuration"
        icon={CreditCard}
        action={canManagePlans ? (
          <Button variant="outline" className="gap-2" onClick={() => setManagePlansOpen(true)}>
            <Shield className="h-4 w-4" /> Plans
          </Button>
        ) : undefined}
      />

      <Tabs defaultValue="renewals" className="space-y-5">
        <TabsList className="h-9">
          <TabsTrigger value="renewals" className="text-xs gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Renewals</TabsTrigger>
          <TabsTrigger value="subscriptions" className="text-xs gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Subscriptions</TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════════════════════
            TAB: RENEWALS
            ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="renewals" className="space-y-5">
          {/* Stat cards */}
          {loadingRenewals ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
              {[...Array(5)].map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-12 w-full" /></CardContent></Card>)}
            </div>
          ) : renewalStats ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard title="Due Today" value={renewalStats.dueToday} change="requires action" changeType={renewalStats.dueToday > 0 ? "negative" : "neutral"} icon={Clock} iconColor="text-amber-600" iconBg="bg-amber-50" />
              <StatCard title="Overdue" value={renewalStats.overdue} change="past due date" changeType={renewalStats.overdue > 0 ? "negative" : "neutral"} icon={AlertTriangle} iconColor="text-red-600" iconBg="bg-red-50" />
              <StatCard title="Due This Week" value={renewalStats.upcomingNextWeek} change="next 7 days" changeType="neutral" icon={CalendarDays} iconColor="text-sky-600" iconBg="bg-sky-50" />
              <StatCard title="Suspended" value={renewalStats.suspended} change="manual action needed" changeType={renewalStats.suspended > 0 ? "negative" : "neutral"} icon={PauseCircle} iconColor="text-gray-500" iconBg="bg-gray-100" />
              <StatCard title="Collections (Month)" value={formatCurrency(renewalStats.collectionsThisMonth)} change="payments received" changeType="positive" icon={TrendingUp} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
            </div>
          ) : null}

          {errorRenewals && (
            <Card><CardContent className="p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">{errorRenewals}</p>
              <Button variant="outline" size="sm" onClick={fetchRenewals} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
            </CardContent></Card>
          )}

          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search businesses..." className="pl-8 h-9" value={searchQuery} readOnly />
            </div>
            <Select value={renewalStatusFilter} onValueChange={setRenewalStatusFilter}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Renewal Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {["Paid", "Due", "Overdue", "Upcoming", "Suspended", "Cancelled"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {renewalStatusFilter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setRenewalStatusFilter("all")}><X className="h-3 w-3 mr-1" /> Clear</Button>
            )}
            <Button variant="outline" size="sm" className="ml-auto gap-1.5 h-9" onClick={fetchRenewals}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>

          {/* Renewals grid table */}
          {!loadingRenewals && (
            filteredRenewals.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No renewals found" description="Try adjusting your filters" />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-[11px]">
                          <TableHead className="min-w-[160px]">Business</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Cycle</TableHead>
                          <TableHead className="text-right">Amount Due</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Days</TableHead>
                          <TableHead>Next Billing</TableHead>
                          <TableHead>Last Paid</TableHead>
                          <TableHead className="text-right">Last Amt</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Last Record</TableHead>
                          <TableHead>Reminder</TableHead>
                          <TableHead className="text-right min-w-[140px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRenewals.map((row) => {
                          const cfg = RENEWAL_STATUS_CONFIG[row.renewalStatus] ?? RENEWAL_STATUS_CONFIG["Upcoming"]
                          const daysLabel = row.daysUntilDue < 0
                            ? `${Math.abs(row.daysUntilDue)}d ago`
                            : row.daysUntilDue === 0 ? "Today"
                            : `+${row.daysUntilDue}d`
                          const daysColor = row.daysUntilDue < 0 ? "text-red-600 font-bold"
                            : row.daysUntilDue <= 7 ? "text-amber-600 font-semibold"
                            : "text-muted-foreground"
                          return (
                            <TableRow key={row.subscriptionId} className="text-xs">
                              <TableCell>
                                <div className="font-medium">{row.businessName}</div>
                                <div className="text-[10px] text-muted-foreground">{row.businessType.replace(/_/g, " ")}</div>
                              </TableCell>
                              <TableCell><Badge variant="outline" className="text-[10px]">{row.planTier}</Badge></TableCell>
                              <TableCell><span className="text-[10px]">{row.billingCycle}</span></TableCell>
                              <TableCell className="text-right">
                                <div className="font-semibold">{formatCurrency(row.amountDue)}</div>
                                {row.extraStores > 0 && (
                                  <div className="flex items-center justify-end gap-0.5 text-[9px] text-amber-600 mt-0.5">
                                    <Store className="h-2.5 w-2.5" />+{row.extraStores} stores ({formatCurrency(row.extraStoreAmount)})
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>{cfg.label}</span>
                              </TableCell>
                              <TableCell className={`text-center text-[10px] ${daysColor}`}>{daysLabel}</TableCell>
                              <TableCell><span className="text-[10px]">{formatDate(row.nextBillingDate)}</span></TableCell>
                              <TableCell><span className="text-[10px] text-muted-foreground">{formatDate(row.lastPaymentDate)}</span></TableCell>
                              <TableCell className="text-right text-[10px] text-muted-foreground">{formatCurrency(row.lastPaymentAmount)}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-0.5">
                                  {row.contactPhone && <a href={`tel:${row.contactPhone}`} className="flex items-center gap-1 text-[10px] text-sky-600 hover:underline"><Phone className="h-2.5 w-2.5" />{row.contactPhone}</a>}
                                  {row.contactEmail && <a href={`mailto:${row.contactEmail}`} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:underline"><Mail className="h-2.5 w-2.5" />{row.contactEmail}</a>}
                                </div>
                              </TableCell>
                              <TableCell>
                                {row.lastRecord ? (
                                  <div>
                                    <div className="text-[10px] font-medium">{row.lastRecord.invoiceNumber || "—"}</div>
                                    <div className="text-[10px] text-muted-foreground">{row.lastRecord.paymentMode || "—"}</div>
                                  </div>
                                ) : <span className="text-[10px] text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell>
                                {row.reminderSentAt
                                  ? <span className="text-[10px] text-muted-foreground">{formatDate(row.reminderSentAt)}</span>
                                  : <span className="text-[10px] text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px] gap-1 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                    onClick={() => openMarkReceived(row)}
                                    title="Mark payment received"
                                  >
                                    <CheckCheck className="h-3 w-3" /> Received
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px] gap-1 text-sky-700 hover:bg-sky-50"
                                    onClick={() => openHistory(row.businessId, row.businessName)}
                                    title="View payment history"
                                  >
                                    <History className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px] gap-1 text-violet-700 hover:bg-violet-50"
                                    onClick={() => handleSendReminder(row.businessId, row.businessName)}
                                    disabled={reminderSending === row.businessId}
                                    title="Send renewal reminder email"
                                  >
                                    <Bell className="h-3 w-3" />{reminderSending === row.businessId ? "…" : ""}
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
            )
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════
            TAB: SUBSCRIPTIONS
            ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="subscriptions" className="space-y-5">
          {loadingSubs ? (
            <div className="space-y-4">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
              </div>
              <Card><CardContent className="p-6"><Skeleton className="h-[400px] w-full" /></CardContent></Card>
            </div>
          ) : errorSubs ? (
            <Card><CardContent className="p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">{errorSubs}</p>
              <Button variant="outline" size="sm" onClick={fetchSubscriptions} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
            </CardContent></Card>
          ) : (
            <>
              {/* Stat cards */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Active" value={subStats.active} change={`${subStats.total} total`} changeType="neutral" icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
                <StatCard title="Monthly MRR" value={formatCurrency(subStats.monthlyMRR)} change={`${subscriptions.filter(s => s.billingCycle?.toUpperCase() === "MONTHLY").length} monthly`} changeType="positive" icon={IndianRupee} iconColor="text-sky-600" iconBg="bg-sky-50" />
                <StatCard title="Yearly Revenue" value={formatCurrency(subStats.yearlyProjected)} change={`${subscriptions.filter(s => s.billingCycle?.toUpperCase() === "YEARLY").length} yearly`} changeType="neutral" icon={ArrowUpRight} iconColor="text-amber-600" iconBg="bg-amber-50" />
                <StatCard title="Overdue" value={subStats.pastDue} change={subStats.suspended > 0 ? `${subStats.suspended} suspended` : "No suspensions"} changeType={subStats.pastDue > 0 ? "negative" : "neutral"} icon={AlertTriangle} iconColor="text-red-600" iconBg="bg-red-50" />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search subscriptions..." className="pl-8 h-9" value={searchQuery} readOnly />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {(["ACTIVE", "PENDING_ACTIVATION", "PAUSED", "PAST_DUE", "SUSPENDED", "EXPIRED", "CANCELLED"] as const).map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={billingFilter} onValueChange={setBillingFilter}>
                  <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Billing" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cycles</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="HALF_YEARLY">Half-Yearly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                {(statusFilter !== "all" || billingFilter !== "all") && (
                  <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setBillingFilter("all") }}><X className="h-3 w-3 mr-1" /> Clear</Button>
                )}
              </div>

              {/* Table */}
              {filteredSubs.length === 0 ? (
                <EmptyState icon={CreditCard} title="No subscriptions found" description="Try adjusting your filters" />
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
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Next Billing</TableHead>
                            <TableHead className="text-right w-[72px]">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSubs.map((sub) => (
                            <TableRow key={sub.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedSubscription(sub); setDetailOpen(true) }}>
                              <TableCell>
                                <div className="font-medium text-sm">{sub.business?.name || "Unknown"}</div>
                                <div className="text-xs text-muted-foreground">{sub.business?.businessType || ""}</div>
                              </TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">{sub.plan?.name || sub.plan?.tier || "Unknown"}</Badge></TableCell>
                              <TableCell><span className="text-sm">{{ MONTHLY: "Monthly", QUARTERLY: "Quarterly", HALF_YEARLY: "Half-Yearly", YEARLY: "Yearly" }[sub.billingCycle?.toUpperCase()] ?? sub.billingCycle}</span></TableCell>
                              <TableCell className="text-right font-medium text-sm">{formatCurrency(effectiveAmount(sub))}</TableCell>
                              <TableCell><StatusBadge status={getSubscriptionDisplayStatus(sub)} /></TableCell>
                              <TableCell><span className="text-sm">{formatDate(sub.nextBillingDate)}</span></TableCell>
                              {canEdit && (
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedSubscription(sub); setDetailOpen(true) }}>
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
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Mark Received Dialog ─────────────────────────────────────────── */}
      <Dialog open={markOpen} onOpenChange={setMarkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BanknoteIcon className="h-4 w-4" /> Mark Payment Received</DialogTitle>
            <DialogDescription>{markRow?.businessName} — record a manual payment</DialogDescription>
          </DialogHeader>
          {markRow && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount (₹) *</Label>
                  <Input type="number" value={markAmount} onChange={(e) => setMarkAmount(e.target.value)} placeholder="0" className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Paid Date *</Label>
                  <Input type="date" value={markPaidDate} onChange={(e) => setMarkPaidDate(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Mode *</Label>
                <Select value={markMode} onValueChange={setMarkMode}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="ONLINE">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Paid By</Label>
                  <Input value={markPaidBy} onChange={(e) => setMarkPaidBy(e.target.value)} placeholder="Contact name" className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Receipt / Ref No.</Label>
                  <Input value={markRef} onChange={(e) => setMarkRef(e.target.value)} placeholder="TXN ID, receipt no." className="h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Period Label</Label>
                <Input value={markPeriodLabel} onChange={(e) => setMarkPeriodLabel(e.target.value)} placeholder="e.g. May 2025, Q1 2025" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Remarks</Label>
                <Textarea value={markRemarks} onChange={(e) => setMarkRemarks(e.target.value)} placeholder="Optional notes about this payment" rows={2} className="text-sm resize-none" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkOpen(false)}>Cancel</Button>
            <Button onClick={handleMarkReceived} disabled={!markAmount || !markMode || markSubmitting} className="gap-2">
              {markSubmitting ? "Saving..." : <><CheckCheck className="h-4 w-4" /> Confirm Payment</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Payment History Sheet ────────────────────────────────────────── */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="w-[520px] sm:max-w-[520px] flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Payment History</SheetTitle>
            <SheetDescription>{historyBusiness?.name}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 py-5 space-y-5">
              {loadingHistory ? (
                <Skeleton className="h-40 w-full rounded-lg" />
              ) : historyData.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No payment records found</div>
              ) : (
                historyData.map((yearGroup) => (
                  <div key={yearGroup.year} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{yearGroup.year}</p>
                      <span className="text-xs font-semibold text-emerald-700">{formatCurrency(yearGroup.totalPaid)} collected</span>
                    </div>
                    <div className="space-y-2">
                      {yearGroup.records.map((r) => (
                        <div key={r.id} className="rounded-lg border px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold">{formatCurrency(r.amount)}</span>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${r.status === "paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                              {r.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                            {r.periodLabel && <span>Period: {r.periodLabel}</span>}
                            {r.paymentMode && <span>Mode: {r.paymentMode.replace(/_/g, " ")}</span>}
                            {r.paidBy && <span>Paid by: {r.paidBy}</span>}
                            {r.receiptReference && <span>Ref: {r.receiptReference}</span>}
                            {r.invoiceNumber && <span>Invoice: {r.invoiceNumber}</span>}
                            {r.paidDate && <span>Paid: {formatDate(r.paidDate)}</span>}
                          </div>
                          {r.remarks && <p className="mt-1.5 text-[11px] text-muted-foreground italic">{r.remarks}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <SheetFooter className="px-6 py-4 border-t bg-background">
            <Button variant="outline" className="w-full" onClick={() => setHistoryOpen(false)}>Close</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit Subscription Drawer ─────────────────────────────────────── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[540px] sm:max-w-[540px] flex flex-col p-0">
          {selectedSubscription && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="text-base font-semibold leading-tight">{selectedSubscription.business?.name || "Unknown"}</SheetTitle>
                    <SheetDescription className="text-xs mt-0.5">
                      {selectedSubscription.plan?.name} Plan · {selectedSubscription.billingCycle?.toUpperCase() === "YEARLY" ? "Yearly" : "Monthly"} Billing
                    </SheetDescription>
                  </div>
                  <StatusBadge status={getSubscriptionDisplayStatus(selectedSubscription)} />
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1 min-h-0">
                <div className="px-6 py-5 space-y-6">

                  {/* Status Management */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status Management</p>
                    <div>
                      <Label className="text-xs mb-1.5 block">Subscription Status</Label>
                      <div className="flex rounded-lg border overflow-hidden divide-x">
                        {statusOptions.map((opt) => (
                          <button key={opt.value} type="button" onClick={() => setDetailSubscriptionStatus(opt.value)}
                            className={`flex-1 py-2 text-xs font-semibold transition-colors border-0 ${detailSubscriptionStatus === opt.value ? opt.active : `text-muted-foreground bg-background ${opt.hover}`}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {detailSubscriptionStatus === "PAUSED" && (
                        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1"><PauseCircle className="h-3 w-3" /> Mapped to Suspended with pause note</p>
                      )}
                    </div>
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

                  {/* Plan & Billing */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan & Billing</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Change Plan</Label>
                        <Select value={detailPlanId} onValueChange={setDetailPlanId}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select plan" /></SelectTrigger>
                          <SelectContent>
                            {platformPlans.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>{plan.name} ({plan.tier})</SelectItem>
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
                            <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                            <SelectItem value="HALF_YEARLY">Half-Yearly</SelectItem>
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
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200" onClick={() => handleRenewSubscription(selectedSubscription)}>
                      <RefreshCw className="h-3 w-3" /> Renew for Next Period
                    </Button>
                  </div>

                  <Separator />

                  {/* Pricing */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Effective Pricing</p>
                    <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Current Effective Amount</span>
                      <span className="text-sm font-semibold">{formatCurrency(effectiveAmount(selectedSubscription))}</span>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Override Final Amount (₹)</Label>
                      <Input type="number" value={detailCustomPrice} onChange={(e) => setDetailCustomPrice(e.target.value)}
                        placeholder={effectiveAmount(selectedSubscription).toString()} className="h-8 text-xs" />
                    </div>
                    {selectedSubscription.overrideReason && (
                      <p className="text-xs text-muted-foreground">Override reason: {selectedSubscription.overrideReason}</p>
                    )}
                  </div>

                  <Separator />

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Internal Notes</p>
                    <Textarea value={detailNotes} onChange={(e) => setDetailNotes(e.target.value)} placeholder="Internal notes (not visible to business)..." rows={3} className="text-xs resize-none" />
                  </div>

                  <Separator />

                  {/* Billing Period read-only */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billing Period</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Period Start", value: formatDate(selectedSubscription.currentPeriodStart) },
                        { label: "Period End", value: formatDate(selectedSubscription.currentPeriodEnd) },
                        { label: "Next Billing", value: formatDate(selectedSubscription.nextBillingDate) },
                        { label: "Last Payment", value: formatDate(selectedSubscription.lastPaymentDate) },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-lg border px-3 py-2">
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                          <p className="text-xs font-medium mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>
                    {selectedSubscription.lastPaymentAmount != null && (
                      <div className="rounded-lg border px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">Last Payment Amount</p>
                        <p className="text-xs font-medium mt-0.5">{formatCurrency(selectedSubscription.lastPaymentAmount)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

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

      {/* ── Manage Plans Dialog ──────────────────────────────────────────── */}
      <Dialog open={managePlansOpen} onOpenChange={setManagePlansOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Platform Plans</DialogTitle>
            <DialogDescription>Feature access tiers — pricing is set per business.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {platformPlans.map((plan) => (
              <Card key={plan.id} className="border-2">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div><h4 className="font-semibold">{plan.name}</h4><p className="text-xs text-muted-foreground">{plan.tier} tier</p></div>
                    <div className="text-right"><p className="text-xs text-muted-foreground">Pricing set per business</p></div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>Up to {plan.maxStores} stores</span></div>
                    <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>{plan.maxProducts.toLocaleString()} products</span></div>
                    {plan.hasPOS && <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>POS System</span></div>}
                    {plan.hasCustomDomain && <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span>Custom Domain</span></div>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManagePlansOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
