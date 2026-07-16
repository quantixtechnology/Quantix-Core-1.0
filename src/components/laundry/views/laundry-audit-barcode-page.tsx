"use client"

// Barcode Generation — dedicated operational page with Pending | History tabs.
// Pending: packages awaiting barcode generation (write flow). History: every
// order that COMPLETED Barcode Generation — i.e. the operator clicked "Move to
// Processing Queue" (stored data, NOT order status) — opens the SAME screen
// READ-ONLY (view stored barcodes + print again; no regeneration). Reuses
// /api/laundry/orders (additive barcoded filter + search) and the
// LaundryAuditBarcode component.
import { useEffect, useState, useCallback } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Barcode as BarcodeIcon, Loader2, ArrowRight, Search, History as HistoryIcon } from "lucide-react"
import { LaundryAuditBarcode } from "./laundry-audit-barcode"

interface HistoryOrder { id: string; orderNumber: string; customer?: { name?: string | null; phone?: string | null } | null; customerName?: string | null; itemCount?: number; createdAt: string; store?: { storeName?: string | null } | null }

export function LaundryAuditBarcodePage() {
  const { currentBusinessId } = useAuthStore()
  const { processingOrderId, setProcessingOrderId } = useAdminStore()
  const [tab, setTab] = useState<"pending" | "history">("pending")
  const [awaiting, setAwaiting] = useState<{ id: string; orderNumber: string; customer: string | null; items: number; barcoded: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryOrder[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/processing?businessId=${currentBusinessId}`).then((r) => r.json())
      setAwaiting(j.awaitingBarcode || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  const loadHistory = useCallback(async () => {
    if (!currentBusinessId) return
    setHistLoading(true)
    try {
      const p = new URLSearchParams({ businessId: currentBusinessId, barcoded: "1", limit: "50" })
      if (search.trim()) p.set("search", search.trim())
      const j = await fetch(`/api/laundry/orders?${p}`).then((r) => r.json())
      setHistory(j.data || [])
    } catch { /* noop */ } finally { setHistLoading(false) }
  }, [currentBusinessId, search])
  useEffect(() => { if (tab === "history") loadHistory() }, [tab, loadHistory])

  // Pending write flow (generate + move).
  if (processingOrderId) {
    return <LaundryAuditBarcode orderId={processingOrderId} onBack={() => { setProcessingOrderId(null); load() }} onMoved={() => { setProcessingOrderId(null); load() }} />
  }
  // History read-only view — same screen, print again only.
  if (historyId) {
    return <LaundryAuditBarcode orderId={historyId} readOnly onBack={() => setHistoryId(null)} onMoved={() => setHistoryId(null)} />
  }

  const custName = (o: HistoryOrder) => o.customer?.name || o.customerName || "—"

  return (
    <div className="px-4 lg:px-6 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><BarcodeIcon className="h-5 w-5 text-blue-600" /> Barcode Generation</h1>
        <p className="text-sm text-slate-500">Re-audit received packages and generate garment barcodes before processing.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {([["pending", "Pending"], ["history", "History"]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-md px-4 py-1.5 text-sm font-semibold ${tab === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{lbl}</button>
        ))}
      </div>

      {tab === "pending" ? (
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><BarcodeIcon className="h-[18px] w-[18px] text-blue-600" /> Packages Awaiting Barcode <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{awaiting.length}</Badge></CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="py-10 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : awaiting.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No packages awaiting audit. Receive a package from the Processing Center console.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead className="text-center">Garments</TableHead><TableHead>Barcodes</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>{awaiting.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                    <TableCell className="text-sm">{o.customer || "—"}</TableCell>
                    <TableCell className="text-center">{o.items}</TableCell>
                    <TableCell><Badge variant="outline" className={o.barcoded === o.items ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-amber-300 text-amber-700 bg-amber-50"}>{o.barcoded}/{o.items} barcoded</Badge></TableCell>
                    <TableCell className="text-right"><Button size="sm" onClick={() => setProcessingOrderId(o.id)} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"><BarcodeIcon className="h-3.5 w-3.5" /> Open Barcode Generation <ArrowRight className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0 gap-3">
            <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><HistoryIcon className="h-[18px] w-[18px] text-slate-500" /> Completed — Barcode History</CardTitle>
            <div className="relative w-64"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order no, customer, mobile…" className="h-8 pl-8 text-sm" /></div>
          </CardHeader>
          <CardContent className="p-0">
            {histLoading ? <div className="py-10 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : history.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No barcoded orders found.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Store</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>{history.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                    <TableCell className="text-sm">{custName(o)}</TableCell>
                    <TableCell className="text-sm text-slate-500">{o.store?.storeName || "—"}</TableCell>
                    <TableCell className="text-sm text-slate-500">{new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setHistoryId(o.id)} className="gap-1"><BarcodeIcon className="h-3.5 w-3.5" /> View / Print</Button></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
