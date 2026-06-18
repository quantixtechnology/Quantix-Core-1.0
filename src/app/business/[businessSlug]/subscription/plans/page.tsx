"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, Droplets, Weight, IndianRupee, Calendar, CheckCircle2, AlertCircle } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { PageHeader } from "@/components/admin/shared/page-header"

interface Plan {
  id: string
  name: string
  price: number
  kgLimit: number
  billingCycle: "WEEKLY" | "MONTHLY" | "QUARTERLY"
  description: string
  active: boolean
  customerCount?: number
}

const cycleLabels: Record<string, string> = {
  WEEKLY: "per week",
  MONTHLY: "per month",
  QUARTERLY: "per quarter",
}

export default function SubscriptionPlansPage() {
  const { currentBusinessId, currentBusinessType } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""
  const isLaundry = currentBusinessType === "LAUNDRY"

  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/subscription/plans`, {
        headers: { "x-business-id": businessId },
      })
      const json = await res.json()
      if (json.success) setPlans(json.data)
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
        title={isLaundry ? "Laundry Subscription Plans" : "Subscription Plans"}
        description={isLaundry ? "Pricing tiers by weight limit and billing cycle" : "Manage your subscription plans"}
        icon={Droplets}
      />

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No subscription plans yet</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={`shadow-none ${!plan.active ? "opacity-60" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {!plan.active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                </div>
                <CardDescription className="text-xs">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">₹{plan.price}</span>
                  <span className="text-xs text-muted-foreground">/{cycleLabels[plan.billingCycle] ?? plan.billingCycle}</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  {isLaundry && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Weight className="h-3.5 w-3.5" />
                        Weight limit
                      </span>
                      <span className="font-medium">{plan.kgLimit} kg</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Billing
                    </span>
                    <span className="font-medium">{plan.billingCycle}</span>
                  </div>
                  {plan.customerCount !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Active customers</span>
                      <span className="font-medium">{plan.customerCount}</span>
                    </div>
                  )}
                </div>

                {plan.active && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Active plan
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
