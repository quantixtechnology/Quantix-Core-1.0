// Seeding a new laundry workspace's plan limits.
//
// THE BUG THIS FIXES: the Store Limit chosen during Business Creation was
// displayed by the plan selector ("Branches: 5") and then never written
// anywhere. Two creation paths, two different failures:
//
//   Super Admin → Provisioning: the LaundryBusiness is materialised lazily by
//     resolveLaundryBusiness(), which created ONLY that row. No
//     LaundryScalingLimit existed at all, so storesAllowed was null and the
//     store-limit check (`if (limits && …)`) never fired — the limit was
//     completely unenforced.
//
//   POST /api/laundry/businesses: created the LaundryScalingLimit with no
//     data, so storesAllowed fell to the schema default of 1 regardless of the
//     plan the business was sold.
//
// Both now seed from ProductPlan.branchLimit — the same number the plan
// selector shows. No new model, no duplicate quota field: this writes the
// EXISTING LaundryScalingLimit.storesAllowed.

import { prisma } from "@/lib/prisma"

/**
 * Per-business resource overrides, stored as JSON on Business.settings under
 * `resourceOverrides` — the exact shape Business Management → Resource
 * Allocation writes. A blank field means "no override", not zero.
 */
export interface ResourceOverrides { storageGB?: number; users?: number; stores?: number }

export function parseResourceOverrides(settings: string | null | undefined): ResourceOverrides {
  try {
    const s = settings ? JSON.parse(settings) : {}
    return (s?.resourceOverrides ?? {}) as ResourceOverrides
  } catch {
    return {} // malformed settings JSON → no override
  }
}

export interface StoreLimitResolution {
  planDefault: number | null
  override: number | null
  /** override ?? planDefault — what the business is actually entitled to. */
  effective: number | null
  planCode: string | null
}

/**
 * THE effective store limit: business override first, plan default second.
 *
 * The plan's branchLimit is only a DEFAULT. When an administrator has given a
 * business an explicit Stores / Branches override in Resource Allocation, that
 * is the customer's real entitlement and it wins — a STARTER business granted 5
 * stores has 5, not 1.
 *
 * This mirrors the Resource Allocation screen's own arithmetic (effective =
 * override ?? plan default) and the storage precedent already in
 * business-provisioning.ts. Store limits are resolved HERE and nowhere else, so
 * the platform cannot end up with two definitions of "Store Limit".
 */
export async function resolveEffectiveStoreLimit(platformBusinessId: string | null | undefined): Promise<StoreLimitResolution> {
  const empty: StoreLimitResolution = { planDefault: null, override: null, effective: null, planCode: null }
  if (!platformBusinessId) return empty

  const business = await prisma.business.findUnique({
    where: { id: platformBusinessId },
    select: { productCode: true, subscriptionPlanCode: true, settings: true },
  })
  if (!business) return empty

  const ov = parseResourceOverrides(business.settings).stores
  // Same guard the Review UI applies: blank/invalid/<1 is not an override.
  const override = typeof ov === "number" && Number.isFinite(ov) && ov >= 1 ? Math.floor(ov) : null

  let planDefault: number | null = null
  if (business.productCode && business.subscriptionPlanCode) {
    const plan = await prisma.productPlan.findUnique({
      where: { productCode_code: { productCode: business.productCode, code: business.subscriptionPlanCode } },
      select: { branchLimit: true },
    })
    planDefault = plan && plan.branchLimit > 0 ? plan.branchLimit : null
  }

  return { planDefault, override, effective: override ?? planDefault, planCode: business.subscriptionPlanCode ?? null }
}

/** Convenience: just the number a new workspace should be seeded with. */
export async function planStoreLimit(platformBusinessId: string | null | undefined): Promise<number | null> {
  return (await resolveEffectiveStoreLimit(platformBusinessId)).effective
}

/**
 * Create the scaling-limit row for a NEW laundry workspace, seeded from the
 * plan. Idempotent and non-destructive: if a row already exists it is left
 * exactly as it is, so a business whose limits an administrator has already
 * tuned is never overwritten.
 */
export async function ensureScalingLimitForNewBusiness(
  laundryBusinessId: string,
  platformBusinessId: string | null | undefined,
): Promise<void> {
  // Wholly non-fatal. This runs inside resolveLaundryBusiness(), which every
  // laundry request depends on — seeding a limits row must never be able to
  // fail the resolution of a business that was created perfectly well.
  try {
    const existing = await prisma.laundryScalingLimit.findUnique({
      where: { businessId: laundryBusinessId },
      select: { id: true },
    })
    if (existing) return // never modify an existing business's limits

    const storesAllowed = await planStoreLimit(platformBusinessId)
    await prisma.laundryScalingLimit.create({
      data: {
        businessId: laundryBusinessId,
        // Omitted when the plan is unknown so the schema default applies
        // rather than a number invented here.
        ...(storesAllowed != null ? { storesAllowed } : {}),
      },
    })
  } catch (e) {
    console.error("[scaling-limits] seed skipped:", e instanceof Error ? e.message : e)
  }
}
