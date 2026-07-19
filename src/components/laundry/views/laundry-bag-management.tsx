"use client"

// Bag Management (Laundry Operations) — the reusable-bag master. Generate a pool
// of permanent BAG-NNNNNN QR bags, print labels once, track each bag's status,
// current order and full history. The QR belongs to the physical bag, not the
// order. Additive; reuses the qrcode lib + /api/laundry/bags.
import { useCallback, useEffect, useState } from "react"
import QRCode from "qrcode"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Search, Package, Plus, Printer, History, Wrench, XCircle, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface Bag { id: string; bagNumber: string; qrValue: string; status: string; currentOrderNumber: string | null; currentServiceName: string | null; currentCustomerName: string | null; lastUsedAt: string | null; totalUsageCount: number }
interface Assignment { id: string; orderNumber: string | null; serviceName: string | null; customerName: string | null; assignedAt: string; returnedAt: string | null; status: string }

const STATUS_TONE: Record<string, string> = {
  AVAILABLE: "border-emerald-300 text-emerald-700 bg-emerald-50",
  DAMAGED: "border-rose-300 text-rose-700 bg-rose-50",
  LOST: "border-rose-300 text-rose-700 bg-rose-50",
  CLEANING: "border-amber-300 text-amber-700 bg-amber-50",
}
const tone = (s: string) => STATUS_TONE[s] || "border-blue-300 text-blue-700 bg-blue-50"
const FILTERS = ["ALL", "AVAILABLE", "COLLECTED", "RECEIVED_AT_STORE", "PROCESSING", "READY_FOR_DELIVERY", "DELIVERED", "DAMAGED", "LOST"] as const

async function printBagLabels(bags: Bag[]) {
  const labels = await Promise.all(bags.map(async (b) => ({ b, url: await QRCode.toDataURL(b.qrValue, { width: 240, margin: 1 }) })))
  const w = window.open("", "_blank", "width=460,height=640")
  if (!w) { toast.error("Allow pop-ups to print labels"); return }
  const body = labels.map(({ b, url }) => `
    <div style="page-break-after:always;text-align:center;padding:20px;border-bottom:1px dashed #ccc">
      <img src="${url}" width="220" height="220" />
      <div style="font-family:monospace;font-size:20px;font-weight:bold;margin-top:8px">${b.bagNumber}</div>
      <div style="font-size:11px;color:#888">Reusable laundry bag · permanent QR</div>
    </div>`).join("")
  w.document.write(`<html><head><title>Bag Labels</title></head><body style="font-family:sans-serif;margin:0">${body}</body></html>`)
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300)
}

export function LaundryBagManagement() {
  const { currentBusinessId } = useAuthStore()
  const [bags, setBags] = useState<Bag[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("ALL")
  const [search, setSearch] = useState("")
  const [genOpen, setGenOpen] = useState(false)
  const [genCount, setGenCount] = useState("50")
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState<{ bag: Bag; assignments: Assignment[] } | null>(null)
  const [releaseStage, setReleaseStage] = useState<string>("STORE_RECEIVE")
  const [savingStage, setSavingStage] = useState(false)

  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/bag-settings?businessId=${currentBusinessId}`).then((r) => r.json()).then((j) => { if (j.success) setReleaseStage(j.data.reusableBagReleaseStage) }).catch(() => {})
  }, [currentBusinessId])

  const saveReleaseStage = async (stage: string) => {
    setReleaseStage(stage); setSavingStage(true)
    try {
      const res = await fetch("/api/laundry/bag-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, reusableBagReleaseStage: stage }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast.success("Bag release policy saved")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setSavingStage(false) }
  }

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const p = new URLSearchParams({ businessId: currentBusinessId, status: filter })
      if (search.trim()) p.set("search", search.trim())
      const j = await fetch(`/api/laundry/bags?${p}`).then((r) => r.json())
      setBags(j.data || []); setCounts(j.counts || {})
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId, filter, search])
  useEffect(() => { load() }, [load])

  const generate = async () => {
    setBusy(true)
    try {
      const j = await fetch("/api/laundry/bags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, count: Number(genCount) || 0 }) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Failed")
      toast.success(`${j.data.length} bags created`)
      setGenOpen(false); load()
      if (confirm(`Print labels for the ${j.data.length} new bags now?`)) printBagLabels(j.data)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  const setStatus = async (bag: Bag, status: string) => {
    try {
      const j = await fetch(`/api/laundry/bags/${bag.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Failed")
      toast.success(`${bag.bagNumber} → ${status.replace(/_/g, " ")}`); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
  }

  const openDetail = async (bag: Bag) => {
    const j = await fetch(`/api/laundry/bags/${bag.id}`).then((r) => r.json())
    if (j.success) setDetail({ bag: j.data, assignments: j.data.assignments || [] })
  }

  return (
    <div className="px-4 lg:px-6 py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Package className="h-5 w-5 text-blue-600" /> Bag Management</h1>
          <p className="text-sm text-slate-500">Reusable bags with a permanent QR. Generate the pool once, then assign bags to orders at pickup.</p>
        </div>
        <Button onClick={() => setGenOpen(true)} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"><Plus className="h-4 w-4" /> Generate Bags</Button>
      </div>

      {/* Reusable Bag Release Stage — configurable per laundry */}
      <Card className="rounded-xl border-slate-200"><CardContent className="p-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700">Reusable Bag Release Stage {savingStage && <Loader2 className="inline h-3 w-3 animate-spin text-slate-400" />}</p>
          <p className="text-xs text-slate-500 mt-0.5">When a reusable bag automatically returns to <b>Available</b> for the next order.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {[
            { v: "STORE_RECEIVE", t: "Release at Store Receive", d: "Bag freed when scanned in at the store (recommended)" },
            { v: "AFTER_DELIVERY", t: "Release after Delivery", d: "Bag stays with the order until it's delivered" },
          ].map((o) => (
            <button key={o.v} onClick={() => saveReleaseStage(o.v)} className={`text-left rounded-lg border p-3 w-full sm:w-56 transition-colors ${releaseStage === o.v ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
              <p className={`text-sm font-medium ${releaseStage === o.v ? "text-blue-700" : "text-slate-700"}`}>{o.t}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{o.d}</p>
            </button>
          ))}
        </div>
      </CardContent></Card>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative w-full max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bag no, order, customer…" className="pl-9 h-9" /></div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 h-8 text-xs font-medium ${filter === f ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              {f === "ALL" ? "All" : f.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}{f !== "ALL" && counts[f] != null ? ` (${counts[f]})` : ""}
            </button>
          ))}
        </div>
      </div>

      <Card className="rounded-xl border-slate-200"><CardContent className="p-0">
        {loading ? <div className="py-12 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : bags.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No bags. Click “Generate Bags” to create your reusable pool.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {bags.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-slate-800">{b.bagNumber}</span>
                    <Badge variant="outline" className={`text-[10px] ${tone(b.status)}`}>{b.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">{b.currentOrderNumber ? `${b.currentOrderNumber} · ${b.currentServiceName || ""} · ${b.currentCustomerName || ""}` : "Idle"} · used {b.totalUsageCount}×</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" title="History" onClick={() => openDetail(b)}><History className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" title="Reprint label" onClick={() => printBagLabels([b])}><Printer className="h-4 w-4" /></Button>
                  {b.status !== "DAMAGED" && b.status !== "LOST" ? (<>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500" title="Mark damaged" onClick={() => setStatus(b, "DAMAGED")}><Wrench className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" title="Mark lost" onClick={() => setStatus(b, "LOST")}><XCircle className="h-4 w-4" /></Button>
                  </>) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" title="Return to available" onClick={() => setStatus(b, "AVAILABLE")}><RotateCcw className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      {/* Generate */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Generate Reusable Bags</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">Creates a pool of permanent BAG-NNNNNN bags (Available). Print the labels once and attach them to the physical bags.</p>
          <div className="space-y-1.5"><label className="text-xs font-semibold text-slate-500">How many bags?</label><Input type="number" min={1} max={1000} value={genCount} onChange={(e) => setGenCount(e.target.value)} className="h-10" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button onClick={generate} disabled={busy} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail + history */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-mono">{detail?.bag.bagNumber}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Badge variant="outline" className={`text-[10px] ${tone(detail.bag.status)}`}>{detail.bag.status.replace(/_/g, " ")}</Badge><span className="text-xs text-slate-400">Used {detail.bag.totalUsageCount}× · last {detail.bag.lastUsedAt ? new Date(detail.bag.lastUsedAt).toLocaleDateString("en-IN") : "—"}</span></div>
              <div className="flex justify-center py-2"><QrImage value={detail.bag.qrValue} /></div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">History</p>
                {detail.assignments.length === 0 ? <p className="text-xs text-slate-400">No usage yet.</p> : (
                  <div className="divide-y divide-slate-50 rounded-lg border border-slate-100">
                    {detail.assignments.map((a) => (
                      <div key={a.id} className="px-3 py-2 text-xs">
                        <p className="font-mono font-semibold text-slate-700">{a.orderNumber || "—"} <span className="font-sans font-normal text-slate-400">· {a.serviceName || ""}</span></p>
                        <p className="text-[11px] text-slate-400">{a.customerName || "—"} · {new Date(a.assignedAt).toLocaleDateString("en-IN")}{a.returnedAt ? ` → returned ${new Date(a.returnedAt).toLocaleDateString("en-IN")}` : ` · ${a.status.toLowerCase()}`}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QrImage({ value, size = 150 }: { value: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { QRCode.toDataURL(value, { width: size, margin: 1 }).then(setUrl).catch(() => setUrl(null)) }, [value, size])
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={value} width={size} height={size} className="rounded border border-slate-200" /> : <div style={{ width: size, height: size }} className="rounded bg-slate-100" />
}
