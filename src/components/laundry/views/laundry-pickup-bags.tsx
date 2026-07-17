"use client"

// Pickup Bag Operations (Pickup-First) — additive staff screen.
//   · Pickup Bags: find a scheduled pickup order → generate one QR bag per
//     booked service → print labels. No garments/pricing/invoice here.
//   · Receive At Store: scan/enter a bag code → mark it physically received.
// Reuses the existing orders + the new /pickup-bags APIs and the qrcode lib.
import { useCallback, useEffect, useState } from "react"
import QRCode from "qrcode"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Package, PackageCheck, Printer, ShoppingBag, ScanLine } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface Bag { id: string; code: string; qrValue: string; orderNumber: string | null; serviceName: string; customerName: string | null; pickupDate: string | null; status: string }
interface OrderRow { id: string; orderNumber: string; customer?: { name?: string | null } | null; customerName?: string | null; createdAt: string; services?: { serviceName: string }[]; _count?: { items: number } }

function QrImage({ value, size = 132 }: { value: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { QRCode.toDataURL(value, { width: size, margin: 1 }).then(setUrl).catch(() => setUrl(null)) }, [value, size])
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={value} width={size} height={size} className="rounded border border-slate-200" /> : <div style={{ width: size, height: size }} className="rounded bg-slate-100 animate-pulse" />
}

async function printBagLabels(bags: Bag[]) {
  const labels = await Promise.all(bags.map(async (b) => ({ b, url: await QRCode.toDataURL(b.qrValue, { width: 240, margin: 1 }) })))
  const w = window.open("", "_blank", "width=460,height=640")
  if (!w) { toast.error("Allow pop-ups to print labels"); return }
  const body = labels.map(({ b, url }) => `
    <div style="page-break-after:always;text-align:center;padding:18px;border-bottom:1px dashed #ccc">
      <div style="font-size:13px;color:#555">${b.customerName || ""}${b.orderNumber ? ` · ${b.orderNumber}` : ""}</div>
      <div style="font-size:18px;font-weight:bold;margin:4px 0">${b.serviceName}</div>
      <img src="${url}" width="200" height="200" />
      <div style="font-family:monospace;font-size:16px;font-weight:bold;margin-top:6px">${b.code}</div>
      <div style="font-size:11px;color:#888">Pickup Bag · count garments at Store Audit</div>
    </div>`).join("")
  w.document.write(`<html><head><title>Pickup Bags</title></head><body style="font-family:sans-serif;margin:0">${body}</body></html>`)
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300)
}

export function LaundryPickupBags() {
  const { currentBusinessId } = useAuthStore()
  const [tab, setTab] = useState<"pickup" | "receive">("pickup")
  const [qrMode, setQrMode] = useState<string | null>(null)

  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/pickup-settings?businessId=${currentBusinessId}`).then((r) => r.json()).then((j) => { if (j.success) setQrMode(j.data.processingPackageQrMode) }).catch(() => {})
  }, [currentBusinessId])
  const setMode = async (mode: string) => {
    setQrMode(mode)
    try {
      await fetch("/api/laundry/pickup-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, processingPackageQrMode: mode }) })
      toast.success("Setting saved")
    } catch { toast.error("Could not save setting") }
  }

  return (
    <div className="px-4 lg:px-6 py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Package className="h-5 w-5 text-blue-600" /> Pickup Bags</h1>
          <p className="text-sm text-slate-500">Generate one QR bag per booked service at pickup, then receive them at the store.</p>
        </div>
        {qrMode && (
          <div className="rounded-lg border border-slate-200 bg-white p-1 flex items-center gap-1 text-xs">
            <span className="px-2 text-slate-400">Processing QR after audit:</span>
            {([["GENERATE_NEW", "Generate New"], ["REUSE_BAG", "Reuse Bag QR"]] as const).map(([v, lbl]) => (
              <button key={v} onClick={() => setMode(v)} className={`rounded-md px-2.5 py-1 font-semibold ${qrMode === v ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>{lbl}</button>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {([["pickup", "Pickup Bags"], ["receive", "Receive At Store"]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-md px-4 py-1.5 text-sm font-semibold ${tab === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{lbl}</button>
        ))}
      </div>
      {tab === "pickup" ? <PickupTab businessId={currentBusinessId} /> : <ReceiveTab businessId={currentBusinessId} />}
    </div>
  )
}

function PickupTab({ businessId }: { businessId: string | null }) {
  const [search, setSearch] = useState("")
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bagsByOrder, setBagsByOrder] = useState<Record<string, Bag[]>>({})
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

  const generate = async (o: OrderRow) => {
    setBusy(o.id)
    try {
      const j = await fetch(`/api/laundry/orders/${o.id}/pickup-bags`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId }) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Failed")
      setBagsByOrder((m) => ({ ...m, [o.id]: j.data }))
      toast.success(j.alreadyGenerated ? "Bags already generated" : `${j.data.length} bag(s) generated`)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(null) }
  }
  const loadBags = async (o: OrderRow) => {
    const j = await fetch(`/api/laundry/orders/${o.id}/pickup-bags`).then((r) => r.json())
    setBagsByOrder((m) => ({ ...m, [o.id]: j.data || [] }))
  }

  return (
    <>
      <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order no, customer, mobile…" className="pl-9 h-10" /></div>
      {loading ? <div className="py-12 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : orders.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">No orders found.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const bags = bagsByOrder[o.id]
            return (
              <Card key={o.id} className="rounded-xl border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm font-semibold text-slate-800">{o.orderNumber} <span className="font-sans font-normal text-slate-400">· {o.customer?.name || o.customerName || "—"}</span></p>
                      <p className="text-[11px] text-slate-400">{new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · {(o.services?.length ?? 0)} service(s){o._count ? ` · ${o._count.items} garments` : ""}</p>
                    </div>
                    {bags ? (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => printBagLabels(bags)}><Printer className="h-3.5 w-3.5" /> Print {bags.length} Label(s)</Button>
                    ) : (
                      <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" disabled={busy === o.id} onClick={() => generate(o)}>{busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingBag className="h-3.5 w-3.5" />} Generate Bags</Button>
                    )}
                  </div>
                  {!bags && <button onClick={() => loadBags(o)} className="mt-1 text-[11px] text-blue-600">View existing bags</button>}
                  {bags && bags.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {bags.map((b) => (
                        <div key={b.id} className="rounded-lg border border-slate-100 p-2.5 flex flex-col items-center gap-1.5">
                          <QrImage value={b.qrValue} />
                          <p className="font-mono text-[11px] font-bold text-slate-700">{b.code}</p>
                          <p className="text-[11px] text-slate-500 text-center leading-tight">{b.serviceName}</p>
                          <Badge variant="outline" className="text-[9px] border-slate-200 text-slate-500">{b.status.replace(/_/g, " ")}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
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
      const j = await fetch(`/api/laundry/pickup-bags?businessId=${businessId}&status=RECEIVED_AT_STORE`).then((r) => r.json())
      setReceived(j.data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }, [businessId])
  useEffect(() => { load() }, [load])

  const receive = async () => {
    if (!code.trim()) return
    setBusy(true)
    try {
      const j = await fetch("/api/laundry/pickup-bags/receive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, code: code.trim() }) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Not found")
      toast.success(j.alreadyReceived ? `${j.data.code} already received` : `${j.data.code} received`)
      setCode(""); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  return (
    <>
      <Card className="rounded-xl border-slate-200"><CardContent className="p-4">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-2"><ScanLine className="h-4 w-4 text-blue-600" /> Scan / enter Pickup Bag code</p>
        <div className="flex gap-2 max-w-md">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && receive()} placeholder="PB-YYYYMM-000001" className="h-10 font-mono" autoFocus />
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
                <div><p className="font-mono text-xs font-semibold text-slate-700">{b.code} <span className="font-sans font-normal text-slate-400">· {b.serviceName}</span></p><p className="text-[11px] text-slate-400">{b.orderNumber} · {b.customerName || "—"}</p></div>
                <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">Received</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </>
  )
}
