"use client"

// Processing Center console — scan-first operations. Scan a garment barcode to
// identify it and act on it; receive dispatched orders; work per-department
// queues. All state comes from the processing APIs (no mock data).

import { useEffect, useState, useCallback } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScanLine, Loader2, PackageCheck, Play, Check, ShieldCheck, ShieldX, User, ShoppingBag, Factory, ArrowRight, Clock } from "lucide-react"
import { WORKSTATIONS, stageLabel } from "@/lib/laundry-processing"

interface ScanData {
  item: { id: string; itemNumber: string | null; barcode: string | null; garmentName: string; serviceName: string; quantity: number; processingStage: string | null; processingStatus: string | null; stageLabel: string; department: string | null }
  business?: { businessName: string } | null
  store?: { storeName: string } | null
  customer?: { name: string; phone: string | null } | null
  order: { orderNumber: string; status: string }
  currentDepartment: string
  timeline: { id: string; action: string; fromStage: string | null; toStage: string | null; actorName: string | null; createdAt: string }[]
}

const STATUS_STYLE: Record<string, string> = { WAITING: "border-amber-300 text-amber-700 bg-amber-50", IN_PROGRESS: "border-blue-300 text-blue-700 bg-blue-50", DONE: "border-emerald-300 text-emerald-700 bg-emerald-50", REJECTED: "border-rose-300 text-rose-700 bg-rose-50" }
const fmt = (s: string) => new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

export function LaundryProcessingConsole() {
  const { currentBusinessId, user } = useAuthStore()
  const { toast } = useToast()
  const [incoming, setIncoming] = useState<{ id: string; orderNumber: string; items: number; customer: string | null; status: string }[]>([])
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [activeStage, setActiveStage] = useState<string>("WASH")
  const [queue, setQueue] = useState<{ id: string; barcode: string | null; garmentName: string; serviceName: string; orderNumber: string; customer: string | null; processingStatus: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  const [scanInput, setScanInput] = useState("")
  const [scanning, setScanning] = useState(false)
  const [scan, setScan] = useState<ScanData | null>(null)
  const [acting, setActing] = useState(false)

  const loadOverview = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/processing?businessId=${currentBusinessId}&stage=${activeStage}`).then((r) => r.json())
      setIncoming(j.incoming || []); setStageCounts(j.stageCounts || {}); setQueue(j.items || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId, activeStage])
  useEffect(() => { loadOverview() }, [loadOverview])

  const doScan = async (code?: string) => {
    const barcode = (code ?? scanInput).trim()
    if (!barcode || !currentBusinessId) return
    setScanning(true)
    try {
      const j = await fetch(`/api/laundry/scan?barcode=${encodeURIComponent(barcode)}`).then((r) => r.json())
      if (!j.success) { toast({ title: "Not found", description: j.error, variant: "destructive" }); return }
      setScan(j.data); setScanInput("")
    } catch { toast({ title: "Scan failed", variant: "destructive" }) } finally { setScanning(false) }
  }

  const process = async (itemId: string, action: string, refreshScan = true) => {
    setActing(true)
    try {
      const res = await fetch(`/api/laundry/items/${itemId}/process`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, actorName: user?.name || "operator" }) })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: "Action failed", description: j.error, variant: "destructive" }); return }
      toast({ title: action.replace("_", " "), description: `Now: ${stageLabel(j.data.processingStage)} · ${j.data.processingStatus}` })
      if (refreshScan && scan) await doScan(scan.item.barcode || scan.item.itemNumber || "")
      loadOverview()
    } catch { toast({ title: "Action failed", variant: "destructive" }) } finally { setActing(false) }
  }

  const receive = async (orderId: string) => {
    setActing(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/receive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorName: user?.name || "operator" }) })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: "Receive failed", description: j.error, variant: "destructive" }); return }
      toast({ title: "Order received", description: `${j.data.received} garment(s) moved into processing.` })
      loadOverview()
    } catch { toast({ title: "Receive failed", variant: "destructive" }) } finally { setActing(false) }
  }

  // Stage-appropriate actions for the scan popup.
  const scanActions = (d: ScanData) => {
    const st = d.item.processingStage, status = d.item.processingStatus
    if (!st || !d.item.processingStage) return [{ label: "Receive", action: "RECEIVE", icon: PackageCheck }]
    if (st === "PACKED") return []
    if (st === "QC") return status === "IN_PROGRESS" ? [{ label: "QC Pass", action: "QC_PASS", icon: ShieldCheck }, { label: "QC Fail (rework)", action: "QC_FAIL", icon: ShieldX }] : [{ label: "Start QC", action: "START", icon: Play }]
    return status === "IN_PROGRESS" ? [{ label: "Complete", action: "COMPLETE", icon: Check }] : [{ label: "Start", action: "START", icon: Play }]
  }

  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Factory className="h-5 w-5 text-blue-600" /> Processing Center</h1>
        <p className="text-sm text-slate-500">Scan a garment to identify and process it — no searching required.</p>
      </div>

      {/* Scan console */}
      <Card className="rounded-xl border-blue-200 bg-blue-50/40 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 max-w-2xl">
            <div className="relative flex-1"><ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500" /><Input autoFocus value={scanInput} onChange={(e) => setScanInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doScan()} placeholder="Scan or enter garment barcode / item number…" className="pl-10 h-11 bg-white border-blue-200 font-mono" /></div>
            <Button onClick={() => doScan()} disabled={scanning || !scanInput.trim()} className="h-11 gap-2 bg-blue-600 hover:bg-blue-700 text-white">{scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} Scan</Button>
          </div>
        </CardContent>
      </Card>

      {/* Incoming orders */}
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><PackageCheck className="h-[18px] w-[18px] text-blue-600" /> Incoming Orders <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{incoming.length}</Badge></CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="py-8 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : incoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No orders waiting to be received.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead className="text-center">Items</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>{incoming.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                  <TableCell className="text-sm">{o.customer || "—"}</TableCell>
                  <TableCell className="text-center">{o.items}</TableCell>
                  <TableCell><Badge variant="outline" className="border-violet-300 text-violet-700 bg-violet-50">{o.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" onClick={() => receive(o.id)} disabled={acting} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"><PackageCheck className="h-3.5 w-3.5" /> Receive</Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Workstation queues */}
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Factory className="h-[18px] w-[18px] text-blue-600" /> Workstation Queues</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {WORKSTATIONS.map((w) => (
              <button key={w} onClick={() => setActiveStage(w)} className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${activeStage === w ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {stageLabel(w)} <span className={`ml-1 text-xs ${activeStage === w ? "text-blue-100" : "text-slate-400"}`}>{stageCounts[w] || 0}</span>
              </button>
            ))}
          </div>
          {queue.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No garments in {stageLabel(activeStage)}.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Barcode</TableHead><TableHead>Garment</TableHead><TableHead>Service</TableHead><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>{queue.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-mono text-[11px] text-slate-500">{it.barcode}</TableCell>
                  <TableCell className="text-sm font-medium">{it.garmentName}</TableCell>
                  <TableCell className="text-sm text-slate-600">{it.serviceName}</TableCell>
                  <TableCell className="font-mono text-[11px]">{it.orderNumber}</TableCell>
                  <TableCell className="text-sm">{it.customer || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_STYLE[it.processingStatus || ""] || "border-slate-200"}>{it.processingStatus || "—"}</Badge></TableCell>
                  <TableCell className="text-right">
                    {activeStage !== "PACKED" && (it.processingStatus === "IN_PROGRESS"
                      ? <Button size="sm" variant="outline" className="gap-1 h-8" disabled={acting} onClick={() => process(it.id, activeStage === "QC" ? "QC_PASS" : "COMPLETE", false)}><Check className="h-3.5 w-3.5" /> {activeStage === "QC" ? "Pass" : "Complete"}</Button>
                      : <Button size="sm" variant="outline" className="gap-1 h-8" disabled={acting} onClick={() => process(it.id, "START", false)}><Play className="h-3.5 w-3.5" /> Start</Button>)}
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Scan popup */}
      <Dialog open={!!scan} onOpenChange={(o) => !o && setScan(null)}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          {scan && (<>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-blue-600" /> {scan.item.garmentName} <Badge variant="outline" className={STATUS_STYLE[scan.item.processingStatus || ""] || "border-slate-200"}>{scan.item.stageLabel} · {scan.item.processingStatus || "Not received"}</Badge></DialogTitle>
              <DialogDescription className="font-mono text-[11px]">{scan.item.barcode}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-slate-400 flex items-center gap-1"><User className="h-3 w-3" /> Customer</p><p className="text-slate-700">{scan.customer?.name || "—"}</p></div>
              <div><p className="text-xs text-slate-400 flex items-center gap-1"><ShoppingBag className="h-3 w-3" /> Order</p><p className="text-slate-700 font-mono text-xs">{scan.order.orderNumber}</p></div>
              <div><p className="text-xs text-slate-400">Store</p><p className="text-slate-700">{scan.store?.storeName || "—"}</p></div>
              <div><p className="text-xs text-slate-400">Service</p><p className="text-slate-700">{scan.item.serviceName}</p></div>
              <div><p className="text-xs text-slate-400">Department</p><p className="text-slate-700">{scan.currentDepartment || "—"}</p></div>
              <div><p className="text-xs text-slate-400">Qty</p><p className="text-slate-700">{scan.item.quantity}</p></div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {scanActions(scan).map((a) => (
                <Button key={a.action} onClick={() => process(scan.item.id, a.action)} disabled={acting} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"><a.icon className="h-4 w-4" /> {a.label}</Button>
              ))}
              {scan.item.processingStage === "PACKED" && <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 h-8 px-3 flex items-center gap-1"><Check className="h-4 w-4" /> Packed & ready</Badge>}
            </div>
            <div className="border-t pt-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Timeline</p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {scan.timeline.length === 0 ? <p className="text-xs text-slate-400">No events yet.</p> : scan.timeline.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3 text-slate-300 shrink-0" />
                    <span className="font-medium text-slate-700">{e.action.replace("_", " ")}</span>
                    {e.fromStage && e.toStage && e.fromStage !== e.toStage && <span className="text-slate-400 flex items-center gap-0.5">{stageLabel(e.fromStage)} <ArrowRight className="h-3 w-3" /> {stageLabel(e.toStage)}</span>}
                    <span className="text-slate-400 ml-auto">{e.actorName || ""} · {fmt(e.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  )
}
