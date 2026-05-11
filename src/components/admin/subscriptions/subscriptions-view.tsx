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

const subscriptionStatuses: SubscriptionStatus[] = ["ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"]

function getSubscriptionStatusColor(status: SubscriptionStatus): string {
  const map: Record<SubscriptionStatus, string> = { ACTIVE: "text-emerald-700", PAST_DUE: "text-amber-700", SUSPENDED: "text-red-700", CANCELLED: "text-slate-500", EXPIRED: "text-slate-500" }
  return map[status] || "text-slate-700"
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

  useEffect(() => { fetchData() }, [fetchData])

  const stats = useMemo(() => {
    if (apiStats) return apiStats
    const active = subscriptions.filter(s => s.status === "ACTIVE").length
    const overdue = subscriptions.filter(s => s.status === "PAST_DUE").length
    const suspended = subscriptions.filter(s => s.status === "SUSPENDED").length
    let monthlyMRR = 0; let yearlyProjected = 0
    for (const s of subscriptions.filter(s => s.status === "ACTIVE" || s.status === "PAST_DUE")) {
      const price = s.customPrice || s.planPrice
      const isMonthly = s.billingCycle === "MONTHLY" || s.billingCycle === "monthly"
      if (isMonthly) { monthlyMRR += price; yearlyProjected += price * 12 } else { monthlyMRR += Math.round(price / 12); yearlyProjected += price }
    }
    return { total: subscriptions.length, active, overdue, suspended, monthlyMRR, yearlyProjected }
  }, [subscriptions, apiStats])

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchSearch = !searchQuery || sub.business?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || sub.id.toLowerCase().includes(searchQuery.toLowerCase())
      const matchStatus = statusFilter === "all" || sub.status === statusFilter
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
        <StatCard title="Overdue" value={stats.overdue} change={stats.suspended > 0 ? `${stats.suspended} suspended` : "No suspensions"} changeType={stats.overdue > 0 ? "negative" : "neutral"} icon={AlertTriangle} iconColor="text-red-600" iconBg="bg-red-50" />
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
                      <TableCell><StatusBadge status={sub.status} /></TableCell>
                      <TableCell><span className="text-sm">{formatDate(sub.nextBillingDate)}</span></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setSelectedSubscription(sub); setDetailOpen(true) }}>View</Button>
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
        <SheetContent className="w-[520px] sm:max-w-[520px]">
          {selectedSubscription && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">{selectedSubscription.business?.name || "Unknown"}<StatusBadge status={selectedSubscription.status} /></SheetTitle>
                <SheetDescription>
                  {selectedSubscription.plan?.name || "Unknown"} Plan · {(selectedSubscription.billingCycle === "MONTHLY" || selectedSubscription.billingCycle === "monthly") ? "Monthly" : "Yearly"} billing
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="mt-6 h-[calc(100vh-180px)]">
                <div className="space-y-6 pr-4">
                  {/* Subscription Overview */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Subscription Overview</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Plan</p><p className="text-sm font-medium">{selectedSubscription.plan?.name || "Unknown"} ({selectedSubscription.plan?.tier})</p></div>
                      <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Billing Cycle</p><p className="text-sm font-medium">{(selectedSubscription.billingCycle === "MONTHLY" || selectedSubscription.billingCycle === "monthly") ? "Monthly" : "Yearly"}</p></div>
                      <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Status</p><div className="mt-1"><StatusBadge status={selectedSubscription.status} /></div></div>
                      <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Next Billing</p><p className="text-sm font-medium">{formatDate(selectedSubscription.nextBillingDate)}</p></div>
                    </div>
                  </div>
                  <Separator />
                  {/* Pricing Details */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Pricing Details</h4>
                    <Card className={selectedSubscription.customPrice ? "border-orange-200 bg-orange-50/30" : ""}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Base Price</span><span className="text-sm font-medium">{formatCurrency(selectedSubscription.planPrice)}</span></div>
                        {selectedSubscription.customPrice ? (
                          <>
                            <Separator />
                            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Custom Price</span>
                              <div className="flex items-center gap-2"><span className="text-sm font-bold text-orange-700">{formatCurrency(selectedSubscription.customPrice)}</span>
                                <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px] border-0">CUSTOM</Badge></div>
                            </div>
                            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Discount</span>
                              <span className="text-sm font-medium text-emerald-600">-{formatCurrency(selectedSubscription.planPrice - selectedSubscription.customPrice)}
                                {selectedSubscription.discountPercentage && <span className="text-xs text-muted-foreground ml-1">({selectedSubscription.discountPercentage}% off)</span>}
                              </span>
                            </div>
                            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Override</span>
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">Manual Override Active</Badge>
                            </div>
                            {selectedSubscription.overrideReason && (
                              <div><p className="text-xs text-muted-foreground mt-1">Reason: {selectedSubscription.overrideReason}</p></div>
                            )}
                          </>
                        ) : (
                          <>
                            <Separator />
                            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Effective Price</span><span className="text-sm font-bold">{formatCurrency(selectedSubscription.planPrice)}</span></div>
                            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Override</span><span className="text-xs text-muted-foreground">No override applied</span></div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                  <Separator />
                  {/* Period Info */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Billing Period</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Period Start</p><p className="text-sm font-medium">{formatDate(selectedSubscription.currentPeriodStart)}</p></div>
                      <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Period End</p><p className="text-sm font-medium">{formatDate(selectedSubscription.currentPeriodEnd)}</p></div>
                      {selectedSubscription.lastPaymentDate && (
                        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Last Payment</p><p className="text-sm font-medium">{formatDate(selectedSubscription.lastPaymentDate)}</p></div>
                      )}
                      {selectedSubscription.lastPaymentAmount && (
                        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Last Amount</p><p className="text-sm font-medium">{formatCurrency(selectedSubscription.lastPaymentAmount)}</p></div>
                      )}
                    </div>
                  </div>
                  <Separator />
                  {/* Actions */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Actions</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenOverride}><IndianRupee className="h-3.5 w-3.5" /> Override Pricing</Button>
                      <Button variant="outline" size="sm" className="gap-2"><FileText className="h-3.5 w-3.5" /> Send Invoice</Button>
                      <Button variant="outline" size="sm" className="gap-2 text-amber-700 hover:text-amber-800 hover:bg-amber-50"><AlertTriangle className="h-3.5 w-3.5" /> Suspend</Button>
                      <Button variant="outline" size="sm" className="gap-2 text-red-700 hover:text-red-800 hover:bg-red-50"><X className="h-3.5 w-3.5" /> Cancel</Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
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
