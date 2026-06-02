/**
 * fix-customer-password-sync.mjs
 *
 * Root cause: set-password only wrote passwordHash to the Customer record for
 * one business, never to User.passwordHash. So customers who set their password
 * on Storefront A appear password-less on Storefronts B and C.
 *
 * This script:
 *   1. Finds every Customer with isPasswordSet=true and a non-null passwordHash
 *      whose linked User has a null passwordHash.
 *   2. Copies the Customer.passwordHash up to User.passwordHash.
 *   3. Logs every record it repairs.
 *
 * Safe to run repeatedly — it skips Users that already have a hash.
 *
 * Usage:  node scripts/fix-customer-password-sync.mjs [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(DRY_RUN ? '--- DRY RUN ---' : '--- LIVE RUN ---');

  // Find Customer records that have a password set but whose User doesn't
  const customers = await db.customer.findMany({
    where: {
      isPasswordSet: true,
      passwordHash: { not: null },
      userId: { not: null },
    },
    select: {
      id: true,
      email: true,
      businessId: true,
      passwordHash: true,
      userId: true,
      business: { select: { name: true } },
      user: { select: { id: true, email: true, passwordHash: true } },
    },
  });

  console.log(`Found ${customers.length} Customer records with isPasswordSet=true`);

  let synced = 0;
  let skipped = 0;

  for (const c of customers) {
    const userHash = c.user?.passwordHash;
    if (userHash) {
      skipped++;
      continue; // User already has a hash — nothing to do
    }

    console.log(
      `  SYNC  customer=${c.id}  email=${c.email}  business="${c.business?.name}"  userId=${c.userId}`
    );

    if (!DRY_RUN) {
      await db.user.update({
        where: { id: c.userId },
        data: { passwordHash: c.passwordHash },
      });
    }
    synced++;
  }

  console.log(`\nDone. Synced: ${synced}  Already-OK: ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
