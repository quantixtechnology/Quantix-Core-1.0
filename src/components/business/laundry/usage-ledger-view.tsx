"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Droplets, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"

const ENTRIES = [
  { id: "UL001", customer: "Rahul Sharma", service: "Wash + Dry + Iron", plan: "Gold Monthly", includedKg: 10, consumedKg: 8, billingMonth: "Jun 2026" },
  { id: "UL002", customer: "Priya Patel", service: "Wash + Dry", plan: "Silver Monthly", includedKg: 8, consumedKg: 8, billingMonth: "Jun 2026" },
  { id: "UL003", customer: "Amit Kumar", service: "Wash + Dry + Iron + Fold", plan: "Platinum Monthly", includedKg: 10, consumedKg: 14, billingMonth: "Jun 2026" },
  { id: "UL004", customer: "Vikram Singh", service: "Premium Care", plan: "Premium Monthly", includedKg: 12, consumedKg: 6, billingMonth: "Jun 2026" },
  { id: "UL005", customer: "Ananya Gupta", service: "Wash + Dry + Iron", plan: "Gold Monthly", includedKg: 10, consumedKg: 11, billingMonth: "May 2026" },
  { id: "UL006", customer: "Rahul Sharma", service: "Wash + Dry + Iron", plan: "Gold Monthly", includedKg: 10, consumedKg: 7, billingMonth: "May 2026" },
]

export function UsageLedgerView() {
  const [search, setSearch] = useState("")
  const { currentBusinessType } = useAdminStore()
  const isLaundry = currentBusinessType === "LAUNDRY"

  const filtered = ENTRIES.filter(e =>
    e.customer.toLowerCase().includes(search.toLowerCase()) ||
    e.service.toLowerCase().includes(search.toLowerCase()) ||
    e.billingMonth.toLowerCase().includes(search.toLowerCase())
  )

  const totalConsumed = filtered.reduce((sum, e) => sum + e.consumedKg, 0)
  const totalExtraKg = filtered.reduce((sum, e) => sum + Math.max(0, e.consumedKg - e.includedKg), 0)
  const totalRemaining = filtered.reduce((sum, e) => sum + Math.max(0, e.includedKg - e.consumedKg), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Usage Ledger</h2>
          <p className="text-sm text-muted-foreground">
            {isLaundry ? "KG consumption tracking — included vs extra per customer per month" : "Usage and consumption tracking"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-md">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">{totalConsumed.toFixed(0)}</span>
            <span className="text-emerald-600">KG consumed</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm bg-amber-50 text-amber-700 px-3 py-1.5 rounded-md">
            <TrendingUp className="h-4 w-4" />
            <span className="font-medium">{totalExtraKg.toFixed(0)}</span>
            <span className="text-amber-600">extra KG</span>
          </div>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customer or service..." className="pl-8 h-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Included KG</TableHead>
              <TableHead>Consumed KG</TableHead>
              <TableHead>Remaining KG</TableHead>
              <TableHead>Extra KG</TableHead>
              <TableHead>Billing Month</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(entry => {
              const remaining = Math.max(0, entry.includedKg - entry.consumedKg)
              const extraKg = Math.max(0, entry.consumedKg - entry.includedKg)
              return (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.customer}</TableCell>
                  <TableCell className="text-sm">{entry.service}</TableCell>
                  <TableCell className="text-sm">{entry.plan}</TableCell>
                  <TableCell className="text-sm">{entry.includedKg}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Droplets className="h-3.5 w-3.5 text-sky-600" />
                      <span className="font-medium">{entry.consumedKg}</span>
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${extraKg > 0 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, (entry.consumedKg / entry.includedKg) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {remaining > 0 ? (
                      <span className="text-emerald-600 font-medium">{remaining}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {extraKg > 0 ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">{extraKg} KG</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.billingMonth}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
