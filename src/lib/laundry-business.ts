// ============================================================================
// Resolve a LaundryBusiness from EITHER its own id OR the linked platform
// business id. The laundry workspace can be entered as the laundry owner
// (currentBusinessId = LaundryBusiness.id) or by a platform admin via Open
// Workspace (the URL/business id is the platform Business.id). Every laundry
// API uses this so the same businessId param works in both cases.
// ============================================================================

import { prisma } from "@/lib/prisma"

export interface ResolvedLaundryBusiness {
  id: string                    // LaundryBusiness.id — used for laundry FKs (stores, orders)
  platformBusinessId: string | null  // platform Business.id — used for shared Customer records
}

export async function resolveLaundryBusiness(input: string | null | undefined): Promise<ResolvedLaundryBusiness | null> {
  if (!input) return null
  const biz = await prisma.laundryBusiness.findFirst({
    where: { OR: [{ id: input }, { platformBusinessId: input }] },
    select: { id: true, platformBusinessId: true },
  })
  return biz
}
