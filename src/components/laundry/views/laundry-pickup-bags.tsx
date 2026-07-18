"use client"

// Assign Bags (Pickup-First) — reusable-bag pickup + receive. The pickup
// executive scans an AVAILABLE reusable bag and assigns it to a service (one
// bag = one service). No QR is generated; the bag's permanent QR is reused.
// Store staff scan the same bag to mark it Received. Uses /api/laundry/bags.
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Package, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import { BagScanButton } from "@/components/laundry/bag-scanner"

interface Bag { id: string; bagNumber: string; status: string; currentOrderId: string | null; currentServiceId: string | null; currentServiceName: string | null; currentCustomerName: string | null; currentOrderNumber: string | null }
interface OrderRow { id: string; orderNumber: string; customer?: { name?: string | null } | null; customerName?: string | null; createdAt: string; services?: { serviceId: string | null; serviceName: string }[] }

export function LaundryPickupBags() {
  const { currentBusinessId } = useAuthStore()
  const [tab, setTab] = useState<"assign" | "receive">("assign")
  return (
    <div className="px-4 lg:px-6 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Package className="h-5 w-5 text-blue-600" /> Assign Bags</h1>
        <p className="text-sm text-slate-500">Scan an available reusable bag and assign it to a service — one bag per service. No QR printing.</p>
      </div>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {([["assign", "Assign Bags"], ["receive", "Receive At Store"]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-md px-4 py-1.5 text-sm font-semibold ${tab === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{lbl}</button>
        ))}
      </div>
      {tab === "assign" ? <AssignTab businessId={currentBusinessId} /> : <ReceiveTab businessId={currentBusinessId} />}
    </div>
  )
}

function AssignTab({ businessId }: { businessId: string | null }) {
  const [search, setSearch] = useState("")
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bagsByOrder, setBagsByOrder] = useState<Record<string, Bag[]>>({})

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const p = new URLSearchParams({ businessId, limit: "20" })
      if (search.trim()) p.set("search", search.trim())
      const j = await fetch(`/api/laundry/orders?${p}`).then((r) => r.json())
      setOrders(j.data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }, [businessId, search])
  useEffect(() => { load() }, [load])

  const loadBags = useCallback(async (o: OrderRow) => {
    const j = await fetch(`/api/laundry/bags?businessId=${businessId}&search=${encodeURIComponent(o.orderNumber)}`).then((r) => r.json())
    const bags: Bag[] = (j.data || []).filter((b: Bag) => b.currentOrderId === o.id)
    setBagsByOrder((m) => ({ ...m, [o.id]: bags }))
  }, [businessId])
  useEffect(() => { orders.forEach((o) => loadBags(o)) }, [orders, loadBags])

  // Scan → validate → assign to this service → reload so the NEXT unassigned
  // service becomes the target automatically. Errors allow immediate rescan.
  const assign = async (o: OrderRow, service: { serviceId: string | null; serviceName: string }, code: string) => {
    try {
      const j = await fetch("/api/laundry/bags/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, code, orderId: o.id, serviceId: service.serviceId, serviceName: service.serviceName }) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Bag not found.")
      toast.success(`${j.data.bagNumber} → ${service.serviceName}`)
      await loadBags(o)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Bag not found.") }
  }

  return (
    <>
      <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order no, customer, mobile…" className="pl-9 h-10" /></div>
      {loading ? <div className="py-12 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : orders.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">No orders found.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const bags = bagsByOrder[o.id] || []
            const services = o.services?.length ? o.services : [{ serviceId: null, serviceName: "Laundry" }]
            return (
              <Card key={o.id} className="rounded-xl border-slate-200"><CardContent className="p-4">
                {(() => {
                  const isAssigned = (s: { serviceId: string | null; serviceName: string }) => bags.some((b) => (s.serviceId ? b.currentServiceId === s.serviceId : b.currentServiceName === s.serviceName))
                  const next = services.find((s) => !isAssigned(s))
                  return (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-sm font-semibold text-slate-800">{o.orderNumber} <span className="font-sans font-normal text-slate-400">· {o.customer?.name || o.customerName || "—"}</span></p>
                        {next
                          ? <BagScanButton size="sm" label={`Scan Bag → ${next.serviceName}`} onScan={(code) => assign(o, next, code)} />
                          : <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Pickup complete</span>}
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {services.map((s) => {
                          const assigned = bags.find((b) => (s.serviceId ? b.currentServiceId === s.serviceId : b.currentServiceName === s.serviceName))
                          const isNext = next && (s.serviceId ? s.serviceId === next.serviceId : s.serviceName === next.serviceName)
                          return (
                            <div key={`${o.id}:${s.serviceId || s.serviceName}`} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${isNext ? "border-blue-300 bg-blue-50/40" : "border-slate-100"}`}>
                              <span className="text-sm font-medium text-slate-700">{s.serviceName}{isNext && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-blue-600">Next</span>}</span>
                              {assigned
                                ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> {assigned.bagNumber}</span>
                                : <span className="text-xs text-slate-400">Pending</span>}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </CardContent></Card>
            )
          })}
        </div>
      )}
    </>
  )
}

function ReceiveTab({ businessId }: { businessId: string | null }) {
  const [received, setReceived] = useState<Bag[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/bags?businessId=${businessId}&status=RECEIVED_AT_STORE`).then((r) => r.json())
      setReceived(j.data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }, [businessId])
  useEffect(() => { load() }, [load])

  const receive = async (code: string) => {
    try {
      const j = await fetch("/api/laundry/bags/advance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, code: code.trim(), toStatus: "RECEIVED_AT_STORE" }) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Bag not found.")
      const b = j.data
      toast.success(`${b.bagNumber} received — ${b.currentOrderNumber || ""} · ${b.currentServiceName || ""} · ${b.currentCustomerName || ""}`)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Bag not found.") }
  }

  return (
    <>
      <Card className="rounded-xl border-slate-200"><CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold text-slate-700">Scan a reusable bag to receive it at the store.</p>
        <BagScanButton label="Receive Bag" onScan={receive} />
      </CardContent></Card>
      <Card className="rounded-xl border-slate-200"><CardContent className="p-0">
        <p className="px-4 py-2.5 text-[13px] font-semibold text-slate-600 border-b border-slate-50">Received at store</p>
        {loading ? <div className="py-10 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : received.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No bags received yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {received.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
                <div><p className="font-mono text-xs font-semibold text-slate-700">{b.bagNumber} <span className="font-sans font-normal text-slate-400">· {b.currentServiceName || ""}</span></p><p className="text-[11px] text-slate-400">{b.currentOrderNumber || ""} · {b.currentCustomerName || "—"}</p></div>
                <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">Received</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </>
  )
}
