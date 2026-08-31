"use client"

// ORDERS & CUSTOMER REPORT.
//
// One row per order, exported as .xlsx. The filters are the ORDERS filters —
// store, stage, date range and search — sent to the orders endpoint itself with
// report=1, so the file contains exactly the orders the Orders screen would
// list for this user. There is no second query, no second permission path and
// no second filtering language to keep in step.
//
// The workbook is written client-side with the same `xlsx` helpers the Master
// Data export uses (book_new → aoa_to_sheet → writeFile), and the header row is
// REPORT_COLUMNS — the same array the server builds its values from, so the
// headings and the values cannot drift apart.

import { useCallback, useEffect, useState } from "react"
import * as XLSX from "xlsx"
import { BarChart3, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuthStore } from "@/stores/auth-store"
import { REPORT_COLUMNS } from "@/lib/laundry-order-report"

/** The stages the Orders screen filters by — same values, same wording. */
const STAGES = [
  "PENDING_STORE_AUDIT", "UNDER_AUDIT", "PAYMENT_PENDING", "READY_FOR_PROCESSING",
  "IN_PROCESSING", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
] as const

const stageLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

export function LaundryReportsView() {
  const { currentBusinessId } = useAuthStore()
  const [stores, setStores] = useState<{ id: string; storeName: string }[]>([])
  const [storeId, setStoreId] = useState("ALL")
  const [status, setStatus] = useState("ALL")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [search, setSearch] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/businesses/${currentBusinessId}`)
      .then((r) => r.json())
      .then((b) => { if (Array.isArray(b?.stores)) setStores(b.stores) })
      .catch(() => {})
  }, [currentBusinessId])

  /** The Orders filter set, verbatim — nothing is invented here. */
  const params = useCallback(() => {
    const p = new URLSearchParams({ businessId: currentBusinessId || "", report: "1" })
    if (status !== "ALL") p.set("status", status)
    if (storeId !== "ALL") p.set("storeId", storeId)
    if (search.trim()) p.set("search", search.trim())
    if (from) p.set("from", from)
    // `to` is a calendar day; include the whole of it rather than midnight.
    if (to) p.set("to", `${to}T23:59:59.999`)
    return p
  }, [currentBusinessId, status, storeId, search, from, to])

  const exportXlsx = async () => {
    if (!currentBusinessId) return
    setBusy(true)
    try {
      const j = await fetch(`/api/laundry/orders?${params()}`).then((r) => r.json())
      if (!j?.success) throw new Error(j?.error || "Could not build the report")
      const rows: (string | number)[][] = j.report || []
      if (rows.length === 0) { toast.error("No orders match these filters — nothing to export."); return }

      const sheet = XLSX.utils.aoa_to_sheet([[...REPORT_COLUMNS], ...rows])
      // Widths chosen so the columns an operator plans from — order, customer,
      // pickup and the garment summary — are readable without resizing.
      sheet["!cols"] = REPORT_COLUMNS.map((c) =>
        c === "Garments Summary" ? { wch: 46 }
          : c === "Address" ? { wch: 38 }
          : c === "Order Number" ? { wch: 30 }
          : c === "Created" || c === "Audited At" || c === "Delivered At" ? { wch: 20 }
          : { wch: 16 })
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, sheet, "Orders")
      XLSX.writeFile(wb, `laundry-orders-report-${new Date().toISOString().slice(0, 10)}.xlsx`)

      toast.success(`Exported ${rows.length} order${rows.length === 1 ? "" : "s"}`)
      if (j.truncated) toast.warning("Only the most recent 5,000 orders were exported — narrow the date range for the rest.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    } finally { setBusy(false) }
  }

  const clear = () => { setStoreId("ALL"); setStatus("ALL"); setFrom(""); setTo(""); setSearch("") }
  const filtered = storeId !== "ALL" || status !== "ALL" || !!from || !!to || !!search.trim()

  return (
    <div className="px-4 lg:px-6 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" /> Reports
        </h1>
        <p className="text-sm text-slate-500">Orders &amp; customers, one row per order, with pickup, garments, payment and bag detail.</p>
      </div>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-semibold text-slate-800">Orders &amp; Customer Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Store</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All stores</SelectItem>
                  {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.storeName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Stage</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All stages</SelectItem>
                  {STAGES.map((s) => <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Search</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order no, customer or bag" className="h-9" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={exportXlsx} disabled={busy || !currentBusinessId} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export XLSX
            </Button>
            {filtered && <Button variant="outline" onClick={clear} className="h-9 text-xs">Clear filters</Button>}
            <p className="text-[11px] text-slate-400 ml-auto">
              {filtered ? "Exports the orders matching these filters." : "No filters — exports every order you can access."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
