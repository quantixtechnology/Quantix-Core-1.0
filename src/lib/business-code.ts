/**
 * Business Code repair.
 *
 * Business.businessCode is the platform's source of truth for a tenant's
 * business number, and it is nullable. A business provisioned outside
 * createBusiness() therefore has none — and the laundry side's orphan-repair
 * path writes `LND-<cuid>`, which carries no number either. A tenant in that
 * state has no business number to show OR to build an employee id from, which
 * is how a VASTRASUDHA employee ended up as V0EMP001.
 *
 * This fills a MISSING code. It never rewrites a valid one, so a tenant that
 * already has BUS-202606-0005 is untouched.
 *
 * The value is reconstructed with the original generator's own semantics
 * (src/lib/core/business.ts): BUS-{creation month}-{ordinal among businesses by
 * creation}. So the code a business should have had is the code it gets, rather
 * than a fresh number that would bear no relation to when it was created.
 */
import { prisma } from "@/lib/prisma"
import { parseBusinessCode } from "@/lib/tenant-identity"

const pad4 = (n: number) => String(n).padStart(4, "0")
const monthOf = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`

/**
 * The tenant's Business Code, repairing it if it is missing or unusable.
 * Idempotent: a business with a valid code causes one indexed read and no write.
 */
export async function ensureBusinessCode(platformBusinessId: string): Promise<string | null> {
  const biz = await prisma.business.findUnique({
    where: { id: platformBusinessId },
    select: { businessCode: true, createdAt: true },
  }).catch(() => null)
  if (!biz) return null
  if (parseBusinessCode(biz.businessCode)) return biz.businessCode

  // Ordinal among all businesses by creation — what bizCount + 1 meant at the
  // time this business was created.
  const before = await prisma.business.count({ where: { createdAt: { lt: biz.createdAt } } }).catch(() => null)
  if (before === null) return biz.businessCode ?? null

  const month = monthOf(biz.createdAt)
  // businessCode is @unique platform-wide; a taken number means another
  // business already holds it, so step forward until one lands.
  for (let n = before + 1; n < before + 200; n++) {
    const code = `BUS-${month}-${pad4(n)}`
    const ok = await prisma.business
      .update({ where: { id: platformBusinessId }, data: { businessCode: code } })
      .then(() => true)
      .catch(() => false)
    if (ok) return code
  }
  return biz.businessCode ?? null
}


/**
 * Give every tenant a Business Code in the canonical shape, numbered by when it
 * was created.
 *
 * ONE sequence for the whole platform. A laundry, a commerce store and a
 * pharmacy are all tenants to us, so they share the ordering rather than each
 * counting from 1 — which is what the original generator meant by bizCount + 1.
 *
 * Only MALFORMED codes are rewritten: `BIZ-PHARMACYDEMO-1784010222908`, or none
 * at all. A code already in the canonical shape is left exactly as it is, and
 * that restraint is not cosmetic — store codes, customer codes, processing
 * centre codes and transport batch numbers all EMBED the business code
 * (STR-BUS-202606-0001-001, CUS-BUS-202606-0001-000001). Renumbering a business
 * that already has a valid code would strand every identifier ever derived from
 * it. Repairing one that never had a usable code strands nothing, because
 * nothing valid was derived from it either.
 *
 * Idempotent: a platform where every code is canonical does one read and no
 * writes.
 */
export async function reconcileBusinessCodes(): Promise<{ checked: number; repaired: number }> {
  const all = await prisma.business
    .findMany({ select: { id: true, businessCode: true, createdAt: true }, orderBy: { createdAt: "asc" } })
    .catch(() => null)
  if (!all) return { checked: 0, repaired: 0 }

  // Numbers already spoken for by a canonical code, so a repair never lands on
  // one and never has to touch the business holding it.
  const taken = new Set(all.map((b) => b.businessCode).filter((c): c is string => !!c && !!parseBusinessCode(c)))

  let repaired = 0
  for (let i = 0; i < all.length; i++) {
    const b = all[i]
    if (parseBusinessCode(b.businessCode)) continue

    const month = monthOf(b.createdAt)
    // Position in creation order across ALL tenants — "as per the date created".
    for (let n = i + 1; n < i + 1 + 500; n++) {
      const code = `BUS-${month}-${pad4(n)}`
      if (taken.has(code)) continue
      const ok = await prisma.business
        .update({ where: { id: b.id }, data: { businessCode: code } })
        .then(() => true)
        .catch(() => false) // unique clash with something outside this snapshot
      if (ok) { taken.add(code); repaired++; break }
    }
  }
  return { checked: all.length, repaired }
}
