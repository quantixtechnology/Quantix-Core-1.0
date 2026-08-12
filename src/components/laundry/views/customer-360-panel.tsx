"use client"

// Customer 360 for the New Order screen.
//
// Reads the EXISTING GET /api/laundry/customers/[id], which already returns the
// profile, addresses and a stats block — no new endpoint, no new model, and no
// second definition of what "total spend" means.
//
// Every field falls back to an em dash. A dashboard that invents a plausible
// number is worse than one that admits it has none.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, User } from "lucide-react"

const inr = (n: number | null | undefined) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const day = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"

interface Stats {
  totalOrders?: number; activeOrders?: number; inProgress?: number; completed?: number
  totalSpend?: number; outstanding?: number; lastOrderAt?: string | null
  lastOrders?: { id: string; orderNumber: string; createdAt: string; status: string; grandTotal: number; services?: string | null }[]
}
interface Profile {
  name?: string | null; phone?: string | null; customerType?: string | null
  defaultAddress?: { addressLine1?: string | null; area?: string | null; city?: string | null; pincode?: string | null } | null
  stats?: Stats
}

export function Customer360Panel({ customerId, businessId }: { customerId: string | null; businessId: string | null }) {
  const [data, setData] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    // Clearing FIRST matters: without it the previous customer's figures stay on
    // screen while the next request is in flight, and an operator reads them as
    // belonging to the customer they just picked.
    setData(null)
    if (!customerId || !businessId) return
    setLoading(true)
    fetch(`/api/laundry/customers/${customerId}?businessId=${encodeURIComponent(businessId)}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customerId, businessId])
  useEffect(() => { load() }, [load])

  if (!customerId) return null

  const s = data?.stats
  const addr = data?.defaultAddress
  const addressLine = addr
    ? [addr.addressLine1, addr.area, addr.city, addr.pincode].filter(Boolean).join(", ")
    : "—"

  return (
    <Card className="rounded-xl border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <User className="h-4 w-4 text-blue-600" />
        <p className="text-sm font-semibold text-slate-800">Customer 360</p>
        {loading && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-slate-400" />}
      </div>
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">{data?.name || "—"}</p>
          <p className="text-xs text-slate-500">
            {data?.phone || "—"}{data?.customerType ? ` · ${data.customerType.replace(/_/g, " ")}` : ""}
          </p>
        </div>

        {/* Horizontal use of the space freed by the removed cards, rather than a
            tall column that pushes Order Summary off screen. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Total Orders" value={s?.totalOrders ?? "—"} />
          <Stat label="Active" value={s?.activeOrders ?? s?.inProgress ?? "—"} />
          <Stat label="Completed" value={s?.completed ?? "—"} />
          <Stat label="Total Spend" value={inr(s?.totalSpend)} />
          <Stat label="Outstanding" value={inr(s?.outstanding)} tone={(s?.outstanding ?? 0) > 0 ? "amber" : undefined} />
          <Stat label="Last Order" value={day(s?.lastOrderAt)} />
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Default Address</p>
          <p className="mt-0.5 text-xs leading-snug text-slate-600">{addressLine}</p>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Recent Orders</p>
          {!s?.lastOrders?.length ? (
            <p className="mt-1 text-xs text-slate-400">{loading ? "Loading…" : "No previous orders."}</p>
          ) : (
            <div className="mt-1 divide-y divide-slate-50">
              {s.lastOrders.slice(0, 5).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-slate-700">{o.orderNumber}</p>
                    <p className="truncate text-[10px] text-slate-400">
                      {day(o.createdAt)}{o.services ? ` · ${o.services}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-medium tabular-nums text-slate-700">{inr(o.grandTotal)}</p>
                    <p className="text-[10px] text-slate-400">{o.status.replace(/_/g, " ")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "amber" }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
      <p className="text-[10px] leading-tight text-slate-500">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${tone === "amber" ? "text-amber-700" : "text-slate-800"}`}>{value}</p>
    </div>
  )
}
