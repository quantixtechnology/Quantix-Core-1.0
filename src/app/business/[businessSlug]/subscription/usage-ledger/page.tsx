"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Droplets, Weight, CalendarDays, AlertCircle, User, FileText } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { PageHeader } from "@/components/admin/shared/page-header"

interface UsageRecord {
  id: string
  date: string
  customerName: string
  kgUsed: number
  serviceType: string
  notes: string | null
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export default function UsageLedgerPage() {
  const { currentBusinessId, currentBusinessType } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""
  const isLaundry = currentBusinessType === "LAUNDRY"

  const [records, setRecords] = useState<UsageRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/subscription/usage-ledger`, {
        headers: { "x-business-id": businessId },
      })
      const json = await res.json()
      if (json.success) setRecords(json.data)
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
        title={isLaundry ? "Usage Ledger — KG Log" : "Usage Ledger"}
        description={isLaundry ? "Weight-based consumption log for laundry subscriptions" : "Track service usage"}
        icon={FileText}
      />

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Droplets className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No usage records found</p>
        </div>
      ) : (
        <Card className="shadow-none">
          <div className="divide-y">
            {records.map((rec) => (
              <div key={rec.id} className="flex items-center gap-4 px-6 py-3">
                <div className="rounded-full bg-sky-50 p-2 shrink-0">
                  <Weight className="h-4 w-4 text-sky-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{rec.customerName}</p>
                    <Badge variant="outline" className="text-xs">{rec.kgUsed} kg</Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {fmtDate(rec.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Droplets className="h-3 w-3" />
                      {rec.serviceType}
                    </span>
                  </div>
                  {rec.notes && <p className="text-xs text-muted-foreground mt-1">{rec.notes}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-sky-600">{rec.kgUsed} kg</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
