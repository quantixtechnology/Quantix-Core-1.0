"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calculator, Loader2, Trophy, ArrowDown, CheckCircle2, XCircle } from "lucide-react"
import { SearchableSelect } from "./searchable-select"
import { NONE, typeLabel, inr, type Ref } from "./pricing-shared"

interface Masters { services: Ref[]; garments: Ref[]; cats: Ref[]; stores: Ref[] }

interface SimResult {
  matchedRule: { id: string; name: string | null; pricingType: string; priority: number; unitPrice: number } | null
  line: { unitPrice: number; baseAmount: number; gstPercent: number; gstAmount: number; lineTotal: number }
  quote: { subtotal: number; gstTotal: number; minOrderAdjustment?: number; pickupCharge: number; deliveryCharge: number; expressCharge: number; grandTotal: number }
  trace: { winnerId: string | null; evaluations: { ruleId: string; ruleName: string | null; applies: boolean; score: number; priority: number; isWinner: boolean; reasons: string[] }[] }
}

const opt = (refs: Ref[], k: "name" | "storeName" = "name") =>
  [{ value: NONE, label: "Any" }, ...refs.map((r) => ({ value: r.id, label: (r[k] as string) || r.name || r.storeName || r.id }))]

export function PricingSimulator({ businessId, masters }: { businessId: string; masters: Masters }) {
  const [storeId, setStoreId] = useState(NONE)
  const customerType = NONE // laundry pricing is universal — no customer segmentation
  const [serviceId, setServiceId] = useState(NONE)
  const [categoryId, setCategoryId] = useState(NONE)
  const [garmentId, setGarmentId] = useState(NONE)
  const [quantity, setQuantity] = useState("1")
  const [weightKg, setWeightKg] = useState("0")
  const [weekend, setWeekend] = useState(false)
  const [express, setExpress] = useState(false)
  const [pickup, setPickup] = useState(false)
  const [delivery, setDelivery] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SimResult | null>(null)

  const calculate = async () => {
    setLoading(true); setResult(null)
    try {
      const res = await fetch("/api/laundry/pricing/simulate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          storeId: storeId === NONE ? null : storeId,
          customerType: customerType === NONE ? null : customerType,
          serviceId: serviceId === NONE ? null : serviceId,
          categoryId: categoryId === NONE ? null : categoryId,
          garmentId: garmentId === NONE ? null : garmentId,
          quantity: Number(quantity) || 0, weightKg: Number(weightKg) || 0,
          weekend, express, pickup, delivery,
        }),
      })
      const json = await res.json()
      if (json.success) setResult(json.data)
    } finally { setLoading(false) }
  }

  const winner = result?.trace.evaluations.find((e) => e.isWinner)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Inputs */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" /> Test Inputs</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Store</Label><SearchableSelect value={storeId} onChange={setStoreId} options={opt(masters.stores, "storeName")} /></div>
            <div className="space-y-1"><Label className="text-xs">Service</Label><SearchableSelect value={serviceId} onChange={setServiceId} options={opt(masters.services)} /></div>
            <div className="space-y-1"><Label className="text-xs">Category</Label><SearchableSelect value={categoryId} onChange={setCategoryId} options={opt(masters.cats)} /></div>
            <div className="space-y-1"><Label className="text-xs">Garment</Label><SearchableSelect value={garmentId} onChange={setGarmentId} options={opt(masters.garments)} /></div>
            <div className="space-y-1"><Label className="text-xs">Quantity</Label><Input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">Weight (KG)</Label><Input type="number" min={0} step="any" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="h-9" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {([["Weekend", weekend, setWeekend], ["Express", express, setExpress], ["Pickup", pickup, setPickup], ["Delivery", delivery, setDelivery]] as const).map(([label, val, setter]) => (
              <label key={label} className="flex items-center gap-2 text-sm rounded-md border px-3 py-2">
                <Switch checked={val} onCheckedChange={setter} /> {label}
              </label>
            ))}
          </div>
          <Button onClick={calculate} disabled={loading} className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />} Calculate
          </Button>
        </CardContent>
      </Card>

      {/* Result + Visualizer */}
      <Card>
        <CardHeader><CardTitle className="text-base">Result</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!result ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Enter a scenario and click Calculate. The Billing Resolver computes the bill — nothing is calculated manually.</p>
          ) : !result.matchedRule ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">No active rule matches this scenario. Create or adjust a rule so this combination is priced.</div>
          ) : (
            <>
              <div className="rounded-lg border bg-emerald-50/60 p-3">
                <div className="flex items-center gap-2 text-emerald-800 mb-1"><Trophy className="h-4 w-4" /><span className="text-sm font-semibold">{result.matchedRule.name || typeLabel(result.matchedRule.pricingType)}</span></div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="bg-white">{typeLabel(result.matchedRule.pricingType)}</Badge>
                  <Badge variant="outline" className="bg-white">Priority {result.matchedRule.priority}</Badge>
                  <Badge variant="outline" className="bg-white">Unit {inr(result.matchedRule.unitPrice)}</Badge>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <Row label="Base Service Amount" value={inr(result.quote.subtotal)} />
                <Row label="Subscription Adjustment" value="— (per customer at checkout)" />
                <Row label="Minimum Order Adjustment" value={inr(result.quote.minOrderAdjustment || 0)} />
                <Row label={`GST (${result.line.gstPercent}%)`} value={inr(result.quote.gstTotal)} />
                <Row label="Pickup Charge" value={inr(result.quote.pickupCharge)} />
                <Row label="Delivery Charge" value={inr(result.quote.deliveryCharge)} />
                <Row label="Express Charge" value={inr(result.quote.expressCharge)} />
                <Separator />
                <div className="flex justify-between font-semibold text-base"><span>Final Amount</span><span>{inr(result.quote.grandTotal)}</span></div>
              </div>

              {/* Resolution Visualizer */}
              <Separator />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Why this rule — evaluation order</p>
                <div className="space-y-1">
                  {result.trace.evaluations.slice(0, 8).map((e, i) => (
                    <div key={e.ruleId}>
                      <div className={`rounded-md border px-2 py-1.5 text-xs ${e.isWinner ? "border-emerald-400 bg-emerald-50" : e.applies ? "border-slate-200" : "border-slate-100 bg-slate-50 opacity-70"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-medium">
                            {e.applies ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-slate-400" />}
                            {e.ruleName || "(unnamed rule)"}
                            {e.isWinner && <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">WINNER</Badge>}
                          </span>
                          <span className="text-muted-foreground">spec {e.score} · pri {e.priority}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{e.reasons.join(" · ")}</p>
                      </div>
                      {i < Math.min(result.trace.evaluations.length, 8) - 1 && <div className="flex justify-center py-0.5"><ArrowDown className="h-3 w-3 text-slate-300" /></div>}
                    </div>
                  ))}
                </div>
                {winner && (
                  <p className="mt-2 text-xs text-emerald-800">
                    Winner because it is the most specific applicable rule (specificity {winner.score}){winner.priority ? `, highest priority (${winner.priority})` : ""} and is date-valid.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="tabular-nums">{value}</span></div>
}
