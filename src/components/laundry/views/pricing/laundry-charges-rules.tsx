"use client"

// Charges & Rules — TWO simple business rules only (no wizard, no generic charge
// rules): Minimum Order (by order type) + Express Delivery. Stored on
// LaundryOperationalConfig; read by the single Billing Resolver.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, Save, IndianRupee, Zap } from "lucide-react"
import { toast } from "sonner"

interface Config {
  walkInMinOrder: number; pickupMinOrder: number; deliveryMinOrder: number
  expressEnabled: boolean; expressTurnaroundHours: number | null
  expressChargeType: "FIXED" | "PERCENT"; expressChargeValue: number
}
const EMPTY: Config = { walkInMinOrder: 0, pickupMinOrder: 0, deliveryMinOrder: 0, expressEnabled: false, expressTurnaroundHours: 12, expressChargeType: "FIXED", expressChargeValue: 0 }

export function LaundryChargesRules({ businessId }: { businessId: string }) {
  const [cfg, setCfg] = useState<Config>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setCfg((c) => ({ ...c, [k]: v }))
  const numField = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, (Math.max(0, Number(e.target.value) || 0)) as never)

  const load = useCallback(() => {
    if (!businessId) return
    setLoading(true)
    fetch(`/api/laundry/charges-config?businessId=${businessId}`).then((r) => r.json())
      .then((j) => { if (j.success) setCfg({ ...EMPTY, ...j.data }) }).catch(() => {}).finally(() => setLoading(false))
  }, [businessId])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/laundry/charges-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, ...cfg }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
      toast.success("Charges & Rules saved")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Minimum Order ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><IndianRupee className="h-4 w-4 text-blue-600" /> Minimum Order</CardTitle>
            <CardDescription className="text-xs">A minimum <b>bill value</b> per order type — if the item subtotal is lower, the order is topped up to this amount. Never changes a garment/service price. 0 = no minimum.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[1fr_120px] items-center gap-3"><Label className="text-xs">Walk-In Minimum Order</Label><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span><Input type="number" min={0} className="pl-6 h-9" value={cfg.walkInMinOrder} onChange={numField("walkInMinOrder")} /></div></div>
            <div className="grid grid-cols-[1fr_120px] items-center gap-3"><Label className="text-xs">Pickup Minimum Order</Label><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span><Input type="number" min={0} className="pl-6 h-9" value={cfg.pickupMinOrder} onChange={numField("pickupMinOrder")} /></div></div>
            <div className="grid grid-cols-[1fr_120px] items-center gap-3"><Label className="text-xs">Delivery Minimum Order</Label><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span><Input type="number" min={0} className="pl-6 h-9" value={cfg.deliveryMinOrder} onChange={numField("deliveryMinOrder")} /></div></div>
            <p className="text-[10px] text-slate-400">An order that is both Pickup &amp; Delivery uses the <b>higher</b> of the two minimums (never the sum).</p>
          </CardContent>
        </Card>

        {/* ── Express Delivery ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Express Delivery</CardTitle>
            <CardDescription className="text-xs">Optional faster turnaround with a charge. Normal turnaround comes from each Service. If disabled, Express is hidden in New Order &amp; customer ordering.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><Switch checked={cfg.expressEnabled} onCheckedChange={(v) => set("expressEnabled", v)} className="data-[state=checked]:bg-amber-500" /> Enable Express Delivery</label>
            {cfg.expressEnabled && (<>
              <div className="grid grid-cols-[1fr_120px] items-center gap-3"><Label className="text-xs">Express Turnaround (hours)</Label><Input type="number" min={1} className="h-9" value={cfg.expressTurnaroundHours ?? ""} onChange={(e) => set("expressTurnaroundHours", e.target.value === "" ? null : Math.max(1, Number(e.target.value) || 0))} placeholder="12" /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">Express Charge Type</Label>
                <div className="flex gap-2">
                  {(["FIXED", "PERCENT"] as const).map((t) => <button key={t} type="button" onClick={() => set("expressChargeType", t)} className={`rounded-lg border px-3 h-9 text-xs font-medium ${cfg.expressChargeType === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{t === "FIXED" ? "Fixed Amount ₹" : "Percentage %"}</button>)}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_120px] items-center gap-3"><Label className="text-xs">Express Charge Value</Label><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">{cfg.expressChargeType === "PERCENT" ? "%" : "₹"}</span><Input type="number" min={0} className="pl-6 h-9" value={cfg.expressChargeValue} onChange={numField("expressChargeValue")} /></div></div>
            </>)}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Charges &amp; Rules</Button>
      </div>
    </div>
  )
}
