"use client"

// Store Counter operational stages — each screen performs the REAL business
// action for its stage (never a bare status change):
//   · Payment Collection  — records money against the order (or an explicit
//     policy-allowed pay-later decision), then the order advances.
//   · Packing & QR        — creates the persistent packet (PKT-…) whose QR
//     payload is the packet number; print/reprint without duplicates.
//   · Transit to Processing — dispatches the packet (who/when/transport).
//   · Store Receive       — confirms the returned processed order.
//   · Ready for Delivery  — outstanding balance + final payment + handover.

import { useCallback, useEffect, useState } from "react"
import QRCode from "qrcode"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Loader2, RefreshCw, Search, Clock, Package, CreditCard, QrCode, Truck,
  PackageCheck, HandCoins, CheckCircle2, Printer, User, Phone, Shirt, IndianRupee, Navigation, MapPin, AlertTriangle, ClipboardCheck,
} from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { statusLabel, type LaundryOrderStatus } from "@/lib/laundry-workflow"

// Only fully-audited orders belong in Packing & QR. auditComplete is computed by
// the orders API (has garments AND none left un-inspected). undefined (older
// response) is NOT treated as incomplete — the pack endpoint + UI block are the
// hard enforcement; this filter just keeps the known-incomplete out of view.
const auditReadyForPacking = (o: OrderRow) => o.auditComplete !== false

const inr = (n: number) => `₹${(n || 0).toFixed(2)}`
const fmt = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")

interface OrderRow {
  id: string; orderNumber: string; status: string; orderType: string; createdAt: string
  grandTotal: number; amountPaid: number; balanceDue: number; paymentStatus: string
  expectedDeliveryDate: string | null; itemCount: number; customerId?: string | null
  auditComplete?: boolean
  store?: { storeName: string | null } | null
  customer?: { name: string; phone: string | null } | null
}

// ── Shared queue shell: list on the left, stage action panel on the right ──
function useQueue(status: LaundryOrderStatus, filter?: (o: OrderRow) => boolean) {
  const { currentBusinessId } = useAuthStore()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId: currentBusinessId, status, limit: "100" })
      if (search.trim()) params.set("search", search.trim())
      const json = await fetch(`/api/laundry/orders?${params}`).then((r) => r.json())
      const rows: OrderRow[] = json.success ? json.data : []
      setOrders(filter ? rows.filter(filter) : rows)
    } catch { setOrders([]) } finally { setLoading(false) }
  }, [currentBusinessId, status, search, filter])
  useEffect(() => { load() }, [load])
  return { orders, loading, search, setSearch, load }
}

function QueueShell({ status, title, subtitle, icon: Icon, selected, onSelect, children, queue }: {
  status: LaundryOrderStatus; title: string; subtitle: string
  icon: React.ComponentType<{ className?: string }>
  selected: OrderRow | null
  onSelect: (o: OrderRow | null) => void
  children: React.ReactNode
  queue: ReturnType<typeof useQueue>
}) {
  const { orders, loading, search, setSearch, load } = queue
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><Icon className="h-5 w-5 text-blue-600" /> {title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle} — {orders.length} order{orders.length === 1 ? "" : "s"}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-4">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search order #…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No orders in this stage</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {orders.map((o) => (
                <Card key={o.id} className={`cursor-pointer transition-colors ${selected?.id === o.id ? "ring-2 ring-blue-500" : "hover:bg-accent/50"}`} onClick={() => onSelect(o)}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold">{o.orderNumber}</span>
                      <Badge variant="outline" className="text-[10px]">{o.orderType}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{o.customer?.name || "—"}</span>
                      <span>{inr(o.grandTotal)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(o.createdAt).toLocaleDateString("en-IN")}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <div>
          {!selected
            ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Select an order to perform this stage&apos;s action.</CardContent></Card>
            : children}
        </div>
      </div>
    </div>
  )
}

function OrderHeader({ o }: { o: OrderRow }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-mono text-sm font-bold">{o.orderNumber}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
          <span className="flex items-center gap-1"><User className="h-3 w-3" />{o.customer?.name || "—"}</span>
          {o.customer?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{o.customer.phone}</span>}
          <span className="flex items-center gap-1"><Shirt className="h-3 w-3" />{o.itemCount} garment{o.itemCount === 1 ? "" : "s"}</span>
        </p>
      </div>
      <Badge className="bg-blue-100 text-blue-700">{statusLabel(o.status)}</Badge>
    </div>
  )
}

// ═════════════════════════ PAYMENT COLLECTION ═══════════════════════════════
const PAY_METHODS = ["CASH", "UPI", "CARD", "WALLET"]

export function LaundryPaymentCollection() {
  const { currentBusinessId, user } = useAuthStore()
  const queue = useQueue("PAYMENT_PENDING")
  const [selected, setSelected] = useState<OrderRow | null>(null)
  const [dues, setDues] = useState<{ laundryDue: number; totalCustomerDue: number; subscription?: { planName: string | null; due: number } | null } | null>(null)
  const [method, setMethod] = useState("CASH")
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [busy, setBusy] = useState(false)

  const openOrder = async (o: OrderRow | null) => {
    setSelected(o); setDues(null); setReference("")
    if (!o || !currentBusinessId) return
    const j = await fetch(`/api/laundry/orders/${o.id}/payment?businessId=${currentBusinessId}`).then((r) => r.json()).catch(() => null)
    if (j?.success) { setDues(j.data); setAmount(String(j.data.totalCustomerDue || 0)) }
  }

  const record = async () => {
    if (!selected || !currentBusinessId) return
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount")
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/orders/${selected.id}/payment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, method, amount: amt, reference: reference || undefined, createdBy: user?.name }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Payment failed")
      const st = j.data.order?.paymentStatus
      toast.success(`${inr(amt)} recorded via ${method}${st === "PAID" ? " — order moved to Packing" : ` (${st})`}`)
      setSelected(null); queue.load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Payment failed") } finally { setBusy(false) }
  }

  const payLater = async () => {
    if (!selected || !currentBusinessId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/orders/${selected.id}/payment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, action: "PAY_LATER", createdBy: user?.name }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Could not proceed")
      toast.success("Order moved to Packing — balance collected at delivery")
      setSelected(null); queue.load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not proceed") } finally { setBusy(false) }
  }

  return (
    <QueueShell status="PAYMENT_PENDING" title="Payment Collection" subtitle="Record payment against the audited order total"
      icon={CreditCard} selected={selected} onSelect={openOrder} queue={queue}>
      {selected && (
        <Card><CardContent className="p-5 space-y-4">
          <OrderHeader o={selected} />
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-slate-400">Order Total</p><p className="text-lg font-bold">{inr(selected.grandTotal)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-slate-400">Paid</p><p className="text-lg font-bold text-emerald-600">{inr(selected.amountPaid)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-slate-400">Due Now</p><p className="text-lg font-bold text-rose-600">{dues ? inr(dues.totalCustomerDue) : "…"}</p></div>
          </div>
          {dues?.subscription && (
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              Includes subscription purchase &quot;{dues.subscription.planName}&quot; — {inr(dues.subscription.due)} due (activates when fully paid).
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount</Label>
              <div className="relative"><IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><Input type="number" min={0} className="pl-8 h-9" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reference (UPI txn / receipt no. — optional)</Label>
            <Input className="h-9" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. UPI 4521…" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={record} disabled={busy} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />} Record Payment
            </Button>
            <Button onClick={payLater} disabled={busy} variant="outline" className="gap-1">Pay at Delivery</Button>
          </div>
        </CardContent></Card>
      )}
    </QueueShell>
  )
}

// ═════════════════════════ PACKING & QR ═════════════════════════════════════
interface Packet { id: string; packetNumber: string; status: string; qrValue: string; itemCount: number; packedBy: string | null; packedAt: string; dispatchedAt: string | null }

function QrImage({ value, size = 160 }: { value: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { QRCode.toDataURL(value, { width: size, margin: 1 }).then(setUrl).catch(() => setUrl(null)) }, [value, size])
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={value} width={size} height={size} className="rounded border border-slate-200" /> : <div style={{ width: size, height: size }} className="rounded bg-slate-100" />
}

function printPacketLabel(p: { packetNumber: string; qrValue: string; itemCount: number }, orderNumber: string, storeName: string | null | undefined) {
  QRCode.toDataURL(p.qrValue, { width: 240, margin: 1 }).then((url) => {
    const w = window.open("", "_blank", "width=420,height=520")
    if (!w) return
    w.document.write(`<html><head><title>${p.packetNumber}</title></head><body style="font-family:monospace;text-align:center;padding:16px">
      <img src="${url}" width="240" height="240" />
      <h2 style="margin:8px 0 2px">${p.packetNumber}</h2>
      <p style="margin:2px">Order: ${orderNumber}</p>
      <p style="margin:2px">Store: ${storeName || "—"} · ${p.itemCount} garment(s)</p>
      <script>window.onload = () => setTimeout(() => window.print(), 200)</script>
    </body></html>`)
    w.document.close()
  })
}

interface PackHistoryRow { id: string; orderNumber: string; customer?: { name?: string | null } | null; customerName?: string | null; store?: { storeName?: string | null } | null; createdAt: string; packet?: { packetNumber: string; qrValue: string; itemCount: number; packedBy: string | null; packedAt: string } | null }

export function LaundryPacking() {
  const { currentBusinessId, user } = useAuthStore()
  const { setLaundryPage } = useAdminStore()
  const [tab, setTab] = useState<"pending" | "history">("pending")
  // Incomplete-audit orders never appear in the Packing queue.
  const queue = useQueue("READY_FOR_PROCESSING", auditReadyForPacking)
  const [selected, setSelected] = useState<OrderRow | null>(null)
  const [packet, setPacket] = useState<Packet | null>(null)
  const [busy, setBusy] = useState(false)
  // History (packet completion, stored data — not order status)
  const [hist, setHist] = useState<PackHistoryRow[]>([])
  const [histSel, setHistSel] = useState<PackHistoryRow | null>(null)
  const [histSearch, setHistSearch] = useState("")
  const [histLoading, setHistLoading] = useState(false)

  const openOrder = (o: OrderRow | null) => { setSelected(o); setPacket(null) }

  const pack = async () => {
    if (!selected || !currentBusinessId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/orders/${selected.id}/pack`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, actorId: user?.id, actorName: user?.name }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.message || j.error || "Packing failed")
      setPacket(j.data)
      toast.success(j.alreadyPacked ? `Packet already exists — ${j.data.packetNumber}` : `Packet created — ${j.data.packetNumber}`)
      queue.load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Packing failed") } finally { setBusy(false) }
  }

  const loadHist = useCallback(async () => {
    if (!currentBusinessId) return
    setHistLoading(true)
    try {
      const p = new URLSearchParams({ businessId: currentBusinessId, packed: "1", limit: "50" })
      if (histSearch.trim()) p.set("search", histSearch.trim())
      const j = await fetch(`/api/laundry/orders?${p}`).then((r) => r.json())
      setHist(j.data || [])
    } catch { /* noop */ } finally { setHistLoading(false) }
  }, [currentBusinessId, histSearch])
  useEffect(() => { if (tab === "history") loadHist() }, [tab, loadHist])

  const Tabs = (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit mx-4 lg:mx-6 mt-4">
      {([["pending", "Pending"], ["history", "History"]] as const).map(([k, lbl]) => (
        <button key={k} onClick={() => { setTab(k); setHistSel(null) }} className={`rounded-md px-4 py-1.5 text-sm font-semibold ${tab === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{lbl}</button>
      ))}
    </div>
  )

  if (tab === "history") {
    return (
      <div>
        {Tabs}
        <div className="px-4 lg:px-6 py-4">
          {histSel && histSel.packet ? (
            <Card><CardContent className="p-5 space-y-3">
              <button onClick={() => setHistSel(null)} className="text-sm text-slate-500">← Back to History</button>
              <div className="flex items-center gap-2"><span className="font-mono text-sm font-bold text-slate-800">{histSel.orderNumber}</span><Badge variant="outline" className="border-slate-300 text-slate-600 bg-slate-50">History · Read-only</Badge></div>
              <div className="flex flex-col items-center gap-3 py-2">
                <QrImage value={histSel.packet.qrValue} />
                <p className="font-mono text-sm font-bold">{histSel.packet.packetNumber}</p>
                <p className="text-xs text-slate-400">{histSel.packet.itemCount} garment(s) · packed by {histSel.packet.packedBy || "—"} · {fmt(histSel.packet.packedAt)}</p>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => printPacketLabel(histSel.packet!, histSel.orderNumber, histSel.store?.storeName)}><Printer className="h-3.5 w-3.5" /> Print QR Again</Button>
              </div>
            </CardContent></Card>
          ) : (
            <Card><CardContent className="p-4">
              <div className="relative w-full max-w-sm mb-3"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><Input value={histSearch} onChange={(e) => setHistSearch(e.target.value)} placeholder="Order no, customer, mobile…" className="h-8 pl-8 text-sm" /></div>
              {histLoading ? <div className="py-10 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : hist.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No packed orders found.</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {hist.filter((o) => o.packet).map((o) => (
                    <button key={o.id} onClick={() => setHistSel(o)} className="flex w-full items-center justify-between py-2.5 text-left hover:bg-slate-50 rounded px-1">
                      <div>
                        <p className="font-mono text-sm font-semibold text-slate-800">{o.orderNumber} <span className="font-sans font-normal text-slate-400">· {o.customer?.name || o.customerName || "—"}</span></p>
                        <p className="text-[11px] text-slate-400">{o.packet?.packetNumber} · {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}{o.store?.storeName ? ` · ${o.store.storeName}` : ""}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"><Printer className="h-3.5 w-3.5" /> View / Print</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent></Card>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>{Tabs}
    <QueueShell status="READY_FOR_PROCESSING" title="Packing & QR" subtitle="Pack the audited order and generate its package QR"
      icon={QrCode} selected={selected} onSelect={openOrder} queue={queue}>
      {selected && (
        <Card><CardContent className="p-5 space-y-4">
          <OrderHeader o={selected} />
          {selected.auditComplete === false ? (
            // Safety net: an incomplete order must never be packable, even if it
            // reaches this screen (legacy data / manual DB change). No override.
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-rose-700 font-semibold"><AlertTriangle className="h-5 w-5" /> Cannot Pack Order</div>
              <p className="text-sm text-rose-700/90">This order cannot be packed because not all garments have been identified during Store Audit. Please return to Store Audit, identify all garments, complete the audit, and then try again.</p>
              <div className="flex gap-2">
                <Button onClick={() => setLaundryPage("audit-queue")} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"><ClipboardCheck className="h-4 w-4" /> Go to Store Audit</Button>
                <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
              </div>
            </div>
          ) : !packet ? (
            <>
              <p className="text-sm text-slate-500">Confirm the audited garments are packed into one package. A persistent packet identity (PKT-…) with a QR label is created — the Processing Center receives by scanning it.</p>
              <Button onClick={pack} disabled={busy} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />} Confirm Packing & Generate QR
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-2">
              <QrImage value={packet.qrValue} />
              <p className="font-mono text-sm font-bold">{packet.packetNumber}</p>
              <p className="text-xs text-slate-400">{packet.itemCount} garment(s) · packed by {packet.packedBy || "—"} · {fmt(packet.packedAt)}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => printPacketLabel(packet, selected.orderNumber, selected.store?.storeName)}><Printer className="h-3.5 w-3.5" /> Print QR Label</Button>
                <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setSelected(null); queue.load() }}><CheckCircle2 className="h-3.5 w-3.5" /> Done — Next Order</Button>
              </div>
            </div>
          )}
        </CardContent></Card>
      )}
    </QueueShell>
    </div>
  )
}

// ═════════════════════════ TRANSIT TO PROCESSING (DISPATCH) ═════════════════
export function LaundryDispatch() {
  const { currentBusinessId, user } = useAuthStore()
  const queue = useQueue("PACKED")
  const [selected, setSelected] = useState<OrderRow | null>(null)
  const [packet, setPacket] = useState<Packet | null>(null)
  const [transportBy, setTransportBy] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const openOrder = async (o: OrderRow | null) => {
    setSelected(o); setPacket(null); setTransportBy(""); setNote("")
    if (!o || !currentBusinessId) return
    const j = await fetch(`/api/laundry/packets?businessId=${currentBusinessId}&code=${encodeURIComponent(o.orderNumber)}`).then((r) => r.json()).catch(() => null)
    if (j?.success && j.data[0]) setPacket(j.data[0])
  }

  const dispatch = async () => {
    if (!selected || !currentBusinessId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/orders/${selected.id}/dispatch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, actorId: user?.id, actorName: user?.name, transportBy: transportBy || undefined, note: note || undefined }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Dispatch failed")
      toast.success(`${j.data.packetNumber} dispatched to Processing Center`)
      setSelected(null); queue.load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Dispatch failed") } finally { setBusy(false) }
  }

  return (
    <QueueShell status="PACKED" title="Transit to Processing" subtitle="Dispatch packed packets to the Processing Center"
      icon={Truck} selected={selected} onSelect={openOrder} queue={queue}>
      {selected && (
        <Card><CardContent className="p-5 space-y-4">
          <OrderHeader o={selected} />
          {packet && (
            <div className="flex items-center gap-4 rounded-lg border p-3">
              <QrImage value={packet.qrValue} size={72} />
              <div>
                <p className="font-mono text-sm font-bold">{packet.packetNumber}</p>
                <p className="text-xs text-slate-400">{packet.itemCount} garment(s) · packed {fmt(packet.packedAt)}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Transport / Runner (optional)</Label><Input className="h-9" value={transportBy} onChange={(e) => setTransportBy(e.target.value)} placeholder="e.g. Ravi — bike" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Dispatch Note (optional)</Label><Input className="h-9" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <Button onClick={dispatch} disabled={busy} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Dispatch to Processing Center
          </Button>
        </CardContent></Card>
      )}
    </QueueShell>
  )
}

// ═════════════════════════ STORE RECEIVE (RETURN) ═══════════════════════════
export function LaundryStoreReceive() {
  const { currentBusinessId, user } = useAuthStore()
  const queue = useQueue("RETURN_IN_TRANSIT")
  const [selected, setSelected] = useState<OrderRow | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const receive = async () => {
    if (!selected || !currentBusinessId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/orders/${selected.id}/store-receive`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, actorId: user?.id, actorName: user?.name, note: note || undefined }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Receive failed")
      toast.success(`${j.data.orderNumber} received — Ready for Delivery`)
      setSelected(null); setNote(""); queue.load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Receive failed") } finally { setBusy(false) }
  }

  return (
    <QueueShell status="RETURN_IN_TRANSIT" title="Store Receive" subtitle="Confirm processed orders returned from the Processing Center"
      icon={PackageCheck} selected={selected} onSelect={setSelected} queue={queue}>
      {selected && (
        <Card><CardContent className="p-5 space-y-4">
          <OrderHeader o={selected} />
          <p className="text-sm text-slate-500">Verify all <b>{selected.itemCount}</b> garment(s) are present and undamaged, then confirm receipt. Any discrepancy goes in the note.</p>
          <div className="space-y-1.5"><Label className="text-xs">Receive Note / Discrepancy (optional)</Label><Textarea rows={2} className="text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. All garments verified" /></div>
          <Button onClick={receive} disabled={busy} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Confirm Receipt — Ready for Delivery
          </Button>
        </CardContent></Card>
      )}
    </QueueShell>
  )
}

// ═════════════════════════ READY FOR DELIVERY ═══════════════════════════════
export function LaundryReadyForDelivery() {
  const { currentBusinessId, user } = useAuthStore()
  const queue = useQueue("READY_FOR_DELIVERY")
  const [selected, setSelected] = useState<OrderRow | null>(null)
  const [recipient, setRecipient] = useState("")
  const [note, setNote] = useState("")
  const [method, setMethod] = useState("CASH")
  const [reference, setReference] = useState("")
  const [busy, setBusy] = useState(false)
  const [schedulingDel, setSchedulingDel] = useState(false)
  const [delForm, setDelForm] = useState({ address: "", date: "", timeSlot: "", assignNow: false, executiveId: "" })
  const [scheduleBusy, setScheduleBusy] = useState(false)
  const [execs, setExecs] = useState<{ id: string; name: string }[]>([])
  const [delAddresses, setDelAddresses] = useState<{ id: string; addressLine1: string; area: string | null; city: string; label?: string | null; addressType?: string | null; isDeliveryDefault?: boolean }[]>([])
  const [delAddrLoading, setDelAddrLoading] = useState(false)

  const openOrder = async (o: OrderRow | null) => {
    setSelected(o); setRecipient(o?.customer?.name || ""); setNote(""); setReference(""); setSchedulingDel(false)
    setDelForm({ address: "", date: new Date().toISOString().split("T")[0], timeSlot: "", assignNow: false, executiveId: "" })
    setDelAddresses([])
    if (o && currentBusinessId) {
      const j = await fetch(`/api/laundry/delivery-executives?businessId=${currentBusinessId}`).then((r) => r.json()).catch(() => null)
      if (j?.success) setExecs(j.data)
      if (o.customerId) {
        setDelAddrLoading(true)
        const addrRes = await fetch(`/api/laundry/customers/${o.customerId}/addresses?businessId=${currentBusinessId}`).then((r) => r.json()).catch(() => null)
        if (addrRes?.success) {
          const addrs = addrRes.data || []
          setDelAddresses(addrs)
          const def = addrs.find((a: any) => a.isDeliveryDefault) || addrs[0]
          if (def) setDelForm((f) => ({ ...f, address: [def.addressLine1, def.area, def.city].filter(Boolean).join(", ") }))
        }
        setDelAddrLoading(false)
      }
    }
  }
  const covered = selected ? selected.paymentStatus === "PAID" || selected.paymentStatus === "SUBSCRIPTION" || selected.balanceDue <= 0 : false

  const collectFinal = async () => {
    if (!selected || !currentBusinessId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/orders/${selected.id}/payment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, method, amount: selected.balanceDue, reference: reference || undefined, createdBy: user?.name }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Payment failed")
      toast.success(`Final payment ${inr(selected.balanceDue)} recorded`)
      const fresh = j.data.order
      setSelected({ ...selected, amountPaid: fresh.amountPaid, balanceDue: fresh.balanceDue, paymentStatus: fresh.paymentStatus })
      queue.load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Payment failed") } finally { setBusy(false) }
  }

  const deliver = async () => {
    if (!selected || !currentBusinessId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/orders/${selected.id}/deliver`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, actorId: user?.id, actorName: user?.name, recipientName: recipient || undefined, note: note || undefined }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Delivery failed")
      toast.success(`${j.data.orderNumber} delivered (${j.data.deliveryType}) 🎉`)
      setSelected(null); queue.load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delivery failed") } finally { setBusy(false) }
  }

  const pickupType = selected && (selected.orderType === "WALK_IN" || selected.orderType === "STORE_DROP")

  return (
    <QueueShell status="READY_FOR_DELIVERY" title="Ready for Delivery" subtitle="Final payment and customer handover / delivery"
      icon={CheckCircle2} selected={selected} onSelect={openOrder} queue={queue}>
      {selected && (
        <Card><CardContent className="p-5 space-y-4">
          <OrderHeader o={selected} />
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-slate-400">Total</p><p className="text-lg font-bold">{inr(selected.grandTotal)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-slate-400">Paid</p><p className="text-lg font-bold text-emerald-600">{inr(selected.amountPaid)}</p></div>
            <div className={`rounded-lg border p-3 ${covered ? "" : "border-rose-300 bg-rose-50"}`}><p className="text-[10px] uppercase text-slate-400">Balance Due</p><p className={`text-lg font-bold ${covered ? "text-emerald-600" : "text-rose-600"}`}>{selected.paymentStatus === "SUBSCRIPTION" ? "Covered" : inr(selected.balanceDue)}</p></div>
          </div>

          {/* Schedule Home Delivery */}
          {!pickupType && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2">
              {!schedulingDel ? (
                <Button onClick={() => setSchedulingDel(true)} variant="outline" className="gap-1 border-blue-200 text-blue-700 w-full h-8 text-xs">
                  <Truck className="h-3.5 w-3.5" /> Schedule Home Delivery
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-blue-800">Schedule Home Delivery</p>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500">Delivery Address</label>
                    <div className="flex gap-1">
                      <input value={delForm.address} onChange={(e) => setDelForm((f) => ({ ...f, address: e.target.value }))} className="w-full h-7 text-xs rounded border border-slate-200 px-2 bg-white flex-1" placeholder="Enter delivery address" />
                      {delAddresses.length > 0 && (
                        <select className="h-7 text-[10px] border border-slate-200 rounded px-1 bg-white shrink-0 max-w-[120px]" defaultValue="" onChange={(e) => { if (!e.target.value) return; const a = delAddresses.find((ad) => ad.id === e.target.value); if (a) setDelForm((f) => ({ ...f, address: [a.addressLine1, a.area, a.city].filter(Boolean).join(", ") })) }}>
                          <option value="" disabled>Change…</option>
                          {delAddresses.map((a) => <option key={a.id} value={a.id}>{a.label || a.addressType || "Addr"}</option>)}
                        </select>
                      )}
                      {delAddrLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400 my-auto" />}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><label className="text-[10px] text-slate-500">Date</label><input type="date" value={delForm.date} onChange={(e) => setDelForm((f) => ({ ...f, date: e.target.value }))} className="w-full h-7 text-xs rounded border border-slate-200 px-2 bg-white" /></div>
                    <div className="space-y-1"><label className="text-[10px] text-slate-500">Time Slot</label><input value={delForm.timeSlot} onChange={(e) => setDelForm((f) => ({ ...f, timeSlot: e.target.value }))} className="w-full h-7 text-xs rounded border border-slate-200 px-2 bg-white" placeholder="e.g. 14:00–16:00" /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer"><input type="checkbox" checked={delForm.assignNow} onChange={(e) => setDelForm((f) => ({ ...f, assignNow: e.target.checked }))} /> Assign Now</label>
                    {delForm.assignNow && (
                      <select value={delForm.executiveId} onChange={(e) => setDelForm((f) => ({ ...f, executiveId: e.target.value }))} className="h-7 text-[10px] rounded border border-slate-200 px-1 bg-white flex-1">
                        <option value="">Select executive</option>
                        {execs.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-[10px] gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1" disabled={scheduleBusy} onClick={async () => {
                      if (!selected || !currentBusinessId) return
                      setScheduleBusy(true)
                      try {
                        const res = await fetch("/api/laundry/dispatch/delivery", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            businessId: currentBusinessId, orderId: selected.id,
                            executiveId: delForm.assignNow && delForm.executiveId ? delForm.executiveId : null,
                            notes: `Delivery scheduled${delForm.timeSlot ? ` at ${delForm.timeSlot}` : ""}${delForm.address ? ` to ${delForm.address}` : ""}`,
                          }),
                        })
                        const j = await res.json()
                        if (!res.ok || !j.success) throw new Error(j.error || "Failed")
                        toast.success("Delivery scheduled")
                        setSchedulingDel(false)
                        queue.load()
                      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
                      finally { setScheduleBusy(false) }
                    }}>
                      {scheduleBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Schedule
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setSchedulingDel(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!covered && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 space-y-3">
              <p className="text-sm font-medium text-rose-700">Outstanding balance must be collected before handover.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Reference (optional)</Label><Input className="h-9 bg-white" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
              </div>
              <Button onClick={collectFinal} disabled={busy} className="gap-1 bg-rose-600 hover:bg-rose-700 text-white w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />} Collect {inr(selected.balanceDue)}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Received By (recipient)</Label><Input className="h-9" value={recipient} onChange={(e) => setRecipient(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Delivery Note (optional)</Label><Input className="h-9" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <Button onClick={deliver} disabled={busy || !covered} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white w-full disabled:bg-slate-300">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {pickupType ? "Hand Over to Customer" : "Complete Delivery"}
          </Button>
        </CardContent></Card>
      )}
    </QueueShell>
  )
}
