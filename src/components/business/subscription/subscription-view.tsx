"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Loader2, CreditCard, CalendarDays, IndianRupee, CheckCircle2, AlertCircle, Clock, Droplets, Users, RotateCcw, ClipboardList } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { PageHeader } from "@/components/admin/shared/page-header"

interface SubscriptionData {
  id: string
  status: string
  subscriptionAmount: number
  discountAmount: number
  finalAmount: number
  billingCycle: string
  currentPeriodStart: string
  currentPeriodEnd: string
  nextBillingDate: string | null
  autoRenew: boolean
  allowedStores: number
  plan: { name: string; tier: string } | null
  billingHistory: BillingRecord[]
  kgLimit?: number
  kgConsumed?: number
}

interface BillingRecord {
  id: string
  amount: number
  status: string
  dueDate: string
  paidAt: string | null
  notes: string | null
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PAST_DUE: "bg-amber-100 text-amber-700",
  SUSPENDED: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-600",
  EXPIRED: "bg-slate-100 text-slate-600",
}

function fmt(v: number) {
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export function SubscriptionView() {
  const { currentBusinessId, currentBusinessType } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""
  const isLaundry = currentBusinessType === "LAUNDRY"

  const [sub, setSub] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/subscription`, {
        headers: { "x-business-id": businessId },
      })
      const json = await res.json()
      if (json.success) setSub(json.data)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  if (!sub) return (
    <div className="flex flex-col items-center justify-center py-20 gap-2">
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No subscription found</p>
    </div>
  )

  const daysLeft = sub.currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(sub.currentPeriodEnd).getTime() - Date.now()) / 86400000))
    : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription"
        description="Your current plan and billing information"
        icon={CreditCard}
      />

      {/* Plan summary */}
      <Card className="shadow-none">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-lg font-semibold">{sub.plan?.name ?? "Custom Plan"}</p>
                {sub.plan?.tier && <Badge variant="outline" className="text-xs">{sub.plan.tier}</Badge>}
              </div>
              <Badge className={`text-xs ${statusColors[sub.status] ?? ""}`}>{sub.status}</Badge>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{fmt(sub.finalAmount)}</p>
              <p className="text-xs text-muted-foreground">/{sub.billingCycle?.toLowerCase()}</p>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: CalendarDays, label: "Period Start",   value: fmtDate(sub.currentPeriodStart) },
              { icon: CalendarDays, label: "Period End",     value: fmtDate(sub.currentPeriodEnd)   },
              { icon: Clock,        label: "Days Remaining", value: daysLeft !== null ? `${daysLeft} days` : "—" },
              { icon: IndianRupee,  label: "Next Bill",      value: sub.nextBillingDate ? fmtDate(sub.nextBillingDate) : "—" },
            ].map(item => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <item.icon className="h-3.5 w-3.5" />
                  <p className="text-xs">{item.label}</p>
                </div>
                <p className="text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pricing breakdown */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Pricing Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Subscription Amount", value: fmt(sub.subscriptionAmount) },
            { label: "Discount",            value: sub.discountAmount > 0 ? `- ${fmt(sub.discountAmount)}` : "—", className: "text-emerald-600" },
            { label: "Final Amount",        value: fmt(sub.finalAmount), bold: true },
          ].map(row => (
            <div key={row.label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className={`font-medium ${row.className ?? ""} ${row.bold ? "font-semibold" : ""}`}>{row.value}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Allowed Stores</span>
            <span>{sub.allowedStores}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Auto Renew</span>
            <span className="flex items-center gap-1">
              {sub.autoRenew
                ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Yes</>
                : <><AlertCircle className="h-3.5 w-3.5 text-amber-500" /> No</>
              }
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Billing history */}
      {sub.billingHistory?.length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Billing History</CardTitle>
            <CardDescription className="text-xs">Last {sub.billingHistory.length} records</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {sub.billingHistory.map(rec => (
                <div key={rec.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{fmt(rec.amount)}</p>
                    <p className="text-xs text-muted-foreground">Due: {fmtDate(rec.dueDate)}</p>
                    {rec.notes && <p className="text-xs text-muted-foreground">{rec.notes}</p>}
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className={`text-xs ${rec.status === "PAID" ? "text-emerald-600 border-emerald-200" : rec.status === "PENDING" ? "text-amber-600 border-amber-200" : ""}`}
                    >
                      {rec.status}
                    </Badge>
                    {rec.paidAt && <p className="text-xs text-muted-foreground mt-0.5">Paid {fmtDate(rec.paidAt)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Laundry-specific: KG Usage ── */}
      {isLaundry && (
        <Card className="shadow-none border-sky-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-sky-600" />
              <CardTitle className="text-sm">KG Usage This Period</CardTitle>
            </div>
            <CardDescription className="text-xs">Laundry weight consumed vs plan limit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Consumed</span>
              <span className="font-semibold">{sub.kgConsumed ?? 0} kg / {sub.kgLimit ?? "—"} kg</span>
            </div>
            {sub.kgLimit ? (
              <Progress
                value={Math.min(100, ((sub.kgConsumed ?? 0) / sub.kgLimit) * 100)}
                className="h-2.5"
              />
            ) : (
              <Progress value={0} className="h-2.5 opacity-30" />
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{sub.kgLimit ? `${Math.round(((sub.kgConsumed ?? 0) / sub.kgLimit) * 100)}% used` : "No limit set"}</span>
              <span>{sub.kgLimit ? `${sub.kgLimit - (sub.kgConsumed ?? 0)} kg remaining` : ""}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Laundry-specific: quick-nav cards ── */}
      {isLaundry && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: ClipboardList, label: "Subscription Plans", desc: "View & manage laundry plans", href: "#" },
            { icon: Users, label: "Customer Subscriptions", desc: "Active customer subscriptions", href: "#" },
            { icon: RotateCcw, label: "Renewals", desc: "Upcoming renewals & expirations", href: "#" },
          ].map(item => (
            <Card key={item.label} className="shadow-none hover:shadow-sm transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="rounded-lg bg-sky-50 p-2 shrink-0">
                  <item.icon className="h-4 w-4 text-sky-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
