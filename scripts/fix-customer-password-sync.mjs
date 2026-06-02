/**
 * fix-customer-password-sync.mjs
 *
 * Root cause: set-password (first-time password creation) only wrote passwordHash
 * to the Customer record for one business — never to User.passwordHash. So
 * customers who set their password on Storefront A appear password-less on B/C.
 *
 * What this script does:
 *   1. Finds every Customer with isPasswordSet=true and a non-null passwordHash.
 *   2. Resolves the linked User by userId (or falls back to email lookup).
 *   3. If User.passwordHash is null, copies the Customer hash up to User.
 *   4. Also finds any Customer where isPasswordSet=false but the linked User
 *      already has a passwordHash — syncs isPasswordSet=true back down so that
 *      direct Customer lookups (login-password) work without a User join.
 *
 * Safe to run repeatedly — skips records that are already in sync.
 *
 * Usage:  node scripts/fix-customer-password-sync.mjs [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE RUN ===');

  // ── Pass 1: Customer has password → sync up to User ──────────────────────
  const customersWithPw = await db.customer.findMany({
    where: {
      isPasswordSet: true,
      passwordHash: { not: null },
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

  console.log(`\nPass 1 — ${customersWithPw.length} Customer(s) with isPasswordSet=true`);

  let syncedUp = 0;
  let skippedUp = 0;

  for (const c of customersWithPw) {
    // Resolve User: prefer relation, fall back to email lookup
    let user = c.user ?? null;
    if (!user && c.email) {
      user = await db.user.findUnique({
        where: { email: c.email },
        select: { id: true, email: true, passwordHash: true },
      });
    }

    if (!user) {
      console.log(`  SKIP  no User found  customer=${c.id}  email=${c.email}  business="${c.business?.name}"`);
      skippedUp++;
      continue;
    }

    if (user.passwordHash) {
      skippedUp++;
      continue; // User already has a hash — nothing to do
    }

    console.log(`  SYNC↑ customer=${c.id}  email=${c.email ?? '(null)'}  business="${c.business?.name}"  → user=${user.id}`);

    if (!DRY_RUN) {
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: c.passwordHash },
      });
    }
    syncedUp++;
  }

  console.log(`Pass 1 done. Synced-up: ${syncedUp}  Already-OK/skipped: ${skippedUp}`);

  // ── Pass 2: User has password but Customer.isPasswordSet=false → sync down ─
  // This covers accounts where reset-password set User.passwordHash but did not
  // update the other storefronts' Customer records.
  const customersWithoutPw = await db.customer.findMany({
    where: {
      isPasswordSet: false,
    },
    select: {
      id: true,
      email: true,
      businessId: true,
      userId: true,
      business: { select: { name: true } },
      user: { select: { id: true, email: true, passwordHash: true } },
    },
  });

  console.log(`\nPass 2 — ${customersWithoutPw.length} Customer(s) with isPasswordSet=false`);

  let syncedDown = 0;
  let skippedDown = 0;

  for (const c of customersWithoutPw) {
    let user = c.user ?? null;
    if (!user && c.email) {
      user = await db.user.findUnique({
        where: { email: c.email },
        select: { id: true, email: true, passwordHash: true },
      });
    }

    if (!user?.passwordHash) {
      skippedDown++;
      continue; // User has no hash either — nothing to sync down
    }

    console.log(`  SYNC↓ customer=${c.id}  email=${c.email ?? '(null)'}  business="${c.business?.name}"  ← user=${user.id}`);

    if (!DRY_RUN) {
      await db.customer.update({
        where: { id: c.id },
        data: {
          passwordHash: user.passwordHash,
          isPasswordSet: true,
        },
      });
    }
    syncedDown++;
  }

  console.log(`Pass 2 done. Synced-down: ${syncedDown}  Already-OK/skipped: ${skippedDown}`);
  console.log('\nAll done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
