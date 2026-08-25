// THE customer code generator: CUS-{Business Code}-{6-digit sequence}.
//
//     CUS-BUS-202608-0008-000001
//     CUS-BUS-202608-0008-000002
//
// Two things were wrong. The embedded identity was whatever
// Business.businessCode happened to hold, so a business still carrying the
// legacy `BIZ-{SLUG}-{Date.now()}` shape produced
// CUS-BIZ-VASTRASUDHA-1787384817694-000007 — a timestamp and a display name in
// a permanent customer identifier. And the sequence was a MAX scan over
// existing codes, which hands a number back out after the highest customer is
// hard-deleted (customer-hard-delete.ts and the merge path both delete rows).
//
// Now: the CANONICAL Business Code, and a monotonic per-business counter —
// the same mechanism employee ids use, atomic and forward-only, so two
// simultaneous creates cannot collide and a deletion never frees a number.
import { db } from '@/lib/db'
import { ensureBusinessCode } from '@/lib/business-code'
import { nextTenantSequence, peekTenantSequence, tenantSequenceExists, seedTenantSequence } from '@/lib/tenant-identity-server'

/** Customer numbers share the tenant counter table under their own namespace. */
const CUSTOMER_NAMESPACE = 'CUS'
const PAD = 6
const pad = (n: number) => String(n).padStart(PAD, '0')

/** The trailing number of a customer code, whatever prefix it carries. */
function sequenceOf(code: string | null | undefined): number {
  const m = /-(\d{1,10})$/.exec(String(code ?? '').trim())
  if (!m) return 0
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : 0
}

/**
 * Seed the counter ONCE, past every number this business has already used.
 *
 * Existing codes are read regardless of their prefix: a business whose old
 * codes end -000007 continues at 000008 even though those codes carry the old
 * `BIZ-…` identity. Existing customers are never renumbered — only the next
 * number is derived from them.
 */
async function ensureSeeded(businessId: string): Promise<void> {
  if (await tenantSequenceExists(businessId, CUSTOMER_NAMESPACE)) return
  const rows = await db.customer
    .findMany({ where: { businessId }, select: { customerCode: true } })
    .catch(() => [] as { customerCode: string | null }[])
  let max = 0
  for (const r of rows) max = Math.max(max, sequenceOf(r.customerCode))
  await seedTenantSequence(businessId, CUSTOMER_NAMESPACE, max + 1)
}

/**
 * The next customer code for a business. Permanent, never reused.
 *
 * Keyed on the platform business id — never on a code string a caller happens
 * to be holding, which is how a laundry workspace's own `LND-…` code used to
 * end up inside customer identifiers.
 */
export async function generateCustomerCode(businessId: string): Promise<string> {
  // Repairs a missing/legacy platform code rather than embedding one.
  const businessCode = (await ensureBusinessCode(businessId).catch(() => null)) || businessId.slice(0, 12).toUpperCase()
  const prefix = `CUS-${businessCode}-`

  await ensureSeeded(businessId)

  // The counter is authoritative; the lookup only covers a counter that has
  // drifted behind reality (a restore, as the GAR counter once did). It never
  // goes backwards, so nothing is ever reissued.
  for (let i = 0; i < 50; i++) {
    const candidate = `${prefix}${pad(await nextTenantSequence(businessId, CUSTOMER_NAMESPACE))}`
    const taken = await db.customer
      .findFirst({ where: { businessId, customerCode: candidate }, select: { id: true } })
      .catch(() => null)
    if (!taken) return candidate
  }
  throw new Error(`Could not allocate a customer code for business ${businessId}`)
}

/**
 * The code the next customer WOULD get — without consuming it.
 *
 * The sequence-preview surfaces call this. generateCustomerCode() increments,
 * so previewing with it would burn a number every time the page was opened.
 */
export async function peekCustomerCode(businessId: string): Promise<string> {
  const businessCode = (await ensureBusinessCode(businessId).catch(() => null)) || businessId.slice(0, 12).toUpperCase()
  let n = await peekTenantSequence(businessId, CUSTOMER_NAMESPACE)
  if (n == null) {
    const rows = await db.customer
      .findMany({ where: { businessId }, select: { customerCode: true } })
      .catch(() => [] as { customerCode: string | null }[])
    let max = 0
    for (const r of rows) max = Math.max(max, sequenceOf(r.customerCode))
    n = max + 1
  }
  return `CUS-${businessCode}-${pad(n)}`
}

/** Backfill customerCode for every customer that doesn't have one. */
export async function backfillCustomerCodes(): Promise<{ updated: number; skipped: number }> {
  const missing = await db.customer.findMany({
    where: { customerCode: null },
    select: { id: true, businessId: true },
    orderBy: { createdAt: 'asc' },
  })

  let updated = 0
  let skipped = 0

  for (const c of missing) {
    try {
      const code = await generateCustomerCode(c.businessId)
      await db.customer.update({
        where: { id: c.id },
        data: { customerCode: code },
      })
      updated++
    } catch {
      skipped++
    }
  }

  return { updated, skipped }
}
