"use client"

// Mobile Apps hub (Business Management) — one place for the owner to find, share
// and install every white-label app: the Customer App and the dedicated
// Executive Pickup & Delivery App. Both public apps are provisioned automatically
// by the shared engine (nginx vhost + SSL); this screen shows provisioning +
// HTTPS status for each and offers Retry ONLY if provisioning failed.
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AppShareCard } from "@/components/laundry/apps/app-share-card"
import { Smartphone, Bike, MapPin, RefreshCw, ShieldCheck, ShieldAlert, Loader2, Store } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface AppStatus { url: string; sslStatus: string; httpsReachable: boolean }
interface Provisioning { customer: AppStatus; executive: AppStatus }

export function LaundryMobileApps() {
  const { currentBusinessId } = useAuthStore()
  const [prov, setProv] = useState<Provisioning | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [origin, setOrigin] = useState("")
  useEffect(() => { setOrigin(window.location.origin) }, [])

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    try {
      const j = await fetch(`/api/laundry/app-provisioning?businessId=${currentBusinessId}`).then((r) => r.json())
      if (j.success) setProv(j.data)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])
  // Poll while anything is still provisioning so status updates live.
  useEffect(() => {
    const busy = prov && [prov.customer.sslStatus, prov.executive.sslStatus].some((s) => s === "provisioning")
    if (!busy) return
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [prov, load])

  const retry = async () => {
    setRetrying(true)
    try {
      const res = await fetch("/api/laundry/app-provisioning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Provisioning failed")
      toast.success("Provisioning started"); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Provisioning failed") } finally { setRetrying(false) }
  }

  const customerUrl = prov?.customer.url || (origin ? `${origin}/laundry/app` : "")
  const executiveUrl = prov?.executive.url || (origin ? `${origin}/laundry/executive` : "")
  const storeAdminUrl = origin ? `${origin}/laundry/store` : ""
  const anyFailed = prov && [prov.customer.sslStatus, prov.executive.sslStatus].some((s) => s === "failed")

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><Smartphone className="h-5 w-5 text-blue-600" /> Mobile Apps</h2>
          <p className="text-sm text-muted-foreground">Your dedicated branded apps — provisioned automatically (host, SSL, manifest, branding). Share the links or QR codes to install.</p>
        </div>
        {anyFailed && (
          <Button size="sm" variant="outline" className="gap-1 text-rose-600 border-rose-200 hover:bg-rose-50" disabled={retrying} onClick={retry}>
            {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Retry Provisioning
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="space-y-2">
          <AppShareCard title="Customer App" description="Customers book pickups, track orders and pay." icon={<Smartphone className="h-5 w-5" />} url={customerUrl} note="Your dedicated branded customer website & PWA." />
          <StatusStrip label="Customer host" status={prov?.customer} loading={loading} />
        </div>
        <div className="space-y-2">
          <AppShareCard title="Executive Pickup & Delivery App" description="Field executives run assigned pickups and deliveries." icon={<Bike className="h-5 w-5" />} url={executiveUrl} note="Dedicated per-tenant host — only active Delivery Executives sign in; the business is set by the URL." />
          <StatusStrip label="Executive host" status={prov?.executive} loading={loading} />
        </div>
        <div className="space-y-2">
          <AppShareCard title="Store Admin App" description="Store staff run daily operations from their phone." icon={<Store className="h-5 w-5" />} url={storeAdminUrl} note="Only Store Managers, Supervisors and Counter Staff sign in — each sees only their own store." />
        </div>
        <Card className="rounded-xl border-slate-200">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 grid place-items-center shrink-0"><MapPin className="h-5 w-5" /></div>
              <div>
                <p className="font-semibold text-slate-800">Delivery Tracking Links</p>
                <p className="text-xs text-slate-500">Live per-order tracking for customers.</p>
              </div>
            </div>
            <p className="text-sm text-slate-500">A tracking link is generated per order and shared from the order&apos;s detail screen (and automatically in customer notifications).</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatusStrip({ label, status, loading }: { label: string; status?: AppStatus; loading: boolean }) {
  const ssl = status?.sslStatus ?? (loading ? "loading" : "pending")
  const sslMap: Record<string, { cls: string; text: string }> = {
    active: { cls: "border-emerald-300 text-emerald-700 bg-emerald-50", text: "SSL Active" },
    provisioning: { cls: "border-amber-300 text-amber-700 bg-amber-50", text: "Provisioning…" },
    pending: { cls: "border-slate-300 text-slate-500 bg-slate-50", text: "Pending DNS" },
    failed: { cls: "border-rose-300 text-rose-700 bg-rose-50", text: "Failed" },
    loading: { cls: "border-slate-200 text-slate-400", text: "Checking…" },
  }
  const s = sslMap[ssl] || sslMap.pending
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-[11px] text-slate-400">{label}:</span>
      <Badge variant="outline" className={`text-[10px] gap-1 ${s.cls}`}>{ssl === "provisioning" && <Loader2 className="h-3 w-3 animate-spin" />}{s.text}</Badge>
      {status && (status.httpsReachable
        ? <Badge variant="outline" className="text-[10px] gap-1 border-emerald-300 text-emerald-700 bg-emerald-50"><ShieldCheck className="h-3 w-3" /> HTTPS Live</Badge>
        : <Badge variant="outline" className="text-[10px] gap-1 border-slate-300 text-slate-400"><ShieldAlert className="h-3 w-3" /> HTTPS not reachable</Badge>)}
    </div>
  )
}
