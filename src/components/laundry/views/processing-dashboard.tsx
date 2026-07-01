"use client"

import { useEffect, useState } from "react"
import { Factory, Package, CheckCircle2, Clock, AlertTriangle, ArrowRight, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"

type ProcessingSummary = {
  awaitingProcessing: number
  inProgress: number
  qcPending: number
  completedToday: number
  inTransit: number
}

export function ProcessingDashboard() {
  const { currentBusinessId } = useAuthStore()
  const { setLaundryPage } = useAdminStore()
  const [summary, setSummary] = useState<ProcessingSummary>({
    awaitingProcessing: 0, inProgress: 0, qcPending: 0,
    completedToday: 0, inTransit: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentBusinessId) return
    setLoading(true)
    fetch(`/api/laundry/processing/summary?businessId=${currentBusinessId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setSummary(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentBusinessId])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  const statCards = [
    { label: "Awaiting Processing", value: summary.awaitingProcessing, icon: Package, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "In Progress", value: summary.inProgress, icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "QC Pending", value: summary.qcPending, icon: AlertTriangle, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Completed Today", value: summary.completedToday, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
    { label: "In Transit", value: summary.inTransit, icon: ArrowRight, color: "text-blue-600", bg: "bg-blue-50" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Factory className="h-5 w-5 text-amber-600" />
            Processing Center
          </h2>
          <p className="text-sm text-muted-foreground">Production floor overview</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {statCards.map(card => (
          <Card key={card.label} className={card.bg + " border-0"}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <p className="mt-3 text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              onClick={() => setLaundryPage("orders")}
              className="w-full flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2"><Package className="h-4 w-4" /> View Orders</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setLaundryPage("reports")}
              className="w-full flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2"><Factory className="h-4 w-4" /> Production Reports</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Workflow Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">In Transit to Processing</span>
              <Badge variant="outline" className={summary.inTransit > 0 ? "border-blue-300 text-blue-700" : ""}>
                {summary.inTransit} items
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Awaiting Processing</span>
              <Badge variant="outline" className={summary.awaitingProcessing > 0 ? "border-amber-300 text-amber-700" : ""}>
                {summary.awaitingProcessing} items
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">QC & Packing</span>
              <Badge variant="outline" className={summary.qcPending > 0 ? "border-purple-300 text-purple-700" : ""}>
                {summary.qcPending} items
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completed Today</span>
              <Badge variant="outline" className="border-green-300 text-green-700">
                {summary.completedToday} items
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
