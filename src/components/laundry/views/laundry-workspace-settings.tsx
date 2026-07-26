"use client"

import { useLaundryLicensing } from "@/hooks/use-laundry-licensing"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Truck, Scan, Thermometer, Home, Shield } from "lucide-react"
import { LaundryStorageWidget } from "./laundry-storage-widget"
import { LaundryFinancialSettingsForm } from "./laundry-financial-settings-form"
import { LaundrySlotSettingsForm } from "./laundry-slot-settings-form"
import { LaundryPaymentSettingsForm } from "./laundry-payment-settings-form"
import { LaundryPaymentProvidersForm } from "./laundry-payment-providers-form"

interface WorkspaceSettingsProps {
  businessId: string
}

export function LaundryWorkspaceSettings({ businessId }: WorkspaceSettingsProps) {
  const { isEnabled, loading } = useLaundryLicensing(businessId)

  if (loading) {
    return <div className="py-8 text-center text-gray-400">Loading settings...</div>
  }

  const sections = [
    {
      key: "transportEnabled",
      title: "Transport Setup",
      icon: Truck,
      description: "Configure routes, vehicles, drivers, and transit settings for item transportation between stores and processing centers.",
      visible: isEnabled("transportEnabled"),
    },
    {
      key: "barcodeEnabled",
      title: "Barcode Setup",
      icon: Scan,
      description: "Configure barcode format, tag printing, and scanner preferences for item tracking.",
      visible: isEnabled("barcodeEnabled"),
    },
    {
      key: "ironingEnabled",
      title: "Ironing Setup",
      icon: Thermometer,
      description: "Configure ironing workflow, capacity, and quality standards.",
      visible: isEnabled("ironingEnabled"),
    },
    {
      key: "homeDeliveryEnabled",
      title: "Delivery Setup",
      icon: Home,
      description: "Configure delivery zones, delivery staff, and service level agreements.",
      visible: isEnabled("homeDeliveryEnabled"),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Workspace Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure operational settings for your laundry business. Feature availability depends on your plan.
        </p>
      </div>

      <LaundryStorageWidget businessId={businessId} />

      <LaundryFinancialSettingsForm businessId={businessId} />

      <LaundrySlotSettingsForm businessId={businessId} />

      <LaundryPaymentSettingsForm businessId={businessId} />

      <LaundryPaymentProvidersForm businessId={businessId} />

      <div className="grid gap-4">
        {sections
          .filter(s => s.visible)
          .map(s => {
            const Icon = s.icon
            return (
              <Card key={s.key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{s.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                    <Badge variant="outline" className="ml-auto text-[10px]">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground italic">
                    Configuration options will be available in a future update.
                  </p>
                </CardContent>
              </Card>
            )
          })}

        {sections.filter(s => !s.visible).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-500" />
                Additional Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sections.filter(s => !s.visible).map(s => {
                  const Icon = s.icon
                  return (
                    <div key={s.key} className="flex items-center gap-3 rounded-lg border p-3 opacity-50">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{s.title}</p>
                        <p className="text-xs text-muted-foreground">Contact your platform administrator to enable this feature.</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
