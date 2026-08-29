// ============================================================================
// Store Audit completeness — the single gate that keeps incomplete orders out
// of Packing & QR. An order may only leave Store Audit / be packed when every
// garment has been identified and inspected. "Identified & inspected" = the
// LaundryOrderItem carries an inspectedAt stamp (written by the inspect endpoint
// when the auditor records each garment's condition). The garment lines ARE the
// expected set (per-individual-garment explosion happens later at the Processing
// Center), so completeness = at least one garment AND no garment left
// un-inspected. No override — recovery of a bad order is a separate concern.
// ============================================================================
import { prisma } from "@/lib/prisma"

export interface AuditVerdict {
  ok: boolean
  code?: "AUDIT_INCOMPLETE" | "WEIGHT_REQUIRED"
  message?: string
  expected: number // garment lines on the order
  audited: number  // garment lines with a completed Store Audit inspection
  /** The order's audited total weight, in kg. */
  totalWeightKg?: number
  /** Garments carrying no weight of their own — advisory detail for the message. */
  garmentsWithoutWeight?: number
}

export interface AuditCheckOptions {
  /**
   * Require the order's audited TOTAL WEIGHT before it may leave Store Audit.
   *
   * Opt-in, and passed ONLY by the Audit → Payment transition. Packing calls
   * this same function to re-check identification, and it runs on orders that
   * are already PAST audit — applying the weight rule there would strand
   * in-flight orders that were audited before the rule existed.
   */
  requireWeight?: boolean
}

export async function checkAuditComplete(orderId: string, opts: AuditCheckOptions = {}): Promise<AuditVerdict> {
  const [items, order] = await Promise.all([
    prisma.laundryOrderItem.findMany({ where: { orderId }, select: { id: true, inspectedAt: true, weightKg: true } }),
    prisma.laundryOrder.findUnique({ where: { id: orderId }, select: { totalWeightKg: true } }),
  ])
  const expected = items.length
  const audited = items.filter((i) => i.inspectedAt != null).length
  const totalWeightKg = order?.totalWeightKg ?? 0
  const garmentsWithoutWeight = items.filter((i) => !((i.weightKg ?? 0) > 0)).length

  if (expected === 0) {
    return { ok: false, code: "AUDIT_INCOMPLETE", expected, audited, totalWeightKg, message: "No garments have been identified for this order. Complete Store Audit before packing." }
  }
  if (audited < expected) {
    return { ok: false, code: "AUDIT_INCOMPLETE", expected, audited, totalWeightKg, message: "All garments must be identified before the order can be packed." }
  }

  // ── WEIGHT GATE (Audit → Payment only) ──────────────────────────────────
  //
  // Every audited order carries a total weight before it can be invoiced —
  // per-KG because it IS the price, per-piece because the physical load still
  // has to be recorded for tracking and audit. Weight and price stay separate
  // concerns: capturing a weight on a per-piece order changes no amount.
  //
  // The order's own totalWeightKg is the authoritative figure. It is
  // accumulated at intake from per-garment weights and set at audit for a
  // weighed load, so the operator never re-enters the same total per garment.
  if (opts.requireWeight && !(totalWeightKg > 0)) {
    return {
      ok: false,
      code: "WEIGHT_REQUIRED",
      expected,
      audited,
      totalWeightKg,
      garmentsWithoutWeight,
      message: garmentsWithoutWeight > 0 && garmentsWithoutWeight < expected
        ? `${garmentsWithoutWeight} of ${expected} garments have no weight recorded, and the order has no total weight. Complete the weight entry in Store Audit before generating the invoice.`
        : "This order cannot proceed to Payment because the total garment weight has not been captured. Enter the total weight in Store Audit and try again.",
    }
  }

  return { ok: true, expected, audited, totalWeightKg, garmentsWithoutWeight }
}
