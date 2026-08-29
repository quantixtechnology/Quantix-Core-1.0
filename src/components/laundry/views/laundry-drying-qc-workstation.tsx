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
import { Loader2, Play, Pause, Check, ShieldCheck, ShieldX, Clock, Undo2, Search, X, ScanLine } from "lucide-react"
import { stageLabel, parseFlow, getFlow, reworkStagesOf } from "@/lib/laundry-processing"
import { useLaundryPermissions } from "@/hooks/use-laundry-permissions"
import { useGarmentSearch } from "@/hooks/use-garment-search"
import { GarmentSearchResults } from "@/components/laundry/garment-search-results"
import { Level } from "@/lib/laundry-rbac-registry"
import { LaundryBarcodeScanner } from "@/components/laundry/laundry-barcode-scanner"
import { playScanOk, playScanError } from "@/lib/laundry-scan-sound"

interface Item {
  id: string; itemNumber: string | null; barcode: string | null; garmentScanCode?: string | null
  garmentName: string; serviceName: string | null; quantity: number
  orderNumber: string | null; customer: string | null
  processingStage: string | null; processingStatus: string | null; processFlow?: string | null
}

interface Completed {
  id: string; itemNumber: string | null; barcode: string | null; garmentScanCode?: string | null
  garmentName: string; serviceName: string | null; orderNumber: string | null
  action: string; actorName: string | null; completedAt: string; toStageLabel: string | null
}

// Unified Dry & Quality Check operator workstation (the SINGLE merged station in
// the approved model — there is no separate Drying or separate Quality Check).
// Layout: ONE sticky scan area pinned at the top, three panels (Waiting / In
// Progress / Completed) spanning both DRY and QC stages. The natural page scroll
// is the ONLY scroll container — there are no nested per-column scrollbars.
// Every card is keyed by its stable garment id so React updates cards in place
// instead of recreating the list; auto-refresh is diffed against a snapshot so
// an idle poll causes no re-render, no flicker, and can never reset the scroll.
// Actions = Pass / Fail (reprocess) / Return-to-queue. Garment barcodes are the
// tracking identity through this station; the bag is assigned later at Sorting.
export function LaundryDryingQcWorkstation() {
  const { currentBusinessId, user } = useAuthStore()
  const { level } = useLaundryPermissions()
  // Search is its own race-safe request lifecycle, independent of the queue
  // loader and the 12s poll — see use-garment-search.ts.
  const { query: search, setQuery: setSearch, clear: clearSearch, active: searching, results: searchResults, loading: searchLoading, error: searchError, truncated: searchTruncated, refresh: refreshSearch } = useGarmentSearch(currentBusinessId)
  const { toast } = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [completed, setCompleted] = useState<Completed[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [scanErr, setScanErr] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  // Same workstation permission as Start/Complete — see laundry-workstation.tsx.
  const hasReturnPerm = level("processing.quality_check") >= Level.CREATE
  const [offline, setOffline] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [qcFail, setQcFail] = useState<{ itemId: string; garment: string; flow: string | null; serviceName: string } | null>(null)
  const [qcReason, setQcReason] = useState("")
  const [qcStage, setQcStage] = useState("")

  const scanErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 })
  const snapshot = useRef("")

  const waiting = items.filter((i) => i.processingStatus === "WAITING")
  const active = items.filter((i) => i.processingStatus === "IN_PROGRESS" || i.processingStatus === "PAUSED")
  const inProgress = active.filter((i) => i.processingStatus === "IN_PROGRESS")

  // Diff-and-set: only touch state when the merged payload actually changed.
  // An idle poll therefore causes no re-render and can never reset the scroll.
  const apply = useCallback((mergedItems: Item[], mergedCompleted: Completed[]) => {
    const nextSnap = JSON.stringify({ items: mergedItems, completed: mergedCompleted })
    if (nextSnap === snapshot.current) return
    snapshot.current = nextSnap
    setItems(mergedItems)
    setCompleted(mergedCompleted)
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!currentBusinessId) return
    if (!silent) setLoading(true)
    try {
      const results = await Promise.all(
        ["DRY", "QC"].map((stage) =>
          fetch(`/api/laundry/processing?businessId=${encodeURIComponent(currentBusinessId)}&stage=${stage}`).then((r) => r.json()).catch(() => null),
        ),
      )
      const sound = results.find((r) => r && r.soundEnabled !== undefined)?.soundEnabled
      if (sound !== undefined) setSoundEnabled(sound)
      const mergedItems: Item[] = []
      const mergedCompleted: Completed[] = []
      for (const res of results) {
        if (!res) continue
        for (const it of res.items || []) mergedItems.push(it)
        for (const c of res.completed || []) mergedCompleted.push(c)
      }
      mergedCompleted.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))
      apply(mergedItems, mergedCompleted)
    } catch {
      setOffline(true)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [currentBusinessId, apply])

  // Loads per stage, then only on poll/focus. Typing never triggers it.
  useEffect(() => { load(false) }, [load])

  useAutoRefresh(() => load(true), { intervalMs: 12000 })


  const act = useCallback(async (itemId: string, expectedStage: string | null, action: string, extra: Record<string, unknown> = {}): Promise<boolean> => {
    setBusy(true); setOffline(false)
    try {
      const res = await fetch(`/api/laundry/items/${itemId}/process`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, actorName: user?.name || "operator", expectedStage, ...extra }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) {
        toast({ title: "Action failed", description: j.error === "Failed to fetch" ? "Server unreachable." : j.error, variant: "destructive" })
        return false
      }
      load(true)
      return true
    } catch {
      setOffline(true)
      toast({ title: "Unable to process garment", description: "Server unavailable.", variant: "destructive" })
      return false
    } finally { setBusy(false) }
  }, [user, toast, load])

  const handleBarcode = useCallback(async (code: string) => {
    setScanErr(null)
    if (scanErrTimer.current) clearTimeout(scanErrTimer.current)
    setOffline(false)

    const norm = code.trim().toUpperCase()
    const now = Date.now()
    if (norm && norm === lastScan.current.code && now - lastScan.current.at < 3500) {
      playScanError(soundEnabled)
      setScanErr("Same garment scanned again — ignored so it isn't pushed to the next step. Wait a moment.")
      scanErrTimer.current = setTimeout(() => setScanErr(null), 3000)
      return
    }
    lastScan.current = { code: norm, at: now }

    const showErr = (msg: string, ms = 3000) => {
      playScanError(soundEnabled); setScanErr(msg); scanErrTimer.current = setTimeout(() => setScanErr(null), ms)
    }

    let data: { item?: any; currentDepartment?: string } = {}
    try {
      const j = await fetch(`/api/laundry/scan?barcode=${encodeURIComponent(code)}`).then((r) => r.json())
      if (!j.success) { showErr(j.error || "Garment not found"); return }
      data = j.data
    } catch {
      setOffline(true); showErr("Unable to reach the server. Check your connection and scan again.", 5000); return
    }

    const item = data.item
    const garment = item?.garmentName || "Garment"
    if (item?.processingStage !== "DRY" && item?.processingStage !== "QC") {
      showErr(`"${garment}" belongs to ${data.currentDepartment || stageLabel(item?.processingStage) || "another department"}`)
      return
    }
    let action = ""
    if (item.processingStatus === "WAITING") action = "START"
    else if (item.processingStatus === "IN_PROGRESS") {
      showErr(`"${garment}" is already In Progress — use ${item.processingStage === "QC" ? "Pass" : "Complete"} (or the bulk action) to move it to the next step.`)
      return
    } else {
      showErr(`"${garment}" is ${(item.processingStatus || "unknown").replace(/_/g, " ")}`)
      return
    }

    try {
      const res = await fetch(`/api/laundry/items/${item.id}/process`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, actorName: user?.name || "operator", expectedStage: item.processingStage }),
      })
      const rj = await res.json()
      if (!res.ok || !rj.success) { showErr(rj?.error || "Action failed"); return }
    } catch {
      setOffline(true); showErr("Unable to reach the server.", 5000); return
    }

    playScanOk(soundEnabled)
    setFlashId(item.id)
    setTimeout(() => setFlashId(null), 700)
    load(true)
  }, [soundEnabled, load])

  const handleReturnToQueue = async (it: Item) => {
    if (!hasReturnPerm) { toast({ title: "Permission denied", description: "You don't have permission to return items to queue.", variant: "destructive" }); return }
    await act(it.id, it.processingStage, "RETURN", { note: `Returned to queue by ${user?.name || "operator"}` })
  }

  const toggleSelect = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allSelected = inProgress.length > 0 && inProgress.every((i) => selected.has(i.id))
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(inProgress.map((i) => i.id)))

  const qcFlow = qcFail ? parseFlow(qcFail.flow) ?? getFlow(qcFail.serviceName) : null
  const reworkStages = qcFlow ? reworkStagesOf(qcFlow) : []
  const reworkDefault = (qcStage || (qcFlow && reworkStages[0]) || "") as string

  const bulkAdvance = async () => {
    const targets = inProgress.filter((i) => selected.has(i.id))
    if (targets.length === 0) return
    setBusy(true); setOffline(false)
    let ok = 0; let fail = 0
    for (const item of targets) {
      const action = item.processingStage === "QC" ? "QC_PASS" : "COMPLETE"
      try {
        const res = await fetch(`/api/laundry/items/${item.id}/process`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, actorName: user?.name || "operator", expectedStage: item.processingStage }),
        })
        const j = await res.json()
        if (res.ok && j.success) { ok++ }
        else fail++
      } catch { fail++ }
    }
    setBusy(false); setSelected(new Set())
    playScanOk(soundEnabled)
    toast({ title: `${ok} garment${ok === 1 ? "" : "s"} moved to the next step`, description: fail ? `${fail} could not be moved — check the queue.` : "next step", variant: fail ? "destructive" : undefined, duration: 2500 })
    load(true)
  }

  const StageChip = ({ stage }: { stage: string | null }) => (
    <Badge variant="outline" className={stage === "QC" ? "border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px]" : "border-blue-300 text-blue-700 bg-blue-50 text-[10px]"}>
      {stage === "QC" ? "QC" : "Drying"}
    </Badge>
  )

  const ItemCard = ({ it, select }: { it: Item; select?: { checked: boolean; onToggle: () => void } }) => {
    const isQC = it.processingStage === "QC"
    return (
      <div className={`rounded-lg border p-3 bg-white ${flashId === it.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200"} ${select?.checked ? "border-emerald-400 bg-emerald-50/50" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {select && <input type="checkbox" aria-label={`Select ${it.garmentName}`} checked={select.checked} onChange={select.onToggle} className="h-4 w-4 shrink-0 accent-emerald-600 cursor-pointer" />}
              <p className="text-sm font-semibold text-slate-800 truncate">{it.garmentName}</p>
              <StageChip stage={it.processingStage} />
            </div>
            <p className="text-[11px] text-slate-400">{it.customer || "—"} · <span className="font-mono">{it.orderNumber}</span></p>
            <p className="text-[10px] font-mono text-slate-400 truncate">{it.garmentScanCode || it.barcode || it.itemNumber || "—"}</p>
          </div>
          {it.processingStatus === "PAUSED" && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-[10px]">Paused</Badge>}
        </div>
        <div className="flex gap-1.5 mt-2">
          {it.processingStatus === "WAITING" && (
            <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1" disabled={busy} onClick={() => act(it.id, it.processingStage, "START")}>
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
          )}
          {it.processingStatus === "IN_PROGRESS" && (
            <>
              <Button size="sm" variant="outline" className="h-8 gap-1" disabled={busy} onClick={() => act(it.id, it.processingStage, "PAUSE")}><Pause className="h-3.5 w-3.5" /></Button>
              {isQC ? (
                <>
                  <Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white flex-1" disabled={busy} onClick={() => act(it.id, it.processingStage, "QC_PASS")}><ShieldCheck className="h-3.5 w-3.5" /> Pass</Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-rose-600 border-rose-200" disabled={busy} onClick={() => setQcFail({ itemId: it.id, garment: it.garmentName, flow: it.processFlow || null, serviceName: it.serviceName || "" })}><ShieldX className="h-3.5 w-3.5" /></Button>
                </>
              ) : (
                <Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white flex-1" disabled={busy} onClick={() => act(it.id, it.processingStage, "COMPLETE")}><Check className="h-3.5 w-3.5" /> Complete</Button>
              )}
              {hasReturnPerm && <Button size="sm" variant="outline" className="h-8 gap-1 text-amber-600 border-amber-200" disabled={busy} onClick={() => handleReturnToQueue(it)}><Undo2 className="h-3.5 w-3.5" /></Button>}
            </>
          )}
          {it.processingStatus === "PAUSED" && (
            <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1" disabled={busy} onClick={() => act(it.id, it.processingStage, "RESUME", {})}><Play className="h-3.5 w-3.5" /> Resume</Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      {/* Sticky top: title + scan area + counts (pinned while the panels scroll). */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-6 pt-4 pb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-blue-600" /> Dry &amp; Quality Check
            <Badge className="border-indigo-300 text-indigo-700 bg-indigo-50 text-[10px] font-semibold">GARMENT TRACKING</Badge>
          </h1>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50"><Clock className="h-3 w-3 mr-1" /> {waiting.length} waiting</Badge>
            <Badge variant="outline" className="border-indigo-300 text-indigo-700 bg-indigo-50"><Play className="h-3 w-3 mr-1" /> {active.length} in progress</Badge>
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50"><Check className="h-3 w-3 mr-1" /> {completed.length} done</Badge>
          </div>
        </div>

        <Card className="rounded-xl border-blue-200 bg-blue-50/40 shadow-sm">
          <CardContent className="p-4">
            <LaundryBarcodeScanner onDetect={handleBarcode} departmentLabel="Dry & Quality Check" />
            {offline && <div className="mt-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">Unable to process garment. Server unavailable.</div>}
            {scanErr && !offline && <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{scanErr}</div>}
            <p className="mt-2 text-[11px] text-slate-500">Drying is completed here; every garment is checked for cleaning, stains, damage and customer instructions, then <span className="font-semibold">Pass / Fail / Reprocess</span>. On Pass the garment moves to <span className="font-semibold">Sorting</span>, where the order's bag is assigned — no bag is assigned at this station.</p>
          </CardContent>
        </Card>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find any garment by GAR / ITM / barcode, name or order no…"
            className="w-full h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          {searchLoading && <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />}
          {search && <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
        </div>
        {searching && (
          <GarmentSearchResults
            query={search} results={searchResults} loading={searchLoading}
            error={searchError} truncated={searchTruncated} stages={["DRY", "QC"]}
            canReturn={hasReturnPerm} busy={busy}
            onReturn={async (hit) => {
              if (!hasReturnPerm) { toast({ title: "Permission denied", description: "You don't have permission to return items to queue.", variant: "destructive" }); return }
              await act(hit.id, hit.processingStage, "RETURN", { note: `Returned to queue by ${user?.name || "operator"}` })
              refreshSearch(); load(true)
            }}
          />
        )}
      </div>

      {loading && !items.length ? (
        <div className="py-16 text-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : (
        <div className="px-4 lg:px-6 py-4">
          {/* Single page scroll (no nested per-column scrollbars). */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Clock className="h-[18px] w-[18px] text-amber-500" /> Waiting <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{waiting.length}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {waiting.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">Nothing waiting.</p> : waiting.map((it) => <ItemCard key={it.id} it={it} />)}
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Play className="h-[18px] w-[18px] text-blue-600" /> In Progress <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">{active.length}</Badge></CardTitle></CardHeader>
              {inProgress.length > 0 && (
                <div className="px-4 pb-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-4 w-4 accent-emerald-600 cursor-pointer" />
                    {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                  </label>
                  <Button size="sm" className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40" disabled={busy || selected.size === 0} onClick={bulkAdvance}>
                    <Check className="h-3.5 w-3.5" /> Move {selected.size || ""} → Next
                  </Button>
                </div>
              )}
              <CardContent className="space-y-2">
                {active.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">Nothing in progress.</p> : active.map((it) => (
                  <ItemCard key={it.id} it={it} select={it.processingStatus === "IN_PROGRESS" ? { checked: selected.has(it.id), onToggle: () => toggleSelect(it.id) } : undefined} />
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Check className="h-[18px] w-[18px] text-emerald-500" /> Completed <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">{completed.length}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {completed.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">{search ? "No completed garment matches that code." : "No garments completed here yet."}</p> : completed.map((c) => (
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
        </div>
      )}

      <Dialog open={!!qcFail} onOpenChange={(o) => { if (!o) { setQcFail(null); setQcReason(""); setQcStage("") } }}>
        <DialogContent className="max-w-md">
          {qcFail && (
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
                  <Select value={reworkDefault} onValueChange={setQcStage}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{reworkStages.map((st) => <SelectItem key={st} value={st}>{stageLabel(st)}</SelectItem>)}</SelectContent>
                  </Select>
                  {qcFlow && <p className="text-[10px] text-slate-400">Route: {qcFlow.map((f) => stageLabel(f)).join(" → ")}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setQcFail(null); setQcReason(""); setQcStage("") }}>Cancel</Button>
                <Button className="gap-1 bg-rose-600 hover:bg-rose-700 text-white" disabled={busy || !qcReason.trim()}
                  onClick={async () => {
                    if (!qcFail) return
                    await act(qcFail.itemId, "QC", "QC_FAIL", { note: qcReason.trim(), reworkStage: reworkDefault })
                    setQcFail(null); setQcReason(""); setQcStage("")
                  }}>
                  <ShieldX className="h-4 w-4" /> Confirm Fail &amp; Rework
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}