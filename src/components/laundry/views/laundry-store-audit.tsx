"use client"

// Store Audit (Stage 2) — the official verification + billing stage. Reads the
// garments the order already carries (recorded at booking as quantities) and
// captures condition / defects / photos / remarks AND, for PER_KG garments, the
// MEASURED WEIGHT (never entered at booking). Entering weight reprices the KG
// lines and generates the invoice; then Approve → Payment via the workflow
// engine. PER_PIECE orders were billed at booking and are unaffected.

import { useState, useEffect, useCallback, useMemo } from "react"
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
} from "lucide-react"
import { BagScanButton } from "@/components/laundry/bag-scanner"
import { LaundryWorkflowTimeline } from "./laundry-workflow-timeline"

const DEFECTS = [
  { code: "MISSING_BUTTON", label: "Missing Button" },
  { code: "STAIN", label: "Stain" },
  { code: "TEAR", label: "Tear" },
  { code: "ZIP_BROKEN", label: "Zip Broken" },
  { code: "COLOR_FADE", label: "Color Fade" },
]

interface OrderRow { id: string; orderNumber: string; status: string; grandTotal: number; createdAt: string; customerId: string | null }
interface Item {
  id: string; garmentName: string; serviceName: string; quantity: number; weightKg: number
  pricingType: string; unitPrice: number
  condition: string | null; defects: string | null; inspectionNotes: string | null
}
interface OrderDetail extends OrderRow {
  items: Item[]
  totalWeightKg: number
  store?: { storeName: string; storeCode: string } | null
  customer?: { name: string; phone: string | null; customerCode: string | null } | null
  auditNotes: string | null; auditPhotos: string | null
}
interface Inspection { condition: string; defects: string[]; notes: string }

const inr = (n: number) => `₹${(n || 0).toFixed(2)}`
const fmt = (s: string) => new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

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
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(false)

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
  const needsWeight = hasKgItems && !hasPerGarmentWeight && totalWeightKg <= 0

  const handleSave = async () => { setSaving(true); const ok = await saveInspection(); setSaving(false); toast(ok ? { title: "Inspection saved" } : { title: "Save failed", variant: "destructive" }) }

  const transition = async (toStatus: string, label: string) => {
    if (!detail) return
    // A KG order must have its total weight before the invoice is generated.
    if (toStatus === "PAYMENT_PENDING" && needsWeight) {
      toast({ title: "Total weight required", description: "Enter the measured total order weight (KG) before approving.", variant: "destructive" })
      return
    }
    setActing(true)
    try {
      await saveInspection()
      const res = await fetch(`/api/laundry/orders/${detail.id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toStatus, actorName: user?.name || "auditor", note: auditNotes || null }) })
      const json = await res.json()
      if (!res.ok || json.success === false) { toast({ title: "Error", description: json.error || "Transition failed", variant: "destructive" }); return }
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

  // ── Detail view ──
  if (selectedId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
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
                  <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">Pending Store Audit</Badge>
                </div>
                <div className="border-t pt-3"><LaundryWorkflowTimeline status={detail.status} /></div>
              </CardContent>
            </Card>

            {/* KG billing. Per-garment weights (from intake) are the single source
                of truth → total is auto-calculated + read-only. Bag-weight orders
                enter ONE total weight here. Never both. */}
            {hasKgItems && (
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
                        <span className="text-xl font-bold text-slate-800 tabular-nums">{totalWeightKg > 0 && kgRate > 0 ? inr(totalWeightKg * kgRate) : <span className="text-sm text-rose-500">Enter total weight</span>}</span>
                      </span>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">{hasPerGarmentWeight ? "Per-garment weights were captured at intake — the total is the sum, no re-entry needed." : "Weigh the whole KG load once. The invoice is generated from this weight × rate."}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center justify-between"><span className="flex items-center gap-2"><Shirt className="h-4 w-4" /> Garments</span><span className="text-xs font-normal text-muted-foreground">{totalPieces} pc{totalPieces === 1 ? "" : "s"} · {detail.items.length} type{detail.items.length === 1 ? "" : "s"}</span></CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {detail.items.length === 0 ? (
                  intakeOpen ? (
                    <IntakeAudit orderId={detail.id} orderNumber={detail.orderNumber} businessId={currentBusinessId} onSaved={() => { setIntakeOpen(false); openOrder(detail.id) }} onCancel={() => setIntakeOpen(false)} />
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
                    </div>
                  )
                })}
                {/* Add a MISSED garment even after the order already has some — the new
                    garment is priced + normalised like intake, then inspected below. */}
                {detail.items.length > 0 && (
                  intakeOpen ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                      <IntakeAudit orderId={detail.id} orderNumber={detail.orderNumber} businessId={currentBusinessId} onSaved={() => { setIntakeOpen(false); openOrder(detail.id) }} onCancel={() => setIntakeOpen(false)} />
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
              <Button onClick={() => transition("PAYMENT_PENDING", "Audit Approved")} disabled={acting || needsWeight} title={needsWeight ? "Enter the total order weight first" : undefined} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">{acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {needsWeight ? "Enter Total Weight" : "Approve & Generate Invoice"} <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Queue view ──
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
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
          <Table>
            <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Amount</TableHead><TableHead>Created</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => openOrder(r.id)}>
                  <TableCell className="font-mono font-medium text-sm">{r.orderNumber}</TableCell>
                  <TableCell className="tabular-nums">{inr(r.grandTotal)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmt(r.createdAt)}</TableCell>
                  <TableCell><Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">Pending Audit</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" className="gap-1" onClick={(e) => { e.stopPropagation(); openOrder(r.id) }}>Inspect <ArrowRight className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  )
}

// ── Intake Audit (Pickup-First) — record garments for an order that has none.
// Same order (no new order); on save the garments are priced by the Pricing
// Engine and the order continues in the EXISTING audit flow.
function IntakeAudit({ orderId, orderNumber, businessId, onSaved, onCancel }: { orderId: string; orderNumber: string; businessId: string | null; onSaved: () => void; onCancel: () => void }) {
  const { toast } = useToast()
  const [garments, setGarments] = useState<{ id: string; name: string }[]>([])
  const [services, setServices] = useState<{ serviceId: string; serviceName: string }[]>([])
  const [rows, setRows] = useState<{ serviceKey: string; garmentId: string; quantity: string; weightKg: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!businessId) return
    fetch(`/api/laundry/garments?businessId=${businessId}`).then((r) => r.json()).then((j) => setGarments(j.success ? (j.data || []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })) : [])).catch(() => {})
    // The CONFIGURED services (each with a real id) are the source of truth — a
    // garment must map to one so the Pricing Engine can price it. The bag's booked
    // service (if any) only pre-selects the default; it is never the option list,
    // because a bag may carry only a service NAME (null id) which would save an
    // unpriceable ₹0 "Service" line.
    Promise.all([
      fetch(`/api/laundry/services?businessId=${businessId}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/laundry/bags?businessId=${businessId}&search=${encodeURIComponent(orderNumber)}`).then((r) => r.json()).catch(() => ({})),
    ]).then(([sj, bj]) => {
      const svcs = ((sj.data || sj.services || []) as { id: string; name: string }[]).map((s) => ({ serviceId: s.id, serviceName: s.name }))
      setServices(svcs)
      const bagSvcId = ((bj.data || []) as { currentOrderId: string | null; currentServiceId: string | null }[]).find((b) => b.currentOrderId === orderId && b.currentServiceId)?.currentServiceId || null
      const defaultKey = bagSvcId && svcs.some((s) => s.serviceId === bagSvcId) ? bagSvcId : svcs[0]?.serviceId || ""
      setRows([{ serviceKey: defaultKey, garmentId: "", quantity: "1", weightKg: "" }])
    })
  }, [businessId, orderId, orderNumber])

  const svcByKey = (k: string) => services.find((s) => s.serviceId === k) || null
  const addRow = () => setRows((r) => [...r, { serviceKey: services[0]?.serviceId || "", garmentId: "", quantity: "1", weightKg: "" }])
  const upd = (i: number, patch: Partial<{ serviceKey: string; garmentId: string; quantity: string; weightKg: string }>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const del = (i: number) => setRows((r) => r.filter((_, j) => j !== i))

  const save = async () => {
    const usable = rows.filter((r) => r.garmentId && ((Number(r.quantity) || 0) > 0 || (Number(r.weightKg) || 0) > 0))
    if (!usable.length) { toast({ title: "Add at least one garment", variant: "destructive" }); return }
    // Every garment MUST have a real service selected — otherwise it can't be
    // priced and would save as a ₹0 "Service" line.
    if (usable.some((r) => !svcByKey(r.serviceKey))) {
      toast({ title: "Select a service", description: "Choose a service for every garment before saving.", variant: "destructive" }); return
    }
    const items = usable.map((r) => {
      const s = svcByKey(r.serviceKey)!
      return { serviceId: s.serviceId, garmentId: r.garmentId, quantity: Number(r.quantity) || 0, weightKg: Number(r.weightKg) || 0 }
    })
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
      <p className="text-xs text-muted-foreground">Scan the reusable bag or pick its service, then record each garment. Weight is used for Per-KG services; quantity for piece-based.</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_64px_72px_32px] gap-1.5 items-center">
            <select value={r.serviceKey} onChange={(e) => upd(i, { serviceKey: e.target.value })} className="h-9 rounded-md border border-input px-2 text-sm bg-background">
              <option value="">Select service…</option>
              {services.map((s) => <option key={s.serviceId} value={s.serviceId}>{s.serviceName}</option>)}
            </select>
            <select value={r.garmentId} onChange={(e) => upd(i, { garmentId: e.target.value })} className="h-9 rounded-md border border-input px-2 text-sm bg-background">
              <option value="">Garment…</option>
              {garments.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <Input type="number" min={0} value={r.quantity} onChange={(e) => upd(i, { quantity: e.target.value })} placeholder="Qty" className="h-9 text-sm" />
            <Input type="number" min={0} step="0.05" value={r.weightKg} onChange={(e) => upd(i, { weightKg: e.target.value })} placeholder="kg" className="h-9 text-sm" />
            <button onClick={() => del(i)} className="text-slate-400 hover:text-rose-600 flex justify-center"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <button onClick={addRow} className="text-xs font-semibold text-blue-600">+ Add garment</button>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={save} disabled={saving} className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Garments & Continue</Button>
      </div>
    </div>
  )
}
