"use client"

// Business Admin → Mobile Apps. ONE place for every PWA belonging to THIS tenant:
// Customer Website & PWA (<slug>), Store Admin PWA (store.<slug>) and Delivery
// Executive PWA (delivery.<slug>). Reuses the shared AppShareCard (Open / Copy /
// QR) and the product-agnostic provisioning status engine (/api/core/mobile-apps/
// status → getTenantAppStatus). No duplicate distribution or provisioning logic.
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { AppShareCard } from "@/components/laundry/apps/app-share-card"
import { authFetch } from "@/lib/admin-fetch"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { Smartphone, Store as StoreIcon, Bike, Loader2, ShieldCheck, ShieldAlert, ExternalLink } from "lucide-react"

interface AppStatus { url: string; sslStatus: string; httpsReachable: boolean }
interface Status { customer: AppStatus; storeAdmin: AppStatus; deliveryExecutive: AppStatus }

export function AppsView() {
  const { currentBusinessId } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  // The tenant slug for QR filenames, taken from the customer host we already
  // loaded — no extra request, and it is the same slug the URLs are built from.
  const slug = (status?.customer.url || "").replace(/^https?:\/\//, "").split(".")[0] || ""


  const load = useCallback(() => {
    if (!businessId) { setLoading(false); return }
    setLoading(true)
    authFetch(`/api/core/mobile-apps/status?businessId=${businessId}`)
      .then((r) => r.json()).then((j) => { if (j.success) setStatus(j.data) }).catch(() => {}).finally(() => setLoading(false))
  }, [businessId])
  useEffect(() => { load() }, [load])

  const cards = [
    { key: "customer", qrName: "customer pwa", title: "Customer Website & PWA", description: "Customers browse, order and pay.", icon: <Smartphone className="h-5 w-5" />, s: status?.customer, note: "Your dedicated branded storefront + installable PWA." },
    { key: "store", qrName: "store admin pwa", title: "Store Admin PWA", description: "Store staff run daily operations.", icon: <StoreIcon className="h-5 w-5" />, s: status?.storeAdmin, note: "store.<tenant> — reuses this Admin's backend, store-scoped." },
    { key: "delivery", qrName: "delivery executive pwa", title: "Delivery Executive PWA", description: "Executives run assigned deliveries.", icon: <Bike className="h-5 w-5" />, s: status?.deliveryExecutive, note: "delivery.<tenant> — the delivery workflow." },
  ]

  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-50"><Smartphone className="size-5 text-blue-600" /></div>
        <div>
          <h2 className="text-base font-bold">Mobile Apps</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Every app for your business — Customer, Store Admin and Delivery Executive — with links, QR codes and provisioning status. All served from the same backend.</p>
        </div>
      </div>

      {loading && !status ? (
        <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-blue-600" /></div>
      ) : !businessId ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Select a business to view its apps.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {cards.map((c) => (
            <div key={c.key} className="space-y-2">
              {/* qrDialog switches the card from the inline preview to the
                  print dialog — Download PNG, Print QR, Copy, Share. Without
                  it the QR is only ever visible on screen. */}
              <AppShareCard
                title={c.title} description={c.description} url={c.s?.url || ""} icon={c.icon} note={c.note}
                qrDialog={{ businessName: slug || "business", appName: c.qrName }}
                downloadFileBase={`${slug || "business"}-${c.qrName.replace(/ /g, "-")}-qr`}
              />
              <StatusStrip s={c.s} loading={loading} url={c.s?.url} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusStrip({ s, loading, url }: { s?: AppStatus; loading: boolean; url?: string }) {
  const live = s?.httpsReachable
  const ssl = s?.sslStatus ?? "pending"
  const tone = loading ? "border-slate-200 text-slate-500 bg-slate-50"
    : live ? "border-emerald-300 text-emerald-700 bg-emerald-50"
    : ssl === "failed" ? "border-rose-300 text-rose-700 bg-rose-50"
    : "border-amber-300 text-amber-700 bg-amber-50"
  const text = loading ? "Checking…" : live ? "HTTPS Live · SSL Active · Healthy" : ssl === "failed" ? "Provision Failed" : ssl === "provisioning" ? "Provisioning…" : "Provision · DNS · SSL Pending"
  const Icon = live ? ShieldCheck : ShieldAlert
  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${tone}`}>
      <span className="flex items-center gap-1.5">{loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}<span className="font-medium">{text}</span></span>
      {url && <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 opacity-80 hover:opacity-100"><ExternalLink className="h-3 w-3" />Install</a>}
    </div>
  )
}
