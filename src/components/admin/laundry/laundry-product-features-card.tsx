"use client"

// Optional Laundry OS product features (per-tenant entitlements) — shared by
// the Business Management wizard and the Laundry Businesses licensing view.
// Backed by LaundryBusinessFeature (featureKey + enabled); the API accepts a
// platform Business id or LaundryBusiness id. CRM is enforced server-side by
// every CRM API — this toggle is the Quantix-controlled switch.

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Settings2 } from "lucide-react"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"

const PRODUCT_FEATURES: { key: string; label: string; desc: string }[] = [
  { key: "CRM", label: "CRM", desc: "Sales CRM inside Laundry OS: Leads → Opportunities → configurable Sales Stages → Won/Lost. Shows a CRM section in the tenant's workspace sidebar." },
]

export function LaundryProductFeaturesCard({ businessId }: { businessId: string }) {
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  // Self-hides for businesses without a Laundry workspace (features API → 404),
  // so callers can render it unconditionally.
  const [isLaundry, setIsLaundry] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch(`/api/laundry/businesses/${businessId}/features`)
      .then((r) => {
        if (!r.ok) { setIsLaundry(false); return [] }
        setIsLaundry(true)
        return r.json()
      })
      .then((rows: { featureKey: string; enabled: boolean }[]) => {
        const map: Record<string, boolean> = {}
        for (const row of rows) map[row.featureKey] = row.enabled
        setFeatures(map)
      })
      .catch(() => setIsLaundry(false))
  }, [businessId])

  if (!isLaundry) return null

  const toggle = async (key: string, enabled: boolean) => {
    setSaving(true)
    try {
      const actor = useAuthStore.getState().user
      const res = await fetch(`/api/laundry/businesses/${businessId}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: [{ featureKey: key, enabled }], actorId: actor?.id, actorName: actor?.name }),
      })
      if (!res.ok) throw new Error()
      setFeatures((f) => ({ ...f, [key]: enabled }))
      toast({ title: "Updated", description: `${key} ${enabled ? "enabled" : "disabled"} for this business` })
    } catch {
      toast({ title: "Error", description: "Failed to update feature", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Product Features</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Optional Laundry OS capabilities for this tenant. Quantix-controlled and enforced server-side.</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {PRODUCT_FEATURES.map(f => {
          const enabled = !!features[f.key]
          return (
            <div key={f.key} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{f.label}</span>
                  {enabled ? (
                    <Badge className="bg-green-100 text-green-700 text-[10px] h-4 px-1.5 shrink-0">Enabled</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground shrink-0">Disabled</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
              <Switch checked={enabled} onCheckedChange={(v) => toggle(f.key, v)} disabled={saving} className="shrink-0 ml-3" />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
