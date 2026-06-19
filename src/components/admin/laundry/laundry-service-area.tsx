"use client"

import { useState, useEffect } from "react"
import { MapPin, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Store = {
  id: string
  storeName: string
  storeType: string
  latitude: number | null
  longitude: number | null
  serviceRadiusKm: number | null
}

export function LaundryServiceArea({ businessId }: { businessId: string }) {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [radii, setRadii] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/laundry/businesses/${businessId}/stores`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Store[]) => {
        setStores(data)
        const r: Record<string, string> = {}
        data.forEach(s => { r[s.id] = s.serviceRadiusKm?.toString() || "" })
        setRadii(r)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [businessId])

  const updateRadius = async (storeId: string) => {
    setSaving(storeId)
    try {
      await fetch(`/api/laundry/stores/${storeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceRadiusKm: radii[storeId] }),
      })
    } catch (err) { console.error(err) }
    finally { setSaving(null) }
  }

  if (loading) return <div className="py-4 text-center text-gray-400">Loading...</div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Configure delivery radius for each store. This determines the area where orders can be delivered.</p>

      {stores.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">No stores configured. Add a store first.</p>
      ) : (
        <div className="grid gap-3">
          {stores.map(store => (
            <Card key={store.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <CardTitle className="text-sm font-medium">{store.storeName}</CardTitle>
                    <Badge variant="outline" className="text-xs">{store.storeType === "PROCESSING_CENTER" ? "Processing Center" : "Store"}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">Latitude</Label>
                    <p className="text-sm font-mono">{store.latitude ?? "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Longitude</Label>
                    <p className="text-sm font-mono">{store.longitude ?? "—"}</p>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Service Radius (KM)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={radii[store.id] || ""}
                        onChange={e => setRadii(p => ({ ...p, [store.id]: e.target.value }))}
                        placeholder="5"
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => updateRadius(store.id)} disabled={saving === store.id}>
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
