"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ShoppingCart, Truck, Calendar, CreditCard, Receipt,
  Plus, Edit, Trash2, ChevronRight, ArrowRight, Check,
  Lock, AlertCircle, Workflow, Layers, Settings,
} from "lucide-react"
import { useAdminStore, WORKFLOW_CONFIGS, DEMO_BUSINESSES, type WorkflowType } from "@/stores/admin-store"

const workflowIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart,
  Truck,
  Calendar,
  CreditCard,
  Receipt,
}

// Demo category data per business
const BUSINESS_CATEGORIES: Record<string, { id: string; name: string; workflow: WorkflowType; products: number }[]> = {
  standard_grocery: [
    { id: "c1", name: "Fruits & Vegetables", workflow: "ECOMMERCE", products: 45 },
    { id: "c2", name: "Dairy & Bakery", workflow: "ECOMMERCE", products: 32 },
    { id: "c3", name: "Snacks & Beverages", workflow: "ECOMMERCE", products: 58 },
    { id: "c4", name: "Household Items", workflow: "ECOMMERCE", products: 24 },
  ],
  standard_laundry: [
    { id: "c1", name: "Wash & Fold", workflow: "ECOMMERCE", products: 3 },
    { id: "c2", name: "Dry Cleaning", workflow: "ECOMMERCE", products: 5 },
    { id: "c3", name: "Ironing Service", workflow: "ECOMMERCE", products: 2 },
  ],
  pro_laundry: [
    { id: "c1", name: "Standard Wash", workflow: "ECOMMERCE", products: 4 },
    { id: "c2", name: "Weight Wash", workflow: "POST_SERVICE_BILLING", products: 3 },
    { id: "c3", name: "Subscription Wash", workflow: "SUBSCRIPTION", products: 6 },
    { id: "c4", name: "Pickup & Delivery", workflow: "PICKUP_DELIVERY", products: 2 },
  ],
  pro_carwash: [
    { id: "c1", name: "Subscription Wash", workflow: "SUBSCRIPTION", products: 8 },
    { id: "c2", name: "Pickup Wash", workflow: "PICKUP_DELIVERY", products: 4 },
    { id: "c3", name: "Accessories", workflow: "ECOMMERCE", products: 15 },
    { id: "c4", name: "Appointment Wash", workflow: "APPOINTMENT", products: 6 },
    { id: "c5", name: "Detailing Service", workflow: "POST_SERVICE_BILLING", products: 5 },
  ],
}

function CategoryWorkflowRow({
  category,
  allowedWorkflows,
  planTier,
}: {
  category: { id: string; name: string; workflow: WorkflowType; products: number }
  allowedWorkflows: WorkflowType[]
  planTier: string
}) {
  const config = WORKFLOW_CONFIGS.find((w) => w.type === category.workflow)
  const Icon = workflowIconMap[config?.icon || "ShoppingCart"] || ShoppingCart

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config?.bgColor || "bg-muted"} border`}>
          <Icon className={`h-4 w-4 ${config?.color || "text-muted-foreground"}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{category.name}</p>
          <p className="text-xs text-muted-foreground">{category.products} products</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Select defaultValue={category.workflow}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_CONFIGS.map((wf) => {
              const isAllowed = allowedWorkflows.includes(wf.type)
              const WfIcon = workflowIconMap[wf.icon] || ShoppingCart
              return (
                <SelectItem key={wf.type} value={wf.type} disabled={!isAllowed}>
                  <div className="flex items-center gap-2">
                    <WfIcon className={`h-3.5 w-3.5 ${wf.color}`} />
                    <span>{wf.label}</span>
                    {!isAllowed && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function WorkflowStatusCard({
  workflowType,
  categories,
  isActive,
}: {
  workflowType: WorkflowType
  categories: { name: string }[]
  isActive: boolean
}) {
  const config = WORKFLOW_CONFIGS.find((w) => w.type === workflowType)
  if (!config) return null
  const Icon = workflowIconMap[config.icon] || ShoppingCart

  return (
    <Card className={`${isActive ? "" : "opacity-50"}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.bgColor} border`}>
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">{config.label}</p>
            <p className="text-[10px] text-muted-foreground truncate">{config.description}</p>
          </div>
          {isActive ? (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">
              <Check className="h-2.5 w-2.5 mr-0.5" /> Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px]">
              <Lock className="h-2.5 w-2.5 mr-0.5" /> Locked
            </Badge>
          )}
        </div>
        {isActive && categories.length > 0 && (
          <div className="space-y-1">
            {categories.map((cat) => (
              <div key={cat.name} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <ChevronRight className="h-3 w-3" />
                {cat.name}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function WorkflowConfigView() {
  const { demoBusinessId } = useAdminStore()
  const demoBusiness = DEMO_BUSINESSES.find((b) => b.id === demoBusinessId) || DEMO_BUSINESSES[0]
  const categories = BUSINESS_CATEGORIES[demoBusinessId] || []

  // Group categories by workflow
  const workflowGroups: Record<WorkflowType, { name: string }[]> = {
    ECOMMERCE: [],
    PICKUP_DELIVERY: [],
    APPOINTMENT: [],
    SUBSCRIPTION: [],
    POST_SERVICE_BILLING: [],
  }

  categories.forEach((cat) => {
    if (workflowGroups[cat.workflow]) {
      workflowGroups[cat.workflow].push({ name: cat.name })
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Workflow Configuration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assign workflow types to categories — each category can use a different workflow
        </p>
      </div>

      {/* Business Context */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{demoBusiness.name}</p>
              <p className="text-xs text-muted-foreground">
                {demoBusiness.planTier === "PRO" ? "Pro Plan — All Workflows Available" : "Standard Plan — Ecommerce Only"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {WORKFLOW_CONFIGS.map((wf) => {
                const isAllowed = demoBusiness.activeWorkflows.includes(wf.type)
                const Icon = workflowIconMap[wf.icon] || ShoppingCart
                return (
                  <div
                    key={wf.type}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                      isAllowed ? wf.bgColor : "bg-muted/50 border-dashed"
                    }`}
                    title={isAllowed ? wf.label : `${wf.label} (Pro Only)`}
                  >
                    <Icon className={`h-4 w-4 ${isAllowed ? wf.color : "text-muted-foreground"}`} />
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category → Workflow Assignment */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Category → Workflow Mapping
              </CardTitle>
              <CardDescription className="text-xs">
                Select which workflow each category uses. Products inherit their category&apos;s workflow.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Add Category
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No categories configured</p>
              <p className="text-xs mt-1">Add categories and assign workflows</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <CategoryWorkflowRow
                  key={cat.id}
                  category={cat}
                  allowedWorkflows={demoBusiness.activeWorkflows}
                  planTier={demoBusiness.planTier}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Status Grid */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Workflow className="h-4 w-4" />
          Active Workflows
        </h3>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {WORKFLOW_CONFIGS.map((wf) => (
            <WorkflowStatusCard
              key={wf.type}
              workflowType={wf.type}
              categories={workflowGroups[wf.type]}
              isActive={demoBusiness.activeWorkflows.includes(wf.type)}
            />
          ))}
        </div>
      </div>

      {/* Upgrade Prompt for Standard users */}
      {demoBusiness.planTier === "STANDARD" && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Unlock All Workflows with Pro Plan</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Upgrade to Pro (₹4,999/mo) to access Pickup & Delivery, Appointment, Subscription, 
                  and Post-Service Billing workflows. Perfect for multi-service businesses.
                </p>
                <Button size="sm" className="mt-3 gap-1.5 text-xs">
                  Upgrade to Pro
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
