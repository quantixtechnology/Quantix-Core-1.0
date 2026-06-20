"use client"

import { useState, useEffect } from "react"
import { Settings, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

interface LaundryBusiness {
  id: string
  transportEnabled: boolean
  defaultServiceRadius: number | null
  defaultDailyCapacity: number | null
  plan: string
}

export function LaundryBusinessConfig({ businessId }: { businessId: string }) {
  const { toast } = useToast()
  const [business, setBusiness] = useState<LaundryBusiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [transportEnabled, setTransportEnabled] = useState(true)
  const [defaultServiceRadius, setDefaultServiceRadius] = useState("")
  const [defaultDailyCapacity, setDefaultDailyCapacity] = useState("")

  useEffect(() => {
    fetch(`/api/laundry/businesses/${businessId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setBusiness(d)
          setTransportEnabled(d.transportEnabled)
          setDefaultServiceRadius(d.defaultServiceRadius?.toString() || "")
          setDefaultDailyCapacity(d.defaultDailyCapacity?.toString() || "")
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [businessId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/laundry/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transportEnabled,
          defaultServiceRadius,
          defaultDailyCapacity,
        }),
      })
      if (res.ok) {
        toast({ title: "Saved", description: "Configuration updated successfully" })
      } else {
        toast({ title: "Error", description: "Failed to save configuration", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to save configuration", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Business Configuration</h2>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Transport Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Transport Required</p>
              <p className="text-xs text-muted-foreground">
                When disabled, transport stages (STORE_DISPATCH, DISPATCH_TO_STORE) are skipped in the workflow.
              </p>
            </div>
            <Switch checked={transportEnabled} onCheckedChange={setTransportEnabled} />
          </div>
          {!transportEnabled && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              Transport is disabled. Workflow will skip dispatch to/from store stages. Only applicable when processing is done on-site.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Default Values</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Default Service Radius (KM)</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={defaultServiceRadius}
              onChange={e => setDefaultServiceRadius(e.target.value)}
              placeholder="5"
            />
            <p className="text-xs text-muted-foreground">Applied to new stores by default.</p>
          </div>
          <div className="space-y-2">
            <Label>Default Daily Capacity (KG)</Label>
            <Input
              type="number"
              min="0"
              step="10"
              value={defaultDailyCapacity}
              onChange={e => setDefaultDailyCapacity(e.target.value)}
              placeholder="500"
            />
            <p className="text-xs text-muted-foreground">Applied to new stores by default.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Plan Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Current Plan: <span className="font-semibold">{business?.plan || "—"}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {business?.plan === "PRO"
              ? "PRO plan: All workflow stages available."
              : "STANDARD plan: Basic workflow stages available. Upgrade to PRO for full workflow."}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
