"use client"

// Delivery & Pickup Time-Slot settings. One config per business drives EVERY
// slot picker (New Order, Ready for Delivery, Storefront) via src/lib/laundry-slots.
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { generateSlots, SLOT_DURATION_OPTIONS, DEFAULT_PICKUP_SLOT, DEFAULT_DELIVERY_SLOT, type SlotConfig } from "@/lib/laundry-slots"

const durationLabel = (m: number) => (m % 60 === 0 ? `${m / 60} hr${m > 60 ? "s" : ""}` : `${m} min`)

function SlotBlock({ title, cfg, onChange }: { title: string; cfg: SlotConfig; onChange: (c: SlotConfig) => void }) {
  const slots = generateSlots(cfg)
  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1"><Label className="text-xs">Start</Label><Input type="time" value={cfg.start} onChange={(e) => onChange({ ...cfg, start: e.target.value })} className="h-9" /></div>
        <div className="space-y-1"><Label className="text-xs">End</Label><Input type="time" value={cfg.end} onChange={(e) => onChange({ ...cfg, end: e.target.value })} className="h-9" /></div>
        <div className="space-y-1">
          <Label className="text-xs">Slot length</Label>
          <Select value={String(cfg.durationMin)} onValueChange={(v) => onChange({ ...cfg, durationMin: Number(v) })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{SLOT_DURATION_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{durationLabel(m)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <p className="text-[11px] text-slate-400 mb-1">{slots.length} slot{slots.length === 1 ? "" : "s"} generated</p>
        {slots.length === 0 ? <p className="text-xs text-rose-500">End must be after start with room for at least one slot.</p> : (
          <div className="flex flex-wrap gap-1.5">{slots.map((s) => <span key={s} className="text-[11px] font-mono rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">{s}</span>)}</div>
        )}
      </div>
    </div>
  )
}

export function LaundrySlotSettingsForm({ businessId }: { businessId: string }) {
  const [pickup, setPickup] = useState<SlotConfig>(DEFAULT_PICKUP_SLOT)
  const [delivery, setDelivery] = useState<SlotConfig>(DEFAULT_DELIVERY_SLOT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/slot-config?businessId=${encodeURIComponent(businessId)}`).then((r) => r.json())
      if (j.success) { setPickup(j.data.pickup); setDelivery(j.data.delivery) }
    } catch { /* keep defaults */ } finally { setLoading(false) }
  }, [businessId])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      const j = await fetch(`/api/laundry/slot-config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, pickup, delivery }) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Save failed")
      setPickup(j.data.pickup); setDelivery(j.data.delivery)
      toast.success("Time slots saved — applied to New Order, Ready for Delivery and the storefront.")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><Clock className="h-4 w-4" /></div>
          <div>
            <CardTitle className="text-sm">Pickup & Delivery Time Slots</CardTitle>
            <p className="text-xs text-muted-foreground">Set the booking window and slot length. Used everywhere pickup/delivery is scheduled.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <div className="py-6 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : (
          <>
            <SlotBlock title="Pickup window" cfg={pickup} onChange={setPickup} />
            <SlotBlock title="Delivery window" cfg={delivery} onChange={setDelivery} />
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Slots</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
