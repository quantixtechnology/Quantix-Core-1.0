"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, RefreshCw, Eye } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"

interface AccountRow {
  businessId:     string
  businessName:   string
  businessSlug:   string
  businessStatus: string
  hasAccount:     boolean
  activeServices: number
  totalInvoices:  number
  mrr:            number
  outstanding:    number
  health:         string
  healthReason:   string
  latestInvoice:  { invoiceNumber: string; status: string; totalAmount: number } | null
}

function fmt(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`
  return `₹${v.toLocaleString("en-IN")}`
}

const STATUS_CLS: Record<string, string> = {
  ACTIVE:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  ONBOARDING: "bg-sky-50 text-sky-700 border-sky-200",
  TRIAL:      "bg-amber-50 text-amber-700 border-amber-200",
  SUSPENDED:  "bg-red-50 text-red-700 border-red-200",
  EXPIRED:    "bg-orange-50 text-orange-700 border-orange-200",
  CHURNED:    "bg-gray-50 text-gray-600 border-gray-200",
}

const HEALTH_CLS: Record<string, string> = {
  Excellent: "bg-emerald-50 text-emerald-700",
  Good:      "bg-sky-50 text-sky-700",
  Attention: "bg-amber-50 text-amber-700",
  Critical:  "bg-red-50 text-red-700",
}

interface Props { onViewAccount: (businessId: string) => void }

export function AccountsTab({ onViewAccount }: Props) {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState("")
  const [status,   setStatus]   = useState("ALL")
  const [page,     setPage]     = useState(1)
  const [total,    setTotal]    = useState(0)
  const LIMIT = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (search)          p.set("search", search)
      if (status !== "ALL") p.set("status", status)
      const res  = await fetch(`/api/admin/account-billing/accounts?${p}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) { setAccounts(json.data); setTotal(json.pagination.total) }
    } catch { toast.error("Failed to load accounts") }
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
          <SelectTrigger className="h-9 text-xs w-[150px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ONBOARDING">Onboarding</SelectItem>
            <SelectItem value="TRIAL">Trial</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="CHURNED">Churned</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">{total} businesses</div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-[11px]">
              <TableHead>Business</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">MRR</TableHead>
              <TableHead className="text-center">Services</TableHead>
              <TableHead className="text-center">Invoices</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Health</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 8 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              : accounts.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">No businesses found</TableCell>
                  </TableRow>
                )
              : accounts.map(acc => (
                  <TableRow key={acc.businessId} className="text-xs hover:bg-muted/30">
                    <TableCell>
                      <div>
                        <p className="font-medium">{acc.businessName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{acc.businessSlug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${STATUS_CLS[acc.businessStatus] ?? ""}`}>
                        {acc.businessStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{acc.mrr > 0 ? fmt(acc.mrr) : "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-[10px] h-4">{acc.activeServices}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-[10px] h-4">{acc.totalInvoices}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {acc.outstanding > 0
                        ? <span className="font-medium text-red-600">{fmt(acc.outstanding)}</span>
                        : <span className="text-emerald-600">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${HEALTH_CLS[acc.health] ?? "bg-muted text-muted-foreground"}`}>
                        {acc.health}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onViewAccount(acc.businessId)}>
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
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-muted-foreground">Page {page} of {Math.ceil(total / LIMIT)}</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
