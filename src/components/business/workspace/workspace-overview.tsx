"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Loader2, LayoutDashboard, ShoppingBag, Users, Package,
  Store, IndianRupee, Smartphone, CheckCircle2, AlertCircle, Clock,
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { PageHeader } from "@/components/admin/shared/page-header"

interface DashData {
  businessId: string
  businessName: string
  businessStatus: string
  orders: { total: number; pending: number; active: number; today: number }
  revenue: { total: number; today: number }
  customers: { total: number; active: number }
  products: { total: number }
  stores: { total: number }
  inventory?: { lowStock: number; outOfStock: number }
  recentOrders?: { id: string; orderNumber: string; status: string; totalAmount: number; customerName: string }[]
}

interface ReadinessData {
  overallScore: number
  readyForFlutter: boolean
  topBlockers: { app: string; key: string; label: string; priority: string }[]
}

interface SubscriptionData {
  status: string
  finalAmount: number
  billingCycle: string
  currentPeriodEnd: string | null
  plan: { name: string; tier: string } | null
}

function fmt(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`
  return `₹${v.toLocaleString("en-IN")}`
}
function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}
function scoreColor(s: number) {
  if (s >= 80) return "text-emerald-600"
  if (s >= 50) return "text-amber-600"
  return "text-red-600"
}

export function WorkspaceOverview() {
  const { currentBusinessId } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""

  const [dash, setDash] = useState<DashData | null>(null)
  const [ready, setReady] = useState<ReadinessData | null>(null)
  const [sub, setSub] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const [dashRes, readyRes, subRes] = await Promise.all([
        fetch(`/api/core/businesses/${businessId}/dashboard`, { headers: { "x-business-id": businessId } }),
        fetch(`/api/core/businesses/${businessId}/readiness-score`, { headers: { "x-business-id": businessId } }),
        fetch(`/api/core/businesses/${businessId}/subscription`, { headers: { "x-business-id": businessId } }),
      ])
      const [dashJson, readyJson, subJson] = await Promise.all([dashRes.json(), readyRes.json(), subRes.json()])
      if (dashJson.success)  setDash(dashJson.data)
      if (readyJson.success) setReady(readyJson.data)
      if (subJson.success)   setSub(subJson.data)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const stats = [
    { icon: ShoppingBag, label: "Total Orders",   value: dash?.orders.total ?? 0,    sub: `${dash?.orders.today ?? 0} today` },
    { icon: IndianRupee, label: "Revenue",         value: fmt(dash?.revenue.total ?? 0), sub: `${fmt(dash?.revenue.today ?? 0)} today` },
    { icon: Users,       label: "Customers",       value: dash?.customers.total ?? 0, sub: `${dash?.customers.active ?? 0} active this month` },
    { icon: Package,     label: "Products",        value: dash?.products.total ?? 0,  sub: "" },
    { icon: Store,       label: "Stores",          value: dash?.stores.total ?? 0,    sub: "" },
    { icon: Smartphone,  label: "App Readiness",   value: ready ? `${ready.overallScore}%` : "—", sub: ready?.readyForFlutter ? "Ready for Flutter" : "Setup incomplete" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Business workspace at a glance"
        icon={LayoutDashboard}
      />

      {/* Business identity */}
      <Card className="shadow-none">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-lg font-semibold">{dash?.businessName ?? "—"}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{businessId}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {dash?.businessStatus && (
                <Badge className={`text-xs ${dash.businessStatus === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"} border-0`}>
                  {dash.businessStatus}
                </Badge>
              )}
              {sub?.plan && <Badge variant="outline" className="text-xs">{sub.plan.name}</Badge>}
            </div>
          </div>

          {sub && (
            <>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Plan",       value: sub.plan?.name ?? "Custom" },
                  { label: "Billing",    value: sub.billingCycle?.toLowerCase() ?? "—" },
                  { label: "Amount",     value: `₹${sub.finalAmount?.toLocaleString("en-IN") ?? 0}` },
                  { label: "Renews",     value: fmtDate(sub.currentPeriodEnd) },
                ].map(item => (
                  <div key={item.label} className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
              <p className={`text-2xl font-bold ${s.label === "App Readiness" && ready ? scoreColor(ready.overallScore) : ""}`}>{s.value}</p>
              {s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* App readiness mini-cards */}
      {ready && (
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">App Readiness Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            <div className="divide-y">
              {(["customer", "delivery", "pos", "admin"] as const).map(app => {
                const appData = (ready as any).apps?.[app]
                if (!appData) return null
                const score: number = appData.score ?? 0
                return (
                  <div key={app} className="flex items-center gap-3 px-6 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">{app === "pos" ? "POS Billing" : `${app.charAt(0).toUpperCase()}${app.slice(1)} App`}</p>
                      <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden w-32">
                        <div className={`h-full rounded-full ${score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${score}%` }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${scoreColor(score)}`}>{score}%</p>
                      <p className="text-xs text-muted-foreground">{appData.passed}/{appData.total}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top blockers preview */}
      {ready && ready.topBlockers.length > 0 && (
        <Card className="shadow-none border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-0">
            <div className="divide-y">
              {ready.topBlockers.slice(0, 5).map((b, i) => (
                <div key={`${b.app}-${b.key}`} className="flex items-center gap-3 px-6 py-2.5">
                  <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                  <p className="text-sm flex-1 truncate">{b.label}</p>
                  <Badge variant="outline" className={`text-[10px] h-4 px-1.5 shrink-0 ${b.priority === "critical" ? "border-red-200 text-red-600" : "border-amber-200 text-amber-600"}`}>
                    {b.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending orders */}
      {dash && dash.orders.pending > 0 && (
        <Card className="shadow-none">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">{dash.orders.pending} pending order{dash.orders.pending !== 1 ? "s" : ""}</p>
              <p className="text-xs text-muted-foreground">Requires attention</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
