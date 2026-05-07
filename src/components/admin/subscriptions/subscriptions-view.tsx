"use client"

import { useState, useMemo } from "react"
import { PageHeader } from "../shared/page-header"
import { StatCard } from "../shared/stat-card"
import { StatusBadge, CurrencyBadge } from "../shared/status-badge"
import { EmptyState } from "../shared/empty-state"
import { clientSubscriptions, businesses, platformPlans } from "@/components/dashboard/data"
import type { SubscriptionStatus } from "@/components/dashboard/data"
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
import {
  CreditCard,
  Plus,
  Search,
  X,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowUpRight,
  RefreshCw,
  Shield,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PricingOverride {
  basePrice: number
  discountAmount: number
  finalPrice: number
  reason: string
  approvedBy: string
}

interface BillingRecord {
  id: string
  date: string
  amount: number
  status: "PAID" | "PENDING" | "FAILED" | "OVERDUE"
  invoiceId: string
}

interface OverrideHistoryEntry {
  id: string
  date: string
  previousPrice: number
  newPrice: number
  reason: string
  approvedBy: string
}

// ---------------------------------------------------------------------------
// Mock data generators
// ---------------------------------------------------------------------------

const mockBillingHistory: Record<string, BillingRecord[]> = {
  sub_1: [
    { id: "inv_1a", date: "2025-01-01", amount: 4999, status: "PAID", invoiceId: "INV-2025-001" },
    { id: "inv_1b", date: "2024-12-01", amount: 4999, status: "PAID", invoiceId: "INV-2024-012" },
    { id: "inv_1c", date: "2024-11-01", amount: 4999, status: "PAID", invoiceId: "INV-2024-011" },
  ],
  sub_4: [
    { id: "inv_4a", date: "2025-01-01", amount: 3999, status: "PAID", invoiceId: "INV-2025-004" },
    { id: "inv_4b", date: "2024-12-01", amount: 3999, status: "PAID", invoiceId: "INV-2024-042" },
    { id: "inv_4c", date: "2024-11-01", amount: 4999, status: "PAID", invoiceId: "INV-2024-031" },
  ],
  sub_6: [
    { id: "inv_6a", date: "2024-12-01", amount: 49999, status: "PAID", invoiceId: "INV-2024-006" },
  ],
  sub_7: [
    { id: "inv_7a", date: "2025-01-01", amount: 4999, status: "OVERDUE", invoiceId: "INV-2025-007" },
    { id: "inv_7b", date: "2024-12-01", amount: 4999, status: "PAID", invoiceId: "INV-2024-047" },
  ],
  sub_9: [
    { id: "inv_9a", date: "2025-01-01", amount: 3499, status: "PAID", invoiceId: "INV-2025-009" },
    { id: "inv_9b", date: "2024-12-01", amount: 3499, status: "PAID", invoiceId: "INV-2024-049" },
  ],
  sub_10: [
    { id: "inv_10a", date: "2024-12-01", amount: 4999, status: "FAILED", invoiceId: "INV-2024-050" },
    { id: "inv_10b", date: "2024-11-01", amount: 4999, status: "PAID", invoiceId: "INV-2024-040" },
  ],
}

const mockOverrideHistory: Record<string, OverrideHistoryEntry[]> = {
  sub_4: [
    { id: "ovh_4a", date: "2024-12-01", previousPrice: 4999, newPrice: 3999, reason: "Long-term customer loyalty discount", approvedBy: "Priya Sharma" },
  ],
  sub_9: [
    { id: "ovh_9a", date: "2025-01-01", previousPrice: 4999, newPrice: 3499, reason: "Early adopter discount for pilot program", approvedBy: "Rahul Verma" },
  ],
}

// Default billing history for subscriptions not in the mock
const defaultBillingHistory: BillingRecord[] = [
  { id: "inv_d1", date: "2025-01-01", amount: 4999, status: "PAID", invoiceId: "INV-2025-0XX" },
  { id: "inv_d2", date: "2024-12-01", amount: 4999, status: "PAID", invoiceId: "INV-2024-0XX" },
]

// ---------------------------------------------------------------------------
// Admin approvers list
// ---------------------------------------------------------------------------

const adminApprovers = [
  { id: "admin_1", name: "Priya Sharma", role: "Sales Lead" },
  { id: "admin_2", name: "Rahul Verma", role: "Sales Lead" },
  { id: "admin_3", name: "Quantix Admin", role: "Super Admin" },
]

// ---------------------------------------------------------------------------
// Subscription status helpers
// ---------------------------------------------------------------------------

const subscriptionStatuses: SubscriptionStatus[] = ["ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"]

function getSubscriptionStatusColor(status: SubscriptionStatus): string {
  const map: Record<SubscriptionStatus, string> = {
    ACTIVE: "text-emerald-700",
    PAST_DUE: "text-amber-700",
    SUSPENDED: "text-red-700",
    CANCELLED: "text-slate-500",
    EXPIRED: "text-slate-500",
  }
  return map[status] || "text-slate-700"
}

function getBillingStatusBadge(status: BillingRecord["status"]) {
  const map: Record<string, string> = {
    PAID: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    PENDING: "bg-sky-100 text-sky-700 hover:bg-sky-100",
    FAILED: "bg-red-100 text-red-700 hover:bg-red-100",
    OVERDUE: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  }
  return (
    <Badge variant="secondary" className={`text-[10px] border-0 font-medium ${map[status] || "bg-slate-100 text-slate-700"}`}>
      {status}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubscriptionsView() {
  const { searchQuery } = useAdminStore()

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [billingFilter, setBillingFilter] = useState<string>("all")

  // Detail sheet state
  const [selectedSubscription, setSelectedSubscription] = useState<typeof clientSubscriptions[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Manage Plans dialog
  const [managePlansOpen, setManagePlansOpen] = useState(false)

  // Pricing Override dialog
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideDiscount, setOverrideDiscount] = useState<number>(0)
  const [overrideReason, setOverrideReason] = useState("")
  const [overrideApprover, setOverrideApprover] = useState("")

  // ---------------------------------------------------------------------------
  // Computed stats
  // ---------------------------------------------------------------------------

  const stats = useMemo(() => {
    const active = clientSubscriptions.filter((s) => s.status === "ACTIVE").length
    const overdue = clientSubscriptions.filter((s) => s.status === "PAST_DUE").length
    const suspended = clientSubscriptions.filter((s) => s.status === "SUSPENDED").length

    // Monthly MRR = sum of monthly-equivalent revenue for all active + past_due subscriptions
    const mrr = clientSubscriptions
      .filter((s) => s.status === "ACTIVE" || s.status === "PAST_DUE")
      .reduce((sum, s) => {
        const price = s.customPrice || s.planPrice
        return sum + (s.billingCycle === "MONTHLY" ? price : Math.round(price / 12))
      }, 0)

    // Yearly projected revenue
    const yearlyRevenue = clientSubscriptions
      .filter((s) => s.status === "ACTIVE" || s.status === "PAST_DUE")
      .reduce((sum, s) => {
        const price = s.customPrice || s.planPrice
        return sum + (s.billingCycle === "YEARLY" ? price : price * 12)
      }, 0)

    return { active, overdue, suspended, mrr, yearlyRevenue }
  }, [])

  // ---------------------------------------------------------------------------
  // Filtered subscriptions
  // ---------------------------------------------------------------------------

  const filteredSubscriptions = useMemo(() => {
    return clientSubscriptions.filter((sub) => {
      const matchSearch =
        !searchQuery ||
        sub.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.id.toLowerCase().includes(searchQuery.toLowerCase())
      const matchStatus = statusFilter === "all" || sub.status === statusFilter
      const matchBilling = billingFilter === "all" || sub.billingCycle === billingFilter
      return matchSearch && matchStatus && matchBilling
    })
  }, [searchQuery, statusFilter, billingFilter])

  // ---------------------------------------------------------------------------
  // Pricing override computed
  // ---------------------------------------------------------------------------

  const overrideBasePrice = selectedSubscription?.planPrice || 0
  const overrideFinalPrice = Math.max(0, overrideBasePrice - overrideDiscount)

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleRowClick(sub: typeof clientSubscriptions[0]) {
    setSelectedSubscription(sub)
    setDetailOpen(true)
  }

  function handleOpenOverride() {
    if (!selectedSubscription) return
    setOverrideDiscount(selectedSubscription.customPrice ? selectedSubscription.planPrice - selectedSubscription.customPrice : 0)
    setOverrideReason("")
    setOverrideApprover("")
    setOverrideOpen(true)
  }

  function handleSubmitOverride() {
    // In a real app, this would call an API
    setOverrideOpen(false)
  }

  function formatCurrency(amount: number): string {
    return `₹${amount.toLocaleString("en-IN")}`
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    } catch {
      return dateStr
    }
  }

  // ---------------------------------------------------------------------------
  // Get billing history for a subscription
  // ---------------------------------------------------------------------------

  function getBillingHistory(subId: string, sub: typeof clientSubscriptions[0]): BillingRecord[] {
    const history = mockBillingHistory[subId]
    if (history) return history
    // Generate default based on subscription
    if (sub.billingCycle === "YEARLY") {
      return [{ id: `inv_${subId}`, date: sub.nextBilling, amount: sub.customPrice || sub.planPrice, status: "PAID", invoiceId: `INV-Y-${subId.slice(-3)}` }]
    }
    return defaultBillingHistory.map((h) => ({ ...h, amount: sub.customPrice || sub.planPrice }))
  }

  function getOverrideHistory(subId: string): OverrideHistoryEntry[] {
    return mockOverrideHistory[subId] || []
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Subscription Management"
        description="Manage platform subscriptions, billing, and pricing overrides"
        icon={CreditCard}
        action={
          <Dialog open={managePlansOpen} onOpenChange={setManagePlansOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Shield className="h-4 w-4" />
                Manage Plans
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Platform Plans</DialogTitle>
                <DialogDescription>These are the 2 fixed platform plans. Pricing can be overridden per customer.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {platformPlans.map((plan) => (
                  <Card key={plan.id} className="border-2">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{plan.name}</h4>
                          <p className="text-xs text-muted-foreground">{plan.billingCycle} billing</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">{formatCurrency(plan.price)}</p>
                          <p className="text-xs text-muted-foreground">{plan.billingCycle === "MONTHLY" ? "/month" : "/year"}</p>
                        </div>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span>Up to {plan.maxStores} stores</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span>Up to {plan.maxProducts.toLocaleString()} products</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span>{plan.maxOrders.toLocaleString()} orders/mo</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span>POS System</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span>Delivery Management</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span>Custom Domain</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span>White Label</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span>Subscription Module</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                        <Shield className="h-3.5 w-3.5" />
                        <span>Super Admin can override pricing per customer</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setManagePlansOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Subscriptions"
          value={stats.active}
          change={`${clientSubscriptions.length} total`}
          changeType="neutral"
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Monthly MRR"
          value={formatCurrency(stats.mrr)}
          change={`${clientSubscriptions.filter((s) => s.billingCycle === "MONTHLY").length} monthly subs`}
          changeType="positive"
          icon={IndianRupee}
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
        />
        <StatCard
          title="Yearly Revenue"
          value={formatCurrency(stats.yearlyRevenue)}
          change={`${clientSubscriptions.filter((s) => s.billingCycle === "YEARLY").length} yearly subs`}
          changeType="neutral"
          icon={ArrowUpRight}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          title="Overdue"
          value={stats.overdue}
          change={stats.suspended > 0 ? `${stats.suspended} suspended` : "No suspensions"}
          changeType={stats.overdue > 0 ? "negative" : "neutral"}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search subscriptions..." className="pl-8 h-9" value={searchQuery} readOnly />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {subscriptionStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={billingFilter} onValueChange={setBillingFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Billing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cycles</SelectItem>
            <SelectItem value="MONTHLY">Monthly</SelectItem>
            <SelectItem value="YEARLY">Yearly</SelectItem>
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || billingFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all")
              setBillingFilter("all")
            }}
          >
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
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
                    <TableRow
                      key={sub.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(sub)}
                    >
                      <TableCell>
                        <div className="font-medium">{sub.businessName}</div>
                        <div className="text-xs text-muted-foreground">{sub.id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {sub.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{sub.billingCycle === "MONTHLY" ? "Monthly" : "Yearly"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{formatCurrency(sub.planPrice)}</span>
                      </TableCell>
                      <TableCell>
                        <CurrencyBadge
                          amount={sub.customPrice || sub.planPrice}
                          override={!!sub.customPrice}
                          original={sub.customPrice ? sub.planPrice : undefined}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={sub.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatDate(sub.nextBilling)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleRowClick(sub)}
                          >
                            View
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
        <SheetContent className="w-[520px] sm:max-w-[520px]">
          {selectedSubscription && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedSubscription.businessName}
                  <StatusBadge status={selectedSubscription.status} />
                </SheetTitle>
                <SheetDescription>
                  {selectedSubscription.id} &middot; {selectedSubscription.plan} Plan &middot;{" "}
                  {selectedSubscription.billingCycle === "MONTHLY" ? "Monthly" : "Yearly"} billing
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="mt-6 h-[calc(100vh-180px)]">
                <div className="space-y-6 pr-4">
                  {/* Subscription Overview */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Subscription Overview</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Plan</p>
                        <p className="text-sm font-medium">{selectedSubscription.plan}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Billing Cycle</p>
                        <p className="text-sm font-medium">{selectedSubscription.billingCycle === "MONTHLY" ? "Monthly" : "Yearly"}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <div className="mt-1">
                          <StatusBadge status={selectedSubscription.status} />
                        </div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Next Billing</p>
                        <p className="text-sm font-medium">{formatDate(selectedSubscription.nextBilling)}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Pricing Details */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Pricing Details</h4>
                    <Card className={selectedSubscription.customPrice ? "border-orange-200 bg-orange-50/30" : ""}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Base Price</span>
                          <span className="text-sm font-medium">{formatCurrency(selectedSubscription.planPrice)}</span>
                        </div>
                        {selectedSubscription.customPrice ? (
                          <>
                            <Separator />
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Custom Price</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-orange-700">
                                  {formatCurrency(selectedSubscription.customPrice)}
                                </span>
                                <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px] border-0">
                                  CUSTOM
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Discount</span>
                              <span className="text-sm font-medium text-emerald-600">
                                -{formatCurrency(selectedSubscription.planPrice - selectedSubscription.customPrice)}
                                {selectedSubscription.discountPercentage && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({selectedSubscription.discountPercentage}% off)
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Override</span>
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                                Manual Override Active
                              </Badge>
                            </div>
                          </>
                        ) : (
                          <>
                            <Separator />
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Effective Price</span>
                              <span className="text-sm font-bold">{formatCurrency(selectedSubscription.planPrice)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Override</span>
                              <span className="text-xs text-muted-foreground">No override applied</span>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  {/* Billing History */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Billing History</h4>
                    <div className="space-y-2">
                      {getBillingHistory(selectedSubscription.id, selectedSubscription).map((record) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{record.invoiceId}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(record.date)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold">{formatCurrency(record.amount)}</span>
                            {getBillingStatusBadge(record.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Override History */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Override History</h4>
                    {getOverrideHistory(selectedSubscription.id).length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-center">
                        <p className="text-xs text-muted-foreground">No pricing overrides recorded</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {getOverrideHistory(selectedSubscription.id).map((entry) => (
                          <div key={entry.id} className="rounded-lg border p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                              <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px] border-0">
                                OVERRIDE
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="line-through text-muted-foreground">{formatCurrency(entry.previousPrice)}</span>
                              <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                              <span className="font-semibold text-orange-700">{formatCurrency(entry.newPrice)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Reason: {entry.reason}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Approved by: {entry.approvedBy}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Actions</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenOverride}>
                        <IndianRupee className="h-3.5 w-3.5" />
                        Override Pricing
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2">
                        <FileText className="h-3.5 w-3.5" />
                        Send Invoice
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Suspend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-red-700 hover:text-red-800 hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
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
          <DialogHeader>
            <DialogTitle>Override Pricing</DialogTitle>
            <DialogDescription>
              Set a custom price for {selectedSubscription?.businessName}. This will override the standard plan price.
            </DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4 py-4">
              {/* Current Pricing Summary */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current Plan</span>
                  <span className="font-medium">{selectedSubscription.plan} ({selectedSubscription.billingCycle === "MONTHLY" ? "Monthly" : "Yearly"})</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current Price</span>
                  <span className="font-medium">{formatCurrency(selectedSubscription.customPrice || selectedSubscription.planPrice)}</span>
                </div>
              </div>

              <Separator />

              {/* Base Price (readonly) */}
              <div className="space-y-2">
                <Label>Base Price (₹)</Label>
                <Input value={overrideBasePrice} readOnly className="bg-muted" />
                <p className="text-xs text-muted-foreground">Standard plan price — cannot be modified</p>
              </div>

              {/* Discount Amount */}
              <div className="space-y-2">
                <Label>Discount Amount (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  max={overrideBasePrice}
                  value={overrideDiscount || ""}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0
                    setOverrideDiscount(Math.min(val, overrideBasePrice))
                  }}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  {overrideDiscount > 0
                    ? `${Math.round((overrideDiscount / overrideBasePrice) * 100)}% discount`
                    : "Enter the discount amount"}
                </p>
              </div>

              {/* Final Price (auto-calculated) */}
              <div className="space-y-2">
                <Label>Final Price (₹)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={formatCurrency(overrideFinalPrice)}
                    readOnly
                    className={`font-bold ${overrideDiscount > 0 ? "text-orange-700 bg-orange-50" : "bg-muted"}`}
                  />
                  {overrideDiscount > 0 && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px] border-0 shrink-0">
                      CUSTOM
                    </Badge>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason for Override *</Label>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g., Long-term customer loyalty discount, early adopter pricing..."
                  rows={3}
                />
              </div>

              {/* Approved By */}
              <div className="space-y-2">
                <Label>Approved By *</Label>
                <Select value={overrideApprover} onValueChange={setOverrideApprover}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select approver" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminApprovers.map((approver) => (
                      <SelectItem key={approver.id} value={approver.name}>
                        {approver.name} — {approver.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Warning */}
              {overrideDiscount > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium">Pricing Override Warning</p>
                    <p className="mt-0.5">
                      You are applying a {formatCurrency(overrideDiscount)} discount (
                      {Math.round((overrideDiscount / overrideBasePrice) * 100)}% off) to this subscription. This will
                      override the standard {formatCurrency(overrideBasePrice)} pricing. Ensure proper approval has been
                      obtained.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitOverride}
              disabled={!overrideReason.trim() || !overrideApprover || overrideDiscount === 0}
            >
              Apply Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
