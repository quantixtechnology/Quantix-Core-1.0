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
 * The store limit the business's plan grants, or null when it cannot be
 * determined (no product/plan assigned yet).
 */
export async function planStoreLimit(platformBusinessId: string | null | undefined): Promise<number | null> {
  if (!platformBusinessId) return null
  const business = await prisma.business.findUnique({
    where: { id: platformBusinessId },
    select: { productCode: true, subscriptionPlanCode: true },
  })
  if (!business?.productCode || !business.subscriptionPlanCode) return null
  const plan = await prisma.productPlan.findUnique({
    where: { productCode_code: { productCode: business.productCode, code: business.subscriptionPlanCode } },
    select: { branchLimit: true },
  })
  return plan && plan.branchLimit > 0 ? plan.branchLimit : null
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
