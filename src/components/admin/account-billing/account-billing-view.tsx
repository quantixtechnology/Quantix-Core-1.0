"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  IndianRupee, TrendingUp, AlertCircle, CheckCircle, Clock, Building2, RefreshCw,
} from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { AccountsTab } from "./tabs/accounts-tab"
import { ServicesTab } from "./tabs/services-tab"
import { InvoicesTab } from "./tabs/invoices-tab"
import { PaymentsTab } from "./tabs/payments-tab"
import { ReportsTab } from "./tabs/reports-tab"
import { AccountDrawer } from "./drawers/account-drawer"

interface Summary {
  mrr: number
  arr: number
  outstanding: number
  collectionRate: number
  pendingVerification: number
  activeAccounts: number
  collectedThisMonth: number
  totalCollected: number
  overdueAccounts: number
}

function formatCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`
  if (value >= 100000)   return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000)     return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value.toLocaleString("en-IN")}`
}

export function AccountBillingView() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("accounts")

  // Account drawer state — shared between Accounts tab and direct navigation
  const [drawerBusinessId, setDrawerBusinessId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const openAccountDrawer = useCallback((businessId: string) => {
    setDrawerBusinessId(businessId)
    setDrawerOpen(true)
  }, [])

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const res = await fetch("/api/admin/account-billing/summary", { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) setSummary(json.data)
    } catch {
      toast.error("Failed to load summary")
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const metrics = summary ? [
    { label: "MRR",                   value: formatCurrency(summary.mrr),              icon: IndianRupee, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "ARR",                   value: formatCurrency(summary.arr),              icon: TrendingUp,  color: "text-violet-600",  bg: "bg-violet-50"  },
    { label: "Outstanding",           value: formatCurrency(summary.outstanding),      icon: AlertCircle, color: "text-red-600",     bg: "bg-red-50",    urgent: summary.outstanding > 0 },
    { label: "Collections This Month",value: formatCurrency(summary.collectedThisMonth), icon: CheckCircle, color: "text-sky-600",   bg: "bg-sky-50"     },
    { label: "Pending Verification",  value: String(summary.pendingVerification),      icon: Clock,       color: "text-amber-600",   bg: "bg-amber-50",  urgent: summary.pendingVerification > 0 },
    { label: "Overdue Accounts",      value: String(summary.overdueAccounts ?? 0),     icon: Building2,   color: "text-rose-600",    bg: "bg-rose-50",   urgent: (summary.overdueAccounts ?? 0) > 0 },
  ] : []

  return (
    <div className="flex flex-col gap-6 p-6 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account &amp; Billing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Unified billing across all business accounts</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={fetchSummary} disabled={summaryLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${summaryLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="shadow-none">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-20" />
                </CardContent>
              </Card>
            ))
          : metrics.map((m) => (
              <Card key={m.label} className={`shadow-none ${m.urgent ? "border-red-200" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`h-7 w-7 rounded-md flex items-center justify-center ${m.bg}`}>
                      <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
                    </div>
                    {m.urgent && <Badge variant="outline" className="text-[9px] h-4 px-1 border-red-200 text-red-600">!</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{m.label}</p>
                  <p className="text-xl font-bold mt-0.5">{m.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Primary Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="h-9">
          <TabsTrigger value="accounts"  className="text-xs">Accounts</TabsTrigger>
          <TabsTrigger value="services"  className="text-xs">Services</TabsTrigger>
          <TabsTrigger value="invoices"  className="text-xs">Invoices</TabsTrigger>
          <TabsTrigger value="payments"  className="text-xs">Payments</TabsTrigger>
          <TabsTrigger value="reports"   className="text-xs">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4">
          <AccountsTab onViewAccount={openAccountDrawer} />
        </TabsContent>
        <TabsContent value="services" className="mt-4">
          <ServicesTab onViewAccount={openAccountDrawer} />
        </TabsContent>
        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab onViewAccount={openAccountDrawer} />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PaymentsTab onViewAccount={openAccountDrawer} />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportsTab />
        </TabsContent>
      </Tabs>

      {/* Per-business account drawer */}
      {drawerBusinessId && (
        <AccountDrawer
          businessId={drawerBusinessId}
          open={drawerOpen}
          onOpenChange={(open) => { setDrawerOpen(open); if (!open) setDrawerBusinessId(null) }}
          onRefreshSummary={fetchSummary}
        />
      )}
    </div>
  )
}
