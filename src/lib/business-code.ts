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
