"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, IndianRupee, Droplets, TrendingUp, ToggleLeft } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"

const PLANS = [
  { id: "1", service: "Wash + Dry", name: "Silver Monthly", monthlyPrice: 2500, includedKg: 8, extraKgRate: 70, status: "ACTIVE", subscriberCount: 15 },
  { id: "2", service: "Wash + Dry + Iron", name: "Gold Monthly", monthlyPrice: 3500, includedKg: 10, extraKgRate: 80, status: "ACTIVE", subscriberCount: 22 },
  { id: "3", service: "Wash + Dry + Iron + Fold", name: "Platinum Monthly", monthlyPrice: 4000, includedKg: 10, extraKgRate: 80, status: "ACTIVE", subscriberCount: 8 },
  { id: "4", service: "Premium Care", name: "Premium Monthly", monthlyPrice: 5500, includedKg: 12, extraKgRate: 100, status: "ACTIVE", subscriberCount: 5 },
  { id: "5", service: "Blanket Wash", name: "Blanket Monthly", monthlyPrice: 1800, includedKg: 4, extraKgRate: 60, status: "INACTIVE", subscriberCount: 0 },
]

export function SubscriptionPlansView() {
  const { currentBusinessType } = useAdminStore()
  const isLaundry = currentBusinessType === "LAUNDRY"
  const [plans] = useState(PLANS)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Subscription Plans</h2>
          <p className="text-sm text-muted-foreground">
            {isLaundry ? "Laundry service subscription plans — tied to laundry services" : "Manage subscription pricing tiers"}
          </p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Plan
        </Button>
      </div>

      {isLaundry && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {plans.filter(p => p.status === "ACTIVE").map(plan => (
              <Card key={plan.id} className="border-sky-100">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{plan.service}</p>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                      {plan.subscriberCount} subscribers
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline gap-1">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{plan.monthlyPrice.toLocaleString("en-IN")}</span>
                    <span className="text-xs text-muted-foreground">/month</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Droplets className="h-3.5 w-3.5 text-sky-600" />
                    <span>{plan.includedKg} KG included</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                    <span>₹{plan.extraKgRate}/KG extra</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Service</TableHead>
                  <TableHead className="text-xs">Plan Name</TableHead>
                  <TableHead className="text-xs">Monthly Price</TableHead>
                  <TableHead className="text-xs">Included KG</TableHead>
                  <TableHead className="text-xs">Extra KG Rate</TableHead>
                  <TableHead className="text-xs">Subscribers</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map(plan => (
                  <TableRow key={plan.id}>
                    <TableCell className="text-sm">{plan.service}</TableCell>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>₹{plan.monthlyPrice.toLocaleString("en-IN")}</TableCell>
                    <TableCell>{plan.includedKg} KG</TableCell>
                    <TableCell>₹{plan.extraKgRate}/KG</TableCell>
                    <TableCell>{plan.subscriberCount}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        plan.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
                      }>
                        {plan.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
