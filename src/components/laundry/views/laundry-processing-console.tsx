"use client"

// Processing Center — monitoring dashboard only. Shows incoming packages to
// receive, packages awaiting Audit & Barcode, and a live department summary.
// It performs NO barcode generation and NO garment processing — those live on
// the dedicated Audit & Barcode page and the department workstation screens.

import { useEffect, useState, useCallback } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, PackageCheck, Factory, ArrowRight, Barcode as BarcodeIcon, Droplets, Wind, Flame, Shirt, Layers, ShieldCheck, Package, RefreshCw } from "lucide-react"
import { stageLabel } from "@/lib/laundry-processing"

const DEPT_TILES: { stage: string; icon: typeof Droplets; color: string }[] = [
  { stage: "WASH", icon: Droplets, color: "text-blue-600 bg-blue-50" },
  { stage: "DRYCLEAN", icon: Wind, color: "text-cyan-600 bg-cyan-50" },
  { stage: "STEAM", icon: Flame, color: "text-orange-600 bg-orange-50" },
  { stage: "IRON", icon: Shirt, color: "text-violet-600 bg-violet-50" },
  { stage: "FOLD", icon: Layers, color: "text-teal-600 bg-teal-50" },
  { stage: "QC", icon: ShieldCheck, color: "text-fuchsia-600 bg-fuchsia-50" },
  { stage: "PACKED", icon: Package, color: "text-emerald-600 bg-emerald-50" },
]

export function LaundryProcessingConsole() {
  const { currentBusinessId, user } = useAuthStore()
  const { openAuditBarcode } = useAdminStore()
  const { toast } = useToast()
  const [incoming, setIncoming] = useState<{ id: string; orderNumber: string; items: number; customer: string | null; status: string }[]>([])
  const [awaitingBarcode, setAwaitingBarcode] = useState<{ id: string; orderNumber: string; customer: string | null; items: number; barcoded: number }[]>([])
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/processing?businessId=${currentBusinessId}`).then((r) => r.json())
      setIncoming(j.incoming || []); setAwaitingBarcode(j.awaitingBarcode || []); setStageCounts(j.stageCounts || {})
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  // Receive a package → immediately open the dedicated Audit & Barcode page.
  const receive = async (orderId: string) => {
    setActing(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/receive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorName: user?.name || "operator" }) })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: "Receive failed", description: j.error, variant: "destructive" }); return }
      toast({ title: "Package received", description: `${j.data.received} garment(s) → Audit & Barcode.` })
      openAuditBarcode(orderId)
    } catch { toast({ title: "Receive failed", variant: "destructive" }) } finally { setActing(false) }
  }

  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Factory className="h-5 w-5 text-blue-600" /> Processing Center</h1>
          <p className="text-sm text-slate-500">Receive packages and monitor department workload. Barcodes and processing happen on their own screens.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
      </div>

      {/* Department summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {DEPT_TILES.map((d) => (
          <Card key={d.stage} className="rounded-xl border-slate-200 shadow-sm"><CardContent className="p-3.5 flex items-center gap-2.5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${d.color}`}><d.icon className="h-5 w-5" /></div>
            <div><p className="text-xl font-bold text-slate-800 leading-none tabular-nums">{stageCounts[d.stage] || 0}</p><p className="text-[10px] text-slate-400 mt-1">{stageLabel(d.stage)}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Receive packages */}
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><PackageCheck className="h-[18px] w-[18px] text-blue-600" /> Receive Packages <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{incoming.length}</Badge></CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="py-8 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : incoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No packages in transit to receive.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead className="text-center">Garments</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
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

      {/* Awaiting Audit & Barcode → dedicated page */}
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><BarcodeIcon className="h-[18px] w-[18px] text-blue-600" /> Packages Awaiting Audit &amp; Barcode <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{awaitingBarcode.length}</Badge></CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="py-8 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : awaitingBarcode.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No packages awaiting audit.</p>
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
    </div>
  )
}
