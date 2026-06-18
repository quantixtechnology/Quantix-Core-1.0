"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Loader2, Zap } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { PageHeader } from "@/components/admin/shared/page-header"

interface Flag {
  id: string
  key: string
  enabled: boolean
  value: string
  note: string | null
}

const FLAG_META: Record<string, { label: string; description: string; category: string }> = {
  pos_enabled:            { label: "POS Billing",        description: "Enable point-of-sale billing terminal",              category: "Operations" },
  delivery_enabled:       { label: "Delivery",           description: "Enable delivery partner assignment and tracking",    category: "Operations" },
  online_orders_enabled:  { label: "Online Orders",      description: "Accept orders through the customer app / website",   category: "Sales" },
  promo_codes_enabled:    { label: "Promo Codes",        description: "Allow customers to apply discount codes at checkout", category: "Sales" },
  loyalty_enabled:        { label: "Loyalty Program",    description: "Earn and redeem loyalty points on orders",           category: "Marketing" },
  subscription_enabled:   { label: "Subscriptions",      description: "Offer recurring subscription plans to customers",    category: "Marketing" },
  // Laundry-specific flags
  laundry_subscription_enabled: { label: "Laundry Subscription", description: "Monthly subscription plans with KG-based billing",              category: "Laundry" },
  barcode_tracking_enabled:     { label: "Barcode Tracking",     description: "Scan barcodes to track garments through processing",            category: "Laundry" },
  garment_photos_enabled:       { label: "Garment Photos",       description: "Capture garment photos at check-in for damage records",        category: "Laundry" },
  qc_workflow_enabled:          { label: "QC Workflow",          description: "Quality check step before marking items complete",              category: "Laundry" },
  call_queue_enabled:           { label: "Call Queue",           description: "Queue system for customer pickup notifications",               category: "Laundry" },
  whatsapp_updates_enabled:     { label: "WhatsApp Updates",     description: "Send order status updates via WhatsApp",                       category: "Laundry" },
  customer_membership_enabled:  { label: "Customer Membership",  description: "Loyalty membership with points and rewards",                   category: "Laundry" },
}

export function FeatureFlagsView() {
  const { currentBusinessId } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""

  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/feature-flags`, {
        headers: { "x-business-id": businessId },
      })
      const json = await res.json()
      if (json.success) setFlags(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { load() }, [load])

  const toggle = async (flag: Flag) => {
    setToggling(flag.key)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/feature-flags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-business-id": businessId },
        body: JSON.stringify({ key: flag.key, enabled: !flag.enabled }),
      })
      if (res.ok) {
        setFlags(prev => prev.map(f => f.key === flag.key ? { ...f, enabled: !f.enabled } : f))
      }
    } finally {
      setToggling(null)
    }
  }

  const grouped = flags.reduce<Record<string, Flag[]>>((acc, f) => {
    const cat = FLAG_META[f.key]?.category ?? "Other"
    acc[cat] = [...(acc[cat] ?? []), f]
    return acc
  }, {})

  const enabledCount = flags.filter(f => f.enabled).length

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Flags"
        description="Enable or disable platform features for this business"
        icon={Zap}
      />

      <div className="flex items-center gap-3">
        <Badge variant="outline" className="gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {enabledCount} enabled
        </Badge>
        <Badge variant="outline" className="gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          {flags.length - enabledCount} disabled
        </Badge>
      </div>

      {Object.entries(grouped).map(([category, categoryFlags]) => (
        <Card key={category} className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            <div className="divide-y">
              {categoryFlags.map(flag => {
                const meta = FLAG_META[flag.key]
                return (
                  <div key={flag.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{meta?.label ?? flag.key}</p>
                        <Badge
                          variant={flag.enabled ? "default" : "secondary"}
                          className={`text-[10px] h-4 px-1.5 ${flag.enabled ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}`}
                        >
                          {flag.enabled ? "ON" : "OFF"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {meta?.description ?? `Flag key: ${flag.key}`}
                      </p>
                    </div>
                    {toggling === flag.key
                      ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      : <Switch checked={flag.enabled} onCheckedChange={() => toggle(flag)} />
                    }
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {flags.length === 0 && (
        <Card className="shadow-none">
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">No feature flags configured</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
