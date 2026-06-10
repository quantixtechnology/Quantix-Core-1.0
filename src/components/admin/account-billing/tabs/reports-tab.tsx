"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, AlertCircle, TrendingUp } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"

interface OutstandingRow {
  businessId: string
  businessName: string
  planName: string
  amount: number
  dueDate: string
  daysOverdue: number
  invoiceNumber: string | null
}
interface CollectionMonth { month: string; label: string; amount: number; count: number }
interface MrrData { mrr: number; arr: number; activeAccounts: number; planBreakdown: Array<{ planId: string; planName: string; tier: string; mrr: number; arr: number; accountCount: number }> }

function formatCurrency(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`
  return `₹${v.toLocaleString("en-IN")}`
}

export function ReportsTab() {
  const [tab, setTab] = useState("outstanding")
  const [outstandingRows, setOutstanding] = useState<OutstandingRow[]>([])
  const [collectionData, setCollection]   = useState<CollectionMonth[]>([])
  const [mrrData, setMrr]                 = useState<MrrData | null>(null)
  const [loading, setLoading]             = useState(false)

  const fetchOutstanding = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.fetch("/api/admin/account-billing/reports/outstanding", { headers: getAuthHeaders() })
      const j = await res.json()
      if (j.success) setOutstanding(j.data)
    } catch { toast.error("Failed") }
    finally { setLoading(false) }
  }, [])

  const fetchCollection = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.fetch("/api/admin/account-billing/reports/collection", { headers: getAuthHeaders() })
      const j = await res.json()
      if (j.success) setCollection(j.data)
    } catch { toast.error("Failed") }
    finally { setLoading(false) }
  }, [])

  const fetchMrr = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.fetch("/api/admin/account-billing/reports/mrr-arr", { headers: getAuthHeaders() })
      const j = await res.json()
      if (j.success) setMrr(j.data)
    } catch { toast.error("Failed") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (tab === "outstanding" && outstandingRows.length === 0) fetchOutstanding()
    if (tab === "collection" && collectionData.length === 0)  fetchCollection()
    if (tab === "mrr" && !mrrData)                            fetchMrr()
  }, [tab, outstandingRows.length, collectionData.length, mrrData, fetchOutstanding, fetchCollection, fetchMrr])

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList className="h-8">
            <TabsTrigger value="outstanding" className="text-xs">Outstanding</TabsTrigger>
            <TabsTrigger value="collection"  className="text-xs">Collection</TabsTrigger>
            <TabsTrigger value="mrr"         className="text-xs">MRR / ARR</TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => {
            if (tab === "outstanding") fetchOutstanding()
            if (tab === "collection")  fetchCollection()
            if (tab === "mrr")         fetchMrr()
          }} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Outstanding */}
        <TabsContent value="outstanding" className="mt-4">
          <div className="space-y-3">
            {outstandingRows.length > 0 && (
              <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                <AlertCircle className="h-4 w-4" />
                Total outstanding: {formatCurrency(outstandingRows.reduce((s,r)=>s+r.amount,0))} across {outstandingRows.length} accounts
              </div>
            )}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead>Business</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading
                    ? Array.from({length:5}).map((_,i)=><TableRow key={i}>{Array.from({length:6}).map((__,j)=><TableCell key={j}><Skeleton className="h-4 w-full"/></TableCell>)}</TableRow>)
                    : outstandingRows.length === 0
                    ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground text-emerald-600 font-medium">No outstanding amounts</TableCell></TableRow>
                    : outstandingRows.map(r=>(
                        <TableRow key={r.businessId} className="text-xs hover:bg-muted/30">
                          <TableCell className="font-medium">{r.businessName}</TableCell>
                          <TableCell>{r.planName}</TableCell>
                          <TableCell className="font-mono text-[10px]">{r.invoiceNumber ?? "—"}</TableCell>
                          <TableCell className="text-right font-medium text-red-600">{formatCurrency(r.amount)}</TableCell>
                          <TableCell>{new Date(r.dueDate).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</TableCell>
                          <TableCell className={r.daysOverdue > 30 ? "text-red-600 font-medium" : r.daysOverdue > 0 ? "text-amber-600" : "text-muted-foreground"}>
                            {r.daysOverdue > 0 ? `${r.daysOverdue}d` : "Not overdue"}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Collection */}
        <TabsContent value="collection" className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {loading
              ? Array.from({length:4}).map((_,i)=><Card key={i} className="shadow-none"><CardContent className="p-3"><Skeleton className="h-8 w-full"/></CardContent></Card>)
              : collectionData.slice(-4).map(m=>(
                  <Card key={m.month} className="shadow-none">
                    <CardContent className="p-3">
                      <p className="text-[10px] text-muted-foreground">{m.label}</p>
                      <p className="text-lg font-bold mt-0.5">{formatCurrency(m.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">{m.count} payments</p>
                    </CardContent>
                  </Card>
                ))}
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({length:6}).map((_,i)=><TableRow key={i}>{Array.from({length:3}).map((__,j)=><TableCell key={j}><Skeleton className="h-4 w-full"/></TableCell>)}</TableRow>)
                  : [...collectionData].reverse().map(m=>(
                      <TableRow key={m.month} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-medium">{m.label}</TableCell>
                        <TableCell className="text-right font-medium">{m.amount > 0 ? formatCurrency(m.amount) : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right">{m.count > 0 ? m.count : <span className="text-muted-foreground">—</span>}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* MRR / ARR */}
        <TabsContent value="mrr" className="mt-4">
          {loading
            ? <div className="space-y-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-16 w-full"/>)}</div>
            : mrrData && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Card className="shadow-none">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">MRR</p>
                      <p className="text-2xl font-bold mt-1">{formatCurrency(mrrData.mrr)}</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">ARR</p>
                      <p className="text-2xl font-bold mt-1">{formatCurrency(mrrData.arr)}</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Active Accounts</p>
                      <p className="text-2xl font-bold mt-1">{mrrData.activeAccounts}</p>
                    </CardContent>
                  </Card>
                </div>
                <Card className="shadow-none">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Plan Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-[11px]">
                          <TableHead>Plan</TableHead>
                          <TableHead>Tier</TableHead>
                          <TableHead className="text-right">Accounts</TableHead>
                          <TableHead className="text-right">MRR</TableHead>
                          <TableHead className="text-right">ARR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mrrData.planBreakdown.map(p=>(
                          <TableRow key={p.planId} className="text-xs hover:bg-muted/30">
                            <TableCell className="font-medium">{p.planName}</TableCell>
                            <TableCell>{p.tier}</TableCell>
                            <TableCell className="text-right">{p.accountCount}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(p.mrr)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(p.arr)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
