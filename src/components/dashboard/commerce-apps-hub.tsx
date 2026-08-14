"use client"

// Unified Commerce Mobile Apps hub — one place to manage every PWA of a Commerce
// tenant: Customer Website & PWA (<slug>), Store Admin PWA (store.<slug>) and
// Delivery Executive PWA (delivery.<slug>). Reuses the shared AppShareCard (Copy /
// QR / Open) and the product-agnostic provisioning status engine
// (/api/core/mobile-apps/status → getTenantAppStatus). No duplicate distribution
// or provisioning logic — the same pattern as the Laundry Mobile Apps hub.
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AppShareCard } from "@/components/laundry/apps/app-share-card"
import { authFetch } from "@/lib/admin-fetch"
import { useBusinesses } from "@/hooks/use-api"
import { Smartphone, Store as StoreIcon, Bike, Search, Loader2, Factory } from "lucide-react"

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"
interface AppStatus { url: string; sslStatus: string; httpsReachable: boolean }
interface Status { customer: AppStatus; storeAdmin: AppStatus; deliveryExecutive: AppStatus }

export function CommerceAppsHub() {
  const { data: bizData } = useBusinesses({ status: "ACTIVE", limit: 100 }, { staleTime: 60_000 })
  const businesses = useMemo(() => (bizData?.data ?? []) as { id: string; name: string; slug: string; productCode?: string | null }[], [bizData])
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<{ id: string; name: string; slug: string; productCode?: string | null } | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(false)

  const filtered = useMemo(() => businesses.filter((b) => !q.trim() || b.name.toLowerCase().includes(q.toLowerCase()) || b.slug.toLowerCase().includes(q.toLowerCase())), [businesses, q])
  useEffect(() => { if (!selected && businesses.length) setSelected(businesses[0]) }, [businesses, selected])
  useEffect(() => {
    if (!selected) return
    setLoading(true); setStatus(null)
    authFetch(`/api/core/mobile-apps/status?businessId=${selected.id}`)
      .then((r) => r.json()).then((j) => { if (j.success) setStatus(j.data) }).catch(() => {}).finally(() => setLoading(false))
  }, [selected])

  const slug = selected?.slug
  const urls = {
    customer: status?.customer.url || (slug ? `https://${slug}.${SF_BASE}` : ""),
    store: status?.storeAdmin.url || (slug ? `https://store.${slug}.${SF_BASE}` : ""),
    delivery: status?.deliveryExecutive.url || (slug ? `https://delivery.${slug}.${SF_BASE}` : ""),
    // ONE Laundry OS for the whole platform — no tenant in the host, because
    // the same installed app must serve every business the operator is
    // authorized for. The card names the business it is being handed out FOR;
    // the URL grants nothing, and the server decides the tenant after login.
    laundryOs: `https://laundry.${SF_BASE}`,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-50"><Smartphone className="size-5 text-blue-600" /></div>
        <div>
          <h2 className="text-base font-bold">Mobile Apps</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Every PWA for a tenant — Customer, Store Admin and Delivery Executive — with links, QR codes and provisioning status. All served from the same Commerce backend.</p>
        </div>
      </div>

      {/* Tenant picker */}
      <Card><CardContent className="pt-4 space-y-2">
        <div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tenant…" className="h-8 pl-7 text-xs" /></div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {filtered.slice(0, 20).map((b) => (
            <button key={b.id} onClick={() => setSelected(b)} className={`shrink-0 px-3 h-8 rounded-full text-[12px] font-medium border ${selected?.id === b.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}>{b.name}</button>
          ))}
        </div>
      </CardContent></Card>

      {selected && selected.productCode === "LAUNDRY" && (
        <div className="space-y-2">
          <AppShareCard
            title="Laundry OS"
            description="Unified Laundry Operations App — store, processing and administration in one place."
            icon={<Factory className="h-5 w-5" />}
            url={urls.laundryOs}
            note={`Access for ${selected.name}. One installed app for the whole platform: staff sign in and their business, role and screens are resolved server-side — the link itself grants nothing.`}
          />
          <StatusStrip label="Laundry OS host" s={status?.customer} loading={loading} />
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="space-y-2">
            <AppShareCard title="Customer Website & PWA" description="Customers browse, order and pay." icon={<Smartphone className="h-5 w-5" />} url={urls.customer} note="Installable customer storefront + PWA." />
            <StatusStrip label="Customer host" s={status?.customer} loading={loading} />
          </div>
          <div className="space-y-2">
            <AppShareCard title="Store Admin PWA" description="Store staff run daily operations." icon={<StoreIcon className="h-5 w-5" />} url={urls.store} note="store.<tenant> — reuses the Commerce Admin backend, store-scoped." />
            <StatusStrip label="Store Admin host" s={status?.storeAdmin} loading={loading} />
          </div>
          <div className="space-y-2">
            <AppShareCard title="Delivery Executive PWA" description="Executives run assigned deliveries." icon={<Bike className="h-5 w-5" />} url={urls.delivery} note="delivery.<tenant> — the Commerce delivery workflow." />
            <StatusStrip label="Delivery host" s={status?.deliveryExecutive} loading={loading} />
          </div>
        </div>
      )}
    </div>
  )
}

function StatusStrip({ label, s, loading }: { label: string; s?: AppStatus; loading: boolean }) {
  const live = s?.httpsReachable
  const ssl = s?.sslStatus ?? "pending"
  const tone = loading ? "border-slate-200 text-slate-400 bg-slate-50"
    : live ? "border-emerald-300 text-emerald-700 bg-emerald-50"
    : ssl === "failed" ? "border-rose-300 text-rose-700 bg-rose-50"
    : "border-amber-300 text-amber-700 bg-amber-50"
  const text = loading ? "Checking…" : live ? "HTTPS Live · SSL Active" : ssl === "failed" ? "Provision Failed" : ssl === "provisioning" ? "Provisioning…" : "Provision / DNS Pending"
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${tone}`}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : ssl === "failed" ? "bg-rose-500" : "bg-amber-500"}`} />}
      <span className="font-medium">{label}</span><span className="opacity-70">· {text}</span>
    </div>
  )
}
