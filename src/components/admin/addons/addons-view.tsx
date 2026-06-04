"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "../shared/page-header"
import { StatCard } from "../shared/stat-card"
import { EmptyState } from "../shared/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  PlusCircle, Search, X, RefreshCw, AlertTriangle,
  IndianRupee, TrendingUp, Package, Clock,
} from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { useAdminStore } from "@/stores/admin-store"

// ── Types ──────────────────────────────────────────────────────────────────────

interface AddonRow {
  id: string
  businessId: string
  name: string
  description: string | null
  amount: number
  billingType: "ONE_TIME" | "RECURRING"
  cycle: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY" | null
  status: "ACTIVE" | "INACTIVE" | "COMPLETED"
  startDate: string
  endDate: string | null
  invoicedAt: string | null
  createdAt: string
  business: { id: string; name: string; slug: string; businessType: string }
}

interface AddonStats {
  activeCount: number
  recurringMonthlyValue: number
  recurringCount: number
  pendingOneTimeCount: number
  pendingOneTimeValue: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  try { return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) } catch { return dateStr }
}

const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  ACTIVE:    { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Active" },
  INACTIVE:  { cls: "bg-gray-100 text-gray-600 border-gray-200",        label: "Inactive" },
  COMPLETED: { cls: "bg-sky-50 text-sky-700 border-sky-200",            label: "Completed" },
}

const CYCLE_LABEL: Record<string, string> = {
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", HALF_YEARLY: "Half-Yearly", YEARLY: "Yearly",
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function AddonsView() {
  const { searchQuery } = useAdminStore()

  const [addons, setAddons] = useState<AddonRow[]>([])
  const [stats, setStats] = useState<AddonStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  const fetchAddons = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: "100" })
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (typeFilter !== "all") params.set("billingType", typeFilter)
      if (searchQuery) params.set("search", searchQuery)
      const res = await fetch(`/api/admin/addons?${params}`, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error("Failed to fetch add-ons")
      const json = await res.json()
      if (json.success) { setAddons(json.data); setStats(json.stats) }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load add-ons")
    } finally { setLoading(false) }
  }, [searchQuery, statusFilter, typeFilter])

  useEffect(() => { fetchAddons() }, [fetchAddons])

  const filteredAddons = useMemo(() => {
    if (!searchQuery) return addons
    const q = searchQuery.toLowerCase()
    return addons.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.business.name.toLowerCase().includes(q)
    )
  }, [addons, searchQuery])

  const handleGenerateInvoice = async (addon: AddonRow) => {
    setGeneratingId(addon.id)
    try {
      const res = await fetch(
        `/api/admin/businesses/${addon.businessId}/addons/${addon.id}/invoice`,
        { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({}) }
      )
      const json = await res.json()
      if (json.success) {
        toast.success(`Invoice ${json.invoiceNumber} generated`)
        fetchAddons()
      } else {
        toast.error(json.error || "Failed to generate invoice")
      }
    } catch { toast.error("Failed to generate invoice") }
    finally { setGeneratingId(null) }
  }

  const handleDeactivate = async (addon: AddonRow) => {
    try {
      const res = await fetch(
        `/api/admin/businesses/${addon.businessId}/addons/${addon.id}`,
        { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify({ status: "INACTIVE" }) }
      )
      const json = await res.json()
      if (json.success) { toast.success("Add-on deactivated"); fetchAddons() }
      else toast.error(json.error || "Failed to deactivate")
    } catch { toast.error("Failed to deactivate add-on") }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add-On Billing"
        description="Manage one-time and recurring add-ons across all businesses"
        icon={Package}
      />

      {/* Stats */}
      {stats ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Active Add-ons" value={stats.activeCount} change="across all businesses" changeType="neutral" icon={Package} iconColor="text-sky-600" iconBg="bg-sky-50" />
          <StatCard title="Recurring Value" value={formatCurrency(stats.recurringMonthlyValue)} change={`${stats.recurringCount} recurring`} changeType="positive" icon={TrendingUp} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
          <StatCard title="Pending One-Time" value={stats.pendingOneTimeCount} change="awaiting invoice" changeType={stats.pendingOneTimeCount > 0 ? "negative" : "neutral"} icon={Clock} iconColor="text-amber-600" iconBg="bg-amber-50" />
          <StatCard title="One-Time Value" value={formatCurrency(stats.pendingOneTimeValue)} change="pending invoicing" changeType="neutral" icon={IndianRupee} iconColor="text-violet-600" iconBg="bg-violet-50" />
        </div>
      ) : loading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-12 w-full" /></CardContent></Card>)}
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search add-ons or businesses…" className="pl-8 h-9" value={searchQuery} readOnly />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="ONE_TIME">One-Time</SelectItem>
            <SelectItem value="RECURRING">Recurring</SelectItem>
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || typeFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setTypeFilter("all") }}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
        <Button variant="outline" size="sm" className="ml-auto gap-1.5 h-9" onClick={fetchAddons}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card><CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAddons} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
        </CardContent></Card>
      )}

      {/* Table */}
      {loading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-[400px] w-full" /></CardContent></Card>
      ) : filteredAddons.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No add-ons found"
          description="Add-ons are created from individual business drawers in Business Management"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead className="min-w-[160px]">Business</TableHead>
                    <TableHead className="min-w-[180px]">Add-On</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Invoiced</TableHead>
                    <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAddons.map((addon) => {
                    const statusCfg = STATUS_CFG[addon.status] ?? STATUS_CFG.INACTIVE
                    return (
                      <TableRow key={addon.id} className="text-xs">
                        <TableCell>
                          <div className="font-medium">{addon.business.name}</div>
                          <div className="text-[10px] text-muted-foreground">{addon.business.businessType.replace(/_/g, " ")}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{addon.name}</div>
                          {addon.description && <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">{addon.description}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${addon.billingType === "ONE_TIME" ? "border-amber-300 text-amber-700" : "border-sky-300 text-sky-700"}`}>
                            {addon.billingType === "ONE_TIME" ? "One-Time" : "Recurring"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px]">
                          {addon.cycle ? CYCLE_LABEL[addon.cycle] : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-[11px]">
                          {formatCurrency(addon.amount)}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusCfg.cls}`}>
                            {statusCfg.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">{formatDate(addon.startDate)}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">
                          {addon.invoicedAt ? formatDate(addon.invoicedAt) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {addon.billingType === "ONE_TIME" && addon.status === "ACTIVE" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] gap-1 text-emerald-700 hover:bg-emerald-50"
                                disabled={generatingId === addon.id}
                                onClick={() => handleGenerateInvoice(addon)}
                                title="Generate invoice for this one-time add-on"
                              >
                                <PlusCircle className="h-3 w-3" />
                                {generatingId === addon.id ? "…" : "Invoice"}
                              </Button>
                            )}
                            {addon.status === "ACTIVE" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] gap-1 text-gray-600 hover:bg-gray-100"
                                onClick={() => handleDeactivate(addon)}
                                title="Deactivate this add-on"
                              >
                                <X className="h-3 w-3" />
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
    </div>
  )
}
