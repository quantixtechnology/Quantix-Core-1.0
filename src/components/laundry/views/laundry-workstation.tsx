"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Play, Pause, Check, ShieldCheck, ShieldX, Clock, Factory, Undo2 } from "lucide-react"
import { stageLabel, departmentFor, parseFlow, getFlow, reworkStagesOf } from "@/lib/laundry-processing"
import { LaundryBarcodeScanner } from "@/components/laundry/laundry-barcode-scanner"
import { playScanOk, playScanError } from "@/lib/laundry-scan-sound"

interface Item {
  id: string; itemNumber: string | null; barcode: string | null
  garmentName: string; serviceName: string; quantity: number
  orderNumber: string; customer: string | null
  processingStatus: string | null; processFlow?: string | null
}

interface ScanResult {
  item: { id: string; garmentName: string; serviceName: string; processingStage: string | null; processingStatus: string | null; barcode: string | null; processFlow?: string | null }
  order?: { orderNumber: string }
  currentDepartment?: string
}

// ── Centralised workstation scan engine (business rules, not UI) ─────────────
interface EngineOpts {
  stage: string; user: { name?: string | null } | null; currentBusinessId: string | null
  soundEnabled: boolean
}
async function engineScan(code: string, opts: EngineOpts): Promise<{ ok: true; action: string; garmentName: string; orderNumber: string } | { ok: false; error: string }> {
  const j = await fetch(`/api/laundry/scan?barcode=${encodeURIComponent(code)}`).then((r) => r.json())
  if (!j.success) return { ok: false, error: j.error || "Garment not found" }

  const d = j.data as ScanResult
  const item = d.item
  const garmentName = item.garmentName || "Garment"

  if (item.processingStage !== opts.stage) {
    const dept = d.currentDepartment || stageLabel(item.processingStage) || "another department"
    return { ok: false, error: `"${garmentName}" belongs to ${dept}` }
  }

  let action: string
  if (item.processingStatus === "WAITING") action = "START"
  else if (item.processingStatus === "IN_PROGRESS") action = opts.stage === "QC" ? "QC_PASS" : "COMPLETE"
  else return { ok: false, error: `"${garmentName}" is ${(item.processingStatus || "unknown").replace(/_/g, " ")}` }

  const actorName = opts.user?.name || "operator"
  const res = await fetch(`/api/laundry/items/${item.id}/process`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, actorName }),
  })
  const rj = await res.json()
  if (!res.ok || !rj.success) return { ok: false, error: rj.error || "Action failed" }

  return { ok: true, action, garmentName, orderNumber: d.order?.orderNumber || "" }
}

export function LaundryWorkstation({ stage, icon: Icon = Factory }: { stage: string; icon?: React.ComponentType<{ className?: string }> }) {
  const { currentBusinessId, user } = useAuthStore()
  const { toast } = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState<{ id: string; garmentName: string; orderNumber: string; action: string; completedAt: number }[]>([])
  const [flashId, setFlashId] = useState<string | null>(null)
  const [scanErr, setScanErr] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [hasReturnPerm, setHasReturnPerm] = useState(false)
  const [offline, setOffline] = useState(false)
  const isQC = stage === "QC"

  const [qcFail, setQcFail] = useState<{ itemId: string; garment: string; flow: string | null; serviceName: string } | null>(null)
  const [qcReason, setQcReason] = useState("")
  const [qcStage, setQcStage] = useState("")
  const [manual, setManual] = useState<{ itemId: string; garment: string; action: string; label: string } | null>(null)
  const scanErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/processing?businessId=${currentBusinessId}&stage=${stage}`).then((r) => r.json())
      setItems(j.items || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId, stage])
  useEffect(() => { load() }, [load])

  // Fetch business setting for scan sound + return_queue permission
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/processing?businessId=${currentBusinessId}&stage=${stage}`)
      .then((r) => r.json()).then((j) => {
        if (j.soundEnabled !== undefined) setSoundEnabled(j.soundEnabled)
      }).catch(() => { /* keep default */ })
    // Check for return_queue permission
    fetch(`/api/laundry/rbac/me?businessId=${encodeURIComponent(currentBusinessId)}`)
      .then((r) => r.json()).then((j) => {
        if (j.success && j.data) {
          const screenMap: Record<string, string> = {
            WASH: "washing", DRY: "drying", DRYCLEAN: "dry_cleaning",
            IRON: "ironing", FOLD: "folding", QC: "quality_check", PACKED: "packing",
          }
          const screen = screenMap[stage] || "washing"
          const key = `processing.${screen}.return_queue`
          setHasReturnPerm(j.data.isOwner || j.data.permissions?.includes(key))
        }
      }).catch(() => { /* noop */ })
  }, [currentBusinessId, stage])

  const act = useCallback(async (itemId: string, action: string, extra: Record<string, unknown> = {}): Promise<boolean> => {
    setBusy(true); setOffline(false)
    try {
      const res = await fetch(`/api/laundry/items/${itemId}/process`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, actorName: user?.name || "operator", ...extra }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) {
        toast({ title: "Action failed", description: j.error === "Failed to fetch" ? "Server unreachable." : j.error, variant: "destructive" })
        return false
      }
      load()
      return true
    } catch {
      setOffline(true)
      toast({ title: "Unable to process garment", description: "Server unavailable.", variant: "destructive" })
      return false
    } finally { setBusy(false) }
  }, [user?.name, toast, load])

  const handleBarcode = useCallback(async (code: string) => {
    setScanErr(null)
    if (scanErrTimer.current) clearTimeout(scanErrTimer.current)
    if (successTimer.current) clearTimeout(successTimer.current)
    setOffline(false)

    try {
      const result = await engineScan(code, { stage, user, currentBusinessId, soundEnabled })
      if (!result.ok) {
        playScanError(soundEnabled)
        setScanErr(result.error)
        scanErrTimer.current = setTimeout(() => setScanErr(null), 3000)
        return
      }

      playScanOk(soundEnabled)
      const actionLabel = result.action === "START" ? "Started" : result.action === "COMPLETE" || result.action === "QC_PASS" ? "Completed" : result.action

      toast({
        title: `${actionLabel} ${result.garmentName}`,
        description: `${stageLabel(stage)} → ${result.action === "START" ? "In Progress" : "Next stage"}`,
        duration: 800,
      })
      setCompleted((prev) => [{ id: result.garmentName + Date.now(), garmentName: result.garmentName, orderNumber: result.orderNumber, action: actionLabel, completedAt: Date.now() }, ...prev].slice(0, 20))
      load()
    } catch {
      playScanError(soundEnabled)
      setOffline(true)
      setScanErr("Unable to process garment. Server unavailable.")
      scanErrTimer.current = setTimeout(() => setScanErr(null), 5000)
    }
  }, [stage, user, currentBusinessId, soundEnabled, load])

  const handleReturnToQueue = async (itemId: string, garment: string) => {
    if (!hasReturnPerm) {
      toast({ title: "Permission denied", description: "You don't have permission to return items to queue.", variant: "destructive" })
      return
    }
    const ok = await act(itemId, "RETURN", { note: `Returned to queue by ${user?.name || "operator"}` })
    if (ok) {
      toast({ title: "Returned to queue", description: garment, duration: 1500 })
    }
  }

  const waiting = items.filter((i) => i.processingStatus === "WAITING")
  const active = items.filter((i) => i.processingStatus === "IN_PROGRESS" || i.processingStatus === "PAUSED")

  const ItemCard = ({ it, isCompleted = false }: { it: Item; isCompleted?: boolean }) => (
    <div className={`rounded-lg border p-3 bg-white transition-all duration-300 ${flashId === it.id ? "border-emerald-400 bg-emerald-50 shadow-md scale-[1.02]" : "border-slate-200"}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{it.garmentName}</p>
          <p className="text-[11px] text-slate-400">{it.customer || "—"} · <span className="font-mono">{it.orderNumber}</span></p>
        </div>
        {it.processingStatus === "PAUSED" && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-[10px]">Paused</Badge>}
      </div>
      <p className="text-[10px] font-mono text-slate-400 mt-1 truncate">{it.barcode}</p>
      {!isCompleted && (
        <div className="flex gap-1.5 mt-2">
          {it.processingStatus === "WAITING" && (
            <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1" disabled={busy} onClick={() => setManual({ itemId: it.id, garment: it.garmentName, action: "START", label: "Start" })}>
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
          )}
          {it.processingStatus === "IN_PROGRESS" && (
            <>
              <Button size="sm" variant="outline" className="h-8 gap-1" disabled={busy} onClick={() => act(it.id, "PAUSE")}>
                <Pause className="h-3.5 w-3.5" />
              </Button>
              {isQC ? (
                <>
                  <Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white flex-1" disabled={busy} onClick={() => act(it.id, "QC_PASS")}>
                    <ShieldCheck className="h-3.5 w-3.5" /> Pass
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-rose-600 border-rose-200" disabled={busy} onClick={() => setQcFail({ itemId: it.id, garment: it.garmentName, flow: it.processFlow || null, serviceName: it.serviceName })}>
                    <ShieldX className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white flex-1" disabled={busy} onClick={() => act(it.id, "COMPLETE")}>
                  <Check className="h-3.5 w-3.5" /> Complete
                </Button>
              )}
              {hasReturnPerm && (
                <Button size="sm" variant="outline" className="h-8 gap-1 text-amber-600 border-amber-200" disabled={busy} onClick={() => handleReturnToQueue(it.id, it.garmentName)}>
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
          {it.processingStatus === "PAUSED" && (
            <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1" disabled={busy} onClick={() => act(it.id, "RESUME")}>
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Icon className="h-5 w-5 text-blue-600" /> {stageLabel(stage)} Department
        </h1>
        <p className="text-sm text-slate-500">{departmentFor(stage) || stageLabel(stage)} workstation · scan a garment barcode to start or complete.</p>
      </div>

      <Card className="rounded-xl border-blue-200 bg-blue-50/40 shadow-sm">
        <CardContent className="p-4">
          <LaundryBarcodeScanner onDetect={handleBarcode} departmentLabel={stageLabel(stage)} />
          {offline && (
            <div className="mt-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              Unable to process garment. Server unavailable.
            </div>
          )}
          {scanErr && !offline && (
            <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {scanErr}
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-12 text-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Clock className="h-[18px] w-[18px] text-amber-500" /> Waiting <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{waiting.length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[65vh] overflow-y-auto">
              {waiting.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">Nothing waiting.</p> : waiting.map((it) => <ItemCard key={it.id} it={it} />)}
            </CardContent>
          </Card>
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Play className="h-[18px] w-[18px] text-blue-600" /> In Progress <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">{active.length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[65vh] overflow-y-auto">
              {active.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">Nothing in progress.</p> : active.map((it) => <ItemCard key={it.id} it={it} />)}
            </CardContent>
          </Card>
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Check className="h-[18px] w-[18px] text-emerald-500" /> Completed <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">{completed.length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[65vh] overflow-y-auto">
              {completed.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">No items completed this session.</p> : completed.map((c) => (
                <div key={`${c.id}-${c.completedAt}`} className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">{c.garmentName}</p>
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px]">{c.action}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-1">{c.orderNumber}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(c.completedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={!!manual} onOpenChange={(o) => !o && setManual(null)}>
        <DialogContent className="max-w-sm">
          {manual && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Play className="h-5 w-5 text-blue-600" /> Process without scanning?</DialogTitle>
                <DialogDescription className="text-xs">Scanning the barcode is the preferred way to act on <span className="font-medium text-slate-700">{manual.garment}</span>. Continue manually only if the scanner is unavailable.</DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setManual(null); setTimeout(() => document.getElementById("laundry-barcode-scanner-input")?.focus(), 50) }}>Scan Instead</Button>
                <Button className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" disabled={busy} onClick={async () => { const m = manual; setManual(null); await act(m.itemId, m.action) }}>{manual.label} manually</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!qcFail} onOpenChange={(o) => { if (!o) { setQcFail(null); setQcReason(""); setQcStage("") } }}>
        <DialogContent className="max-w-md">
          {qcFail && (() => {
            const flow = parseFlow(qcFail.flow) ?? getFlow(qcFail.serviceName)
            const stages = reworkStagesOf(flow)
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><ShieldX className="h-5 w-5 text-rose-500" /> QC Fail — {qcFail.garment}</DialogTitle>
                  <DialogDescription className="text-xs">The garment returns to a processing step. History is preserved.</DialogDescription>
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
                      await act(qcFail.itemId, "QC_FAIL", { note: qcReason.trim(), reworkStage: qcStage || stages[0] })
                      setQcFail(null); setQcReason(""); setQcStage("")
                    }}>
                    <ShieldX className="h-4 w-4" /> Confirm Fail & Rework
                  </Button>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
