"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Calendar, IndianRupee, RotateCcw, Repeat, XCircle } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"

type RenewalStatus = "UPCOMING" | "DUE_SOON" | "EXPIRED" | "PROCESSING"

interface Renewal {
  id: string
  customer: string
  service: string
  plan: string
  amount: number
  renewalDate: string
  daysLeft: number
  status: RenewalStatus
  autoRenew: boolean
}

const RENEWALS: Renewal[] = [
  { id: "RN001", customer: "Sneha Reddy", service: "Wash + Dry", plan: "Silver Monthly", amount: 2500, renewalDate: "2026-07-01", daysLeft: 13, status: "UPCOMING", autoRenew: true },
  { id: "RN002", customer: "Amit Kumar", service: "Wash + Dry + Iron + Fold", plan: "Platinum Monthly", amount: 4000, renewalDate: "2026-07-01", daysLeft: 13, status: "UPCOMING", autoRenew: true },
  { id: "RN003", customer: "Ananya Gupta", service: "Wash + Dry + Iron", plan: "Gold Monthly", amount: 3500, renewalDate: "2026-07-05", daysLeft: 17, status: "UPCOMING", autoRenew: false },
  { id: "RN004", customer: "Vikram Singh", service: "Premium Care", plan: "Premium Monthly", amount: 5500, renewalDate: "2026-07-10", daysLeft: 22, status: "UPCOMING", autoRenew: true },
  { id: "RN005", customer: "Rahul Sharma", service: "Wash + Dry + Iron", plan: "Gold Monthly", amount: 3500, renewalDate: "2026-07-15", daysLeft: 27, status: "UPCOMING", autoRenew: true },
  { id: "RN006", customer: "Priya Patel", service: "Wash + Dry", plan: "Silver Monthly", amount: 2500, renewalDate: "2026-07-20", daysLeft: 32, status: "UPCOMING", autoRenew: false },
  { id: "RN007", customer: "Sneha Reddy", service: "Wash + Dry", plan: "Silver Monthly", amount: 2500, renewalDate: "2026-06-01", daysLeft: -17, status: "EXPIRED", autoRenew: false },
]

export function RenewalsView() {
  const { currentBusinessType } = useAdminStore()
  const isLaundry = currentBusinessType === "LAUNDRY"
  const [renewals, setRenewals] = useState(RENEWALS)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleRenewNow = (id: string) => {
    setProcessingId(id)
    setTimeout(() => {
      setRenewals(prev => prev.map(r =>
        r.id === id ? { ...r, status: "PROCESSING" as RenewalStatus } : r
      ))
      setProcessingId(null)
    }, 1000)
  }

  const handleToggleAutoRenew = (id: string) => {
    setRenewals(prev => prev.map(r =>
      r.id === id ? { ...r, autoRenew: !r.autoRenew } : r
    ))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Renewals</h2>
          <p className="text-sm text-muted-foreground">
            {isLaundry ? "Laundry subscription renewals — renew now, auto-renew, or expired" : "Upcoming subscription renewals and payment collections"}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <RotateCcw className="h-4 w-4" />
          Process All Due
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Current Plan</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Renewal Date</TableHead>
              <TableHead>Renewal Status</TableHead>
              <TableHead>Auto-Renew</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renewals.map(r => (
              <TableRow key={r.id} className={r.status === "EXPIRED" ? "opacity-60" : ""}>
                <TableCell className="font-medium">{r.customer}</TableCell>
                <TableCell className="text-sm">{r.service}</TableCell>
                <TableCell className="text-sm">{r.plan}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{r.amount.toLocaleString("en-IN")}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {r.renewalDate}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={
                    r.status === "UPCOMING" ? "bg-blue-50 text-blue-700 border-blue-200" :
                    r.status === "DUE_SOON" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    r.status === "PROCESSING" ? "bg-purple-50 text-purple-700 border-purple-200" :
                    "bg-red-50 text-red-700 border-red-200"
                  }>
                    {r.status === "DUE_SOON" ? `${r.daysLeft} days left` :
                     r.status === "PROCESSING" ? "Processing..." :
                     r.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {r.status !== "EXPIRED" && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.autoRenew}
                        onCheckedChange={() => handleToggleAutoRenew(r.id)}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                      <span className="text-[10px] text-muted-foreground">{r.autoRenew ? "On" : "Off"}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {r.status === "EXPIRED" ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleRenewNow(r.id)}>
                      <RotateCcw className="h-3 w-3" />
                      Renew
                    </Button>
                  ) : r.status !== "PROCESSING" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleRenewNow(r.id)}
                      disabled={processingId === r.id}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Renew Now
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
