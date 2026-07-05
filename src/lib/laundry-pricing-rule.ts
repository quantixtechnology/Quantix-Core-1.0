// Shared helpers for the Pricing Rule management API: normalise the request
// body into Prisma fields (status kept in sync with isActive so the Billing
// Resolver is never matched against non-active rules) and write the append-only
// audit trail.
import type { Prisma, PrismaClient } from "@prisma/client"

const NUM = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v))
const INT = (v: unknown) => (v === "" || v === null || v === undefined ? null : Math.trunc(Number(v)))
const STR = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : ""
  return s.length ? s : null
}

const STATUSES = new Set(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"])

// Build the create/update payload from the request body. Only keys present in
// the body are returned (so PUT can do partial updates), except status/isActive
// which are always reconciled when either is supplied.
export function buildRuleData(b: Record<string, unknown>): Omit<Prisma.LaundryPricingRuleUncheckedCreateInput, "businessId"> {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k)
  const d: Record<string, unknown> = {}

  if (has("name")) d.name = STR(b.name)
  if (has("description")) d.description = STR(b.description)
  if (has("notes")) d.notes = STR(b.notes)
  if (has("serviceId")) d.serviceId = b.serviceId || null
  if (has("garmentId")) d.garmentId = b.garmentId || null
  if (has("categoryId")) d.categoryId = b.categoryId || null
  if (has("storeId")) d.storeId = b.storeId || null
  if (has("customerType")) d.customerType = b.customerType || null
  if (has("pricingType")) d.pricingType = b.pricingType || "PER_PIECE"
  if (has("price")) d.price = Number(b.price) || 0
  if (has("gstPercent")) d.gstPercent = Number(b.gstPercent) || 0
  if (has("minCharge")) d.minCharge = NUM(b.minCharge)
  if (has("maxCharge")) d.maxCharge = NUM(b.maxCharge)
  if (has("minWeightKg")) d.minWeightKg = NUM(b.minWeightKg)
  if (has("maxWeightKg")) d.maxWeightKg = NUM(b.maxWeightKg)
  if (has("extraWeightCharge")) d.extraWeightCharge = NUM(b.extraWeightCharge)
  if (has("includedPieces")) d.includedPieces = INT(b.includedPieces)
  if (has("discountPercent")) d.discountPercent = NUM(b.discountPercent)
  if (has("weekendPrice")) d.weekendPrice = NUM(b.weekendPrice)
  if (has("expressCharge")) d.expressCharge = NUM(b.expressCharge)
  if (has("pickupCharge")) d.pickupCharge = NUM(b.pickupCharge)
  if (has("deliveryCharge")) d.deliveryCharge = NUM(b.deliveryCharge)
  if (has("freeDeliveryThreshold")) d.freeDeliveryThreshold = NUM(b.freeDeliveryThreshold)
  if (has("urgentDeliveryCharge")) d.urgentDeliveryCharge = NUM(b.urgentDeliveryCharge)
  if (has("hsnCode")) d.hsnCode = STR(b.hsnCode)
  if (has("effectiveFrom")) d.effectiveFrom = b.effectiveFrom ? new Date(b.effectiveFrom as string) : null
  if (has("effectiveTo")) d.effectiveTo = b.effectiveTo ? new Date(b.effectiveTo as string) : null
  if (has("priority")) d.priority = Number(b.priority) || 0

  // Reconcile status <-> isActive. ACTIVE is the only status the resolver matches.
  if (has("status") || has("isActive")) {
    let status = has("status") && STATUSES.has(String(b.status)) ? String(b.status) : undefined
    if (!status) status = b.isActive ? "ACTIVE" : "INACTIVE"
    d.status = status
    d.isActive = status === "ACTIVE"
  }

  return d as Omit<Prisma.LaundryPricingRuleUncheckedCreateInput, "businessId">
}

type RuleRow = { id: string; businessId: string; version: number }

export async function writeRuleAudit(
  db: PrismaClient,
  rule: RuleRow & Record<string, unknown>,
  action: string,
  actorId?: string | null,
  actorName?: string | null,
) {
  try {
    await db.laundryPricingRuleAudit.create({
      data: {
        ruleId: rule.id,
        businessId: rule.businessId,
        version: rule.version ?? 1,
        action,
        actorId: actorId || null,
        actorName: actorName || null,
        snapshot: JSON.stringify(rule),
      },
    })
  } catch (e) {
    // Audit is best-effort — never block the rule write.
    console.error("[laundry-pricing] audit write failed", e)
  }
}
