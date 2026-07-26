"use client"

// Laundry payment settings. Today: the COD (Cash on Delivery) switch — COD is
// available everywhere (storefront, counter, delivery) unless switched off here.
// Online gateways (Razorpay/Paytm/…) are enabled by the platform + configured in
// Payment settings; this card is the laundry-side home for the COD switch.
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Wallet, Banknote } from "lucide-react"
import { toast } from "sonner"

export function LaundryPaymentSettingsForm({ businessId }: { businessId: string }) {
  const [codEnabled, setCodEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/payment-settings?businessId=${encodeURIComponent(businessId)}`).then((r) => r.json())
      if (j.success) setCodEnabled(!!j.data.codEnabled)
    } catch { /* keep default */ } finally { setLoading(false) }
  }, [businessId])
  useEffect(() => { load() }, [load])

  const toggleCod = async (next: boolean) => {
    setSaving(true)
    setCodEnabled(next) // optimistic
    try {
      const j = await fetch(`/api/laundry/payment-settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, codEnabled: next }) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Save failed")
      setCodEnabled(!!j.data.codEnabled)
      toast.success(`Cash on Delivery ${next ? "enabled" : "disabled"}`)
    } catch (e) { setCodEnabled(!next); toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><Wallet className="h-4 w-4" /></div>
          <div>
            <CardTitle className="text-sm">Payments</CardTitle>
            <p className="text-xs text-muted-foreground">Control which payment options customers see.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <div className="py-4 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-slate-700">Cash on Delivery (COD)</p>
                <p className="text-xs text-muted-foreground">Let customers pay in cash at pickup / delivery. Turn off if you only accept prepaid.</p>
              </div>
            </div>
            <button
              role="switch" aria-checked={codEnabled} disabled={saving}
              onClick={() => toggleCod(!codEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${codEnabled ? "bg-emerald-500" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${codEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        )}
        <p className="text-[11px] text-slate-400">Online payment providers (Razorpay, Paytm…) are enabled for your business by the platform, then configured with your provider keys. COD always remains unless you switch it off above.</p>
      </CardContent>
    </Card>
  )
}
