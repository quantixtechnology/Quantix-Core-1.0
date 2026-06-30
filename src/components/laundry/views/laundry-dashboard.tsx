"use client"

import { useEffect, useState, useCallback } from "react"
import {
  ShoppingBag, ClipboardCheck, Package, Cog, Truck, CheckCircle,
  CreditCard, RefreshCw, Plus, Rocket, ArrowRight,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"

// Store Counter operational workload — each card is the live count of orders
// currently sitting in that workflow stage (real data from /orders/stats).
const WORKLOAD: { key: string; label: string; icon: typeof ShoppingBag; color: string }[] = [
  { key: "PENDING_STORE_AUDIT", label: "Pending Store Audit", icon: ClipboardCheck, color: "text-amber-600 bg-amber-100" },
  { key: "UNDER_AUDIT",         label: "Under Audit",         icon: ClipboardCheck, color: "text-orange-600 bg-orange-100" },
  { key: "PAYMENT_PENDING",     label: "Payment Pending",     icon: CreditCard,     color: "text-rose-600 bg-rose-100" },
  { key: "READY_FOR_PROCESSING",label: "Ready for Processing",icon: Package,        color: "text-violet-600 bg-violet-100" },
  { key: "PROCESSING",          label: "In Processing",       icon: Cog,            color: "text-blue-600 bg-blue-100" },
  { key: "QC_PENDING",          label: "QC Pending",          icon: ClipboardCheck, color: "text-fuchsia-600 bg-fuchsia-100" },
  { key: "READY_FOR_DELIVERY",  label: "Ready for Delivery",  icon: Truck,          color: "text-emerald-600 bg-emerald-100" },
  { key: "DELIVERED",           label: "Delivered",           icon: CheckCircle,    color: "text-green-600 bg-green-100" },
]

interface OrderStats { byStatus: Record<string, number>; today: number; total: number }

function KpiSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="space-y-1.5"><Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-12" /></div>
    </div>
  )
}

function DashboardContent({ laundryBusinessId }: { laundryBusinessId: string }) {
  const { setLaundryPage } = useAdminStore()
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [setupDone, setSetupDone] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/orders/stats?businessId=${encodeURIComponent(laundryBusinessId)}`)
      const json = await res.json()
      if (json.success) setStats(json.data)
      else setStats({ byStatus: {}, today: 0, total: 0 })
    } catch {
      setStats({ byStatus: {}, today: 0, total: 0 })
    } finally {
      setLoading(false)
    }
  }, [laundryBusinessId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch(`/api/laundry/setup?businessId=${encodeURIComponent(laundryBusinessId)}`)
      .then((r) => r.json())
      .then((j) => setSetupDone(j.success ? !!j.completed : true))
      .catch(() => setSetupDone(true))
  }, [laundryBusinessId])

  const count = (key: string) => stats?.byStatus[key] ?? 0

  return (
    <div className="space-y-6">
      {setupDone === false && (
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white"><Rocket className="h-5 w-5" /></div>
          <div className="flex-1">
            <p className="font-semibold text-sky-900">Finish setting up your laundry</p>
            <p className="text-sm text-sky-800/80">Configure stores, load templates and set pricing so you can start taking orders.</p>
          </div>
          <Button size="sm" className="gap-1 bg-sky-600 hover:bg-sky-700 text-white" onClick={() => setLaundryPage("setup")}>
            Complete Setup <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Store Counter</h2>
          <p className="text-sm text-muted-foreground">Live operational workload across the order pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" className="gap-1 bg-sky-600 hover:bg-sky-700 text-white" onClick={() => setLaundryPage("new-order")}>
            <Plus className="h-3.5 w-3.5" /> New Order
          </Button>
        </div>
      </div>

      {/* Today / total intake */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-4">
          {loading ? <KpiSkeleton /> : (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-sky-600 bg-sky-100"><ShoppingBag className="h-5 w-5" /></div>
              <div><p className="text-xs text-muted-foreground">Today&apos;s Orders</p><p className="text-2xl font-bold">{stats?.today ?? 0}</p></div>
            </div>
          )}
        </CardContent></Card>
        <Card><CardContent className="p-4">
          {loading ? <KpiSkeleton /> : (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 bg-slate-100"><Package className="h-5 w-5" /></div>
              <div><p className="text-xs text-muted-foreground">Total Orders</p><p className="text-2xl font-bold">{stats?.total ?? 0}</p></div>
            </div>
          )}
        </CardContent></Card>
      </div>

      {/* Per-stage workload */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Workload by Stage</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WORKLOAD.map(w => (
            <Card key={w.key}>
              <CardContent className="p-4">
                {loading ? <KpiSkeleton /> : (
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${w.color}`}><w.icon className="h-5 w-5" /></div>
                    <div><p className="text-xs text-muted-foreground">{w.label}</p><p className="text-xl font-bold">{count(w.key)}</p></div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// The Laundry Dashboard is the operational command center — it ALWAYS opens to
// the live workflow dashboard. Business configuration (the setup wizard) was
// moved out of here to Settings → Business Configuration; it must never block
// access to the operational ERP once a tenant exists.
export function LaundryDashboard() {
  const { currentBusinessId } = useAuthStore()

  if (!currentBusinessId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-sm">No business selected</p>
      </div>
    )
  }

  return <DashboardContent laundryBusinessId={currentBusinessId} />
}
