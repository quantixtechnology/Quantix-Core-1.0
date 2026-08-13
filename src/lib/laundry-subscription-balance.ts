// The ONE subscription balance calculation.
//
// A customer must never be shown "38 remaining" on the storefront and "42
// remaining" when scheduling a pickup. This is the arithmetic the pickup
// scheduling entitlement check already performed
// (/api/core/storefront/laundry-subscription/status); it is lifted here
// unchanged so the storefront card, the usage popup and pickup scheduling read
// the same function instead of three copies of the same three lines.
//
// It is a READ. Nothing here consumes allowance, and there is no second ledger:
// `used` is the sum of the existing SubscriptionUsage rows, which the
// subscription engine writes when it applies coverage to an order.

export interface UsageRow {
  creditsUsed?: number | null
}

export interface BalanceInput {
  /** Allowance frozen on the subscription at purchase. */
  totalCredits?: number | null
  /** Plan default, used only when the subscription carries none. */
  planTotalCredits?: number | null
  usages: UsageRow[]
}

export interface SubscriptionBalance {
  /** What the plan includes this cycle. */
  allowance: number
  /** What has actually been counted against it. */
  used: number
  /** Never negative — an over-consumed plan reads 0, not -3. */
  remaining: number
  /** How many orders have drawn on it this cycle. */
  ordersUsed: number
  /** Nothing left. */
  fullyUsed: boolean
  /** 0–100, for the progress bar. */
  percentUsed: number
}

export function subscriptionBalance(sub: BalanceInput): SubscriptionBalance {
  const allowance = Math.max(0, sub.totalCredits || sub.planTotalCredits || 0)
  const used = Math.max(0, sub.usages.reduce((s, u) => s + (u.creditsUsed || 0), 0))
  // Clamped: showing a negative remainder would read as a debt the customer
  // does not owe. Used is left truthful.
  const remaining = Math.max(0, allowance - used)
  return {
    allowance,
    used,
    remaining,
    ordersUsed: sub.usages.length,
    fullyUsed: allowance > 0 && remaining === 0,
    percentUsed: allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0,
  }
}
