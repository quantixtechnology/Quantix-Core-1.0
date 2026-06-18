"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, RotateCcw, CalendarDays, User, Weight, IndianRupee, AlertCircle, RefreshCw } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { PageHeader } from "@/components/admin/shared/page-header"

interface Renewal {
  id: string
  customerName: string
  planName: string
  kgLimit: number
  amount: number
  billingCycle: string
  renewalDate: string
  status: "UPCOMING" | "DUE" | "OVERDUE" | "RENEWED"
  autoRenew: boolean
}

const statusColors: Record<string, string> = {
  UPCOMING: "bg-sky-100 text-sky-700",
  DUE: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
  RENEWED: "bg-emerald-100 text-emerald-700",
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function daysUntil(d: string): number {
  return Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000))
}

export default function RenewalsPage() {
  const { currentBusinessId, currentBusinessType } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""
  const isLaundry = currentBusinessType === "LAUNDRY"

  const [renewals, setRenewals] = useState<Renewal[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/subscription/renewals`, {
        headers: { "x-business-id": businessId },
      })
      const json = await res.json()
      if (json.success) setRenewals(json.data)
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
        title={isLaundry ? "Subscription Renewals" : "Renewals"}
        description={isLaundry ? "Upcoming laundry subscription renewals & expirations" : "Manage subscription renewals"}
        icon={RefreshCw}
      />

      {renewals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <RotateCcw className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No upcoming renewals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {renewals.map((ren) => {
            const days = daysUntil(ren.renewalDate)
            return (
              <Card key={ren.id} className="shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold truncate">{ren.customerName}</p>
                        <Badge className={`text-xs ${statusColors[ren.status] ?? ""}`}>
                          {ren.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{ren.planName}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          Renews {fmtDate(ren.renewalDate)}
                        </span>
                        {ren.status !== "RENEWED" && (
                          <span className="text-xs font-medium text-amber-600">
                            {days === 0 ? "Due today" : `${days} day${days > 1 ? "s" : ""} remaining`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-sm font-semibold">₹{ren.amount}</p>
                      <p className="text-xs text-muted-foreground">{ren.billingCycle}</p>
                      {isLaundry && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <Weight className="h-3 w-3" />
                          {ren.kgLimit} kg
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
