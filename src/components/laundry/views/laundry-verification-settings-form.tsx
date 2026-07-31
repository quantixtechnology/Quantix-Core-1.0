"use client"

// Workflow Settings → Pickup & Delivery Verification. How the team confirms the
// customer before a Pickup / Delivery can be completed: Customer Name (identity
// confirmed in person) or OTP (customer shares the auto-generated code). The
// method is snapshotted onto orders, so changing it never affects orders already
// in progress; enforcement is server-side on every completion path.
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Loader2, Save } from "lucide-react"
import { toast } from "sonner"

type Method = "OTP" | "NAME"

function MethodRadio({ name, value, onChange }: { name: string; value: Method; onChange: (v: Method) => void }) {
  const options: { value: Method; label: string; hint: string }[] = [
    { value: "OTP", label: "OTP", hint: "Customer shares a 4-digit code" },
    { value: "NAME", label: "Customer Name", hint: "Executive confirms identity in person" },
  ]
  return (
    <div className="flex gap-3">
      {options.map((o) => (
        <label key={o.value} className={`flex-1 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${value === o.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="accent-blue-600 mt-0.5" />
          <span>
            <span className="block font-medium">{o.label}</span>
            <span className="block text-[11px] font-normal text-slate-400">{o.hint}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

export function LaundryVerificationSettingsForm({ businessId }: { businessId: string }) {
  const [pickup, setPickup] = useState<Method>("OTP")
  const [delivery, setDelivery] = useState<Method>("OTP")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/verification-settings?businessId=${encodeURIComponent(businessId)}`).then((r) => r.json())
      if (j.success) {
        setPickup(j.data.pickupVerificationMethod || "OTP")
        setDelivery(j.data.deliveryVerificationMethod || "OTP")
      }
    } catch { /* keep defaults */ } finally { setLoading(false) }
  }, [businessId])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      const j = await fetch("/api/laundry/verification-settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, pickupVerificationMethod: pickup, deliveryVerificationMethod: delivery }),
      }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Save failed")
      setPickup(j.data.pickupVerificationMethod); setDelivery(j.data.deliveryVerificationMethod)
      toast.success("Verification settings saved")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><ShieldCheck className="h-4 w-4" /></div>
          <div>
            <CardTitle className="text-sm">Pickup & Delivery Verification</CardTitle>
            <p className="text-xs text-muted-foreground">How the team confirms the customer before a pickup or delivery is completed.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <div className="py-6 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : (
          <>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Pickup verification</p>
              <MethodRadio name="pickup-verification" value={pickup} onChange={setPickup} />
              <p className="text-[11px] text-slate-400 mt-1.5">Pickup cannot be completed until the customer is verified this way.</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Delivery verification</p>
              <MethodRadio name="delivery-verification" value={delivery} onChange={setDelivery} />
              <p className="text-[11px] text-slate-400 mt-1.5">Delivery cannot be completed until the customer is verified this way.</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Verification Settings</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
