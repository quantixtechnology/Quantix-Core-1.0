"use client"

// Online payment providers for a laundry business. The platform enables providers
// globally; the business enters its OWN keys here (stored encrypted). Secrets are
// never shown back — a saved secret shows as "•••• set" and is only replaced if a
// new value is typed.
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CreditCard, Loader2, Save, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"

interface ProviderCfg { gateway: string; environment: string; isActive: boolean; merchantId: string | null; hasApiKey: boolean; hasSecret: boolean; hasWebhookSecret: boolean }
interface Provider { gateway: string; displayName: string; description: string | null; supportedMethods: string; docsUrl: string | null; config: ProviderCfg | null }

const HINT: Record<string, { api: string; secret: string }> = {
  razorpay: { api: "Key ID (rzp_live_…)", secret: "Key Secret" },
  paytm: { api: "Merchant ID", secret: "Merchant Key" },
  cashfree: { api: "App ID", secret: "Secret Key" },
}

function ProviderRow({ p, businessId, onSaved }: { p: Provider; businessId: string; onSaved: () => void }) {
  const c = p.config
  const [open, setOpen] = useState(false)
  const [env, setEnv] = useState(c?.environment === "LIVE" ? "LIVE" : "SANDBOX")
  const [active, setActive] = useState(!!c?.isActive)
  const [apiKey, setApiKey] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")
  const [saving, setSaving] = useState(false)
  const hint = HINT[p.gateway] || { api: "API Key", secret: "Secret Key" }

  const save = async () => {
    setSaving(true)
    try {
      const j = await fetch(`/api/laundry/payment-gateway`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, gateway: p.gateway, environment: env, isActive: active, apiKey, secretKey, webhookSecret }),
      }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Save failed")
      toast.success(`${p.displayName} saved`)
      setApiKey(""); setSecretKey(""); setWebhookSecret(""); onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  const connected = c?.hasApiKey
  return (
    <div className="rounded-lg border border-slate-200">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 p-3 text-left">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><CreditCard className="h-4 w-4" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700">{p.displayName}</p>
          <p className="text-[11px] text-muted-foreground truncate">{p.description || p.gateway}</p>
        </div>
        {connected
          ? <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {c?.isActive ? "Active" : "Configured"} · {c?.environment === "LIVE" ? "Live" : "Test"}</span>
          : <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">Not configured</span>}
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Environment</Label>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[12px] font-medium">
                {(["SANDBOX", "LIVE"] as const).map((e) => <button key={e} onClick={() => setEnv(e)} className={`flex-1 h-9 ${env === e ? "bg-blue-600 text-white" : "bg-white text-slate-500"}`}>{e === "SANDBOX" ? "Test" : "Live"}</button>)}
              </div>
            </div>
            <label className="flex items-end gap-2 pb-1 cursor-pointer">
              <button role="switch" aria-checked={active} onClick={() => setActive((a) => !a)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${active ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${active ? "translate-x-5" : "translate-x-0.5"}`} /></button>
              <span className="text-xs text-slate-600">Accept payments</span>
            </label>
          </div>
          <div className="space-y-1"><Label className="text-xs">{hint.api}</Label><Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={c?.hasApiKey ? "•••• set — type to replace" : hint.api} className="h-9 font-mono text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">{hint.secret}</Label><Input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder={c?.hasSecret ? "•••• set — type to replace" : hint.secret} className="h-9 font-mono text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">Webhook Secret <span className="text-slate-400 font-normal">(optional)</span></Label><Input type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder={c?.hasWebhookSecret ? "•••• set — type to replace" : "Webhook signing secret"} className="h-9 font-mono text-xs" /></div>
          {p.docsUrl && <a href={p.docsUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline">Where do I find these keys?</a>}
          <div className="flex justify-end"><Button size="sm" onClick={save} disabled={saving} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button></div>
        </div>
      )}
    </div>
  )
}

export function LaundryPaymentProvidersForm({ businessId }: { businessId: string }) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/payment-gateway?businessId=${encodeURIComponent(businessId)}`).then((r) => r.json())
      if (j.success) setProviders(j.data.providers || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }, [businessId])
  useEffect(() => { load() }, [load])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><CreditCard className="h-4 w-4" /></div>
          <div>
            <CardTitle className="text-sm">Online Payment Providers</CardTitle>
            <p className="text-xs text-muted-foreground">Connect your own gateway account (Razorpay, Paytm…) with the keys the provider gave you.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? <div className="py-6 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
          : providers.length === 0 ? <p className="text-sm text-muted-foreground py-2">No online providers are enabled for your account yet. Ask the platform to enable a provider (Razorpay, Paytm…), then configure your keys here.</p>
          : providers.map((p) => <ProviderRow key={p.gateway} p={p} businessId={businessId} onSaved={load} />)}
      </CardContent>
    </Card>
  )
}
