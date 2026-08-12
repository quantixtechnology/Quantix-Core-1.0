"use client"

// Store Counter operational stages — each screen performs the REAL business
// action for its stage (never a bare status change):
//   · Payment Collection  — records money against the order (or an explicit
//     policy-allowed pay-later decision), then the order advances.
//   · Packing & QR        — stamps the package's transport identity. WHICH
//     identity comes from Workspace Settings → Transport Setup: a generated
//     packet QR (PKT-…) or the reusable laundry bag QR. Never both hardcoded.
//   · Transit to Processing — dispatches that package (who/when/transport).
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
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { BagScanButton } from "@/components/laundry/bag-scanner"
import { generateSlots, slotIsPast, DEFAULT_DELIVERY_SLOT } from "@/lib/laundry-slots"
import { statusLabel, type LaundryOrderStatus } from "@/lib/laundry-workflow"
import { printHtmlDocument } from "@/lib/print-utils"
import { useTransportModes } from "@/hooks/use-transport-modes"
import { NO_EXECUTIVES_FOR_STORE } from "@/lib/laundry-eligible-executives"
import { DeliveryPromiseBadge, DeliveryPromiseCard } from "@/components/laundry/delivery-promise"
import type { DeliveryPromiseInput } from "@/lib/laundry-delivery-promise"
import { transportNoun, transportScanPlaceholder, usesBag, usesPacket, type TransportRef } from "@/lib/laundry-transport"

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
  // The promise frozen at booking — what the customer was actually told.
  promisedDeliveryDate?: string | null; promisedDeliveryTimeSlot?: string | null
  promisedBackupDeliveryDate?: string | null; promisedBackupDeliveryTimeSlot?: string | null
  deliveryDate?: string | null; deliveryTimeSlot?: string | null
  auditComplete?: boolean
  deliveryOtp?: string | null; deliveryVerificationMethod?: string | null
  pickupOtp?: string | null; pickupVerificationMethod?: string | null
  storeId?: string | null
  store?: { storeName: string | null } | null
  customer?: { name: string; phone: string | null } | null
  // Transport identity resolved by the API through Transport Setup.
  transport?: TransportRef | null
  transportCode?: string | null
}

// ── Shared queue shell: list on the left, stage action panel on the right ──
function useQueue(status: LaundryOrderStatus, filter?: (o: OrderRow) => boolean) {
  const { currentBusinessId } = useAuthStore()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const load = useCallback(async (silent = false) => {
    if (!currentBusinessId) return
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({ businessId: currentBusinessId, status, limit: "100" })
      if (search.trim()) params.set("search", search.trim())
      const json = await fetch(`/api/laundry/orders?${params}`).then((r) => r.json())
      const rows: OrderRow[] = json.success ? json.data : []
      setOrders(filter ? rows.filter(filter) : rows)
    } catch { setOrders([]) } finally { if (!silent) setLoading(false) }
  }, [currentBusinessId, status, search, filter])
  useEffect(() => { load() }, [load])
  // Live queue: refresh on tab focus + a light poll so orders arriving from the
  // previous stage (audit → payment → packing → …) appear without a manual refresh.
  useAutoRefresh(() => load(true), { intervalMs: 12000 })
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
        <Button variant="outline" size="sm" className="gap-1" onClick={() => load()} disabled={loading}>
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
                      <span className="font-mono text-xs font-semibold">{o.orderNumber}</span><DeliveryPromiseBadge order={o as DeliveryPromiseInput} />
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
  const { setLaundryPage } = useAdminStore()
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
      toast.success(nothingDue ? "Order moved to Processing — nothing to collect" : "Order moved to Packing — balance collected at delivery")
      setSelected(null); queue.load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not proceed") } finally { setBusy(false) }
  }

  // Corrective edit: a garment was missed and the order was already pushed to
  // Payment. Reopen it into Store Audit to add + inspect the garment and re-approve
  // (only valid before payment is collected, so the total can't diverge from money).
  const reopenAudit = async () => {
    if (!selected || !currentBusinessId) return
    if (!window.confirm("Reopen this order for editing? It returns to Store Audit so you can add and inspect the missed garment, then re-approve.")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/orders/${selected.id}/transition`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: "PENDING_STORE_AUDIT", actorName: user?.name, note: "Reopened to edit garments (missed garment)" }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Could not reopen")
      toast.success("Order reopened — opening Store Audit to add the garment")
      setSelected(null); queue.load(); setLaundryPage("audit-queue")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not reopen") } finally { setBusy(false) }
  }

  // Subscription-covered or otherwise prepaid → nothing to collect. Show a
  // "covered" state and a single Continue action instead of a ₹0 payment form.
  const nothingDue = !!dues && dues.totalCustomerDue <= 0

  return (
    <QueueShell status="PAYMENT_PENDING" title="Payment Collection" subtitle="Record payment against the audited order total"
      icon={CreditCard} selected={selected} onSelect={openOrder} queue={queue}>
      {selected && (
        <Card><CardContent className="p-5 space-y-4">
          <OrderHeader o={selected} />
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-slate-400">Order Total</p><p className="text-lg font-bold">{inr(selected.grandTotal)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-slate-400">Paid</p><p className="text-lg font-bold text-emerald-600">{inr(selected.amountPaid)}</p></div>
            <div className={`rounded-lg border p-3 ${nothingDue ? "border-emerald-200 bg-emerald-50" : ""}`}><p className="text-[10px] uppercase text-slate-400">Due Now</p><p className={`text-lg font-bold ${nothingDue ? "text-emerald-600" : "text-rose-600"}`}>{dues ? inr(dues.totalCustomerDue) : "…"}</p></div>
          </div>
          {dues?.subscription && (
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              Includes subscription purchase &quot;{dues.subscription.planName}&quot; — {inr(dues.subscription.due)} due (activates when fully paid).
            </p>
          )}
          {nothingDue ? (
            <div className="space-y-3">
              <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                {selected.paymentStatus === "SUBSCRIPTION" || selected.amountPaid > 0
                  ? "Fully covered by subscription — nothing to collect."
                  : "No balance due — nothing to collect."}
              </p>
              <Button onClick={payLater} disabled={busy} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />} Complete — Move to Processing
              </Button>
            </div>
          ) : (
          <>
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
          </>
          )}
          {/* Missed a garment? Reopen the order into Store Audit before taking money. */}
          <button onClick={reopenAudit} disabled={busy} className="w-full flex items-center justify-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-blue-700 disabled:opacity-50">
            <ClipboardCheck className="h-4 w-4" /> Missed a garment? Edit / Reopen Audit
          </button>
        </CardContent></Card>
      )}
    </QueueShell>
  )
}

// ═════════════════════════ PACKING & QR ═════════════════════════════════════
// The result of a pack: the transport identity the operator must act on.
interface PackResult { transport: TransportRef; itemCount: number; packedBy: string | null; packedAt: string }

function QrImage({ value, size = 160 }: { value: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { QRCode.toDataURL(value, { width: size, margin: 1 }).then(setUrl).catch(() => setUrl(null)) }, [value, size])
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={value} width={size} height={size} className="rounded border border-slate-200" /> : <div style={{ width: size, height: size }} className="rounded bg-slate-100" />
}

// Only ever called for a PACKET identity — a bag already carries its permanent
// printed QR, so BAG mode never prints a transport label.
function printPacketLabel(p: { code: string; qrValue: string; itemCount: number }, orderNumber: string, storeName: string | null | undefined) {
  QRCode.toDataURL(p.qrValue, { width: 240, margin: 1 }).then((url) => {
    // Print via a hidden iframe (never a popup — see printHtmlDocument). The QR
    // is an inline data-URI, so there is nothing external to wait on.
    printHtmlDocument(`<html><head><title>${p.code}</title></head><body style="font-family:monospace;text-align:center;padding:16px">
      <img src="${url}" width="240" height="240" />
      <h2 style="margin:8px 0 2px">${p.code}</h2>
      <p style="margin:2px">Order: ${orderNumber}</p>
      <p style="margin:2px">Store: ${storeName || "—"} · ${p.itemCount} garment(s)</p>
    </body></html>`, p.code)
  })
}

interface PackHistoryRow {
  id: string; orderNumber: string; customer?: { name?: string | null } | null; customerName?: string | null
  store?: { storeName?: string | null } | null; createdAt: string; itemCount?: number
  // The ONLY identity a history row carries — resolved via Transport Setup.
  transport?: TransportRef | null; transportCode?: string | null
}

export function LaundryPacking() {
  const { currentBusinessId, user } = useAuthStore()
  const { setLaundryPage } = useAdminStore()
  const [tab, setTab] = useState<"pending" | "history">("pending")
  // Incomplete-audit orders never appear in the Packing queue.
  const queue = useQueue("READY_FOR_PROCESSING", auditReadyForPacking)
  const [selected, setSelected] = useState<OrderRow | null>(null)
  const [result, setResult] = useState<PackResult | null>(null)
  const [busy, setBusy] = useState(false)
  // Transport Setup is the ONLY thing that decides what identifies the package.
  const { storeToProcessing: mode } = useTransportModes(currentBusinessId)
  const noun = transportNoun(mode)
  // History (packing completion, stored data — not order status)
  const [hist, setHist] = useState<PackHistoryRow[]>([])
  const [histSel, setHistSel] = useState<PackHistoryRow | null>(null)
  const [histSearch, setHistSearch] = useState("")
  const [histLoading, setHistLoading] = useState(false)

  const openOrder = (o: OrderRow | null) => { setSelected(o); setResult(null) }

  const runPack = async (bagCode?: string) => {
    if (!selected || !currentBusinessId) return
    setBusy(true)
    try {
      if (bagCode) {
        const svc = selected as { services?: { serviceId: string; serviceName: string }[] }
        await fetch("/api/laundry/bags/assign", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: currentBusinessId, code: bagCode, orderId: selected.id,
            serviceId: svc.services?.[0]?.serviceId ?? null, serviceName: svc.services?.[0]?.serviceName ?? "Transport",
          }),
        }).then((r) => r.json()).then((j) => { if (!j.success) throw new Error(j.error || "Bag assignment failed") })
      }
      const res = await fetch(`/api/laundry/orders/${selected.id}/pack`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, actorId: user?.id, actorName: user?.name }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.message || j.error || "Packing failed")
      setResult({ transport: j.data.transport, itemCount: j.data.itemCount, packedBy: j.data.packedBy, packedAt: j.data.packedAt })
      const code = j.data.transport?.code
      toast.success(j.alreadyPacked ? `${noun} already assigned — ${code}` : `${noun} ${code} ready for transit`)
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
          {histSel && histSel.transport?.code ? (
            <Card><CardContent className="p-5 space-y-3">
              <button onClick={() => setHistSel(null)} className="text-sm text-slate-500">← Back to History</button>
              <div className="flex items-center gap-2"><span className="font-mono text-sm font-bold text-slate-800">{histSel.orderNumber}</span><Badge variant="outline" className="border-slate-300 text-slate-600 bg-slate-50">History · Read-only</Badge></div>
              <div className="flex flex-col items-center gap-3 py-2">
                <QrImage value={histSel.transport.qrValue || histSel.transport.code} />
                <p className="font-mono text-sm font-bold">{histSel.transport.code}</p>
                <p className="text-xs text-slate-400">
                  {histSel.transport.kind === "BAG" ? "Laundry bag" : "Processing packet"} · {histSel.itemCount ?? 0} garment(s) · {fmt(histSel.createdAt)}
                </p>
                {/* A bag's QR is permanent and already printed on the bag. */}
                {histSel.transport.kind === "PACKET" && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => printPacketLabel({ code: histSel.transport!.code!, qrValue: histSel.transport!.qrValue || histSel.transport!.code!, itemCount: histSel.itemCount ?? 0 }, histSel.orderNumber, histSel.store?.storeName)}><Printer className="h-3.5 w-3.5" /> Print QR Again</Button>
                )}
              </div>
            </CardContent></Card>
          ) : (
            <Card><CardContent className="p-4">
              <div className="relative w-full max-w-sm mb-3"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><Input value={histSearch} onChange={(e) => setHistSearch(e.target.value)} placeholder={`Order no, ${noun.toLowerCase()} no, customer, mobile…`} className="h-8 pl-8 text-sm" /></div>
              {histLoading ? <div className="py-10 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : hist.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No packed orders found.</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {hist.filter((o) => o.transport?.code).map((o) => (
                    <button key={o.id} onClick={() => setHistSel(o)} className="flex w-full items-center justify-between py-2.5 text-left hover:bg-slate-50 rounded px-1">
                      <div>
                        <p className="font-mono text-sm font-semibold text-slate-800">{o.orderNumber} <span className="font-sans font-normal text-slate-400">· {o.customer?.name || o.customerName || "—"}</span></p>
                        <p className="text-[11px] text-slate-400">{o.transport?.code} · {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}{o.store?.storeName ? ` · ${o.store.storeName}` : ""}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"><Printer className="h-3.5 w-3.5" /> View{o.transport?.kind === "PACKET" ? " / Print" : ""}</span>
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
    <QueueShell status="READY_FOR_PROCESSING" title="Packing & QR" subtitle={mode === "BAG" ? "Pack the audited order and scan its laundry bag" : "Pack the audited order and generate its package QR"}
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
          ) : !result ? (
            <>
              <p className="text-sm text-slate-500">
                {mode === "BAG"
                  ? "Confirm the audited garments are packed into one laundry bag, then scan that bag. Its permanent QR identifies the package — the Processing Center receives by scanning the same bag."
                  : mode === "PACKET"
                    ? "Confirm the audited garments are packed into one package. A persistent packet identity (PKT-…) with a QR label is created — the Processing Center receives by scanning it."
                    : "Confirm the audited garments are packed into one package. Generate a packet QR, or scan the laundry bag — either identifier is accepted at the Processing Center."}
              </p>
              {usesPacket(mode) && (
                <Button onClick={() => runPack()} disabled={busy} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white w-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />} Generate Packet QR
                </Button>
              )}
              {usesBag(mode) && (
                <div className="space-y-2 mt-2">
                  <p className="text-sm text-slate-500">Scan the reusable bag holding this order{mode === "BOTH" ? " — the bag QR is an equally valid package identifier." : "."}</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1"><QrCode className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input id="bag-scan" placeholder="Scan bag QR code…" className="pl-8 h-10 font-mono text-sm" onKeyDown={(e) => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v) runPack(v) } }} /></div>
                    <BagScanButton label="Scan" size="sm" onScan={(c) => runPack(c)} disabled={busy} closeOnScan className="h-10" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-2">
              <QrImage value={result.transport.qrValue || result.transport.code || ""} />
              <p className="font-mono text-sm font-bold">{result.transport.code}</p>
              <p className="text-xs text-slate-400">{result.transport.kind === "BAG" ? "Laundry bag" : "Processing packet"} · {result.itemCount} garment(s) · packed by {result.packedBy || "—"} · {fmt(result.packedAt)}</p>
              <div className="flex gap-2">
                {/* Bags carry a permanent printed QR — nothing to print here. */}
                {result.transport.kind === "PACKET" && result.transport.code && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => printPacketLabel({ code: result.transport.code!, qrValue: result.transport.qrValue || result.transport.code!, itemCount: result.itemCount }, selected.orderNumber, selected.store?.storeName)}><Printer className="h-3.5 w-3.5" /> Print QR Label</Button>
                )}
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
  const [transportBy, setTransportBy] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const { storeToProcessing: mode } = useTransportModes(currentBusinessId)
  const noun = transportNoun(mode)
  // The identifier comes with the order row (resolved server-side via Transport Setup).
  const ref = selected?.transport || null

  const openOrder = (o: OrderRow | null) => { setSelected(o); setTransportBy(""); setNote("") }

  const dispatchOrder = async (orderId: string) => {
    if (!currentBusinessId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/dispatch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, actorId: user?.id, actorName: user?.name, transportBy: transportBy || undefined, note: note || undefined }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Dispatch failed")
      toast.success(`${j.data.transportCode || j.data.orderNumber} dispatched to Processing Center`)
      setSelected(null); queue.load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Dispatch failed") } finally { setBusy(false) }
  }

  // Scan-to-dispatch: the scanned code is resolved to its order through the
  // configured transport mode — never through a bag-only or packet-only lookup.
  const dispatchByScan = async (code: string) => {
    if (!currentBusinessId || busy) return
    const q = code.trim()
    if (!q) return
    setBusy(true)
    try {
      const j = await fetch(`/api/laundry/transport/resolve?businessId=${encodeURIComponent(currentBusinessId)}&code=${encodeURIComponent(q)}&direction=STORE_TO_PROCESSING`).then((r) => r.json())
      if (!j.success) throw new Error(j.error || `No order matches "${q}"`)
      setBusy(false)
      await dispatchOrder(j.data.orderId)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Dispatch failed"); setBusy(false) }
  }

  return (
    <QueueShell status="PACKED" title="Transit to Processing" subtitle={`Dispatch packed ${mode === "BAG" ? "bags" : "packages"} to the Processing Center`}
      icon={Truck} selected={selected} onSelect={openOrder} queue={queue}>
      {selected && (
        <Card><CardContent className="p-5 space-y-4">
          <OrderHeader o={selected} />
          {ref?.code && (
            <div className="flex items-center gap-4 rounded-lg border p-3">
              <QrImage value={ref.qrValue || ref.code} size={72} />
              <div>
                <p className="font-mono text-sm font-bold">{ref.code}</p>
                <p className="text-xs text-slate-400">{ref.kind === "BAG" ? "Laundry bag" : "Processing packet"} · {selected.itemCount} garment(s)</p>
              </div>
            </div>
          )}
          {!ref?.code && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              No {noun.toLowerCase()} on this order yet — complete Packing &amp; QR first.
            </p>
          )}
          {usesBag(mode) && (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">Scan the bag assigned to this order to dispatch it.</p>
              <div className="flex gap-2">
                <div className="relative flex-1"><QrCode className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input placeholder="Scan bag QR code…" className="pl-8 h-10 font-mono text-sm" onKeyDown={(e) => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v) dispatchByScan(v) } }} /></div>
                <BagScanButton label="Scan" size="sm" onScan={(c) => dispatchByScan(c)} disabled={busy} closeOnScan className="h-10" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Transport / Runner (optional)</Label><Input className="h-9" value={transportBy} onChange={(e) => setTransportBy(e.target.value)} placeholder="e.g. Ravi — bike" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Dispatch Note (optional)</Label><Input className="h-9" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          {usesPacket(mode) ? (
            <Button onClick={() => dispatchOrder(selected.id)} disabled={busy} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Dispatch to Processing Center
            </Button>
          ) : (
            <p className="text-xs text-slate-400 text-center pt-2">Scan the assigned bag QR above to dispatch this order.</p>
          )}
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
  const [code, setCode] = useState("")
  // Return leg → Processing Center → Store mode.
  const { processingToStore: returnMode } = useTransportModes(currentBusinessId)

  const receiveOrder = async (orderId: string, noteOverride?: string): Promise<boolean> => {
    if (!currentBusinessId) return false
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/store-receive`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, actorId: user?.id, actorName: user?.name, note: noteOverride ?? (note || undefined) }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Receive failed")
      toast.success(`${j.data.orderNumber} received — Ready for Delivery`)
      setSelected(null); setNote(""); setCode(""); queue.load()
      return true
    } catch (e) { toast.error(e instanceof Error ? e.message : "Receive failed"); return false } finally { setBusy(false) }
  }
  const receive = () => {
    if (!selected) return
    // Manual receipt bypasses the scan, so it names the order and asks. A single
    // click must not accept a package nobody verified.
    if (!window.confirm(`Confirm receipt of ${selected.orderNumber} without scanning?\n\n${selected.itemCount} garment(s). Use this only when the QR cannot be scanned.`)) return
    receiveOrder(selected.id)
  }

  // Scan-first receive: the returning package carries the identifier configured
  // for the Processing Center → Store leg (bag QR or the same packet QR it went
  // out with). One resolver, one mode — the server confirms it's in return transit.
  const resolveAndReceive = async (raw?: string) => {
    // `raw` is present for the camera/scanner path. Falling back to `code` there
    // would receive whatever happened to be left in the box from an earlier
    // scan, which reads as "it accepted without me scanning anything".
    const q = (raw !== undefined ? raw : code).trim()
    if (!q) { toast.error("Nothing scanned — scan the bag or packet QR."); return }
    if (!currentBusinessId || busy) return
    let orderId: string | null = null
    try {
      const j = await fetch(`/api/laundry/transport/resolve?businessId=${encodeURIComponent(currentBusinessId)}&code=${encodeURIComponent(q)}&direction=PROCESSING_TO_STORE`).then((r) => r.json())
      if (j?.success) orderId = j.data.orderId
    } catch { /* fall through */ }
    if (!orderId) { toast.error(`No returning order matches "${q}"`); setCode(""); return }
    await receiveOrder(orderId)
  }

  return (
    <QueueShell status="RETURN_IN_TRANSIT" title="Store Receive" subtitle="Confirm processed orders returned from the Processing Center"
      icon={PackageCheck} selected={selected} onSelect={setSelected} queue={queue}>
      {/* Scan-to-receive: the configured return identifier → the returned order. */}
      <Card className="rounded-xl border-blue-200 bg-blue-50/40 shadow-sm">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-3 max-w-2xl">
            <div className="relative flex-1"><QrCode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500" /><Input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && resolveAndReceive()} placeholder={transportScanPlaceholder(returnMode)} className="pl-10 h-11 bg-white border-blue-200 font-mono" /></div>
            <BagScanButton label="Camera" onScan={(c) => resolveAndReceive(c)} disabled={busy} closeOnScan className="h-11" />
            <Button onClick={() => resolveAndReceive()} disabled={busy || !code.trim()} className="h-11 gap-2 bg-blue-600 hover:bg-blue-700 text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Receive</Button>
          </div>
          <p className="text-[11px] text-slate-400">
            {returnMode === "BAG"
              ? "Scan the bag the order returned in. Or pick an order below to confirm manually."
              : returnMode === "PACKET"
                ? "Scan the packet QR (same one it was sent with). Or pick an order below to confirm manually."
                : "Scan the packet QR (same one it was sent with) or any bag it returned in. Or pick an order below to confirm manually."}
          </p>
        </CardContent>
      </Card>
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
  const [deliverySlots, setDeliverySlots] = useState<string[]>(generateSlots(DEFAULT_DELIVERY_SLOT))
  const [deliveryFullSlots, setDeliveryFullSlots] = useState<string[]>([])
  // Customer verification (Workflow Settings): the configured method for this
  // order + the OTP the customer provides. Delivery cannot complete without it.
  const [verifyMethod, setVerifyMethod] = useState<"OTP" | "NAME">("OTP")
  const [otp, setOtp] = useState("")
  const [regenBusy, setRegenBusy] = useState(false)

  // Config-driven delivery slots (Settings → Time Slots) — same source everywhere.
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/slot-config?businessId=${encodeURIComponent(currentBusinessId)}`).then((r) => r.json())
      .then((j) => { if (j.success && j.data.deliverySlots?.length) setDeliverySlots(j.data.deliverySlots) })
      .catch(() => { /* keep fallback */ })
  }, [currentBusinessId])

  // Delivery slot capacity — grey out + disable slots that have reached their
  // per-date maximum (counts Standard + Alternate deliveries still in play).
  useEffect(() => {
    if (!currentBusinessId || !delForm.date) return
    fetch(`/api/laundry/slot-config?businessId=${encodeURIComponent(currentBusinessId)}&deliveryDate=${encodeURIComponent(delForm.date)}`).then((r) => r.json())
      .then((j) => { if (j.success) setDeliveryFullSlots(j.data.deliveryFullSlots || []) })
      .catch(() => setDeliveryFullSlots([]))
  }, [currentBusinessId, delForm.date])

  const openOrder = async (o: OrderRow | null) => {
    setSelected(o); setRecipient(o?.customer?.name || ""); setNote(""); setReference(""); setSchedulingDel(false)
    setOtp(""); setVerifyMethod(o?.deliveryVerificationMethod === "NAME" ? "NAME" : "OTP")
    // INHERIT THE CUSTOMER'S PROMISE. It was captured at booking and frozen; the
    // operator re-picking it from scratch is both wasted work and a chance to
    // silently change what the customer was told. A business reschedule
    // (deliveryDate) wins over the promise, because that is the newer decision;
    // today is only the last resort when neither exists.
    const promisedDate = o?.deliveryDate || o?.promisedDeliveryDate || null
    const promisedSlot = o?.deliveryTimeSlot || o?.promisedDeliveryTimeSlot || ""
    setDelForm({
      address: "",
      date: promisedDate ? String(promisedDate).split("T")[0] : new Date().toISOString().split("T")[0],
      timeSlot: promisedSlot,
      assignNow: false,
      executiveId: "",
    })
    setDelAddresses([])
    if (o && currentBusinessId) {
      // Only the executives who serve THIS order's store (plus All-Stores
      // executives) — the business-wide list is unusable once a chain has more
      // than a handful of stores.
      const execQs = new URLSearchParams({ businessId: currentBusinessId, assignable: "1" })
      if (o.storeId) execQs.set("storeId", o.storeId)
      const j = await fetch(`/api/laundry/delivery-executives?${execQs.toString()}`).then((r) => r.json()).catch(() => null)
      setExecs(j?.success ? j.data : [])
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
        body: JSON.stringify({ businessId: currentBusinessId, actorId: user?.id, actorName: user?.name, recipientName: recipient || undefined, note: note || undefined, method: verifyMethod, otp: verifyMethod === "OTP" ? otp : undefined }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Delivery failed")
      toast.success(`${j.data.orderNumber} delivered (${j.data.deliveryType}) 🎉`)
      setSelected(null); queue.load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delivery failed") } finally { setBusy(false) }
  }

  // Business Admin recovery: regenerate the Delivery OTP (customer pinged in-app
  // with the new code). Only valid for OTP-verification orders.
  const regenerateOtp = async () => {
    if (!selected || !currentBusinessId) return
    setRegenBusy(true)
    try {
      const j = await fetch(`/api/laundry/orders/${selected.id}/otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, kind: "delivery", actorName: user?.name }),
      }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Could not regenerate")
      setSelected({ ...selected, deliveryOtp: j.data.otp })
      toast.success(`New delivery OTP: ${j.data.otp} — the customer has been notified`)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not regenerate") } finally { setRegenBusy(false) }
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
                    <div className="space-y-1"><label className="text-[10px] text-slate-500">Time Slot</label>
                      <select value={delForm.timeSlot} onChange={(e) => setDelForm((f) => ({ ...f, timeSlot: e.target.value }))} className="w-full h-7 text-xs rounded border border-slate-200 px-2 bg-white">
                        <option value="">Select slot…</option>
                        {/* The promised slot may not be in the generated list —
                            slot config can change after booking. Show it anyway,
                            or the inherited value would silently blank and the
                            operator would be back to re-picking it. */}
                        {delForm.timeSlot && !deliverySlots.includes(delForm.timeSlot) && (
                          <option value={delForm.timeSlot}>{delForm.timeSlot} — customer&apos;s promised slot</option>
                        )}
                        {deliverySlots.map((s) => {
                          const past = slotIsPast(s, delForm.date)
                          const full = deliveryFullSlots.includes(s)
                          const disabled = past || full
                          return <option key={s} value={s} disabled={disabled} className={full ? "bg-gray-100 text-gray-400" : ""}>{s}{past ? " (passed)" : full ? " — FULL" : ""}</option>
                        })}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer"><input type="checkbox" checked={delForm.assignNow} onChange={(e) => setDelForm((f) => ({ ...f, assignNow: e.target.checked }))} /> Assign Now</label>
                    {delForm.assignNow && (execs.length === 0 ? (
                      <p className="flex-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">{NO_EXECUTIVES_FOR_STORE}</p>
                    ) : (
                      <select value={delForm.executiveId} onChange={(e) => setDelForm((f) => ({ ...f, executiveId: e.target.value }))} className="h-7 text-[10px] rounded border border-slate-200 px-1 bg-white flex-1">
                        <option value="">Select executive</option>
                        {execs.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                      </select>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {/* Assigning is blocked while this store has nobody to assign to. */}
                    <Button size="sm" className="h-7 text-[10px] gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1" disabled={scheduleBusy || (delForm.assignNow && execs.length === 0)} onClick={async () => {
                      if (!selected || !currentBusinessId) return
                      setScheduleBusy(true)
                      try {
                        const res = await fetch("/api/laundry/dispatch/delivery", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            businessId: currentBusinessId, orderId: selected.id,
                            executiveId: delForm.assignNow && delForm.executiveId ? delForm.executiveId : null,
                            deliveryDate: delForm.date || null,
                            deliveryTimeSlot: delForm.timeSlot || null,
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

          {/* Customer verification — mandatory before handover/delivery. The
              method comes from Workflow Settings (snapshot on the order). */}
          <div className={`rounded-lg border p-3 space-y-3 ${verifyMethod === "OTP" ? "border-amber-200 bg-amber-50/60" : "border-blue-200 bg-blue-50/60"}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><ClipboardCheck className="h-4 w-4 text-slate-500" /> Verify Customer Before {pickupType ? "Handover" : "Delivery"}</p>
              <Badge variant="outline" className="text-[10px]">{verifyMethod === "OTP" ? "OTP" : "Customer Name"}</Badge>
            </div>
            {verifyMethod === "OTP" ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2">
                    <p className="text-[10px] uppercase text-slate-400">Delivery OTP (ask the customer)</p>
                    <p className="font-mono text-lg font-bold tracking-[0.25em] text-slate-800">{selected.deliveryOtp || "—"}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-9 gap-1" onClick={regenerateOtp} disabled={regenBusy || busy}>
                    {regenBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Regenerate
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer-provided OTP</Label>
                  <Input className="h-9 font-mono tracking-widest" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Enter the OTP the customer shares" inputMode="numeric" />
                </div>
                {!selected.deliveryOtp && <p className="text-[11px] text-amber-600">No OTP yet — regenerate one to hand to the customer, or the customer can read it in their app.</p>}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Confirm the identity of <b className="text-slate-800">{selected.customer?.name || "the customer"}</b> in person before completing.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Received By (recipient)</Label><Input className="h-9" value={recipient} onChange={(e) => setRecipient(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Delivery Note (optional)</Label><Input className="h-9" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <Button onClick={deliver} disabled={busy || !covered || (verifyMethod === "OTP" && !otp.trim())} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white w-full disabled:bg-slate-300">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {pickupType ? "Hand Over to Customer" : "Complete Delivery"}
          </Button>
        </CardContent></Card>
      )}
    </QueueShell>
  )
}
