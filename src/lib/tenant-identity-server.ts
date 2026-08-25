/**
 * Quantix platform — Tenant Identity, persistence half.
 *
 * The derivation lives in tenant-identity.ts and is pure. This file is the only
 * thing that writes it down, hands out sequence numbers, and answers "which
 * tenant does this employee id belong to?".
 *
 * Product-neutral on purpose: nothing here knows what a laundry is. Laundry OS
 * asks for the EMP and DL namespaces; Commerce can later ask for COM against
 * the very same prefix and counters.
 */
import { prisma } from "@/lib/prisma"
import {
  deriveTenantPrefix, tenantPrefixCandidates, formatEmployeeId, parseEmployeeId,
  normaliseBusinessCode, type EmployeeNamespace,
} from "@/lib/tenant-identity"

/**
 * The tenant's permanent prefix, creating it on first use.
 *
 * Idempotent and safe to call on every employee screen load: once a row exists
 * it is RETURNED, never recomputed and never updated. That is what makes the
 * namespace survive a Business Code edit — §13 asks that editing a code must
 * not silently move an employee namespace, and the only way to guarantee that
 * is to stop deriving after the first write.
 */
export async function getTenantIdentityPrefix(
  businessId: string,
  /**
   * A Business Code and name to fall back on when the platform Business row
   * carries none — supplied by the product after it has repaired the platform
   * code (see businessIdentitySource in laundry-employee-identity.ts). It is
   * NOT a place for a product-specific code: a prefix built from a product's
   * own sequence is a second business identity, which is the whole defect this
   * module exists to prevent.
   */
  fallback?: { code?: string | null; name?: string | null },
): Promise<string> {
  if (!businessId) throw new Error("businessId is required")

  const existing = await prisma.tenantIdentity.findUnique({ where: { businessId }, select: { prefix: true } })
  if (existing) return existing.prefix

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { businessCode: true, name: true },
  })
  const sourceCode = normaliseBusinessCode(business?.businessCode) || normaliseBusinessCode(fallback?.code)
  const sourceName = business?.name || fallback?.name

  // The name is read HERE and only here — once, when the prefix is first
  // issued. After that the row is returned as-is, so a later rename cannot move
  // an existing tenant's employees into a different namespace.
  for (const candidate of tenantPrefixCandidates(sourceCode, sourceName)) {
    try {
      const row = await prisma.tenantIdentity.create({
        data: { businessId, businessCode: sourceCode, prefix: candidate },
        select: { prefix: true },
      })
      return row.prefix
    } catch {
      // Either this business was created concurrently (re-read and use it), or
      // the prefix belongs to someone else (try the next deterministic
      // candidate). Both are resolved by looking.
      const mine = await prisma.tenantIdentity.findUnique({ where: { businessId }, select: { prefix: true } })
      if (mine) return mine.prefix
    }
  }
  throw new Error(`Could not allocate a tenant prefix for business ${businessId}`)
}

/**
 * Next number in a tenant's namespace — atomically.
 *
 * One statement, `next: { increment: 1 }`, so two simultaneous creates cannot
 * read the same value. Explicitly NOT count(*)+1 or max(code)+1: both re-read
 * a table that a concurrent insert is already changing, and both hand the same
 * number to two people. It also never goes backwards, so archiving an employee
 * cannot free their number for reuse.
 */
export async function nextEmployeeSequence(businessId: string, namespace: EmployeeNamespace): Promise<number> {
  return nextTenantSequence(businessId, namespace)
}

/**
 * The same counter, for any tenant-scoped namespace.
 *
 * TenantEmployeeSequence is named for its first use; it is really one
 * monotonic counter per (business, namespace), and customer numbers use it
 * under "CUS". Reusing it rather than adding a second table keeps ONE place
 * where a tenant sequence is issued — and one place that is already known to
 * be atomic.
 */
export async function nextTenantSequence(businessId: string, namespace: string): Promise<number> {
  const row = await prisma.tenantEmployeeSequence.upsert({
    where: { businessId_namespace: { businessId, namespace } },
    create: { businessId, namespace, next: 2 },
    update: { next: { increment: 1 } },
  })
  // upsert returns the row AFTER the update, so the value just issued is next-1
  // on the update path and 1 on the create path.
  return row.next - 1
}

/** Does this namespace already have a counter? Used to seed it exactly once. */
export async function tenantSequenceExists(businessId: string, namespace: string): Promise<boolean> {
  const row = await prisma.tenantEmployeeSequence.findUnique({
    where: { businessId_namespace: { businessId, namespace } },
    select: { id: true },
  }).catch(() => null)
  return !!row
}

/** The value the namespace WOULD issue next, without consuming it. */
export async function peekTenantSequence(businessId: string, namespace: string): Promise<number | null> {
  const row = await prisma.tenantEmployeeSequence.findUnique({
    where: { businessId_namespace: { businessId, namespace } },
    select: { next: true },
  }).catch(() => null)
  return row?.next ?? null
}

/** Start a namespace's counter at `next`, only if it has none yet. */
export async function seedTenantSequence(businessId: string, namespace: string, next: number): Promise<void> {
  if (!Number.isFinite(next) || next < 1) return
  await prisma.tenantEmployeeSequence
    .create({ data: { businessId, namespace, next } })
    .catch(() => null) // already created by a concurrent caller — theirs stands
}

/**
 * Move a counter forward so it can never re-issue a number already in use.
 *
 * Forward-only and idempotent. Needed when existing employees already hold
 * codes (reconciliation, or a database restore that rolled the counter back
 * while the employee rows survived — the same failure the GAR counter hit).
 */
export async function healEmployeeSequence(businessId: string, namespace: EmployeeNamespace, highestUsed: number): Promise<void> {
  if (!Number.isFinite(highestUsed) || highestUsed < 1) return
  const target = highestUsed + 1
  const row = await prisma.tenantEmployeeSequence.findUnique({ where: { businessId_namespace: { businessId, namespace } } })
  if (!row) {
    await prisma.tenantEmployeeSequence.create({ data: { businessId, namespace, next: target } }).catch(() => null)
  } else if (row.next < target) {
    await prisma.tenantEmployeeSequence.update({ where: { id: row.id }, data: { next: target } }).catch(() => null)
  }
}

/** Business Code → Tenant Prefix → the next id in one namespace. */
export async function issueEmployeeId(businessId: string, namespace: EmployeeNamespace): Promise<string> {
  const prefix = await getTenantIdentityPrefix(businessId)
  const seq = await nextEmployeeSequence(businessId, namespace)
  return formatEmployeeId(prefix, namespace, seq)
}

/**
 * Which tenant does this employee id name?
 *
 * The point of the whole feature: on a SHARED login domain the identifier
 * itself carries the tenant, so authentication can be scoped to one business
 * before a password is ever compared. Returns null for anything that is not a
 * well-formed id or whose prefix belongs to no one.
 */
export async function resolveTenantByEmployeeId(employeeId: string | null | undefined): Promise<
  { businessId: string; prefix: string; namespace: EmployeeNamespace; sequence: number } | null
> {
  const parsed = parseEmployeeId(employeeId)
  if (!parsed) return null
  const row = await prisma.tenantIdentity.findUnique({ where: { prefix: parsed.prefix }, select: { businessId: true } })
  if (!row) return null
  return { businessId: row.businessId, prefix: parsed.prefix, namespace: parsed.namespace, sequence: parsed.sequence }
}

/** The prefix a tenant WOULD get, without persisting. Diagnostics/preview only. */
export function previewTenantPrefix(businessCode: string, businessName: string): string {
  return deriveTenantPrefix(businessCode, businessName)
}
