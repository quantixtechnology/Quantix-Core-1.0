"use client"

// ============================================================================
// Businesses list. The single way to manage a business is the full-page
// Business Wizard (openManage -> activePage "manage-business"); creating a
// business opens the same wizard in create mode ("create-business"). This view
// only lists + filters tenants and routes into that one experience — all edit/
// provision/branding/owner controls live in the wizard, not here.
// ============================================================================

import { useState, useMemo, useEffect, useCallback } from "react"
import { PageHeader } from "../shared/page-header"
import { StatusBadge } from "../shared/status-badge"
import { EmptyState } from "../shared/empty-state"
import { businessTypeConfig } from "@/components/dashboard/data"
import type { BusinessType } from "@/components/dashboard/data"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Building2, Plus, Search, X, MapPin, RefreshCw, AlertTriangle,
  Copy, Check, Hash, Globe, Edit, PlayCircle, Rocket,
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { buildSessionHandoffHash } from "@/lib/session-handoff"
import { getBusinessLifecycle, getStateLabel, type BusinessLifecycleState } from "@/lib/business-lifecycle"

// ---- API data types ----
interface BusinessApiData {
  id: string; businessCode: string | null; name: string; slug: string; businessType: string; status: string
  productCode: string | null; subscriptionPlanCode: string | null
  city: string | null; state: string | null; pincode: string | null; country: string | null; address: string | null
  contactEmail: string | null; contactPhone: string | null
  supportEmail: string | null; supportPhone: string | null
  gstNumber: string | null; panNumber: string | null; cinNumber: string | null; fssaiLicense: string | null
  favicon: string | null; secondaryColor: string | null; tagline: string | null; description: string | null
  isOnline: boolean; primaryColor: string; logo: string | null; createdAt: string; onboardedAt: string | null; activatedAt: string | null
  subscription: {
    id: string; status: string
    subscriptionAmount: number | null; discountAmount: number | null; finalAmount: number | null
    implementationAmount: number | null
    iosAppAmount: number | null; iosDiscountAmount: number | null; iosFinalAmount: number | null; iosSubscriptionCycle: string | null
    addOns: string
    planPrice: number | null; customPrice: number | null; discountPercentage: number | null
    manualPriceOverride: boolean; overrideReason: string | null; notes: string | null
    billingCycle: string; billingCycleDay: number | null; currentPeriodStart: string; nextBillingDate: string
    plan: { name: string; tier: string } | null
  } | null
  domain: { domain: string; status: string } | null
  deployments: Array<{ id: string; type: string; status: string; version: string | null; healthStatus: string }>
  modules: Array<{ moduleKey: string; moduleName: string; status: string }>
  salesRep: string | null
  mainStore: { id: string; storeCode: string | null } | null
  storeCount: number; orderCount: number; customerCount: number; totalRevenue: number
  ownerLoginId: string | null; ownerInternalId: string | null
  ownerEmail: string | null; ownerName: string | null
  ownerPhone: string | null; ownerLastLogin: string | null; ownerIsActive: boolean | null
  activationChecklist: string; activationProgress: number; activationCompleted: boolean
}

// Filter options
const allStatuses = [
  { value: "ALL", label: "All Statuses" },
  { value: "INACTIVE", label: "Inactive" },
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

// Tailwind classes for the lifecycle badge, by state (schema-aligned engine).
const LIFECYCLE_BADGE_CLASS: Record<BusinessLifecycleState, string> = {
  draft: "border-gray-300 text-gray-600 bg-gray-50",
  needs_plan: "border-amber-300 text-amber-700 bg-amber-50",
  ready_to_provision: "border-blue-300 text-blue-700 bg-blue-50",
  active: "border-emerald-300 text-emerald-700 bg-emerald-50",
}

export function BusinessesView() {
  const { searchQuery, setActivePage, setResumeBusinessId, setManageBusinessId } = useAdminStore()
  const { permissions } = useAuthStore()
  const canCreate = permissions.includes("businesses:create" as never)
  const canEdit = permissions.includes("businesses:edit" as never)

  const [businesses, setBusinesses] = useState<BusinessApiData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [typeFilter, setTypeFilter] = useState<string>("ALL")
  const [onlineFilter, setOnlineFilter] = useState<string>("ALL")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Open the full-page Business Wizard in manage/edit mode.
  const openManage = (biz: BusinessApiData) => {
    setManageBusinessId(biz.id)
    setActivePage("manage-business")
  }

  // Open the Business Wizard in create mode (fresh — clear any resume target).
  const startCreate = () => {
    setResumeBusinessId(null)
    setActivePage("create-business")
  }

  // Resume the wizard for an incomplete business (jumps to the right section).
  const handleResumeOnboarding = (biz: BusinessApiData) => {
    setResumeBusinessId(biz.id)
    setActivePage("create-business")
  }

  const copyBusinessId = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(slug)
    setCopiedId(slug)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Open the live tenant workspace in a new tab (resolves the runtime URL).
  const handleOpenWorkspace = async (biz: BusinessApiData) => {
    if (!biz.id) {
      toast.error("Business ID not found")
      return
    }
    try {
      // Admin API is Bearer-only; without the auth headers this returned 401
      // and the guard below misreported it as "Business has no product assigned".
      const response = await fetch(`/api/admin/businesses/${biz.id}`, { headers: getAuthHeaders() })
      const result = await response.json()
      if (!result.success || !result.data?.productCode) {
        toast.error("Business has no product assigned")
        return
      }
      const productCode = result.data.productCode
      const runtimeResponse = await fetch(`/api/admin/products/runtime/${encodeURIComponent(productCode)}`)
      const runtimeResult = await runtimeResponse.json()
      if (!runtimeResult.success || !runtimeResult.data?.runtime?.workspaceUrl) {
        toast.error("Cannot determine workspace URL")
        return
      }
      // Runtime Registry stores workspaceUrl without a scheme (e.g.
      // "commerce.quantixtechnology.in"). window.open treats a scheme-less value
      // as a relative path under the admin host, so normalise to https:// here.
      const baseUrl: string = runtimeResult.data.runtime.workspaceUrl
      const normalizedBase = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`
      // Hand the current session to the product subdomain (different origin →
      // separate localStorage) so the workspace opens authenticated instead of
      // hitting "Session not found" / Access Denied.
      const handoff = buildSessionHandoffHash()
      window.open(`${normalizedBase}/${biz.id}${handoff ? `#${handoff}` : ''}`, '_blank')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open workspace")
    }
  }

  const fetchBusinesses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/businesses?limit=100", { headers: getAuthHeaders() })
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBusinesses()
  }, [fetchBusinesses])

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
          <Button className="gap-2" onClick={startCreate}><Plus className="h-4 w-4" /> Create Business</Button>
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
        <EmptyState icon={Building2} title="No businesses found" description="Try adjusting your filters or create a new business" action={canCreate ? { label: "Create Business", onClick: startCreate } : undefined} />
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
                    // Lifecycle state from the schema-aligned engine (Phase 2).
                    const lc = getBusinessLifecycle(biz)
                    return (
                      <TableRow key={biz.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openManage(biz)}>
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
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={biz.status} />
                            <Badge variant="outline" className={`text-[10px] h-4 px-1.5 font-medium ${LIFECYCLE_BADGE_CLASS[lc.state]}`}>
                              {getStateLabel(lc.state)}
                            </Badge>
                          </div>
                        </TableCell>
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
                            {lc.state === "ready_to_provision" ? (
                              <>
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleResumeOnboarding(biz)}>
                                  <Check className="size-3" /> Review
                                </Button>
                                {canCreate && (
                                  <Button size="sm" className="h-7 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => openManage(biz)}>
                                    <Rocket className="size-3" /> Provision
                                  </Button>
                                )}
                              </>
                            ) : lc.state === "active" ? (
                              <>
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleOpenWorkspace(biz)}>
                                  <Globe className="size-3" /> Open Workspace
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openManage(biz)}>Open</Button>
                                {canEdit && (
                                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openManage(biz)}>
                                    <Edit className="size-3" /> Edit
                                  </Button>
                                )}
                              </>
                            ) : (
                              /* draft / needs_plan */
                              <>
                                {canEdit && (
                                  <Button size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleResumeOnboarding(biz)}>
                                    <PlayCircle className="size-3" /> Resume Setup
                                  </Button>
                                )}
                                {canEdit && (
                                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openManage(biz)}>
                                    <Edit className="size-3" /> Edit
                                  </Button>
                                )}
                              </>
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
    </div>
  )
}
