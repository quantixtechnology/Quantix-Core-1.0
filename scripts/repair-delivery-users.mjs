// ============================================================================
// Repair script — Delivery Partner ↔ User authentication
//
// Fixes delivery partners that cannot log in with email + password because the
// historical create path only minted a User when a password was explicitly
// typed (`appEnabled && password && email`). Partners created with App Access
// but no password — or before unified auth — ended up with no linked User,
// no DELIVERY_STAFF role, or no password hash, so /api/core/auth/login returns
// "Invalid email or password".
//
// For each affected partner this script:
//   • links or creates a User by email
//   • ensures a hashed password (generates a temporary one if missing →
//     mustChangePassword = true, so the partner sets their own on first login)
//   • ensures a DELIVERY_STAFF BusinessUser carrying the partner's storeId
//   • links DeliveryPartner.userId and enables App Access
//
// Usage:
//   node scripts/repair-delivery-users.mjs                 # dry-run (no writes)
//   node scripts/repair-delivery-users.mjs --apply         # apply fixes
//   node scripts/repair-delivery-users.mjs --apply --business <businessId>
//
// Idempotent: re-running only touches still-broken partners. Already-valid
// partners (linked user + password + role) are left untouched.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const bizArgIdx = process.argv.indexOf('--business');
const BUSINESS_ID = bizArgIdx !== -1 ? process.argv[bizArgIdx + 1] : null;

function generateTempPassword() {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (set, n) => Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join('');
  return `${pick(upper, 1)}${pick(lower, 3)}-${pick(digits, 4)}`;
}

async function main() {
  console.log(`\n=== Delivery User Repair (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
  if (BUSINESS_ID) console.log(`Scoped to business: ${BUSINESS_ID}`);

  const partners = await db.deliveryPartner.findMany({
    where: { appEnabled: true, ...(BUSINESS_ID ? { businessId: BUSINESS_ID } : {}) },
    include: { user: { include: { businessUsers: true } } },
  });

  console.log(`App-enabled partners scanned: ${partners.length}\n`);

  const report = [];

  for (const p of partners) {
    const reasons = [];
    if (!p.userId || !p.user) reasons.push('NO_LINKED_USER');
    else {
      if (!p.user.passwordHash || !p.user.hasPassword) reasons.push('NO_PASSWORD');
      const hasRole = p.user.businessUsers.some((b) => b.businessId === p.businessId && b.role === 'DELIVERY_STAFF');
      if (!hasRole) reasons.push('NO_DELIVERY_STAFF_ROLE');
      if (!p.user.isActive) reasons.push('USER_INACTIVE');
      const bu = p.user.businessUsers.find((b) => b.businessId === p.businessId);
      if (bu && p.storeId && bu.storeId !== p.storeId) reasons.push('STORE_OUT_OF_SYNC');
    }

    if (reasons.length === 0) continue; // already valid → skip

    if (!p.email) {
      report.push({ partner: p.name, email: '(none)', action: 'SKIPPED — no email on partner', tempPassword: '' });
      continue;
    }

    const email = p.email.toLowerCase().trim();
    let tempPassword = '';

    if (!APPLY) {
      report.push({ partner: p.name, email, action: `WOULD FIX [${reasons.join(', ')}]`, tempPassword: '' });
      continue;
    }

    // ── Resolve / create the User ────────────────────────────────────────────
    let userId = p.userId || null;
    let user = p.user || (userId ? null : await db.user.findUnique({ where: { email }, include: { businessUsers: true } }));

    const needPassword = !user || !user.passwordHash || !user.hasPassword;
    if (needPassword) tempPassword = generateTempPassword();
    const hash = tempPassword ? await bcrypt.hash(tempPassword, 12) : undefined;

    if (!user) {
      const existing = await db.user.findUnique({ where: { email }, include: { businessUsers: true } });
      if (existing) {
        user = existing;
        userId = existing.id;
      }
    }

    if (user) {
      // Link / repair existing user
      userId = user.id;
      const data = { isActive: true };
      if (hash) { data.passwordHash = hash; data.hasPassword = true; data.authProvider = 'PASSWORD'; data.mustChangePassword = true; }
      await db.user.update({ where: { id: user.id }, data });

      const bu = await db.businessUser.findUnique({
        where: { userId_businessId: { userId: user.id, businessId: p.businessId } },
      });
      if (!bu) {
        await db.businessUser.create({
          data: { userId: user.id, businessId: p.businessId, role: 'DELIVERY_STAFF', storeId: p.storeId, isActive: true },
        });
      } else {
        await db.businessUser.update({
          where: { id: bu.id },
          data: { role: 'DELIVERY_STAFF', isActive: true, ...(p.storeId ? { storeId: p.storeId } : {}) },
        });
      }
    } else {
      // Create a brand-new User
      const created = await db.user.create({
        data: {
          email,
          name: p.name,
          phone: p.phone,
          passwordHash: hash,
          hasPassword: true,
          mustChangePassword: true,
          authProvider: 'PASSWORD',
          isActive: true,
          businessUsers: { create: { businessId: p.businessId, role: 'DELIVERY_STAFF', storeId: p.storeId, isActive: true } },
        },
      });
      userId = created.id;
    }

    await db.deliveryPartner.update({ where: { id: p.id }, data: { userId, appEnabled: true } });

    report.push({
      partner: p.name,
      email,
      action: `FIXED [${reasons.join(', ')}]`,
      tempPassword: tempPassword || '(password kept)',
    });
  }

  if (report.length === 0) {
    console.log('No affected partners found — all app-enabled partners can log in. ✅');
  } else {
    console.table(report);
    if (APPLY) {
      console.log('\nShare any generated temporary passwords with the partners.');
      console.log('They will be required to set a new password on first login.');
    } else {
      console.log('\nDry-run only. Re-run with --apply to perform these fixes.');
    }
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
