"use client"

// Pickup / Delivery verification OTP, shown on the Order Details card.
//
// UI ONLY. Every part of the OTP lifecycle already exists and is reused as-is:
//   • the code lives on LaundryOrder.pickupOtp / deliveryOtp (ONE field each, so
//     regenerating overwrites — an old code is never left valid)
//   • GET  /api/laundry/orders/[id]/otp  reads it (guarded: laundry.orders.view)
//   • POST /api/laundry/orders/[id]/otp  regenerates via regenerateOtp(),
//     audits it and pings the customer (guarded: laundry.orders.edit)
//   • verifyPickup / verifyDelivery CLEAR the code on success — which is what
//     "confirmed and frozen" means here, and why no code is shown afterwards.
//
// No second OTP source, no new endpoint, no workflow gate: this screen only
// displays what the verification engine already holds.
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, ShieldCheck, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"

export type OtpKind = "pickup" | "delivery"

export interface OtpLeg { method: string; otp: string | null }

/** Both legs, as GET …/otp returns them. */
export interface OrderOtp { pickup: OtpLeg; delivery: OtpLeg }

export function useOrderOtp(orderId: string | null, businessId: string | null) {
  const [otp, setOtp] = useState<OrderOtp | null>(null)
  const load = useCallback(async () => {
    if (!orderId || !businessId) return
    try {
      const j = await fetch(
        `/api/laundry/orders/${orderId}/otp?businessId=${encodeURIComponent(businessId)}`,
        { headers: getAuthHeaders() },
      ).then((r) => r.json())
      if (j?.success) setOtp(j.data as OrderOtp)
    } catch { /* the card renders without it — never a broken order screen */ }
  }, [orderId, businessId])
  useEffect(() => { void load() }, [load])
  return { otp, reloadOtp: load }
}

/**
 * @param confirmed the leg has been verified (pickup completed / order delivered).
 *                  The engine clears the code at that moment, so there is
 *                  nothing left to show or refresh — only the confirmation.
 * @param canRefresh mirrors laundry.orders.edit, the permission the POST enforces.
 */
export function OrderOtpBlock({
  orderId, businessId, kind, leg, confirmed, canRefresh, onRefreshed,
}: {
  orderId: string
  businessId: string
  kind: OtpKind
  leg: OtpLeg | undefined
  confirmed: boolean
  canRefresh: boolean
  onRefreshed: () => void
}) {
  const [busy, setBusy] = useState(false)
  const label = kind === "pickup" ? "Pickup OTP" : "Delivery OTP"

  // A NAME-verification order has no OTP at all — say so rather than showing an
  // empty box the operator will read as a fault.
  const method = (leg?.method || "OTP").toUpperCase()
  if (method !== "OTP") {
    return (
      <div className="col-span-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2">
        <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">This order is verified by name, not an OTP.</p>
      </div>
    )
  }

  if (confirmed) {
    return (
      <div className="col-span-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-2">
        <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
          <ShieldCheck className="h-4 w-4" /> OTP Confirmed
        </p>
        {/* The code is cleared on successful verification so it can never be
            reused. The confirmation itself is the record. */}
        <p className="text-[10px] text-slate-400 mt-0.5">Verified — this code can no longer be used or refreshed.</p>
      </div>
    )
  }

  const refresh = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ businessId, kind }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) { toast.error(j.error || "Could not refresh the OTP"); return }
      toast.success(`New ${kind} OTP generated — the previous code no longer works`)
      onRefreshed()
    } catch {
      toast.error("Could not refresh the OTP")
    } finally { setBusy(false) }
  }

  return (
    <div className="col-span-2 rounded-lg border border-blue-200 bg-blue-50/50 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400 flex items-center gap-1">
            <KeyRound className="h-3 w-3" /> {label}
          </p>
          <p className="font-mono text-lg font-bold tracking-[0.2em] text-blue-800 leading-tight">
            {leg?.otp || "——————"}
          </p>
        </div>
        {canRefresh && (
          <Button size="sm" variant="outline" onClick={refresh} disabled={busy}
            className="h-7 gap-1 border-blue-200 text-blue-700 hover:bg-blue-100 text-[11px]">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh OTP
          </Button>
        )}
      </div>
      <p className="text-[10px] text-slate-400 mt-0.5">
        Share with the customer. Refreshing replaces this code — the old one stops working.
      </p>
    </div>
  )
}
