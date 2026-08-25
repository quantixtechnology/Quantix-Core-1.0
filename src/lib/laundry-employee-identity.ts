/**
 * Laundry OS ─▶ platform Tenant Identity.
 *
 * Laundry OS contributes two namespaces and nothing else: EMP for office staff
 * and DL for delivery executives. Every prefix, counter and parse comes from
 * the shared platform modules — there is deliberately no laundry-specific
 * prefix derivation here, because a second derivation is how two products end
 * up disagreeing about who a tenant is.
 *
 * Note which business id each side uses:
 *   • staff        → BusinessUser.businessId          = platform Business.id
 *   • executives   → LaundryDeliveryExecutive.businessId = LaundryBusiness.id
 * The tenant identity is always keyed on the PLATFORM id, because that is where
 * the Business Code lives.
 */
import { prisma } from "@/lib/prisma"
import { formatEmployeeId, parseEmployeeId } from "@/lib/tenant-identity"
import { getTenantIdentityPrefix, healEmployeeSequence, issueEmployeeId } from "@/lib/tenant-identity-server"

export const STAFF_NAMESPACE = "EMP" as const
export const DELIVERY_NAMESPACE = "DL" as const

/** Legacy delivery codes, from before the namespace existed: EXE001. */
const LEGACY_EXEC_CODE = /^EXE(\d+)$/i

export const issueStaffEmployeeId = (platformBusinessId: string) => issueEmployeeId(platformBusinessId, STAFF_NAMESPACE)
export const issueDeliveryEmployeeId = (platformBusinessId: string) => issueEmployeeId(platformBusinessId, DELIVERY_NAMESPACE)

/**
 * Does this code already belong to this tenant's namespace? Used to leave
 * correct records alone — reconciliation must be a no-op on a healthy tenant.
 */
export function isCurrentFormat(code: string | null | undefined, prefix: string, namespace: "EMP" | "DL"): boolean {
  const parsed = parseEmployeeId(code)
  return !!parsed && parsed.prefix === prefix && parsed.namespace === namespace
}

/**
 * Give this tenant's delivery executives ids in the current format.
 *
 * Non-destructive by construction:
 *   • a code already in {prefix}DL### form is left untouched;
 *   • a legacy EXE007 KEEPS its number and only gains the tenant prefix, so the
 *     human-facing part of the id an executive already knows does not move;
 *   • anything else is issued the next number from the atomic counter.
 * Nothing else on the record — name, mobile, store, password, active flag — is
 * read or written.
 */
export async function reconcileDeliveryExecutiveIds(platformBusinessId: string, laundryBusinessId: string): Promise<number> {
  const prefix = await getTenantIdentityPrefix(platformBusinessId)
  const execs = await prisma.laundryDeliveryExecutive.findMany({
    where: { businessId: laundryBusinessId },
    select: { id: true, employeeCode: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  // Highest number already in this namespace, so the counter can never re-issue
  // one — including the numbers legacy codes are about to keep.
  let highest = 0
  for (const e of execs) {
    const parsed = parseEmployeeId(e.employeeCode)
    if (parsed?.prefix === prefix && parsed.namespace === DELIVERY_NAMESPACE) highest = Math.max(highest, parsed.sequence)
    const legacy = LEGACY_EXEC_CODE.exec((e.employeeCode || "").trim())
    if (legacy) highest = Math.max(highest, parseInt(legacy[1], 10))
  }
  await healEmployeeSequence(platformBusinessId, DELIVERY_NAMESPACE, highest)

  let changed = 0
  for (const e of execs) {
    if (isCurrentFormat(e.employeeCode, prefix, DELIVERY_NAMESPACE)) continue
    const legacy = LEGACY_EXEC_CODE.exec((e.employeeCode || "").trim())
    const code = legacy
      ? formatEmployeeId(prefix, DELIVERY_NAMESPACE, parseInt(legacy[1], 10))
      : await issueDeliveryEmployeeId(platformBusinessId)
    const ok = await prisma.laundryDeliveryExecutive
      .update({ where: { id: e.id }, data: { employeeCode: code } })
      .then(() => true)
      .catch(() => false) // a clash leaves the record exactly as it was
    if (ok) changed++
  }
  return changed
}

/**
 * Give this tenant's staff ids in the current format.
 *
 * The Business Owner is skipped — §5, and the existing staff surface already
 * treats the owner as a different kind of record. Delivery executives are
 * skipped too: they hold a DL id and must not also consume an EMP number.
 * Customers are not staff.
 */
export async function reconcileStaffEmployeeIds(platformBusinessId: string, laundryBusinessId: string): Promise<number> {
  const prefix = await getTenantIdentityPrefix(platformBusinessId)

  const [members, ownerAssignments, execs] = await Promise.all([
    prisma.businessUser.findMany({
      where: { businessId: platformBusinessId, role: { not: "CUSTOMER" } },
      select: { id: true, userId: true, employeeCode: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.laundryAccessAssignment.findMany({
      where: { businessId: platformBusinessId, role: { isOwner: true } },
      select: { userId: true },
    }),
    prisma.laundryDeliveryExecutive.findMany({
      where: { businessId: laundryBusinessId, userId: { not: null } },
      select: { userId: true },
    }),
  ])

  const owners = new Set(ownerAssignments.map((a) => a.userId))
  const delivery = new Set(execs.map((e) => e.userId).filter(Boolean) as string[])

  let highest = 0
  for (const m of members) {
    const parsed = parseEmployeeId(m.employeeCode)
    if (parsed?.prefix === prefix && parsed.namespace === STAFF_NAMESPACE) highest = Math.max(highest, parsed.sequence)
  }
  await healEmployeeSequence(platformBusinessId, STAFF_NAMESPACE, highest)

  let changed = 0
  for (const m of members) {
    if (m.employeeCode) continue                               // never re-issue
    if (owners.has(m.userId) || m.role === "LAUNDRY_OWNER") continue
    if (delivery.has(m.userId)) continue
    const code = await issueStaffEmployeeId(platformBusinessId)
    const ok = await prisma.businessUser
      .update({ where: { id: m.id }, data: { employeeCode: code } })
      .then(() => true)
      .catch(() => false)
    if (ok) changed++
  }
  return changed
}

/**
 * Everything a tenant's employee screens need, reconciled and idempotent.
 * Cheap on a healthy tenant: two indexed reads and no writes.
 */
export async function ensureEmployeeIdentity(platformBusinessId: string, laundryBusinessId: string): Promise<string> {
  const prefix = await getTenantIdentityPrefix(platformBusinessId)
  await reconcileStaffEmployeeIds(platformBusinessId, laundryBusinessId).catch(() => 0)
  await reconcileDeliveryExecutiveIds(platformBusinessId, laundryBusinessId).catch(() => 0)
  return prefix
}
