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
  code?: "AUDIT_INCOMPLETE"
  message?: string
  expected: number // garment lines on the order
  audited: number  // garment lines with a completed Store Audit inspection
}

export async function checkAuditComplete(orderId: string): Promise<AuditVerdict> {
  const items = await prisma.laundryOrderItem.findMany({
    where: { orderId },
    select: { id: true, inspectedAt: true },
  })
  const expected = items.length
  const audited = items.filter((i) => i.inspectedAt != null).length

  if (expected === 0) {
    return { ok: false, code: "AUDIT_INCOMPLETE", expected, audited, message: "No garments have been identified for this order. Complete Store Audit before packing." }
  }
  if (audited < expected) {
    return { ok: false, code: "AUDIT_INCOMPLETE", expected, audited, message: "All garments must be identified before the order can be packed." }
  }
  return { ok: true, expected, audited }
}
