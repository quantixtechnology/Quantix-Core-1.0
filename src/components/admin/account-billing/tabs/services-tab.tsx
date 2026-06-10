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
import { ServiceTypeBadge, BillingTypeBadge } from "../shared/service-type-badge"

interface ServiceRow {
  businessId: string
  businessName: string
  id: string
  serviceType: string
  billingType: string
  name: string
  description: string | null
  amount: number
  cycle: string | null
  status: string
  startDate: string
  renewalDate: string | null
  source: string
}

function formatCurrency(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`
  return `₹${v.toLocaleString("en-IN")}`
}

const STATUS_CLS: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  COMPLETED: "bg-sky-50 text-sky-700 border-sky-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  TRIAL: "bg-amber-50 text-amber-700 border-amber-200",
}

interface Props { onViewAccount: (businessId: string) => void }

export function ServicesTab({ onViewAccount }: Props) {
  const [rows, setRows]           = useState<ServiceRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState("")
  const [serviceType, setType]    = useState("ALL")

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch accounts list then per-biz services — use accounts endpoint with limit
      const params = new URLSearchParams({ limit: "100" })
      if (search) params.set("search", search)
      const res  = await window.fetch(`/api/admin/account-billing/accounts?${params}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (!json.success) { toast.error("Failed to load"); return }

      const all: ServiceRow[] = []
      await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (json.data as any[]).map(async (acc: any) => {
          const r = await window.fetch(`/api/admin/account-billing/${acc.businessId}/services`, { headers: getAuthHeaders() })
          const j = await r.json()
          if (j.success) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            j.data.forEach((s: any) => all.push({ ...s, businessId: acc.businessId, businessName: acc.businessName }))
          }
        })
      )
      setRows(all)
    } catch { toast.error("Failed to load services") }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = serviceType === "ALL" ? rows : rows.filter(r => r.serviceType === serviceType)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search business..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-xs" />
        </div>
        <Select value={serviceType} onValueChange={setType}>
          <SelectTrigger className="h-9 text-xs w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {["Platform Plan","Add-On","Mobile App","Implementation","Training","Support","Integration","Credits","Custom Development","Other"].map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} service lines</div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-[11px]">
              <TableHead>Business</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Renewal</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({length:9}).map((__,j)=><TableCell key={j}><Skeleton className="h-4 w-full"/></TableCell>)}</TableRow>
                ))
              : filtered.length === 0
              ? <TableRow><TableCell colSpan={9} className="text-center py-10 text-sm text-muted-foreground">No services found</TableCell></TableRow>
              : filtered.map((s) => (
                  <TableRow key={`${s.businessId}-${s.id}`} className="text-xs hover:bg-muted/30">
                    <TableCell>
                      <p className="font-medium">{s.businessName}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{s.name}</p>
                      {s.description && <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{s.description}</p>}
                    </TableCell>
                    <TableCell><ServiceTypeBadge type={s.serviceType} /></TableCell>
                    <TableCell><BillingTypeBadge type={s.billingType} /></TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(s.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${STATUS_CLS[s.status] ?? ""}`}>{s.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(s.startDate).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</TableCell>
                    <TableCell>{s.renewalDate ? new Date(s.renewalDate).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}) : "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onViewAccount(s.businessId)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
