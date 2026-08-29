"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Play, Pause, Check, ShieldCheck, ShieldX, Clock, Factory, Undo2, Search, X, ScanLine } from "lucide-react"
import { stageLabel, departmentFor, parseFlow, getFlow, reworkStagesOf } from "@/lib/laundry-processing"
import { useLaundryPermissions } from "@/hooks/use-laundry-permissions"
import { useGarmentSearch } from "@/hooks/use-garment-search"
import { GarmentSearchResults } from "@/components/laundry/garment-search-results"
import { Level } from "@/lib/laundry-rbac-registry"

// Workstation stage → RBAC screen. Mirrors STAGE_SCREEN in the process endpoint,
// so the button and the server agree on which permission governs the station.
const SCREEN_OF_STAGE: Record<string, string> = {
  WASH: "washing", DRYCLEAN: "dry_cleaning",
  IRON: "ironing", FOLD: "folding", QC: "quality_check",
}
import { LaundryBarcodeScanner } from "@/components/laundry/laundry-barcode-scanner"
import { playScanOk, playScanError } from "@/lib/laundry-scan-sound"
import { BagScanButton } from "@/components/laundry/bag-scanner"
import { LaundryWorkloadSummary } from "@/components/laundry/workload-summary"
import { summariseWorkload } from "@/lib/laundry-workload"

interface Item {
  id: string; itemNumber: string | null; barcode: string | null
  garmentName: string; serviceName: string; quantity: number
  orderNumber: string; customer: string | null
  processingStatus: string | null; processFlow?: string | null
  weightKg?: number | null
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
async function engineScan(code: string, opts: EngineOpts): Promise<{ ok: true; action: string; garmentName: string; orderNumber: string; nextStage: string | null } | { ok: false; error: string }> {
  const j = await fetch(`/api/laundry/scan?barcode=${encodeURIComponent(code)}`).then((r) => r.json())
  if (!j.success) return { ok: false, error: j.error || "Garment not found" }

  const d = j.data as ScanResult
  const item = d.item
  const garmentName = item.garmentName || "Garment"

  if (item.processingStage !== opts.stage) {
    const dept = d.currentDepartment || stageLabel(item.processingStage) || "another department"
    return { ok: false, error: `"${garmentName}" belongs to ${dept}` }
  }

  // A SCAN only ever STARTS a garment (puts it In Progress). It must NEVER
  // advance a garment to the next service — moving on is a deliberate action via
  // the Complete / Pass button (or the load's bulk action). This prevents a
  // second scan from silently pushing a garment into a stage it isn't ready for.
  let action: string
  if (item.processingStatus === "WAITING") action = "START"
  else if (item.processingStatus === "IN_PROGRESS")
    return { ok: false, error: `"${garmentName}" is already In Progress — use ${opts.stage === "QC" ? "Pass" : "Complete"} (or the load's bulk action) to move it to the next stage.` }
  else return { ok: false, error: `"${garmentName}" is ${(item.processingStatus || "unknown").replace(/_/g, " ")}` }

  const actorName = opts.user?.name || "operator"
  const res = await fetch(`/api/laundry/items/${item.id}/process`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, actorName, expectedStage: opts.stage }),
  })
  const rj = await res.json()
  if (!res.ok || !rj.success) return { ok: false, error: rj.error || "Action failed" }

  return { ok: true, action, garmentName, orderNumber: d.order?.orderNumber || "", nextStage: rj.data?.processingStage ?? null }
}

// Stages that show the workload summary. Washing and Dry Cleaning are the
// garment-weight departments where an operator plans by load; add a stage here
// to surface it elsewhere — nothing else needs to change.
const SHOW_WORKLOAD_SUMMARY = new Set(["WASH", "DRYCLEAN"])

export function LaundryWorkstation({ stage, icon: Icon = Factory }: { stage: string; icon?: React.ComponentType<{ className?: string }> }) {
  const { currentBusinessId, user } = useAuthStore()
  const { level } = useLaundryPermissions()
  // Search is its OWN request lifecycle — see use-garment-search.ts. It is
  // deliberately NOT part of the queue loader below, which the 12s poll drives:
  // that shared dependency is what made typing race the poll and flicker.
  const { query: search, setQuery: setSearch, clear: clearSearch, active: searching, results: searchResults, loading: searchLoading, error: searchError, truncated: searchTruncated, refresh: refreshSearch } = useGarmentSearch(currentBusinessId)
  const { toast } = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  // TRUE per-status counts from the server. The rendered lists are paged; these
  // are not, so a column's number is the database's number.
  const [queueCounts, setQueueCounts] = useState<Record<string, number> | null>(null)
  const [completed, setCompleted] = useState<{ id: string; itemId?: string; itemNumber: string | null; barcode: string | null; garmentScanCode: string | null; garmentName: string; serviceName: string | null; orderNumber: string | null; action: string; actorName: string | null; completedAt: string; toStageLabel: string | null; weightKg?: number | null }[]>([])
  const [flashId, setFlashId] = useState<string | null>(null)
  const [scanErr, setScanErr] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  // Return to Queue takes the workstation's OWN permission — the same one Start
  // and Complete require. It used to read `permissions` off /rbac/me, a field
  // that response has never contained, against `…return_queue`, an action that
  // is never issued: the check was `isOwner || undefined`, so only owners saw
  // the button. Accountant holds EDIT on every processing screen and was locked
  // out of a correction it is fully entitled to make.
  const screenKey = `processing.${SCREEN_OF_STAGE[stage] || "washing"}`
  const hasReturnPerm = level(screenKey) >= Level.CREATE
  const [offline, setOffline] = useState(false)
  const isQC = stage === "QC"

  const [qcFail, setQcFail] = useState<{ itemId: string; garment: string; flow: string | null; serviceName: string } | null>(null)
  const [qcReason, setQcReason] = useState("")
  const [qcStage, setQcStage] = useState("")
  // Order-Based Finishing Bag: when the LAST garment of an order passes QC the
  // order becomes eligible for its ONE finishing container. Prompt the operator
  // to scan the configured container (Bag / Package / Both) once — assigning it
  // binds every garment of the order and retires all garment barcodes.
  const [bagPrompt, setBagPrompt] = useState<{ orderId: string; orderNumber: string | null } | null>(null)
  const [bagTarget, setBagTarget] = useState<{ label: string; hint: string } | null>(null)
  const [bagErr, setBagErr] = useState<string | null>(null)
  const [manual, setManual] = useState<{ itemId: string; garment: string; action: string; label: string } | null>(null)
  // Bulk-advance selection: ids of IN_PROGRESS garments ticked to move together
  // (e.g. a whole wash load finishing at once). Cleared after each bulk action.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const scanErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 })

  const load = useCallback(async (silent = false) => {
    if (!currentBusinessId) return
    if (!silent) setLoading(true)
    try {
      const p = new URLSearchParams({ businessId: currentBusinessId, stage })
      const j = await fetch(`/api/laundry/processing?${p}`).then((r) => r.json())
      setItems(j.items || [])
      setCompleted(j.completed || [])
      setQueueCounts(j.queueCounts || null)
    } catch { /* noop */ } finally { if (!silent) setLoading(false) }
  }, [currentBusinessId, stage])
  // The queue loads once per stage and then only on the poll/focus. Typing no
  // longer triggers it at all, so the columns cannot blank or flash mid-search.
  useEffect(() => { load(false) }, [load])
  // Keep the department queue live: refresh on tab focus + a light poll so a
  // garment moved here from an earlier stage appears without a manual refresh.
  useAutoRefresh(() => load(true), { intervalMs: 12000 })

  // Fetch business setting for scan sound
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/processing?businessId=${currentBusinessId}&stage=${stage}`)
      .then((r) => r.json()).then((j) => {
        if (j.soundEnabled !== undefined) setSoundEnabled(j.soundEnabled)
      }).catch(() => { /* keep default */ })
  }, [currentBusinessId, stage])

  const act = useCallback(async (itemId: string, action: string, extra: Record<string, unknown> = {}): Promise<boolean> => {
    setBusy(true); setOffline(false)
    try {
      const res = await fetch(`/api/laundry/items/${itemId}/process`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, actorName: user?.name || "operator", expectedStage: stage, ...extra }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) {
        toast({ title: "Action failed", description: j.error === "Failed to fetch" ? "Server unreachable." : j.error, variant: "destructive" })
        return false
      }
      // The last QC pass makes the order eligible for its finishing bag → prompt.
      if (action === "QC_PASS" && j.data?.awaitingBagAssignment) {
        const w = j.data.awaitingBagAssignment
        setBagErr(null)
        setBagPrompt({ orderId: w.orderId, orderNumber: w.orderNumber || null })
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

    // Same-garment guard: a rapid repeat scan of the SAME code (accidental
    // double-trigger, or the operator scanning twice) must NOT cascade
    // START → COMPLETE and push the garment to the next stage. One scan does one
    // step; to complete, scan again after a moment (or use the on-card buttons).
    const norm = code.trim().toUpperCase()
    const now = Date.now()
    if (norm && norm === lastScan.current.code && now - lastScan.current.at < 3500) {
      playScanError(soundEnabled)
      setScanErr("Same garment scanned again — ignored so it isn't pushed to the next stage. Wait a moment, then scan again to complete.")
      scanErrTimer.current = setTimeout(() => setScanErr(null), 3000)
      return
    }
    lastScan.current = { code: norm, at: now }

    try {
      const result = await engineScan(code, { stage, user, currentBusinessId, soundEnabled })
      if (!result.ok) {
        playScanError(soundEnabled)
        setScanErr(result.error)
        scanErrTimer.current = setTimeout(() => setScanErr(null), 3000)
        return
      }

      playScanOk(soundEnabled)
      const isStart = result.action === "START"
      const actionLabel = isStart ? "Started" : result.action === "COMPLETE" || result.action === "QC_PASS" ? "Completed" : result.action
      // Name the destination so a garment that LEAVES this stage is never "lost".
      // PACKED means processing is finished (there is no per-garment packing queue —
      // the ORDER is packed later in Packing & QR), so say so plainly.
      const moved = isStart
        ? "In Progress"
        : result.nextStage === "PACKED"
          ? "Processing complete — ready for Packing & QR"
          : result.nextStage && result.nextStage !== stage
            ? `Moved to ${stageLabel(result.nextStage)}`
            : "Done"

      toast({
        title: `${actionLabel} ${result.garmentName}`,
        description: `${stageLabel(stage)} → ${moved}`,
        duration: 2000,
      })
      load() // refresh queue + persisted Completed history
    } catch {
      playScanError(soundEnabled)
      setOffline(true)
      setScanErr("Unable to process garment. Server unavailable.")
      scanErrTimer.current = setTimeout(() => setScanErr(null), 5000)
    }
  }, [stage, user, currentBusinessId, soundEnabled, load])

  // Load the Workspace Scan Mode label whenever a bag-assignment prompt opens.
  useEffect(() => {
    if (!bagPrompt || !currentBusinessId) return
    fetch(`/api/laundry/processing/finishing-bag?businessId=${encodeURIComponent(currentBusinessId)}`)
      .then((r) => r.json()).then((j) => {
        if (j.success && j.data?.target) setBagTarget({ label: j.data.target.label, hint: j.data.target.hint || "" })
      }).catch(() => setBagTarget({ label: "container", hint: "" }))
  }, [bagPrompt, currentBusinessId])

  const handleAssignFinishingBag = async (code: string) => {
    if (!bagPrompt || !currentBusinessId) return
    setBusy(true); setBagErr(null)
    try {
      const res = await fetch("/api/laundry/processing/finishing-bag", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, orderId: bagPrompt.orderId, code, actorName: user?.name || "operator" }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) {
        playScanError(soundEnabled)
        setBagErr(j.error || "Could not assign the finishing bag.")
        return
      }
      playScanOk(soundEnabled)
      const label = bagTarget?.label.replace(/^Scan /, "") || "container"
      toast({ title: `Finishing bag assigned`, description: `Order ${bagPrompt.orderNumber || ""} → ${label} ${code}; garment barcodes retired.`, duration: 2500 })
      setBagPrompt(null)
      load()
    } catch {
      setOffline(true); setBagErr("Unable to reach the server. Try again.")
    } finally { setBusy(false) }
  }

  const handleReturnToQueue = async (itemId: string, garment: string) => {
    if (!hasReturnPerm) {
      toast({ title: "Permission denied", description: "You don't have permission to return items to queue.", variant: "destructive" })
      return
    }
    const ok = await act(itemId, "RETURN", { note: `Returned to queue by ${user?.name || "operator"}` })
    if (ok) {
      toast({ title: "Returned to queue", description: garment, duration: 1500 })
    }
    return ok
  }

  const waiting = items.filter((i) => i.processingStatus === "WAITING")
  const active = items.filter((i) => i.processingStatus === "IN_PROGRESS" || i.processingStatus === "PAUSED")
  // Workload summary — computed from `items` / `completed` on every render, so
  // it is the same server data the three columns below are showing. No stored
  // counter, nothing to go stale after a scan, Start, Complete or refresh.
  const workload = summariseWorkload(items, completed.map((c) => ({ itemId: c.itemId ?? c.id, weightKg: c.weightKg })))
  // Counts come from the server's unpaged totals when available; the rendered
  // lists can be a page of a long queue, so their length is not the count.
  const waitingCount = queueCounts?.WAITING ?? waiting.length
  const activeCount = queueCounts?.active ?? active.length
  // The summary tiles show the same true counts as the column badges. Weight
  // still comes from the loaded rows, so it is flagged as partial when the
  // queue is longer than one page rather than quietly understating the load.
  const workloadView = {
    ...workload,
    pending: { ...workload.pending, garments: waitingCount, missingWeight: workload.pending.missingWeight + Math.max(0, waitingCount - waiting.length) },
    processing: { ...workload.processing, garments: activeCount, missingWeight: workload.processing.missingWeight + Math.max(0, activeCount - active.length) },
  }
  const inProgress = active.filter((i) => i.processingStatus === "IN_PROGRESS")

  // Keep the selection in sync with what's actually still in progress (a garment
  // completed on its own card, or moved here/away by the poll, drops out).
  useEffect(() => {
    setSelected((prev) => {
      const live = new Set(inProgress.map((i) => i.id))
      let changed = false
      const next = new Set<string>()
      prev.forEach((id) => { if (live.has(id)) next.add(id); else changed = true })
      return changed ? next : prev
    })
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSelected = inProgress.length > 0 && inProgress.every((i) => selected.has(i.id))
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(inProgress.map((i) => i.id)))

  // Bulk advance: complete (or QC-pass) every selected in-progress garment. Each
  // goes through the same server-guarded single-item endpoint, so partial
  // failures are reported without blocking the rest.
  const bulkAdvance = async () => {
    const ids = inProgress.filter((i) => selected.has(i.id)).map((i) => i.id)
    if (ids.length === 0) return
    setBusy(true); setOffline(false)
    let ok = 0; let fail = 0
    let awaitingBag: { orderId: string; orderNumber: string | null } | null = null
    for (const id of ids) {
      try {
        const res = await fetch(`/api/laundry/items/${id}/process`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: isQC ? "QC_PASS" : "COMPLETE", actorName: user?.name || "operator", expectedStage: stage }),
        })
        const j = await res.json()
        if (res.ok && j.success) { ok++; if (j.data?.awaitingBagAssignment) awaitingBag = { orderId: j.data.awaitingBagAssignment.orderId, orderNumber: j.data.awaitingBagAssignment.orderNumber || null } }
        else fail++
      } catch { fail++ }
    }
    setBusy(false); setSelected(new Set())
    if (awaitingBag) { setBagErr(null); setBagPrompt(awaitingBag) }
    playScanOk(soundEnabled)
    toast({
      title: `${ok} garment${ok === 1 ? "" : "s"} moved to the next stage`,
      description: fail ? `${fail} could not be moved — check the queue and retry.` : `${stageLabel(stage)} → next process`,
      variant: fail ? "destructive" : undefined,
      duration: 2500,
    })
    load()
  }

  const ItemCard = ({ it, isCompleted = false, select }: { it: Item; isCompleted?: boolean; select?: { checked: boolean; onToggle: () => void } }) => (
    <div className={`rounded-lg border p-3 bg-white transition-all duration-300 ${select?.checked ? "border-emerald-400 bg-emerald-50/50" : flashId === it.id ? "border-emerald-400 bg-emerald-50 shadow-md scale-[1.02]" : "border-slate-200"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {select && (
            <input type="checkbox" aria-label={`Select ${it.garmentName}`} checked={select.checked} onChange={select.onToggle} className="h-4 w-4 shrink-0 accent-emerald-600 cursor-pointer" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{it.garmentName}</p>
            <p className="text-[11px] text-slate-400">{it.customer || "—"} · <span className="font-mono">{it.orderNumber}</span></p>
          </div>
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
          <Badge className="border-indigo-300 text-indigo-700 bg-indigo-50 text-[10px] font-semibold">GARMENT TRACKING</Badge>
        </h1>
        <p className="text-sm text-slate-500">{departmentFor(stage) || stageLabel(stage)} workstation · scan a garment barcode to start or complete.</p>
      </div>

      {/* Workload at a glance — the primary indicator for the operator. The
          Waiting / In Progress / Completed columns below are unchanged. */}
      {SHOW_WORKLOAD_SUMMARY.has(stage) && <LaundryWorkloadSummary summary={workloadView} loading={loading} />}

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

      {/* Find a garment ANYWHERE in this business by its code — a wrongly-added
          cloth is usually not at the station you are standing at. The input is
          rendered unconditionally and never re-keyed, so focus, cursor and text
          survive every keystroke and every background refresh. */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find any garment by GAR / ITM / barcode, name or order no…"
          className="w-full h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {/* Inline indicator only. The page spinner belongs to the first load. */}
        {searchLoading && <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />}
        {search && <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
      </div>

      {searching && (
        <GarmentSearchResults
          query={search} results={searchResults} loading={searchLoading}
          error={searchError} truncated={searchTruncated} stages={[stage]}
          canReturn={hasReturnPerm} busy={busy}
          onReturn={async (hit) => { const ok = await handleReturnToQueue(hit.id, hit.garmentName); if (ok) { refreshSearch(); load(true) } }}
        />
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Clock className="h-[18px] w-[18px] text-amber-500" /> Waiting <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{waitingCount}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[65vh] overflow-y-auto">
              {waiting.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">Nothing waiting.</p> : waiting.map((it) => <ItemCard key={it.id} it={it} />)}
            </CardContent>
          </Card>
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Play className="h-[18px] w-[18px] text-blue-600" /> In Progress <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">{activeCount}</Badge></CardTitle></CardHeader>
            {/* Bulk-advance bar: when a whole load finishes, tick the garments and
                move them all to the next stage in one action (no per-card clicks). */}
            {inProgress.length > 0 && (
              <div className="px-4 pb-2 flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-4 w-4 accent-emerald-600 cursor-pointer" />
                  {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                </label>
                <Button size="sm" className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40" disabled={busy || selected.size === 0} onClick={bulkAdvance}>
                  <Check className="h-3.5 w-3.5" /> {isQC ? "Pass" : "Complete"} {selected.size || ""} → Next
                </Button>
              </div>
            )}
            <CardContent className="space-y-2 max-h-[65vh] overflow-y-auto">
              {active.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">Nothing in progress.</p> : active.map((it) => (
                <ItemCard key={it.id} it={it} select={it.processingStatus === "IN_PROGRESS" ? { checked: selected.has(it.id), onToggle: () => toggleSelect(it.id) } : undefined} />
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Check className="h-[18px] w-[18px] text-emerald-500" /> Completed <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">{completed.length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[65vh] overflow-y-auto">
              {completed.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">{search ? "No completed garment matches that code." : "No garments completed at this stage yet."}</p> : completed.map((c) => (
                <div key={c.id} className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{c.garmentName}{c.serviceName ? <span className="text-slate-400 font-normal"> · {c.serviceName}</span> : ""}</p>
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px] shrink-0">{c.action}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-1">{c.garmentScanCode || c.barcode || c.itemNumber || "—"}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{c.orderNumber}</p>
                  {c.toStageLabel && <p className="text-[11px] text-blue-600 mt-0.5 font-medium">→ Moved to {c.toStageLabel}</p>}
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(c.completedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{c.actorName ? ` · ${c.actorName}` : ""}</p>
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

      {/* Order-Based Finishing Bag — triggered the moment the last garment of an
          order passes QC. One scan assigns the configured container to the WHOLE
          order and retires all its garment barcodes (no per-garment bag scans). */}
      <Dialog open={!!bagPrompt} onOpenChange={(o) => { if (!o) { setBagPrompt(null); setBagErr(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-blue-600" /> Assign Finishing Bag</DialogTitle>
            <DialogDescription className="text-xs">
              Order {bagPrompt?.orderNumber || ""} has passed Quality Check. Scan the {bagTarget?.label || "configured container"}{bagTarget?.hint ? <span className="font-mono"> ({bagTarget.hint})</span> : null} once to associate every garment with it and retire the garment barcodes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <BagScanButton onScan={(code) => handleAssignFinishingBag(code)} label={`Scan ${bagTarget?.label || ""}`.replace(/\s+/g, " ")} closeOnScan={false} disabled={busy} />
            <p className="text-[11px] text-slate-400 text-center">Ironing, Folding and Packing will then load this container only — garments are no longer scanned individually.</p>
          </div>
          {bagErr && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{bagErr}</p>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
