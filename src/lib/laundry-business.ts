// ============================================================================
// Resolve a LaundryBusiness from EITHER its own id OR the linked platform
// business id. The laundry workspace can be entered as the laundry owner
// (currentBusinessId = LaundryBusiness.id) or by a platform admin via Open
// Workspace (the URL/business id is the platform Business.id). Every laundry
// API uses this so the same businessId param works in both cases.
//
// RESOLUTION ORDER
//   1. Exact match by LaundryBusiness.id
//   2. Match by platformBusinessId (Open Workspace path)
//   3. Orphan repair: platform Business with matching name has an unlinked
//      LaundryBusiness (platformBusinessId IS NULL) → backfill the link
//   4. Only if nothing exists: create a brand-new LaundryBusiness.
//
// This avoids creating duplicate LaundryBusiness records when an orphan
// can be safely repaired by linking the existing record.
// ============================================================================

import { prisma } from "@/lib/prisma"
import { generateBusinessCode } from "@/lib/laundry-codes"

// ── Debug helper (env-var gated) ─────────────────────────────────────────────
const DEBUG = process.env.DEBUG_LAUNDRY_RESOLUTION === "true"

export interface ResolvedLaundryBusiness {
  id: string                    // LaundryBusiness.id — used for laundry FKs (stores, orders)
  platformBusinessId: string | null  // platform Business.id — used for shared Customer records
  businessCode: string          // unique business code for the laundry
}

export async function resolveLaundryBusiness(input: string | null | undefined): Promise<ResolvedLaundryBusiness | null> {
  if (!input) {
    if (DEBUG) console.log("[resolveLaundryBusiness] input=null → null")
    return null
  }
  if (DEBUG) console.log("[resolveLaundryBusiness] input:", input)

  // ── Step 1 — Lookup by LaundryBusiness.id ───────────────────────────────────
  // ── Step 2 — Lookup by platformBusinessId ────────────────────────────────────
  const existing = await prisma.laundryBusiness.findFirst({
    where: { OR: [{ id: input }, { platformBusinessId: input }] },
    select: { id: true, platformBusinessId: true, businessCode: true },
  })
  if (existing) {
    if (DEBUG) {
      const via = existing.id === input ? "id" : "platformBusinessId"
      console.log("[resolveLaundryBusiness] matched by", via, "→", existing.id)
    }
    return existing
  }
  if (DEBUG) console.log("[resolveLaundryBusiness] no match by id or platformBusinessId")

  // ── Look up the platform Business ────────────────────────────────────────────
  const business = await prisma.business.findUnique({
    where: { id: input },
    select: { id: true, name: true, businessCode: true, contactPhone: true, contactEmail: true, productCode: true },
  })
  if (!business) {
    if (DEBUG) console.log("[resolveLaundryBusiness] Business", input, "not found → null")
    return null
  }
  if (DEBUG) console.log("[resolveLaundryBusiness] Business found:", business.id, "name:", business.name, "productCode:", business.productCode)

  if (business.productCode && business.productCode.toUpperCase() !== "LAUNDRY") {
    if (DEBUG) console.log("[resolveLaundryBusiness] productCode is", business.productCode, "→ blocked → null")
    return null
  }

  // ── Step 3 — Orphan repair ──────────────────────────────────────────────────
  // Check if there's an orphan LaundryBusiness (platformBusinessId IS NULL)
  // whose businessName matches the platform Business name. If found, backfill
  // the link and return the existing record instead of creating a duplicate.
  if (business.name) {
    const orphan = await prisma.laundryBusiness.findFirst({
      where: { businessName: business.name, platformBusinessId: null },
      select: { id: true },
    })
    if (orphan) {
      if (DEBUG) console.log("[resolveLaundryBusiness] orphan found:", orphan.id, "— backfilling platformBusinessId →", business.id)
      await prisma.laundryBusiness.update({
        where: { id: orphan.id },
        data: { platformBusinessId: business.id },
      })
      if (DEBUG) console.log("[resolveLaundryBusiness] orphan repaired → returning id:", orphan.id)
      return { id: orphan.id, platformBusinessId: business.id, businessCode: business.businessCode || `LND-${orphan.id}` }
    }
    if (DEBUG) console.log("[resolveLaundryBusiness] no orphan matches name:", business.name)
  }

  // ── Step 4 — Create new LaundryBusiness ─────────────────────────────────────
  if (DEBUG) console.log("[resolveLaundryBusiness] creating new LaundryBusiness for Business", business.id)
  try {
    const created = await prisma.laundryBusiness.create({
      data: {
        businessCode: await generateBusinessCode(),
        businessName: business.name || "Laundry",
        ownerName: business.name || "Owner",
        mobile: business.contactPhone || "",
        email: business.contactEmail || null,
        platformBusinessId: business.id,
        status: "ACTIVE",
      },
      select: { id: true, platformBusinessId: true, businessCode: true },
    })
    if (DEBUG) console.log("[resolveLaundryBusiness] created →", created.id)
    return created
  } catch (e) {
    if (DEBUG) console.log("[resolveLaundryBusiness] create() threw — racing?")
    const raced = await prisma.laundryBusiness.findFirst({
      where: { platformBusinessId: business.id },
      select: { id: true, platformBusinessId: true, businessCode: true },
    })
    if (raced) {
      if (DEBUG) console.log("[resolveLaundryBusiness] raced found →", raced.id)
      return raced
    }
    console.error("[resolveLaundryBusiness] auto-link failed for Business", business.id, e)
    return null
  }
}
