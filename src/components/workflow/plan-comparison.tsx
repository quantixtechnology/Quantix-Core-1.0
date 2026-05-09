"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check, X, Sparkles, ShoppingCart, Truck, Calendar, CreditCard, Receipt, ArrowRight } from "lucide-react"
import { PLAN_CONFIGS, WORKFLOW_CONFIGS, type PlanTier } from "@/stores/admin-store"

const workflowIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart,
  Truck,
  Calendar,
  CreditCard,
  Receipt,
}

export function PlanComparison() {
  return (
    <div className="space-y-6">
      {/* Plan Cards */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {PLAN_CONFIGS.map((plan) => (
          <Card
            key={plan.tier}
            className={`relative overflow-hidden ${
              plan.popular ? "border-primary shadow-md" : ""
            }`}
          >
            {plan.popular && (
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-[10px] font-bold rounded-bl-lg">
                MOST POPULAR
              </div>
            )}
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                {plan.popular && <Sparkles className="h-5 w-5 text-amber-500" />}
                <CardTitle className="text-lg">{plan.name} Plan</CardTitle>
              </div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pricing */}
              <div className="space-y-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">₹{plan.monthlyPrice.toLocaleString("en-IN")}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-semibold text-muted-foreground">₹{plan.yearlyPrice.toLocaleString("en-IN")}</span>
                  <span className="text-sm text-muted-foreground">/year</span>
                  {plan.yearlyPrice < plan.monthlyPrice * 12 && (
                    <Badge className="ml-2 text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">
                      Save ₹{((plan.monthlyPrice * 12) - plan.yearlyPrice).toLocaleString("en-IN")}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  + ₹{plan.implementationCharge.toLocaleString("en-IN")} one-time implementation charge
                </p>
              </div>

              {/* Workflows */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Workflow Access
                </p>
                <div className="space-y-2">
                  {WORKFLOW_CONFIGS.map((wf) => {
                    const isAllowed = plan.allowedWorkflows.includes(wf.type)
                    const Icon = workflowIconMap[wf.icon] || ShoppingCart
                    return (
                      <div
                        key={wf.type}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                          isAllowed ? "bg-emerald-50/50 border-emerald-200/50" : "bg-muted/30 opacity-50"
                        }`}
                      >
                        {isAllowed ? (
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <Icon className={`h-4 w-4 shrink-0 ${wf.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{wf.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{wf.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Features */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Features
                </p>
                <div className="grid gap-1.5">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="text-xs">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Limits */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Limits
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border px-3 py-2 text-center">
                    <p className="text-lg font-bold">{plan.limits.stores}</p>
                    <p className="text-[10px] text-muted-foreground">Stores</p>
                  </div>
                  <div className="rounded-lg border px-3 py-2 text-center">
                    <p className="text-lg font-bold">{plan.limits.products.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Products</p>
                  </div>
                  <div className="rounded-lg border px-3 py-2 text-center">
                    <p className="text-lg font-bold">{plan.limits.orders.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Orders/mo</p>
                  </div>
                  <div className="rounded-lg border px-3 py-2 text-center">
                    <p className="text-lg font-bold">{plan.limits.partners}</p>
                    <p className="text-[10px] text-muted-foreground">Partners</p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <Button
                className={`w-full ${plan.popular ? "" : "bg-emerald-600 hover:bg-emerald-700"}`}
                variant={plan.popular ? "default" : "outline"}
              >
                Get Started with {plan.name}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upgrade Path */}
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Upgrade from Standard to Pro
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Unlock all 5 workflow types, subscription engine, appointment system, post-service billing, and advanced workflow engine. 
                Perfect for businesses with multiple service types.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-xs text-muted-foreground line-through">₹2,999/mo</p>
                <p className="text-lg font-bold">₹4,999<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
              </div>
              <ArrowRight className="h-5 w-5 text-amber-500" />
              <div className="text-center">
                <Badge className="bg-amber-500 text-white mb-1">PRO</Badge>
                <p className="text-[10px] text-muted-foreground">5 Workflows</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
