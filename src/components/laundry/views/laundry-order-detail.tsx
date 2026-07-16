"use client"

// Order Detail — the complete operational journey of one laundry order.
// Header + financials + garments (each individually traceable with its own
// item code, route, current stage and per-garment history) + a merged,
// readable order timeline (order milestones + per-garment processing events).

import { useCallback, useEffect, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Loader2, ChevronLeft, Clock, User, Phone, Shirt, ShoppingBag, Store as StoreIcon,
  Search, ArrowRight, ChevronDown, ChevronUp,
} from "lucide-react"
import { statusLabel, actionLabel } from "@/lib/laundry-workflow"
import { stageLabel, resolveFlow } from "@/lib/laundry-processing"
import { LaundryInvoicePanel } from "@/components/laundry/invoice/laundry-invoice-panel"

const inr = (n: number) => `₹${(n || 0).toFixed(2)}`
const fmt = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")

interface Item {
  id: string; itemNumber: string | null; barcode: string | null; garmentName: string; serviceName: string
  quantity: number; processingStage: string | null; processingStatus: string | null; processFlow: string | null
  qcFailCount: number; condition: string | null; defects: string | null; total: number
}
interface OrderEvent { id: string; fromStatus: string | null; toStatus: string; action: string; actorName: string | null; note: string | null; createdAt: string }
interface ItemEvent { id: string; itemId: string; action: string; fromStage: string | null; toStage: string | null; actorName: string | null; note: string | null; createdAt: string }
interface Detail {
  id: string; orderNumber: string; status: string; orderType: string; paymentStatus: string
  grandTotal: number; amountPaid: number; balanceDue: number; subscriptionCoveredAmount?: number; createdAt: string
  deliveredAt: string | null; deliveredBy: string | null; recipientName: string | null
  expectedDeliveryDate: string | null
  store?: { storeName: string | null; storeCode: string | null } | null
  customer?: { name: string; phone: string | null; customerCode: string | null } | null
  items: Item[]; events: OrderEvent[]
  packet?: { packetNumber: string; status: string } | null
}

const STATUS_STYLE: Record<string, string> = {
  DELIVERED: "bg-green-100 text-green-700", CANCELLED: "bg-slate-100 text-slate-500",
}

export function LaundryOrderDetail() {
  const { selectedOrderId, setLaundryPage } = useAdminStore()
  const { currentBusinessId } = useAuthStore()
  const [order, setOrder] = useState<Detail | null>(null)
  const [itemEvents, setItemEvents] = useState<Record<string, ItemEvent[]>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [scanCode, setScanCode] = useState("")

  const load = useCallback(async () => {
    if (!selectedOrderId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/orders/${selectedOrderId}`).then((r) => r.json())
      if (j.success) setOrder(j.data)
    } catch { setOrder(null) } finally { setLoading(false) }
  }, [selectedOrderId])
  useEffect(() => { load() }, [load])

  // Lazy-load a garment's own timeline via the scan endpoint (has item events).
  const toggleItem = async (it: Item) => {
    const next = new Set(expanded)
    if (next.has(it.id)) { next.delete(it.id); setExpanded(next); return }
    next.add(it.id); setExpanded(next)
    if (!itemEvents[it.id] && it.barcode) {
      const j = await fetch(`/api/laundry/scan?barcode=${encodeURIComponent(it.barcode)}`).then((r) => r.json()).catch(() => null)
      if (j?.success) setItemEvents((p) => ({ ...p, [it.id]: j.data.timeline || [] }))
    }
  }

  const scan = async () => {
    const code = scanCode.trim()
    if (!code) return
    const j = await fetch(`/api/laundry/scan?barcode=${encodeURIComponent(code)}`).then((r) => r.json()).catch(() => null)
    if (!j?.success) return
    const it = order?.items.find((x) => x.barcode === code || x.itemNumber === code)
    if (it) { setScanCode(""); toggleItem(it) }
  }

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading order…</div>
  if (!order) return (
    <div className="py-16 text-center">
      <p className="text-sm text-slate-500">Order not found.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setLaundryPage("orders")}><ChevronLeft className="h-4 w-4" /> Back to Orders</Button>
    </div>
  )

  return (
    <div className="px-1 lg:px-2 py-2 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={() => setLaundryPage("orders")}><ChevronLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold tracking-tight font-mono">{order.orderNumber}</h2>
              <Badge className={STATUS_STYLE[order.status] || "bg-blue-100 text-blue-700"}>{statusLabel(order.status)}</Badge>
              {order.packet && <Badge variant="outline" className="font-mono text-[10px]">{order.packet.packetNumber}</Badge>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1"><User className="h-3 w-3" />{order.customer?.name || "—"}</span>
              {order.customer?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{order.customer.phone}</span>}
              <span className="flex items-center gap-1"><StoreIcon className="h-3 w-3" />{order.store?.storeName || "—"}</span>
              <span className="flex items-center gap-1"><ShoppingBag className="h-3 w-3" />{order.orderType}</span>
              <span>Created {fmt(order.createdAt)}</span>
              {order.deliveredAt && <span className="text-green-600">Delivered {fmt(order.deliveredAt)}{order.recipientName ? ` · ${order.recipientName}` : ""}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {[{ l: "Total", v: inr(order.grandTotal) }, ...(order.subscriptionCoveredAmount && order.subscriptionCoveredAmount > 0 ? [{ l: "Subscription", v: inr(order.subscriptionCoveredAmount), c: "text-blue-600" }] : []), { l: "Paid", v: inr(order.amountPaid), c: "text-emerald-600" }, { l: "Balance", v: order.paymentStatus === "SUBSCRIPTION" ? "Covered" : inr(order.balanceDue), c: order.balanceDue > 0 ? "text-rose-600" : "text-emerald-600" }].map((s) => (
            <div key={s.l} className="rounded-lg border px-3 py-2 text-right"><p className="text-[10px] uppercase text-slate-400">{s.l}</p><p className={`text-sm font-bold ${s.c || "text-slate-800"}`}>{s.v}</p></div>
          ))}
        </div>
      </div>

      {selectedOrderId && <LaundryInvoicePanel orderId={selectedOrderId} businessId={currentBusinessId || ""} />}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* Garments — individually traceable */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm flex items-center gap-2"><Shirt className="h-4 w-4 text-blue-600" /> Garments ({order.items.length})</CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input value={scanCode} onChange={(e) => setScanCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scan()} placeholder="Scan item barcode…" className="h-8 w-[180px] rounded-md border border-slate-200 pl-7 pr-2 text-xs font-mono" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Garment</TableHead><TableHead>Service</TableHead><TableHead>Stage</TableHead><TableHead className="w-8" /></TableRow></TableHeader>
              <TableBody>
                {order.items.map((it) => {
                  const flow = resolveFlow(it)
                  const open = expanded.has(it.id)
                  const done = it.processingStage === "PACKED" && it.processingStatus === "DONE"
                  return (
                    <>
                      <TableRow key={it.id} className="cursor-pointer" onClick={() => toggleItem(it)}>
                        <TableCell className="font-mono text-[11px] text-slate-500">{it.itemNumber}</TableCell>
                        <TableCell className="text-sm font-medium">{it.garmentName}{it.condition === "DAMAGED" && <Badge variant="outline" className="ml-1 text-[9px] border-amber-300 text-amber-700">flagged</Badge>}</TableCell>
                        <TableCell className="text-xs text-slate-600">{it.serviceName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${done ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-blue-300 text-blue-700 bg-blue-50"}`}>
                            {done ? "Complete" : `${stageLabel(it.processingStage)} · ${it.processingStatus || "—"}`}
                          </Badge>
                          {it.qcFailCount > 0 && <Badge variant="outline" className="ml-1 text-[9px] border-rose-300 text-rose-600">QC×{it.qcFailCount + 1}</Badge>}
                        </TableCell>
                        <TableCell>{open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}</TableCell>
                      </TableRow>
                      {open && (
                        <TableRow key={`${it.id}-detail`}>
                          <TableCell colSpan={5} className="bg-slate-50/60">
                            <div className="py-1">
                              <p className="text-[11px] text-slate-500 mb-2">Route: {flow.map((f) => stageLabel(f)).join(" → ")}{it.barcode ? ` · barcode ${it.barcode}` : ""}</p>
                              <div className="space-y-1">
                                {(itemEvents[it.id] || []).length === 0 ? <p className="text-[11px] text-slate-400">No processing events yet.</p> : itemEvents[it.id].map((e) => (
                                  <div key={e.id} className="flex items-center gap-2 text-[11px]">
                                    <Clock className="h-3 w-3 text-slate-300 shrink-0" />
                                    <span className="font-medium text-slate-700">{e.action.replace(/_/g, " ")}</span>
                                    {e.fromStage && e.toStage && e.fromStage !== e.toStage && <span className="text-slate-400 flex items-center gap-0.5">{stageLabel(e.fromStage)} <ArrowRight className="h-2.5 w-2.5" /> {stageLabel(e.toStage)}</span>}
                                    {e.note && <span className="text-slate-500">· {e.note}</span>}
                                    <span className="text-slate-400 ml-auto">{e.actorName || ""} · {fmt(e.createdAt)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Order timeline — milestones */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-blue-600" /> Order Timeline</CardTitle></CardHeader>
          <CardContent>
            <div className="relative space-y-0">
              {[...order.events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((ev, i, arr) => (
                <div key={ev.id} className="relative flex gap-3 pb-4">
                  {i < arr.length - 1 && <div className="absolute left-[7px] top-5 bottom-0 w-px bg-slate-200" />}
                  <div className={`h-[15px] w-[15px] rounded-full border-2 shrink-0 mt-0.5 ${ev.toStatus === "DELIVERED" ? "border-green-500 bg-green-100" : ev.action === "ALL_ITEMS_COMPLETE" ? "border-emerald-500 bg-emerald-100" : "border-blue-500 bg-blue-100"}`} />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700">{actionLabel(ev.action)}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" /> {fmt(ev.createdAt)}{ev.actorName ? ` · ${ev.actorName}` : ""}</p>
                    {ev.note && <p className="text-[11px] text-slate-500">{ev.note}</p>}
                  </div>
                </div>
              ))}
              {order.events.length === 0 && <p className="text-xs text-slate-400">No timeline entries yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
