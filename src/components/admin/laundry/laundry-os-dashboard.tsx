"use client"

import { Building2, Factory, Store, ShoppingBag, Users, BarChart3, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const cards = [
  { title: "Laundry Businesses", icon: Building2, description: "Manage laundry business accounts" },
  { title: "Processing Centers", icon: Factory, description: "Manage processing center operations" },
  { title: "Pickup Centers", icon: Store, description: "Manage pickup and drop locations" },
  { title: "Orders", icon: ShoppingBag, description: "Track and manage laundry orders" },
  { title: "Customers", icon: Users, description: "Customer management and analytics" },
  { title: "Reports", icon: BarChart3, description: "Performance and operational reports" },
]

export function LaundryOsDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Laundry OS</h1>
          <p className="text-sm text-gray-500">Laundry Management Platform</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="border-gray-200">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-sky-600">
                  <Icon className="h-4 w-4" />
                </div>
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">{card.description}</p>
                <div className="mt-3">
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Coming Soon
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
