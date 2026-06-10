"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, RefreshCw, Eye } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"

interface InvoiceRow {
  id:            string
  invoiceNumber: string
  businessId:    string
  businessName:  string
  status:        string
  billingPeriod: string | null
  totalAmount:   number
  paidAmount:    number
  dueDate:       string | null
  issuedDate:    string | null
  createdAt:     string
}

function fmt(v: number) { return "₹" + v.toLocaleString("en-IN") }
function fmtDate(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

const STATUS_CLS: Record<string, string> = {
  DRAFT:          "bg-slate-100 text-slate-700",
  SENT:           "bg-sky-100 text-sky-700",
  PAID:           "bg-emerald-100 text-emerald-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  OVERDUE:        "bg-red-100 text-red-700",
  CANCELLED:      "bg-rose-100 text-rose-700",
}

interface Props { onViewAccount: (businessId: string) => void }

export function InvoicesTab({ onViewAccount }: Props) {
  const [rows,    setRows]    = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState("")
  const [status,  setStatus]  = useState("ALL")
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const LIMIT = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (search)           p.set("search", search)
      if (status !== "ALL") p.set("status", status)
      const res  = await fetch(`/api/admin/account-billing/invoices?${p}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) { setRows(json.data); setTotal(json.pagination.total) }
    } catch { toast.error("Failed to load invoices") }
    finally { setLoading(false) }
  }, [page, search, status])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, status])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search business…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-xs" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 text-xs w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">{total} invoices</div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-[11px]">
              <TableHead>Invoice #</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({length:8}).map((__,j)=><TableCell key={j}><Skeleton className="h-4 w-full"/></TableCell>)}</TableRow>
                ))
              : rows.length === 0
              ? <TableRow><TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">No invoices found</TableCell></TableRow>
              : rows.map(r => (
                  <TableRow key={r.id} className="text-xs hover:bg-muted/30">
                    <TableCell className="font-mono text-[11px] font-semibold">{r.invoiceNumber}</TableCell>
                    <TableCell className="font-medium">{r.businessName}</TableCell>
                    <TableCell>{r.billingPeriod ?? fmtDate(r.issuedDate)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmt(r.totalAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.paidAmount > 0 ? <span className="text-emerald-600">{fmt(r.paidAmount)}</span> : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_CLS[r.status] ?? "bg-muted text-muted-foreground"}`}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell>{fmtDate(r.dueDate)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onViewAccount(r.businessId)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {total > LIMIT && (
        <div className="flex items-center gap-2 justify-end text-xs">
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Prev</Button>
          <span className="text-muted-foreground">Page {page} of {Math.ceil(total/LIMIT)}</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page*LIMIT>=total} onClick={()=>setPage(p=>p+1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
