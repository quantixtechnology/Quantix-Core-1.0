"use client"

import { Check, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const STANDARD_FEATURES = ["Pickup & Delivery", "Pre-Service Payment", "Post-Service Payment"]

const PRO_FEATURES = [
  "Everything in Standard",
  "Advanced Order Management",
  "Multi-Store Support",
  "Priority Support",
  "Future Advanced Modules",
]

export function LaundrySubscription({ plan }: { plan: string }) {
  const features = plan === "PRO" ? PRO_FEATURES : STANDARD_FEATURES
  const isPro = plan === "PRO"

  return (
    <div className="space-y-4">
      <Card className={isPro ? "border-purple-200" : "border-gray-200"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className={`h-5 w-5 ${isPro ? "text-purple-500" : "text-gray-400"}`} />
              <CardTitle className="text-lg">{plan === "PRO" ? "PRO Plan" : "STANDARD Plan"}</CardTitle>
            </div>
            <Badge className={isPro ? "bg-purple-100 text-purple-700 border-purple-200" : ""}>{plan}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            {isPro
              ? "Full-featured laundry platform with advanced capabilities."
              : "Essential laundry operations for small to medium businesses."}
          </p>
          <div className="space-y-2">
            {features.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <Check className={`h-4 w-4 ${isPro ? "text-purple-500" : "text-green-500"}`} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400">Plan changes and billing integration coming in a future phase.</p>
    </div>
  )
}
