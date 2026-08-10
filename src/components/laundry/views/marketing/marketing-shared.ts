// Shared client helpers for the optional Marketing module.
// Enablement reuses the EXISTING per-business feature toggle
// (LaundryBusinessFeature featureKey "MARKETING") — no new entitlement system.
import { useEffect, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"

export interface Promotion {
  id: string; businessId: string; workspaceType: string | null; kind: string
  title: string; description: string | null; code: string | null
  discountType: string; discountValue: number; maxDiscount: number | null; minOrderValue: number | null
  status: string; enabled: boolean; startAt: string | null; endAt: string | null
  maxUses: number | null; maxUsesPerCustomer: number | null; usedCount: number
  applyTo: string; createdAt: string; updatedAt: string
  _count?: { redemptions: number }
}

// Campaign types a coupon can apply to, independently selectable.
//
// Stored as a JSON array in Promotion.applyTo, so extending the list needs no
// schema change and no migration — an older coupon simply carries fewer values.
// The first three are the original keys and MUST keep their spelling: existing
// rows contain them.
export const APPLY_TO_OPTIONS = [
  { value: "ORDER", label: "Normal Laundry Order" },
  { value: "FIRST_ORDER", label: "First Order" },
  { value: "SUBSCRIPTION_PURCHASE", label: "First Subscription" },
  { value: "SUBSCRIPTION_RENEWAL", label: "Subscription Renewal" },
  { value: "SUBSCRIPTION_UPGRADE", label: "Subscription Upgrade" },
  { value: "ANNUAL_PLAN", label: "Annual Plan" },
  { value: "REFERRAL_REWARD", label: "Referral Reward" },
  { value: "BIRTHDAY", label: "Birthday Coupon" },
  { value: "LOYALTY_REWARD", label: "Loyalty Reward" },
  { value: "FESTIVAL_CAMPAIGN", label: "Festival Campaign" },
  { value: "RECOVERY", label: "Recovery Coupon" },
] as const

export const applyToLabel = (value: string): string =>
  APPLY_TO_OPTIONS.find((o) => o.value === value)?.label ?? value

export const STATUS_OPTIONS = ["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "EXPIRED", "CANCELLED"] as const

export function parseApplyTo(raw: string | null | undefined): string[] {
  try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) ? a.map(String) : [] } catch { return [] }
}

// MARKETING enabled for this business? Reuses the features endpoint.
export function useMarketingEnabled(): boolean | null {
  const { currentBusinessId } = useAuthStore()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    if (!currentBusinessId) { setEnabled(false); return }
    let alive = true
    fetch(`/api/laundry/businesses/${encodeURIComponent(currentBusinessId)}/features`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { featureKey: string; enabled: boolean }[]) => {
        if (alive) setEnabled(Array.isArray(rows) && rows.some((x) => x.featureKey === "MARKETING" && x.enabled))
      })
      .catch(() => { if (alive) setEnabled(false) })
    return () => { alive = false }
  }, [currentBusinessId])
  return enabled // null = loading
}
