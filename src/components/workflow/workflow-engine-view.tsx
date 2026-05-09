"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ShoppingCart, Truck, Calendar, CreditCard, Receipt, Zap,
  ArrowRight, ChevronRight, Check, Lock, Globe, Settings,
  BarChart3, Users, Package, Warehouse, Clock, Shield,
  Sparkles, Layers, Workflow,
} from "lucide-react"
import { useAdminStore, WORKFLOW_CONFIGS, DEMO_BUSINESSES, PLAN_CONFIGS, type WorkflowType, type DemoBusiness } from "@/stores/admin-store"
import { DemoSwitcher } from "@/components/workflow/demo-switcher"
import { PlanComparison } from "@/components/workflow/plan-comparison"

const workflowIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart,
  Truck,
  Calendar,
  CreditCard,
  Receipt,
}

const workflowStepMap: Record<WorkflowType, { steps: string[]; stepClass: string }> = {
  ECOMMERCE: {
    steps: ["Browse & Cart", "Checkout", "Payment", "Delivery"],
    stepClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  PICKUP_DELIVERY: {
    steps: ["Pickup Scheduled", "Pickup Assigned", "Processing", "Return Delivery"],
    stepClass: "bg-sky-50 text-sky-700 border border-sky-200",
  },
  APPOINTMENT: {
    steps: ["Select Service", "Choose Date/Time", "Technician Assigned", "Slot Confirmed"],
    stepClass: "bg-violet-50 text-violet-700 border border-violet-200",
  },
  SUBSCRIPTION: {
    steps: ["Choose Package", "Purchase Credits", "Use Credits", "Auto-Renewal"],
    stepClass: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  POST_SERVICE_BILLING: {
    steps: ["Estimate Given", "Service/Inspection", "Final Bill Generated", "Customer Approval", "Payment"],
    stepClass: "bg-rose-50 text-rose-700 border border-rose-200",
  },
}

function WorkflowCard({ type, demoBusiness }: { type: WorkflowType; demoBusiness: DemoBusiness }) {
  const config = WORKFLOW_CONFIGS.find((w) => w.type === type)
  if (!config) return null

  const steps = workflowStepMap[type]
  const Icon = workflowIconMap[config.icon] || ShoppingCart
  const isAllowed = demoBusiness.activeWorkflows.includes(type)

  return (
    <Card className={`transition-all duration-200 ${isAllowed ? "hover:shadow-md" : "opacity-60"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.bgColor} border`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{config.label}</CardTitle>
              <CardDescription className="text-xs">{config.description}</CardDescription>
            </div>
          </div>
          {isAllowed ? (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
              <Check className="h-3 w-3 mr-1" /> Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              <Lock className="h-3 w-3 mr-1" /> Pro Only
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Workflow Steps */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Workflow Steps</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {steps.steps.map((step, idx) => (
              <div key={step} className="flex items-center gap-1.5">
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-medium ${
                  isAllowed ? steps.stepClass : "bg-muted text-muted-foreground border"
                }`}>
                  {step}
                </span>
                {idx < steps.steps.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Features Included</p>
          <div className="flex flex-wrap gap-1.5">
            {config.features.map((feature) => (
              <span key={feature} className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] ${
                isAllowed ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
              }`}>
                {isAllowed ? <Check className="h-2.5 w-2.5 mr-1" /> : <Lock className="h-2.5 w-2.5 mr-1" />}
                {feature}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BusinessWorkflowMap({ demoBusiness }: { demoBusiness: DemoBusiness }) {
  if (demoBusiness.id === "super_admin" || demoBusiness.categories.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Product → Workflow Assignment Map
        </CardTitle>
        <CardDescription className="text-xs">
          How {demoBusiness.name} maps categories to workflows
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {demoBusiness.categories.map((cat) => {
            const config = WORKFLOW_CONFIGS.find((w) => w.type === cat.workflow)
            const Icon = workflowIconMap[config?.icon || "ShoppingCart"] || ShoppingCart
            return (
              <div key={cat.name} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-sm font-medium">{cat.name}</span>
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${config?.color || "text-muted-foreground"}`} />
                  <Badge variant="outline" className="text-[10px]">
                    {config?.label || cat.workflow}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function SharedInfrastructure() {
  const systems = [
    { name: "Authentication & Users", icon: Shield, desc: "Same login, roles, permissions" },
    { name: "Inventory Engine", icon: Warehouse, desc: "Unified product/stock management" },
    { name: "Notifications", icon: Clock, desc: "Push, WhatsApp, Email" },
    { name: "POS System", icon: Receipt, desc: "Unified billing terminal" },
    { name: "Delivery Engine", icon: Truck, desc: "Shared partner & zone system" },
    { name: "Payment Gateway", icon: CreditCard, desc: "UPI, Card, Cash integration" },
    { name: "Customer Database", icon: Users, desc: "Single customer across workflows" },
    { name: "Analytics & Reports", icon: BarChart3, desc: "Cross-workflow insights" },
    { name: "Deployment Infra", icon: Globe, desc: "Same hosting, domains, CDN" },
    { name: "Order Engine", icon: Package, desc: "Polymorphic OrderItem system" },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Shared Infrastructure
        </CardTitle>
        <CardDescription className="text-xs">
          ALL workflows reuse the same backend — no separate systems
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {systems.map((sys) => (
            <div key={sys.name} className="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center">
              <sys.icon className="h-5 w-5 text-primary" />
              <span className="text-[10px] font-medium leading-tight">{sys.name}</span>
              <span className="text-[9px] text-muted-foreground leading-tight">{sys.desc}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function WorkflowEngineView() {
  const { demoBusinessId } = useAdminStore()
  const [activeTab, setActiveTab] = useState("workflows")

  const demoBusiness = DEMO_BUSINESSES.find((b) => b.id === demoBusinessId) || DEMO_BUSINESSES[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            Product Workflow Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure workflow types per category/product — not per business type
          </p>
        </div>
        <DemoSwitcher />
      </div>

      {/* Current Business Context */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${demoBusiness.color}`}>
                {(() => {
                  const Icon = workflowIconMap[demoBusiness.icon] || ShoppingCart
                  return <Icon className="h-5 w-5" />
                })()}
              </div>
              <div>
                <p className="font-semibold text-sm">{demoBusiness.name}</p>
                <p className="text-xs text-muted-foreground">{demoBusiness.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {demoBusiness.planTier === "PRO" ? (
                  <><Sparkles className="h-3 w-3 mr-1 text-amber-500" /> Pro Plan</>
                ) : (
                  <>Standard Plan</>
                )}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {demoBusiness.activeWorkflows.length} Workflow{demoBusiness.activeWorkflows.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="workflows" className="text-xs">Workflows</TabsTrigger>
          <TabsTrigger value="assignment" className="text-xs">Category Mapping</TabsTrigger>
          <TabsTrigger value="plans" className="text-xs">Plans & Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-6 mt-4">
          {/* 5 Workflow Cards */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {WORKFLOW_CONFIGS.map((wf) => (
              <WorkflowCard key={wf.type} type={wf.type} demoBusiness={demoBusiness} />
            ))}
          </div>

          {/* Shared Infrastructure */}
          <SharedInfrastructure />
        </TabsContent>

        <TabsContent value="assignment" className="space-y-6 mt-4">
          {/* Business-specific category → workflow mapping */}
          <BusinessWorkflowMap demoBusiness={demoBusiness} />

          {/* Cross-business examples */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                How Different Businesses Use Workflows
              </CardTitle>
              <CardDescription className="text-xs">
                Same platform, same backend — different workflow combinations per business
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Car Wash Example */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">Car Wash Business</Badge>
                    <Badge variant="outline" className="text-[10px]">Pro Plan</Badge>
                  </div>
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                    {[
                      { cat: "Subscription Wash", wf: "SUBSCRIPTION" },
                      { cat: "Pickup Wash", wf: "PICKUP_DELIVERY" },
                      { cat: "Accessories", wf: "ECOMMERCE" },
                      { cat: "Appointment Wash", wf: "APPOINTMENT" },
                      { cat: "Detailing", wf: "POST_SERVICE_BILLING" },
                    ].map((item) => {
                      const cfg = WORKFLOW_CONFIGS.find((w) => w.type === item.wf)
                      const Icon = workflowIconMap[cfg?.icon || "ShoppingCart"] || ShoppingCart
                      return (
                        <div key={item.cat} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg?.color}`} />
                          <div className="min-w-0">
                            <p className="text-[10px] font-medium truncate">{item.cat}</p>
                            <p className="text-[9px] text-muted-foreground truncate">{cfg?.label}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Laundry Example */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-sky-100 text-sky-700 border-sky-200">Laundry Business</Badge>
                    <Badge variant="outline" className="text-[10px]">Pro Plan</Badge>
                  </div>
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { cat: "Standard Wash", wf: "ECOMMERCE" },
                      { cat: "Weight Wash", wf: "POST_SERVICE_BILLING" },
                      { cat: "Subscription Wash", wf: "SUBSCRIPTION" },
                      { cat: "Pickup & Delivery", wf: "PICKUP_DELIVERY" },
                    ].map((item) => {
                      const cfg = WORKFLOW_CONFIGS.find((w) => w.type === item.wf)
                      const Icon = workflowIconMap[cfg?.icon || "ShoppingCart"] || ShoppingCart
                      return (
                        <div key={item.cat} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg?.color}`} />
                          <div className="min-w-0">
                            <p className="text-[10px] font-medium truncate">{item.cat}</p>
                            <p className="text-[9px] text-muted-foreground truncate">{cfg?.label}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Grocery Example */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Grocery Business</Badge>
                    <Badge variant="outline" className="text-[10px]">Standard Plan</Badge>
                  </div>
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { cat: "Fruits & Vegetables", wf: "ECOMMERCE" },
                      { cat: "Dairy & Bakery", wf: "ECOMMERCE" },
                      { cat: "Snacks & Beverages", wf: "ECOMMERCE" },
                      { cat: "Household Items", wf: "ECOMMERCE" },
                    ].map((item) => {
                      const cfg = WORKFLOW_CONFIGS.find((w) => w.type === item.wf)
                      const Icon = workflowIconMap[cfg?.icon || "ShoppingCart"] || ShoppingCart
                      return (
                        <div key={item.cat} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg?.color}`} />
                          <div className="min-w-0">
                            <p className="text-[10px] font-medium truncate">{item.cat}</p>
                            <p className="text-[9px] text-muted-foreground truncate">{cfg?.label}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-4">
          <PlanComparison />
        </TabsContent>
      </Tabs>
    </div>
  )
}
