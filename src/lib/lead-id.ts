// ============================================================================
// Lead ID Generator — LED-YYYYMM-XXXX
//
// Generates an immutable, human-readable Lead ID using a per-month sequence
// counter stored in the LeadSequence table. Thread-safe via Prisma transaction.
//
// Examples: LED-202605-0001, LED-202605-0042, LED-202606-0001
// ============================================================================

import type { PrismaClient } from '@prisma/client';

/**
 * Generate the next Lead ID for the current month.
 * Must be called inside a Prisma transaction to be safe under concurrent writes.
 *
 * @param tx — Prisma transaction client (or the main db client for single-row ops)
 */
export async function generateLeadId(
  tx: Pick<PrismaClient, 'leadSequence'>
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthKey = `${year}${month}`; // e.g. "202605"

  // Atomic upsert: create at 1 if new month, else increment
  const seq = await tx.leadSequence.upsert({
    where: { monthKey },
    create: { monthKey, nextVal: 1 },
    update: { nextVal: { increment: 1 } },
  });

  const seq4 = String(seq.nextVal).padStart(4, '0');
  return `LED-${year}${month}-${seq4}`;
}
