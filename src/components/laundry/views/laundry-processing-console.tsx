"use client"

// Processing Center — Console & Receive. Real receiving workflow: identify the
// packet by QR value / packet code / order number (manual entry works without
// a camera), confirm receipt of DISPATCHED packets only, monitor department
// workload, and dispatch completed orders back to their store.

import { useEffect, useState, useCallback } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, PackageCheck, Factory, ArrowRight, Barcode as BarcodeIcon, Droplets, Wind, Sparkles, Flame, Shirt, Layers, ShieldCheck, Package, RefreshCw, ScanLine, Truck, Undo2 } from "lucide-react"
import { stageLabel } from "@/lib/laundry-processing"

// Department tiles MUST cover every WORKSTATIONS stage — DRY (Drying) is a
// first-class stage produced by default service routes (e.g. WASH→DRY→QC→PACKED).
// Omitting DRY previously hid garments parked at Drying from the Processing
// Console even though the API counts them (stageCounts.DRY).
const DEPT_TILES: { stage: string; icon: typeof Droplets; color: string; label?: string }[] = [
  { stage: "WASH", icon: Droplets, color: "text-blue-600 bg-blue-50" },
  { stage: "DRY", icon: Wind, color: "text-sky-600 bg-sky-50", label: "Drying" },
  { stage: "DRYCLEAN", icon: Sparkles, color: "text-cyan-600 bg-cyan-50" },
  { stage: "STEAM", icon: Flame, color: "text-orange-600 bg-orange-50" },
  { stage: "IRON", icon: Shirt, color: "text-violet-600 bg-violet-50" },
  { stage: "FOLD", icon: Layers, color: "text-teal-600 bg-teal-50" },
  { stage: "QC", icon: ShieldCheck, color: "text-fuchsia-600 bg-fuchsia-50" },
  { stage: "PACKED", icon: Package, color: "text-emerald-600 bg-emerald-50" },
]

interface Incoming { id: string; orderNumber: string; items: number; customer: string | null; status: string; packetNumber: string | null; dispatchedAt: string | null; fromStore: string | null }
interface ReturnRow { id: string; orderNumber: string; customer: string | null; items: number; toStore: string | null; packetNumber: string | null }

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")

export function LaundryProcessingConsole() {
  const { currentBusinessId, user } = useAuthStore()
  const { openAuditBarcode } = useAdminStore()
  const { toast } = useToast()
  const [incoming, setIncoming] = useState<Incoming[]>([])
  const [awaitingBarcode, setAwaitingBarcode] = useState<{ id: string; orderNumber: string; customer: string | null; items: number; barcoded: number }[]>([])
  const [readyToReturn, setReadyToReturn] = useState<ReturnRow[]>([])
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [code, setCode] = useState("")
  const [looking, setLooking] = useState(false)

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/processing?businessId=${currentBusinessId}`).then((r) => r.json())
      setIncoming(j.incoming || []); setAwaitingBarcode(j.awaitingBarcode || []); setReadyToReturn(j.readyToReturn || []); setStageCounts(j.stageCounts || {})
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  // Receive a dispatched packet → immediately open Audit & Barcode.
  const receive = async (orderId: string) => {
    setActing(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/receive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorName: user?.name || "operator" }) })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: "Receive failed", description: j.error, variant: "destructive" }); return }
      toast({ title: "Packet received", description: `${j.data.packetNumber || ""} · ${j.data.received} garment(s) → Audit & Barcode.` })
      openAuditBarcode(orderId)
    } catch { toast({ title: "Receive failed", variant: "destructive" }) } finally { setActing(false) }
  }

  // QR / manual code entry — packet number, QR payload or order number.
  const lookupAndReceive = async () => {
    const q = code.trim()
    if (!q || !currentBusinessId) return
    setLooking(true)
    try {
      const j = await fetch(`/api/laundry/packets?businessId=${encodeURIComponent(currentBusinessId)}&code=${encodeURIComponent(q)}`).then((r) => r.json())
      const p = (j.data || [])[0]
      if (!p) { toast({ title: "Not found", description: `No packet matches "${q}"`, variant: "destructive" }); return }
      if (p.status !== "IN_TRANSIT_TO_PC") {
        toast({ title: "Not receivable", description: `Packet ${p.packetNumber} is ${p.status.replace(/_/g, " ").toLowerCase()} — only a dispatched packet can be received.`, variant: "destructive" })
        return
      }
      setCode("")
      await receive(p.order.id)
      load()
    } catch { toast({ title: "Lookup failed", variant: "destructive" }) } finally { setLooking(false) }
  }

  // Dispatch a completed order back to its origin store.
  const returnToStore = async (orderId: string) => {
    if (!currentBusinessId) return
    setActing(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/return-dispatch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, actorId: user?.id, actorName: user?.name || "operator" }) })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: "Return dispatch failed", description: j.error, variant: "destructive" }); return }
      toast({ title: "Dispatched to store", description: `${j.data.orderNumber} · ${j.data.items} garment(s) in return transit.` })
      load()
    } catch { toast({ title: "Return dispatch failed", variant: "destructive" }) } finally { setActing(false) }
  }

  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Factory className="h-5 w-5 text-blue-600" /> Processing Center</h1>
          <p className="text-sm text-slate-500">Receive dispatched packets, monitor department workload, and return completed orders to the store.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
      </div>

      {/* QR / manual packet entry */}
      <Card className="rounded-xl border-blue-200 bg-blue-50/40 shadow-sm"><CardContent className="p-4">
        <div className="flex items-center gap-3 max-w-2xl">
          <div className="relative flex-1"><ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500" /><Input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookupAndReceive()} placeholder="Scan packet QR or enter packet / order code (PKT-… / ORD-…)" className="pl-10 h-11 bg-white border-blue-200 font-mono" /></div>
          <Button onClick={lookupAndReceive} disabled={looking || !code.trim()} className="h-11 gap-2 bg-blue-600 hover:bg-blue-700 text-white">{looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Receive</Button>
        </div>
      </CardContent></Card>

      {/* Department summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {DEPT_TILES.map((d) => (
          <Card key={d.stage} className="rounded-xl border-slate-200 shadow-sm"><CardContent className="p-3.5 flex items-center gap-2.5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${d.color}`}><d.icon className="h-5 w-5" /></div>
            <div><p className="text-xl font-bold text-slate-800 leading-none tabular-nums">{stageCounts[d.stage] || 0}</p><p className="text-[10px] text-slate-400 mt-1">{d.label ?? stageLabel(d.stage)}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Receive dispatched packets */}
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Truck className="h-[18px] w-[18px] text-blue-600" /> In Transit — Receive Packets <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{incoming.length}</Badge></CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="py-8 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : incoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No packets in transit. Only dispatched packets appear here.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Packet</TableHead><TableHead>Order</TableHead><TableHead>From Store</TableHead><TableHead>Customer</TableHead><TableHead className="text-center">Garments</TableHead><TableHead>Dispatched</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>{incoming.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.packetNumber || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                  <TableCell className="text-sm">{o.fromStore || "—"}</TableCell>
                  <TableCell className="text-sm">{o.customer || "—"}</TableCell>
                  <TableCell className="text-center">{o.items}</TableCell>
                  <TableCell className="text-xs text-slate-500">{fmt(o.dispatchedAt)}</TableCell>
                  <TableCell className="text-right"><Button size="sm" onClick={() => receive(o.id)} disabled={acting} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"><PackageCheck className="h-3.5 w-3.5" /> Receive</Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Awaiting Audit & Barcode → dedicated page */}
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><BarcodeIcon className="h-[18px] w-[18px] text-blue-600" /> Awaiting Garment Audit &amp; Barcode <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{awaitingBarcode.length}</Badge></CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="py-8 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : awaitingBarcode.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No packets awaiting audit.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead className="text-center">Garments</TableHead><TableHead>Barcodes</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>{awaitingBarcode.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                  <TableCell className="text-sm">{o.customer || "—"}</TableCell>
                  <TableCell className="text-center">{o.items}</TableCell>
                  <TableCell><Badge variant="outline" className={o.barcoded === o.items ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-amber-300 text-amber-700 bg-amber-50"}>{o.barcoded}/{o.items} barcoded</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openAuditBarcode(o.id)} className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"><BarcodeIcon className="h-3.5 w-3.5" /> Audit &amp; Barcode <ArrowRight className="h-3 w-3" /></Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ready to return to store */}
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Undo2 className="h-[18px] w-[18px] text-emerald-600" /> Completed — Dispatch to Store <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">{readyToReturn.length}</Badge></CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="py-8 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : readyToReturn.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No completed orders waiting. Orders appear when every garment has passed QC.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Packet</TableHead><TableHead>Customer</TableHead><TableHead className="text-center">Garments</TableHead><TableHead>To Store</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>{readyToReturn.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{o.packetNumber || "—"}</TableCell>
                  <TableCell className="text-sm">{o.customer || "—"}</TableCell>
                  <TableCell className="text-center">{o.items}</TableCell>
                  <TableCell className="text-sm">{o.toStore || "—"}</TableCell>
                  <TableCell className="text-right"><Button size="sm" onClick={() => returnToStore(o.id)} disabled={acting} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"><Truck className="h-3.5 w-3.5" /> Dispatch to Store</Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
