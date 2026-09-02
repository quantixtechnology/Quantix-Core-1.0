"use client"

// Store Audit (Stage 2) — the official verification + billing stage. Reads the
// garments the order already carries (recorded at booking as quantities) and
// captures condition / defects / photos / remarks AND, for PER_KG garments, the
// MEASURED WEIGHT (never entered at booking). Entering weight reprices the KG
// lines and generates the invoice; then Approve → Payment via the workflow
// engine. PER_PIECE orders were billed at booking and are unaffected.

import { useState, useEffect, useCallback, useMemo } from "react"
import { unavailableOrderLines, garmentAvailableForService, unavailableNotice, type PricedServices } from "@/lib/laundry-garment-availability"
import { intakeServiceChoice, intakeRowsToItems, DEFAULT_ROW_QUANTITY } from "@/lib/laundry-intake-service"
import { scheduleCell, bookedServiceNames, URGENCY_STYLE, urgencyNote } from "@/lib/laundry-schedule-display"
import { orderWeightLabel } from "@/lib/laundry-order-display"
import { useAuthStore } from "@/stores/auth-store"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Search, Loader2, ClipboardCheck, ArrowLeft, ArrowRight, User, Store as StoreIcon, Clock,
  Shirt, Camera, X, Check, PauseCircle, Save, ImageIcon,
  Pencil, Trash2, History,
} from "lucide-react"
import { BagScanButton } from "@/components/laundry/bag-scanner"
import { LaundryWorkflowTimeline } from "./laundry-workflow-timeline"
import { statusLabel } from "@/lib/laundry-workflow"
import { useOrderBags } from "@/components/laundry/order-bag-list"
import { ServiceBagAccountingPanel } from "@/components/laundry/service-bag-accounting"
import { LaundryGarmentSelect, useGarmentMaster } from "@/components/laundry/garment-select"

const DEFECTS = [
  { code: "MISSING_BUTTON", label: "Missing Button" },
  { code: "STAIN", label: "Stain" },
  { code: "TEAR", label: "Tear" },
  { code: "ZIP_BROKEN", label: "Zip Broken" },
  { code: "COLOR_FADE", label: "Color Fade" },
]

interface OrderRow {
  id: string; orderNumber: string; status: string; grandTotal: number; createdAt: string; customerId: string | null
  // All already returned by GET /api/laundry/orders — the list spreads every
  // LaundryOrder scalar, includes the booked `services` rows, and attaches the
  // customer from ONE batched lookup. Nothing here costs an extra query.
  customer?: { name: string; phone: string | null; customerCode: string | null } | null
  services?: { serviceId: string | null; serviceName: string }[]
  // Also already returned by the list — totalWeightKg is a LaundryOrder scalar.
  // Optional here because a row that has not reached Store Audit has no weight
  // yet; OrderDetail narrows it to a number.
  totalWeightKg?: number | null
  pickupDate?: string | null; pickupTimeSlot?: string | null
  deliveryDate?: string | null; deliveryTimeSlot?: string | null
}
interface Item {
  id: string; garmentName: string; serviceName: string; quantity: number; weightKg: number
  pricingType: string; unitPrice: number; total?: number
  // Already returned by the detail API (LaundryOrderItem columns) — declared
  // here so a correction can pre-select the current garment and service.
  garmentId: string | null; serviceId: string | null
  condition: string | null; defects: string | null; inspectionNotes: string | null
}
interface OrderEvent { id: string; action: string; note: string | null; actorName: string | null; createdAt: string }
interface SvcOption { id: string; name: string; subscriptionEligible?: boolean }
interface BookedService { serviceId: string | null; serviceName: string }
interface OrderDetail extends OrderRow {
  items: Item[]
  /** The order's OWN booked services (LaundryOrderService) — what intake is
   *  locked to. Returned by GET /api/laundry/orders/[id]; a Pickup-First order
   *  carries its service here even though it carries no garments yet. */
  services?: BookedService[]
  totalWeightKg: number
  store?: { storeName: string; storeCode: string } | null
  customer?: { name: string; phone: string | null; customerCode: string | null } | null
  auditNotes: string | null; auditPhotos: string | null
  events?: OrderEvent[]
}
interface Inspection { condition: string; defects: string[]; notes: string }

const inr = (n: number) => `₹${(n || 0).toFixed(2)}`
/** Plain-language names for the timeline actions this screen surfaces. */
const EVENT_LABEL: Record<string, string> = {
  AUDIT_ITEM_CHANGED: "Garment changed",
  AUDIT_ITEM_REMOVED: "Garment removed",
  REOPEN_AUDIT: "Returned to Audit",
  COMPLETE_AUDIT: "Audit approved",
  START_AUDIT: "Audit started",
  RECEIVE: "Order received",
}

const fmt = (s: string) => new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

/**
 * Subscription status for one garment×service pair.
 *
 * Stated on every row, before approval, because discovering after payment that
 * a blanket was never covered is the failure this is meant to prevent.
 */
function EligibilityLine({ eligible, alternatives, rate }: { eligible: boolean; alternatives: string[]; rate?: string | null }) {
  if (eligible) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">✓ Subscription covered</span>
  }
  return (
    <span className="text-[11px] text-slate-500">
      {/* The rate is shown beside the refusal so the auditor sees the financial
          consequence of this line, not just its status. */}
      <span className="font-medium text-slate-600">✕ Not covered by subscription</span>
      {rate ? <span className="text-slate-500"> · {rate} — normal billing</span> : <span className="text-slate-400"> · Normal pricing applies</span>}
      {alternatives.length > 0 && <span className="block text-slate-400">Subscription eligible for {alternatives.join(", ")}.</span>}
    </span>
  )
}

export function LaundryStoreAudit() {
  const { currentBusinessId, user } = useAuthStore()
  const { toast } = useToast()

  const [rows, setRows] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [inspect, setInspect] = useState<Record<string, Inspection>>({})
  const [totalWeight, setTotalWeight] = useState("") // the SINGLE total order weight (KG) — captured here, never at booking
  const [auditNotes, setAuditNotes] = useState("")
  const [photos, setPhotos] = useState<string[]>([])
  // Bag accounting for the order under audit — read from the SAME endpoint the
  // other stages use, so Audit verifies reality against each service's booked
  // requirement instead of counting bags itself.
  const { accounting: bagAccounting } = useOrderBags(selectedId, currentBusinessId)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(false)

  // ── Audit corrections ───────────────────────────────────────────────────
  // Deliberately in LaundryStoreAudit, the component that owns detail.items.
  // The intake component below has its own separate row state; mixing the two
  // is what broke the previous attempt.
  const { garments } = useGarmentMaster(currentBusinessId)
  const [services, setServices] = useState<SvcOption[]>([])
  const [editRow, setEditRow] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ garmentId: "", serviceId: "", quantity: "1", weightKg: "" })
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/services?businessId=${encodeURIComponent(currentBusinessId)}`)
      .then((r) => r.json())
      .then((j) => setServices(j.success ? (j.data || []) : []))
      .catch(() => {})
  }, [currentBusinessId])

  // Eligibility is decided per garment × SERVICE pair, so it cannot be worked
  // out from a garment flag and a service flag. This reads the coverage engine's
  // own answer, so the screen cannot promise cover the engine will not grant.
  const [coverage, setCoverage] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/subscription-coverage?businessId=${encodeURIComponent(currentBusinessId)}`)
      .then((r) => r.json())
      .then((j) => setCoverage(new Set(((j.data || []) as { serviceId: string; garmentId: string | null }[]).map((p) => `${p.serviceId}|${p.garmentId}`))))
      .catch(() => {})
  }, [currentBusinessId])

  // PRICING AVAILABILITY — a different question from subscription cover above.
  // Same source as the server guard: active Pricing Matrix rules. Null until it
  // loads, so nothing is claimed on a guess.
  const [priced, setPriced] = useState<PricedServices | null>(null)
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/garment-services?businessId=${encodeURIComponent(currentBusinessId)}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setPriced(j.data || {}) })
      .catch(() => {})
  }, [currentBusinessId])

  const isEligible = useCallback((garmentId: string | null, serviceId: string | null) => {
    if (!garmentId || !serviceId) return false
    return coverage.has(`${serviceId}|${garmentId}`)
  }, [coverage])

  /** Which OTHER services would cover this garment — useful when one will not. */
  const eligibleElsewhere = useCallback((garmentId: string | null, serviceId: string | null) => {
    if (!garmentId) return []
    return services
      .filter((sv) => sv.id !== serviceId && coverage.has(`${sv.id}|${garmentId}`))
      .map((sv) => sv.name)
  }, [coverage, services])

  const loadQueue = useCallback(async (silent = false) => {
    if (!currentBusinessId) return
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/laundry/orders?businessId=${encodeURIComponent(currentBusinessId)}&status=PENDING_STORE_AUDIT&limit=100`)
      const json = await res.json()
      setRows(json.success ? json.data : [])
    } catch { setRows([]) } finally { if (!silent) setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { loadQueue() }, [loadQueue])
  // Live audit queue: refresh on focus + a light poll so an order just received
  // at the store appears here without a manual refresh. Paused while inspecting an
  // order (a detail is open) to avoid churn under the auditor.
  useAutoRefresh(() => loadQueue(true), { intervalMs: 12000, enabled: !selectedId })

  const openOrder = useCallback(async (id: string) => {
    setSelectedId(id); setLoadingDetail(true); setDetail(null); setIntakeOpen(false)
    try {
      const json = await fetch(`/api/laundry/orders/${id}`).then((r) => r.json())
      if (json.success) {
        const d = json.data as OrderDetail
        setDetail(d)
        const init: Record<string, Inspection> = {}
        d.items.forEach((it) => { init[it.id] = { condition: it.condition || "GOOD", defects: it.defects ? it.defects.split(",") : [], notes: it.inspectionNotes || "" } })
        setInspect(init)
        setTotalWeight(d.totalWeightKg > 0 ? String(d.totalWeightKg) : "")
        setAuditNotes(d.auditNotes || "")
        setPhotos(d.auditPhotos ? JSON.parse(d.auditPhotos) : [])
      }
    } catch { /* noop */ } finally { setLoadingDetail(false) }
  }, [])

  const backToQueue = () => { setSelectedId(null); setDetail(null) }

  const beginEdit = (it: Item) => {
    setEditRow(it.id)
    setEditForm({ garmentId: it.garmentId || "", serviceId: it.serviceId || "", quantity: String(it.quantity), weightKg: it.weightKg ? String(it.weightKg) : "" })
  }

  /**
   * Save a correction. The server re-prices through the existing resolver and
   * rewrites the order snapshot, so the screen RELOADS from it rather than
   * computing money in the browser — the totals shown are the stored ones.
   */
  const saveItem = async (itemId: string) => {
    if (!selectedId) return
    setRowBusy(itemId)
    try {
      const res = await fetch(`/api/laundry/orders/${selectedId}/items/${itemId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: currentBusinessId,
          garmentId: editForm.garmentId || undefined,
          serviceId: editForm.serviceId || undefined,
          quantity: Number(editForm.quantity) || 1,
          weightKg: Number(editForm.weightKg) || 0,
        }),
      })
      const j = await res.json()
      // An NA combination comes back with the real reason from the resolver.
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not update this garment")
      toast({ title: "Garment updated" })
      setEditRow(null)
      await openOrder(selectedId)
      loadQueue(true)
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    } finally { setRowBusy(null) }
  }

  const removeItem = async (itemId: string, garmentName: string) => {
    if (!selectedId) return
    if (!window.confirm(`Remove ${garmentName} from this order?`)) return
    setRowBusy(itemId)
    try {
      const res = await fetch(`/api/laundry/orders/${selectedId}/items/${itemId}?businessId=${encodeURIComponent(currentBusinessId || "")}`, { method: "DELETE" })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not remove this garment")
      toast({ title: `${garmentName} removed` })
      await openOrder(selectedId)
      loadQueue(true)
    } catch (e) {
      toast({ title: "Could not remove", description: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    } finally { setRowBusy(null) }
  }

  // Scan a bag QR/code → open that order's audit directly (no search). Resolves
  // a REUSABLE bag first (its currentOrderId), then falls back to a legacy
  // temporary Pickup Bag for backward compatibility.
  const scanToAudit = useCallback(async (code: string) => {
    const c = code.trim()
    if (!c || !currentBusinessId) return
    try {
      const rb = await fetch(`/api/laundry/bags?businessId=${encodeURIComponent(currentBusinessId)}&search=${encodeURIComponent(c)}`).then((r) => r.json())
      const bag = (rb.data || []).find((b: { bagNumber: string; currentOrderId: string | null }) => b.bagNumber.toUpperCase() === c.toUpperCase()) || (rb.data || [])[0]
      if (bag?.currentOrderId) { openOrder(bag.currentOrderId); return }
      const j = await fetch(`/api/laundry/pickup-bags?businessId=${encodeURIComponent(currentBusinessId)}&search=${encodeURIComponent(c)}`).then((r) => r.json())
      const legacy = (j.data || []).find((b: { code: string; orderId: string }) => b.code.toUpperCase() === c.toUpperCase()) || (j.data || [])[0]
      if (legacy?.orderId) { openOrder(legacy.orderId); return }
      toast({ title: "Not found", description: `No bag for "${c}".`, variant: "destructive" })
    } catch { toast({ title: "Scan failed", variant: "destructive" }) }
  }, [currentBusinessId, openOrder, toast])

  const toggleDefect = (itemId: string, code: string) => setInspect((p) => {
    const cur = p[itemId] || { condition: "GOOD", defects: [], notes: "" }
    const has = cur.defects.includes(code)
    const defects = has ? cur.defects.filter((d) => d !== code) : [...cur.defects, code]
    return { ...p, [itemId]: { ...cur, defects, condition: defects.length ? "DAMAGED" : "GOOD" } }
  })
  const setNotes = (itemId: string, notes: string) => setInspect((p) => ({ ...p, [itemId]: { ...(p[itemId] || { condition: "GOOD", defects: [] }), notes } }))

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !currentBusinessId) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append("file", file); fd.append("businessId", currentBusinessId); fd.append("type", "document"); fd.append("category", "audit")
        const res = await fetch("/api/uploads", { method: "POST", body: fd })
        const json = await res.json()
        const url = json?.data?.url || json?.data?.uploadPath || json?.url
        if (json.success && url) setPhotos((p) => [...p, url])
        else toast({ title: "Upload failed", description: json.error || "Try again", variant: "destructive" })
      }
    } catch { toast({ title: "Upload failed", variant: "destructive" }) } finally { setUploading(false) }
  }

  // Single source of truth for weight: if per-garment weights were captured at
  // intake, they already priced the KG lines — the audit must NOT re-enter or
  // re-price by a separate "total weight" (doing so would overwrite/zero it).
  const hasPerGarmentWeight = !!detail?.items.some((it) => it.pricingType === "PER_KG" && (it.weightKg || 0) > 0)

  const saveInspection = useCallback(async () => {
    if (!detail) return false
    const perGarment = detail.items.some((it) => it.pricingType === "PER_KG" && (it.weightKg || 0) > 0)
    const body = {
      businessId: currentBusinessId, auditNotes, auditPhotos: photos, auditedBy: user?.name || "auditor",
      // Only send a total weight in BAG-weight mode (no per-garment weights) —
      // that's the case the inspect endpoint reprices. Per-garment orders are
      // already priced at intake; sending it would reprice by the bag model.
      ...(totalWeight !== "" && !perGarment ? { totalWeightKg: Number(totalWeight) } : {}),
      items: detail.items.map((it) => ({ itemId: it.id, condition: inspect[it.id]?.condition || "GOOD", defects: inspect[it.id]?.defects || [], notes: inspect[it.id]?.notes || "" })),
    }
    const res = await fetch(`/api/laundry/orders/${detail.id}/inspect`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const json = await res.json()
    return res.ok && json.success !== false
  }, [detail, currentBusinessId, auditNotes, photos, inspect, totalWeight, user])

  // A KG order must have its weight before the invoice — but per-garment weights
  // (captured at intake) already satisfy this, so only BAG-weight orders prompt.
  const hasKgItems = !!detail?.items.some((it) => it.pricingType === "PER_KG")
  const totalWeightKg = totalWeight === "" ? 0 : Math.max(0, Number(totalWeight) || 0)
  const kgRate = detail?.items.find((it) => it.pricingType === "PER_KG" && it.unitPrice > 0)?.unitPrice ?? 0
  // The order's authoritative total: the sum of per-garment weights when intake
  // captured them, otherwise the one figure weighed here.
  const orderWeightKg = hasPerGarmentWeight ? (detail?.totalWeightKg ?? 0) : totalWeightKg
  // EVERY audited order needs a total weight before Payment — per-KG because it
  // is the price, per-piece because the physical load is still recorded. The
  // server enforces the same rule; this only keeps the operator from hitting it.
  const needsWeight = orderWeightKg <= 0
  // An order with no garments can never be approved — checkAuditComplete refuses
  // it ("No garments have been identified for this order"). This is exactly the
  // state a Pickup-First order sits in until intake is done, so the button says
  // what is missing rather than spending a click on a guaranteed refusal.
  const needsGarments = !!detail && detail.items.length === 0

  const handleSave = async () => { setSaving(true); const ok = await saveInspection(); setSaving(false); toast(ok ? { title: "Inspection saved" } : { title: "Save failed", variant: "destructive" }) }

  const transition = async (toStatus: string, label: string) => {
    if (!detail) return
    // Every order needs its total weight before the invoice is generated — the
    // server refuses without it, so say so here rather than let the click fail.
    if (toStatus === "PAYMENT_PENDING" && needsWeight) {
      toast({ title: "Weight required", description: "Enter the total garment weight before approving this order.", variant: "destructive" })
      return
    }
    setActing(true)
    try {
      // Saving the inspection is what stamps every garment as inspected AND
      // writes the invoice figures for KG orders. If it fails, the transition
      // that follows is guaranteed to be refused by the audit gate — so stop
      // here rather than leaving "invoice attempted, order stuck" behind.
      const saved = await saveInspection()
      if (!saved) {
        toast({ title: "Could not save the inspection", description: "The audit was not saved, so the order was not approved. Please try again.", variant: "destructive" })
        return
      }
      const res = await fetch(`/api/laundry/orders/${detail.id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toStatus, actorName: user?.name || "auditor", note: auditNotes || null }) })
      const json = await res.json()
      if (!res.ok || json.success === false) {
        // The audit gate answers with `message`/`expected`/`audited`; an invalid
        // transition answers with `error`. Reading only `error` turned a precise
        // refusal into a bare "Transition failed" and left the operator with a
        // 409 and no idea which garment was missing.
        const reason = json.error || json.message || "Transition failed"
        const counts = typeof json.expected === "number" && typeof json.audited === "number"
          ? ` (${json.audited} of ${json.expected} garments inspected)`
          : ""
        // The order can move underneath this screen (another station, another
        // device). Naming where it actually is turns a bare 409 into something
        // the operator can act on, and reloading shows them the truth.
        const where = typeof json.currentStatus === "string" && json.currentStatus !== detail.status
          ? ` The order is now at ${statusLabel(json.currentStatus)}.`
          : ""
        toast({ title: "Cannot approve this order", description: `${reason}${counts}${where}`, variant: "destructive" })
        if (where) { backToQueue(); loadQueue() }
        return
      }
      // Reusable bags carry the SAME permanent QR through processing → delivery,
      // so no Processing Package QR is generated. Advance this order's bags to
      // PROCESSING (best-effort, non-blocking).
      if (toStatus === "PAYMENT_PENDING") {
        fetch(`/api/laundry/bags/order/${detail.id}/advance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, toStatus: "PROCESSING" }) }).catch(() => {})
      }
      toast({ title: label, description: `${detail.orderNumber} → ${toStatus === "PAYMENT_PENDING" ? "Payment" : toStatus}` })
      backToQueue(); loadQueue()
    } catch { toast({ title: "Error", variant: "destructive" }) } finally { setActing(false) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? rows.filter((r) => r.orderNumber.toLowerCase().includes(q)) : rows
  }, [rows, search])

  const totalPieces = detail?.items.reduce((s, it) => s + (it.quantity || 0), 0) || 0
  // The lines the Pricing Matrix cannot price — the reason the server will
  // refuse to move this order on.
  const blockedLines = useMemo(() => unavailableOrderLines(detail?.items, priced), [detail, priced])

  // ── Detail view ──
  if (selectedId) {
    return (
      // Widened one step (5xl → 7xl) so the inspection grid breathes, but
      // still capped: this view is a FORM, and a full-width form on a wide
      // monitor is harder to read, not easier. The queue is the screen that
      // wanted the whole viewport.
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-5 space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={backToQueue}><ArrowLeft className="h-5 w-5" /></Button>
          <div><h1 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-blue-600" /> Store Audit</h1><p className="text-sm text-muted-foreground">Inspect garments and approve the order</p></div>
        </div>

        {loadingDetail || !detail ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div><p className="text-[11px] text-muted-foreground">Order</p><p className="font-semibold font-mono text-sm">{detail.orderNumber}</p></div>
                    <div className="flex items-center gap-1.5"><User className="h-4 w-4 text-muted-foreground" /><div><p className="text-[11px] text-muted-foreground">Customer</p><p className="text-sm font-medium">{detail.customer?.name || "—"}</p></div></div>
                    <div className="flex items-center gap-1.5"><StoreIcon className="h-4 w-4 text-muted-foreground" /><div><p className="text-[11px] text-muted-foreground">Store</p><p className="text-sm font-medium">{detail.store?.storeName || "—"}</p></div></div>
                    <div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-muted-foreground" /><div><p className="text-[11px] text-muted-foreground">Created</p><p className="text-sm font-medium">{fmt(detail.createdAt)}</p></div></div>
                  </div>
                  {/* The real stage, never a hardcoded label — an order that has
                      moved on must not still read "Pending Store Audit" here. */}
                  <Badge variant="outline" className={detail.status === "PENDING_STORE_AUDIT" || detail.status === "UNDER_AUDIT" ? "border-orange-300 text-orange-700 bg-orange-50" : "border-slate-300 text-slate-600 bg-slate-50"}>{statusLabel(detail.status)}</Badge>
                </div>
                <div className="border-t pt-3"><LaundryWorkflowTimeline status={detail.status} /></div>
              </CardContent>
            </Card>

            {/* Service-level bag accounting — required vs received, per service
                order. Never a bare "4 bags": two Wash & Fold bags must never
                make Dry Clean look accounted for. */}
            {bagAccounting && <ServiceBagAccountingPanel accounting={bagAccounting} />}

            {/* Weight. Required on EVERY audited order before Payment — the price
                is a separate concern: a per-piece order records the load without
                its amount changing. Per-garment weights (from intake) are the
                single source
                of truth → total is auto-calculated + read-only. Bag-weight orders
                enter ONE total weight here. Never both. */}
            <Card className="border-blue-200">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2 text-blue-700"><ClipboardCheck className="h-4 w-4" /> {hasPerGarmentWeight ? "Order Weight (KG)" : "Total Order Weight (KG)"}</CardTitle></CardHeader>
                <CardContent>
                  {hasPerGarmentWeight ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="h-10 px-3 inline-flex items-center rounded-md border border-blue-200 bg-blue-50/60 text-lg font-semibold tabular-nums text-slate-800">{detail.totalWeightKg.toFixed(2)} KG</span>
                      <span className="text-sm text-muted-foreground">auto-calculated from garment weights</span>
                      <span className="ml-auto text-right">
                        <span className="block text-[11px] text-muted-foreground">KG Amount</span>
                        <span className="text-xl font-bold text-slate-800 tabular-nums">{inr(detail.items.filter((it) => it.pricingType === "PER_KG").reduce((s, it) => s + (it.unitPrice * (it.weightKg || 0)), 0))}</span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <Input type="number" min="0" step="0.05" value={totalWeight} onChange={(e) => setTotalWeight(e.target.value)} placeholder="0.00"
                        className={`h-10 w-32 text-lg font-semibold tabular-nums ${needsWeight ? "border-rose-300 bg-rose-50" : "border-blue-200"}`} />
                      <span className="text-sm text-muted-foreground">KG {kgRate > 0 && <>× {inr(kgRate)}/KG</>}</span>
                      <span className="ml-auto text-right">
                        <span className="block text-[11px] text-muted-foreground">KG Amount</span>
                        <span className="text-xl font-bold text-slate-800 tabular-nums">{hasKgItems ? (totalWeightKg > 0 && kgRate > 0 ? inr(totalWeightKg * kgRate) : <span className="text-sm text-rose-500">Enter total weight</span>) : <span className="text-sm text-slate-400">Recorded for tracking — price unchanged</span>}</span>
                      </span>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">{hasPerGarmentWeight
                    ? "Per-garment weights were captured at intake — the total is the sum, no re-entry needed."
                    : hasKgItems
                      ? "Weigh the whole KG load once. The invoice is generated from this weight × rate."
                      : "Weigh the load once. Required before the invoice; it does not change a per-piece price."}</p>
                </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center justify-between"><span className="flex items-center gap-2"><Shirt className="h-4 w-4" /> Garments</span><span className="text-xs font-normal text-muted-foreground">{totalPieces} pc{totalPieces === 1 ? "" : "s"} · {detail.items.length} type{detail.items.length === 1 ? "" : "s"}</span></CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {/* WHY THIS ORDER WILL NOT MOVE ON. The server refuses a
                    garment its service cannot price; without this the refusal
                    arrived with no reason and read as a broken system. Every
                    offending line is listed, and the fix is the Edit control
                    already on each line — no new action, no new workflow. */}
                {blockedLines.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 mb-3">
                    <p className="text-sm font-semibold text-amber-900">⚠️ This order cannot be processed yet</p>
                    <ul className="mt-1.5 space-y-0.5">
                      {blockedLines.map((l) => (
                        <li key={`${l.garmentName}|${l.serviceName}`} className="text-[13px] text-amber-900">{l.message}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[12px] text-amber-800">
                      Use <span className="font-semibold">Edit</span> on the line{blockedLines.length === 1 ? "" : "s"} above to choose a service that covers the garment, or remove the line. Nothing is changed automatically.
                    </p>
                  </div>
                )}
                {detail.items.length === 0 ? (
                  intakeOpen ? (
                    <IntakeAudit orderId={detail.id} businessId={currentBusinessId} booked={[...(detail.services || []), ...detail.items]} configured={services} priced={priced} onSaved={() => { setIntakeOpen(false); openOrder(detail.id) }} onCancel={() => setIntakeOpen(false)} />
                  ) : (
                    <div className="py-6 text-center space-y-3">
                      <p className="text-sm text-muted-foreground">Pickup-First order — garments were not counted at booking. Count them here at intake.</p>
                      <Button onClick={() => setIntakeOpen(true)} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"><Shirt className="h-4 w-4" /> Start Intake Audit</Button>
                    </div>
                  )
                ) : detail.items.map((it) => {
                  const ins = inspect[it.id] || { condition: "GOOD", defects: [], notes: "" }
                  const damaged = ins.defects.length > 0
                  const isKg = it.pricingType === "PER_KG"
                  return (
                    <div key={it.id} className={`rounded-lg border p-3 ${damaged ? "border-amber-300 bg-amber-50/40" : ""}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2"><span className="flex h-9 min-w-9 px-1.5 items-center justify-center rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold">×{it.quantity}</span><div><p className="font-medium text-sm">{it.garmentName}</p><p className="text-[11px] text-muted-foreground">{it.serviceName}{isKg ? ` · Per KG` : ""}</p></div></div>
                        <Badge variant="outline" className={damaged ? "border-amber-300 text-amber-700 bg-amber-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>{damaged ? "Damaged" : "Good"}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {DEFECTS.map((d) => (
                          <button key={d.code} onClick={() => toggleDefect(it.id, d.code)} className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${ins.defects.includes(d.code) ? "border-amber-400 bg-amber-100 text-amber-800 font-medium" : "text-muted-foreground hover:bg-muted/50"}`}>{d.label}</button>
                        ))}
                      </div>
                      <Input value={ins.notes} onChange={(e) => setNotes(it.id, e.target.value)} placeholder="Remarks for this garment (optional)" className="h-8 text-sm" />

                      {/* CORRECTION CONTROLS. Store Audit records what was
                          actually received, so a line must be fixable. Pricing
                          and NA refusal are decided server-side; this only
                          collects the change. */}
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        {editRow === it.id ? (
                          <div className="space-y-2">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div>
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Garment</span>
                                <LaundryGarmentSelect value={editForm.garmentId} onChange={(v) => setEditForm((f) => ({ ...f, garmentId: v }))} garments={garments} />
                              </div>
                              <div>
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Service</span>
                                <select value={editForm.serviceId} onChange={(e) => setEditForm((f) => ({ ...f, serviceId: e.target.value }))} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                                  <option value="">Select service…</option>
                                  {services.map((sv) => <option key={sv.id} value={sv.id}>{sv.name}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="w-24">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Qty</span>
                                <Input type="number" min={1} value={editForm.quantity} onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))} className="h-9 text-sm" />
                              </div>
                              <div className="w-28">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Weight (kg)</span>
                                <Input type="number" min={0} step="0.05" value={editForm.weightKg} onChange={(e) => setEditForm((f) => ({ ...f, weightKg: e.target.value }))} className="h-9 text-sm" />
                              </div>
                              <div className="ml-auto flex gap-2">
                                <Button size="sm" variant="outline" className="h-9" onClick={() => setEditRow(null)}>Cancel</Button>
                                <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700 text-white" disabled={rowBusy === it.id} onClick={() => saveItem(it.id)}>
                                  {rowBusy === it.id ? "Saving…" : "Save"}
                                </Button>
                              </div>
                            </div>
                            {/* Eligibility for the PENDING selection, so the
                                auditor sees the consequence before saving. */}
                            <EligibilityLine eligible={isEligible(editForm.garmentId, editForm.serviceId)} alternatives={eligibleElsewhere(editForm.garmentId, editForm.serviceId)} />
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              {/* A per-kg garment with no weight cannot be
                                  priced — say so, because a silent ₹0 reads as
                                  free and hides a missing measurement. */}
                              {it.pricingType === "PER_KG" && !(it.weightKg > 0) && (
                                <p className="text-[11px] font-medium text-amber-700">
                                  Enter the weight to price this garment{it.unitPrice > 0 ? ` at ${inr(it.unitPrice)}/kg` : ""}.
                                </p>
                              )}
                              <EligibilityLine eligible={isEligible(it.garmentId, it.serviceId)} alternatives={eligibleElsewhere(it.garmentId, it.serviceId)}
                                rate={it.unitPrice > 0 ? `${inr(it.unitPrice)}${it.pricingType === "PER_KG" ? "/kg" : ""}` : null} />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => beginEdit(it)}>
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs text-rose-600 hover:bg-rose-50" disabled={rowBusy === it.id} onClick={() => removeItem(it.id, it.garmentName)}>
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {/* AUDIT HISTORY — read from the order's existing event timeline
                    (LaundryOrderEvent), which already records transitions; the
                    correction API appends to the same log. No new model, and no
                    need to leave this screen to see what changed. */}
                {(detail.events?.length ?? 0) > 0 && (
                  <div className="rounded-lg border border-slate-200">
                    <button onClick={() => setShowHistory((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><History className="h-3.5 w-3.5" /> Audit History</span>
                      <span className="text-[11px] text-slate-400">{showHistory ? "Hide" : `${detail.events?.length} events`}</span>
                    </button>
                    {showHistory && (
                      <div className="space-y-1.5 border-t border-slate-100 px-3 py-2">
                        {detail.events!.map((ev) => (
                          <div key={ev.id} className="text-[11px]">
                            <span className="font-medium text-slate-700">{EVENT_LABEL[ev.action] || ev.action.replace(/_/g, " ")}</span>
                            {/* before → after, exactly as the API wrote it. */}
                            {ev.note && <span className="text-slate-500"> · {ev.note}</span>}
                            <span className="block text-slate-400">{ev.actorName || "—"} · {fmt(ev.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Add a MISSED garment even after the order already has some — the new
                    garment is priced + normalised like intake, then inspected below. */}
                {detail.items.length > 0 && (
                  intakeOpen ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                      <IntakeAudit orderId={detail.id} businessId={currentBusinessId} booked={[...(detail.services || []), ...detail.items]} configured={services} priced={priced} onSaved={() => { setIntakeOpen(false); openOrder(detail.id) }} onCancel={() => setIntakeOpen(false)} />
                    </div>
                  ) : (
                    <button onClick={() => setIntakeOpen(true)} className="text-sm font-semibold text-blue-600 hover:text-blue-700">+ Add missed garment</button>
                  )
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Camera className="h-4 w-4" /> Audit Photos &amp; Notes</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {photos.map((url, i) => (
                    <div key={i} className="relative h-20 w-20 rounded-lg border overflow-hidden group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="audit" className="h-full w-full object-cover" />
                      <button onClick={() => setPhotos((p) => p.filter((_, x) => x !== i))} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 opacity-0 group-hover:opacity-100"><X className="h-3 w-3 text-white" /></button>
                    </div>
                  ))}
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground hover:bg-muted/40">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ImageIcon className="h-4 w-4" /><span className="text-[10px]">Upload</span></>}
                    <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => handleUpload(e.target.files)} />
                  </label>
                </div>
                <Textarea value={auditNotes} onChange={(e) => setAuditNotes(e.target.value)} placeholder="Overall audit remarks…" className="min-h-[70px]" />
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center justify-end gap-2 pb-4">
              <Button variant="outline" onClick={handleSave} disabled={saving || acting} className="gap-1">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Progress</Button>
              <Button variant="outline" onClick={() => transition("UNDER_AUDIT", "On Hold")} disabled={acting} className="gap-1 text-orange-700 border-orange-300 hover:bg-orange-50"><PauseCircle className="h-4 w-4" /> Hold</Button>
              <Button onClick={() => transition("PAYMENT_PENDING", "Audit Approved")} disabled={acting || needsWeight || needsGarments} title={needsGarments ? "Record the garments at intake first" : needsWeight ? "Enter the total order weight first" : undefined} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">{acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {needsGarments ? "Record Garments First" : needsWeight ? "Enter Total Weight" : "Approve & Generate Invoice"} <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Queue view ──
  return (
    // A full-width operational workstation, not a centred report card. Ten
    // columns need the real page width: max-w-7xl (1280px) left a wide desktop
    // mostly empty while the table stayed cramped. Same container the Orders
    // view uses — no max-width, no mx-auto, just page padding — so the two
    // operational screens line up. The table CANNOT overflow it: table-fixed
    // plus a colgroup of percentages summing to 100% means the columns scale
    // with the container instead of demanding a scrollbar. py-4 rather than
    // py-6 returns a row's worth of vertical space to the queue.
    <div className="px-4 lg:px-6 py-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-blue-600" /> Store Audit</h1><p className="text-sm text-muted-foreground">Inspect and approve orders waiting for audit</p></div>
        <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">{rows.length} pending</Badge>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search order no…" className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {/* Scan a reusable bag QR → open that order's audit directly (no search). */}
        <BagScanButton size="sm" label="Scan Bag" onScan={scanToAudit} />
      </div>
      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16"><ClipboardCheck className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium">{search ? "No orders match" : "No orders waiting for audit"}</p></div>
        ) : (
          <>
          {/* DESKTOP — table-fixed + a colgroup of PERCENTAGES. The widths sum
              to 100%, so the table can never exceed its container and the
              horizontal scrollbar cannot appear at any desktop width. Every
              text cell is free to wrap; nothing is truncated. */}
          <Table className="hidden md:table table-fixed">
            <colgroup>
              {/* TEN columns, summing to 100% — one <col> per <TableHead>.
                  A missing entry is not harmless under table-fixed: it shifts
                  every following width one column left and leaves the last one
                  unsized, which is what adding Weight did before this.

                  Budget at 1440px, now that the page is full width:
                  1440 − 256 sidebar − 48 padding = 1136px. Order No. keeps 22%
                  = 250px, still holding the full 34-character order number on
                  ONE line at text-[11px] mono. Weight is a short numeric so 6%
                  (68px) fits "8.5 kg" comfortably; the room comes from Customer,
                  Service, Pickup and Delivery, which wrap cleanly. Every wider
                  screen scales all ten proportionally. */}
              <col className="w-[22%]" />{/* Order No. */}
              <col className="w-[12%]" />{/* Customer */}
              <col className="w-[10%]" />{/* Service  */}
              <col className="w-[6%]" /> {/* Weight   */}
              <col className="w-[10%]" />{/* Pickup   */}
              <col className="w-[10%]" />{/* Delivery */}
              <col className="w-[7%]" /> {/* Amount   */}
              <col className="w-[7%]" /> {/* Created  */}
              <col className="w-[8%]" /> {/* Status   */}
              <col className="w-[8%]" /> {/* Inspect  */}
            </colgroup>
            <TableHeader><TableRow className="[&>th]:px-2 [&>th]:text-[11px]">
              <TableHead>Order No.</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead>Pickup</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((r) => {
                // Display only. Nothing here reads or writes a status, and an
                // overdue date is a colour — never a workflow change.
                const pickup = scheduleCell(r.pickupDate, r.pickupTimeSlot)
                const delivery = scheduleCell(r.deliveryDate, r.deliveryTimeSlot)
                const services = bookedServiceNames(r.services)
                return (
                // whitespace-normal overrides TableCell's default nowrap — that
                // default is the other half of why the table could not fit.
                <TableRow key={r.id} className="cursor-pointer align-top [&>td]:px-2 [&>td]:py-2.5 [&>td]:whitespace-normal" onClick={() => openOrder(r.id)}>
                  <TableCell className="font-mono text-[11px] leading-snug text-slate-700 break-all">{r.orderNumber}</TableCell>
                  <TableCell>
                    <p className="text-[13px] font-medium text-slate-800 leading-snug break-words">{r.customer?.name || "—"}</p>
                    {r.customer?.phone && <p className="text-[12px] text-muted-foreground leading-snug">{r.customer.phone}</p>}
                  </TableCell>
                  <TableCell>
                    {/* The order's OWN booked services. More than one wraps
                        onto further lines — picking one arbitrarily is the
                        thing to avoid. */}
                    {services.length === 0 ? <span className="text-slate-400">—</span> : (
                      <div className="flex flex-wrap gap-1">
                        {services.map((name) => (
                          <Badge key={name} variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-normal px-1.5 py-0 leading-[18px]">{name}</Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  {/* The RECORDED weight. This queue is PENDING_STORE_AUDIT —
                      the stage at which weight is measured — so most rows here
                      legitimately have none yet and show an em dash. It is
                      never derived from the garment count. */}
                  <TableCell className="text-right text-[12px] tabular-nums text-slate-600">{orderWeightLabel(r.totalWeightKg)}</TableCell>
                  {[pickup, delivery].map((cell, i) => (
                    <TableCell key={i}>
                      {!cell.date ? <span className="text-slate-400">—</span> : (
                        <>
                          <p className={`text-[12px] leading-snug ${URGENCY_STYLE[cell.urgency]}`}>{cell.date}</p>
                          {cell.slot && <p className="text-[12px] text-muted-foreground leading-snug">{cell.slot}</p>}
                          {urgencyNote(cell) && (
                            <span className={`text-[11px] font-semibold leading-tight ${cell.urgency === "overdue" ? "text-rose-700" : "text-amber-700"}`}>{urgencyNote(cell)}</span>
                          )}
                        </>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="tabular-nums text-right text-[12px]">{inr(r.grandTotal)}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground leading-tight">{fmt(r.createdAt)}</TableCell>
                  <TableCell><Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50 text-[10px] px-1.5 py-0 leading-[18px]">Pending Audit</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="h-8 px-2 gap-1 text-[12px]" onClick={(e) => { e.stopPropagation(); openOrder(r.id) }}>Inspect <ArrowRight className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {/* NARROW SCREENS — a stacked card per order. A phone gets the same
              information in reading order rather than a scrollbar. */}
          <div className="md:hidden divide-y">
            {filtered.map((r) => {
              const pickup = scheduleCell(r.pickupDate, r.pickupTimeSlot)
              const delivery = scheduleCell(r.deliveryDate, r.deliveryTimeSlot)
              const services = bookedServiceNames(r.services)
              return (
                <div key={r.id} className="p-3 space-y-2 active:bg-slate-50" onClick={() => openOrder(r.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-slate-700 break-all leading-tight">{r.orderNumber}</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">{r.customer?.name || "—"}</p>
                      {r.customer?.phone && <p className="text-[11px] text-muted-foreground">{r.customer.phone}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{inr(r.grandTotal)}</p>
                      <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50 text-[10px] px-1.5 py-0 mt-0.5">Pending Audit</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {services.map((name) => (
                      <Badge key={name} variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-normal px-1.5 py-0">{name}</Badge>
                    ))}
                    {/* The recorded weight, alongside the service on phones too.
                        Unweighed orders show an em dash, never "0 kg". */}
                    <span className="text-[11px] tabular-nums text-slate-500">{orderWeightLabel(r.totalWeightKg)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {([["Pickup", pickup], ["Delivery", delivery]] as const).map(([label, cell]) => (
                      <div key={label}>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
                        {!cell.date ? <span className="text-slate-400 text-[12px]">—</span> : (
                          <>
                            <p className={`text-[12px] leading-tight ${URGENCY_STYLE[cell.urgency]}`}>{cell.date}</p>
                            {cell.slot && <p className="text-[11px] text-muted-foreground leading-tight">{cell.slot}</p>}
                            {urgencyNote(cell) && <span className={`text-[10px] font-semibold ${cell.urgency === "overdue" ? "text-rose-700" : "text-amber-700"}`}>{urgencyNote(cell)}</span>}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[11px] text-muted-foreground">{fmt(r.createdAt)}</span>
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-[12px]" onClick={(e) => { e.stopPropagation(); openOrder(r.id) }}>Inspect <ArrowRight className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )
            })}
          </div>
          </>
        )}
      </CardContent></Card>
    </div>
  )
}
// ── Intake Audit (Pickup-First) — record garments for an order that has none.
// Same order (no new order); on save the garments are priced by the Pricing
// Engine and the order continues in the EXISTING audit flow.
//
// THE SERVICE IS THE ORDER'S, NOT THE OPERATOR'S. A Pickup-First order was
// booked with a service; the intake endpoint refuses any garment carrying a
// different one (ONE SERVICE = ONE ORDER). So the service is resolved once,
// from the order itself, and applies to EVERY garment in the panel — it cannot
// drift as rows are added, and it is not offered as a choice when there is only
// one possible answer.
function IntakeAudit({ orderId, businessId, booked, configured, priced, onSaved, onCancel }: {
  orderId: string
  businessId: string | null
  /** The order's own service-bearing rows — booked services + garments already on it. */
  booked: { serviceId: string | null; serviceName: string }[]
  /** The tenant's configured services, used only to name the booked one. */
  configured: SvcOption[]
  /**
   * Active Pricing Matrix availability — the SAME map the parent already loads
   * from GET /api/laundry/garment-services and the same one the server's
   * SERVICE_NOT_AVAILABLE_FOR_GARMENT refusal is derived from. Null while it
   * loads, in which case nothing is claimed and nothing is blocked.
   */
  priced: PricedServices | null
  onSaved: () => void
  onCancel: () => void
}) {
  const { toast } = useToast()
  // Garments come from the shared master hook — same source as New Order and
  // every other operational selector, so the lists cannot diverge.
  const { garments } = useGarmentMaster(businessId)
  const [rows, setRows] = useState<{ garmentId: string; quantity: string; weightKg: string }[]>([{ garmentId: "", quantity: DEFAULT_ROW_QUANTITY, weightKg: "" }])
  const [saving, setSaving] = useState(false)

  const choice = useMemo(
    () => intakeServiceChoice(booked, configured),
    [booked, configured],
  )
  // ONE service for the whole panel. A locked order IS its booked service, so it
  // is read straight off the rule and no local state can drift from it; only an
  // order with a genuine choice keeps a pick, and it starts unselected so the
  // operator chooses rather than inherits a guess.
  const [picked, setPicked] = useState("")
  const serviceId = choice.locked ? choice.serviceId : picked

  // ── LIVE ELIGIBILITY ────────────────────────────────────────────────────
  // Answered the moment a garment is chosen, from the same availability map the
  // server refuses by — so the operator learns WHICH garment and WHICH service
  // are in conflict instead of meeting a failed Save with no explanation.
  // The server stays the authority; this only stops them reaching it blind.
  const serviceName = useMemo(
    () => choice.options.find((o) => o.id === serviceId)?.name || choice.lockedName || "",
    [choice, serviceId],
  )
  /** Reason a garment cannot be used under the CURRENT service, or null. */
  const garmentBlocked = useCallback((garmentId: string): string | null => {
    if (!serviceId || garmentAvailableForService(garmentId, serviceId, priced)) return null
    return `Not available for ${serviceName || "this service"}`
  }, [serviceId, priced, serviceName])
  /** The rows the operator has filled that the service cannot price. */
  const invalidRows = useMemo(() => rows
    .map((r, i) => ({ r, n: i + 1 }))
    .filter(({ r }) => r.garmentId && !garmentAvailableForService(r.garmentId, serviceId, priced))
    .map(({ r, n }) => ({
      n,
      garmentId: r.garmentId,
      notice: unavailableNotice(garments.find((g) => g.id === r.garmentId)?.name, serviceName),
    })), [rows, serviceId, priced, garments, serviceName])
  const hasInvalid = invalidRows.length > 0

  const addRow = () => setRows((r) => [...r, { garmentId: "", quantity: DEFAULT_ROW_QUANTITY, weightKg: "" }])
  const upd = (i: number, patch: Partial<{ garmentId: string; quantity: string; weightKg: string }>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const del = (i: number) => setRows((r) => (r.length === 1 ? r : r.filter((_, j) => j !== i)))

  const save = async () => {
    // ONE rule decides which rows become garments — shared, pure and tested.
    // A pristine row (the one every "+ Add garment" click appends) is ignored;
    // a row the operator actually engaged with is either saved or named as the
    // reason nothing was. Neither is silently dropped, and neither blocks a
    // save the operator never asked for.
    // The button is disabled while anything is invalid; this is the second
    // check, so a keyboard submit cannot slip past it.
    if (hasInvalid) {
      toast({
        title: invalidRows[0].notice.title,
        description: invalidRows.length === 1
          ? invalidRows[0].notice.detail
          : `${invalidRows.length} garments cannot be processed under ${serviceName}. Fix the rows marked below.`,
        variant: "destructive",
      })
      return
    }
    const plan = intakeRowsToItems(rows, serviceId)
    if (!plan.ok) {
      toast({
        title: plan.code === "NO_SERVICE" ? "Select a service"
          : plan.code === "NO_GARMENTS" ? "Add at least one garment"
          : "Finish every row first",
        description: plan.code === "NO_GARMENTS" ? undefined : plan.error,
        variant: "destructive",
      })
      return
    }
    const items = plan.items
    setSaving(true)
    try {
      const j = await fetch(`/api/laundry/orders/${orderId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Could not save garments")
      toast({ title: "Garments recorded", description: `${j.data.added} line(s) added — continue the audit.` })
      onSaved()
    } catch (e) { toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" }) } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      {/* THE SERVICE — stated when the order has only one, asked only when it
          genuinely has more than one possible answer. */}
      {choice.locked ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Service</span>
          <span className="text-sm font-semibold text-blue-900">{choice.lockedName}</span>
        </div>
      ) : (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Service for this order</span>
          <select value={serviceId} onChange={(e) => setPicked(e.target.value)} className="h-9 w-full rounded-md border border-input px-2 text-sm bg-background">
            <option value="">Select service…</option>
            {choice.options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {choice.locked
          ? `Every garment below is recorded under ${choice.lockedName} — the service this order was booked with.`
          : "One service per order. Every garment below is recorded under the service chosen above."}
        {" "}Weight is used for Per-KG services; quantity for piece-based.
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const bad = invalidRows.find((x) => x.n === i + 1)
          return (
          <div key={i} className="space-y-1">
            <div className="grid grid-cols-[1fr_64px_72px_32px] gap-1.5 items-center">
              {/* Searchable by name OR code — the list grows over time and
                  scrolling it at a counter is not workable. Garments the
                  service cannot price are SHOWN but greyed with the reason,
                  rather than hidden, so the operator can see they exist. */}
              <LaundryGarmentSelect
                value={r.garmentId}
                onChange={(v) => upd(i, { garmentId: v })}
                garments={garments}
                className="h-9"
                unavailable={garmentBlocked}
                invalid={!!bad}
              />
              <Input type="number" min={0} value={r.quantity} onChange={(e) => upd(i, { quantity: e.target.value })} placeholder="Qty" className="h-9 text-sm" />
              <Input type="number" min={0} step="0.05" value={r.weightKg} onChange={(e) => upd(i, { weightKg: e.target.value })} placeholder="kg" className="h-9 text-sm" />
              <button onClick={() => del(i)} disabled={rows.length === 1} className="text-slate-400 hover:text-rose-600 disabled:opacity-30 flex justify-center"><X className="h-4 w-4" /></button>
            </div>
            {/* Directly beneath the selector that caused it, naming BOTH the
                garment and the service, and what to do next. */}
            {bad && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5">
                <p className="text-[12px] font-semibold text-rose-800">⚠️ {bad.notice.title}</p>
                <p className="text-[11px] text-rose-700 leading-snug">{bad.notice.detail}</p>
              </div>
            )}
          </div>
          )
        })}
      </div>
      <button onClick={addRow} className="text-xs font-semibold text-blue-600">+ Add garment</button>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={save}
          disabled={saving || hasInvalid}
          title={hasInvalid ? `${invalidRows.length} garment(s) cannot be processed under ${serviceName}` : undefined}
          className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {hasInvalid ? `Fix ${invalidRows.length} garment${invalidRows.length === 1 ? "" : "s"} to continue` : "Save Garments & Continue"}
        </Button>
      </div>
    </div>
  )
}
