"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Droplets, Phone } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"

const SUBSCRIPTIONS = [
  { id: "CS001", customer: "Rahul Sharma", phone: "+91 98765 43210", service: "Wash + Dry + Iron", plan: "Gold Monthly", startDate: "2026-01-15", renewalDate: "2026-07-15", status: "ACTIVE" },
  { id: "CS002", customer: "Priya Patel", phone: "+91 98765 43211", service: "Wash + Dry", plan: "Silver Monthly", startDate: "2026-02-20", renewalDate: "2026-07-20", status: "ACTIVE" },
  { id: "CS003", customer: "Amit Kumar", phone: "+91 98765 43212", service: "Wash + Dry + Iron + Fold", plan: "Platinum Monthly", startDate: "2026-03-01", renewalDate: "2026-07-01", status: "ACTIVE" },
  { id: "CS004", customer: "Sneha Reddy", phone: "+91 98765 43213", service: "Wash + Dry", plan: "Silver Monthly", startDate: "2025-12-01", renewalDate: "2026-06-01", status: "EXPIRED" },
  { id: "CS005", customer: "Vikram Singh", phone: "+91 98765 43214", service: "Premium Care", plan: "Premium Monthly", startDate: "2026-04-10", renewalDate: "2026-07-10", status: "ACTIVE" },
  { id: "CS006", customer: "Ananya Gupta", phone: "+91 98765 43215", service: "Wash + Dry + Iron", plan: "Gold Monthly", startDate: "2026-05-05", renewalDate: "2026-07-05", status: "PENDING_RENEWAL" },
]

export function CustomerSubscriptionsView() {
  const [search, setSearch] = useState("")
  const { currentBusinessType } = useAdminStore()
  const isLaundry = currentBusinessType === "LAUNDRY"

  const filtered = SUBSCRIPTIONS.filter(s =>
    s.customer.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search) ||
    s.service.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Customer Subscriptions</h2>
          <p className="text-sm text-muted-foreground">
            {isLaundry ? "Laundry subscription holders and their plan details" : "View and manage all active subscriptions"}
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search customers..." className="pl-8 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>Renewal Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(sub => (
              <TableRow key={sub.id}>
                <TableCell className="font-medium">{sub.customer}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{sub.phone}</div>
                </TableCell>
                <TableCell className="text-sm">{sub.service}</TableCell>
                <TableCell className="text-sm font-medium">{sub.plan}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{sub.startDate}</TableCell>
                <TableCell className="text-sm">{sub.renewalDate}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={
                    sub.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    sub.status === "PENDING_RENEWAL" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-red-50 text-red-700 border-red-200"
                  }>
                    {sub.status === "PENDING_RENEWAL" ? "Pending Renewal" : sub.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
