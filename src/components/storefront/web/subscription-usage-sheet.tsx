"use client"

// Subscription usage popup — storefront "✓ Active — View Plan".
//
// Read-only, and deliberately thin: every figure comes from
// /api/core/storefront/laundry-subscription/status, the SAME endpoint the
// "Use my subscription allowance" checkbox calls during pickup scheduling. It
// computes nothing of its own, so the two surfaces cannot disagree.

import { useEffect, useState } from "react"
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

export interface SubUsage {
  active: boolean
  planName?: string
  planPrice?: number
  billingCycle?: string
  allowance?: number
  used?: number
  remaining?: number
  fullyUsed?: boolean
  percentUsed?: number
  ordersUsed?: number
  maxOrders?: number | null
  lastUpdatedAt?: string | null
  lastUpdatedAfterAudit?: boolean
  lastService?: { orderId: string; orderNumber: string; at: string; audited: boolean } | null
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`
const cycleLabel = (c?: string) => {
  switch ((c || "").toUpperCase()) {
    case "WEEKLY": return "week"
    case "QUARTERLY": return "quarter"
    case "HALF_YEARLY": return "half year"
    case "YEARLY": return "year"
    default: return "month"
  }
}
const when = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null
const day = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null

export function SubscriptionUsageSheet({
  businessId, token, phone, brandColor, onViewOrder, onClose,
}: {
  businessId: string
  token: string | null
  phone?: string | null
  brandColor: string
  /** Only wired when the storefront already has an order-details route. */
  onViewOrder?: (orderId: string) => void
  onClose: () => void
}) {
  // One state value, set only from the fetch callbacks. The sheet is mounted
  // when it opens, so it loads once — there is no synchronous reset to do.
  const [state, setState] = useState<{ status: "loading" | "ok" | "failed"; data: SubUsage | null }>({ status: "loading", data: null })
  const { data } = state
  const loading = state.status === "loading"
  const failed = state.status === "failed"

  useEffect(() => {
    let cancel = false
    fetch("/api/core/storefront/laundry-subscription/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ businessId, phone: phone || undefined }),
    })
      .then((r) => r.json())
      .then((j) => { if (!cancel) setState(j.success ? { status: "ok", data: j.data } : { status: "failed", data: null }) })
      .catch(() => { if (!cancel) setState({ status: "failed", data: null }) })
    return () => { cancel = true }
  }, [businessId, token, phone])

  const allowance = data?.allowance ?? 0
  const used = data?.used ?? 0
  const remaining = data?.remaining ?? 0
  const pct = data?.percentUsed ?? 0

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 pt-5">
          <div>
            <p className="text-base font-bold text-gray-900">{data?.planName || "Subscription"}</p>
            {data?.planPrice != null && (
              <p className="text-xs text-gray-500">{inr(data.planPrice)} / {cycleLabel(data.billingCycle)}</p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-5 pb-5 pt-4">
          {loading ? (
            <div className="py-10 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : failed || !data?.active ? (
            <p className="py-8 text-center text-sm text-gray-500">
              {failed ? "Could not load your subscription just now." : "You do not have an active subscription."}
            </p>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Subscription Balance</p>
              <p className="mt-1 text-sm text-gray-600">{allowance} clothes included</p>

              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-[11px] text-gray-400">Used</p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">{used}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-gray-400">Remaining</p>
                  {/* Never negative — an over-consumed plan reads 0. */}
                  <p className={`text-2xl font-bold tabular-nums ${remaining === 0 ? "text-rose-600" : "text-emerald-600"}`}>{remaining}</p>
                </div>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: data.fullyUsed ? "#e11d48" : brandColor }} />
              </div>
              <p className="mt-1.5 text-[11px] text-gray-500">
                {data.fullyUsed
                  ? <span className="font-semibold text-rose-600 inline-flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Fully used for this cycle</span>
                  : <>{used} of {allowance} used</>}
              </p>

              {data.lastUpdatedAt && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Balance updated after</p>
                  {/* Store Audit is where the service becomes officially counted;
                      when the order carries no audit stamp we say only when the
                      balance moved rather than claim an audit that never ran. */}
                  <p className="mt-0.5 text-sm text-gray-800">{data.lastUpdatedAfterAudit ? "Store Audit" : "Service update"}</p>
                  <p className="text-[11px] text-gray-500">{when(data.lastUpdatedAt)}</p>
                </div>
              )}

              {data.lastService && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Last service</p>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-gray-800">{data.lastService.orderNumber}</p>
                      <p className="text-[11px] text-gray-500">{day(data.lastService.at)}</p>
                    </div>
                    {onViewOrder && (
                      <button onClick={() => onViewOrder(data.lastService!.orderId)} className="shrink-0 text-xs font-semibold" style={{ color: brandColor }}>
                        View Details
                      </button>
                    )}
                  </div>
                </div>
              )}

              {data.maxOrders != null && data.maxOrders > 0 && (
                <p className="mt-3 text-[11px] text-gray-400 inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {data.ordersUsed ?? 0} of {data.maxOrders} orders used this cycle
                </p>
              )}
            </>
          )}

          <button onClick={onClose} className="mt-5 w-full rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 active:opacity-80">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
