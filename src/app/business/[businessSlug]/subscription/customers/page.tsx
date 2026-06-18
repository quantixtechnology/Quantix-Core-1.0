"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, Users, Droplets, Weight, IndianRupee, CalendarDays, AlertCircle, Phone, Mail } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { PageHeader } from "@/components/admin/shared/page-header"

interface CustomerSubscription {
  id: string
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  planName: string
  kgLimit: number
  kgConsumed: number
  billingCycle: string
  status: "ACTIVE" | "PAUSED" | "EXPIRED" | "CANCELLED"
  startDate: string
  endDate: string | null
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PAUSED: "bg-amber-100 text-amber-700",
  EXPIRED: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-red-100 text-red-700",
}

const statusIcon: Record<string, string> = {
  ACTIVE: "●",
  PAUSED: "◐",
  EXPIRED: "○",
  CANCELLED: "✕",
}

function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export default function CustomerSubscriptionsPage() {
  const { currentBusinessId, currentBusinessType } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""
  const isLaundry = currentBusinessType === "LAUNDRY"

  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/subscription/customers`, {
        headers: { "x-business-id": businessId },
      })
      const json = await res.json()
      if (json.success) setSubscriptions(json.data)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Subscriptions"
        description={isLaundry ? "Laundry subscription plans assigned to customers" : "Manage customer subscriptions"}
        icon={Users}
      />

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No customer subscriptions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <Card key={sub.id} className="shadow-none">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold truncate">{sub.customerName}</p>
                      <Badge className={`text-xs ${statusColors[sub.status] ?? ""}`}>
                        {statusIcon[sub.status] ?? ""} {sub.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{sub.planName}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5">
                      {sub.customerPhone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {sub.customerPhone}
                        </span>
                      )}
                      {sub.customerEmail && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {sub.customerEmail}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Started {fmtDate(sub.startDate)}</p>
                    {sub.endDate && <p className="text-xs text-muted-foreground">Ends {fmtDate(sub.endDate)}</p>}
                  </div>
                </div>

                {isLaundry && (
                  <>
                    <Separator className="my-3" />
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Weight className="h-3.5 w-3.5" />
                        <span>{sub.kgConsumed} / {sub.kgLimit} kg</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <IndianRupee className="h-3.5 w-3.5" />
                        <span>{sub.billingCycle}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
