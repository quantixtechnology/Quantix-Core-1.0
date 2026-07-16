"use client"

// Barcode Generation — mandatory stage after a package is received.
// Re-audit garments, generate Code128+QR barcode labels, print/preview/reprint
// (thermal 20mm default, configurable), then Move to Processing (gated on all
// garments barcoded AND payment collected). Garments then auto-route by service.

import { useEffect, useState, useCallback } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Loader2, Barcode as BarcodeIcon, Printer, ArrowRight, User, ShoppingBag, Check, RefreshCw, Eye, Settings } from "lucide-react"
import { Barcode } from "./barcode"
import { LaundryPaymentBanner } from "./laundry-payment-banner"
import { printLabels, loadLabelConfig, saveLabelConfig, type LabelConfig, type LabelData } from "@/lib/laundry-label"

interface Item { id: string; itemNumber: string | null; barcode: string | null; barcodeGenerated: boolean; printCount: number; lastPrintedBy: string | null; garmentName: string; serviceName: string; quantity: number; condition: string | null; defects: string | null }
interface Data { order: { id: string; orderNumber: string; status: string; grandTotal: number }; store?: { storeName: string } | null; customer?: { name: string; phone: string | null } | null; items: Item[]; totalItems: number; barcoded: number; allBarcoded: boolean }

const WIDTHS = [20, 25, 30, 40, 50], HEIGHTS = [20, 30, 40], DPIS = [203, 300, 600]

export function LaundryAuditBarcode({ orderId, onBack, onMoved }: { orderId: string; onBack: () => void; onMoved: () => void }) {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [cfg, setCfg] = useState<LabelConfig>(loadLabelConfig())
  const [showCfg, setShowCfg] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const j = await fetch(`/api/laundry/orders/${orderId}/barcodes`).then((r) => r.json()); if (j.success) setData(j.data) } catch { /* noop */ } finally { setLoading(false) }
  }, [orderId])
  useEffect(() => { load() }, [load])

  const toLabel = (it: Item): LabelData => ({ itemNumber: it.itemNumber || it.barcode || "", garment: it.garmentName, service: it.serviceName })

  const genOne = async (it: Item, reprint = false) => {
    setBusy(true)
    try {
      await fetch(`/api/laundry/items/${it.id}/barcode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: reprint ? "REPRINT" : "GENERATE", actorName: user?.name }) })
      await load()
    } finally { setBusy(false) }
  }
  const printOne = async (it: Item) => { await printLabels([toLabel(it)], cfg, true); genOne(it, true) }
  const previewOne = async (it: Item) => { await printLabels([toLabel(it)], cfg, false) }
  const genAll = async () => {
    setBusy(true)
    try { const j = await (await fetch(`/api/laundry/orders/${orderId}/barcodes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "GENERATE_ALL", actorName: user?.name }) })).json(); toast({ title: "Barcodes generated", description: `${j.data?.generated ?? 0} label(s).` }); await load() } finally { setBusy(false) }
  }
  const printAll = async () => { if (data) await printLabels(data.items.map(toLabel), cfg, true) }
  const move = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/barcodes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "MOVE_TO_PROCESSING", actorName: user?.name }) })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: j.code === "PAYMENT_PENDING" ? "Payment pending" : "Cannot move", description: j.error, variant: "destructive" }); return }
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
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><BarcodeIcon className="h-5 w-5 text-blue-600" /> Barcode Generation <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">In Progress</Badge></h1>
          <p className="text-sm text-slate-500 font-mono">{data.order.orderNumber}</p>
        </div>
        <LaundryPaymentBanner orderId={orderId} />
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowCfg(true)}><Settings className="h-4 w-4" /> Label {cfg.widthMm}mm</Button>
        <Button variant="outline" className="gap-1" onClick={printAll}><Printer className="h-4 w-4" /> Print All</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ label: "Customer", value: data.customer?.name || "—" }, { label: "Store", value: data.store?.storeName || "—" }, { label: "Total Garments", value: String(data.totalItems) }, { label: "Barcoded", value: `${data.barcoded} / ${data.totalItems}` }].map((s) => (
          <Card key={s.label} className="rounded-xl border-slate-200 shadow-sm"><CardContent className="p-4"><p className="text-[11px] text-slate-400">{s.label}</p><p className="text-lg font-bold text-slate-800">{s.value}</p></CardContent></Card>
        ))}
      </div>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><BarcodeIcon className="h-[18px] w-[18px] text-blue-600" /> Garments</CardTitle>
          <Button size="sm" variant="outline" onClick={genAll} disabled={busy || data.allBarcoded} className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"><BarcodeIcon className="h-3.5 w-3.5" /> Generate All Pending</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Garment</TableHead><TableHead>Service</TableHead><TableHead>Qty</TableHead><TableHead>Barcode</TableHead><TableHead>Prints</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.items.map((it, i) => (
                <TableRow key={it.id}>
                  <TableCell className="text-slate-400">{i + 1}</TableCell>
                  <TableCell className="text-sm font-medium">{it.garmentName}</TableCell>
                  <TableCell className="text-sm text-slate-600">{it.serviceName}</TableCell>
                  <TableCell className="text-center">{it.quantity}</TableCell>
                  <TableCell>{it.barcodeGenerated ? <Barcode value={it.barcode || it.itemNumber || ""} height={30} /> : <span className="text-[11px] font-mono text-slate-400">{it.itemNumber}</span>}</TableCell>
                  <TableCell className="text-xs text-slate-400">{it.printCount > 0 ? `${it.printCount}×${it.lastPrintedBy ? ` · ${it.lastPrintedBy}` : ""}` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!it.barcodeGenerated
                        ? <Button size="sm" variant="outline" className="h-8 gap-1" disabled={busy} onClick={() => genOne(it)}><BarcodeIcon className="h-3.5 w-3.5" /> Generate</Button>
                        : <Button size="sm" variant="ghost" className="h-8 gap-1 text-slate-500" disabled={busy} onClick={() => genOne(it, true)}><RefreshCw className="h-3.5 w-3.5" /> Reprint</Button>}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500" title="Preview" onClick={() => previewOne(it)}><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500" title="Print" onClick={() => printOne(it)}><Printer className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 lg:-mx-6 border-t border-slate-200 bg-white/95 backdrop-blur px-4 lg:px-6 py-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{data.allBarcoded ? "All garments barcoded — ready to move." : `Barcode every garment (${data.totalItems - data.barcoded} pending) to continue.`}</p>
        <Button onClick={move} disabled={busy || !data.allBarcoded} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-slate-300">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Move to Processing Queue</Button>
      </div>

      {/* Print settings */}
      <Dialog open={showCfg} onOpenChange={setShowCfg}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5 text-blue-600" /> Thermal Label Settings</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Width (mm)</Label><Select value={String(cfg.widthMm)} onValueChange={(v) => setCfg({ ...cfg, widthMm: +v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{WIDTHS.map((w) => <SelectItem key={w} value={String(w)}>{w} mm</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Height (mm)</Label><Select value={String(cfg.heightMm)} onValueChange={(v) => setCfg({ ...cfg, heightMm: +v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{HEIGHTS.map((h) => <SelectItem key={h} value={String(h)}>{h} mm</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Printer DPI</Label><Select value={String(cfg.dpi)} onValueChange={(v) => setCfg({ ...cfg, dpi: +v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DPIS.map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">Garment labels carry only garment name, service, Code128 barcode and the Item ID. QR codes are printed at the package level, not per garment.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCfg(false)}>Close</Button><Button className="bg-blue-600 hover:bg-blue-700 text-white gap-1" onClick={() => { saveLabelConfig(cfg); setShowCfg(false); toast({ title: "Label settings saved" }) }}><Check className="h-4 w-4" /> Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
