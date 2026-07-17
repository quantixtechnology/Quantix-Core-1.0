"use client"

// Assign Bags (Pickup-First) — reusable-bag pickup + receive. The pickup
// executive scans an AVAILABLE reusable bag and assigns it to a service (one
// bag = one service). No QR is generated; the bag's permanent QR is reused.
// Store staff scan the same bag to mark it Received. Uses /api/laundry/bags.
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Package, PackageCheck, ScanLine, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

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
  const [codeByKey, setCodeByKey] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

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

  const assign = async (o: OrderRow, service: { serviceId: string | null; serviceName: string }) => {
    const key = `${o.id}:${service.serviceId || service.serviceName}`
    const code = (codeByKey[key] || "").trim()
    if (!code) { toast.error("Scan a bag first"); return }
    setBusy(key)
    try {
      const j = await fetch("/api/laundry/bags/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, code, orderId: o.id, serviceId: service.serviceId, serviceName: service.serviceName }) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Failed")
      toast.success(`${j.data.bagNumber} → ${service.serviceName}`)
      setCodeByKey((m) => ({ ...m, [key]: "" })); loadBags(o)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(null) }
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
                <p className="font-mono text-sm font-semibold text-slate-800">{o.orderNumber} <span className="font-sans font-normal text-slate-400">· {o.customer?.name || o.customerName || "—"}</span></p>
                <div className="mt-3 space-y-2">
                  {services.map((s) => {
                    const key = `${o.id}:${s.serviceId || s.serviceName}`
                    const assigned = bags.find((b) => (s.serviceId ? b.currentServiceId === s.serviceId : b.currentServiceName === s.serviceName))
                    return (
                      <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                        <span className="text-sm font-medium text-slate-700">{s.serviceName}</span>
                        {assigned ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> {assigned.bagNumber}</span>
                        ) : (
                          <div className="flex gap-2">
                            <div className="relative w-40"><ScanLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-500" /><Input value={codeByKey[key] || ""} onChange={(e) => setCodeByKey((m) => ({ ...m, [key]: e.target.value.toUpperCase() }))} onKeyDown={(e) => e.key === "Enter" && assign(o, s)} placeholder="Scan BAG-…" className="pl-8 h-9 font-mono text-xs" /></div>
                            <Button size="sm" className="h-9 gap-1 bg-blue-600 hover:bg-blue-700 text-white" disabled={busy === key} onClick={() => assign(o, s)}>{busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Assign"}</Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent></Card>
            )
          })}
        </div>
      )}
    </>
  )
}

function ReceiveTab({ businessId }: { businessId: string | null }) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
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

  const receive = async () => {
    if (!code.trim()) return
    setBusy(true)
    try {
      const j = await fetch("/api/laundry/bags/advance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, code: code.trim(), toStatus: "RECEIVED_AT_STORE" }) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Not found")
      toast.success(`${j.data.bagNumber} received`)
      setCode(""); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  return (
    <>
      <Card className="rounded-xl border-slate-200"><CardContent className="p-4">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-2"><ScanLine className="h-4 w-4 text-blue-600" /> Scan bag to receive at store</p>
        <div className="flex gap-2 max-w-md">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && receive()} placeholder="BAG-000001" className="h-10 font-mono" autoFocus />
          <Button onClick={receive} disabled={busy || !code.trim()} className="h-10 gap-1 bg-blue-600 hover:bg-blue-700 text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Receive</Button>
        </div>
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
