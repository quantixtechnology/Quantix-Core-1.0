"use client"

// Audit & Barcode Generation — mandatory stage after a package is received at
// the Processing Center. Re-audit garments, generate Code128 barcode labels for
// every garment, print/reprint them, then "Move to Processing Queue" (enabled
// only once all garments are barcoded). Garments then auto-route to the correct
// department queue by service.

import { useEffect, useState, useCallback } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Loader2, Barcode as BarcodeIcon, Printer, ArrowRight, User, ShoppingBag, Check, RefreshCw } from "lucide-react"
import { Barcode } from "./barcode"

interface Item { id: string; itemNumber: string | null; barcode: string | null; barcodeGenerated: boolean; garmentName: string; serviceName: string; quantity: number; condition: string | null; defects: string | null }
interface Data { order: { id: string; orderNumber: string; status: string; grandTotal: number }; store?: { storeName: string } | null; customer?: { name: string; phone: string | null } | null; items: Item[]; totalItems: number; barcoded: number; allBarcoded: boolean }

export function LaundryAuditBarcode({ orderId, onBack, onMoved }: { orderId: string; onBack: () => void; onMoved: () => void }) {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/orders/${orderId}/barcodes`).then((r) => r.json())
      if (j.success) setData(j.data)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [orderId])
  useEffect(() => { load() }, [load])

  const genOne = async (itemId: string, reprint = false) => {
    setBusy(true)
    try {
      await fetch(`/api/laundry/items/${itemId}/barcode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: reprint ? "REPRINT" : "GENERATE", actorName: user?.name }) })
      await load()
    } finally { setBusy(false) }
  }
  const genAll = async () => {
    setBusy(true)
    try {
      const j = await (await fetch(`/api/laundry/orders/${orderId}/barcodes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "GENERATE_ALL", actorName: user?.name }) })).json()
      toast({ title: "Barcodes generated", description: `${j.data?.generated ?? 0} label(s) generated.` })
      await load()
    } finally { setBusy(false) }
  }
  const move = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/barcodes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "MOVE_TO_PROCESSING", actorName: user?.name }) })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: "Cannot move", description: j.error, variant: "destructive" }); return }
      toast({ title: "Moved to Processing", description: `${j.data.moved} garment(s) routed to their department queues.` })
      onMoved()
    } finally { setBusy(false) }
  }

  if (loading || !data) return <div className="flex items-center justify-center py-24 text-slate-400 gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>

  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><BarcodeIcon className="h-5 w-5 text-blue-600" /> Audit &amp; Barcode Generation <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">In Progress</Badge></h1>
          <p className="text-sm text-slate-500 font-mono">{data.order.orderNumber}</p>
        </div>
        <Button variant="outline" className="gap-1" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Barcode Labels</Button>
      </div>

      {/* Package summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: User, label: "Customer", value: data.customer?.name || "—" },
          { icon: ShoppingBag, label: "Store", value: data.store?.storeName || "—" },
          { icon: BarcodeIcon, label: "Total Garments", value: String(data.totalItems) },
          { icon: Check, label: "Barcoded", value: `${data.barcoded} / ${data.totalItems}` },
        ].map((s) => (
          <Card key={s.label} className="rounded-xl border-slate-200 shadow-sm"><CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><s.icon className="h-5 w-5" /></div>
            <div><p className="text-lg font-bold text-slate-800 leading-none">{s.value}</p><p className="text-[11px] text-slate-400 mt-1">{s.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><BarcodeIcon className="h-[18px] w-[18px] text-blue-600" /> Garments</CardTitle>
          <Button size="sm" variant="outline" onClick={genAll} disabled={busy || data.allBarcoded} className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"><BarcodeIcon className="h-3.5 w-3.5" /> Generate All Pending Barcodes</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Item</TableHead><TableHead>Service</TableHead><TableHead>Qty</TableHead><TableHead>Condition</TableHead><TableHead>Barcode</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.items.map((it, i) => (
                <TableRow key={it.id}>
                  <TableCell className="text-slate-400">{i + 1}</TableCell>
                  <TableCell className="text-sm font-medium">{it.garmentName}</TableCell>
                  <TableCell className="text-sm text-slate-600">{it.serviceName}</TableCell>
                  <TableCell className="text-center">{it.quantity}</TableCell>
                  <TableCell>{it.defects ? <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-[11px]">{it.defects.split(",").join(", ")}</Badge> : <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[11px]">Good</Badge>}</TableCell>
                  <TableCell>{it.barcodeGenerated ? <Barcode value={it.barcode || it.itemNumber || ""} /> : <span className="text-[11px] font-mono text-slate-400">{it.itemNumber}</span>}</TableCell>
                  <TableCell>{it.barcodeGenerated ? <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">Barcoded</Badge> : <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Pending</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {it.barcodeGenerated
                      ? <Button size="sm" variant="ghost" className="gap-1 h-8 text-slate-500" disabled={busy} onClick={() => genOne(it.id, true)}><RefreshCw className="h-3.5 w-3.5" /> Reprint</Button>
                      : <Button size="sm" variant="outline" className="gap-1 h-8" disabled={busy} onClick={() => genOne(it.id)}><BarcodeIcon className="h-3.5 w-3.5" /> Generate</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 lg:-mx-6 border-t border-slate-200 bg-white/95 backdrop-blur px-4 lg:px-6 py-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{data.allBarcoded ? "All garments barcoded — ready to move." : `Attach a barcode to every garment (${data.totalItems - data.barcoded} pending) to continue.`}</p>
        <Button onClick={move} disabled={busy || !data.allBarcoded} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-slate-300">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Move to Processing Queue</Button>
      </div>
    </div>
  )
}
