"use client"

// TRANSIT workstation (Processing Center) — the bag-based dispatch terminal.
//
// Garment barcodes were retired at Sorting, so Transit operates ONLY on the
// order's finishing bag. Scan the bag (Laundry Bag / Processing Packet / reused
// Pickup bag — per Workspace Scan Mode) to resolve the order and dispatch it to
// the origin store. The store then receives it at Store Receive.
//
// Server-side (authoritative): garment barcode formats are rejected outright,
// the bag must resolve to this business's finishing bag, and every garment must
// have finished its route before the order moves to RETURN_IN_TRANSIT.
import { useCallback, useEffect, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Truck, ScanLine, Check } from "lucide-react"
import { BagScanButton } from "@/components/laundry/bag-scanner"
import { playScanOk, playScanError } from "@/lib/laundry-scan-sound"

interface ReadyOrder {
  id: string; orderNumber: string | null; customer: string | null
  items: number; toStore: string | null; bagCode: string | null
}

export function LaundryTransitWorkstation() {
  const { currentBusinessId, user } = useAuthStore()
  const { toast } = useToast()
  const [ready, setReady] = useState<ReadyOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [scanErr, setScanErr] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [dispatched, setDispatched] = useState<string[]>([])

  const load = useCallback(async (silent = false) => {
    if (!currentBusinessId) return
    if (!silent) setLoading(true)
    try {
      const j = await fetch(`/api/laundry/processing/transit?businessId=${encodeURIComponent(currentBusinessId)}`).then((r) => r.json())
      if (j.success) setReady(j.ready || [])
    } catch {
      setOffline(true)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [currentBusinessId])

  useEffect(() => { load(false) }, [load])
  useAutoRefresh(() => load(true), { intervalMs: 12000 })

  const handleBagScan = useCallback(async (code: string) => {
    setScanErr(null); setOffline(false)
    setBusy(true)
    try {
      const res = await fetch("/api/laundry/processing/transit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, code, actorName: user?.name || "operator" }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) { playScanError(true); setScanErr(j.error || "Could not dispatch the order."); return }
      playScanOk(true)
      setDispatched((p) => [j.data?.orderNumber, ...p])
      toast({ title: "Dispatched to store", description: `Order ${j.data?.orderNumber || ""} → ${j.data?.items || 0} garment(s) in transit.`, duration: 3500 })
      load(true)
    } catch {
      setOffline(true); setScanErr("Unable to reach the server. Try again.")
    } finally { setBusy(false) }
  }, [currentBusinessId, user, toast, load])

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-6 pt-4 pb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Truck className="h-5 w-5 text-emerald-600" /> Transit
            <Badge className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px] font-semibold">LAUNDRY BAG TRACKING</Badge>
          </h1>
          <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50"><Check className="h-3 w-3 mr-1" /> {ready.length} ready</Badge>
        </div>

        <Card className="rounded-xl border-emerald-200 bg-emerald-50/40 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <BagScanButton onScan={handleBagScan} label="Scan finishing bag to dispatch" disabled={busy} />
              <p className="text-[11px] text-slate-500 flex-1 min-w-[220px]">Garment barcodes were retired at Sorting — Transit accepts only the order&apos;s finishing bag (Laundry Bag / Processing Packet / reused Pickup bag).</p>
            </div>
            {offline && <div className="mt-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">Unable to reach the server. Check your connection.</div>}
            {scanErr && !offline && <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{scanErr}</div>}
            {dispatched.length > 0 && (
              <div className="mt-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Recently dispatched: {dispatched.join(", ")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {loading && !ready.length ? (
        <div className="py-16 text-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : (
        <div className="px-4 lg:px-6 py-4">
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
                <ScanLine className="h-[18px] w-[18px] text-emerald-600" /> Ready to Return to Store
                <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">{ready.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ready.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">No orders are ready for Transit yet. Every garment must finish its route at the Processing Center first.</p>
              ) : ready.map((o) => (
                <div key={o.id} className="rounded-lg border border-slate-200 bg-white p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 font-mono">{o.orderNumber}</p>
                    <p className="text-[11px] text-slate-400">{o.customer || "—"} · {o.items} garment{o.items === 1 ? "" : "s"}{o.toStore ? ` · → ${o.toStore}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 font-mono text-[10px]">{o.bagCode || "bag assigned"}</Badge>
                    <BagScanButton onScan={handleBagScan} label="Dispatch" size="sm" disabled={busy} closeOnScan={false} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
