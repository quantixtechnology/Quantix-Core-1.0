// ============================================================================
// Proposal ID Generator — QX-YYYYMM-XXX
//
// Generates an immutable, human-readable Proposal ID using a per-month sequence
// counter stored in the ProposalSequence table. Thread-safe via Prisma upsert.
//
// Examples: QX-202605-001, QX-202605-042, QX-202606-001
// Sequence resets monthly.
// ============================================================================

import type { PrismaClient } from '@prisma/client';

export async function generateProposalId(
  tx: Pick<PrismaClient, 'proposalSequence'>
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthKey = `${year}${month}`;

  const seq = await tx.proposalSequence.upsert({
    where: { monthKey },
    create: { monthKey, nextVal: 1 },
    update: { nextVal: { increment: 1 } },
  });

  const seq3 = String(seq.nextVal).padStart(3, '0');
  return `QX-${year}${month}-${seq3}`;
}
