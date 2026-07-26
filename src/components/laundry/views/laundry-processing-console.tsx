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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, PackageCheck, Factory, ArrowRight, Barcode as BarcodeIcon, Droplets, Wind, Sparkles, Shirt, Layers, ShieldCheck, Package, RefreshCw, ScanLine, Truck, Undo2, Printer, QrCode as QrIcon, X } from "lucide-react"
import { stageLabel } from "@/lib/laundry-processing"
import { printHtmlDocument } from "@/lib/print-utils"
import { BagScanButton } from "@/components/laundry/bag-scanner"
import QRCode from "qrcode"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"

// Department tiles MUST cover every WORKSTATIONS stage — DRY (Drying) is a
// first-class stage produced by default service routes (e.g. WASH→DRY→QC→PACKED).
// Omitting DRY previously hid garments parked at Drying from the Processing
// Console even though the API counts them (stageCounts.DRY).
const DEPT_TILES: { stage: string; icon: typeof Droplets; color: string; label?: string }[] = [
  { stage: "WASH", icon: Droplets, color: "text-blue-600 bg-blue-50" },
  { stage: "DRY", icon: Wind, color: "text-sky-600 bg-sky-50", label: "Drying" },
  { stage: "DRYCLEAN", icon: Sparkles, color: "text-cyan-600 bg-cyan-50" },
  { stage: "IRON", icon: Shirt, color: "text-violet-600 bg-violet-50" },
  { stage: "FOLD", icon: Layers, color: "text-teal-600 bg-teal-50" },
  { stage: "QC", icon: ShieldCheck, color: "text-fuchsia-600 bg-fuchsia-50" },
  { stage: "PACKED", icon: Package, color: "text-emerald-600 bg-emerald-50" },
]

interface Incoming { id: string; orderNumber: string; items: number; customer: string | null; status: string; packetNumber: string | null; dispatchedAt: string | null; fromStore: string | null }
interface ReturnRow { id: string; orderNumber: string; customer: string | null; items: number; toStore: string | null; packetNumber: string | null }

// The return package carries the SAME packet QR it was sent in with — reprint it
// here (post-folding) so the store can scan it back. QR payload = packet number.
function ReturnQr({ value, size = 150 }: { value: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { QRCode.toDataURL(value, { width: size, margin: 1 }).then(setUrl).catch(() => setUrl(null)) }, [value, size])
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={value} width={size} height={size} className="rounded border border-slate-200" /> : <div style={{ width: size, height: size }} className="rounded border border-slate-200 bg-slate-50" />
}
function printReturnLabel(packetNumber: string, orderNumber: string, storeName: string | null | undefined) {
  QRCode.toDataURL(packetNumber, { width: 240, margin: 1 }).then((url) => {
    // Print via a hidden iframe (never a popup — see printHtmlDocument).
    printHtmlDocument(`<html><head><title>${packetNumber}</title></head><body style="font-family:monospace;text-align:center;padding:16px"><img src="${url}" width="240" height="240"/><h2 style="margin:8px 0 2px">${packetNumber}</h2><p style="margin:2px 0">${orderNumber}</p><p style="margin:2px 0;color:#555">${storeName || ""}</p><p style="margin:6px 0;font-size:12px;color:#777">Return to store — scan to receive</p></body></html>`, packetNumber)
  }).catch(() => {})
}

// Packet history for a console section: past packets in the given statuses, with a
// search and a Reprint QR (same packet QR) — for when a label was missed at dispatch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HistPacket = { id: string; packetNumber: string; status: string; itemCount: number; dispatchedAt: string | null; receivedAt: string | null; returnDispatchedAt: string | null; order: { orderNumber: string; store?: { storeName?: string | null } | null }; customer: { name?: string | null } | null }
function PacketHistory({ businessId, statusIn, timeField, timeLabel }: { businessId: string | null; statusIn: string; timeField: "receivedAt" | "returnDispatchedAt" | "dispatchedAt"; timeLabel: string }) {
  const [rows, setRows] = useState<HistPacket[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const load = useCallback(() => {
    if (!businessId) return
    setLoading(true)
    const params = new URLSearchParams({ businessId, statusIn })
    if (q.trim()) params.set("search", q.trim())
    fetch(`/api/laundry/packets?${params}`).then((r) => r.json()).then((j) => setRows(j.success ? j.data : [])).catch(() => setRows([])).finally(() => setLoading(false))
  }, [businessId, statusIn, q])
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t) }, [load, q])
  const f = (s: string | null) => (s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")
  return (
    <div className="p-4 space-y-2">
      <div className="relative max-w-xs"><ScanLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order / packet…" className="pl-8 h-9 text-sm font-mono" /></div>
      {loading ? <div className="py-6 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : rows.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">{q ? "No packet matches that." : "No history yet."}</p> : (
        <Table>
          <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Packet</TableHead><TableHead>Customer</TableHead><TableHead className="text-center">Garments</TableHead><TableHead>{timeLabel}</TableHead><TableHead className="text-right">QR</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs">{p.order.orderNumber}</TableCell>
              <TableCell className="font-mono text-xs">{p.packetNumber}</TableCell>
              <TableCell className="text-sm">{p.customer?.name || "—"}</TableCell>
              <TableCell className="text-center">{p.itemCount}</TableCell>
              <TableCell className="text-xs text-slate-500">{f((p as unknown as Record<string, string | null>)[timeField])}</TableCell>
              <TableCell className="text-right"><Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => printReturnLabel(p.packetNumber, p.order.orderNumber, p.order.store?.storeName)}><Printer className="h-3.5 w-3.5" /> Reprint QR</Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
    </div>
  )
}

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")

export function LaundryProcessingConsole() {
  const { currentBusinessId, user } = useAuthStore()
  const { openAuditBarcode, setSelectedOrderId, setLaundryPage } = useAdminStore()
  const { toast } = useToast()
  const [incoming, setIncoming] = useState<Incoming[]>([])
  const [awaitingBarcode, setAwaitingBarcode] = useState<{ id: string; orderNumber: string; customer: string | null; items: number; barcoded: number }[]>([])
  const [readyToReturn, setReadyToReturn] = useState<ReturnRow[]>([])
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [dispatchRow, setDispatchRow] = useState<ReturnRow | null>(null)
  const [dispatchBag, setDispatchBag] = useState("")
  const [hist, setHist] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [code, setCode] = useState("")
  const [looking, setLooking] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!currentBusinessId) return
    if (!silent) setLoading(true)
    try {
      const j = await fetch(`/api/laundry/processing?businessId=${currentBusinessId}`).then((r) => r.json())
      setIncoming(j.incoming || []); setAwaitingBarcode(j.awaitingBarcode || []); setReadyToReturn(j.readyToReturn || []); setStageCounts(j.stageCounts || {})
    } catch { /* noop */ } finally { if (!silent) setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])
  // Live queues: refresh on tab focus + a light poll so received packets and
  // department counts update without a manual page refresh.
  useAutoRefresh(() => load(true), { intervalMs: 12000 })

  // Receive a dispatched packet → immediately open Barcode Generation.
  const receive = async (orderId: string) => {
    setActing(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/receive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorName: user?.name || "operator" }) })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: "Receive failed", description: j.error, variant: "destructive" }); return }
      toast({ title: "Packet received", description: `${j.data.packetNumber || ""} · ${j.data.received} garment(s) → Barcode Generation.` })
      openAuditBarcode(orderId)
    } catch { toast({ title: "Receive failed", variant: "destructive" }) } finally { setActing(false) }
  }

  // QR / manual code entry — packet number, QR payload or order number. Accepts
  // an explicit value (from the camera scanner) or falls back to the typed field.
  const lookupAndReceive = async (raw?: string) => {
    const q = (raw ?? code).trim()
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
  const returnToStore = async (orderId: string, bagCode?: string) => {
    if (!currentBusinessId) return
    setActing(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/return-dispatch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, actorId: user?.id, actorName: user?.name || "operator", bagCode: bagCode || undefined }) })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: "Return dispatch failed", description: j.error, variant: "destructive" }); return }
      const bagNote = j.data.bagAssigned ? ` · bag ${j.data.bagAssigned}` : ""
      toast({ title: "Dispatched to store", description: `${j.data.orderNumber} · ${j.data.items} garment(s) in return transit${bagNote}.` })
      if (j.bagWarning) toast({ title: "Bag not linked", description: j.bagWarning, variant: "destructive" })
      setDispatchRow(null); setDispatchBag("")
      load()
    } catch { toast({ title: "Return dispatch failed", variant: "destructive" }) } finally { setActing(false) }
  }

  // Active ⇄ History toggle shown in each section header.
  const histToggle = (key: string) => (
    <div className="ml-auto flex rounded-lg border border-slate-200 overflow-hidden text-[11px] font-medium">
      <button onClick={() => setHist((h) => ({ ...h, [key]: false }))} className={`px-2.5 py-1 ${!hist[key] ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>Active</button>
      <button onClick={() => setHist((h) => ({ ...h, [key]: true }))} className={`px-2.5 py-1 ${hist[key] ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>History</button>
    </div>
  )

  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Factory className="h-5 w-5 text-blue-600" /> Processing Center</h1>
          <p className="text-sm text-slate-500">Receive dispatched packets, monitor department workload, and return completed orders to the store.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => load()} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
      </div>

      {/* QR / manual packet entry */}
      <Card className="rounded-xl border-blue-200 bg-blue-50/40 shadow-sm"><CardContent className="p-4">
        <div className="flex items-center gap-3 max-w-2xl">
          <div className="relative flex-1"><ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500" /><Input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookupAndReceive()} placeholder="Scan packet QR or enter packet / order code (PKT-… / ORD-…)" className="pl-10 h-11 bg-white border-blue-200 font-mono" /></div>
          {/* Camera scan: scanning a packet QR looks it up and receives it in one step
              (single-shot — the scanner closes after each successful scan). */}
          <BagScanButton label="Scan with Camera" onScan={(c) => lookupAndReceive(c)} disabled={looking} closeOnScan className="h-11" />
          <Button onClick={() => lookupAndReceive()} disabled={looking || !code.trim()} className="h-11 gap-2 bg-blue-600 hover:bg-blue-700 text-white">{looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Receive</Button>
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
        <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Truck className="h-[18px] w-[18px] text-blue-600" /> In Transit — Receive Packets <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{incoming.length}</Badge>{histToggle("receive")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {hist.receive ? <PacketHistory businessId={currentBusinessId} statusIn="AT_PROCESSING_CENTER,RETURN_IN_TRANSIT,RETURNED_TO_STORE" timeField="receivedAt" timeLabel="Received" /> : loading ? <div className="py-8 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : incoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No packets in transit. Only dispatched packets appear here.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Packet</TableHead><TableHead>Order</TableHead><TableHead>From Store</TableHead><TableHead>Customer</TableHead><TableHead className="text-center">Garments</TableHead><TableHead>Dispatched</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>{incoming.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.packetNumber || "—"}</TableCell>
                  <TableCell><button type="button" className="font-mono text-xs text-blue-700 hover:underline text-left" onClick={() => { setSelectedOrderId(o.id); setLaundryPage("order-detail") }}>{o.orderNumber}</button></TableCell>
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

      {/* Awaiting Barcode Generation → dedicated page */}
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><BarcodeIcon className="h-[18px] w-[18px] text-blue-600" /> Awaiting Barcode Generation <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{awaitingBarcode.length}</Badge>{histToggle("barcode")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {hist.barcode ? <PacketHistory businessId={currentBusinessId} statusIn="AT_PROCESSING_CENTER,RETURN_IN_TRANSIT,RETURNED_TO_STORE" timeField="receivedAt" timeLabel="Received" /> : loading ? <div className="py-8 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : awaitingBarcode.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No packets awaiting audit.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead className="text-center">Garments</TableHead><TableHead>Barcodes</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>{awaitingBarcode.map((o) => (
                <TableRow key={o.id}>
                  <TableCell><button type="button" className="font-mono text-sm text-blue-700 hover:underline text-left" onClick={() => { setSelectedOrderId(o.id); setLaundryPage("order-detail") }}>{o.orderNumber}</button></TableCell>
                  <TableCell className="text-sm">{o.customer || "—"}</TableCell>
                  <TableCell className="text-center">{o.items}</TableCell>
                  <TableCell><Badge variant="outline" className={o.barcoded === o.items ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-amber-300 text-amber-700 bg-amber-50"}>{o.barcoded}/{o.items} barcoded</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openAuditBarcode(o.id)} className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"><BarcodeIcon className="h-3.5 w-3.5" /> Barcode Generation <ArrowRight className="h-3 w-3" /></Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ready to return to store */}
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Undo2 className="h-[18px] w-[18px] text-emerald-600" /> Completed — Dispatch to Store <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">{readyToReturn.length}</Badge>{histToggle("dispatch")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {hist.dispatch ? <PacketHistory businessId={currentBusinessId} statusIn="RETURN_IN_TRANSIT,RETURNED_TO_STORE" timeField="returnDispatchedAt" timeLabel="Dispatched" /> : loading ? <div className="py-8 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : readyToReturn.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No completed orders waiting. Orders appear when every garment has passed QC.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Packet</TableHead><TableHead>Customer</TableHead><TableHead className="text-center">Garments</TableHead><TableHead>To Store</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>{readyToReturn.map((o) => (
                <TableRow key={o.id}>
                  <TableCell><button type="button" className="font-mono text-xs text-blue-700 hover:underline text-left" onClick={() => { setSelectedOrderId(o.id); setLaundryPage("order-detail") }}>{o.orderNumber}</button></TableCell>
                  <TableCell className="font-mono text-xs">{o.packetNumber || "—"}</TableCell>
                  <TableCell className="text-sm">{o.customer || "—"}</TableCell>
                  <TableCell className="text-center">{o.items}</TableCell>
                  <TableCell className="text-sm">{o.toStore || "—"}</TableCell>
                  <TableCell className="text-right"><Button size="sm" onClick={() => { setDispatchRow(o); setDispatchBag("") }} disabled={acting} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"><Truck className="h-3.5 w-3.5" /> Dispatch to Store</Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dispatch-to-store dialog: reprint the SAME packet QR for the return
          package, optionally scan ANY bag it's placed in, then dispatch. */}
      <Dialog open={!!dispatchRow} onOpenChange={(o) => { if (!o) { setDispatchRow(null); setDispatchBag("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-emerald-600" /> Dispatch to Store</DialogTitle></DialogHeader>
          {dispatchRow && (
            <div className="space-y-4">
              <div className="text-sm text-slate-600"><span className="font-mono font-semibold">{dispatchRow.orderNumber}</span> · {dispatchRow.items} garment(s){dispatchRow.toStore ? ` · ${dispatchRow.toStore}` : ""}</div>
              {dispatchRow.packetNumber ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-3">
                  <ReturnQr value={dispatchRow.packetNumber} />
                  <p className="font-mono text-sm font-bold">{dispatchRow.packetNumber}</p>
                  <p className="text-[11px] text-slate-400">Same QR it was sent with — put it on the return package so the store can scan it.</p>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => printReturnLabel(dispatchRow.packetNumber!, dispatchRow.orderNumber, dispatchRow.toStore)}><Printer className="h-3.5 w-3.5" /> Print QR</Button>
                </div>
              ) : <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">No packet on this order — the store can still receive by order number.</p>}
              <div className="space-y-1.5">
                <p className="text-[12px] font-semibold text-slate-600">Return bag <span className="font-normal text-slate-400">(optional — any available bag)</span></p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1"><QrIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={dispatchBag} onChange={(e) => setDispatchBag(e.target.value)} placeholder="Scan / enter bag no." className="pl-8 h-10 font-mono text-sm" /></div>
                  <BagScanButton label="Scan" size="sm" onScan={(c) => setDispatchBag(c)} closeOnScan className="h-10" />
                  {dispatchBag && <button onClick={() => setDispatchBag("")} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
                </div>
                <p className="text-[11px] text-slate-400">Whatever bag the packet goes into — the store can scan the packet QR or this bag to receive.</p>
              </div>
              <Button onClick={() => returnToStore(dispatchRow.id, dispatchBag.trim() || undefined)} disabled={acting} className="w-full h-11 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">{acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Dispatch to Store</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
