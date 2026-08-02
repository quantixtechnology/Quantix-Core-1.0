"use client"

// Finishing workstation (Iron / Folding) — the container-based stage
// AFTER Quality Check. Garment barcodes are no longer scanned here: the operator
// scans the configured container (Processing Package QR, or the reused bag QR —
// the workspace scan-mode setting decides the label; both resolve the same
// batch), which loads EVERY garment belonging to that container. Each garment is
// then started / completed in place — no per-garment scanning. Packing is
// unchanged and receives the finished garments as before.

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, Play, Pause, Check, Undo2, Factory, QrCode, RefreshCw, ScanLine, Package, Shirt, ShieldCheck } from "lucide-react"
import { stageLabel } from "@/lib/laundry-processing"
import { BagScanButton } from "@/components/laundry/bag-scanner"
import { playScanOk, playScanError } from "@/lib/laundry-scan-sound"

type ContainerSummary = {
  id: string; code: string; status: string; orderId: string; orderNumber: string | null
  serviceName: string | null; garmentCount: number; atStage: number
  customer: string | null; updatedAt: string
}
type Garment = {
  id: string; itemNumber: string | null; barcode: string | null; garmentScanCode: string | null
  garmentName: string; serviceName: string | null; quantity: number
  processingStage: string | null; processingStatus: string | null; stageLabel: string
  hasPassedQc: boolean; atThisStage: boolean
}
type ContainerDetail = {
  package: { id: string; code: string; status: string; serviceName: string | null; garmentCount: number; updatedAt: string }
  order: { id: string; orderNumber: string; status: string }
  customer: string | null; store: string | null
  garments: Garment[]
  summary: { atStage: number; awaitingQc: number; finished: number }
}

const fmt = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")

export function LaundryFinishingWorkstation({ stage, icon: Icon = Shirt }: { stage: string; icon?: React.ComponentType<{ className?: string }> }) {
  const { currentBusinessId, user } = useAuthStore()
  const { toast } = useToast()
  const [mode, setMode] = useState("GENERATE_NEW")
  const [scanTarget, setScanTarget] = useState("Scan Processing Package QR")
  const [scanHint, setScanHint] = useState("PKG-…")
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [hasReturnPerm, setHasReturnPerm] = useState(false)
  const [containers, setContainers] = useState<ContainerSummary[]>([])
  const [active, setActive] = useState<ContainerDetail | null>(null)
  const [code, setCode] = useState("")
  const [looking, setLooking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [scanErr, setScanErr] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scanErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!currentBusinessId) return
    if (!silent) setLoading(true)
    try {
      const j = await fetch(`/api/laundry/processing/finishing?businessId=${currentBusinessId}&stage=${stage}`).then((r) => r.json())
      if (j.success && j.data) {
        setMode(j.data.mode || "GENERATE_NEW")
        setScanTarget(j.data.target?.label || "Scan Processing Package QR")
        setScanHint(j.data.target?.hint || "PKG-…")
        if (j.data.soundEnabled !== undefined) setSoundEnabled(j.data.soundEnabled)
        setContainers(j.data.containers || [])
      }
    } catch { /* noop */ } finally { if (!silent) setLoading(false) }
  }, [currentBusinessId, stage])
  const firstLoad = useRef(true)
  useEffect(() => {
    const t = setTimeout(() => { load(!firstLoad.current); firstLoad.current = false }, 0)
    return () => clearTimeout(t)
  }, [load])
  useAutoRefresh(() => load(true), { intervalMs: 12000 })

  // Return-to-queue permission (same key as the other workstations).
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/rbac/me?businessId=${encodeURIComponent(currentBusinessId)}`)
      .then((r) => r.json()).then((j) => {
        if (j.success && j.data) {
          const screenMap: Record<string, string> = { IRON: "ironing", FOLD: "folding" }
          const key = `processing.${screenMap[stage] || "ironing"}.return_queue`
          setHasReturnPerm(j.data.isOwner || j.data.permissions?.includes(key))
        }
      }).catch(() => { /* noop */ })
  }, [currentBusinessId, stage])

  const resolve = useCallback(async (raw?: string, containerId?: string) => {
    if (!currentBusinessId) return
    setLooking(true); setOffline(false); setScanErr(null)
    if (scanErrTimer.current) clearTimeout(scanErrTimer.current)
    try {
      const p = new URLSearchParams({ businessId: currentBusinessId, stage })
      if (containerId) p.set("containerId", containerId)
      else {
        const q = (raw ?? code).trim()
        if (!q) return
        p.set("code", q)
      }
      const res = await fetch(`/api/laundry/processing/finishing?${p}`)
      const j = await res.json()
      if (!res.ok || !j.success) {
        playScanError(soundEnabled)
        setScanErr(j.error || "Could not load the container.")
        scanErrTimer.current = setTimeout(() => setScanErr(null), 4000)
        return
      }
      if (!j.data?.container) {
        playScanError(soundEnabled)
        setScanErr("No garments in this container yet — nothing to process here.")
        return
      }
      playScanOk(soundEnabled)
      setActive(j.data.container)
      setCode("")
      if (inputRef.current) { inputRef.current.value = ""; inputRef.current.focus() }
      toast({
        title: `${j.data.container.package.code} · ${j.data.container.order.orderNumber}`,
        description: `${j.data.container.summary.atStage} garment(s) at ${stageLabel(stage)} · ${j.data.container.customer || "—"}`,
        duration: 2500,
      })
    } catch {
      playScanError(soundEnabled)
      setOffline(true)
      setScanErr("Unable to reach the server. Check your connection and scan again.")
    } finally { setLooking(false) }
  }, [currentBusinessId, stage, code, soundEnabled])

  const act = useCallback(async (itemId: string, action: string, garment: string) => {
    setBusy(true); setOffline(false)
    try {
      const res = await fetch(`/api/laundry/items/${itemId}/process`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, actorName: user?.name || "operator", expectedStage: stage, fromContainer: true }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) {
        playScanError(soundEnabled)
        toast({ title: "Action failed", description: j.error === "Failed to fetch" ? "Server unreachable." : j.error, variant: "destructive" })
        return false
      }
      playScanOk(soundEnabled)
      const label = action === "START" ? "Started" : action === "PAUSE" ? "Paused" : action === "RESUME" ? "Resumed" : action === "RETURN" ? "Returned to queue" : "Completed"
      toast({ title: `${label} ${garment}`, description: `${stageLabel(stage)} → ${j.data.processingStage === "PACKED" ? "Processing complete — ready for Packing & QR" : `${stageLabel(j.data.processingStage)}`}`, duration: 2000 })
      // Refresh the container (garment moved on) + the waiting list.
      if (active) await resolve(undefined, active.package.id)
      load(true)
      return true
    } catch {
      setOffline(true)
      playScanError(soundEnabled)
      toast({ title: "Unable to process garment", description: "Server unavailable.", variant: "destructive" })
      return false
    } finally { setBusy(false) }
  }, [stage, user?.name, soundEnabled, active, resolve, load])

  const handleReturnToQueue = async (itemId: string, garment: string) => {
    if (!hasReturnPerm) {
      toast({ title: "Permission denied", description: "You don't have permission to return items to queue.", variant: "destructive" })
      return
    }
    await act(itemId, "RETURN", garment)
  }

  const atStation = (active?.garments || []).filter((g) => g.atThisStage)
  const awaitingQc = (active?.garments || []).filter((g) => !g.hasPassedQc)
  const finished = (active?.garments || []).filter((g) => g.hasPassedQc && !g.atThisStage)

  const GarmentCard = ({ g }: { g: Garment }) => (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{g.garmentName}</p>
          <p className="text-[11px] text-slate-400">{g.serviceName || "—"} · <span className="font-mono">{g.garmentScanCode || g.barcode || g.itemNumber || "—"}</span></p>
        </div>
        {g.processingStatus === "PAUSED" && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-[10px] shrink-0">Paused</Badge>}
      </div>
      <div className="flex gap-1.5 mt-2">
        {g.processingStatus === "WAITING" && (
          <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1" disabled={busy} onClick={() => act(g.id, "START", g.garmentName)}>
            <Play className="h-3.5 w-3.5" /> Start
          </Button>
        )}
        {g.processingStatus === "IN_PROGRESS" && (
          <>
            <Button size="sm" variant="outline" className="h-8 gap-1" disabled={busy} onClick={() => act(g.id, "PAUSE", g.garmentName)}>
              <Pause className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white flex-1" disabled={busy} onClick={() => act(g.id, "COMPLETE", g.garmentName)}>
              <Check className="h-3.5 w-3.5" /> Complete
            </Button>
            {hasReturnPerm && (
              <Button size="sm" variant="outline" className="h-8 gap-1 text-amber-600 border-amber-200" disabled={busy} onClick={() => handleReturnToQueue(g.id, g.garmentName)}>
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
        {g.processingStatus === "PAUSED" && (
          <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1" disabled={busy} onClick={() => act(g.id, "RESUME", g.garmentName)}>
            <Play className="h-3.5 w-3.5" /> Resume
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Icon className="h-5 w-5 text-blue-600" /> {stageLabel(stage)} — Finishing
        </h1>
        <p className="text-sm text-slate-500">
          Garment barcode scanning ends at Quality Check. {scanTarget} to load the whole container and process it in place.
        </p>
      </div>

      {/* Container scan */}
      <Card className="rounded-xl border-blue-200 bg-blue-50/40 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 max-w-2xl">
            <div className="relative flex-1">
              <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500" />
              <Input
                ref={inputRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && resolve()}
                placeholder={`${scanTarget} (${scanHint})`}
                className="pl-10 h-11 bg-white border-blue-200 font-mono"
              />
            </div>
            <BagScanButton label="Scan with Camera" onScan={(c) => resolve(c)} disabled={looking} closeOnScan className="h-11" />
            <Button onClick={() => resolve()} disabled={looking || !code.trim()} className="h-11 gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />} Load Container
            </Button>
          </div>
          {offline && (
            <div className="mt-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              Unable to reach the server. Check your connection and scan again.
            </div>
          )}
          {scanErr && !offline && (
            <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{scanErr}</div>
          )}
          <p className="text-[11px] text-slate-400 mt-2">
            After Quality Check only the container is scanned — individual garment barcodes are not used at this station.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
        {/* Active container */}
        <div className="space-y-4">
          {!active ? (
            <Card className="rounded-xl border-dashed border-slate-300 shadow-none">
              <CardContent className="py-14 text-center space-y-2">
                <QrCode className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-sm font-medium text-slate-600">No container loaded</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">Scan the {scanTarget.toLowerCase()} to load its garments — or pick a waiting container from the list.</p>
              </CardContent>
            </Card>
          ) : loading ? (
            <div className="py-12 text-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : (
            <>
              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
                      <Package className="h-[18px] w-[18px] text-blue-600" />
                      <span className="font-mono">{active.package.code}</span>
                      <Badge variant="outline" className={active.package.status === "READY_FOR_FINISHING" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-500"}>
                        {active.package.status.replace(/_/g, " ")}
                      </Badge>
                    </CardTitle>
                    <div className="flex gap-1.5">
                      {[active.summary.atStage, active.summary.awaitingQc, active.summary.finished].map((n, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-slate-200 text-slate-500">
                          {["At this station", "Awaiting QC", "Completed"][i]}: {n}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">
                    <span className="font-mono">{active.order.orderNumber}</span>
                    {active.customer ? ` · ${active.customer}` : ""}
                    {active.store ? ` · ${active.store}` : ""}
                    {active.package.serviceName ? ` · ${active.package.serviceName}` : ""}
                    {active.package.garmentCount ? ` · ${active.package.garmentCount} garment(s)` : ""}
                  </p>
                </CardHeader>
              </Card>

              {/* At this station */}
              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-[14px] font-semibold text-slate-800 flex items-center gap-2"><Factory className="h-4 w-4 text-blue-600" /> At {stageLabel(stage)} <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">{atStation.length}</Badge></CardTitle></CardHeader>
                <CardContent className="space-y-2 max-h-[55vh] overflow-y-auto">
                  {atStation.length === 0 ? <p className="text-sm text-slate-400 py-5 text-center">Nothing here yet.</p> : atStation.map((g) => <GarmentCard key={g.id} g={g} />)}
                </CardContent>
              </Card>

              {awaitingQc.length > 0 && (
                <Card className="rounded-xl border-slate-200 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-[14px] font-semibold text-slate-800 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-amber-500" /> Awaiting Quality Check <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{awaitingQc.length}</Badge></CardTitle></CardHeader>
                  <CardContent className="space-y-2 max-h-[35vh] overflow-y-auto">
                    <p className="text-[11px] text-slate-400">These garments have not passed Quality Check yet — finishing waits for QC approval.</p>
                    {awaitingQc.map((g) => (
                      <div key={g.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">{g.garmentName}<span className="text-slate-400 font-normal"> · {g.serviceName || ""}</span></p>
                          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-[10px] shrink-0">{g.stageLabel}</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-1">{g.garmentScanCode || g.barcode || g.itemNumber || "—"}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {finished.length > 0 && (
                <Card className="rounded-xl border-slate-200 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-[14px] font-semibold text-slate-800 flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Completed — Next Stage <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">{finished.length}</Badge></CardTitle></CardHeader>
                  <CardContent className="space-y-2 max-h-[35vh] overflow-y-auto">
                    {finished.map((g) => (
                      <div key={g.id} className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">{g.garmentName}<span className="text-slate-400 font-normal"> · {g.serviceName || ""}</span></p>
                          <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px] shrink-0">{g.stageLabel}</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-1">{g.garmentScanCode || g.barcode || g.itemNumber || "—"}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Waiting containers */}
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Package className="h-[18px] w-[18px] text-violet-600" /> Containers Waiting <Badge variant="outline" className="border-violet-300 text-violet-700 bg-violet-50">{containers.length}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[75vh] overflow-y-auto">
            <div className="flex justify-end pb-1">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-slate-500" onClick={() => { load(); if (active) resolve(undefined, active.package.id) }} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
            {loading ? (
              <div className="py-8 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
            ) : containers.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No containers waiting. Garments appear here once they have passed Quality Check.</p>
            ) : (
              containers.map((c) => (
                <div key={c.id} className={`rounded-lg border p-3 transition-colors ${active?.package.id === c.id ? "border-blue-400 bg-blue-50/50" : "border-slate-200 hover:border-blue-200"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 font-mono">{c.code}</p>
                      <p className="text-[11px] text-slate-400 truncate"><span className="font-mono">{c.orderNumber}</span>{c.customer ? ` · ${c.customer}` : ""}</p>
                    </div>
                    <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 text-[10px] shrink-0">{c.atStage} at {stageLabel(stage)}</Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <p className="text-[10px] text-slate-400">{c.serviceName || `${c.garmentCount} garment(s)`} · {fmt(c.updatedAt)}</p>
                    <Button size="sm" variant="outline" className="h-7 gap-1 border-blue-200 text-blue-700 hover:bg-blue-50" disabled={busy} onClick={() => resolve(undefined, c.id)}>
                      <ScanLine className="h-3.5 w-3.5" /> Load
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
