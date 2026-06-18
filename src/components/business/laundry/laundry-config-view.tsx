"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { showSuccess } from "@/lib/toast-utils"
import { useAdminStore } from "@/stores/admin-store"

export function LaundryConfigView() {
  const { currentBusinessType } = useAdminStore()
  const isLaundry = currentBusinessType === "LAUNDRY"

  const [config, setConfig] = useState({
    defaultRatePerKg: "80",
    defaultIncludedKg: "10",
    defaultExtraKgRate: "80",
  })

  const update = (key: string, value: string) =>
    setConfig(prev => ({ ...prev, [key]: value }))

  if (!isLaundry) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Laundry configuration is only available for laundry businesses.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Laundry Configuration</h2>
        <p className="text-sm text-muted-foreground">Configure business-level default pricing for laundry services</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Default Pricing</CardTitle>
          <CardDescription>Defaults applied when creating new laundry services and subscription plans</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Default Rate Per KG</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                <Input
                  type="number"
                  placeholder="80"
                  className="h-8 text-xs pl-5"
                  value={config.defaultRatePerKg}
                  onChange={e => update("defaultRatePerKg", e.target.value)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Regular per-kilogram rate for one-time orders</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Default Included KG</Label>
              <Input
                type="number"
                placeholder="10"
                className="h-8 text-xs"
                value={config.defaultIncludedKg}
                onChange={e => update("defaultIncludedKg", e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Default KG allowance per subscription plan</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Default Extra KG Rate</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                <Input
                  type="number"
                  placeholder="80"
                  className="h-8 text-xs pl-5"
                  value={config.defaultExtraKgRate}
                  onChange={e => update("defaultExtraKgRate", e.target.value)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Rate charged for KG over the included allowance</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button size="sm" onClick={() => showSuccess("Laundry configuration saved")}>
          Save Configuration
        </Button>
      </div>
    </div>
  )
}
