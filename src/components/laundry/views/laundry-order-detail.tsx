"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Loader2, ChevronLeft, Clock, User, Phone, Shirt, ShoppingBag, Store as StoreIcon,
  Search, ArrowRight, ChevronDown, ChevronUp, Truck, MapPin, CheckCircle2, XCircle, Navigation,
} from "lucide-react"
import { statusLabel, actionLabel } from "@/lib/laundry-workflow"
import { stageLabel, resolveFlow } from "@/lib/laundry-processing"
import { LaundryInvoicePanel } from "@/components/laundry/invoice/laundry-invoice-panel"
import { toast } from "sonner"

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
  pickupRequired: boolean; pickupDate: string | null; pickupTimeSlot: string | null
  pickupExecutiveId: string | null; pickupAssignedAt: string | null
  pickupAcceptance: string | null; pickupAcceptedAt: string | null
  pickupCompletedAt: string | null; pickupStartedAt: string | null
  deliveryRequired: boolean; deliveryDate: string | null; deliveryTimeSlot: string | null
  deliveryExecutiveId: string | null; deliveryAssignedAt: string | null
  deliveryAcceptance: string | null; deliveryAcceptedAt: string | null
  deliveryCompletedAt: string | null; deliveryStartedAt: string | null
  fieldStatus: string | null
}

interface Exec {
  id: string; name: string; mobile: string | null
  availability: string; isActive: boolean
  todaysPickups: number; todaysDeliveries: number
}

interface DispatchInfo {
  pickup: { required: boolean; status: string; executiveId: string | null; executiveName: string | null; scheduledDate: string | null; timeSlot: string | null; completedAt: string | null }
  delivery: { required: boolean; status: string; executiveId: string | null; executiveName: string | null; completedAt: string | null }
}

const STATUS_STYLE: Record<string, string> = {
  DELIVERED: "bg-green-100 text-green-700", CANCELLED: "bg-slate-100 text-slate-500",
}

const PICKUP_STATUS_BADGE: Record<string, string> = {
  PENDING: "border-amber-200 text-amber-700 bg-amber-50",
  ASSIGNED: "border-blue-200 text-blue-700 bg-blue-50",
  ACCEPTED: "border-indigo-200 text-indigo-700 bg-indigo-50",
  COMPLETED: "border-emerald-200 text-emerald-700 bg-emerald-50",
}

const PICKUP_STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting Assignment",
  ASSIGNED: "Assigned",
  ACCEPTED: "Accepted",
  COMPLETED: "Completed",
}

export function LaundryOrderDetail() {
  const { selectedOrderId, setLaundryPage } = useAdminStore()
  const { currentBusinessId, user } = useAuthStore()
  const [order, setOrder] = useState<Detail | null>(null)
  const [dispatchStatus, setDispatchStatus] = useState<DispatchInfo | null>(null)
  const [execs, setExecs] = useState<Exec[]>([])
  const [itemEvents, setItemEvents] = useState<Record<string, ItemEvent[]>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [scanCode, setScanCode] = useState("")
  const [assigning, setAssigning] = useState<"pickup" | "delivery" | null>(null)
  const [receiving, setReceiving] = useState(false)

  const load = useCallback(async () => {
    if (!selectedOrderId) return
    setLoading(true)
    try {
      const [ord, disp, ex] = await Promise.all([
        fetch(`/api/laundry/orders/${selectedOrderId}`).then((r) => r.json()),
        fetch(`/api/laundry/dispatch/status?businessId=${currentBusinessId}&orderId=${selectedOrderId}`).then((r) => r.json()),
        fetch(`/api/laundry/delivery-executives?businessId=${currentBusinessId}`).then((r) => r.json()),
      ])
      if (ord.success) setOrder(ord.data)
      if (disp.success && disp.data?.[0]) setDispatchStatus(disp.data[0])
      if (ex.success) setExecs(ex.data)
    } catch { setOrder(null) } finally { setLoading(false) }
  }, [selectedOrderId, currentBusinessId])
  useEffect(() => { load() }, [load])

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

  const handleAssign = async (type: "pickup" | "delivery", executiveId: string | null) => {
    if (!order || !currentBusinessId) return
    setAssigning(type)
    try {
      const res = await fetch("/api/laundry/pickup-scheduler", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, orderId: order.id, type, executiveId }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast.success(executiveId ? `${type === "pickup" ? "Pickup" : "Delivery"} executive assigned` : `${type === "pickup" ? "Pickup" : "Delivery"} assignment cleared`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally { setAssigning(null) }
  }

  // Pickup Received — the missing UI bridge for the already-verified backend
  // transition. When an executive-completed pickup (pickupCompletedAt set) is
  // physically received at the store, the counter confirms it here, firing the
  // EXISTING PICKUP_COMPLETED transition (AWAITING_PICKUP_ASSIGNMENT →
  // PENDING_STORE_AUDIT). No new API, no state-machine change — this is the
  // deliberate admin gate (pickup completion ≠ garments received at store).
  const handlePickupReceived = async () => {
    if (!order || !currentBusinessId) return
    setReceiving(true)
    try {
      const res = await fetch(`/api/laundry/orders/${order.id}/transition`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: "PENDING_STORE_AUDIT", actorName: user?.name || "Store", note: "Pickup received at store" }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast.success("Pickup received — order sent to Store Audit")
      load() // refreshes this order; the Pickup and Store Audit queues refetch on open
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally { setReceiving(false) }
  }

  const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null
  const fmtDateTimeShort = (d: string | null | undefined) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : null

  const pickExecId = order?.pickupExecutiveId
  const delExecId = order?.deliveryExecutiveId
  const pickStatus = useMemo(() => {
    if (!order) return "NOT_REQUIRED"
    if (!order.pickupRequired) return "NOT_REQUIRED"
    if (order.pickupCompletedAt) return "COMPLETED"
    if (order.pickupAcceptedAt) return "ACCEPTED"
    if (order.pickupExecutiveId) return "ASSIGNED"
    return "PENDING"
  }, [order])
  const delStatus = useMemo(() => {
    if (!order) return "NOT_REQUIRED"
    if (!order.deliveryRequired) return "NOT_REQUIRED"
    if (order.deliveryCompletedAt || order.deliveredAt) return "COMPLETED"
    if (order.deliveryAcceptedAt) return "ACCEPTED"
    if (order.deliveryExecutiveId) return "ASSIGNED"
    return "PENDING"
  }, [order])

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

      {/* Pickup Operational Section */}
      <Card className="rounded-lg border-amber-200">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4 text-amber-600" /> Pickup</CardTitle>
          <Badge variant="outline" className={`text-[10px] ${PICKUP_STATUS_BADGE[pickStatus] || "border-slate-200 text-slate-400"}`}>
            {PICKUP_STATUS_LABEL[pickStatus] || "Not Required"}
          </Badge>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          {order.pickupRequired ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><span className="text-slate-400">Scheduled Date</span><p className="font-medium">{fmtDate(order.pickupDate) || "—"}</p></div>
              <div><span className="text-slate-400">Time Slot</span><p className="font-medium">{order.pickupTimeSlot || "—"}</p></div>
              <div className="col-span-2 flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 shrink-0">Assign Executive</span>
                <select
                  value={pickExecId || ""}
                  onChange={(e) => handleAssign("pickup", e.target.value || null)}
                  disabled={assigning === "pickup"}
                  className="h-7 text-xs rounded border border-slate-200 px-1 bg-white min-w-[120px] flex-1 max-w-[180px]">
                  <option value="">{assigning === "pickup" ? "Assigning…" : "— Unassigned —"}</option>
                  {execs.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name} {ex.todaysPickups > 0 ? `(${ex.todaysPickups})` : ""}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Pickup not required for this order.</p>
          )}
          {order.pickupRequired && order.pickupExecutiveId && (
            <div className="border-t border-amber-100 pt-2 mt-1 space-y-1 text-[11px]">
              <p className="text-slate-500 font-medium">Assignment Timeline</p>
              {order.pickupAssignedAt && <p className="text-slate-500"><span className="text-slate-400">Assigned</span> {fmtDateTimeShort(order.pickupAssignedAt)}</p>}
              {order.pickupAcceptedAt && <p className="text-emerald-600"><span className="text-emerald-500">Accepted</span> {fmtDateTimeShort(order.pickupAcceptedAt)}</p>}
              {order.pickupStartedAt && <p className="text-indigo-600"><span className="text-indigo-500">Started</span> {fmtDateTimeShort(order.pickupStartedAt)}</p>}
              {order.pickupCompletedAt && <p className="text-emerald-700 font-medium"><span className="text-emerald-500">Completed</span> {fmtDateTimeShort(order.pickupCompletedAt)}</p>}
              {!order.pickupCompletedAt && !order.pickupAcceptedAt && <p className="text-amber-600">Awaiting executive response</p>}
            </div>
          )}
          {order.status === "AWAITING_PICKUP_ASSIGNMENT" && order.pickupCompletedAt && (
            <div className="border-t border-amber-100 pt-2 mt-1">
              <Button size="sm" disabled={receiving} onClick={handlePickupReceived}
                className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                {receiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Pickup Received — Send to Store Audit
              </Button>
              <p className="text-[10px] text-slate-400 mt-1 text-center">Confirms the garments were physically received at the store.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery Operational Section */}
      <Card className="rounded-lg border-blue-200">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2"><Navigation className="h-4 w-4 text-blue-600" /> Delivery</CardTitle>
          <Badge variant="outline" className={`text-[10px] ${PICKUP_STATUS_BADGE[delStatus] || "border-slate-200 text-slate-400"}`}>
            {PICKUP_STATUS_LABEL[delStatus] || "Not Required"}
          </Badge>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          {order.deliveryRequired ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><span className="text-slate-400">Scheduled Date</span><p className="font-medium">{fmtDate(order.deliveryDate) || "—"}</p></div>
              <div><span className="text-slate-400">Time Slot</span><p className="font-medium">{order.deliveryTimeSlot || "—"}</p></div>
              <div className="col-span-2 flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 shrink-0">Assign Executive</span>
                <select
                  value={delExecId || ""}
                  onChange={(e) => handleAssign("delivery", e.target.value || null)}
                  disabled={assigning === "delivery"}
                  className="h-7 text-xs rounded border border-slate-200 px-1 bg-white min-w-[120px] flex-1 max-w-[180px]">
                  <option value="">{assigning === "delivery" ? "Assigning…" : "— Unassigned —"}</option>
                  {execs.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name} {ex.todaysDeliveries > 0 ? `(${ex.todaysDeliveries})` : ""}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Delivery not required for this order.</p>
          )}
          {order.deliveryRequired && order.deliveryExecutiveId && (
            <div className="border-t border-blue-100 pt-2 mt-1 space-y-1 text-[11px]">
              <p className="text-slate-500 font-medium">Assignment Timeline</p>
              {order.deliveryAssignedAt && <p className="text-slate-500"><span className="text-slate-400">Assigned</span> {fmtDateTimeShort(order.deliveryAssignedAt)}</p>}
              {order.deliveryAcceptedAt && <p className="text-emerald-600"><span className="text-emerald-500">Accepted</span> {fmtDateTimeShort(order.deliveryAcceptedAt)}</p>}
              {order.deliveryStartedAt && <p className="text-indigo-600"><span className="text-indigo-500">Started</span> {fmtDateTimeShort(order.deliveryStartedAt)}</p>}
              {order.deliveryCompletedAt && <p className="text-emerald-700 font-medium"><span className="text-emerald-500">Delivered</span> {fmtDateTimeShort(order.deliveryCompletedAt)}</p>}
              {!order.deliveryCompletedAt && !order.deliveryAcceptedAt && order.deliveryExecutiveId && <p className="text-amber-600">Awaiting executive response</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
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
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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
