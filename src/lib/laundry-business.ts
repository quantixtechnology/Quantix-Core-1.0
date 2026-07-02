// ============================================================================
// Resolve a LaundryBusiness from EITHER its own id OR the linked platform
// business id. The laundry workspace can be entered as the laundry owner
// (currentBusinessId = LaundryBusiness.id) or by a platform admin via Open
// Workspace (the URL/business id is the platform Business.id). Every laundry
// API uses this so the same businessId param works in both cases.
//
// SELF-HEALING: if the input is a valid platform Business.id that has no
// LaundryBusiness yet (a provisioning gap), the workspace link is created
// automatically so laundry features work without manual DB repair.
// ============================================================================

import { prisma } from "@/lib/prisma"
import { generateBusinessCode } from "@/lib/laundry-codes"

export interface ResolvedLaundryBusiness {
  id: string                    // LaundryBusiness.id — used for laundry FKs (stores, orders)
  platformBusinessId: string | null  // platform Business.id — used for shared Customer records
}

export async function resolveLaundryBusiness(input: string | null | undefined): Promise<ResolvedLaundryBusiness | null> {
  if (!input) return null

  // 1) Existing LaundryBusiness by its own id or its linked platform business id.
  const existing = await prisma.laundryBusiness.findFirst({
    where: { OR: [{ id: input }, { platformBusinessId: input }] },
    select: { id: true, platformBusinessId: true },
  })
  if (existing) return existing

  // 2) Self-heal: the input may be a platform Business.id whose LaundryBusiness
  //    workspace was never provisioned. If that Business exists (and is a
  //    laundry, or unclassified), create/link the workspace automatically.
  const business = await prisma.business.findUnique({
    where: { id: input },
    select: { id: true, name: true, businessCode: true, contactPhone: true, contactEmail: true, productCode: true },
  })
  if (!business) return null
  if (business.productCode && business.productCode.toUpperCase() !== "LAUNDRY") {
    // Not a laundry tenant — don't fabricate a laundry workspace for it.
    return null
  }

  try {
    const created = await prisma.laundryBusiness.create({
      data: {
        businessCode: await generateBusinessCode(), // LND-YYYYMM-0001 (enterprise format)
        businessName: business.name || "Laundry",
        ownerName: business.name || "Owner",
        mobile: business.contactPhone || "",
        email: business.contactEmail || null,
        platformBusinessId: business.id,
        status: "ACTIVE",
      },
      select: { id: true, platformBusinessId: true },
    })
    console.log("[resolveLaundryBusiness] auto-linked LaundryBusiness", created.id, "→ Business", business.id)
    return created
  } catch (e) {
    // Concurrent request may have created it first (platformBusinessId is unique).
    const raced = await prisma.laundryBusiness.findFirst({
      where: { platformBusinessId: business.id },
      select: { id: true, platformBusinessId: true },
    })
    if (raced) return raced
    console.error("[resolveLaundryBusiness] auto-link failed for Business", business.id, e)
    return null
  }
}
