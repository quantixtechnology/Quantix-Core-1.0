"use client"

// Department Workstation — one dedicated operational screen per department
// (Wash / Dry Clean / Steam / Iron / Folding / QC). Scan-first: scan a garment
// barcode to act on it, or work the Waiting / In-Progress columns directly.
// Start / Pause / Resume / Complete each write a garment timeline event; on
// completion the garment auto-routes to the next department.

import { useEffect, useState, useCallback } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScanLine, Loader2, Play, Pause, Check, ShieldCheck, ShieldX, Clock, User, ShoppingBag, ArrowRight, Factory } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { stageLabel, departmentFor, parseFlow, getFlow, reworkStagesOf } from "@/lib/laundry-processing"

interface Item { id: string; itemNumber: string | null; barcode: string | null; garmentName: string; serviceName: string; quantity: number; orderNumber: string; customer: string | null; processingStatus: string | null; processFlow?: string | null }
interface ScanData { item: { id: string; garmentName: string; serviceName: string; processingStage: string | null; processingStatus: string | null; stageLabel: string; barcode: string | null }; customer?: { name: string } | null; order: { orderNumber: string }; currentDepartment: string; timeline: { id: string; action: string; fromStage: string | null; toStage: string | null; actorName: string | null; createdAt: string }[] }

const fmt = (s: string) => new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

export function LaundryWorkstation({ stage, icon: Icon = Factory }: { stage: string; icon?: React.ComponentType<{ className?: string }> }) {
  const { currentBusinessId, user } = useAuthStore()
  const { toast } = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [scanInput, setScanInput] = useState("")
  const [scanning, setScanning] = useState(false)
  const [scan, setScan] = useState<ScanData | null>(null)
  const [busy, setBusy] = useState(false)
  // QC failure dialog: requires a reason + a rework destination from the
  // garment's own processing route.
  const [qcFail, setQcFail] = useState<{ itemId: string; garment: string; flow: string | null; serviceName: string; fromScan: boolean } | null>(null)
  const [qcReason, setQcReason] = useState("")
  const [qcStage, setQcStage] = useState("")
  // Scan-first: acting on a garment from the queue (without scanning) is a
  // deliberate fallback — it goes through a confirm. Scanning stays the
  // frictionless primary path (the scan popup acts immediately).
  const [manual, setManual] = useState<{ itemId: string; garment: string; action: string; label: string } | null>(null)
  const isQC = stage === "QC"

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/processing?businessId=${currentBusinessId}&stage=${stage}`).then((r) => r.json())
      setItems(j.items || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId, stage])
  useEffect(() => { load() }, [load])

  const act = async (itemId: string, action: string, closeScan = false, extra: Record<string, unknown> = {}) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/items/${itemId}/process`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, actorName: user?.name || "operator", ...extra }) })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: "Action failed", description: j.error, variant: "destructive" }); return }
      toast({ title: action.replace("_", " "), description: `${stageLabel(j.data.processingStage)} · ${j.data.processingStatus}` })
      if (closeScan) setScan(null)
      load()
    } catch { toast({ title: "Action failed", variant: "destructive" }) } finally { setBusy(false) }
  }

  const doScan = async () => {
    const code = scanInput.trim()
    if (!code) return
    setScanning(true)
    try {
      const j = await fetch(`/api/laundry/scan?barcode=${encodeURIComponent(code)}`).then((r) => r.json())
      if (!j.success) { toast({ title: "Not found", description: j.error, variant: "destructive" }); return }
      if (j.data.item.processingStage !== stage) {
        toast({ title: "Wrong department", description: `${j.data.item.garmentName} is at ${j.data.currentDepartment || j.data.item.stageLabel}, not ${stageLabel(stage)}.`, variant: "destructive" })
        return
      }
      setScan(j.data); setScanInput("")
    } catch { toast({ title: "Scan failed", variant: "destructive" }) } finally { setScanning(false) }
  }

  const waiting = items.filter((i) => i.processingStatus === "WAITING")
  const active = items.filter((i) => i.processingStatus === "IN_PROGRESS" || i.processingStatus === "PAUSED")

  const ItemCard = ({ it }: { it: Item }) => (
    <div className="rounded-lg border border-slate-200 p-3 bg-white">
      <div className="flex items-center justify-between">
        <div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{it.garmentName}</p><p className="text-[11px] text-slate-400">{it.customer || "—"} · <span className="font-mono">{it.orderNumber}</span></p></div>
        {it.processingStatus === "PAUSED" && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-[10px]">Paused</Badge>}
      </div>
      <p className="text-[10px] font-mono text-slate-400 mt-1 truncate">{it.barcode}</p>
      <div className="flex gap-1.5 mt-2">
        {it.processingStatus === "WAITING" && <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1" disabled={busy} onClick={() => setManual({ itemId: it.id, garment: it.garmentName, action: "START", label: "Start" })}><Play className="h-3.5 w-3.5" /> Start</Button>}
        {it.processingStatus === "IN_PROGRESS" && <>
          <Button size="sm" variant="outline" className="h-8 gap-1" disabled={busy} onClick={() => act(it.id, "PAUSE")}><Pause className="h-3.5 w-3.5" /></Button>
          {isQC
            ? <><Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white flex-1" disabled={busy} onClick={() => setManual({ itemId: it.id, garment: it.garmentName, action: "QC_PASS", label: "QC Pass" })}><ShieldCheck className="h-3.5 w-3.5" /> Pass</Button><Button size="sm" variant="outline" className="h-8 gap-1 text-rose-600 border-rose-200" disabled={busy} onClick={() => setQcFail({ itemId: it.id, garment: it.garmentName, flow: it.processFlow || null, serviceName: it.serviceName, fromScan: false })}><ShieldX className="h-3.5 w-3.5" /> Fail</Button></>
            : <Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white flex-1" disabled={busy} onClick={() => setManual({ itemId: it.id, garment: it.garmentName, action: "COMPLETE", label: "Complete" })}><Check className="h-3.5 w-3.5" /> Complete</Button>}
        </>}
        {it.processingStatus === "PAUSED" && <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1" disabled={busy} onClick={() => act(it.id, "RESUME")}><Play className="h-3.5 w-3.5" /> Resume</Button>}
      </div>
    </div>
  )

  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Icon className="h-5 w-5 text-blue-600" /> {stageLabel(stage)} Department</h1>
        <p className="text-sm text-slate-500">{departmentFor(stage) || stageLabel(stage)} workstation · scan a garment or work the queue.</p>
      </div>

      <Card className="rounded-xl border-blue-200 bg-blue-50/40 shadow-sm"><CardContent className="p-4">
        <div className="flex items-center gap-3 max-w-2xl">
          <div className="relative flex-1"><ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500" /><Input autoFocus value={scanInput} onChange={(e) => setScanInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doScan()} placeholder={`Scan garment barcode for ${stageLabel(stage)}…`} className="pl-10 h-11 bg-white border-blue-200 font-mono" /></div>
          <Button onClick={doScan} disabled={scanning || !scanInput.trim()} className="h-11 gap-2 bg-blue-600 hover:bg-blue-700 text-white">{scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} Scan</Button>
        </div>
      </CardContent></Card>

      {loading ? <div className="py-12 text-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Clock className="h-[18px] w-[18px] text-amber-500" /> Waiting <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{waiting.length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-2">{waiting.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">Nothing waiting.</p> : waiting.map((it) => <ItemCard key={it.id} it={it} />)}</CardContent>
          </Card>
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Play className="h-[18px] w-[18px] text-blue-600" /> In Progress <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">{active.length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-2">{active.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">Nothing in progress.</p> : active.map((it) => <ItemCard key={it.id} it={it} />)}</CardContent>
          </Card>
        </div>
      )}

      {/* Scan popup */}
      <Dialog open={!!scan} onOpenChange={(o) => !o && setScan(null)}>
        <DialogContent className="max-w-lg">
          {scan && (<>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-blue-600" /> {scan.item.garmentName} <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">{scan.item.stageLabel} · {scan.item.processingStatus}</Badge></DialogTitle>
              <DialogDescription className="font-mono text-[11px]">{scan.item.barcode}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-slate-400 flex items-center gap-1"><User className="h-3 w-3" /> Customer</p><p className="text-slate-700">{scan.customer?.name || "—"}</p></div>
              <div><p className="text-xs text-slate-400 flex items-center gap-1"><ShoppingBag className="h-3 w-3" /> Order</p><p className="text-slate-700 font-mono text-xs">{scan.order.orderNumber}</p></div>
              <div><p className="text-xs text-slate-400">Service</p><p className="text-slate-700">{scan.item.serviceName}</p></div>
              <div><p className="text-xs text-slate-400">Department</p><p className="text-slate-700">{scan.currentDepartment}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {scan.item.processingStatus === "WAITING" && <Button className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" disabled={busy} onClick={() => act(scan.item.id, "START", true)}><Play className="h-4 w-4" /> Start</Button>}
              {scan.item.processingStatus === "IN_PROGRESS" && !isQC && <Button className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={busy} onClick={() => act(scan.item.id, "COMPLETE", true)}><Check className="h-4 w-4" /> Complete</Button>}
              {scan.item.processingStatus === "IN_PROGRESS" && isQC && <><Button className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={busy} onClick={() => act(scan.item.id, "QC_PASS", true)}><ShieldCheck className="h-4 w-4" /> QC Pass</Button><Button variant="outline" className="gap-1 text-rose-600 border-rose-200" disabled={busy} onClick={() => setQcFail({ itemId: scan.item.id, garment: scan.item.garmentName, flow: (scan.item as { processFlow?: string | null }).processFlow || null, serviceName: scan.item.serviceName, fromScan: true })}><ShieldX className="h-4 w-4" /> QC Fail</Button></>}
              {scan.item.processingStatus === "PAUSED" && <Button className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" disabled={busy} onClick={() => act(scan.item.id, "RESUME", true)}><Play className="h-4 w-4" /> Resume</Button>}
              {scan.item.processingStatus === "IN_PROGRESS" && <Button variant="outline" className="gap-1" disabled={busy} onClick={() => act(scan.item.id, "PAUSE", true)}><Pause className="h-4 w-4" /> Pause</Button>}
            </div>
            <div className="border-t pt-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Timeline</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {scan.timeline.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-xs"><Clock className="h-3 w-3 text-slate-300 shrink-0" /><span className="font-medium text-slate-700">{e.action.replace(/_/g, " ")}</span>{e.fromStage && e.toStage && e.fromStage !== e.toStage && <span className="text-slate-400 flex items-center gap-0.5">{stageLabel(e.fromStage)} <ArrowRight className="h-3 w-3" /> {stageLabel(e.toStage)}</span>}<span className="text-slate-400 ml-auto">{e.actorName || ""} · {fmt(e.createdAt)}</span></div>
                ))}
              </div>
            </div>
          </>)}
        </DialogContent>
      </Dialog>

      {/* Scan-first fallback confirm — advancing a garment from the queue
          without scanning its barcode is deliberate, not the default path. */}
      <Dialog open={!!manual} onOpenChange={(o) => !o && setManual(null)}>
        <DialogContent className="max-w-sm">
          {manual && (<>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-blue-600" /> Process without scanning?</DialogTitle>
              <DialogDescription className="text-xs">Scanning the barcode is the preferred way to act on <span className="font-medium text-slate-700">{manual.garment}</span>. Continue manually only if the scanner is unavailable.</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManual(null)}>Scan instead</Button>
              <Button className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" disabled={busy} onClick={async () => { const m = manual; setManual(null); await act(m.itemId, m.action) }}>{manual.label} manually</Button>
            </div>
          </>)}
        </DialogContent>
      </Dialog>

      {/* QC failure — reason + rework destination from the garment's route */}
      <Dialog open={!!qcFail} onOpenChange={(o) => { if (!o) { setQcFail(null); setQcReason(""); setQcStage("") } }}>
        <DialogContent className="max-w-md">
          {qcFail && (() => {
            const flow = parseFlow(qcFail.flow) ?? getFlow(qcFail.serviceName)
            const stages = reworkStagesOf(flow)
            return (<>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><ShieldX className="h-5 w-5 text-rose-500" /> QC Fail — {qcFail.garment}</DialogTitle>
                <DialogDescription className="text-xs">The garment returns to a processing step from its own route. History is preserved.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Failure Reason *</Label>
                  <Textarea value={qcReason} onChange={(e) => setQcReason(e.target.value)} rows={2} placeholder="e.g. Stain remains on collar" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Rework At</Label>
                  <Select value={qcStage || stages[0]} onValueChange={setQcStage}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{stages.map((st) => <SelectItem key={st} value={st}>{stageLabel(st)}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-[10px] text-slate-400">Route: {flow.map((f) => stageLabel(f)).join(" → ")}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setQcFail(null); setQcReason(""); setQcStage("") }}>Cancel</Button>
                <Button className="gap-1 bg-rose-600 hover:bg-rose-700 text-white" disabled={busy || !qcReason.trim()}
                  onClick={async () => {
                    await act(qcFail.itemId, "QC_FAIL", qcFail.fromScan, { note: qcReason.trim(), reworkStage: qcStage || stages[0] })
                    setQcFail(null); setQcReason(""); setQcStage("")
                  }}>
                  <ShieldX className="h-4 w-4" /> Confirm Fail & Rework
                </Button>
              </div>
            </>)
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
