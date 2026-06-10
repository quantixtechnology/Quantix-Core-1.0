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
import { DocumentTypeBadge, DocumentStatusBadge } from "../shared/document-type-badge"
import { AckStatusBadge } from "../shared/ack-status-badge"

interface InvoiceRow {
  id: string
  invoiceNumber: string | null
  businessId: string
  businessName: string
  planName: string
  amount: number
  status: string
  acknowledgeStatus: string | null
  paymentMode: string | null
  periodLabel: string | null
  dueDate: string
  paidDate: string | null
  createdAt: string
  proofUrl: string | null
  recordedByName: string | null
}

function formatCurrency(v: number) {
  return `₹${v.toLocaleString("en-IN")}`
}

const STATUS_LABEL: Record<string, string> = { paid: "Paid", pending: "Pending" }

interface Props { onViewAccount: (businessId: string) => void }

export function InvoicesTab({ onViewAccount }: Props) {
  const [rows, setRows]       = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState("")
  const [status, setStatus]   = useState("ALL")
  const [page, setPage]       = useState(1)
  const [total, setTotal]     = useState(0)
  const LIMIT = 50

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (search)                params.set("search", search)
      if (status === "paid" || status === "pending") params.set("status", status)
      else if (status !== "ALL") params.set("ackStatus", status)
      const res  = await window.fetch(`/api/admin/billing/invoices?${params}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) { setRows(json.data); setTotal(json.pagination.total) }
    } catch { toast.error("Failed to load invoices") }
    finally { setLoading(false) }
  }, [page, search, status])

  useEffect(() => { fetch() }, [fetch])
  useEffect(() => { setPage(1) }, [search, status])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search business..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-xs" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 text-xs w-[180px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="RECEIVED">Received</SelectItem>
            <SelectItem value="PARTIALLY_RECEIVED">Partial</SelectItem>
            <SelectItem value="PENDING_VERIFICATION">Pending Verification</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="WAIVED">Waived</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={fetch} disabled={loading}>
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
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Paid Date</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({length:9}).map((__,j)=><TableCell key={j}><Skeleton className="h-4 w-full"/></TableCell>)}</TableRow>
                ))
              : rows.length === 0
              ? <TableRow><TableCell colSpan={9} className="text-center py-10 text-sm text-muted-foreground">No invoices found</TableCell></TableRow>
              : rows.map((r) => (
                  <TableRow key={r.id} className="text-xs hover:bg-muted/30">
                    <TableCell className="font-mono text-[11px]">{r.invoiceNumber ?? "—"}</TableCell>
                    <TableCell className="font-medium">{r.businessName}</TableCell>
                    <TableCell>{r.planName}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(r.amount)}</TableCell>
                    <TableCell>
                      <DocumentStatusBadge value={STATUS_LABEL[r.status] ?? r.status} />
                    </TableCell>
                    <TableCell><AckStatusBadge status={r.acknowledgeStatus} /></TableCell>
                    <TableCell>{new Date(r.dueDate).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</TableCell>
                    <TableCell>
                      {r.paidDate ? new Date(r.paidDate).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}) : "—"}
                    </TableCell>
                    <TableCell>
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
