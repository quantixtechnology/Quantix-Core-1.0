"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { IndianRupee, Calendar, AlertCircle, ExternalLink } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { AccountHealthBadge } from "./account-health-badge"
import { AckStatusBadge } from "./ack-status-badge"

interface AccountDetail {
  subscription: {
    planName: string
    billingCycle: string
    baseAmount: number
    finalAmount: number | null
    nextBillingDate: string
    lastPaymentDate: string | null
    lastPaymentAmount: number | null
  } | null
  addons: Array<{ id: string; name: string; amount: number; status: string }>
  activeAddonCount: number
  outstanding: number
  lifetimeRevenue: number
  health: string
  healthReason: string
  lastRecord: { amount: number; acknowledgeStatus: string | null; paidDate: string | null; invoiceNumber: string | null } | null
  recentDocuments: Array<{ id: string; documentNumber: string; documentType: string; status: string; amount: number; createdAt: string }>
}

const CYCLES: Record<string, string> = {
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", HALF_YEARLY: "Half-Yearly", YEARLY: "Yearly",
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function formatCurrency(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`
  return `₹${v.toLocaleString("en-IN")}`
}

interface Props {
  businessId: string
  onOpenFullView?: () => void
  onRecordPayment?: () => void
}

export function AccountBillingSummary({ businessId, onOpenFullView, onRecordPayment }: Props) {
  const [data, setData]       = useState<AccountDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/account-billing/${businessId}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch { /* silent — this is a secondary component */ }
    finally { setLoading(false) }
  }, [businessId])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (!data?.subscription) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center">
        <p className="text-sm text-muted-foreground">No subscription data available</p>
      </div>
    )
  }

  const sub = data.subscription

  return (
    <div className="space-y-3">
      {/* Financial summary grid — primary at-a-glance */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-lg border p-2.5 ${data.outstanding > 0 ? "border-red-200 bg-red-50/50" : ""}`}>
          <p className="text-[10px] text-muted-foreground">Outstanding</p>
          <p className={`text-base font-bold ${data.outstanding > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {data.outstanding > 0 ? formatCurrency(data.outstanding) : "₹0"}
          </p>
        </div>
        <div className="rounded-lg border p-2.5">
          <p className="text-[10px] text-muted-foreground">Next Due</p>
          <p className="text-sm font-bold">{fmtDate(sub.nextBillingDate)}</p>
        </div>
        <div className="rounded-lg border p-2.5">
          <p className="text-[10px] text-muted-foreground">Lifetime Revenue</p>
          <p className="text-sm font-bold">{formatCurrency(data.lifetimeRevenue)}</p>
        </div>
        <div className="rounded-lg border p-2.5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">Active Services</p>
            <p className="text-sm font-bold">{1 + data.activeAddonCount}</p>
          </div>
          <AccountHealthBadge score={data.health as never} reason={data.healthReason} />
        </div>
      </div>

      {/* Plan row */}
      <div className="rounded-lg border p-3 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{sub.planName}</p>
          <span className="text-[10px] text-muted-foreground">{CYCLES[sub.billingCycle] ?? sub.billingCycle}</span>
        </div>
        <p className="text-xs text-muted-foreground">₹{(sub.finalAmount ?? sub.baseAmount).toLocaleString("en-IN")} / cycle</p>
      </div>

      {/* Last payment */}
      {data.lastRecord && (
        <div className="rounded-lg border p-2.5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">Last Payment</p>
            <p className="text-xs font-medium">₹{data.lastRecord.amount.toLocaleString("en-IN")} · {fmtDate(data.lastRecord.paidDate)}</p>
          </div>
          <AckStatusBadge status={data.lastRecord.acknowledgeStatus} />
        </div>
      )}

      {/* Outstanding alert */}
      {data.outstanding > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-600 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{formatCurrency(data.outstanding)} outstanding balance</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5" onClick={onOpenFullView}>
          <ExternalLink className="h-3.5 w-3.5" /> Full Account View
        </Button>
        <Button size="sm" className="flex-1 h-8 text-xs" onClick={onRecordPayment}>
          Record Payment
        </Button>
      </div>

      {/* Recent invoices */}
      {data.recentDocuments.length > 0 && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent Documents</p>
            {data.recentDocuments.slice(0, 3).map(d => (
              <div key={d.id} className="flex items-center justify-between text-[11px] py-1">
                <span className="font-mono">{d.documentNumber}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{fmtDate(d.createdAt)}</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1">{d.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
