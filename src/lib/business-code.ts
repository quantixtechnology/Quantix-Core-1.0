/**
 * Quantix platform — the Business Code.
 *
 *      BUS-YYYYMM-NNNN          e.g. BUS-202606-0005
 *
 * ONE code, issued by ONE generator, for EVERY tenant — laundry, commerce,
 * grocery, pharmacy and whatever comes next. It is the canonical, business-
 * facing identity of a Business and the only thing downstream identifiers may
 * embed. Product type is metadata stored elsewhere (Business.productCode); it
 * never becomes the identity.
 *
 * This module is the single allocator AND the single repair path, because the
 * defect it exists to prevent is a second generator: `LND-YYYYMM-NNNN` counted
 * laundry businesses on its own sequence and was written into the platform
 * column, so a tenant's identity read LND-202608-0002 instead of the
 * BUS-202606-0005 it already had.
 *
 * ─── What is canonical ──────────────────────────────────────────────────────
 *
 * The DOMAIN token is part of the format, not decoration. `LND-202606-0001`
 * parses structurally (see tenant-identity.ts) but it is not a Business Code,
 * so isCanonicalBusinessCode() rejects it and the repair paths below replace
 * it. `BUS-202606-0005` is canonical and is never rewritten by anything here.
 */
import { prisma } from "@/lib/prisma"
import { parseBusinessCode } from "@/lib/tenant-identity"

/** The one domain token a Business Code may carry. */
export const BUSINESS_CODE_DOMAIN = "BUS"

const pad4 = (n: number) => String(n).padStart(4, "0")
const monthOf = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`

/** How far past the natural ordinal a probe will walk before giving up. */
const MAX_PROBE = 500

/**
 * Is this THE platform Business Code format?
 *
 * Stricter than parseBusinessCode() on purpose: that one answers "does this
 * string have the shape", this one answers "is this the platform's identity".
 * A product-specific code (LND-…, and any future COM-/PHM-) fails here, which
 * is what lets the repair paths below correct a platform row that holds one.
 */
export function isCanonicalBusinessCode(code: string | null | undefined): boolean {
  return parseBusinessCode(code)?.domain === BUSINESS_CODE_DOMAIN
}

/** Minimal surface a caller must supply — the live client or a tx client. */
type BusinessCodeClient = {
  business: {
    count: (args?: never) => Promise<number>
    findFirst: (args: never) => Promise<{ id: string } | null>
  }
}

/**
 * Allocate the next Business Code.
 *
 * `BUS-{creation month}-{ordinal among ALL businesses}` — one sequence for the
 * whole platform, which is what "globally unique" means here. A laundry, a
 * commerce store and a pharmacy share the ordering rather than each counting
 * from 1.
 *
 * The ordinal is a starting point, not the answer: it PROBES forward past any
 * number already taken. count()+1 alone breaks the moment a business is deleted
 * or a code is repaired — two tenants then want the same number and the second
 * create dies on the unique index. Pair this with retryOnBusinessCodeClash() at
 * the write, which closes the remaining window between the probe and the insert.
 */
export async function allocateBusinessCode(
  client: BusinessCodeClient = prisma as unknown as BusinessCodeClient,
  when: Date = new Date(),
): Promise<string> {
  const month = monthOf(when)
  const ordinal = await client.business.count()
  for (let n = ordinal + 1; n < ordinal + 1 + MAX_PROBE; n++) {
    const code = `${BUSINESS_CODE_DOMAIN}-${month}-${pad4(n)}`
    const taken = await client.business.findFirst({ where: { businessCode: code }, select: { id: true } } as never)
    if (!taken) return code
  }
  throw new Error(`Could not allocate a Business Code for ${month} — ${MAX_PROBE} consecutive numbers are taken`)
}

/** A unique-constraint failure on businessCode specifically, not on slug/email. */
export function isBusinessCodeClash(error: unknown): boolean {
  const e = error as { code?: string; meta?: { target?: unknown } } | null
  if (e?.code !== "P2002") return false
  const t = e.meta?.target
  return (Array.isArray(t) ? t.join(",") : String(t ?? "")).toLowerCase().includes("businesscode")
}

/**
 * Re-run a create whose only problem was two tenants racing for one number.
 *
 * The allocator re-probes on each attempt, so the retry lands on the next free
 * number rather than the same one. Anything that is NOT a Business Code clash
 * is rethrown untouched — a duplicate slug must still fail as a duplicate slug.
 */
export async function retryOnBusinessCodeClash<T>(run: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await run()
    } catch (error) {
      if (!isBusinessCodeClash(error)) throw error
      last = error
    }
  }
  throw last
}

/**
 * The tenant's Business Code, repairing it if it is missing or not canonical.
 *
 * Idempotent: a business already holding BUS-202606-0005 causes one indexed read
 * and no write. That restraint is not cosmetic — store codes, customer codes,
 * processing centre codes and transport batch numbers all EMBED the business
 * code (STR-BUS-202606-0005-001, CUS-BUS-202606-0005-000001). Renumbering a
 * business that already has a canonical code would strand every identifier ever
 * derived from it.
 *
 * The value is reconstructed with the original generator's own semantics:
 * BUS-{creation month}-{ordinal among businesses by creation}. So the code a
 * business should have had is the code it gets.
 */
export async function ensureBusinessCode(platformBusinessId: string): Promise<string | null> {
  const biz = await prisma.business.findUnique({
    where: { id: platformBusinessId },
    select: { businessCode: true, createdAt: true },
  }).catch(() => null)
  if (!biz) return null
  if (isCanonicalBusinessCode(biz.businessCode)) return biz.businessCode

  // Ordinal among all businesses by creation — what bizCount + 1 meant at the
  // time this business was created.
  const before = await prisma.business.count({ where: { createdAt: { lt: biz.createdAt } } }).catch(() => null)
  if (before === null) return biz.businessCode ?? null

  const month = monthOf(biz.createdAt)
  // businessCode is @unique platform-wide; a taken number means another
  // business already holds it, so step forward until one lands.
  for (let n = before + 1; n < before + 1 + MAX_PROBE; n++) {
    const code = `${BUSINESS_CODE_DOMAIN}-${month}-${pad4(n)}`
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
 * Only NON-CANONICAL codes are rewritten: `BIZ-PHARMACYDEMO-1784010222908`,
 * `LND-202606-0001` sitting in the platform column, or none at all. A code
 * already canonical is left exactly as it is — see ensureBusinessCode() for why
 * that restraint matters.
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
  const taken = new Set(all.map((b) => b.businessCode).filter((c): c is string => isCanonicalBusinessCode(c)))

  let repaired = 0
  for (let i = 0; i < all.length; i++) {
    const b = all[i]
    if (isCanonicalBusinessCode(b.businessCode)) continue

    const month = monthOf(b.createdAt)
    // Position in creation order across ALL tenants — "as per the date created".
    for (let n = i + 1; n < i + 1 + MAX_PROBE; n++) {
      const code = `${BUSINESS_CODE_DOMAIN}-${month}-${pad4(n)}`
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
