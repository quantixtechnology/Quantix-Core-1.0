'use client'

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ShoppingCart, Repeat, Calendar, Truck, Receipt, CheckCircle, Settings2, ArrowRight, Zap, Layers } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"

// ─── Engine Data ────────────────────────────────────────────────────────────────

interface Engine {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  enabled: boolean
  capabilities: string[]
  color: string
}

const initialEngines: Engine[] = [
  {
    id: "ecommerce",
    name: "Ecommerce Engine",
    icon: ShoppingCart,
    description: "Product catalog, cart, checkout, delivery & inventory management",
    enabled: true,
    capabilities: ["Product Catalog", "Cart & Checkout", "Delivery Integration", "Inventory Tracking"],
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    id: "subscription",
    name: "Subscription Engine",
    icon: Repeat,
    description: "Credit-based packages, usage tracking & plan management",
    enabled: true,
    capabilities: ["Plan Management", "Credit System", "Usage Tracking", "Auto Renewal"],
    color: "text-violet-600 bg-violet-50 border-violet-200",
  },
  {
    id: "service-booking",
    name: "Service Booking Engine",
    icon: Calendar,
    description: "Appointments, time slots, service catalog & assignment",
    enabled: false,
    capabilities: ["Service Catalog", "Appointment Booking", "Time Slot Management", "Service Assignment"],
    color: "text-sky-600 bg-sky-50 border-sky-200",
  },
  {
    id: "pickup-drop",
    name: "Pickup & Drop Engine",
    icon: Truck,
    description: "Pickup & delivery scheduling, partner assignment & OTP verification",
    enabled: false,
    capabilities: ["Pickup Scheduling", "Delivery Scheduling", "Partner Assignment", "OTP Verification"],
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    id: "dynamic-billing",
    name: "Dynamic Billing Engine",
    icon: Receipt,
    description: "Weight-based pricing, piece-based pricing, overage billing & invoices",
    enabled: false,
    capabilities: ["Weight-Based Pricing", "Piece-Based Pricing", "Overage Billing", "Invoice Generation"],
    color: "text-rose-600 bg-rose-50 border-rose-200",
  },
  {
    id: "approval-workflow",
    name: "Approval Workflow Engine",
    icon: CheckCircle,
    description: "Multi-step approval, customer approval & auto-approval rules",
    enabled: false,
    capabilities: ["Approval Steps", "Customer Approval", "Auto-Approval Rules", "Notification Triggers"],
    color: "text-teal-600 bg-teal-50 border-teal-200",
  },
]

// ─── Business Model Data ────────────────────────────────────────────────────────

interface BusinessModelVariant {
  name: string
  engines: string[]
}

interface BusinessModel {
  id: string
  name: string
  icon: string
  models: BusinessModelVariant[]
  description: string
}

const businessModels: BusinessModel[] = [
  {
    id: "laundry",
    name: "Laundry Business",
    icon: "\u{1F9FA}",
    description: "Wash, dry & fold services with pickup-delivery logistics",
    models: [
      { name: "Subscription Wash Model", engines: ["subscription", "dynamic-billing", "pickup-drop"] },
      { name: "Standard Piece-Based Wash", engines: ["ecommerce", "pickup-drop"] },
      { name: "Weight-Based Wash", engines: ["dynamic-billing", "pickup-drop", "approval-workflow"] },
    ],
  },
  {
    id: "carwash",
    name: "Car & Bike Wash",
    icon: "\u{1F697}",
    description: "Vehicle washing & detailing with service booking",
    models: [
      { name: "Subscription Service Plans", engines: ["subscription"] },
      { name: "Standard Service Booking", engines: ["service-booking", "pickup-drop"] },
      { name: "Ecommerce Accessories", engines: ["ecommerce"] },
    ],
  },
]

// ─── Engine ID → page mapping ──────────────────────────────────────────────────

const enginePageMap: Record<string, string> = {
  ecommerce: "ecommerce-engine",
  subscription: "subscription-engine",
  "service-booking": "service-booking-engine",
  "pickup-drop": "pickup-drop-engine",
  "dynamic-billing": "dynamic-billing-engine",
  "approval-workflow": "approval-workflow-engine",
}

const engineLabelMap: Record<string, string> = {
  ecommerce: "Ecommerce",
  subscription: "Subscription",
  "service-booking": "Service Booking",
  "pickup-drop": "Pickup & Drop",
  "dynamic-billing": "Dynamic Billing",
  "approval-workflow": "Approval Workflow",
}

const engineColorMap: Record<string, string> = {
  ecommerce: "bg-emerald-100 text-emerald-700 border-emerald-200",
  subscription: "bg-violet-100 text-violet-700 border-violet-200",
  "service-booking": "bg-sky-100 text-sky-700 border-sky-200",
  "pickup-drop": "bg-amber-100 text-amber-700 border-amber-200",
  "dynamic-billing": "bg-rose-100 text-rose-700 border-rose-200",
  "approval-workflow": "bg-teal-100 text-teal-700 border-teal-200",
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function EngineHub() {
  const { setBusinessPage } = useAdminStore()
  const [engines, setEngines] = useState<Engine[]>(initialEngines)

  const toggleEngine = (id: string) => {
    setEngines((prev) =>
      prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
    )
  }

  const activeCount = engines.filter((e) => e.enabled).length

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Layers className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Engine Hub</h1>
          </div>
          <p className="text-xs text-muted-foreground pl-10">
            Configure and combine business engines to power your operations
          </p>
        </div>
        <div className="flex items-center gap-2 pl-10 sm:pl-0">
          <Badge variant="outline" className="gap-1.5 text-xs border-emerald-200 bg-emerald-50 text-emerald-700">
            <Zap className="h-3 w-3" />
            {activeCount} of {engines.length} active
          </Badge>
        </div>
      </div>

      {/* ── Engine Grid ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {engines.map((engine) => {
          const Icon = engine.icon
          return (
            <Card
              key={engine.id}
              className={`group relative transition-all duration-200 hover:shadow-md ${
                engine.enabled ? "border-emerald-200/60" : "border-border"
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        engine.enabled
                          ? engine.color
                          : "text-muted-foreground bg-muted/50 border-border"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {engine.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5 line-clamp-2">
                        {engine.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-5 ${
                        engine.enabled
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-border bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {engine.enabled ? "Active" : "Inactive"}
                    </Badge>
                    <Switch
                      checked={engine.enabled}
                      onCheckedChange={() => toggleEngine(engine.id)}
                      className={`${
                        engine.enabled
                          ? "data-[state=checked]:bg-emerald-600"
                          : ""
                      }`}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                {/* Capabilities */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {engine.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                        engine.enabled
                          ? "border-border bg-background text-foreground"
                          : "border-border/50 bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {cap}
                    </span>
                  ))}
                </div>

                {/* Configure button */}
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2"
                    onClick={() =>
                      setBusinessPage(
                        enginePageMap[engine.id] as Parameters<typeof setBusinessPage>[0]
                      )
                    }
                  >
                    <Settings2 className="h-3 w-3" />
                    Configure
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Business Models ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight">Business Models</h2>
          <span className="text-[10px] text-muted-foreground ml-1">
            Pre-configured engine combinations
          </span>
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {businessModels.map((model) => (
            <Card key={model.id} className="group transition-all duration-200 hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl leading-none" role="img" aria-label={model.name}>
                      {model.icon}
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-medium">{model.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {model.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs shrink-0"
                    onClick={() =>
                      setBusinessPage(
                        `${model.id}-configurator` as Parameters<typeof setBusinessPage>[0]
                      )
                    }
                  >
                    <Settings2 className="h-3 w-3" />
                    Configure
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <div className="space-y-2.5">
                  {model.models.map((variant) => (
                    <div
                      key={variant.name}
                      className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{variant.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {variant.engines.length} engine{variant.engines.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {variant.engines.map((engineId) => {
                          const isEngineEnabled = engines.find((e) => e.id === engineId)?.enabled
                          return (
                            <Badge
                              key={engineId}
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-[18px] border ${
                                isEngineEnabled
                                  ? engineColorMap[engineId] || "bg-muted text-muted-foreground border-border"
                                  : "bg-muted/30 text-muted-foreground border-border/50 line-through decoration-muted-foreground/50"
                              }`}
                            >
                              {engineLabelMap[engineId] || engineId}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Quick Info ──────────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Zap className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-medium">Composable Architecture</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Each business can combine multiple engines. A Laundry business may use subscription +
              pickup & drop + dynamic billing. A Car wash may use ecommerce + service booking +
              subscription. Enable only what you need — engines work independently or together.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
