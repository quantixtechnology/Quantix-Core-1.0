import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

/**
 * Generate the next unique customer code for a business.
 * Format: CUS-{businessCode}-{pad6(seq)}
 * Example: CUS-BUS-202605-0001-000001
 *
 * Uses MAX sequence scan so deletions never cause collisions.
 */
export async function generateCustomerCode(
  businessId: string,
  tx?: Tx,
): Promise<string> {
  const client = (tx ?? db) as typeof db

  const business = await client.business.findUnique({
    where: { id: businessId },
    select: { businessCode: true },
  })

  const bizCode = business?.businessCode ?? businessId.slice(0, 12).toUpperCase()
  const prefix = `CUS-${bizCode}-`

  // Find highest existing sequence for this business
  const existing = await client.customer.findMany({
    where: {
      businessId,
      customerCode: { startsWith: prefix },
    },
    select: { customerCode: true },
  })

  let maxSeq = 0
  for (const c of existing) {
    if (!c.customerCode) continue
    const tail = c.customerCode.slice(prefix.length)
    const seq = parseInt(tail, 10)
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
  }

  return `${prefix}${String(maxSeq + 1).padStart(6, '0')}`
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
