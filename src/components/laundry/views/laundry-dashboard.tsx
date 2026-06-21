"use client"

import { useEffect, useState } from "react"
import {
  ShoppingBag, ClipboardCheck, Package, Cog, Truck, CheckCircle, IndianRupee,
  Scan, List, Shield, ArrowDown,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import LaundrySetupWizard from "./laundry-setup-wizard"

const KPI_CONFIG = [
  { label: "Today's Orders", icon: ShoppingBag, color: "text-sky-600 bg-sky-100" },
  { label: "Pending Audit", icon: ClipboardCheck, color: "text-amber-600 bg-amber-100" },
  { label: "Ready For Processing", icon: Package, color: "text-violet-600 bg-violet-100" },
  { label: "In Processing", icon: Cog, color: "text-blue-600 bg-blue-100" },
  { label: "Ready For Delivery", icon: Truck, color: "text-emerald-600 bg-emerald-100" },
  { label: "Delivered Today", icon: CheckCircle, color: "text-green-600 bg-green-100" },
  { label: "Revenue Today", icon: IndianRupee, color: "text-rose-600 bg-rose-100" },
]

const QUICK_ACTIONS = [
  { label: "New Order", icon: ShoppingBag },
  { label: "Store Audit", icon: ClipboardCheck },
  { label: "Collect Payment", icon: IndianRupee },
  { label: "Dispatch Orders", icon: Truck },
  { label: "Receive at Processing Center", icon: Package },
  { label: "Generate Barcodes", icon: Scan },
  { label: "Queue Allocation", icon: List },
  { label: "Quality Check", icon: Shield },
  { label: "Delivery Management", icon: Truck },
]

const WORKFLOW_STEPS = [
  "Order Intake",
  "Store Audit",
  "Payment Collection",
  "Packing & Dispatch",
  "Processing Center Intake",
  "Barcode Generation",
  "Queue Allocation",
  "Processing",
  "Quality Check",
  "Packing",
  "Dispatch",
  "Delivery",
]

function KpiSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-12" />
      </div>
    </div>
  )
}

function DashboardContent({ laundryBusinessId }: { laundryBusinessId: string }) {
  const { toast } = useToast()
  const [kpiValues, setKpiValues] = useState<number[]>([])
  const [kpiLoading, setKpiLoading] = useState(true)

  useEffect(() => {
    async function loadKpis() {
      try {
        const res = await fetch(`/api/laundry/businesses/${laundryBusinessId}/stores`)
        if (!res.ok) return
        const stores = await res.json()
        const storeCount = Array.isArray(stores) ? stores.length : 0
        setKpiValues([storeCount, 0, 0, 0, 0, 0, 0])
      } catch {
        setKpiValues([0, 0, 0, 0, 0, 0, 0])
      } finally {
        setKpiLoading(false)
      }
    }
    loadKpis()
  }, [laundryBusinessId])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Laundry Dashboard</h2>
        <p className="text-sm text-muted-foreground">Real-time overview of your laundry operations</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {KPI_CONFIG.map((kpi, i) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              {kpiLoading ? (
                <KpiSkeleton />
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.color}`}>
                    <kpi.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-xl font-bold">{kpiValues[i] ?? "—"}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          {QUICK_ACTIONS.map(action => (
            <Card key={action.label} className="cursor-pointer hover:bg-accent/50 transition-colors">
              <CardContent className="p-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <action.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm whitespace-nowrap">{action.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Order Workflow</h3>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-1">
              {WORKFLOW_STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-1">
                  <div className="rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium whitespace-nowrap border border-primary/20">
                    {step}
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <ArrowDown className="h-3 w-3 text-muted-foreground rotate-[-90deg] shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function LaundryDashboard() {
  const { currentBusinessId } = useAuthStore()
  const [showSetup, setShowSetup] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!currentBusinessId) {
      setChecking(false)
      return
    }
    fetch(`/api/laundry/businesses/${currentBusinessId}/stores`)
      .then(res => res.json())
      .then(stores => {
        if (Array.isArray(stores) && stores.length === 0) {
          setShowSetup(true)
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [currentBusinessId])

  if (checking) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    )
  }

  if (!currentBusinessId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-sm">No business selected</p>
      </div>
    )
  }

  if (showSetup) {
    return (
      <div className="py-8">
        <LaundrySetupWizard
          laundryBusinessId={currentBusinessId}
          onComplete={() => {
            setShowSetup(false)
            window.location.href = "/"
          }}
        />
      </div>
    )
  }

  return <DashboardContent laundryBusinessId={currentBusinessId} />
}
